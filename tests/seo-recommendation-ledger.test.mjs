import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTransitionSeoRecommendationStatus,
  isActiveSeoRecommendationStatus,
  isTerminalSeoRecommendationStatus,
  normalizeSeoRecommendationDedupeKey,
  requiresSeoRecommendationResolutionNote,
  SEO_RECOMMENDATION_ACTIVE_STATUSES,
} from "../src/features/seo/recommendation-contract.ts";

test("recommendation dedupe keys are trimmed and bounded", () => {
  assert.equal(normalizeSeoRecommendationDedupeKey("  seo-decay:page-123  "), "seo-decay:page-123");
  assert.equal(normalizeSeoRecommendationDedupeKey("x".repeat(400)).length, 240);
  assert.throws(() => normalizeSeoRecommendationDedupeKey("short"), /dedupe key is invalid/);
});

test("only open recommendation states are eligible for deduplication", () => {
  assert.deepEqual([...SEO_RECOMMENDATION_ACTIVE_STATUSES], ["open", "acknowledged", "in_progress"]);
  assert.equal(isActiveSeoRecommendationStatus("open"), true);
  assert.equal(isActiveSeoRecommendationStatus("in_progress"), true);
  assert.equal(isActiveSeoRecommendationStatus("completed"), false);
  assert.equal(isActiveSeoRecommendationStatus("expired"), false);
});

test("recommendation lifecycle keeps terminal outcomes closed and auditable", () => {
  assert.equal(canTransitionSeoRecommendationStatus("open", "acknowledged"), true);
  assert.equal(canTransitionSeoRecommendationStatus("in_progress", "completed"), true);
  assert.equal(canTransitionSeoRecommendationStatus("completed", "open"), false);
  assert.equal(isTerminalSeoRecommendationStatus("dismissed"), true);
  assert.equal(requiresSeoRecommendationResolutionNote("completed"), true);
  assert.equal(requiresSeoRecommendationResolutionNote("in_progress"), false);
});
