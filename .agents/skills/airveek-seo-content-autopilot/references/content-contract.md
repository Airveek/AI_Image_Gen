# Airveek SEO page contract

This is the payload contract for a page draft. It deliberately keeps content
structured so templates render safe HTML, links, images, and schema. It is not a
request to generate arbitrary HTML. Validate a draft with:

```bash
node .agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs draft.json
```

## Required shape

## Reader-first mode

When both `SEO_EVIDENCE_GATES_ENABLED=false` and the Supabase
`seo_automation_config.evidence_gates_enabled=false` flag are active, the
rights/evidence fields shown in the legacy example are optional. A draft may
omit `evidencePacket`, generation runs, rejected outputs, screenshots, and
media-QA fields; do not invent them. The validator still requires useful
product-specific copy, a direct answer, workflow steps, a tested prompt,
selected technical media when available, sources, crawlable links, author,
reviewer ownership, and a passing quality score. Public rendering removes
rights, provenance, checksum, reviewer, and methodology language. Setting the
two controls to `true` restores the strict contract described by the legacy
example below.

```json
{
  "pageId": "uuid-or-stable-id",
  "briefId": "brief-uuid-created-by-seo:create-brief",
  "path": "/product-photography/mobile-phone-holder/clean-listing-image/",
  "pageFamily": "listing",
  "intentKey": "mobile-phone-holder/listing/marketplace-clean-image",
  "productEntity": "mobile-phone-holder",
  "buyerQuestion": "How do I create a marketplace-safe clean image for this holder?",
  "title": "Create a clean mobile phone holder product image",
  "metaDescription": "A tested Airveek workflow for a clean, accurate mobile phone holder image.",
  "directAnswer": "Use the supplied holder as the identity reference, generate a product-dominant image with a neutral background, and validate the crop, color, and marketplace constraints before publishing.",
  "generationRuns": [{
    "runId": "listing-run-1",
    "imageJob": "listing",
    "provider": "airveek",
    "model": "airveek-image-v1",
    "outputs": [{ "assetId": "output-id", "checksum": "sha256:..." }],
    "creatorRoute": "/create/product-fashion",
    "arenaId": "product-fashion",
    "sourceAsset": { "assetId": "asset-id", "checksum": "sha256:...", "rightsEvidenceId": "rights-mobile-holder-1", "rightsApproved": true },
    "settings": { "aspectRatio": "1:1", "quality": "high" },
    "prompt": "Use the supplied holder as the identity reference ...",
    "negativeConstraints": ["do not alter product geometry"],
    "kitPath": "content-kits/MOBILE-HOLDER/2026-08-30T00-00-00.000Z",
    "kitChecksum": "64-lowercase-hex-characters",
    "qaStatus": "pass",
    "recordedAt": "2026-08-30T00:00:00.000Z"
  }, {
    "runId": "lifestyle-run-1",
    "imageJob": "lifestyle",
    "provider": "airveek",
    "model": "airveek-image-v1",
    "outputs": [{ "assetId": "output-id", "checksum": "sha256:..." }],
    "creatorRoute": "/create/product-fashion",
    "arenaId": "product-fashion",
    "sourceAsset": { "assetId": "asset-id", "checksum": "sha256:...", "rightsEvidenceId": "rights-mobile-holder-1", "rightsApproved": true },
    "settings": { "aspectRatio": "4:5", "quality": "high" },
    "prompt": "Place the supplied holder in a believable desk scene ...",
    "negativeConstraints": ["do not hide the holder"],
    "kitPath": "content-kits/MOBILE-HOLDER/2026-08-30T00-00-00.000Z",
    "kitChecksum": "64-lowercase-hex-characters",
    "qaStatus": "pass",
    "recordedAt": "2026-08-30T00:00:00.000Z"
  }, {
    "runId": "detail-run-1",
    "imageJob": "detail",
    "provider": "airveek",
    "model": "airveek-image-v1",
    "outputs": [{ "assetId": "output-id", "checksum": "sha256:..." }],
    "creatorRoute": "/create/product-fashion",
    "arenaId": "product-fashion",
    "sourceAsset": { "assetId": "asset-id", "checksum": "sha256:...", "rightsEvidenceId": "rights-mobile-holder-1", "rightsApproved": true },
    "settings": { "aspectRatio": "1:1", "quality": "high" },
    "prompt": "Show the holder hinge, ports, and scale without changing the product ...",
    "negativeConstraints": ["do not invent labels"],
    "kitPath": "content-kits/MOBILE-HOLDER/2026-08-30T00-00-00.000Z",
    "kitChecksum": "64-lowercase-hex-characters",
    "qaStatus": "pass",
    "recordedAt": "2026-08-30T00:00:00.000Z"
  }],
  "content": {
    "sourceAsset": {
      "assetId": "asset-id",
      "checksum": "sha256:...",
      "rightsStatus": "approved",
      "provenance": "user-supplied",
      "rightsEvidenceId": "rights-mobile-holder-1",
      "rightsApproved": true
    },
    "prompt": "...",
    "negativeConstraints": ["do not alter product geometry", "no invented logo or text"],
    "settings": { "aspectRatio": "1:1", "quality": "high" },
    "steps": [{ "title": "Upload", "description": "..." }],
    "selectedOutputs": [{ "assetId": "output-id", "checksum": "sha256:..." }],
    "rejectedOutputs": [{ "assetId": "reject-id", "reason": "...", "fix": "..." }],
    "limitations": ["A supplied logo is required for branded packaging."],
    "checklist": ["Confirm the product matches the source asset."],
    "platform": {
      "target": "marketplace",
      "outputDimensions": ["1500x1500"],
      "logoPolicy": "marketplace_restricted",
      "textOverlayPolicy": "none"
    },
    "presetId": "preset-id"
  },
  "media": [{
    "assetId": "output-id",
    "role": "selected",
    "url": "https://cdn.example/output.webp",
    "mimeType": "image/webp",
    "width": 1500,
    "height": 1500,
    "alt": "Mobile phone holder on a neutral background",
    "caption": "Selected output from the documented Airveek run.",
    "checksum": "sha256:...",
    "qaStatus": "pass",
    "rightsStatus": "approved",
    "logoPolicy": "marketplace_restricted",
    "generationMetadata": { "rightsEvidenceId": "rights-mobile-holder-1", "rightsApproved": true }
  }],
  "sources": [{
    "id": "source-id",
    "url": "https://developers.google.com/...",
    "title": "Primary source title",
    "accessedAt": "2026-08-30T00:00:00.000Z",
    "claimsSupported": ["image requirements"]
  }],
  "links": {
    "inbound": [{ "path": "/product-photography/", "anchor": "product photography guides" }, { "path": "/product-photo-prompts/", "anchor": "product photo prompts" }],
    "outbound": [{ "path": "/product-photography/mobile-phone-holder/lifestyle-image/", "anchor": "lifestyle image" }, { "path": "/product-photography/mobile-phone-holder/detail-and-scale/", "anchor": "detail and scale" }, { "path": "/tutorials/product-photo-workflow/", "anchor": "workflow tutorial" }, { "path": "/features/image-generator/", "anchor": "Airveek image generator" }]
  },
  "author": { "id": "writer-id", "name": "Writer name" },
  "reviewer": { "id": "editor-id", "name": "Reviewer name" },
  "templateVersion": "product-photo-v1",
  "status": "draft"
}
```

