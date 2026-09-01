import test from "node:test";
import assert from "node:assert/strict";

const { classifySeoAgentFailure } = await import("../src/features/seo/server/agent-retry.ts");

test("provider quota failures are requeued after a bounded cooldown", () => {
  const now = Date.parse("2026-08-31T00:00:00.000Z");
  const result = classifySeoAgentFailure("The image provider says you have used today's quota.", {}, now);
  assert.equal(result.retryClass, "transient_provider");
  assert.equal(result.nextAttemptAt, "2026-08-31T06:00:00.000Z");
});
test("HTTP 503 metadata is retryable while rights failures stay manual", () => {
  const now = Date.parse("2026-08-31T00:00:00.000Z");
  assert.equal(classifySeoAgentFailure("upstream failed", { status: 503 }, now).retryClass, "transient_provider");
  assert.equal(classifySeoAgentFailure("rights packet is not approved", {}, now).retryClass, "manual_review");
  assert.equal(classifySeoAgentFailure("rights packet is not approved", {}, now).nextAttemptAt, null);
});
