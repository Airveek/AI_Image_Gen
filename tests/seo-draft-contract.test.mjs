import assert from "node:assert/strict";
import test from "node:test";

import { validateSeoPageDraft } from "../src/features/seo/server/draft-contract.ts";

const checksum = `sha256:${"a".repeat(64)}`;
const kitChecksum = "b".repeat(64);

function withEvidenceGates(fn) {
  const previous = process.env.SEO_EVIDENCE_GATES_ENABLED;
  process.env.SEO_EVIDENCE_GATES_ENABLED = "true";
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.SEO_EVIDENCE_GATES_ENABLED;
    else process.env.SEO_EVIDENCE_GATES_ENABLED = previous;
  }
}

function validDraft(overrides = {}) {
  const rightsEvidenceId = "rights-mobile-holder-1";
  const sourceChecksum = `sha256:${"c".repeat(64)}`;
  return {
    pageId: "stable-mobile-holder-listing",
    briefId: "11111111-1111-4111-8111-111111111111",
    path: "/product-photography/mobile-phone-holder/clean-listing-image/",
    pageFamily: "listing",
    intentKey: "mobile-phone-holder-listing-marketplace-clean-image",
    productEntity: "mobile-phone-holder",
    buyerQuestion: "How do I create a marketplace-safe clean image for this holder?",
    title: "Create a clean mobile phone holder product image",
    metaDescription: "A tested Airveek workflow for a clean, accurate mobile phone holder image.",
    directAnswer: "Use the supplied holder as the identity reference, generate a product-dominant image with a neutral background, and validate the crop, color, and marketplace constraints before publishing.",
    generationRuns: ["listing", "lifestyle", "detail"].map((imageJob, index) => ({
      runId: `${imageJob}-run-1`,
      imageJob,
      provider: "airveek",
      model: "airveek-image-v1",
      outputs: [{ assetId: `output-${imageJob}`, checksum }],
      creatorRoute: "/create/product-fashion",
      arenaId: "product-fashion",
      sourceAsset: { assetId: "source-1", checksum: sourceChecksum, rightsEvidenceId, rightsApproved: true },
      settings: { aspectRatio: index === 1 ? "4:5" : "1:1", quality: "high" },
      prompt: `Use the supplied holder as the identity reference for the ${imageJob} workflow and preserve its geometry.`,
      negativeConstraints: ["do not alter product geometry", "do not invent labels"],
      kitPath: "content-kits/MOBILE-HOLDER/2026-08-30T00-00-00.000Z",
      kitChecksum,
      qaStatus: "pass",
      recordedAt: "2026-08-30T00:00:00.000Z",
    })),
    content: {
      sourceAsset: {
        assetId: "source-1",
        checksum: sourceChecksum,
        qaStatus: "pass",
        rightsStatus: "approved",
        provenance: "user-supplied source; Airveek-generated derivatives",
        rightsEvidenceId,
        rightsApproved: true,
      },
      prompt: "Use the supplied holder as the identity reference; create a clean product image with accurate geometry, color, crop, and lighting.",
      negativeConstraints: ["do not alter product geometry", "no invented logo or text"],
      settings: { aspectRatio: "1:1", quality: "high" },
      steps: [
        { title: "Upload", description: "Upload the rights-cleared source image." },
        { title: "Generate", description: "Run the tested Airveek preset with the documented constraints." },
        { title: "Validate", description: "Compare the output against the source and marketplace requirements." },
      ],
      selectedOutputs: [{ assetId: "output-listing", checksum }],
      rejectedOutputs: [{ assetId: "reject-1", reason: "The first crop hid the hinge.", fix: "Regenerate with a centered product-safe crop." }],
      limitations: ["A supplied logo is required for branded packaging."],
      checklist: ["Confirm the product matches the source.", "Check the crop.", "Review marketplace constraints."],
      faqs: [
        { question: "Can I use this for a marketplace listing?", answer: "Yes, when the marketplace permits the selected background and crop.", evidenceSourceIds: ["source-policy-1", "source-image-guidance"] },
        { question: "How do I keep the holder accurate?", answer: "Keep the source image as the identity reference and compare geometry before export.", evidenceSourceIds: ["source-policy-1"] },
      ],
      platform: {
        target: "marketplace",
        outputDimensions: ["1500x1500"],
        logoPolicy: "marketplace_restricted",
        textOverlayPolicy: "none",
      },
      presetId: "preset-mobile-holder-listing",
    },
    media: [
      {
        assetId: "source-1",
        role: "source",
        url: "https://cdn.airveek.com/seo/source.webp",
        mimeType: "image/webp",
        width: 1500,
        height: 1500,
        alt: "Neutral mobile phone holder source reference",
        caption: "Rights-cleared source reference.",
        checksum: sourceChecksum,
        qaStatus: "pass",
        rightsStatus: "approved",
        logoPolicy: "marketplace_restricted",
        generationMetadata: { rightsEvidenceId, rightsApproved: true },
      },
      {
        assetId: "output-listing",
        role: "selected",
        url: "https://cdn.airveek.com/seo/output-listing.webp",
        mimeType: "image/webp",
        width: 1500,
        height: 1500,
        alt: "Mobile phone holder on a clean marketplace background",
        caption: "Selected output from the documented Airveek run.",
        checksum,
        qaStatus: "pass",
        rightsStatus: "approved",
        logoPolicy: "marketplace_restricted",
        generationMetadata: { rightsEvidenceId, rightsApproved: true },
      },
    ],
    sources: [{
      id: "source-policy-1",
      url: "https://developers.google.com/search/docs/essentials",
      title: "Google Search Essentials",
      accessedAt: "2026-08-30T00:00:00.000Z",
      claimsSupported: ["search guidelines"],
    }, {
      id: "source-image-guidance",
      url: "https://www.shopify.com/blog/product-photography",
      title: "Product photography guidance",
      accessedAt: "2026-08-30T00:00:00.000Z",
      claimsSupported: ["product photography guidance"],
    }, {
      id: "source-marketplace-guidance",
      url: "https://www.amazon.com/s?k=phone+holder",
      title: "Marketplace reference",
      accessedAt: "2026-08-30T00:00:00.000Z",
      claimsSupported: ["marketplace reference"],
    }],
    evidencePacket: [{
      type: "rights",
      status: "approved",
      evidenceId: rightsEvidenceId,
      reviewer: "editor@example.com",
      reviewedAt: "2026-08-30T00:00:00.000Z",
    }],
    links: {
      inbound: [
        { path: "/product-photography/", anchor: "product photography guides" },
        { path: "/product-photo-prompts/", anchor: "product photo prompts" },
      ],
      outbound: [
        { path: "/product-photography/mobile-phone-holder/lifestyle-image/", anchor: "lifestyle image" },
        { path: "/product-photography/mobile-phone-holder/detail-and-scale/", anchor: "detail and scale" },
        { path: "/tutorials/product-photo-workflow/", anchor: "workflow tutorial" },
        { path: "/features/image-generator/", anchor: "Airveek image generator" },
      ],
    },
    author: { id: "22222222-2222-4222-8222-222222222222", name: "Writer name" },
    reviewer: { id: "33333333-3333-4333-8333-333333333333", name: "Reviewer name" },
    templateVersion: "product-photo-v1",
    status: "draft",
    ...overrides,
  };
}

