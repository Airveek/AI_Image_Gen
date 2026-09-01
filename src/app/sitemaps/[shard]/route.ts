import { NextResponse } from "next/server";

import { listSeoPageArchive, listSeoSitemapShardPages } from "@/features/seo/server/content";
import { absoluteUrl } from "@/lib/seo/site";
import { parseSitemapShardSlug } from "@/lib/seo/sitemap";

type Props = { params: Promise<{ shard: string }> };

export const revalidate = 300;

export async function GET(_request: Request, { params }: Props) {
  const slug = (await params).shard.replace(/\.xml$/, "");
  if (slug === "static") {
    const archiveCounts = await Promise.all([
      listSeoPageArchiveCount(),
      listSeoPageArchiveCount("product-hub"),
      listSeoPageArchiveCount("prompt"),
      listSeoPageArchiveCount("feature"),
    ]);
    const archivePaths = ["/use-cases", "/product-photography", "/product-photo-prompts", "/features"].flatMap((rootPath, index) => Array.from({ length: Math.max(0, archiveCounts[index] - 1) }, (_, offset) => `${rootPath}/page/${offset + 2}`));
    return xmlResponse([
      "/",
      "/product-photography",
      "/product-photo-prompts",
      "/use-cases",
      "/features",
      "/authors",
      "/tutorials",
      "/support",
      "/privacy",
      "/terms",
      "/disclaimer",
    ].concat(archivePaths).map((path) => ({ url: absoluteUrl(path) })));
  }

  const parsed = parseSitemapShardSlug(slug);
  if (!parsed) return new NextResponse("Not found", { status: 404 });
  const pages = await listSeoSitemapShardPages(parsed);
  if (!pages.length) return new NextResponse("Not found", { status: 404 });
  return xmlResponse(pages.map((page) => ({ url: absoluteUrl(page.path), lastmod: page.lastmod ?? undefined })));
}

async function listSeoPageArchiveCount(family?: "product-hub" | "prompt" | "feature"): Promise<number> {
  const archive = await listSeoPageArchive({ family, strict: true });
  return archive.pageCount;
}

function xmlResponse(entries: Array<{ url: string; lastmod?: string }>) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) => `<url><loc>${escapeXml(entry.url)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}</url>`),
    "</urlset>",
  ].join("");
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
