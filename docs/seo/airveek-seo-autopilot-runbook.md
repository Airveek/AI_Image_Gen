# Airveek SEO autopilot runbook

## Status

The repository contains the gated publishing and measurement control plane. It is intentionally off by default until Supabase migrations, credentials, consent language, and the canonical domain are verified.

**Verified checkpoint (2026-08-31):** the first six product packs (ECO01–ECO06)
are live as 30 evidence-backed pages. The active writer is LIKA and the active
SEO administrator is Nirav Ramani. The production automation switch is enabled
for local-only Codex mode; hosted signed dispatch remains disabled. Publishing
is performed only through attended, one-wave runs until each template has 50
reviewed pages and 14 healthy days. GA4 Data API is healthy;
the linked BigQuery dataset is still waiting for Google's asynchronous first
export and remains a monitored warning, not a reason to disable on-site
analytics.

`SEO_AUTOMATION_ENABLED=true` is necessary but not sufficient. The `seo_automation_config.enabled` database switch must also be true. This gives the team a kill switch that does not require a deploy. Crawl, source-sync, and recommendations have separate database switches; keep recommendations off until source freshness is proven.

### Fictional MORROW demo brand

Airveek's ecommerce examples use the single fictional `morrow` brand so a
viewer can see how a consistent product identity looks across listing,
lifestyle, and detail images. The supplied logo is
`public/images/morrow/morrow-logo.png` (with an SVG fallback beside it). The
recording specs upload it as the second reference and prompts require the exact
lowercase wordmark plus two sparkle stars on the mock product or package. It is
not a real customer or trademark claim; no other brand copy is invented.

The repeatable production workflow is packaged as the
[`airveek-seo-content-autopilot`](../../.agents/skills/airveek-seo-content-autopilot/SKILL.md)
skill. It requires the research packet, real listing/lifestyle/detail evidence,
structured page draft, and deterministic draft validator before an editor can
approve a page.

The external signed-worker handoff is specified in
[`content-agent-worker-contract.md`](content-agent-worker-contract.md). Keep
the worker outside the publish path; it may submit a non-live draft only.

FAQ citations are now referentially checked. Drafts use a stable `id` (or
`sourceKey`) on every source record, and the ingest transaction rewrites each
FAQ's `evidenceSourceIds` to the persisted `seo_sources.id` UUIDs. Existing
pilot pages ingested before that invariant was added were repaired with the
dry-run-first `pnpm seo:repair-faq-evidence` command; add `--apply` only for a
reviewed repair. FAQ evidence is rendered as visible source links beside the
answer, and an unresolved source key blocks validation and publication.

The recording runner is fail-closed and resumable. A provider or quota failure
races the creator's live error message instead of waiting blindly for the full
timeout, writes `capture-failure.json`, and leaves the partial kit without a
manifest. Retries select the newest usable preview or complete recording, not
the newest directory. A complete job must contain a decodable `raw-demo.webm`,
the workspace/reference/settings/result checkpoint screenshots, and matching
`generation_started`, `generation_ready`, and `result_saved` timeline events;
these checks run before job-aware visual QA.

Validated drafts enter the database through `pnpm seo:ingest-draft`. The command
performs a network-free contract check first; `--apply` calls the service-role
transaction that creates the topic, page, evidence runs, assets, sources, and
link edges in one operation. It always leaves the page non-live and indexable
only through the normal publish gate.

Before creating a draft from a local recording, run `pnpm seo:audit-kits` (or
`pnpm seo:audit-kits -- --only ECO01` to inspect a bounded pilot opportunity).
This read-only audit checks the source asset, capture/image/render QA, three
independent listing/lifestyle/detail jobs, explicit rights/provenance, durable
HTTPS media metadata, the four real-workflow checkpoint screenshots, and
author/reviewer identities. Existing recording kits
are workflow evidence, not publishable pages; a kit with one multi-variation
run is intentionally blocked until the three independent job records are
attached. Missing QA/review artifacts are blockers too; the audit never treats
an absent report as a pass, and manifest paths must remain inside the kit.

After a kit passes human review, create an explicit rights decision and media
map, then run `pnpm seo:promote-kit <kit> <rights.json> <media-map.json>`.
Promotion is dry-run by default. Only `--apply` copies checked images into the
durable `public/images/airveek/seo/` tree and writes `public-assets.json`; it
requires `approvedForPublic: true`, `rightsStatus: "approved"`, verified logo
policy, HTTPS-derived URLs, dimensions, alt text, and checksums. Different
bytes are never overwritten. The resulting sidecar is the input for the
structured page draft and remains separate from the publish gate.
See [the kit promotion contract](kit-promotion-contract.md) for the exact
rights and media-map shapes.

For a brief that has a source asset ready for review, record the human rights
decision with the dry-run-first command below. The reviewer must already be an
active `editor`, `publisher`, or `seo_admin` in `content_members`; the command
does not create Auth users or approve anything implicitly.

