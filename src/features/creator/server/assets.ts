import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireCreatorUser } from "@/features/creator/server/authorization";
import {
  deleteDriveImage,
  downloadDriveImage,
  uploadDriveImage,
} from "@/features/creator/server/drive";
import { validateImageFile } from "@/features/creator/server/files";
import {
  createHotAssetUrl,
  deleteHotAsset,
  uploadHotAsset,
} from "@/features/creator/server/r2";
import type {
  AllowedImageMimeType,
  CreatorArenaId,
  CreatorAsset,
  CreatorAssetKind,
  CreatorAssetRow,
  CreatorErrorCode,
  GeneratedImage,
  GenerationRequest,
} from "@/features/creator/types";

const DEFAULT_DAILY_LIMIT = 5;
const MAX_LIST_SIZE = 100;

export class CreatorServiceError extends Error {
  constructor(
    message: string,
    readonly code: CreatorErrorCode,
  ) {
    super(message);
    this.name = "CreatorServiceError";
  }
}

export async function listCreatorAssets(options?: {
  kinds?: CreatorAssetKind[];
  limit?: number;
}): Promise<CreatorAsset[]> {
  const user = await requireCreatorUser();
  const limit = Math.min(Math.max(options?.limit ?? MAX_LIST_SIZE, 1), MAX_LIST_SIZE);
  let query = createSupabaseAdminClient()
    .from("creator_assets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options?.kinds && options.kinds.length > 0) {
    query = query.in("kind", options.kinds);
  }

  const { data, error } = await query;

  if (error) {
    throw new CreatorServiceError(databaseSetupMessage(error.message), "storage_failed");
  }

  return (data ?? []).map((row) => mapCreatorAsset(row as CreatorAssetRow));
}

export async function listRecentCreatorAssets(limit = 6): Promise<CreatorAsset[]> {
  const assets = await listCreatorAssets({ kinds: ["generation"], limit: Math.min(limit * 4, MAX_LIST_SIZE) });
  return assets.filter((asset) => asset.status === "ready").slice(0, limit);
}

export async function uploadCreatorAsset(input: {
  file: File;
  kind: Exclude<CreatorAssetKind, "generation">;
  name: string;
}): Promise<CreatorAsset> {
  const user = await requireCreatorUser();
  const image = await validateImageFile(input.file);
  const name = normalizeName(input.name || input.file.name);
  const row = await insertAssetRow({
    userId: user.id,
    kind: input.kind,
    name,
    arenaId: null,
    prompt: null,
    settings: {},
    sourceAssetIds: [],
    mimeType: image.mimeType,
    providerKind: null,
    providerModel: null,
  });

  try {
    const driveFileId = await uploadDriveImage({
      userId: user.id,
      assetId: row.id,
      bytes: image.bytes,
      mimeType: image.mimeType,
    });
    const hotCopy = await saveOptionalHotCopy({
      userId: user.id,
      assetId: row.id,
      bytes: image.bytes,
      mimeType: image.mimeType,
    });
    return updateReadyAsset(row.id, user.id, driveFileId, hotCopy, image.mimeType);
  } catch (error) {
    await markAssetFailed(row.id, user.id, "storage_failed");
    throw new CreatorServiceError(
      getErrorMessage(error, "The reference image could not be saved."),
      "storage_failed",
    );
  }
}

export async function createGenerationAsset(input: {
  request: GenerationRequest;
  prompt: string;
  providerKind: GeneratedImage["provider"];
  providerModel: string;
}): Promise<{ id: string; userId: string }> {
  const user = await requireCreatorUser();
  await enforceGenerationLimit(user.id);

  try {
    const row = await insertAssetRow({
      userId: user.id,
      kind: "generation",
      name: generationName(input.request.arenaId),
      arenaId: input.request.arenaId,
      prompt: input.prompt,
      settings: input.request,
      sourceAssetIds: input.request.references.map((reference) => reference.assetId),
      mimeType: null,
      providerKind: input.providerKind,
      providerModel: input.providerModel,
    });
    return { id: row.id, userId: user.id };
  } catch (error) {
    if (isProcessingConstraintError(error)) {
      throw new CreatorServiceError(
        "One image is already being created. Wait for it to finish before starting another.",
        "generation_in_progress",
      );
    }
    throw error;
  }
}

export async function completeGenerationAsset(input: {
  assetId: string;
  userId: string;
  image: GeneratedImage;
}): Promise<CreatorAsset> {
  let driveFileId: string | null = null;

  try {
    driveFileId = await uploadDriveImage({
      userId: input.userId,
      assetId: input.assetId,
      bytes: input.image.bytes,
      mimeType: input.image.mimeType,
    });
    const hotCopy = await saveOptionalHotCopy({
      userId: input.userId,
      assetId: input.assetId,
      bytes: input.image.bytes,
      mimeType: input.image.mimeType,
    });
    return updateReadyAsset(input.assetId, input.userId, driveFileId, hotCopy, input.image.mimeType);
  } catch (error) {
    if (driveFileId) {
      await deleteDriveImage(driveFileId).catch(() => undefined);
    }
    await markAssetFailed(input.assetId, input.userId, "storage_failed");
    throw new CreatorServiceError(
      getErrorMessage(error, "The image was created but could not be saved."),
      "storage_failed",
    );
  }
}

