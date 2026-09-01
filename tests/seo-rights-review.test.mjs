import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(projectRoot, "scripts", "review-seo-evidence.mjs");
const briefId = "00000000-0000-4000-8000-000000000000";
const reviewerId = "00000000-0000-4000-8000-000000000001";
const checksum = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

test("SEO rights review is dry-run by default", () => {
  const result = spawnSync(process.execPath, [
    script,
    "--brief-id", briefId,
    "--reviewer-id", reviewerId,
    "--rights-evidence-id", "ECO01-source",
    "--source-checksum", `sha256:${checksum}`,
    "--source-url", "https://airveek.com/assets/source.png",
    "--source-label", "Serum source",
  ], { cwd: projectRoot, encoding: "utf8", env: { ...process.env } });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "validated");
  assert.equal(report.action, "dry_run");
  assert.equal(report.payload.briefId, briefId);
  assert.equal(report.payload.sourceChecksum, `sha256:${checksum}`);
  assert.match(report.payload.itemKey, /^rights:[a-f0-9]{32}$/);
});

test("SEO rights review rejects malformed input before touching Supabase", () => {
  const result = spawnSync(process.execPath, [
    script,
    "--brief-id", "not-a-uuid",
    "--reviewer-id", reviewerId,
    "--rights-evidence-id", "x",
    "--source-checksum", "not-a-checksum",
  ], { cwd: projectRoot, encoding: "utf8", env: { ...process.env } });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stderr);
  assert.equal(report.status, "fail");
  assert.ok(report.blockers.includes("brief_id_must_be_a_uuid"));
  assert.ok(report.blockers.includes("source_checksum_must_be_a_sha256_hex_digest"));
});