Every source needs a stable draft-local `id` (or `sourceKey`). FAQ blocks in
`content.faqs` must include `evidenceSourceIds` that resolve to those source
keys. The ingest transaction replaces the draft keys with the persisted
`seo_sources.id` UUIDs; unresolved FAQ citations fail the contract and are
never publishable.

`evidencePacket` must include a rights record such as
`{"type":"rights","status":"approved","evidenceId":"rights-...","reviewer":"...","reviewedAt":"..."}`.
The page source asset and every generation run must repeat that
`rightsEvidenceId` and set `rightsApproved: true`. Every media item must set
`generationMetadata.rightsApproved: true` and the same evidence ID. A plain
`rightsStatus` string is not sufficient for approval.

The database representation splits this payload across `seo_pages`,
`seo_assets`, `seo_sources`, `seo_links`, and generation-run tables. The content
body may add `whyThisWorks`, `failureFixes`, `faqs`, `mediaNotes`, and
`sourceAsset`; all additions must remain visible, evidence-backed, and safe for
the page renderer.

`generationRuns` is required for ingestion and must contain independently
validated `listing`, `lifestyle`, and `detail` runs. `kitChecksum` is the raw
64-character SHA-256 checksum of one complete content-kit attempt (the media
contract uses the `sha256:` prefix). Each run must also record its provider,
model, and at least one checksummed output in `outputs`. Each run must have
`qaStatus: "pass"` before the draft can be ingested. The ingest command is
deliberately separate from publishing:

```bash
pnpm seo:ingest-draft draft.json         # validate only
pnpm seo:ingest-draft draft.json --apply # create a non-live review record
```

`--apply` calls the service-role transactional database function. It accepts
review states only (`draft`, `automated_qa`, `editor_review`, `changes_requested`,
or `refresh`); `approved` and `scheduled` are intentionally rejected so an
agent cannot bypass editorial approval. It never sets `noindex` to false or
turns a page live; only the application publish gate may do that after approval.

## Page rules

- One H1, a 40–80 word direct answer, a visible buyer question, and a specific
  product/workflow distinction.
- A `briefId` linking the page to a reviewed `seo_content_briefs` handoff. The
  brief and evidence packets are the audit trail between research and writing;
  a page draft without that handoff is not eligible for ingestion.
- Include listing, lifestyle, and detail generation evidence for a product pack;
  a prompt page must point to the tested preset.
- Include a stable `content.presetId` so the page's creator CTA opens the exact
  tested Airveek workflow rather than a generic workspace.
- Use only HTTPS, durable public media URLs with dimensions, alt text, caption,
  checksum, provenance, rights status, and an explicit human-reviewed
  `qaStatus: "pass"`. Missing or pending media QA blocks ingestion.
- Logo policy is explicit: `inherent_product_branding`,
  `authorized_overlay_branding`, `marketplace_restricted`, or
  `unverified_brand`. `unverified_brand` is a draft-only hold state and cannot
  pass the validator or application publish gate; a reviewer must classify the
  asset before publication. Never invent a third-party mark.
- Include at least two inbound and four outbound crawlable links before approval.
- Use `Article` and `BreadcrumbList` only when they match the visible page. Do
  not fabricate FAQ, HowTo, Product, aggregate-rating, or review schema.
- `status` is `draft`, `automated_qa`, `editor_review`, `approved`, `scheduled`,
  or `live`; failures use `qa_failed`, `changes_requested`, `refresh`, `merged`,
  or `archived`.
