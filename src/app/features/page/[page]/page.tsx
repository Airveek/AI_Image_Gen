import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoArchivePage } from "@/components/seo/seo-archive-page";
import { listSeoPageArchive } from "@/features/seo/server/content";
import { archivePagePath, parseArchivePage } from "@/lib/seo/archive";
import { buildSeoMetadata } from "@/lib/seo/site";

type Props = { params: Promise<{ page: string }> };

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = parseArchivePage((await params).page);
  if (!page || page < 2) return { title: "Airveek features" };
  return buildSeoMetadata({ title: `Airveek features — page ${page}`, description: "Browse more documented Airveek features and the workflows they support.", pathname: archivePagePath("/features", page) });
}

export default async function FeatureArchivePage({ params }: Props) {
  const page = parseArchivePage((await params).page);
  if (!page || page < 2) notFound();
  const archive = await listSeoPageArchive({ family: "feature", page });
  if (page > archive.pageCount) notFound();
  return <SeoArchivePage eyebrow="Airveek features" title={`More Airveek features — page ${page}.`} description="Browse documented features with practical workflows, evidence, and publish-ready use cases." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/features" emptyText="No additional reviewed feature guides are available yet." />;
}
