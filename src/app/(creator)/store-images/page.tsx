import type { Metadata } from "next";

import { listStoreProducts, StoreClientError } from "@/features/store-images/server/store-client";
import { getLatestStoreBulkRun } from "@/features/store-images/server/runs";
import { listCreatorAssets } from "@/features/creator/server/assets";
import { StoreImagesWorkspace } from "@/features/store-images/components/store-images-workspace";
import type { CreatorAsset } from "@/features/creator/types";
import type { StoreBulkRun, StoreProductPage } from "@/features/store-images/types";

export const metadata: Metadata = { title: "Store images" };
export const maxDuration = 120;

export default async function StoreImagesPage() {
  let products: StoreProductPage = { products: [], nextCursor: null, total: 0 };
  let latestRun: StoreBulkRun | null = null;
  let logoAssets: CreatorAsset[] = [];
  let connectionError: string | null = null;

  try {
    products = await listStoreProducts({ limit: 40, status: "active" });
    latestRun = await getLatestStoreBulkRun();
  } catch (error) {
    connectionError = error instanceof StoreClientError
      ? error.message
      : error instanceof Error
        ? error.message
        : "The store connection is not ready.";
  }

  try {
    logoAssets = await listCreatorAssets({ kinds: ["reference"], limit: 100 });
  } catch {
    // The store page can still be used if the saved asset list is temporarily unavailable.
  }

  return (
    <StoreImagesWorkspace
      initialProducts={products}
      initialRun={latestRun}
      initialLogoAssets={logoAssets}
      connectionError={connectionError}
    />
  );
}
