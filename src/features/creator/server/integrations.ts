import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/admin/server/authorization";
import type {
  BridgeAccountStatus,
  BridgePoolStatus,
  ImageProviderKind,
  ImageProviderSetting,
  ProviderTestResult,
} from "@/features/creator/types";
import {
  testProviderConfiguration,
  requestProviderManagement,
  validateProviderBaseUrl,
  type ProviderConfiguration,
} from "@/features/creator/server/provider";

type ProviderSettingRow = {
  id: string;
  name: string;
  kind: string;
  base_url: string;
  model: string;
  api_key_secret_id: string | null;
  is_active: boolean;
  supports_text_to_image: boolean;
  supports_reference_images: boolean;
  tested_at: string | null;
  last_error: string | null;
};

export type SaveProviderInput = {
  id: string | null;
  name: string;
  kind: ImageProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
};

export type AddBridgeAccountInput = {
  label: string;
  secure1psid: string;
  secure1psidts: string;
};

export async function listImageProviderSettings(): Promise<ImageProviderSetting[]> {
  await requireAdminUser();
  const { data, error } = await createSupabaseAdminClient()
    .from("image_provider_settings")
    .select("id,name,kind,base_url,model,api_key_secret_id,is_active,supports_text_to_image,supports_reference_images,tested_at,last_error")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(databaseSetupMessage(error.message));
  }

  return (data ?? []).map((row) => mapProviderSetting(row as ProviderSettingRow));
}

export async function getActiveProviderConfiguration(): Promise<ProviderConfiguration> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("image_provider_settings")
    .select("id,name,kind,base_url,model,api_key_secret_id,is_active,supports_text_to_image,supports_reference_images,tested_at,last_error")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error("No active image provider is configured. Ask an administrator to open Admin → Integrations.");
  }

  const row = data as ProviderSettingRow;
  const apiKey = row.api_key_secret_id ? await readVaultSecret(row.api_key_secret_id) : null;

  return {
    id: row.id,
    name: row.name,
    kind: readProviderKind(row.kind),
    baseUrl: row.base_url,
    model: row.model,
    apiKey,
  };
}

export async function getBridgePoolStatus(): Promise<BridgePoolStatus | null> {
  await requireAdminUser();
  const configuration = await getActiveProviderConfiguration();
  if (configuration.kind !== "gemini-compatible") {
    return null;
  }
  const body = await requestProviderManagement(configuration, "admin/pool", { method: "GET" });
  return readBridgePoolStatus(body);
}

export async function addBridgeAccount(input: AddBridgeAccountInput): Promise<void> {
  await requireAdminUser();
  const label = input.label.trim();
  const secure1psid = input.secure1psid.trim();
  const secure1psidts = input.secure1psidts.trim();
  if (!label || !secure1psid) {
    throw new Error("Account name and __Secure-1PSID cookie are required.");
  }
  const configuration = await getBridgeConfiguration();
  await requestProviderManagement(configuration, "admin/accounts", {
    method: "POST",
    body: JSON.stringify({
      label,
      secure_1psid: secure1psid,
      secure_1psidts: secure1psidts || null,
      enabled: true,
    }),
  });
}

export async function setBridgeAccountEnabled(accountId: string, enabled: boolean): Promise<void> {
  await requireAdminUser();
  assertBridgeAccountId(accountId);
  const configuration = await getBridgeConfiguration();
  await requestProviderManagement(configuration, `admin/accounts/${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteBridgeAccount(accountId: string): Promise<void> {
  await requireAdminUser();
  assertBridgeAccountId(accountId);
  const configuration = await getBridgeConfiguration();
  await requestProviderManagement(configuration, `admin/accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
  });
}

export async function setBridgeRateLimit(requests: number, windowSeconds: number): Promise<void> {
  await requireAdminUser();
  if (!Number.isInteger(requests) || requests < 1 || requests > 100) {
    throw new Error("Requests per account must be between 1 and 100.");
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 86_400) {
    throw new Error("The time frame must be between 1 second and 24 hours.");
  }
  const configuration = await getBridgeConfiguration();
  await requestProviderManagement(configuration, "admin/rate-limit", {
    method: "PUT",
    body: JSON.stringify({ requests, window_seconds: windowSeconds }),
  });
}

