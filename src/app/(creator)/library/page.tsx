import type { Metadata } from "next";

import { CreatorLibrary } from "@/features/creator/components/creator-library";
import { listCreatorAssets } from "@/features/creator/server/assets";
import type { CreatorAsset } from "@/features/creator/types";

export const metadata: Metadata = { title: "Creator Library" };

export default async function LibraryPage() {
  let assets: CreatorAsset[] = [];
  let storageMessage: string | null = null;
  try {
    assets = await listCreatorAssets({ limit: 100 });
  } catch (error) {
    storageMessage = error instanceof Error ? error.message : "Creator storage is not ready.";
  }

  return <CreatorLibrary initialAssets={assets} storageMessage={storageMessage} />;
}
