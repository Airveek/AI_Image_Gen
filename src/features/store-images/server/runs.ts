import "server-only";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { getAssetBytesForUser, getOwnedAsset } from "@/features/creator/server/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/features/store-images/server/inngest-client";
import { getStoreSourceImageUrl, listStoreProducts, publishStoreImage } from "@/features/store-images/server/store-client";
import { generateStoreProductImage } from "@/features/store-images/server/store-generation";
import type {
  StoreBulkItem,
  StoreBulkRun,
  StoreBulkItemStatus,
  StoreBulkRunStatus,
  StoreImageMode,
  StoreItemRetryResult,
  StoreRunStartResult,
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

export const SMALL_RUN_LIMIT = 5;

type RunProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  sourceImageUrl: string | null;
  imageVersion: string;
};

export async function startStoreBulkRun(input: {
  prompt: string;
  referenceAssetId: string | null;
  imageMode: StoreImageMode;
  selectionMode: StoreSelectionMode;
  productIds: string[];
  search: string;
  status?: "active" | "draft" | "archived";
}): Promise<StoreRunStartResult> {
  const user = await requireCreatorUser();
  const prompt = input.prompt.trim().slice(0, 600);
  if (!prompt) throw new Error("Tell Airveek what the new product images should look like.");

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

  const runId = String(data.id);
  try {
    let products: RunProduct[] | null = null;
    const search = input.search.trim().slice(0, 120);
    const status = input.status ?? "active";

    if (input.selectionMode === "selected" && selectedProductIds.length < SMALL_RUN_LIMIT) {
      products = await loadRunProducts({ selectionMode: input.selectionMode, selectedProductIds, search, status });
    } else if (input.selectionMode === "all") {
      const firstPage = await listStoreProducts({ limit: 100, search, status });
      if (firstPage.total < SMALL_RUN_LIMIT) {
        products = firstPage.nextCursor
          ? await loadRunProducts({ selectionMode: input.selectionMode, selectedProductIds, search, status })
          : firstPage.products;
      }
    }

    if (products && products.length < SMALL_RUN_LIMIT) {
      await prepareSmallStoreGeneration({
        runId,
        userId: user.id,
        products,
      });
      return { runId, executionMode: "direct" };
    }

    await inngest.send({
      name: "store/run.requested",
      data: { runId, userId: user.id },
    });
  } catch (error) {
    await setRunStatus(runId, user.id, "failed").catch(() => undefined);
    throw error;
  }

  return { runId, executionMode: "queued" };
}

export async function executeSmallStoreRun(runId: string): Promise<void> {
  const user = await requireCreatorUser();
  const run = await getRunForWorker(runId, user.id);
  if (!run) throw new Error("The bulk run no longer exists.");
  if (run.total_count >= SMALL_RUN_LIMIT) throw new Error("This run must be processed by the bulk queue.");
  if (run.status === "cancelled") return;

  const items = await listItemsForRun(runId, user.id);
  if (items.length === 0) return;
  await Promise.allSettled(
    items
      .filter((item) => item.status === "queued")
      .map((item) => generateStoreItemDirect(item.id, user.id)),
  );
  await refreshRunProgress(runId, user.id);
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

  const claimedItems = await markItemsForPublishing({
    itemIds: [item.id],
    runId: item.run_id,
    userId: user.id,
    expectedStatus: "ready",
  });
  if (claimedItems.length === 0) throw new Error("This generated image is no longer ready to publish.");

  try {
    await inngest.send({
      name: "store/item.publish.requested",
      data: { itemId, runId: item.run_id, userId: user.id },
    });
  } catch (error) {
    await restorePublishingItems({ itemIds: [item.id], runId: item.run_id, userId: user.id, status: "ready" });
    throw error;
  }
}

export async function requestStoreItemRetry(itemId: string): Promise<StoreItemRetryResult> {
  const user = await requireCreatorUser();
  const item = await getItemForUser(itemId, user.id);
  if (!item || item.status !== "failed") throw new Error("Only failed items can be retried.");

  const run = await getRunForWorker(item.run_id, user.id);
  if (!run) throw new Error("The bulk run no longer exists.");
  if (run.status === "cancelled") throw new Error("This run was cancelled. Start a new run instead.");

  if (item.generated_asset_id && item.source_image_version) {
    const claimedItems = await markItemsForPublishing({
      itemIds: [item.id],
      runId: item.run_id,
      userId: user.id,
      expectedStatus: "failed",
    });
    if (claimedItems.length === 0) throw new Error("This image is no longer ready to retry.");
    try {
      await inngest.send({
        name: "store/item.publish.requested",
        data: { itemId, runId: item.run_id, userId: user.id },
      });
    } catch (error) {
      await restorePublishingItems({ itemIds: [item.id], runId: item.run_id, userId: user.id, status: "failed" });
      throw error;
    }
    return { executionMode: "publishing" };
  }

  const { error: sourceImageError } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .update({ source_image_url: getStoreSourceImageUrl(item.product_id), updated_at: new Date().toISOString() })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (sourceImageError) throw new Error(sourceImageError.message);

  if ((run?.total_count ?? 0) < SMALL_RUN_LIMIT) {
    await setItemStatus({ itemId, userId: user.id, status: "queued", errorMessage: null });
    return { executionMode: "direct" };
  }

  await setItemStatus({ itemId, userId: user.id, status: "queued", errorMessage: null });
  await inngest.send({
    name: "store/item.requested",
    data: { itemId, runId: item.run_id, userId: user.id },
  });
  return { executionMode: "queued" };
}

