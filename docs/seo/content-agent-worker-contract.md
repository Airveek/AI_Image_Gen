# Airveek signed content-agent worker contract

This document is the implementation contract for the external worker that
receives Airveek SEO briefs. It is intentionally separate from the publishing
system: the worker can research, record, and submit a structured draft. When
the explicit instant-agent-approval switches are enabled, Airveek records the
editorial approval after deterministic checks; the worker itself still cannot
publish, redirect, merge, prune, or change indexability.

## 1. Configuration

Configure these server-side variables in the Airveek deployment and in the
worker's secret store:

```text
SEO_CONTENT_AGENT_WEBHOOK_URL=https://worker.example.invalid/airveek/seo-brief
SEO_CONTENT_AGENT_SIGNING_SECRET=<shared-high-entropy-secret>
SEO_CONTENT_AGENT_BATCH_SIZE=5
```

The webhook must use HTTPS. `http://localhost` and `http://127.0.0.1` are
allowed only for local development. Never expose the signing secret to a
browser, page payload, log, or client-side environment variable.

The Airveek callback is the `contract.callbackUrl` in each envelope (normally
`https://airveek.com/api/seo/agent/callback`). The worker must not write to
Supabase directly; the callback is the only supported completion path.

## 2. Brief dispatch request

Airveek sends the exact UTF-8 JSON body produced by `JSON.stringify(envelope)`
with these headers:

```text
content-type: application/json
accept: application/json
user-agent: airveek-seo-agent-dispatch/1
x-airveek-agent-timestamp: <Unix seconds>
x-airveek-agent-signature: sha256=<hex HMAC>
x-airveek-agent-dispatch-id: <dispatch UUID>
```

The signature is:

```text
hex = HMAC-SHA256(SEO_CONTENT_AGENT_SIGNING_SECRET,
                  x-airveek-agent-timestamp + "." + raw_request_body)
```

The worker should reject a timestamp more than five minutes from its clock,
verify the signature with a constant-time comparison, and retain the
`dispatchId`/`dispatchKey` for idempotency. Do not parse and re-serialize the
body before verifying it.

The top-level envelope has this shape:

```json
{
  "type": "seo.content.brief",
  "version": 1,
  "dispatchId": "uuid",
  "dispatchKey": "seo-agent:brief-uuid:brief-updated-at",
  "createdAt": "2026-08-30T00:00:00.000Z",
  "brief": {
    "id": "uuid",
    "briefKey": "mobile-phone-holder-listing",
    "topicId": "uuid",
    "pageFamily": "listing",
    "productEntity": "mobile-phone-holder",
    "primaryQuery": "mobile phone holder product photo",
    "normalizedIntentKey": "mobile-phone-holder-listing-marketplace-clean-image",
    "buyerQuestion": "How do I create a marketplace-safe clean image for this holder?",
    "locale": "en",
    "templateVersion": "product-photo-v1",
    "priority": 80,
    "dueAt": null,
    "brief": {},
    "demandEvidence": [],
    "keywordEvidence": [],
    "assignmentId": "uuid",
    "assigneeId": "uuid"
  },
  "contract": {
    "callbackPath": "/api/seo/agent/callback",
    "callbackUrl": "https://airveek.com/api/seo/agent/callback",
    "publishes": false,
    "requires": [
      "real_product_source_and_rights_evidence",
      "independent_listing_lifestyle_detail_generation_runs",
      "recorded_airveek_workflow_evidence_with_checkpoint_screenshots",
      "structured_page_draft_and_failing_output_notes",
      "passing_page_contract_qa"
    ]
  }
}
```

`keywordEvidence` is a bounded (at most 20 rows per brief) reuse packet from
`seo_keyword_evidence`. Each row retains its source, metric date, dimensions,
query metrics, confidence, and any qualitative signal metadata. Treat GSC/Bing/
planner values as measured only for the recorded date and dimensions; Reddit,
YouTube, social, competitor, and manual rows are qualitative demand language,
not invented volume. An empty array is valid when source sync or research has
not produced a row yet and must not be filled with guessed metrics.

