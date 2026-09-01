---
name: airveek-seo-content-autopilot
description: "Research, create, QA, and prepare Airveek product-photo use-case pages at scale using real product evidence, structured content, crawlable linking, and measured feedback. Use for requests to start Airveek SEO content, product-image guides, prompt pages, or a controlled publishing wave; do not use for generic blog copy or synthetic product demos."
---

# Airveek SEO Content Autopilot

Run Airveek content as an evidence-led production line. The unit of output is a useful page for one audience, product entity, image job, and search intent—not a text-only keyword variation. The canonical workspace is `/Users/niravramani/Desktop/Projects/artistly.ai`.

## Non-negotiable boundaries

### Reader-first publishing mode

This project currently runs with `SEO_EVIDENCE_GATES_ENABLED=false` and the
Supabase `seo_automation_config.evidence_gates_enabled=false` flag. In this
mode rights packets, provenance approvals, independent listing/lifestyle/detail
captures, screenshots, and media-QA evidence are optional inputs rather than
blocking requirements. Never fabricate them when they are unavailable. Keep
the technical media contract (durable HTTPS URL, dimensions, MIME type, alt
text, and checksum), useful product-specific copy, sources, links, author,
reviewer ownership in the database, quality scoring, intent uniqueness,
rendering, metadata, schema, CTA, and review-only lifecycle checks. Do not
expose rights, evidence, reviewer, checksum, or compliance language in public
copy. The explicit mode flag overrides the evidence-heavy examples below;
setting both controls to `true` restores the stricter evidence gates.

When `SEO_INSTANT_AGENT_APPROVAL_ENABLED=true` and
`seo_automation_config.instant_agent_approval_enabled=true`, a completed local
or signed content-agent run that passes the validator and database ingest
checks is automatically recorded as an editorial approval. This removes the
manual click from the reversible draft workflow; it does not make the page
live. The normal publish gate, render probe, wave capacity, sitemap, and
IndexNow checks still control indexability. Redirects, merges, pruning,
canonical changes, and noindex changes remain human-controlled.

- Never publish a page just because a writer or model produced text. A page needs a distinct intent, a passing publish gate, a named author and reviewer, a working creator CTA, and the technical/content checks enabled by the current mode. Instant agent approval only records the review transition after deterministic checks; it is not a publish bypass. When evidence gates are enabled, also require the real generation record, approved media rights, explicit media QA, and persisted evidence packet described below; when reader-first mode is enabled, those evidence records may be absent but must never be invented.
- Keep marketplace/listing imagery accurate and product-dominant. Keep lifestyle imagery contextual but never let styling change the product being sold.
- A logo or brand mark may be used only when it is present in a supplied/rights-cleared source asset or explicitly supplied by the user. Preserve the provided mark; never invent, redraw, or silently add a trademark logo. If the request requires branded mockups and no logo asset is available, stop at the asset boundary and request one.
- The reusable fictional demo brand is **morrow**. When a recording spec or brief includes its supplied logo reference, apply the exact lowercase `morrow` wordmark and two sparkle stars to the mock product/package so viewers can see a consistent brand system. Do not present it as a real customer or trademark, and do not add other readable brand copy.
- Use the image-generation capability for new raster assets and attach the source path, prompt, settings, provenance, checksum, and visual review to the page record. Do not copy Amazon, Pinterest, or competitor media as Airveek-owned output.
- Do not create adjective, color, year, synonym, or platform variants unless the workflow, evidence, requirements, and output materially differ.
- Do not bulk-publish or make redirects, merges, pruning, canonical, or noindex changes without explicit approval. The first 50 pages of each template remain human-reviewed; a proven template requires 50 reviewed pages and 14 healthy days.

## Start or resume

