import type { Metadata } from "next";

import { SeoArchivePage } from "@/components/seo/seo-archive-page";
import { buildSeoMetadata } from "@/lib/seo/site";
import { listSeoPageArchive } from "@/features/seo/server/content";

export const metadata: Metadata = buildSeoMetadata({ title: "AI Product Photography Guides", description: "Evidence-backed Airveek workflows for product listing, lifestyle, and detail photography.", pathname: "/product-photography" });

export const revalidate = 300;

export default async function ProductPhotographyIndex() {
  const archive = await listSeoPageArchive({ family: "product-hub" });
  return <SeoArchivePage eyebrow="Airveek product photography" title="Create product images that answer the buyer’s real questions." description="Explore documented Airveek workflows for clean listings, believable lifestyle scenes, and product-detail images. Every guide is tied to a verified generation run." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/product-photography" emptyText="The first verified product guides are being prepared. Once a page passes the evidence and editorial gates, it will appear here automatically." />;
}