```bash
pnpm seo:review-evidence -- \
  --brief-id <brief-uuid> \
  --reviewer-id <content-member-user-uuid> \
  --rights-evidence-id <source-asset-id> \
  --source-checksum sha256:<64-hex> \
  [--source-url https://...] [--source-label "..."] [--notes "..."]

# inspect the JSON plan, then add --apply to persist the item, packet, topic
# evidence mirror, decision, and append-only audit event in one transaction.
```

The operation is idempotent for the same brief, evidence ID, and checksum. A
different checksum or reviewer decision never overwrites an approved item; it
fails for human review. It changes no page/indexability state and leaves the
publishing kill switches untouched.

The command also appends the matching `rights` approval to
`seo_review_decisions` for the audit ledger. The generic review form in
`/admin/seo` deliberately cannot approve rights on its own; it can record a
non-approval rights note, but the packet/item/checksum handoff is required.

For the current fictional MORROW demonstration only, the guarded mock helper
can approve local synthetic fixtures without hand-entering every packet:

```bash
pnpm seo:approve-mock-briefs       # dry-run: inspect every candidate
pnpm seo:approve-mock-briefs -- --apply
```

It accepts only the repository's `generic-*.png` fixtures, computes and stores
their SHA-256 checksums, and records the active SEO-admin reviewer through the
same atomic rights RPC. It never creates media, pages, or publication state.
Real customer, partner, or trademarked assets must still use the normal
per-brief review command above.

### Current external readiness audit (2026-08-31)

- The canonical site, robots surface, sitemap index, and static sitemap respond
  with HTTP 200 in production.
- Supabase has the complete ordered SEO platform/control-plane schema through
  migration `202608310012`. The ordered migrations provide rights-evidence
  guards, immutable Whop transaction facts, signed agent dispatch/recovery,
  consent-gated Core Web Vitals summaries, semantic intent-collision and
  status-transition guards, resumable provider watermarks, hardened RLS and
  privileges, and bounded service-role sitemap shard reads. Migration
  `202608300037` makes active dispatch keys unique while a handoff is in flight;
  migration `202608300038` adds the bounded sitemap index/shard RPCs,
  `202608300039` makes the research-to-writer brief handoff atomic, and
  `202608300040` makes assignment upserts and brief queue transitions atomic,
  `202608300041` makes review decisions and brief/page transitions atomic, and
  `202608300043` makes rights item/packet/topic/decision/audit approval atomic;
 `202608300044` through `202608300051` keep that function catalog-safe and
  warning-free under Supabase lint. The final guard also requires every brief
  to carry three distinct, labelled HTTPS demand-evidence sources with
  non-blank access dates and claim text, even when the handoff is called
  outside the admin UI. Migration `202608300050` explicitly rejects missing
  JSON provenance values under PostgreSQL's three-valued logic, and
  `202608300051` applies the same invariant to every brief-table insert or
  evidence update. Migration `202608310003` makes the brief handoff
  idempotent: a retried key returns the identity-matched existing handoff,
  while a key reused for a different intent fails closed. Migration
  `202608310004` fixes the deployed function's PL/pgSQL variable/column
  ambiguity and keeps the function catalog-safe under Supabase lint.
  Migration `202608310001` adds the durable recommendation ledger and summary
  RPC. Weekly opportunity and monthly decay analysis now write deduplicated,
  evidence-backed work items with an explicit action and lifecycle (`open` →
  `acknowledged`/`in_progress` → `completed`, `dismissed`, or `expired`) rather
  than relying on transient alerts alone. Re-running analysis refreshes the
  active item; completing one preserves its outcome history and permits a later
  recurrence to open a new item.
  Migration `202608310002` adds the review-only lifecycle RPC. Operators can
  acknowledge, start, complete, dismiss, or expire a recommendation with a
  resolution note; terminal outcomes cannot be reopened, and no page,
  redirect, canonical, or noindex state is changed by this action.
  `pnpm seo:prepare-briefs -- --write` normalizes graph evidence into that
  contract, keeps internal opportunity-graph signals in the research block,
  and adds the reviewed Shopify product-photography guidance source alongside
  the marketplace and Google Merchant references. This gives every generated
  candidate at least three distinct public HTTPS sources; community sources
  remain additive and are never invented when the opportunity graph has none.
  Categories with fewer than three public sources are marked blocked rather
  than creating an unappliable brief file.
  `pnpm seo:create-brief-batch -- --only ECO01 --limit 5` performs a bounded,
  read-only preflight over candidate files. Add `--apply` only after reviewing
  the report; it creates the research-to-writer handoffs through the
  idempotent RPC and never creates pages, assigns writers, or publishes.
  When a researched candidate gains a corrected source path or research
  context, `pnpm seo:refresh-brief-context` (dry-run first, then `--apply`)
  updates only that non-identity context on existing handoffs and records an
  audit event; it cannot change rights approvals, assignments, pages, or
  indexability.
  `pnpm seo:verify-production` also reports a bounded `pilot_content_readiness`
  aggregate (briefs, approved rights packets, passing generation evidence,
  active writers, approved pages, and live pages), so infrastructure health
  cannot be mistaken for a content-ready pilot.
  ECO01–ECO20 now have 100 persisted five-page handoffs (product hub, listing,
  lifestyle, detail, and prompt). ECO01–ECO06 have produced the first 30 pages,
  which passed the full evidence, review, publish, sitemap, and production-
  probe sequence. Re-running the batch command returns the same brief IDs
  instead of duplicating rows. The context-refresh command has backfilled a
  verified source asset path and research context onto all 100 handoffs with
  100 append-only audit events; rights, recording, editor, and publish gates
  remain open for the next wave.
  The linked
  project is up to date,
  `supabase db lint --linked`
  reports no schema errors, and the production verifier passes all required
  table/RPC checks on 2026-08-31. Its canonical-host probe reports permanent
  `308` redirects for both HTTP and `www.airveek.com`, preserving path/query.
  The verified production deployment now returns `X-Robots-Tag: noindex` with
  private no-store caching for private routes and query variants; the public
  canonical route remains indexable. Keep hosted dispatch disabled while the
  owner-operated local Codex bridge is the execution worker; the remaining
  BigQuery and reviewed-pilot gates still require attention.