export async function failGenerationAsset(
  assetId: string,
  userId: string,
  errorCode: CreatorErrorCode,
): Promise<void> {
  await markAssetFailed(assetId, userId, errorCode);
}

export async function getOwnedAsset(assetId: string): Promise<CreatorAssetRow> {
  const user = await requireCreatorUser();
  return getAssetRowForUser(assetId, user.id);
}

export async function getOwnedAssetBytes(assetId: string): Promise<{
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
  kind: CreatorAssetKind;
  name: string;
}> {
  const row = await getOwnedAsset(assetId);

  if (row.status !== "ready" || !row.drive_file_id) {
    throw new CreatorServiceError("This image is not ready.", "not_found");
  }

  const mimeType = readMimeType(row.mime_type);
  const bytes = await downloadDriveImage(row.drive_file_id);
  return { bytes, mimeType, kind: readKind(row.kind), name: row.name };
}

export async function getOwnedAssetDelivery(assetId: string): Promise<
  | { kind: "redirect"; url: string; mimeType: AllowedImageMimeType }
  | { kind: "bytes"; bytes: Uint8Array; mimeType: AllowedImageMimeType }
> {
  const row = await getOwnedAsset(assetId);

  if (row.status !== "ready" || !row.drive_file_id) {
    throw new CreatorServiceError("This image is not ready.", "not_found");
  }

  const mimeType = readMimeType(row.mime_type);
  if (row.r2_key && row.r2_expires_at && new Date(row.r2_expires_at).getTime() > Date.now()) {
    try {
      return { kind: "redirect", url: await createHotAssetUrl(row.r2_key), mimeType };
    } catch {
      // Drive is the durable fallback when the optional R2 cache is unavailable.
    }
  }

  return {
    kind: "bytes",
    bytes: await downloadDriveImage(row.drive_file_id),
    mimeType,
  };
}

export async function renameCreatorAsset(assetId: string, name: string): Promise<CreatorAsset> {
  const user = await requireCreatorUser();
  const normalizedName = normalizeName(name);
  await getAssetRowForUser(assetId, user.id);
  const { data, error } = await createSupabaseAdminClient()
    .from("creator_assets")
    .update({ name: normalizedName, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new CreatorServiceError(error?.message ?? "The asset could not be renamed.", "storage_failed");
  }

  return mapCreatorAsset(data as CreatorAssetRow);
}

export async function deleteCreatorAsset(assetId: string): Promise<void> {
  const user = await requireCreatorUser();
  const row = await getAssetRowForUser(assetId, user.id);
  await deleteExternalCopies(row);
  const { error } = await createSupabaseAdminClient()
    .from("creator_assets")
    .delete()
    .eq("id", row.id)
    .eq("user_id", user.id);

  if (error) {
    throw new CreatorServiceError(error.message, "storage_failed");
  }
}

export async function cleanupCreatorAssetsForUser(userId: string): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("creator_assets")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    if (error.message.includes("creator_assets")) {
      return;
    }
    throw new Error(`Could not load the user's creator files: ${error.message}`);
  }

  for (const rawRow of data ?? []) {
    await deleteExternalCopies(rawRow as CreatorAssetRow);
  }

  const { error: deleteError } = await adminClient
    .from("creator_assets")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw new Error(`Could not remove the user's creator records: ${deleteError.message}`);
  }
}

async function getAssetRowForUser(assetId: string, userId: string): Promise<CreatorAssetRow> {
  assertUuid(assetId);
  const { data, error } = await createSupabaseAdminClient()
    .from("creator_assets")
    .select("*")
    .eq("id", assetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new CreatorServiceError(error?.message ?? "Image not found.", "not_found");
  }

  return data as CreatorAssetRow;
}

