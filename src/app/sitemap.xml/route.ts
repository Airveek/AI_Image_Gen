import { NextResponse } from "next/server";

import { listSeoSitemapShards } from "@/features/seo/server/content";
import { absoluteUrl } from "@/lib/seo/site";

export const revalidate = 300;

export async function GET() {
  // A database error must not be converted into an empty HTTP-200 sitemap;
  // the service-role RPC throws so the platform can surface/monitor it.
  const entries = await listSeoSitemapShards();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `<sitemap><loc>${escapeXml(absoluteUrl("/sitemaps/static.xml"))}</loc></sitemap>`,
    ...entries.map((entry) => `<sitemap><loc>${escapeXml(absoluteUrl(`/sitemaps/${entry.slug}.xml`))}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}</sitemap>`),
    "</sitemapindex>",
  ].join("");
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
