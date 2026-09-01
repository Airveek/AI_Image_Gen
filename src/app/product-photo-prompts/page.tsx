import type { Metadata } from "next";

import { SeoArchivePage } from "@/components/seo/seo-archive-page";
import { listSeoPageArchive } from "@/features/seo/server/content";
import { buildSeoMetadata } from "@/lib/seo/site";

export const metadata: Metadata = buildSeoMetadata({ title: "AI Product Photo Prompts", description: "Tested Airveek prompts for clean product listings, lifestyle scenes, and detail photography.", pathname: "/product-photo-prompts" });

export const revalidate = 300;

export default async function ProductPhotoPromptsIndex() {
  const archive = await listSeoPageArchive({ family: "prompt" });
  return <SeoArchivePage eyebrow="Airveek prompt library" title="Start with a product prompt that has already been tested." description="Browse evidence-backed prompt recipes for ecommerce product photography. Each recipe opens the matching Airveek workflow." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/product-photo-prompts" emptyText="Tested prompt recipes will appear here after their generation evidence passes review." />;
}
