import { NextResponse } from "next/server";

import { listAllLiveSeoPages } from "@/features/seo/server/content";
import { absoluteUrl } from "@/lib/seo/site";
import { buildShards } from "@/app/sitemap.xml/route";

type Props = { params: Promise<{ shard: string }> };

export const revalidate = 300;

export async function GET(_request: Request, { params }: Props) {
  const slug = (await params).shard.replace(/\.xml$/, "");
  if (slug === "static") {
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
    ].map((path) => ({ url: absoluteUrl(path) })));
  }

  const shard = buildShards(await listAllLiveSeoPages()).find((entry) => entry.slug === slug);
  if (!shard) return new NextResponse("Not found", { status: 404 });
  return xmlResponse(shard.pages.map((page) => ({ url: absoluteUrl(page.path), lastmod: page.search_lastmod_at ?? page.published_at ?? undefined })));
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
