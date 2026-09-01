#!/usr/bin/env node

/**
 * Validate and optionally create a bounded set of research-to-writer SEO
 * handoffs. The command is fail-closed and dry-run by default:
 *
 *   pnpm seo:create-brief-batch -- --only ECO01 --limit 3
 *   pnpm seo:create-brief-batch -- --only ECO01 --limit 3 --apply
 *
 * `--apply` creates only topics, briefs, and draft research/rights packets via
 * the idempotent service-role RPC. It never creates pages, generates media,
 * assigns writers, changes indexability, or publishes content.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(process.cwd());
const creatorPath = path.join(projectDirectory, "scripts/create-seo-brief.mjs");
const defaultDirectory = path.join(projectDirectory, "docs/research/seo-brief-candidates");
const args = process.argv.slice(2).filter((value) => value !== "--");
const directory = path.resolve(optionValue("--dir") ?? defaultDirectory);
const only = new Set((optionValue("--only") ?? "")
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean));
const jobs = new Set((optionValue("--job") ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean));
const limit = positiveInteger(optionValue("--limit"), Number.MAX_SAFE_INTEGER, 1, 10_000);
const apply = args.includes("--apply");
const continueOnError = args.includes("--continue-on-error");

if (args.includes("--help")) {
  console.log(`Usage: pnpm seo:create-brief-batch -- [options]

Options:
  --only ECO01,ECO02       Restrict by opportunity ID(s)
  --job listing,lifestyle  Restrict by candidate job(s)
  --limit 50               Bound the number of files
  --dir <path>             Candidate directory
  --continue-on-error      Apply valid candidates even when another fails
  --apply                  Create the research-to-writer handoffs

The default is a read-only validation run. --apply never creates pages or publishes content.`);
  process.exit(0);
}

if (apply && (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SECRET_KEY?.trim())) {
  fail("supabase_service_role_not_configured");
}

let entries;
try {
  entries = await readdir(directory, { withFileTypes: true });
} catch (error) {
  fail(`candidate_directory_unreadable:${error instanceof Error ? error.message : "unknown_error"}`);
}

const files = entries
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
  .map((entry) => entry.name)
  .filter((name) => matchesFilters(name, only, jobs))
  .sort((left, right) => left.localeCompare(right))
  .slice(0, limit);
if (!files.length) fail("no_candidates_selected");

const results = [];
for (const file of files) {
  const filePath = path.join(directory, file);
  const result = await runCreator(filePath, false);
  results.push({ file: path.relative(projectDirectory, filePath), ...result });
}

const invalid = results.filter((result) => result.status !== "validated");
if (invalid.length && !continueOnError) {
  console.log(JSON.stringify({
    status: "blocked",
    action: "preflight",
    apply,
    selected: files.length,
    valid: files.length - invalid.length,
    invalid: invalid.length,
    results,
    next: "Fix every candidate or rerun with --continue-on-error after reviewing each failure.",
  }, null, 2));
  process.exit(1);
}

if (apply) {
  for (const item of results) {
    if (item.status !== "validated") continue;
    const filePath = path.resolve(projectDirectory, item.file);
    const applied = await runCreator(filePath, true);
    Object.assign(item, { applyStatus: applied.status, apply: applied });
  }
}

const applied = results.filter((result) => result.applyStatus === "created" || result.applyStatus === "already_exists");
const failures = results.filter((result) => result.status !== "validated" || (apply && !result.applyStatus));
console.log(JSON.stringify({
  status: failures.length ? "partial" : "complete",
  action: apply ? "apply" : "dry_run",
  selected: files.length,
  valid: results.filter((result) => result.status === "validated").length,
  created: applied.filter((result) => result.applyStatus === "created").length,
  alreadyExists: applied.filter((result) => result.applyStatus === "already_exists").length,
  failed: failures.length,
  results,
  next: apply
    ? "Review the handoffs, attach evidence/rights approvals, and assign an active writer before any draft or page work."
    : "Rerun with --apply only after reviewing the complete preflight report.",
}, null, 2));
if (failures.length) process.exit(1);

async function runCreator(filePath, shouldApply) {
  const commandArgs = [creatorPath, filePath];
  if (shouldApply) commandArgs.push("--apply");
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, commandArgs, {
      cwd: projectDirectory,
      env: process.env,
      maxBuffer: 2 * 1024 * 1024,
    });
    const raw = stdout.trim() || stderr.trim();
    const report = JSON.parse(raw);
    return {
      status: report.status === "validated" || report.status === "created" || report.status === "already_exists" ? report.status : "failed",
      briefId: typeof report.briefId === "string" ? report.briefId : null,
      briefKey: typeof report.briefKey === "string" ? report.briefKey : null,
      state: typeof report.state === "string" ? report.state : null,
      idempotent: report.idempotent === true,
      blockers: Array.isArray(report.blockers) ? report.blockers : [],
    };
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
    let parsed = null;
    for (const candidate of [stdout, stderr]) {
      if (!candidate) continue;
      try { parsed = JSON.parse(candidate); break; } catch { /* inspect next stream */ }
    }
    return {
      status: "failed",
      briefId: null,
      briefKey: null,
      state: null,
      idempotent: false,
      blockers: Array.isArray(parsed?.blockers)
        ? parsed.blockers
        : [parsed?.error ?? (error instanceof Error ? error.message : String(error))],
    };
  }
}

function matchesFilters(name, selectedIds, selectedJobs) {
  const stem = name.replace(/\.json$/i, "");
  const separator = stem.indexOf("-");
  const opportunityId = (separator >= 0 ? stem.slice(0, separator) : stem).toUpperCase();
  const job = (separator >= 0 ? stem.slice(separator + 1) : "").toLowerCase();
  return (!selectedIds.size || selectedIds.has(opportunityId)) && (!selectedJobs.size || selectedJobs.has(job));
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function positiveInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= minimum ? Math.min(parsed, maximum) : fallback;
}

function fail(error) {
  console.error(JSON.stringify({ status: "fail", error }, null, 2));
  process.exit(1);
}