export async function testAndSaveProvider(input: SaveProviderInput): Promise<{
  setting: ImageProviderSetting;
  test: ProviderTestResult;
}> {
  await requireAdminUser();
  const name = input.name.trim();
  const model = input.model.trim().replace(/^models\//, "");
  const baseUrl = validateProviderBaseUrl(input.baseUrl);

  if (!name || !model) {
    throw new Error("Provider name and model are required.");
  }

  const existing = input.id ? await getProviderRow(input.id) : null;
  const apiKey = input.apiKey.trim() || (existing?.api_key_secret_id ? await readVaultSecret(existing.api_key_secret_id) : null);

  if (input.kind === "gemini-official" && !apiKey) {
    throw new Error("Official Gemini requires an API key.");
  }

  const test = await testProviderConfiguration({
    id: input.id ?? "provider-test",
    name,
    kind: input.kind,
    baseUrl,
    model,
    apiKey,
  });

  const adminClient = createSupabaseAdminClient();
  let secretId = existing?.api_key_secret_id ?? null;

  if (input.apiKey.trim()) {
    const secretNameId = (input.id ?? crypto.randomUUID()).replaceAll("-", "_");
    secretId = await setVaultSecret(`airveek_provider_${secretNameId}`, input.apiKey.trim());
  }

  const payload = {
    name,
    kind: input.kind,
    base_url: baseUrl,
    model,
    api_key_secret_id: secretId,
    supports_text_to_image: test.supportsTextToImage,
    supports_reference_images: test.supportsReferenceImages,
    tested_at: new Date().toISOString(),
    last_error: test.supportsReferenceImages ? null : test.message,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? adminClient.from("image_provider_settings").update(payload).eq("id", input.id)
    : adminClient.from("image_provider_settings").insert(payload);
  const { data, error } = await query
    .select("id,name,kind,base_url,model,api_key_secret_id,is_active,supports_text_to_image,supports_reference_images,tested_at,last_error")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { setting: mapProviderSetting(data as ProviderSettingRow), test };
}

export async function activateProvider(providerId: string): Promise<void> {
  await requireAdminUser();
  const row = await getProviderRow(providerId);

  if (!row.supports_text_to_image || !row.supports_reference_images) {
    throw new Error("This provider must pass both generation tests before activation.");
  }

  const adminClient = createSupabaseAdminClient();
  const { error: disableError } = await adminClient
    .from("image_provider_settings")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .neq("id", providerId);

  if (disableError) {
    throw new Error(disableError.message);
  }

  const { error } = await adminClient
    .from("image_provider_settings")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", providerId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteProvider(providerId: string): Promise<void> {
  await requireAdminUser();
  const row = await getProviderRow(providerId);

  if (row.is_active) {
    throw new Error("Activate another provider before deleting this one.");
  }

  const { error } = await createSupabaseAdminClient().from("image_provider_settings").delete().eq("id", providerId);
  if (error) {
    throw new Error(error.message);
  }

  if (row.api_key_secret_id) {
    await deleteVaultSecret(row.api_key_secret_id);
  }
}

export async function setVaultSecret(name: string, value: string): Promise<string> {
  const { data, error } = await createSupabaseAdminClient().rpc("set_airveek_secret", {
    secret_name: name,
    secret_value: value,
  });

  if (error || typeof data !== "string") {
    throw new Error(error?.message ?? "The secret could not be stored in Supabase Vault.");
  }

  return data;
}

export async function readVaultSecret(secretId: string): Promise<string> {
  const { data, error } = await createSupabaseAdminClient().rpc("read_airveek_secret", {
    secret_id: secretId,
  });

  if (error || typeof data !== "string") {
    throw new Error(error?.message ?? "The integration secret could not be read.");
  }

  return data;
}

export async function deleteVaultSecret(secretId: string): Promise<void> {
  const { error } = await createSupabaseAdminClient().rpc("delete_airveek_secret", {
    secret_id: secretId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function getProviderRow(providerId: string): Promise<ProviderSettingRow> {
  const { data, error } = await createSupabaseAdminClient()
    .from("image_provider_settings")
    .select("id,name,kind,base_url,model,api_key_secret_id,is_active,supports_text_to_image,supports_reference_images,tested_at,last_error")
    .eq("id", providerId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Provider configuration not found.");
  }

  return data as ProviderSettingRow;
}

function mapProviderSetting(row: ProviderSettingRow): ImageProviderSetting {
  return {
    id: row.id,
    name: row.name,
    kind: readProviderKind(row.kind),
    baseUrl: row.base_url,
    model: row.model,
    isActive: row.is_active,
    hasApiKey: Boolean(row.api_key_secret_id),
    supportsTextToImage: row.supports_text_to_image,
    supportsReferenceImages: row.supports_reference_images,
    testedAt: row.tested_at,
    lastError: row.last_error,
  };
}

function readProviderKind(value: string): ImageProviderKind {
  if (value === "gemini-official" || value === "gemini-compatible") {
    return value;
  }

  throw new Error("Unknown image provider kind.");
}

function databaseSetupMessage(message: string): string {
  return message.includes("image_provider_settings")
    ? "Creator database tables are not installed. Apply the creator Supabase migration first."
    : message;
}

async function getBridgeConfiguration(): Promise<ProviderConfiguration> {
  const configuration = await getActiveProviderConfiguration();
  if (configuration.kind !== "gemini-compatible") {
    throw new Error("Activate the Gemini-compatible bridge before managing its accounts.");
  }
  return configuration;
}

function readBridgePoolStatus(value: unknown): BridgePoolStatus {
  const topLevel = toRecord(value);
  const record = toRecord(topLevel?.pool) ?? topLevel;
  if (!record) throw new Error("The bridge returned an invalid account status.");
  const rateLimit = toRecord(record.rateLimit);
  const summary = toRecord(record.summary);
  const accounts = Array.isArray(record.accounts)
    ? record.accounts.map(readBridgeAccountStatus)
    : [];
  return {
    provider: readRequiredString(record.provider, "provider"),
    model: readRequiredString(record.model, "model"),
    rateLimit: {
      requests: readRequiredNumber(rateLimit?.requests, "requests per window"),
      windowSeconds: readRequiredNumber(rateLimit?.windowSeconds, "window seconds"),
    },
    summary: {
      total: readRequiredNumber(summary?.total, "account total"),
      ready: readRequiredNumber(summary?.ready, "ready accounts"),
      busy: readRequiredNumber(summary?.busy, "busy accounts"),
      limited: readRequiredNumber(summary?.limited, "limited accounts"),
    },
    accounts,
  };
}

function readBridgeAccountStatus(value: unknown): BridgeAccountStatus {
  const record = toRecord(value);
  if (!record) throw new Error("The bridge returned an invalid account entry.");
  const status = record.status;
  if (status !== "ready" && status !== "busy" && status !== "limited" && status !== "not_ready" && status !== "disabled") {
    throw new Error("The bridge returned an unknown account status.");
  }
  return {
    id: readRequiredString(record.id, "account id"),
    label: readRequiredString(record.label, "account label"),
    enabled: record.enabled === true,
    status,
    requestsInWindow: readRequiredNumber(record.requestsInWindow, "requests in window"),
    remainingInWindow: readRequiredNumber(record.remainingInWindow, "remaining requests"),
    requestLimit: readRequiredNumber(record.requestLimit, "request limit"),
    windowSeconds: readRequiredNumber(record.windowSeconds, "window seconds"),
    totalRequests: readRequiredNumber(record.totalRequests, "total requests"),
    successfulRequests: readRequiredNumber(record.successfulRequests, "successful requests"),
    failedRequests: readRequiredNumber(record.failedRequests, "failed requests"),
    lastRequestAt: readOptionalString(record.lastRequestAt),
    lastError: readOptionalString(record.lastError),
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Bridge ${label} is missing.`);
  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRequiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Bridge ${label} is invalid.`);
  }
  return value;
}

function assertBridgeAccountId(value: string): void {
  if (!/^[a-z0-9_-]{1,80}$/i.test(value)) throw new Error("Invalid bridge account id.");
}
