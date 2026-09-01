import test from "node:test";
import assert from "node:assert/strict";

const { chooseSeoImportMetricDate } = await import("../src/features/seo/server/import-watermarks.ts");

test("watermark advances to the first missing day for a short gap", () => {
  assert.equal(chooseSeoImportMetricDate("2026-08-30", "2026-08-28"), "2026-08-29");
});

test("watermark replays the target day when last success is current or ahead", () => {
  assert.equal(chooseSeoImportMetricDate("2026-08-30", "2026-08-30"), "2026-08-30");
  assert.equal(chooseSeoImportMetricDate("2026-08-30", "2026-09-01"), "2026-08-30");
});

test("watermark avoids an unbounded historical catch-up", () => {
  assert.equal(chooseSeoImportMetricDate("2026-08-30", "2026-08-01"), "2026-08-30");
});
