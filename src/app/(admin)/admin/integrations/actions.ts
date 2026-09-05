"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage, requireAdminUser } from "@/features/admin/server/authorization";
import { disconnectGoogleDrive } from "@/features/creator/server/drive";
import {
  addBridgeAccount,
  activateProvider,
  deleteBridgeAccount,
  deleteProvider,
  setBridgeAccountEnabled,
  setBridgeRateLimit,
  testAndSaveProvider,
} from "@/features/creator/server/integrations";
import {
  listProviderModels,
  validateProviderBaseUrl,
} from "@/features/creator/server/provider";
import type {
  ImageProviderKind,
  IntegrationActionState,
  ProviderModelResult,
} from "@/features/creator/types";
import { updateBillingConfiguration } from "@/features/billing/server/settings";
import { isBillingMode, isBillingProvider } from "@/lib/billing/types";

type BillingActionState = { status: "idle" | "success" | "error"; message: string };

export async function setBillingConfigurationAction(
  _previousState: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const provider = formData.get("provider");
    const mode = formData.get("mode");
    if (!isBillingProvider(provider) || !isBillingMode(mode)) throw new Error("Choose a valid provider and billing mode.");
    await updateBillingConfiguration(provider, mode);
    revalidatePath("/");
    revalidatePath("/plans");
    revalidatePath("/admin/integrations");
    return { status: "success", message: `${provider === "whop" ? "Whop" : "Stripe"} ${mode === "subscription" ? "monthly subscriptions" : "one-time payments"} activated.` };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveProviderAction(
  _previousState: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  try {
    await requireAdminUser();
    const id = optionalField(formData, "id");
    if (id) validateId(id);
    const test = await testAndSaveProvider({
      id,
      name: requiredField(formData, "name"),
      kind: readProviderKind(requiredField(formData, "kind")),
      baseUrl: requiredField(formData, "baseUrl"),
      model: requiredField(formData, "model"),
      apiKey: optionalField(formData, "apiKey") ?? "",
    });
    revalidatePath("/admin/integrations");
    return {
      status: test.test.supportsReferenceImages ? "success" : "error",
      message: test.test.message,
    };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function addBridgeAccountAction(
  _previousState: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  try {
    await addBridgeAccount({
      label: requiredField(formData, "label"),
      secure1psid: requiredField(formData, "secure1psid"),
      secure1psidts: optionalField(formData, "secure1psidts") ?? "",
    });
    revalidatePath("/admin/integrations");
    return { status: "success", message: "Gemini account saved and checked." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function setBridgeRateLimitAction(
  _previousState: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  try {
    const requests = readPositiveInteger(requiredField(formData, "requests"), "requests");
    const windowSeconds = readPositiveInteger(requiredField(formData, "windowSeconds"), "time frame");
    await setBridgeRateLimit(requests, windowSeconds);
    revalidatePath("/admin/integrations");
    return { status: "success", message: "Shared account request limit updated." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function setBridgeAccountEnabledAction(
  accountId: string,
  enabled: boolean,
): Promise<IntegrationActionState> {
  try {
    await setBridgeAccountEnabled(accountId, enabled);
    revalidatePath("/admin/integrations");
    return { status: "success", message: enabled ? "Gemini account enabled." : "Gemini account paused." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function deleteBridgeAccountAction(accountId: string): Promise<IntegrationActionState> {
  try {
    await deleteBridgeAccount(accountId);
    revalidatePath("/admin/integrations");
    return { status: "success", message: "Gemini account removed." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function loadProviderModelsAction(input: unknown): Promise<ProviderModelResult> {
  try {
    await requireAdminUser();
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new Error("Provider details are invalid.");
    }
    const record = input as Record<string, unknown>;
    const kind = readProviderKind(readStringValue(record.kind, "provider type"));
    const baseUrl = readStringValue(record.baseUrl, "API base URL");
    const apiKey = typeof record.apiKey === "string" ? record.apiKey : "";
    const models = await listProviderModels({
      id: "model-list",
      name: "Model list",
      kind,
      baseUrl: validateProviderBaseUrl(baseUrl),
      model: "unused",
      apiKey: apiKey.trim() || null,
    });
    return { ok: true, models };
  } catch (error) {
    return { ok: false, message: getActionErrorMessage(error) };
  }
}

export async function activateProviderAction(providerId: string): Promise<IntegrationActionState> {
  return runMutation(providerId, activateProvider, "Provider activated.");
}

export async function deleteProviderAction(providerId: string): Promise<IntegrationActionState> {
  return runMutation(providerId, deleteProvider, "Provider deleted.");
}

export async function disconnectDriveAction(): Promise<IntegrationActionState> {
  try {
    await requireAdminUser();
    await disconnectGoogleDrive();
    revalidatePath("/admin/integrations");
    return { status: "success", message: "Google Drive disconnected." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

async function runMutation(
  providerId: string,
  mutation: (providerId: string) => Promise<void>,
  successMessage: string,
): Promise<IntegrationActionState> {
  try {
    await requireAdminUser();
    validateId(providerId);
    await mutation(providerId);
    revalidatePath("/admin/integrations");
    return { status: "success", message: successMessage };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

function requiredField(formData: FormData, name: string): string {
  const value = optionalField(formData, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readProviderKind(value: string): ImageProviderKind {
  if (value === "gemini-official" || value === "gemini-compatible") return value;
  throw new Error("Choose a valid provider type.");
}

function readStringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function validateId(value: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error("Invalid provider id.");
}

function readPositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive whole number.`);
  return parsed;
}
