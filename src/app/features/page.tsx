import type { Metadata } from "next";

import { SeoArchivePage } from "@/components/seo/seo-archive-page";
import { listSeoPageArchive } from "@/features/seo/server/content";
import { buildSeoMetadata } from "@/lib/seo/site";

export const metadata: Metadata = buildSeoMetadata({ title: "Airveek Features", description: "Explore Airveek features through documented product workflows and examples.", pathname: "/features" });

export const revalidate = 300;

export default async function FeaturesIndex() {
  const archive = await listSeoPageArchive({ family: "feature" });
  return <SeoArchivePage eyebrow="Airveek features" title="See how each part of Airveek fits into a real image workflow." description="Feature pages explain the job, the evidence, and the practical path from prompt to publish-ready creative." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/features" emptyText="Feature guides will appear here as their evidence and editorial review complete." />;
}
