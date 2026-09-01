import assert from "node:assert/strict";
import { test } from "node:test";

const { readGaClientIdFromCookie } = await import("../src/lib/analytics/ga-client-id.ts");

test("reads the GA4 client id from a valid first-party _ga cookie", () => {
  assert.equal(
    readGaClientIdFromCookie("airveek_analytics_consent=granted; _ga=GA1.1.123456789.987654321"),
    "123456789.987654321",
  );
  assert.equal(readGaClientIdFromCookie("_ga=GA4.2.42.84"), "42.84");
});

test("rejects malformed, missing, or oversized cookie headers", () => {
  assert.equal(readGaClientIdFromCookie(null), null);
  assert.equal(readGaClientIdFromCookie("_ga=not-a-ga-cookie"), null);
  assert.equal(readGaClientIdFromCookie("_ga=GA1.1.123"), null);
  assert.equal(readGaClientIdFromCookie(`${"x".repeat(16_001)}`), null);
});