test("shared draft contract accepts a complete review draft", () => {
  const result = validateSeoPageDraft(validDraft(), { reviewOnly: true });
  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  assert.equal(result.status, "pass");
  assert.ok(result.score >= 85);
  assert.deepEqual(result.blockers, []);
});

test("shared draft contract rejects live status at the agent callback boundary", () => {
  const result = validateSeoPageDraft(validDraft({ status: "live" }), { reviewOnly: true });
  assert.equal(result.valid, false);
  assert.ok(result.blockers.includes("status_must_be_non_live_review_state"));
});

test("shared draft contract requires evidence IDs to agree across the page", () => {
  withEvidenceGates(() => {
    const draft = validDraft();
    draft.content.sourceAsset.rightsEvidenceId = "different-rights-record";
    const result = validateSeoPageDraft(draft, { reviewOnly: true });
    assert.equal(result.valid, false);
    assert.ok(result.blockers.includes("source_asset_rights_evidence_not_approved"));
    assert.ok(result.blockers.includes("generation_run_rights_evidence_mismatch"));
  });
});

test("shared draft contract blocks media without an explicit visual QA pass", () => {
  withEvidenceGates(() => {
    const draft = validDraft();
    draft.media[1].qaStatus = "pending";
    const result = validateSeoPageDraft(draft, { reviewOnly: true });
    assert.equal(result.valid, false);
    assert.ok(result.blockers.includes("media_qa_not_passed"));
  });
});

test("shared draft contract blocks FAQ citations that do not resolve to a source", () => {
  withEvidenceGates(() => {
    const draft = validDraft();
    draft.content.faqs[0].evidenceSourceIds = ["missing-source-key"];
    const result = validateSeoPageDraft(draft, { reviewOnly: true });
    assert.equal(result.valid, false);
    assert.ok(result.blockers.includes("faq_source_evidence_missing"));
  });
});

test("reader-first mode accepts a draft without rights or independent evidence", () => {
  const previous = process.env.SEO_EVIDENCE_GATES_ENABLED;
  delete process.env.SEO_EVIDENCE_GATES_ENABLED;
  try {
    const draft = validDraft();
    delete draft.evidencePacket;
    draft.generationRuns = [];
    draft.content.sourceAsset = {};
    delete draft.content.negativeConstraints;
    delete draft.content.rejectedOutputs;
    draft.content.platform = { target: "ecommerce product page", outputDimensions: ["1500x1500"] };
    draft.media = [draft.media[1]];
    delete draft.media[0].qaStatus;
    delete draft.media[0].rightsStatus;
    delete draft.media[0].logoPolicy;
    delete draft.media[0].generationMetadata;
    draft.content.faqs = draft.content.faqs.map(({ question, answer }) => ({ question, answer }));
    const result = validateSeoPageDraft(draft, { reviewOnly: true });
    assert.equal(result.valid, true, JSON.stringify(result, null, 2));
    assert.deepEqual(result.blockers, []);
  } finally {
    if (previous === undefined) delete process.env.SEO_EVIDENCE_GATES_ENABLED;
    else process.env.SEO_EVIDENCE_GATES_ENABLED = previous;
  }
});
