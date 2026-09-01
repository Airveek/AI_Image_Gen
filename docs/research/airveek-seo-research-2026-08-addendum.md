# Airveek SEO research addendum — August 2026

This addendum records the two independent research lanes used to validate the
Airveek Search-Dominance Autopilot. The lanes reviewed 35 first-party or
primary sources across Google Search Central, Search Console, Bing Webmaster,
and product-owned programmatic SEO case material. It is an operating reference
for the implementation; it is not a promise of rankings or traffic.

## What the research changes

Airveek may process 200 pages in a day, but 200 is a queue and capacity ceiling,
not a quota. Google does not set a daily article limit. It evaluates whether
each page is useful, original, accurate, and made for a real user rather than
for search manipulation. The scaled-content policy applies to human, AI, and
mixed production. A large freelancer team is safe only when it works from
Airveek-owned evidence, a defined editorial purpose, and accountable review;
generic pages made primarily to exploit an established domain are not safe.

The defensible Airveek unit is:

```text
verified product/entity × distinct buyer task × output/channel × evidence pack
```

Do not fan out pages for adjectives, colors, synonyms, years, or platforms
unless the requirements, workflow, evidence, output, and buyer decision are
materially different.

## Evidence-backed architecture

The strongest transferable patterns are:

- Google: people-first content, crawlable anchor links, consistent canonical
  signals, server-rendered main content, accurate sitemaps, stable image URLs,
  and structured data that matches what users can see.
- Canva: searchable hubs with real template inventory, intent-led editorial
  planning, audits that combine or improve weak pages, internal links, and a
  creation CTA.
- Zapier: hub → entity → exact pair/use-case pages powered by proprietary
  structured data, not prose substitutions.

For Airveek that means:

```text
/product-photography/
  → category hub
  → product workflow hub
  → clean-listing-image / lifestyle-image / detail-and-scale spokes
  → product-photo-prompts spoke
```

Every indexable spoke needs a direct answer, one real product source with rights
and checksum evidence, the exact tested prompt/settings/negative constraints,
three independently recorded listing/lifestyle/detail jobs, selected and
rejected outputs, failure/fix notes, limitations, author/reviewer, citations,
descriptive crawlable links, and a creator CTA. Media must be durable public
HTTPS URLs rendered as normal `<img>`/`next/image` elements, not CSS backgrounds.

## Autopilot contract

```text
evidence captured
→ structured draft
→ duplicate/rights/claims/media/link/technical QA
→ editor approval
→ gated publish wave
→ cache invalidation + sitemap shard
→ Bing IndexNow notification
→ 5-minute/24-hour/7-day probes
→ GSC, GA4, Bing, activation and revenue feedback
```

The current implementation fails closed on missing rights, missing independent
jobs, unsupported claims, duplicate intent, orphan links, broken CTA, missing
author/reviewer, non-200 rendering, schema mismatch, or media without an
explicit human-reviewed `qaStatus: "pass"`. Google’s ordinary Indexing API is
not used for articles; it is restricted to supported types such as job
postings and livestream broadcast events. Sitemap submission and IndexNow are
discovery hints, not indexing guarantees.

## Measurement and expansion rule

Use GSC for impressions/clicks/queries/position, GA4 for anonymous behavior,
Supabase for page/evidence/activation state, and Whop/backend facts for paid
transactions and refunds. Review cohorts at 7/14/28/56 days for indexed ratio,
CTR, query overlap, crawl errors, Core Web Vitals, preset opens, signups,
first-generation rate, paid activation, and refunds. Expand only when the
cohort is healthy; merge, improve, quarantine, or archive when it is not.

Start with one product-photography cluster, human-review the first 50 pages of
each template, hold a 600-page approved buffer, and release four 50-page waves.
After a template has 50 reviewed pages and 14 healthy days it may be considered
for automatic scheduling. The global kill switch remains available at all
times.

## Primary references

- [Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google guidance on AI-generated content](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content)
- [Google people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- [Google crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Google canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google image SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Google Search Console and Analytics measurement](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console)
- [Google Indexing API restrictions](https://developers.google.com/search/apis/indexing-api/v3/using-api)
- [Bing sitemap guidance](https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search)
- [Bing AI Performance report](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)
- [Canva content-marketing case](https://www.canva.com/learn/content-marketing-strategy/)
- [Zapier programmatic SEO guide](https://zapier.com/blog/programmatic-seo/)
- [Zapier SEO strategy](https://zapier.com/blog/seo-strategies/)
