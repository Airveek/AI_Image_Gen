import type { Metadata } from "next";

import { SeoArchivePage } from "@/components/seo/seo-archive-page";
import { listSeoPageArchive } from "@/features/seo/server/content";
import { buildSeoMetadata } from "@/lib/seo/site";

export const metadata: Metadata = buildSeoMetadata({ title: "Airveek AI Image Use Cases", description: "Browse documented Airveek workflows by ecommerce image use case.", pathname: "/use-cases" });

export const revalidate = 300;

export default async function UseCasesIndex() {
  const archive = await listSeoPageArchive();
  return <SeoArchivePage eyebrow="Airveek use cases" title="Find the image workflow for the job in front of you." description="Every use case is tied to a real Airveek run, explicit settings, and a practical publish checklist." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/use-cases" emptyText="Approved use cases will appear here automatically after evidence and editorial review." />;
}
