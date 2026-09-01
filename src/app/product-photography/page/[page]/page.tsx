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
  if (!page || page < 2) return { title: "AI product photography guides" };
  return buildSeoMetadata({ title: `AI product photography guides — page ${page}`, description: "Browse more evidence-backed Airveek workflows for product listing, lifestyle, and detail photography.", pathname: archivePagePath("/product-photography", page) });
}

export default async function ProductPhotographyArchivePage({ params }: Props) {
  const page = parseArchivePage((await params).page);
  if (!page || page < 2) notFound();
  const archive = await listSeoPageArchive({ family: "product-hub", page });
  if (page > archive.pageCount) notFound();
  return <SeoArchivePage eyebrow="Airveek product photography" title={`More product-photo workflows — page ${page}.`} description="Explore documented Airveek workflows for clean listings, believable lifestyle scenes, and product-detail images." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/product-photography" emptyText="No additional reviewed product guides are available yet." />;
}
