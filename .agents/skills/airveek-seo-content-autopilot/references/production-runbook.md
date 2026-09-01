# Airveek production and publishing runbook

The production unit is a product entity plus one buyer task plus one image job
plus one platform/context plus one real, reviewable Airveek run. A writer cannot
turn an incomplete kit into a live page.

## Pod handoff

1. Research lead attaches the evidence packet and approved opportunity.
2. Producer verifies the source asset, rights, brand/logo policy, and product
   invariants.
3. Airveek operator runs listing, lifestyle, and detail jobs separately and
   stores the prompt, provider/model, settings, output checksum, and QA result.
4. Reviewer inspects the first preview at full size and thumbnail size, then
   approves `image-review.json` before recording.
5. Recorder captures the real Airveek workflow; narration and rendered media are
   generated only from the recorded kit.
6. Writer creates a structured draft and attaches selected/rejected output and a
   failure/fix note.
7. Validator and application publish gate run. Editor resolves every blocker.

## Commands

```bash
pnpm preview:usecase <USE_CASE_ID>
node scripts/qa-ecommerce-image.mjs <CONTENT_KIT_DIRECTORY>
# inspect the preview and add a passing image-review.json
pnpm record:usecase <USE_CASE_ID>
pnpm generate:narration <CONTENT_KIT_DIRECTORY>
pnpm render:recording <CONTENT_KIT_DIRECTORY>
node scripts/qa-topic-kit.mjs <CONTENT_KIT_DIRECTORY>
node .agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs <DRAFT_JSON>
```

Never combine files from different content-kit timestamps. Keep the manifest,
timeline, raw recording, selected/rejected outputs, screenshots, narration, and
QA reports together.

The recorder is fail-closed: provider/quota errors are captured in a
`capture-failure.json` diagnostic and partial attempts do not receive a
manifest. Resume logic selects the newest complete capture or approved preview;
it never treats a newer incomplete directory as evidence.

## Release sequence

`editor approved → render/status/canonical/schema/link/media checks → cache
invalidation → sitemap shard inclusion → IndexNow enqueue → HTTP crawl probe →
live monitoring`.

Only `publishSeoPage()` may make a page live. A failed or unindexable page never
enters a sitemap. Keep `SEO_AUTOMATION_ENABLED=false` and the Supabase control
switch off during setup. Review the first 50 pages of every template, then allow
automation only after 14 healthy days with no P0/P1 incidents. Use a reviewed
600-page buffer and four waves of at most 50, but treat 200/day as a ceiling—not
an obligation.

## Rollback

Human approval is required for redirects, merges, pruning, canonical changes,
noindex changes, and established-page rewrites. If a probe, crawl, media, schema,
or analytics check fails, pause the affected template, remove the page from the
sitemap through the normal state transition, preserve the evidence, and open a
quality incident. Never delete a content kit to hide a failure.
