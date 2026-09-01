import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldReturnPublishCandidateToReview } from "../src/features/seo/server/publish-wave.ts";

test("publish wave keeps transient failures retryable", () => {
  assert.equal(shouldReturnPublishCandidateToReview([]), false);
  assert.equal(shouldReturnPublishCandidateToReview(["publish_gate_unavailable"]), false);
  assert.equal(shouldReturnPublishCandidateToReview(["seo_automation_disabled"]), false);
  assert.equal(shouldReturnPublishCandidateToReview(["page_changed_before_publish"]), false);
});

test("publish wave returns permanent gate failures to editorial review", () => {
  assert.equal(shouldReturnPublishCandidateToReview(["source_asset_rights_or_provenance_missing"]), true);
  assert.equal(shouldReturnPublishCandidateToReview(["fewer_than_two_inbound_links", "related_internal_links_missing"]), true);
  assert.equal(shouldReturnPublishCandidateToReview(["quality_score_below_85", "quality_run_persist_failed"]), true);
});

test("publish wave preserves post-transition quarantine states", () => {
  assert.equal(shouldReturnPublishCandidateToReview(["render_preflight_failed", "source_asset_rights_or_provenance_missing"]), false);
  assert.equal(shouldReturnPublishCandidateToReview(["publish_transaction_failed"]), false);
  assert.equal(shouldReturnPublishCandidateToReview(["url_state_health_update_failed"]), false);
});
