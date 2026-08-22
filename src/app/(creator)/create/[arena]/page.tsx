import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CreatorWorkspace } from "@/features/creator/components/creator-workspace";
import { getCreatorArena } from "@/features/creator/catalog";
import { listCreatorAssets } from "@/features/creator/server/assets";
import type { CreatorAsset } from "@/features/creator/types";

type PageProps = { params: Promise<{ arena: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const arena = getCreatorArena((await params).arena);
  return { title: arena?.title ?? "Create" };
}

export default async function CreatorArenaPage({ params }: PageProps) {
  const arena = getCreatorArena((await params).arena);
  if (!arena) notFound();

  let assets: CreatorAsset[] = [];
  let storageMessage: string | null = null;
  try {
    assets = await listCreatorAssets({ limit: 80 });
  } catch (error) {
    storageMessage = error instanceof Error ? error.message : "Creator storage is not ready.";
  }

  return (
    <CreatorWorkspace
      arenaId={arena.id}
      initialAssets={assets}
      storageMessage={storageMessage}
    />
  );
}
