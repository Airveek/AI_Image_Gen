import "server-only";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { getAssetBytesForUser, getOwnedAsset } from "@/features/creator/server/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/features/store-images/server/inngest-client";
import { publishStoreImage } from "@/features/store-images/server/store-client";
import type {
  StoreBulkItem,
  StoreBulkRun,
  StoreBulkItemStatus,
  StoreBulkRunStatus,
  StoreImageMode,
  StoreSelectionMode,
} from "@/features/store-images/types";

type RunRow = {
  id: string;
  user_id: string;
  prompt: string;
  reference_asset_id: string | null;
  image_mode: StoreImageMode;
  selection_mode: StoreSelectionMode;
  selected_product_ids: string[];
  search: string;
  status_filter: "active" | "draft" | "archived";
  status: StoreBulkRunStatus;
  total_count: number;
  completed_count: number;
  failed_count: number;
  published_count: number;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  run_id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  source_image_url: string | null;
  source_image_version: string | null;
  generated_asset_id: string | null;
  status: StoreBulkItemStatus;
  error_message: string | null;
  published_image_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function startStoreBulkRun(input: {
  prompt: string;
  referenceAssetId: string | null;
  imageMode: StoreImageMode;
  selectionMode: StoreSelectionMode;
  productIds: string[];
  search: string;
  status?: "active" | "draft" | "archived";
}): Promise<string> {
  const user = await requireCreatorUser();
  const prompt = input.prompt.trim().slice(0, 600);
  if (!prompt) throw new Error("Tell Artistly what the new product images should look like.");

  const referenceAssetId = input.referenceAssetId?.trim() || null;
  if (referenceAssetId) {
    if (!isUuid(referenceAssetId)) throw new Error("Choose a valid logo reference image.");
    const referenceAsset = await getOwnedAsset(referenceAssetId);
    if (referenceAsset.status !== "ready" || referenceAsset.kind !== "reference") {
      throw new Error("Choose a ready logo reference image.");
    }
  }

  const selectedProductIds = Array.from(new Set(input.productIds.map((id) => id.trim()).filter(Boolean))).slice(0, 10_000);
  if (input.selectionMode === "selected" && selectedProductIds.length === 0) {
    throw new Error("Select at least one product first.");
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .insert({
      user_id: user.id,
      prompt,
      reference_asset_id: referenceAssetId,
      image_mode: input.imageMode,
      selection_mode: input.selectionMode,
      selected_product_ids: selectedProductIds,
      search: input.search.trim().slice(0, 120),
      status_filter: input.status ?? "active",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "The bulk run could not be created.");

  await inngest.send({
    name: "store/run.requested",
    data: { runId: data.id, userId: user.id },
  });

  return data.id;
}

export async function getStoreBulkRun(runId: string): Promise<StoreBulkRun | null> {
  const user = await requireCreatorUser();
  return getStoreBulkRunForUser(runId, user.id);
}

export async function getLatestStoreBulkRun(): Promise<StoreBulkRun | null> {
  const user = await requireCreatorUser();
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? getStoreBulkRunForUser(String(data.id), user.id) : null;
}

export async function requestStoreItemPublish(itemId: string): Promise<void> {
  const user = await requireCreatorUser();
  const item = await getItemForUser(itemId, user.id);
  if (!item || item.status !== "ready") throw new Error("This generated image is not ready to publish.");

  await inngest.send({
    name: "store/item.publish.requested",
    data: { itemId, runId: item.run_id, userId: user.id },
  });
}

export async function requestStoreItemRetry(itemId: string): Promise<void> {
  const user = await requireCreatorUser();
  const item = await getItemForUser(itemId, user.id);
  if (!item || item.status !== "failed") throw new Error("Only failed items can be retried.");

  await setItemStatus({ itemId, userId: user.id, status: "queued", errorMessage: null });
  await inngest.send({
    name: "store/item.requested",
    data: { itemId, runId: item.run_id, userId: user.id },
  });
}

export async function requestStoreRunPublish(runId: string): Promise<void> {
  const user = await requireCreatorUser();
  const items = await listItemsForRun(runId, user.id);
  const events = items
    .filter((item) => item.status === "ready")
    .map((item) => ({
      name: "store/item.publish.requested" as const,
      data: { itemId: item.id, runId, userId: user.id },
    }));

  if (events.length > 0) await inngest.send(events);
}

export async function getRunForWorker(runId: string, userId: string): Promise<RunRow | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as RunRow) : null;
}

export async function getItemForWorker(itemId: string, userId: string): Promise<ItemRow | null> {
  return getItemForUser(itemId, userId);
}

export async function createRunItems(input: {
  runId: string;
  userId: string;
  products: Array<{ id: string; name: string; imageUrl: string | null; imageVersion: string }>;
}): Promise<string[]> {
  if (input.products.length === 0) return [];
  const rows = input.products.map((product) => ({
    run_id: input.runId,
    user_id: input.userId,
    product_id: product.id,
    product_name: product.name,
    source_image_url: product.imageUrl,
    source_image_version: product.imageVersion,
  }));
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .upsert(rows, { onConflict: "run_id,product_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);

  const { data: allItems, error: allItemsError } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .select("id")
    .eq("run_id", input.runId)
    .eq("user_id", input.userId);
  if (allItemsError) throw new Error(allItemsError.message);
  return (allItems ?? data ?? []).map((row) => String(row.id));
}

export async function setRunStatus(runId: string, userId: string, status: StoreBulkRunStatus, totalCount?: number): Promise<void> {
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (totalCount !== undefined) update.total_count = totalCount;
  const { error } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .update(update)
    .eq("id", runId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setItemStatus(input: {
  itemId: string;
  userId: string;
  status: StoreBulkItemStatus;
  generatedAssetId?: string | null;
  errorMessage?: string | null;
  publishedImageUrl?: string | null;
}): Promise<void> {
  const existingItem = await getItemForUser(input.itemId, input.userId);
  if (!existingItem) throw new Error("The bulk item no longer exists.");

  const update: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
  if (input.generatedAssetId !== undefined) update.generated_asset_id = input.generatedAssetId;
  if (input.errorMessage !== undefined) update.error_message = input.errorMessage;
  if (input.publishedImageUrl !== undefined) update.published_image_url = input.publishedImageUrl;
  const { error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .update(update)
    .eq("id", input.itemId)
    .eq("user_id", input.userId);
  if (error) throw new Error(error.message);

  await refreshRunProgress(existingItem.run_id, input.userId);
}

export async function publishStoreItemForWorker(itemId: string, userId: string): Promise<void> {
  const item = await getItemForWorker(itemId, userId);
  if (!item || item.status === "published") return;
  if (!item.generated_asset_id || !item.source_image_version) throw new Error("This item has no publishable generated image.");

  await setItemStatus({ itemId, userId, status: "publishing" });
  try {
    const asset = await getAssetBytesForUser(item.generated_asset_id, userId);
    const run = await getRunForWorker(item.run_id, userId);
    if (!run) throw new Error("The bulk run no longer exists.");
    const published = await publishStoreImage({
      productId: item.product_id,
      image: asset.bytes,
      mimeType: asset.mimeType,
      imageMode: run.image_mode,
      imageVersion: item.source_image_version,
      idempotencyKey: item.id,
    });
    await setItemStatus({ itemId, userId, status: "published", publishedImageUrl: published.imageUrl, errorMessage: null });
  } catch (error) {
    await setItemStatus({ itemId, userId, status: "failed", errorMessage: error instanceof Error ? error.message : "Publishing failed." });
    throw error;
  }
}

async function getStoreBulkRunForUser(runId: string, userId: string): Promise<StoreBulkRun | null> {
  const run = await getRunForWorker(runId, userId);
  if (!run) return null;
  const items = await listItemsForRun(runId, userId);
  return {
    id: run.id,
    prompt: run.prompt,
    referenceAssetId: run.reference_asset_id,
    imageMode: run.image_mode,
    selectionMode: run.selection_mode,
    status: run.status,
    totalCount: run.total_count,
    completedCount: items.filter((item) => ["ready", "publishing", "published"].includes(item.status)).length,
    failedCount: items.filter((item) => item.status === "failed").length,
    publishedCount: items.filter((item) => item.status === "published").length,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    items: items.map(mapItem),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function listItemsForRun(runId: string, userId: string): Promise<ItemRow[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .select("*")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ItemRow[];
}

async function getItemForUser(itemId: string, userId: string): Promise<ItemRow | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data as ItemRow) : null;
}

async function refreshRunProgress(runId: string, userId: string): Promise<void> {
  const { data: items, error: itemsError } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .select("status")
    .eq("run_id", runId)
    .eq("user_id", userId);
  if (itemsError) throw new Error(itemsError.message);

  const rows = (items ?? []) as Array<{ status: StoreBulkItemStatus }>;
  const completedCount = rows.filter((item) => ["ready", "publishing", "published"].includes(item.status)).length;
  const failedCount = rows.filter((item) => item.status === "failed").length;
  const publishedCount = rows.filter((item) => item.status === "published").length;
  const allTerminal = rows.length > 0 && rows.every((item) => ["ready", "published", "failed"].includes(item.status));
  const status = allTerminal ? (failedCount > 0 ? "completed-with-errors" : "completed") : "running";

  const { error: runError } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .update({ completed_count: completedCount, failed_count: failedCount, published_count: publishedCount, status, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", userId);
  if (runError) throw new Error(runError.message);
}

function mapItem(item: ItemRow): StoreBulkItem {
  return {
    id: item.id,
    runId: item.run_id,
    productId: item.product_id,
    productName: item.product_name,
    sourceImageUrl: item.source_image_url,
    sourceImageVersion: item.source_image_version,
    generatedAssetId: item.generated_asset_id,
    status: item.status,
    errorMessage: item.error_message,
    publishedImageUrl: item.published_image_url,
  };
}
