# Airveek measurement and feedback loop

Use one source of truth for each question and join systems by non-PII content
dimensions. Never infer revenue from Search Console or infer ranking from GA4.

| Question | Source of truth |
| --- | --- |
| Google impressions, clicks, queries, CTR, position | Google Search Console |
| Anonymous landing behavior and engagement | GA4 + BigQuery export |
| Page state, preset open/copy, signup, generation, activation | Supabase |
| Paid transaction, currency, refund | Whop/backend payment facts |
| Bing discovery and performance | Bing Webmaster + IndexNow |
| Actual status, canonical, schema, links, media, rendering | Airveek crawler |

## Dimensions and events

Carry `page_id`, `content_id`, `cluster_id`, `page_family`, `product_entity`,
`image_job`, `template_version`, `preset_id`, `cohort_id`, `writer_id`,
`editor_id`, and experiment variant. The acquisition cookie is signed,
consent-aware, first-party, and stores first touch, last non-direct touch,
landing path/page, referrer, and UTM values without PII.

The funnel is:

`organic landing → engaged page → result gallery/preset open → prompt copied →
signup → first generation → checkout → paid activation/refund`.

Accepted SEO interactions are also written to the consent-gated `seo_events`
fact table with a hashed anonymous identifier, page/content dimensions, and the
event timestamp. The table is an audit trail; aggregate behavior still comes
from GA4/BigQuery and raw event rows should not be loaded into dashboard memory.

GSC query/page rows are also copied into `seo_keyword_evidence` during the
watermarked source-sync job. Each record keeps the query, page URL/page ID,
date, clicks, impressions, CTR, position, search dimensions, provider source,
and a stable checksum. Imports are idempotent and chunked; these facts inform
future briefs and opportunity scoring but never create or publish a page by
themselves. When a measured URL maps to an existing Airveek page and its
explicit brief handoff, the importer preserves that brief/topic relationship
for refresh research; it never guesses ownership from query text.

Report first-touch and last-non-direct attribution separately. For GA4
BigQuery exports, use the session-scoped last-click source/medium fields for
landing behavior and reserve user-scoped `traffic_source` for first-acquisition
analysis. Deduplicate imports with source watermarks and checksums; never mix
event timestamps, report dates, and page publication dates.

## Review cadence

- +5 minutes: HTTP status, canonical, robots, schema, media, links, sitemap
  membership, and IndexNow queue result.
- +24 hours and +7 days: crawl/index discovery, errors, engagement, and CTA
  health.
- 7/14/28/56 days: GSC cohort performance, CTR, queries, conversions, and
  cannibalization against sibling pages.
- Weekly: orphan links, overlap (siblings sharing at least 40% of top queries),
  low-CTR opportunities, and crawl budget anomalies.
- Monthly: decay and refresh recommendations. Human approval remains required for
  merges, canonical/noindex, pruning, and rewrites.

Google Search Console is the pre-click source of truth; GA4 explains behavior,
and payment records explain revenue. Google’s measurement guidance is available
in [Search Console and Analytics](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console).
Do not use Google’s Indexing API for ordinary pages; it is restricted to specific
content types such as JobPosting and livestream BroadcastEvent
([policy](https://developers.google.com/search/apis/indexing-api/v3/using-api)).

The Bing import is an adapter around the provider’s page-statistics response and
is intentionally endpoint-configurable. Microsoft’s current notice says the
legacy SOAP/POX surface retires on 2026-08-31; after that date, set
`BING_WEBMASTER_STATS_ENDPOINT` to the supported replacement or leave reporting
paused rather than silently treating a failed legacy response as zero data. See
[Bing Webmaster API](https://learn.microsoft.com/en-us/bingwebmaster/) for the
current migration notice.
IndexNow notifications remain independent and continue to use the configured
IndexNow key.
