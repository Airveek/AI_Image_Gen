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
  if (!page || page < 2) return { title: "AI product photo prompts" };
  return buildSeoMetadata({ title: `AI product photo prompts — page ${page}`, description: "Browse more tested Airveek prompts for ecommerce product photography.", pathname: archivePagePath("/product-photo-prompts", page) });
}

export default async function ProductPhotoPromptsArchivePage({ params }: Props) {
  const page = parseArchivePage((await params).page);
  if (!page || page < 2) notFound();
  const archive = await listSeoPageArchive({ family: "prompt", page });
  if (page > archive.pageCount) notFound();
  return <SeoArchivePage eyebrow="Airveek prompt library" title={`More tested product prompts — page ${page}.`} description="Browse evidence-backed prompt recipes for ecommerce product photography." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/product-photo-prompts" emptyText="No additional reviewed prompts are available yet." />;
}
