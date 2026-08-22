import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminUser } from "@/features/admin/server/authorization";
import type {
  ImageProviderKind,
  ImageProviderSetting,
  ProviderTestResult,
} from "@/features/creator/types";
import {
  testProviderConfiguration,
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
