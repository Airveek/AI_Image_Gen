import test from "node:test";
import assert from "node:assert/strict";

const { sha256Hex, signAgentPayload, verifyAgentCallbackSignature } = await import("../src/features/seo/server/agent-signature.ts");

test("agent signatures verify only for the exact recent payload", () => {
  const rawBody = JSON.stringify({ dispatchId: "dispatch-1", status: "completed" });
  const timestamp = "1700000000";
  const signature = signAgentPayload(rawBody, timestamp, "test-secret");

  assert.equal(sha256Hex(rawBody).length, 64);
  assert.equal(verifyAgentCallbackSignature({ rawBody, timestamp, signature, secret: "test-secret", nowSeconds: 1700000000 }), true);
  assert.equal(verifyAgentCallbackSignature({ rawBody: `${rawBody} `, timestamp, signature, secret: "test-secret", nowSeconds: 1700000000 }), false);
  assert.equal(verifyAgentCallbackSignature({ rawBody, timestamp, signature, secret: "wrong-secret", nowSeconds: 1700000000 }), false);
});

test("agent signatures reject malformed and replayed callbacks", () => {
  const rawBody = "{}";
  const timestamp = "1700000000";
  const signature = signAgentPayload(rawBody, timestamp, "test-secret");

  assert.equal(verifyAgentCallbackSignature({ rawBody, timestamp: null, signature, secret: "test-secret", nowSeconds: 1700000000 }), false);
  assert.equal(verifyAgentCallbackSignature({ rawBody, timestamp, signature: "sha256=bad", secret: "test-secret", nowSeconds: 1700000000 }), false);
  assert.equal(verifyAgentCallbackSignature({ rawBody, timestamp, signature, secret: "test-secret", nowSeconds: 1700000000 + 301 }), false);
});
