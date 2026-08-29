import { NextResponse } from "next/server";

import { listAllLiveSeoPages } from "@/features/seo/server/content";
import { absoluteUrl } from "@/lib/seo/site";

const SHARD_SIZE = 2_000;
const FAMILY_SLUGS: Record<string, string> = {
  "product-hub": "product-hubs",
  "category-hub": "category-hubs",
  listing: "listing-images",
  lifestyle: "lifestyle-images",
  detail: "detail-images",
  prompt: "product-photo-prompts",
  tutorial: "tutorials",
  feature: "features",
};

export const revalidate = 300;

export async function GET() {
  const pages = await listAllLiveSeoPages();
  const entries = buildShards(pages);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `<sitemap><loc>${escapeXml(absoluteUrl("/sitemaps/static.xml"))}</loc></sitemap>`,
    ...entries.map((entry) => `<sitemap><loc>${escapeXml(absoluteUrl(`/sitemaps/${entry.slug}.xml`))}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</sitemap>`),
    "</sitemapindex>",
  ].join("");
  return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}

export function buildShards(pages: Awaited<ReturnType<typeof listAllLiveSeoPages>>) {
  const groups = new Map<string, typeof pages>();
  for (const page of pages) {
    const family = FAMILY_SLUGS[page.page_family] ?? "content";
    const month = (page.search_lastmod_at ?? page.published_at ?? new Date().toISOString()).slice(0, 7);
    const key = `${family}|${month}`;
    const group = groups.get(key) ?? [];
    group.push(page);
    groups.set(key, group);
  }
  return [...groups.entries()].flatMap(([key, group]) => {
    const [family, month] = key.split("|");
    return Array.from({ length: Math.ceil(group.length / SHARD_SIZE) }, (_, index) => ({
      slug: `${family}-${month}-${index + 1}`,
      family,
      month,
      index: index + 1,
      pages: group.slice(index * SHARD_SIZE, (index + 1) * SHARD_SIZE),
      lastmod: group.slice(index * SHARD_SIZE, (index + 1) * SHARD_SIZE).map((page) => page.search_lastmod_at ?? page.published_at).filter(Boolean).sort().at(-1) ?? null,
    }));
  });
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
