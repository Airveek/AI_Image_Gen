"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage, requireAdminUser } from "@/features/admin/server/authorization";
import { disconnectGoogleDrive } from "@/features/creator/server/drive";
import {
  activateProvider,
  deleteProvider,
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
