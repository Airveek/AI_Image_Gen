"use server";

import {
  cancelActiveStoreRuns,
  executeSmallStoreRun,
  getLatestStoreBulkRun,
  requestStoreItemPublish,
  requestStoreItemRetry,
  requestStoreRunPublish,
  startStoreBulkRun,
} from "@/features/store-images/server/runs";
import type {
  StoreImageMode,
  StoreItemRetryResult,
  StorePublishStartResult,
  StoreRunStartResult,
  StoreSelectionMode,
} from "@/features/store-images/types";

export async function startStoreImagesAction(input: {
  prompt: string;
  referenceAssetId: string | null;
  imageMode: StoreImageMode;
  selectionMode: StoreSelectionMode;
  productIds: string[];
  search: string;
  status?: "active" | "draft" | "archived";
}): Promise<StoreRunStartResult> {
  return startStoreBulkRun(input);
}

export async function executeSmallStoreRunAction(runId: string): Promise<void> {
  return executeSmallStoreRun(runId);
}

export async function publishStoreItemAction(itemId: string): Promise<StorePublishStartResult> {
  return requestStoreItemPublish(itemId);
}

export async function publishStoreRunAction(runId: string): Promise<StorePublishStartResult> {
  return requestStoreRunPublish(runId);
}

export async function retryStoreItemAction(itemId: string): Promise<StoreItemRetryResult> {
  return requestStoreItemRetry(itemId);
}

export async function cancelActiveStoreRunsAction(): Promise<number> {
  return cancelActiveStoreRuns();
}

export async function getLatestStoreRunAction() {
  return getLatestStoreBulkRun();
}
