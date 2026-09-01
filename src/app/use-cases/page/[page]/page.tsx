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
  if (!page || page < 2) return { title: "Airveek use cases" };
  return buildSeoMetadata({ title: `Airveek AI image use cases — page ${page}`, description: "Browse more documented Airveek image workflows by ecommerce use case.", pathname: archivePagePath("/use-cases", page) });
}

export default async function UseCasesArchivePage({ params }: Props) {
  const page = parseArchivePage((await params).page);
  if (!page || page < 2) notFound();
  const archive = await listSeoPageArchive({ page });
  if (page > archive.pageCount) notFound();
  return <SeoArchivePage eyebrow="Airveek use cases" title={`More image workflows for the job in front of you — page ${page}.`} description="Every use case is tied to a real Airveek run, explicit settings, and a practical publish checklist." pages={archive.pages} page={archive.page} pageCount={archive.pageCount} rootPath="/use-cases" emptyText="No additional reviewed use cases are available yet." />;
}