export async function requestStoreRunPublish(runId: string): Promise<void> {
  const user = await requireCreatorUser();
  const items = await listItemsForRun(runId, user.id);
  const readyItemIds = items.filter((item) => item.status === "ready").map((item) => item.id);
  if (readyItemIds.length === 0) return;

  const claimedItems = await markItemsForPublishing({
    itemIds: readyItemIds,
    runId,
    userId: user.id,
    expectedStatus: "ready",
  });
  const events = claimedItems
    .map((item) => ({
      name: "store/item.publish.requested" as const,
      data: { itemId: item.id, runId, userId: user.id },
    }));

  try {
    if (events.length > 0) await inngest.send(events);
  } catch (error) {
    await restorePublishingItems({
      itemIds: claimedItems.map((item) => item.id),
      runId,
      userId: user.id,
      status: "ready",
    });
    throw error;
  }
}

export async function cancelStoreRun(runId: string): Promise<void> {
  const user = await requireCreatorUser();
  await cancelStoreRunForUser(runId, user.id);
}

export async function cancelActiveStoreRuns(): Promise<number> {
  const user = await requireCreatorUser();
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .select("id")
    .eq("user_id", user.id)
    .in("status", ["queued", "running"]);
  if (error) throw new Error(error.message);

  const runIds = (data ?? []).map((row) => String(row.id));
  await Promise.all(runIds.map((runId) => cancelStoreRunForUser(runId, user.id)));
  return runIds.length;
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
  products: Array<{ id: string; name: string; imageUrl: string | null; sourceImageUrl: string | null; imageVersion: string }>;
}): Promise<string[]> {
  if (input.products.length === 0) return [];
  const rows = input.products.map((product) => ({
    run_id: input.runId,
    user_id: input.userId,
    product_id: product.id,
    product_name: product.name,
    source_image_url: product.sourceImageUrl,
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
  let query = createSupabaseAdminClient()
    .from("store_bulk_runs")
    .update(update)
    .eq("id", runId)
    .eq("user_id", userId);
  if (status !== "cancelled") query = query.neq("status", "cancelled");
  const { error } = await query;
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
  let query = createSupabaseAdminClient()
    .from("store_bulk_items")
    .update(update)
    .eq("id", input.itemId)
    .eq("user_id", input.userId);
  if (input.status !== "cancelled") query = query.neq("status", "cancelled");
  const { error } = await query;
  if (error) throw new Error(error.message);

  await refreshRunProgress(existingItem.run_id, input.userId);
}

export async function publishStoreItemForWorker(itemId: string, userId: string): Promise<void> {
  const item = await getItemForWorker(itemId, userId);
  if (!item || item.status === "published" || item.status === "cancelled") return;
  if (!item.generated_asset_id || !item.source_image_version) throw new Error("This item has no publishable generated image.");

  const currentRun = await getRunForWorker(item.run_id, userId);
  if (!currentRun || currentRun.status === "cancelled") return;

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
    const latestRun = await getRunForWorker(item.run_id, userId);
    await setItemStatus({
      itemId,
      userId,
      status: latestRun?.status === "cancelled" ? "cancelled" : "failed",
      errorMessage: latestRun?.status === "cancelled" ? "Run cancelled during publishing." : error instanceof Error ? error.message : "Publishing failed.",
    });
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

async function cancelStoreRunForUser(runId: string, userId: string): Promise<void> {
  const { data: run, error: runError } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .select("id, status")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (runError) throw new Error(runError.message);
  if (!run || !["queued", "running"].includes(String(run.status))) return;

  const now = new Date().toISOString();
  const { error: itemError } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .update({ status: "cancelled", error_message: "Cancelled by user.", updated_at: now })
    .eq("run_id", runId)
    .eq("user_id", userId)
    .in("status", ["queued", "generating", "publishing"]);
  if (itemError) throw new Error(itemError.message);

  const { error } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", runId)
    .eq("user_id", userId)
    .in("status", ["queued", "running"]);
  if (error) throw new Error(error.message);
}

async function prepareSmallStoreGeneration(input: {
  runId: string;
  userId: string;
  products: RunProduct[];
}): Promise<void> {
  const itemIds = await createRunItems({
    runId: input.runId,
    userId: input.userId,
    products: input.products,
  });
  await setRunStatus(input.runId, input.userId, "running", input.products.length);

  if (itemIds.length === 0) {
    await setRunStatus(input.runId, input.userId, "completed", 0);
    return;
  }

}

async function generateStoreItemDirect(itemId: string, userId: string): Promise<void> {
  const item = await claimQueuedItemForGeneration(itemId, userId);
  if (!item) return;

  const run = await getRunForWorker(item.run_id, userId);
  if (!run || run.status === "cancelled") {
    await setItemStatus({ itemId, userId, status: "cancelled", errorMessage: "Run cancelled before generation." });
    return;
  }
  if (!item.source_image_url) {
    await setItemStatus({ itemId, userId, status: "failed", errorMessage: "This product has no source image." });
    return;
  }

  try {
    const asset = await generateStoreProductImage({
      userId,
      productName: item.product_name,
      sourceImageUrl: item.source_image_url,
      prompt: run.prompt,
      referenceAssetId: run.reference_asset_id,
    });
    const latestRun = await getRunForWorker(item.run_id, userId);
    if (!latestRun || latestRun.status === "cancelled") {
      await setItemStatus({ itemId, userId, status: "cancelled", generatedAssetId: asset.id, errorMessage: "Run cancelled after generation." });
      return;
    }
    await setItemStatus({ itemId, userId, status: "ready", generatedAssetId: asset.id, errorMessage: null });
  } catch (error) {
    await setItemStatus({
      itemId,
      userId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Image generation failed.",
    });
  }
}

export async function loadRunProducts(input: {
  selectionMode: StoreSelectionMode;
  selectedProductIds: string[];
  search: string;
  status: "active" | "draft" | "archived";
}): Promise<RunProduct[]> {
  const selected = new Set(input.selectedProductIds);
  const products: RunProduct[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 500; page += 1) {
    const result = await listStoreProducts({
      cursor,
      limit: 100,
      search: input.search,
      status: input.status,
    });
    products.push(...result.products.filter((product) => input.selectionMode === "all" || selected.has(product.id)));
    cursor = result.nextCursor;
    if (!cursor) break;
  }

  return products;
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
  const { data: run, error: runStatusError } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .select("status")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (runStatusError) throw new Error(runStatusError.message);
  if (run?.status === "cancelled") return;

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
  const cancelledCount = rows.filter((item) => item.status === "cancelled").length;
  const generationFinished = rows.length > 0 && rows.every((item) => !["queued", "generating"].includes(item.status));
  const status = generationFinished ? (failedCount > 0 || cancelledCount > 0 ? "completed-with-errors" : "completed") : "running";

  const { error: runError } = await createSupabaseAdminClient()
    .from("store_bulk_runs")
    .update({ completed_count: completedCount, failed_count: failedCount, published_count: publishedCount, status, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", userId);
  if (runError) throw new Error(runError.message);
}

async function claimQueuedItemForGeneration(itemId: string, userId: string): Promise<ItemRow | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .update({ status: "generating", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", userId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const item = data as ItemRow;
  await refreshRunProgress(item.run_id, userId);
  return item;
}

async function markItemsForPublishing(input: {
  itemIds: string[];
  runId: string;
  userId: string;
  expectedStatus: "ready" | "failed";
}): Promise<ItemRow[]> {
  if (input.itemIds.length === 0) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .update({ status: "publishing", error_message: null, updated_at: new Date().toISOString() })
    .in("id", input.itemIds)
    .eq("run_id", input.runId)
    .eq("user_id", input.userId)
    .eq("status", input.expectedStatus)
    .select("*");
  if (error) throw new Error(error.message);
  await refreshRunProgress(input.runId, input.userId);
  return (data ?? []) as ItemRow[];
}

async function restorePublishingItems(input: {
  itemIds: string[];
  runId: string;
  userId: string;
  status: "ready" | "failed";
}): Promise<void> {
  if (input.itemIds.length === 0) return;
  const { error } = await createSupabaseAdminClient()
    .from("store_bulk_items")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .in("id", input.itemIds)
    .eq("run_id", input.runId)
    .eq("user_id", input.userId)
    .eq("status", "publishing");
  if (error) throw new Error(error.message);
  await refreshRunProgress(input.runId, input.userId);
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