1. Work in the canonical workspace and inspect dirty changes before touching files.
2. Read `docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json`, the latest production queue, the latest content-kit `manifest.json`, `timeline.json`, `image-review.json`, QA report, and feedback ledger. Never combine artifacts from different kit timestamps.
3. Read [references/research-protocol.md](references/research-protocol.md) for a new pillar or category. Use the existing graph for a researched variant and add fresh evidence rather than repeating old searches.
4. Read [references/content-contract.md](references/content-contract.md) before constructing a page payload. Validate it with `node .agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs <draft.json>`.
   After the validator passes, use `pnpm seo:ingest-draft <draft.json> --apply` to
   atomically create the non-live review record and evidence graph. In instant
   agent-approval mode, only the worker completion path may record the
   automatic approval; manual draft files remain review-only.
5. Create the durable research-to-writer handoff first with
   `pnpm seo:create-brief <brief.json> [--apply]`. A page draft must carry the
   resulting `briefId`; the brief, evidence packets, assignments, and review
   decisions are the operational audit trail and are not optional metadata.
6. In reader-first mode, source rights/evidence packets are optional and must
   not be invented. If strict evidence mode is restored, confirm the brief has
   an approved rights packet and matching checksum before ingest; the database
   will reject an unreviewed source.

When running as a long-lived worker, the scheduled content-agent dispatcher
runs every five minutes and claims only briefs with an active writer
assignment. It sends a signed
`seo.content.brief` envelope to `SEO_CONTENT_AGENT_WEBHOOK_URL` only after the
handoff is durably marked `sent`, and records it in `seo_agent_runs`. Stale
queued or unaccepted handoffs are safely expired and requeued without creating
external work. The worker
must return a signed callback to
`/api/seo/agent/callback` with the structured draft; the callback invokes the
same ingest contract and leaves the page non-live. Completion is acknowledged
only after the brief, assignment, and audit event have persisted; otherwise
the run remains retryable and no second page is ingested. Missing agent
configuration pauses dispatch with an alert. Never replace this callback with
a direct database write or a publish call.

The dispatched brief includes a bounded `keywordEvidence` packet (up to 20
rows, ordered by impressions and recency) from `seo_keyword_evidence`. Use its
source, metric date, dimensions, and confidence to distinguish measured search
facts from qualitative Reddit/YouTube/social/competitor language. An empty
packet is valid; never invent volume, rankings, or a demand claim to fill it.

## Operating loop

`research → opportunity → brief → source asset → image preview → Airveek recording when available → structured draft → validator/ingest QA → instant worker approval (when enabled) → publish wave → sitemap/IndexNow → measurement → feedback`

Every stage creates or updates a durable artifact. If resuming, continue from the first incomplete gate and preserve prior attempts.

### 1. Research and intent

- New pillar/category: complete at least 30 targeted searches across first-party search/marketplace guidance, product demand, competitor page structures, real audience questions (Reddit, comments, support language), visual examples, and Airveek capability evidence. Record source URL, access date, exact signal, use-case relevance, and confidence.
- Existing cluster variant: complete 8–12 fresh searches plus an internal GSC/GA4/Bing check. Include real-audience language from at least one Reddit thread, one public YouTube discussion/comment when available, and one other public creator/community source; these are qualitative inputs, not ranking or product-spec evidence.
- Use Google Keyword Planner or connected search data as demand signals, never as permission to generate pages. Label metrics Measured, User-provided, Calculated, Estimated, or Proxy.
- Persist reusable provider and community signals with `pnpm seo:ingest-keyword-evidence <packet.json> --apply` after a dry-run. The importer accepts GSC, Bing, Planner, SERP, Reddit, YouTube, social, competitor, and manual rows, requires HTTPS provenance for qualitative evidence, computes a stable SHA-256 key, and never creates or publishes a page.
- Select an opportunity only when one searcher job is clear, no existing Airveek URL already satisfies it, an asset can be used lawfully, Airveek can demonstrate the workflow, and a product-specific buyer question exists.
- Score candidates with the operating weights in the opportunity graph: demand 30%, commercial intent 20%, Airveek fit 15%, visual utility 15%, result weakness 10%, source/generation feasibility 10%.

