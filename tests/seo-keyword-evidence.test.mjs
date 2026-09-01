import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importer = path.join(projectRoot, "scripts", "ingest-seo-keyword-evidence.mjs");

test("keyword evidence importer validates and deduplicates a research packet without mutating state", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "airveek-keyword-evidence-"));
  const packetPath = path.join(directory, "packet.json");
  try {
    writeFileSync(packetPath, JSON.stringify({ rows: [
      {
        source: "gsc",
        query: "mobile phone holder product photo",
        canonicalUrl: "https://airveek.com/product-photography/mobile-phone-holder/",
        metricDate: "2026-08-30",
        clicks: 3,
        impressions: 40,
        position: 12.5,
      },
      {
        source: "gsc",
        query: "mobile phone holder product photo",
        canonicalUrl: "https://airveek.com/product-photography/mobile-phone-holder/",
        metricDate: "2026-08-30",
        clicks: 3,
        impressions: 40,
        position: 12.5,
        collectedAt: "2026-08-31T00:00:00.000Z",
      },
      {
        source: "reddit",
        query: "how to photograph a phone holder for a product page",
        metricDate: "2026-08-30",
        sourceUrl: "https://www.reddit.com/r/photography/",
        sourceTitle: "Product photography discussion",
        metadata: { signal: "Creators ask how to show scale and product context." },
        confidence: 65,
      },
    ] }, null, 2));
    const result = spawnSync(process.execPath, [importer, packetPath], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "validated");
    assert.equal(report.action, "dry_run");
    assert.equal(report.rows, 3);
    assert.equal(report.uniqueRows, 2);
    assert.deepEqual(report.sources, ["gsc", "reddit"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("keyword evidence importer fails closed for qualitative rows without provenance", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "airveek-keyword-evidence-"));
  const packetPath = path.join(directory, "invalid.json");
  try {
    writeFileSync(packetPath, JSON.stringify({ rows: [{
      source: "youtube",
      query: "product photography lighting",
      metricDate: "2026-08-30",
    }] }));
    const result = spawnSync(process.execPath, [importer, packetPath], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stderr);
    assert.ok(report.blockers.includes("row_0:qualitative_source_requires_https_source_url"));
    assert.ok(report.blockers.includes("row_0:qualitative_source_requires_metadata_signal_or_claimSupported"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
