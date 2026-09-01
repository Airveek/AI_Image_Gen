import test from "node:test";
import assert from "node:assert/strict";

import { buildSitemapShards, parseSitemapShardSlug } from "../src/lib/seo/sitemap.ts";

test("sitemap shards cap each family/month at 2,000 URLs and retain lastmod", () => {
  const pages = Array.from({ length: 2_001 }, (_, index) => ({
    page_family: "listing",
    published_at: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    search_lastmod_at: index === 2_000 ? "2026-08-31T23:59:00.000Z" : null,
    path: `/product-photography/item-${index + 1}`,
  }));

  const shards = buildSitemapShards(pages, new Date("2026-08-30T00:00:00.000Z"));

  assert.equal(shards.length, 2);
  assert.equal(shards[0].slug, "listing-images-2026-08-1");
  assert.equal(shards[1].slug, "listing-images-2026-08-2");
  assert.equal(shards[0].pages.length, 2_000);
  assert.equal(shards[1].pages.length, 1);
  assert.equal(shards[1].lastmod, "2026-08-31T23:59:00.000Z");
});

test("sitemap shards isolate families and months and handle empty input", () => {
  assert.deepEqual(buildSitemapShards([]), []);

  const shards = buildSitemapShards([
    { page_family: "listing", published_at: "2026-08-01T00:00:00.000Z" },
    { page_family: "lifestyle", published_at: "2026-08-01T00:00:00.000Z" },
    { page_family: "listing", published_at: "2026-09-01T00:00:00.000Z" },
    { page_family: "unknown-family", published_at: "2026-08-01T00:00:00.000Z" },
  ], new Date("2026-08-30T00:00:00.000Z"));

  assert.deepEqual(shards.map((shard) => shard.slug), [
    "listing-images-2026-08-1",
    "lifestyle-images-2026-08-1",
    "listing-images-2026-09-1",
    "content-2026-08-1",
  ]);
  assert.equal(shards[3].lastmod, "2026-08-01T00:00:00.000Z");
});

test("sitemap shard slugs parse only known families, valid months, and bounded indexes", () => {
  assert.deepEqual(parseSitemapShardSlug("listing-images-2026-08-2.xml"), {
    familySlug: "listing-images",
    pageFamily: "listing",
    month: "2026-08",
    shardIndex: 2,
  });
  assert.deepEqual(parseSitemapShardSlug("product-photo-prompts-2026-01-1"), {
    familySlug: "product-photo-prompts",
    pageFamily: "prompt",
    month: "2026-01",
    shardIndex: 1,
  });
  assert.equal(parseSitemapShardSlug("listing-images-2026-13-1"), null);
  assert.equal(parseSitemapShardSlug("unknown-2026-08-1"), null);
  assert.equal(parseSitemapShardSlug("listing-images-2026-08-1000001"), null);
});