async function insertAssetRow(input: {
  userId: string;
  kind: CreatorAssetKind;
  name: string;
  arenaId: CreatorArenaId | null;
  prompt: string | null;
  settings: unknown;
  sourceAssetIds: string[];
  mimeType: AllowedImageMimeType | null;
  providerKind: GeneratedImage["provider"] | null;
  providerModel: string | null;
}): Promise<CreatorAssetRow> {
  const { data, error } = await createSupabaseAdminClient()
    .from("creator_assets")
    .insert({
      user_id: input.userId,
      kind: input.kind,
      name: input.name,
      arena_id: input.arenaId,
      prompt: input.prompt,
      settings: input.settings,
      source_asset_ids: input.sourceAssetIds,
      status: "processing",
      mime_type: input.mimeType,
      provider_kind: input.providerKind,
      provider_model: input.providerModel,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new CreatorServiceError(
      databaseSetupMessage(error?.message ?? "The asset record could not be created."),
      "storage_failed",
    );
  }

  return data as CreatorAssetRow;
}

async function updateReadyAsset(
  assetId: string,
  userId: string,
  driveFileId: string,
  hotCopy: { key: string; expiresAt: string } | null,
  mimeType: AllowedImageMimeType,
): Promise<CreatorAsset> {
  const { data, error } = await createSupabaseAdminClient()
    .from("creator_assets")
    .update({
      status: "ready",
      drive_file_id: driveFileId,
      r2_key: hotCopy?.key ?? null,
      r2_expires_at: hotCopy?.expiresAt ?? null,
      mime_type: mimeType,
      error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "The saved image could not be finalized.");
  }

  return mapCreatorAsset(data as CreatorAssetRow);
}

async function markAssetFailed(assetId: string, userId: string, errorCode: CreatorErrorCode): Promise<void> {
  await createSupabaseAdminClient()
    .from("creator_assets")
    .update({
      status: "failed",
      error_code: errorCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("user_id", userId);
}

async function enforceGenerationLimit(userId: string): Promise<void> {
  const dailyLimit = readDailyLimit();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await createSupabaseAdminClient()
    .from("creator_assets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "generation")
    .in("status", ["processing", "ready"])
    .gte("created_at", startOfDay.toISOString());

  if (error) {
    throw new CreatorServiceError(databaseSetupMessage(error.message), "storage_failed");
  }

  if ((count ?? 0) >= dailyLimit) {
    throw new CreatorServiceError(
      `You have used today's ${dailyLimit} prototype generations. Try again tomorrow.`,
      "daily_limit",
    );
  }
}

async function saveOptionalHotCopy(input: {
  userId: string;
  assetId: string;
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
}): Promise<{ key: string; expiresAt: string } | null> {
  try {
    return await uploadHotAsset(input);
  } catch {
    return null;
  }
}

async function deleteExternalCopies(row: CreatorAssetRow): Promise<void> {
  if (row.drive_file_id) {
    await deleteDriveImage(row.drive_file_id);
  }
  if (row.r2_key) {
    await deleteHotAsset(row.r2_key);
  }
}

function mapCreatorAsset(row: CreatorAssetRow): CreatorAsset {
  const status = readStatus(row.status);
  return {
    id: row.id,
    userId: row.user_id,
    kind: readKind(row.kind),
    name: row.name,
    arenaId: readArena(row.arena_id),
    prompt: row.prompt,
    sourceAssetIds: Array.isArray(row.source_asset_ids) ? row.source_asset_ids : [],
    status,
    mimeType: row.mime_type ? readMimeType(row.mime_type) : null,
    createdAt: row.created_at,
    imageUrl: status === "ready" ? `/api/creator/assets/${row.id}/file` : null,
    providerKind: row.provider_kind ? readProviderKind(row.provider_kind) : null,
    providerModel: row.provider_model,
  };
}

function readKind(value: string): CreatorAssetKind {
  if (["product", "person", "character", "reference", "generation"].includes(value)) {
    return value as CreatorAssetKind;
  }
  throw new CreatorServiceError("Unknown asset type.", "storage_failed");
}

function readStatus(value: string): CreatorAsset["status"] {
  if (value === "processing" || value === "ready" || value === "failed") {
    return value;
  }
  throw new CreatorServiceError("Unknown asset status.", "storage_failed");
}

function readArena(value: string | null): CreatorArenaId | null {
  if (value === null || value === "general-image" || value === "product-fashion" || value === "storybook-page") {
    return value;
  }
  throw new CreatorServiceError("Unknown creator arena.", "storage_failed");
}

function readProviderKind(value: string): GeneratedImage["provider"] {
  if (value === "gemini-official" || value === "gemini-compatible") {
    return value;
  }
  throw new CreatorServiceError("Unknown image provider.", "storage_failed");
}

function readMimeType(value: string | null): AllowedImageMimeType {
  if (value === "image/png" || value === "image/jpeg" || value === "image/webp") {
    return value;
  }
  throw new CreatorServiceError("Unsupported stored image type.", "storage_failed");
}

function readDailyLimit(): number {
  const value = Number.parseInt(process.env.DAILY_GENERATION_LIMIT ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

function generationName(arenaId: CreatorArenaId): string {
  if (arenaId === "product-fashion") return "Product & fashion creation";
  if (arenaId === "storybook-page") return "Storybook page";
  return "General image";
}

function normalizeName(value: string): string {
  const name = value.trim().slice(0, 100);
  if (!name) {
    throw new CreatorServiceError("Give this image a name.", "invalid_request");
  }
  return name;
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CreatorServiceError("Invalid image id.", "invalid_request");
  }
}

function isProcessingConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("processing");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function databaseSetupMessage(message: string): string {
  return message.includes("creator_assets")
    ? "Creator storage is not ready. Apply the creator Supabase migration first."
    : message;
}
