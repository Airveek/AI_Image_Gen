import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = path.join(projectRoot, "scripts", "run-seo-content-queue.mjs");
const briefGenerator = path.join(projectRoot, "scripts", "prepare-seo-briefs-from-graph.mjs");
const briefCreator = path.join(projectRoot, "scripts", "create-seo-brief.mjs");
const briefBatchCreator = path.join(projectRoot, "scripts", "create-seo-brief-batch.mjs");
const kitAuditor = path.join(projectRoot, "scripts", "audit-seo-content-kits.mjs");
const queueGraph = path.join(projectRoot, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");

for (const args of [["--limit=2"], ["--", "--limit", "2"]]) {
  test(`queue dry-run honors ${args.join(" ")}`, () => {
    const result = spawnSync(process.execPath, [worker, ...args], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "dry_run");
    assert.equal(report.plan.selected, 2);
    assert.equal(report.plan.pending, 2);
    assert.equal(report.plan.apply, false);
  });
}

test("brief generator prepares distinct listing, lifestyle, and detail candidates without mutating state", () => {
  const result = spawnSync(process.execPath, [briefGenerator, "--only", "ECO01", "--limit", "1"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "prepared");
  assert.equal(report.action, "dry_run");
  assert.equal(report.opportunityCount, 1);
  assert.equal(report.briefCount, 3);
  assert.deepEqual(report.candidates.map((candidate) => candidate.job), ["listing", "lifestyle", "detail"]);
  assert.ok(report.candidates.every((candidate) => candidate.rightsStatus === "unreviewed"));
  assert.ok(report.candidates.every((candidate) => candidate.communityEvidenceCount >= 4));
  assert.ok(report.candidates.every((candidate) => candidate.evidenceBlockers.length === 0));
});

test("brief generator can include the five-page product pack", () => {
  const result = spawnSync(process.execPath, [briefGenerator, "--only", "ECO01", "--limit", "1", "--pack"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.packPages, true);
  assert.equal(report.briefCount, 5);
  assert.deepEqual(report.candidates.map((candidate) => candidate.job), ["listing", "lifestyle", "detail", "product-hub", "prompt"]);
});

test("brief generator adds a third public workflow source for categories without community evidence", () => {
  const result = spawnSync(process.execPath, [briefGenerator, "--only", "ECO02", "--limit", "1"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.candidates.every((candidate) => candidate.demandEvidenceCount >= 3));
  assert.ok(report.candidates.every((candidate) => candidate.communityEvidenceCount === 0));
  assert.ok(report.candidates.every((candidate) => candidate.evidenceBlockers.length === 0));
});

test("brief generator emits auditable access dates and claim mappings", () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "airveek-seo-brief-"));
  try {
    const result = spawnSync(process.execPath, [briefGenerator, "--only", "ECO01", "--limit", "1", "--write", "--out-dir", outputDirectory], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.equal(result.status, 0, result.stderr);
    const candidate = JSON.parse(readFileSync(path.join(outputDirectory, "ECO01-listing.json"), "utf8"));
    assert.ok(candidate.demandEvidence.length >= 3);
    assert.ok(candidate.demandEvidence.every((source) => /^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt)));
    assert.ok(candidate.demandEvidence.every((source) => source.claimSupported.length >= 10));
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("brief creator rejects candidates without three distinct public HTTPS sources before any apply step", () => {
  const candidatePath = path.join(projectRoot, "docs/research/seo-brief-candidates/ECO02-listing.json");
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "airveek-seo-brief-"));
  const invalidPath = path.join(outputDirectory, "under-researched.json");
  try {
    const candidate = JSON.parse(readFileSync(candidatePath, "utf8"));
    candidate.demandEvidence = candidate.demandEvidence.slice(0, 2);
    writeFileSync(invalidPath, `${JSON.stringify(candidate)}\n`);
    const result = spawnSync(process.execPath, [briefCreator, invalidPath], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout || result.stderr);
    assert.ok(report.blockers.includes("demandEvidence_requires_at_least_three_distinct_https_sources"));
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("brief creator rejects otherwise valid sources without provenance fields", () => {
  const sourcePath = path.join(projectRoot, "docs/research/seo-brief-candidates/ECO01-listing.json");
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "airveek-seo-brief-"));
  const candidatePath = path.join(outputDirectory, "missing-provenance.json");
  try {
    const candidate = JSON.parse(readFileSync(sourcePath, "utf8"));
    candidate.demandEvidence = candidate.demandEvidence.slice(0, 3).map((source) => {
      const copy = { ...source };
      delete copy.claimSupported;
      delete copy.signal;
      return copy;
    });
    writeFileSync(candidatePath, `${JSON.stringify(candidate)}\n`);
    const result = spawnSync(process.execPath, [briefCreator, candidatePath], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout || result.stderr);
    assert.ok(report.blockers.some((blocker) => blocker.includes("claimSupported_missing")));
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("brief batch creator preflights a bounded selection without mutating state", () => {
  const result = spawnSync(process.execPath, [briefBatchCreator, "--only", "ECO01", "--limit", "3"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "complete");
  assert.equal(report.action, "dry_run");
  assert.equal(report.selected, 3);
  assert.equal(report.valid, 3);
  assert.equal(report.created, 0);
  assert.equal(report.failed, 0);
  assert.ok(report.results.every((item) => item.status === "validated"));
});

test("brief batch creator fails closed when a selected candidate lacks evidence", () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "airveek-seo-batch-"));
  try {
    const candidate = JSON.parse(readFileSync(path.join(projectRoot, "docs/research/seo-brief-candidates/ECO02-listing.json"), "utf8"));
    candidate.demandEvidence = candidate.demandEvidence.slice(0, 2);
    writeFileSync(path.join(outputDirectory, "ECO02-listing.json"), `${JSON.stringify(candidate)}\n`);
    const result = spawnSync(process.execPath, [briefBatchCreator, "--dir", outputDirectory, "--limit", "1"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "blocked");
    assert.equal(report.action, "preflight");
    assert.equal(report.selected, 1);
    assert.equal(report.invalid, 1);
    assert.ok(report.results[0].blockers.some((blocker) => blocker.includes("demandEvidence_requires_at_least_three_distinct_https_sources")));
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("kit audit honors a bounded opportunity selection", () => {
  const result = spawnSync(process.execPath, [kitAuditor, "--only", "ECO01"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.opportunities.map((opportunity) => opportunity.opportunityId), ["ECO01"]);
});

test("failed-only queue retries never select completed work and honor cooldowns", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "airveek-seo-queue-state-"));
  const statePath = path.join(directory, "state.json");
  try {
    const graphChecksum = createHash("sha256").update(readFileSync(queueGraph, "utf8")).digest("hex");
    writeFileSync(statePath, JSON.stringify({ graphChecksum, results: {
      ECO01: { status: "complete" },
      ECO02: { status: "failed", nextAttemptAt: "2026-08-30T00:00:00.000Z" },
      ECO03: { status: "failed", nextAttemptAt: "2099-01-01T00:00:00.000Z" },
    } }));
    const result = spawnSync(process.execPath, [worker, "--only", "ECO01,ECO02,ECO03", "--retry-failed"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, SEO_CONTENT_QUEUE_STATE_PATH: statePath },
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.plan.pending, 1);
    assert.equal(report.plan.skipped, 2);
    assert.equal(report.plan.cooldownSkipped, 1);
    assert.equal(report.plan.retryFailed, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