### 2. Product image and proof plan

For each product pack, separate the jobs:

- `listing`: clean, accurate, product-dominant view for identification;
- `lifestyle`: believable context and scale without hiding the product;
- `detail`: the category's decision detail (fit, controls, texture, opening, sole, handle, dimensions, included parts, or equivalent);
- `prompt`: copyable preset with tested constraints and a creator deep link.

Start from a real or rights-cleared source product. Pinterest boards, retailer pages, and marketplace pages are pattern references, not proof of product facts. If a reference image is supplied, record its URL and observable creative grammar (setting, light, distance, prop restraint, crop, and negative constraints), then adapt that grammar around the real product.

Use the image-generation skill for a single preview first. Inspect at full size and thumbnail size. Reject invented text, altered product geometry/material/color/label, duplicate products, hidden buyer details, generic empty staging, weak commercial lighting, and plain-background-only results when the job is lifestyle. If branded, include the supplied logo in the composition plan and verify its legibility and placement. Write `image-review.json` with the human decision before any expensive recording or narration.
Record the exact provider, model/version, and checksummed output manifest for every listing, lifestyle, and detail run. These are evidence fields, not assumptions inferred later from a page title.

### 3. Real workflow capture

Use the existing Airveek runner and never a synthetic UI demo:

```bash
pnpm preview:usecase <USE_CASE_ID>
node scripts/qa-ecommerce-image.mjs <CONTENT_KIT_DIRECTORY>
# add a passing image-review.json after inspection
pnpm record:usecase <USE_CASE_ID> listing
pnpm record:usecase <USE_CASE_ID> lifestyle
pnpm record:usecase <USE_CASE_ID> detail
node scripts/qa-ecommerce-image.mjs <CONTENT_KIT_DIRECTORY>
pnpm generate:narration <CONTENT_KIT_DIRECTORY>
pnpm render:recording <CONTENT_KIT_DIRECTORY>
node scripts/qa-topic-kit.mjs <CONTENT_KIT_DIRECTORY>
```

The runner writes four checkpoint screenshots (workspace ready, source
selected, settings complete, and saved result) under `screenshots/` and lists
them in `manifest.json`; keep these files with the kit when assembling the
workflow evidence packet. If the provider returns a quota/error state or the
   result times out, it writes `capture-failure.json` with the failure stage,
   typed retry class, provider code/status when observable, and kit path, and
   intentionally does not write a manifest; retry from the newest usable
   preview/recording rather than choosing the newest partial directory. A
   transient quota/network failure may be retried only after its durable
   cooldown; policy, rights, malformed-input, or visual-QA failures require
   human review.

The recorded `manifest.json`, `timeline.json`, raw video, result images, and QA reports are the source of truth. Run listing, lifestyle, and detail as separate labeled captures; do not treat three variations from one run as three independent SEO evidence jobs. Narration must describe visible actions, never guessed timestamps. Preserve the Airveek logo in every rendered output and fail overlapping narration or unsafe framing.

### 4. Structured page writing

Use the page contract, not unconstrained generated HTML. The visible page must include:

- one descriptive H1 and a 40–80 word direct answer above the fold;
- the exact buyer question and product-specific constraints;
- source asset/provenance and rights status;
- Airveek settings, exact prompt, negative constraints, and step-by-step workflow;
- selected output(s), a rejected direction, and a failure/fix note;
- limitations and claims boundaries;
- a practical checklist and prefilled creator CTA;
- named byline, reviewer, dates, citations, breadcrumb, and related links.
- FAQs should answer recurring questions found during research (preferably at
  least three when the source material supports them), with source URLs/access
  dates recorded in the evidence packet. Paraphrase public comments, remove
  personal details, and never present a commenter as an Airveek customer or
  endorser.
- Give every `sources[]` record a stable draft-local `id` (or `sourceKey`) and
  make every FAQ `evidenceSourceIds[]` reference one of those keys. Ingest
  rewrites the keys to persisted source UUIDs and the public page renders those
  citations beside each FAQ; an unresolved citation is a hard blocker.