The worker should return quickly after durable acceptance:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{"accepted":true,"externalRunId":"worker-run-123"}
```

`accepted` must be the JSON boolean `true`; a plain `200` or a string value is
not acceptance. If the worker cannot safely claim the brief, return a non-2xx
response and a bounded JSON diagnostic. Airveek records the rejection and does
not retry by blindly creating another run.

## 3. Worker execution rules

1. Verify the source product and rights evidence before generating or
   recording anything. A generic retailer, marketplace, Pinterest, or
   competitor image is a pattern reference, not an Airveek-owned source.
2. Produce separate, independently auditable `listing`, `lifestyle`, and
   `detail` jobs. Three variations from one generation/recording run do not
   satisfy this requirement.
3. Capture real Airveek workflow evidence and preserve the kit manifest,
   checkpoint screenshots, timeline, raw recording, image QA, output checksums,
   provider, model, and settings. Do not invent timestamps, model names,
   rights, or URLs.
4. Store media in durable public HTTPS storage only after rights and visual QA
   approval. Every media item needs dimensions, alt text, checksum, provenance,
   rights status, logo policy, generation metadata, and an explicit
   `qaStatus: "pass"`. Pending or absent visual QA is rejected at the draft
   callback boundary; it cannot be repaired after ingest by the publisher.
5. Build the structured draft from the page contract and run the deterministic
   validator before callback. The draft must remain a review state (`draft`,
   `automated_qa`, `editor_review`, `changes_requested`, or `refresh`).
6. Keep the exact `briefId` supplied by Airveek. The callback associates the
   draft with the dispatch run; it is not a route for submitting an unrelated
   page.

7. Treat rights approval as a persisted handoff, not a field the worker can
   grant itself. Before callback, the brief must have a reviewer-attributed,
   `approved` rights `seo_evidence_packets` row and a matching approved
   `seo_evidence_items` row. The draft's `content.sourceAsset.rightsEvidenceId`
   and exact source checksum must match that item; approved rights items are
   rejected by the database if their checksum metadata is missing. Airveek
   repeats this check at both the signed callback and local-ingest boundaries; a
   payload that merely sets `rightsApproved: true` is rejected.

The canonical contract and validator are:

```bash
node .agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs draft.json
```

The validator must pass with no blockers and a score of at least 85 before the
worker submits a completed callback. The callback runs the same validator again
at the signed trust boundary and rejects any mismatch before the ingest RPC. In
instant-agent-approval mode, a passing draft is automatically recorded as
editorial-approved only after persisted quality, author/reviewer, and intent
checks pass; the publish gate checks it again later.

## 4. Completion callback

Sign the exact callback body with the same HMAC construction and send:

```text
POST https://airveek.com/api/seo/agent/callback
x-airveek-agent-timestamp: <Unix seconds>
x-airveek-agent-signature: sha256=<hex HMAC>
content-type: application/json
```

Successful completion:

```json
{
  "dispatchId": "same-dispatch-UUID",
  "status": "completed",
  "draft": { "...": "the validated page contract" }
}
```

Failure (when a brief cannot be completed without guessing):

```json
{
  "dispatchId": "same-dispatch-UUID",
  "status": "failed",
  "error": "Rights evidence for the supplied product was not approved."
}
```

For a provider or transport failure, the worker may include bounded diagnostic
metadata so the callback can distinguish a safe retry from a manual blocker:

```json
{
  "dispatchId": "same-dispatch-UUID",
  "status": "failed",
  "error": "The image provider returned HTTP 429.",
  "metadata": { "status": 429, "provider": "image-provider" }
}
```

Airveek records `transient_provider` failures with a six-hour
`next_attempt_at` cooldown and returns the brief/assignment to `assigned` for
the dispatcher. Rights, policy, malformed-input, and editorial failures stay
`manual_review`/`blocked`; metadata never grants approval or bypasses the
recording, draft, or publish gates. Instant approval only applies to a draft
that has already passed the deterministic contract and ingest checks.

The callback is idempotent. Re-sending the exact completed callback returns a
duplicate-safe success response. A different draft for a dispatch that has a
recorded checksum is rejected. The callback creates or updates only a
non-live, `noindex` review record and may record the explicit instant approval;
it never calls the publish path.

Terminal failed or expired handoffs remain audit history, but their stable
dispatch key is available for a new attempt once no active run uses it. This
prevents a transient queue-state failure from permanently consuming a brief.

If the draft-ingest transaction committed but the run-status acknowledgement
timed out, retrying the same signed callback detects the stable `pageId` and
same brief/path, marks the existing run completed, and does not insert a
second page. A page that is live, indexable, or attached to another brief is
never recovered automatically.

## 5. Recovery and operational expectations

- A `queued` handoff that never reached the durable `sent` state, or a `sent`
  handoff that is not accepted within 30 minutes, is safely requeued without
  creating an external request.
- An `accepted`/`processing` handoff that makes no progress for six hours is
  blocked for human review instead of being duplicated.
- A transient provider/rate-limit/network rejection is recorded as
  `retry_class=transient_provider` with a durable `next_attempt_at` cooldown;
  the dispatcher may retry only after that timestamp. Rights, policy,
  malformed-input, and editorial failures are `manual_review` and remain
  blocked. Completed handoffs are never selected by a failed-only retry.
- The worker should persist its own job state keyed by `dispatchId` and return
  the same `externalRunId` for duplicate delivery of the same `dispatchKey`.
- Keep callback bodies below 2 MiB and error messages below 4,000 characters.
- Never log the signing secret, source credentials, private media URLs, or
  personal data. Redact prompts when they contain private customer material.
- Alert on signature failures, callback 4xx/5xx responses, repeated source
  failures, and rights/visual-QA failures. Do not automatically approve a
  replacement page after any of these conditions.

## 6. Safe activation sequence

1. Deploy the worker with a test secret and a non-production callback URL.
2. Verify request signature, acceptance response, callback signature, replay
   rejection, and duplicate handling using the existing signature tests.
3. Configure the production webhook and secret in Vercel and the worker.
4. Create one real, rights-cleared brief and complete the first page manually.
5. Keep the first 50 pages of every template in editor review. Enable the
   database and environment automation switches only after the pilot's route,
   sitemap, crawl, attribution, and rollback checks pass.

The worker is not a substitute for the signed callback, editor decision, or
the publish gate. Those boundaries are what make high-volume production
recoverable and prevent unsupported pages from entering search discovery.

When the hosted control plane is enabled, the five-minute assignment heartbeat
automatically routes unassigned `ready_for_assignment` briefs to active writer
members before dispatch. It uses the same atomic `assign_seo_brief` RPC as the
admin UI, records assignment failures as alerts, and never changes rights,
review, page, or indexability state. The local bridge performs the same gated
assignment step immediately before it polls, so a newly-created brief does not
depend on a manual assignment click.

## 7. Owner-workstation bridge

When the browser session and Codex must run on the owner's Mac, use the local
bridge instead of exposing Supabase credentials to a third-party worker:

```bash
pnpm seo:local-agent --once --dry-run
pnpm seo:local-agent --once
pnpm seo:local-agent --watch --poll-seconds 300
```

The bridge uses the same Supabase service-role validation and draft-ingest
transaction, but it invokes `codex exec` locally. With instant approval enabled,
passing results move to `approved`; otherwise they remain review-only. It
requires the Airveek autopilot skill, an active writer assignment, and the
technical/content page-contract gates. It is deliberately not a publisher and
never changes redirects, canonicals, noindex, migrations, env files, git
history, or production automation switches. Keep the workstation attended
during initial runs and inspect `.seo-content-agent/runs/` when a brief is
blocked.
