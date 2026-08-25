"use server";

import {
  cancelActiveStoreRuns,
  getLatestStoreBulkRun,
  requestStoreItemPublish,
  requestStoreItemRetry,
  requestStoreRunPublish,
  startStoreBulkRun,
} from "@/features/store-images/server/runs";
import type { StoreImageMode, StoreSelectionMode } from "@/features/store-images/types";

export async function startStoreImagesAction(input: {
  prompt: string;
  referenceAssetId: string | null;
  imageMode: StoreImageMode;
  selectionMode: StoreSelectionMode;
  productIds: string[];
  search: string;
  status?: "active" | "draft" | "archived";
}): Promise<string> {
  return startStoreBulkRun(input);
}

export async function publishStoreItemAction(itemId: string): Promise<void> {
  return requestStoreItemPublish(itemId);
}

export async function publishStoreRunAction(runId: string): Promise<void> {
  return requestStoreRunPublish(runId);
}

export async function retryStoreItemAction(itemId: string): Promise<void> {
  return requestStoreItemRetry(itemId);
}

export async function cancelActiveStoreRunsAction(): Promise<number> {
  return cancelActiveStoreRuns();
}

export async function getLatestStoreRunAction() {
  return getLatestStoreBulkRun();
}