Default to 700–1,400 words only when the task needs it; never pad pages to hit a word count. Use natural keyword placement, a standalone answer block, short paragraphs, descriptive anchors, 2–5 internal links, and authoritative external sources tied to claims. Avoid unsupported review, FAQ, HowTo, or Product schema; only emit schema that matches visible content and the page's actual type.

### 5. QA and anti-cannibalization

Run the 100-point gate implemented in `src/features/seo/server/publishing.ts`. A page needs at least 85 and no blocker. Block missing independent listing/lifestyle/detail evidence, rights, author/reviewer, sources, direct answer, workflow steps, selected media, inbound/outbound links, self-canonical, 200 rendering, or CTA. Compare normalized intent and embedding similarity before slug assignment with the service-role `check_seo_intent_collision` RPC (the database trigger is the final race-safe guard): ≥0.92 blocks; 0.85–0.92 enters merge review unless an editor documents a real distinction. A merge-review page remains noindex until that decision is recorded.

Every page needs at least two crawlable inbound links before publication, a parent hub, two useful sibling jobs, an adjacent category/product, a tutorial/feature where relevant, and a creator preset link. Keep public pages within three clicks of a hub. Filters, sorts, query parameters, previews, and internal search stay non-indexable.
The publish gate verifies those edges against live indexable pages or known static hubs; a raw edge record alone cannot make a page eligible.

### 6. Publish and learn

Only the gated `publishSeoPage` path may make a page live. It marks `seo_pages` live, upserts `seo_url_state`, revalidates the page/parents/archives/sitemap, and queues `seo/page.published`. The public render is checked before sitemap eligibility. If any post-live failure occurs, quarantine writes are attempted independently; each error is recorded and emits a deduplicated P0 alert so the page cannot silently remain indexable. The sitemap route reads live, canonical, indexable rows and emits family/month shards capped at 2,000 URLs; sitemap database errors fail closed instead of becoming an empty success response. IndexNow notifies Bing; a throttled six-hour heartbeat submits the sitemap index through the Search Console Sitemaps API when automation is enabled, while Google still controls crawl timing. A failed page never enters a sitemap. Instant agent approval only places a passing draft in the approved queue; it does not call this function.

Use four waves of up to 50 from a reviewed buffer; the daily 200 target is a ceiling, not a quota. Start with a small pilot and keep `SEO_AUTOMATION_ENABLED` plus the Supabase kill switch off until the pilot passes. After publication, compare 7/14/28/56-day cohorts using GSC (queries/clicks/CTR/position), GA4/BigQuery (anonymous behavior), Supabase (page and activation events), and Whop (payment/refund truth). Update the feedback ledger only from comparable evidence; never generalize from one page.

Measurement watermarks, crawler snapshots/link edges, scheduled probes, URL
state, and IndexNow status must persist successfully. A failed persistence
mutation makes the run retryable and never advances a source watermark or
claims a healthy page.

Read-only monitors for the public SEO surface, published-page probes, Core Web
Vitals, and approved-buffer health may continue while the publishing kill
switch is off. Mutating loops—source imports, crawl remediation, content-agent
dispatch, publishing, redirects, merges, pruning, canonical changes, and
noindex changes—remain disabled until their explicit capability and review
gates are enabled.

## Outputs

For each run, leave: evidence packet, opportunity/brief version, source-asset record, content-kit path, page draft JSON, QA result, editor decision, publish-batch ID, and measurement/feedback note. If the user asks only to draft, stop before external publication. If a required account, source asset, connector, or approval is missing, report the boundary instead of fabricating it.

Supporting references:

- [Research protocol](references/research-protocol.md)
- [Structured content contract](references/content-contract.md)
- [Production and publishing runbook](references/production-runbook.md)
- [Measurement and feedback](references/measurement-and-feedback.md)
