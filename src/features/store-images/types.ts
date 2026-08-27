export type StoreImageMode = "replace-primary" | "keep-both" | "replace-all";
export type StoreSelectionMode = "selected" | "all";
export type StoreRunExecutionMode = "direct" | "queued";

export type StorePublishStartResult = {
  executionMode: StoreRunExecutionMode;
  requestedCount: number;
  failedCount: number;
};

export type StoreRunStartResult = {
  runId: string;
  executionMode: StoreRunExecutionMode;
};

export type StoreItemRetryResult = {
  executionMode: StoreRunExecutionMode;
  operation: "generation" | "publishing";
  failedCount: number;
};
export type StoreBulkRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed-with-errors"
  | "failed"
  | "cancelled";
export type StoreBulkItemStatus =
  | "queued"
  | "generating"
  | "ready"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type StoreProductStatus = "active" | "draft" | "archived";

export type StoreProduct = {
  id: string;
  name: string;
  handle: string;
  status: StoreProductStatus;
  imageUrl: string | null;
  imageUrls: string[];
  sourceImageUrl: string | null;
  imageVersion: string;
};

export type StoreProductPage = {
  products: StoreProduct[];
  nextCursor: string | null;
  total: number;
};

export type StoreBulkItem = {
  id: string;
  runId: string;
  productId: string;
  productName: string;
  sourceImageUrl: string | null;
  sourceImageVersion: string | null;
  generatedAssetId: string | null;
  status: StoreBulkItemStatus;
  errorMessage: string | null;
  publishedImageUrl: string | null;
};

export type StoreBulkRun = {
  id: string;
  prompt: string;
  referenceAssetId: string | null;
  imageMode: StoreImageMode;
  selectionMode: StoreSelectionMode;
  status: StoreBulkRunStatus;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  publishedCount: number;
  createdAt: string;
  updatedAt: string;
  items: StoreBulkItem[];
};
