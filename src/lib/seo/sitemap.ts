export const SITEMAP_SHARD_SIZE = 2_000;

export const SITEMAP_FAMILY_SLUGS: Record<string, string> = {
  "product-hub": "product-hubs",
  "category-hub": "category-hubs",
  listing: "listing-images",
  lifestyle: "lifestyle-images",
  detail: "detail-images",
  prompt: "product-photo-prompts",
  tutorial: "tutorials",
  feature: "features",
};

export const SITEMAP_PAGE_FAMILY_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SITEMAP_FAMILY_SLUGS).map(([pageFamily, slug]) => [slug, pageFamily]),
);

export type ParsedSitemapShardSlug = {
  familySlug: string;
  pageFamily: string;
  month: string;
  shardIndex: number;
};

/**
 * Parse the public family-month shard address without accepting arbitrary
 * database values. The route uses the result to call the bounded shard RPC.
 */
export function parseSitemapShardSlug(value: string): ParsedSitemapShardSlug | null {
  const normalized = value.trim().replace(/\.xml$/, "");
  const match = normalized.match(/^(.+)-(\d{4}-(?:0[1-9]|1[0-2]))-([1-9]\d*)$/);
  if (!match) return null;
  const familySlug = match[1];
  const pageFamily = SITEMAP_PAGE_FAMILY_BY_SLUG[familySlug];
  const shardIndex = Number(match[3]);
  if (!pageFamily || !Number.isSafeInteger(shardIndex) || shardIndex > 1_000_000) return null;
  return { familySlug, pageFamily, month: match[2], shardIndex };
}

export type SitemapPageInput = {
  page_family: string;
  search_lastmod_at?: string | null;
  published_at?: string | null;
};

export type SitemapShard<T extends SitemapPageInput = SitemapPageInput> = {
  slug: string;
  family: string;
  month: string;
  index: number;
  pages: T[];
  lastmod: string | null;
};

/**
 * Partition already-filtered, live pages into deterministic family/month
 * shards. Callers must perform the canonical/indexable/HTTP-200 filtering;
 * this helper deliberately has no database or rendering concerns.
 */
export function buildSitemapShards<T extends SitemapPageInput>(pages: T[], now = new Date()): SitemapShard<T>[] {
  const groups = new Map<string, T[]>();
  for (const page of pages) {
    const family = SITEMAP_FAMILY_SLUGS[page.page_family] ?? "content";
    const month = (page.search_lastmod_at ?? page.published_at ?? now.toISOString()).slice(0, 7);
    const key = `${family}|${month}`;
    const group = groups.get(key) ?? [];
    group.push(page);
    groups.set(key, group);
  }

  return [...groups.entries()].flatMap(([key, group]) => {
    const [family, month] = key.split("|");
    return Array.from({ length: Math.ceil(group.length / SITEMAP_SHARD_SIZE) }, (_, offset) => {
      const pagesInShard = group.slice(offset * SITEMAP_SHARD_SIZE, (offset + 1) * SITEMAP_SHARD_SIZE);
      return {
        slug: `${family}-${month}-${offset + 1}`,
        family,
        month,
        index: offset + 1,
        pages: pagesInShard,
        lastmod: pagesInShard
          .map((page) => page.search_lastmod_at ?? page.published_at)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null,
      };
    });
  });
}