- Migration `202608300028_restore_user_insights_tables.sql` repaired a drift
  where the historical `user_insights` migration was marked applied but
  `user_events` and `user_profiles` were absent from the live schema. REST
  probes now return HTTP 200 for both tables, so auth, checkout, and creator
  generation events can be recorded again. A transactional insert probe also
  passed against a real `auth.users` foreign key and was rolled back.
- The production automation row is intentionally all-off (`enabled=false`,
  crawl/source-sync/recommendations/alert-webhook switches false), with the
  200-per-day and 50-per-wave ceilings retained.
- GSC access is verified for `sc-domain:airveek.com`, and the configured Google
  service account now has GA4 property Viewer access (verified through the
  GA4 Data API on 2026-08-30). The GA4 Admin API confirms an enabled daily
  BigQuery export link targeting project `airveek-seo`, but the standard export
  dataset is still not visible to the service account (`analytics_552076389`
  returned HTTP 404). Google creates the dataset/export asynchronously; keep
  the direct GA4 Data API as the fallback. The worker and
  `pnpm seo:verify-production` probe both the link and the standard
  `analytics_<property-id>` dataset automatically; set `GA4_BIGQUERY_DATASET`
  only when a non-standard dataset is actually readable.
- Bing site verification and the API key are present. Reporting imports use
  Microsoft's JSON/HTTP page-statistics method at
  `https://ssl.bing.com/webmaster/api.svc/json/GetPageStats`; the legacy
  SOAP/POX endpoint retires on 2026-08-31. IndexNow notification remains
  independently configured. Microsoft documents the JSON/HTTP methods in its
  [Bing Webmaster API reference](https://learn.microsoft.com/en-us/bingwebmaster/)
  and the [SOAP/POX retirement notice](https://www.bing.com/webmasters/help/soap-pox-api-deprecation-s0appox01).
  The production verifier now performs a redacted live response probe, so an
  endpoint that returns a non-JSON error cannot be reported as ready.
- Whop signed payment/refund webhooks now persist immutable, non-PII
  transaction facts (event/object IDs, status, amount, currency, plan, and
  membership references) in `whop_transaction_facts`; membership entitlements
  remain the access-control source of truth.
- The safe non-secret defaults (`NEXT_PUBLIC_SITE_URL`, `BING_SITE_URL`,
  `INDEXNOW_ENDPOINT`, inspection budget, and the false automation switch) are
  present in Vercel Production/Development and in the local environment.
- Run `pnpm seo:verify-production` for the authoritative read-only readiness
  report; required database, canonical-host, and public discovery checks pass.
  The configured Bing JSON/HTTP endpoint is included in that check; an empty
  Bing report is treated as a valid warm-up state, not as an import failure.
- The same production check probes private routes, API responses, and representative
  query-string variants for `X-Robots-Tag: noindex`, while confirming the canonical
  public URL remains indexable. It also requires non-indexable responses to be
  `private, no-store` so a CDN cannot reuse a canonical cache entry for a filtered
  or attribution URL. A failure is a deployment/cache release blocker, not a reason
  to weaken the route contract or redirect attribution parameters.
- The same preflight now checks active content-member roles before production
  can be enabled. At this checkpoint there is one active `seo_admin`, but no
  active writer or publisher, so the report correctly returns a warning and
  the kill switch remains off.
- Signed content-agent callbacks are revalidated by the same deterministic
  contract used by `seo:validate-page`; invalid rights, media, generation,
  authorship, link, or review-state payloads are failed before the ingest RPC.
  Rights are additionally checked against a reviewer-attributed approved
  `seo_evidence_packets`/`seo_evidence_items` pair for the brief, including the
  source evidence ID and exact source checksum. Approved rights items require
  that checksum in the database, and the same persisted-rights
  check runs in local `seo:ingest-draft --apply` and in duplicate-run recovery,
  so a payload cannot self-approve media by setting `rightsApproved: true`.
- The production readiness verifier treats the signed content-agent webhook as
  a hard prerequisite whenever both automation kill switches are enabled. A
  missing `SEO_CONTENT_AGENT_WEBHOOK_URL` or
  `SEO_CONTENT_AGENT_SIGNING_SECRET` therefore fails readiness before a live
  worker can claim briefs; while automation is off it remains an explicit
  setup warning.
- The admin Performance tab now shows bounded first-touch and last-non-direct
  attribution aggregates separately. The service-role RPC joins only hashed
  first-party attribution to backend signup, generation, checkout, activation,
  and current paid-entitlement facts; it does not expose user IDs or raw touch
  paths. Empty tables are expected before consented visits and linked signups.
- After analytics consent, the GA4 tag is also available on the registration,
  creator, checkout, and checkout-complete funnel routes so `sign_up`, first
  generation, checkout, and purchase events can be observed. Admin, API,
  callback, dashboard, library, login, preview, and store-image surfaces stay
  excluded; Core Web Vitals remain public-route-only. The root consent client
  also emits a consent-gated GA4 `page_view` for subsequent Next.js route
  changes, while the initial document view remains owned by the GA4 config tag,
  so SPA navigation does not double-count the first page.
- An active `seo_admin` content member is provisioned for the current Airveek
  administrator and LIKA is the active writer, so approved waves have a
  publishing identity; the automation/kill switches remain off.
- The verified ECO01–ECO06 packs have independent listing, lifestyle, and
  detail captures with four workflow checkpoints each, explicit image review,
  rights approval, durable public media metadata, and named author/reviewer
  records. Any older or incomplete local kit remains blocked by the same audit
  contract and cannot enter a publish wave.
- The linked operational queue contains idempotent five-page handoffs for
  ECO01–ECO06, with an active LIKA writer assignment, completed agent/evidence
  records, 30 live SEO pages, and completed publish-batch/URL-state rows. New
  pages still require the same reviewed, rights-cleared brief and complete
  evidence packet; existing live pages are not a reason to bypass those gates.
- The attended local bridge was exercised in mutating mode with zero candidates.
  It requires both `SEO_AUTOMATION_ENABLED=true` and
  `seo_automation_config.enabled=true`. Set `SEO_CONTENT_AGENT_LOCAL_ONLY=true`
  when this bridge is the execution worker so hosted Inngest does not compete
  for the same queue.
- The researched 20-product graph has been expanded locally into 100 validated
  five-page-pack candidates (product hub, listing, lifestyle, detail, and
  prompt). They remain ignored review files with `rightsStatus: "unreviewed"`;
  the generator made no Supabase or page changes. Re-run
  `pnpm seo:prepare-briefs --limit 20 --pack --write` after graph updates.
- ECO01 now carries four paraphrased community signals from public Reddit
  discussions (buying context, simple studio setups, label/transparency QA,
  and listing-versus-lifestyle placement) in
  `docs/research/airveek-eco01-community-evidence-v1.md`. The brief generator
  preserves these as qualitative evidence with URLs and access dates; it does
  not copy comments or treat them as testimonials, product claims, or ranking
  proof.
- The original unbranded serum-bottle source and its separate generic-serum
  recording attempts remain retained as historical provenance artifacts. The
  live ECO01 pages use only the promoted, checksum-matched media maps whose
  rights packets and visual QA passed the current gate; an unreviewed source
  cannot enter a future wave.
- Kit audits now hash the exact source file and compare it with the per-kit
  provenance record; a mismatch or contradictory public-approval flag blocks
  the kit before evidence ingest.

Migrations `202608300008` through `202608310012` are applied in production. The
latest migrations automatically create a `manual_review` rollout row whenever a
new brief or page template version is first used (and backfill the two existing
pilot versions); they never mark a template proven or change page indexability.
Together they add rights-evidence guards, research-backed briefs, versioned
evidence packets and items, role-specific assignments, append-only review
decisions, signed-agent runs/recovery, consent-gated Core Web Vitals summaries,
bounded sitemap shard reads, atomic brief, assignment, review, and rights handoffs, service-role semantic intent-collision checks, and a durable recommendation queue for measurement-led improvement work. Similarity at or above 0.92
is blocked; 0.85–0.92 is placed in merge review. Keep hosted dispatch disabled
until the reviewed pilot and remaining external integrations are ready.
Migration `202608310008` adds stable source keys and transactionally rewrites
FAQ evidence references to persisted source UUIDs; unresolved FAQ citations are
now a hard blocker and visible FAQ citations are rendered beside the answer.
Migration `202608310009` adds `seo_keyword_evidence` and `202608310010` adds
its `updated_at` trigger. GSC query imports now
write idempotent, page-linked keyword evidence in bounded chunks, preserving
clicks, impressions, CTR, position, source dimensions, and a stable checksum for
future brief/opportunity research. When an imported URL has an explicit
Airveek page-to-brief relationship, the importer also links the fact back to
that brief/topic; it never infers ownership from a query string.
Migration `202608310011` adds typed content-agent retry state and a durable
`next_attempt_at` cooldown so transient provider failures can be retried without
replaying completed work.
Migration `202608310012` adds the bounded keyword-evidence summary RPC used by
the admin control plane and readiness verifier; it reports source counts and
freshness without loading raw measurement history into application memory.

Agents and researchers can add non-GSC evidence through the same durable table
with `pnpm seo:ingest-keyword-evidence <packet.json>` (dry-run) or
`pnpm seo:ingest-keyword-evidence <packet.json> --apply`. The packet accepts
measured provider rows (`gsc`, `bing`, `keyword_planner`) and qualitative rows
(`serp`, `reddit`, `youtube`, `social`, `competitor`, `manual`). Qualitative
rows must include an HTTPS source URL plus a concise `metadata.signal` or
`metadata.claimSupported`; every row receives a deterministic SHA-256 key and
is upserted in bounded chunks. This command never creates pages, changes
indexability, or advances a publishing queue, so keyword research can be
collected ahead of rights, recording, and editorial approval.
When a brief is dispatched to either the signed external worker or the local
Codex bridge, the handoff also carries a bounded `keywordEvidence` packet (up
to 20 rows for that brief, ordered by impressions and recency). This gives the
writer the latest measured/qualitative demand context without loading raw
measurement history or turning a keyword list into an automatic page mandate.

### Content operations handoff

To seed reviewable candidates from the researched ecommerce opportunity graph,
run `pnpm seo:prepare-briefs --limit 1` (dry-run) or add `--write` to create
three JSON evidence candidates—listing, lifestyle, and detail—under the ignored
`docs/research/seo-brief-candidates/` directory. The command only copies
research signals and explicitly marks source rights as `unreviewed`; it does
not create database rows, generate images, or publish pages. Add `--pack` to
include the product-hub and prompt candidates that will reuse the same
independently recorded evidence pack. Review the source
asset and evidence first, then validate/apply each candidate with
`pnpm seo:create-brief <candidate.json> [--apply]`.

1. Validate a brief packet with `pnpm seo:create-brief brief.json`, then apply
   it with `--apply` only after the three demand sources and product scope have
   been reviewed. The command creates the `seo_topics` handoff plus draft
   research/rights evidence packets; it never creates or publishes a page.
2. List existing Auth accounts first with the read-only
   `pnpm seo:member -- --list-users` command. Provision an account as a
   content-team member with the dry-run-first
   `pnpm seo:member -- --user-id <uuid> --role writer
   --display-name "Writer name" --slug writer-name [--apply]` command. It only
   upserts `content_members`; it never creates Auth accounts or enables
   automation. Configure at least one active writer and one publisher or
   `seo_admin` before turning on the production switches. The admin
   **Users** page exposes the same action for a selected existing account and
   performs Auth-existence and slug-uniqueness checks server-side. Its active
   checkbox can pause a membership without deleting the Auth account; inactive
   members cannot receive assignments or publish waves.
3. The brief lead creates one `seo_content_briefs` row for a distinct intent,
   attaching the research packet and planned template/page family.
4. Research, rights, and workflow proof are stored as versioned
   `seo_evidence_packets` with structured `seo_evidence_items`. Submitted or
   approved packets require a SHA-256 checksum; approved rights evidence also
   requires an explicit reviewer and rights evidence ID.
5. A brief lead assigns researcher/writer/editor/reviewer work through
   `seo_content_assignments`. The service-role assignment RPC locks the brief
   and atomically upserts the active role assignment plus queue status. Active
   assignments are unique per role, and the database validates that the
   assignee has a compatible active content role.
6. Reviewers record every decision in `seo_review_decisions`; decisions are
   append-only and carry the content version, checklist, score, and blockers.
7. Inserts, updates, and deletes on these operational records generate
   `seo_content_audit_events`. Audit rows and operational records are not
   physically deletable; corrections use a new version or compensating event.

The `/admin/seo` Operations tab exposes the same handoff without requiring SQL:
admins can select an open brief, assign it to an active member, and record a
review decision with score, blockers, and notes. The actions call the same
server-side role and status checks as the worker; they never create Auth users,
approve source rights implicitly, publish a page, or enable automation.

For a long-running local recording pass, use `pnpm seo:run-queue` to inspect the
selected opportunity set first. The worker is dry-run by default; add `--apply`
only after `pnpm recording:auth` has produced `.recording-auth/user.json`.
It records one independent listing, lifestyle, and detail job per opportunity,
persists resumable state in `content-kits/.seo-content-queue-state.json`, and
never ingests or publishes pages. Useful controls are `--only ECO01,ECO02`,
`--from ECO10`, `--limit 5`, `--continue-on-error`, `--retry-failed`, and
`--max-runtime-minutes 120`.
The queue never retries a `complete` opportunity, even when `--retry-failed`
is supplied. Transient provider/quota/network failures are classified with a
six-hour cooldown and retained as `transient_provider`; rights, policy,
malformed-input, and visual-QA failures are `manual_review` and remain out of
the unattended retry path. A run with skipped/failed work reports `partial` or
`failed` and exits non-zero when a failure occurred, so cron cannot mistake a
partially produced queue for a green run.

Run `pnpm seo:verify-production` before and after production migrations. It is
read-only: it checks the expected tables/columns/RPC, reports the automation
switches without exposing secrets, verifies the configured provider variables,
and probes `/robots.txt`, `/sitemap.xml`, and `/sitemaps/static.xml`. A `fail`
status identifies a missing required boundary; `warn` is reserved for optional
or user-owned configuration that is not present yet.

## What happens to an approved page

1. A writer creates a structured page and attaches the exact Airveek generation evidence, source URLs, public media, author, reviewer, and internal-link edges.
2. Automated QA records a score in `seo_quality_runs`. The page must score at least 85 and have no blocker.
3. The publish worker reads at most 50 approved/scheduled pages every 15 minutes and enforces the database daily limit (200 by default, i.e. four 50-page waves). New templates remain human-review gated. A template can be marked `proven` only after 50 reviewed pages and 14 healthy days.
4. The publish gate rechecks independent listing/lifestyle/detail runs, approved media rights, source evidence, canonical state, author/reviewer, workflow completeness, and at least two inbound plus four outbound links. Link thresholds count only live indexable SEO pages or known static hubs; unverified edge rows do not satisfy the gate.
5. A passing page becomes `live`, `noindex=false`, and receives a `seo_url_state` row. The publish function rechecks both `SEO_AUTOMATION_ENABLED=true` and the database `seo_automation_config.enabled=true` immediately before this transition, so pausing the database switch takes effect without a deploy. The public render is then crawled; only a healthy 200 response with matching canonical, robots, schema, content, and media checks flips the URL state to eligible. The page, linked parents/siblings, public hubs, static sitemap, sitemap index, and every affected current or prior family/month sitemap shard are revalidated.
   If an unexpected failure occurs after the live transition, the publisher quarantines that page back to `qa_failed`/`noindex=true`, removes sitemap eligibility, and marks its wave item `replaced` so a reviewed buffer page can take its place. A pre-live permanent quality/evidence failure similarly moves the page from `approved`/`scheduled` to `changes_requested`; transient configuration, persistence, or race failures remain retryable. Every quarantine write is checked independently; any failed recovery mutation emits a deduplicated P0 publishing alert with the affected table/error evidence and keeps the page blocked from an automatic retry until it is verified.
6. `/sitemap.xml` and family/month shards include only live, canonical, indexable pages whose URL state is eligible and whose last rendered response was HTTP 200. A failed or unhealthy page is removed from discovery and remains in the crawler queue for recovery. The sitemap index reads only bounded shard descriptors and each dynamic shard reads at most the configured 2,000 URLs through service-role RPCs; it never loads the full catalog into the route. Sitemap database reads fail closed rather than returning a misleading empty HTTP-200 sitemap during an outage.
7. An `seo/page.published` event queues IndexNow when `INDEXNOW_KEY` and `INDEXNOW_KEY_LOCATION` are configured. The publish-batch ledger records `submitted`, `failed`, or `skipped` independently of page publication, so a page that went live cannot be mistaken for a delivered discovery notification.
8. The crawler checks HTTP status, canonical, robots directives, title, H1 count, schema types, content hash, and link health. Issues are retained as crawl snapshots and alerts. Snapshot, URL-state, link-edge, and crawl-run writes are checked; a persistence failure fails the run for retry rather than reporting a partial healthy crawl.
9. A 15-minute probe worker checks newly published pages at approximately five minutes, one day, and seven days. Each probe is idempotent, records its rendered response in `seo_page_probes`, and immediately removes an unhealthy URL from sitemap eligibility; later probes and the weekly crawler can restore it after recovery. Probe and URL-state persistence failures are retryable and never count as a completed health check.
10. Read-only health monitors (robots/sitemap, published-page probes, Core Web Vitals, and approved-buffer health) continue running when the publishing kill switch is off. URL Inspection is quota-controlled; transient per-URL failures are alerted and left queued for a later retry rather than aborting the whole sample. Weekly analysis stages low-CTR, positions-11–20 ranking, and cannibalization alerts plus durable recommendations; monthly analysis stages content-decay refresh recommendations.
11. Daily GSC, GA4, and Bing page-stat imports upsert by source date and dimensions. Each provider has a durable `seo_import_watermarks` row: failed attempts retain their error and never advance the successful day; a later run replays a short gap (up to seven days) before advancing. Watermark reads and running/success/idle/failure writes are checked; a persistence error fails the provider run so it is retried instead of reporting false freshness. When `GA4_BIGQUERY_DATASET` and `GCP_PROJECT_ID` are set, GA4 BigQuery export is the historical source; otherwise the GA4 Data API is used. If the linked BigQuery dataset is visible but a query fails with a provider/schema/access error, that run falls back to the GA4 Data API and records `provider=ga4-data-api-fallback`, the source provider, and a bounded reason in the watermark cursor; Supabase/database write failures never fall back and remain retryable failures. The BigQuery query uses GA4's session-scoped last-click source/medium fields, with collected-event and first-acquisition fallbacks, so landing behavior is not mislabeled as user acquisition. Provider page-ID mapping is URL-scoped in bounded batches rather than loading the whole live catalog. The admin dashboard reads aggregate SQL/RPC results, not unbounded raw rows. Bing's endpoint is configurable because Microsoft is retiring the legacy API surface; IndexNow remains the real-time notification path. Whop signed payment/refund facts are stored separately from GA4 estimates so verified transaction, currency, and refund data can be reconciled without trusting client events.

12. When automation is enabled, a throttled six-hour heartbeat submits the
    canonical sitemap index through the Search Console Sitemaps API after
    publication activity. This is separate from Google's restricted Indexing
    API and never submits individual ordinary content URLs. The readiness check
    confirms that `https://airveek.com/sitemap.xml` is listed in Search Console;
    the sitemap itself remains DB-driven and contains only healthy eligible
    URLs.

13. Before the owner-operated worker claims content, the brief-intake step
    reconciles the researched opportunity graph when its checksum changes. It
    writes only idempotent topics, briefs, and draft research/rights packets;
    it never creates a page, approves rights, or publishes. The content-assignment loop then runs every five minutes and assigns ready
    briefs to active writer members through the atomic `assign_seo_brief`
    RPC. It is enabled only by the global automation kill switches and never
    approves evidence or pages. The content-agent dispatch loop then runs every
    five minutes, selects only open briefs with an active writer assignment, and writes an idempotent
    `seo_agent_runs` handoff. It signs the exact JSON envelope with
    `SEO_CONTENT_AGENT_SIGNING_SECRET` and POSTs it to
    `SEO_CONTENT_AGENT_WEBHOOK_URL` only after the run is durably marked
    `sent`; a failed state transition prevents the external request. The agent
    must call the signed
    `/api/seo/agent/callback` endpoint with a structured draft. The callback
    re-runs the deterministic draft contract and the persisted rights packet
    check before invoking the service-role ingest RPC. It only acknowledges a
    completion after the brief, assignment, and idempotent audit event are
    durable; otherwise the run remains retryable in `processing`. It changes
    the brief to `submitted` and leaves the page non-live; editor approval and
    the gated publish wave are still required. Missing agent configuration is
    alerted, not treated as permission to fabricate or auto-publish content.
14. The recovery loop runs every 15 minutes. A handoff that never reached the
    durable `sent` state or was never accepted is expired and safely requeued
    without creating an external request; work accepted by the agent but stalled for
    six hours is expired and blocked for manual review so the system never
    creates duplicate drafts. If a signed callback reaches the database but
    its final acknowledgement times out, the next identical callback recovers
    the existing private page by its stable page ID and brief/path instead of
    inserting a second draft. Both outcomes are written to the audit log and
    aggregate operations summary.

    Job-loop checkpoints are written before a run is closed; a state read/write
    or terminal run transition error is surfaced to Inngest for retry instead
    of being swallowed as a healthy completion.

15. For owner-operated browser/Codex work, use the local bridge:
    `pnpm seo:local-agent --once` performs one safe poll, claims only a brief
    with an active writer assignment and a reviewer-approved rights packet,
    asks a local Codex process to do the evidence-led research/recording work,
    and ingests a validated review-only draft. Use `--watch` only on an
    attended workstation. Before the worker can claim a brief, the handoff
    preflight verifies that its source asset is a real in-project image and
    records its exact SHA-256 and dimensions. Brand policy stays explicit: an
    authorized logo overlay must name a supplied logo asset, while an
    unverified brand never causes the worker to invent or redraw a logo. The
    bridge never
    publishes, changes redirects/canonicals/noindex, edits migrations or env
    files, commits, or pushes. It writes run evidence under the ignored
    `.seo-content-agent/` directory and records success/failure audit events.
    Local Codex subprocesses run in their own process group; a timeout
    terminates browser/Playwright descendants before any retry is considered.
    Transient provider failures are returned to the assigned queue with a
    durable six-hour cooldown, while manual failures remain blocked.
    Completion is reported only after the assignment, audit event, and agent
    run state are each durably written; a post-ingest persistence failure
    blocks the brief/run instead of leaving a false success. Missing rights,
    browser evidence, or independent generation jobs block the brief rather
    than allowing guessed content. Use `--dry-run` to inspect the queue
    without claiming work.
    For the attended long-running mode, `pnpm seo:start-content` is the
    equivalent of `--watch`; it exits immediately while either kill switch is
    off and does not start a mutating worker.
    The local supervisor also runs `pnpm seo:brief-intake` on each tick. Its
    graph-checksum state makes unchanged research a no-op; `--apply` is guarded
    by both automation kill switches. For one supervised loop that verifies the live SEO surface before handing
    one brief to the local bridge, use
    `pnpm seo:autopilot -- --once --dry-run` first. After the pilot gates and
    both kill switches are intentionally enabled, the attended worker can use
    `pnpm seo:autopilot -- --watch --poll-seconds 300`. The supervisor keeps a
    process-group timeout and state file under `.seo-autopilot/`, blocks the
    tick when the production verifier reports a failure, and never publishes,
    changes redirects/canonicals/noindex, or edits repository files.
    The Codex task also has an active five-minute heartbeat named
    `Airveek SEO autopilot supervisor`; it invokes the same one-tick command
    and preserves these boundaries while the workstation is unattended.

Public use-case, product-photography, prompt, and feature hubs use bounded
server-side archive reads (48 rows per page) and path-based `/page/N`
navigation. The root hub is page 1; later archive pages have their own
canonical URL and remain crawlable without creating query-string filter
variants.

## How a 200-page day works

The scheduler does not blindly publish 200 generated pages. It processes up to four 50-page waves from an approved buffer. A page is eligible only when its product/use-case intent is distinct and its evidence is complete. If a wave has 17 failures, those 17 stay out of the sitemap and the buffer supplies replacements after review.

## Required production setup

1. Apply (and verify) the ordered Supabase migrations, including the content
   operations, rights-evidence, ingest-lint, agent-run, operations-summary,
   recovery-RPC, web-vitals, intent-collision, import-watermark, database-hardening, and user-insights recovery migrations through
   `supabase/migrations/202608310012_seo_keyword_evidence_summary.sql`. Keep the migration
   files in deployment order and run `supabase db lint --linked` after every
   production push.
2. Set `NEXT_PUBLIC_SITE_URL=https://airveek.com`, deploy the application-level
   permanent redirect, and configure the DNS/hosting redirects for HTTPS and
   `www`. Verify both variants return HTTP 308 with the same path/query.
3. Create content members and assign publisher/SEO-admin roles. Keep the first 50 pages of each template in `editor_review` before changing the rollout row to `proven`.
4. Configure the service-account, GSC, GA4, Bing/IndexNow, alert, and signing-secret variables from `.env.example`.
   In GA4 Admin → Property access management, add the service-account email from
   `GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64` as at least a Viewer; otherwise the
   Data API returns HTTP 403 even when the property ID is correct.
   Then verify the measurement layers separately:
   - Run `pnpm seo:verify-production` and require `ga4_property_access=pass` before
     enabling any GA4 import job. Viewer is sufficient; do not grant Editor or
     Administrator to the automation account.
   - In GA4 Admin → Product links → BigQuery links, confirm the link targets the
     `airveek-seo` project. The standard export dataset is
     `analytics_<GA4_PROPERTY_ID>` (for this property,
     `analytics_552076389`). Dataset creation and the first export are
     asynchronous, so a newly-created link may not be queryable immediately.
   - Once the dataset exists, grant the SEO service account only BigQuery Job
     User on the project and BigQuery Data Viewer on that dataset. If a custom
     dataset is used, set `GA4_BIGQUERY_DATASET` to `project.dataset`; otherwise
     leave it blank and the worker discovers the standard dataset automatically.
   - Keep the GA4 Data API as the fallback until a read-only BigQuery query is
     confirmed. Never treat a configured link, an empty dataset, or a successful
     GA4 tag pageview as proof that historical export is ready.
5. Set the database automation row to enabled only after a pilot wave passes the route, sitemap, crawl, attribution, and rollback checks.
6. For long-running production content work, configure
   `SEO_CONTENT_AGENT_WEBHOOK_URL`, `SEO_CONTENT_AGENT_SIGNING_SECRET`, and
   `SEO_CONTENT_AGENT_BATCH_SIZE` in the deployment environment. The agent
   must preserve the structured page contract, rights evidence, independent
   listing/lifestyle/detail runs, and named author/reviewer before callback.
7. Register `/api/inngest` with Inngest and monitor `/admin/seo`.

The public app records consent-gated anonymous LCP, INP, and CLS samples in
`seo_web_vitals`. The dashboard shows their P75 values; budgets are LCP ≤2.5s,
INP ≤200ms, and CLS ≤0.1. Missing samples are displayed as `—`, never treated
as a passing score.

## Safe pause conditions

Set either `SEO_AUTOMATION_ENABLED=false` or `seo_automation_config.enabled=false` to stop source sync, crawl, and publish workers. Human-approved content remains in the database; no destructive redirect, merge, prune, canonical, or noindex change is automated.
