#!/usr/bin/env node

/**
 * Reconcile the researched opportunity graph into idempotent SEO handoffs.
 *
 * This is the intake half of the owner-operated autopilot. It may create
 * topics, briefs, and draft research/rights packets, but it never creates a
 * page, approves rights, generates media, changes indexability, or publishes.
 * A graph checksum makes the five-minute supervisor cheap when no research
 * has changed; --force is available for an explicit reconciliation.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  try { process.loadEnvFile?.(envFile); } catch { /* optional */ }
}

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(process.cwd());
const graphPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const candidateDirectory = path.join(projectDirectory, "docs/research/seo-brief-candidates");
const stateDirectory = path.resolve(process.env.SEO_AUTOPILOT_STATE_DIR ?? path.join(projectDirectory, ".seo-autopilot"));
const statePath = path.join(stateDirectory, "brief-intake.json");
const args = process.argv.slice(2).filter((value) => value !== "--");
const apply = args.includes("--apply");
const force = args.includes("--force");
const maxCandidates = boundedInteger(optionValue("--limit"), 1_000, 1, 10_000);

if (args.includes("--help")) {
  console.log(`Usage: pnpm seo:brief-intake -- [--dry-run|--apply] [--force] [--limit N]\n\nThe default is a read-only reconciliation. --apply creates only idempotent research-to-writer handoffs; it never creates pages or publishes.`);
  process.exit(0);
}

const graphText = await readFile(graphPath, "utf8");
const graphChecksum = createHash("sha256").update(graphText).digest("hex");
const previous = await readState();
if (!force && previous?.status === "complete" && previous?.graphChecksum === graphChecksum && previous?.apply === apply) {
  console.log(JSON.stringify({
    status: "skipped",
    reason: "graph_unchanged",
    apply,
    graphChecksum,
    statePath,
  }, null, 2));
  process.exit(0);
}
if (apply) await assertAutomationEnabled();

await mkdir(candidateDirectory, { recursive: true });
const prepared = await run(process.execPath, [
  path.join(projectDirectory, "scripts/prepare-seo-briefs-from-graph.mjs"),
  "--pack",
  "--write",
  "--limit",
  String(maxCandidates),
]);
const preparedReport = parseJson(prepared.stdout) ?? parseJson(prepared.stderr);
if (prepared.exitCode !== 0 || preparedReport?.status !== "prepared") {
  await writeState({ status: "failed", apply, graphChecksum, phase: "prepare", error: truncate(prepared.stderr || prepared.stdout) });
  fail(`brief_intake_prepare_failed:${truncate(prepared.stderr || prepared.stdout)}`);
}

const batchArgs = [
  path.join(projectDirectory, "scripts/create-seo-brief-batch.mjs"),
  "--dir",
  candidateDirectory,
  "--limit",
  String(maxCandidates),
  "--continue-on-error",
];
if (apply) batchArgs.push("--apply");
const batched = await run(process.execPath, batchArgs);
const batchReport = parseJson(batched.stdout) ?? parseJson(batched.stderr);
if (batched.exitCode !== 0 || !["complete", "partial"].includes(String(batchReport?.status))) {
  await writeState({ status: "failed", apply, graphChecksum, phase: "handoff", prepared: preparedReport, batch: batchReport ?? { stdout: truncate(batched.stdout), stderr: truncate(batched.stderr) } });
  fail(`brief_intake_handoff_failed:${truncate(batched.stderr || batched.stdout)}`);
}

const result = {
  status: batchReport.status === "partial" ? "partial" : "complete",
  apply,
  graphChecksum,
  prepared: {
    opportunityCount: Number(preparedReport.opportunityCount ?? 0),
    briefCount: Number(preparedReport.briefCount ?? 0),
  },
  batch: {
    selected: Number(batchReport.selected ?? 0),
    created: Number(batchReport.created ?? 0),
    alreadyExists: Number(batchReport.alreadyExists ?? 0),
    failed: Number(batchReport.failed ?? 0),
  },
  statePath,
  next: apply
    ? "Attach rights/research evidence and let the guarded assignment loop hand open briefs to an active writer."
    : "Rerun with --apply after reviewing the candidate preflight; no database rows were changed.",
};
await writeState(result);
console.log(JSON.stringify(result, null, 2));
if (result.status === "partial") process.exitCode = 1;

async function run(command, commandArgs) {
  try {
    const output = await execFileAsync(command, commandArgs, {
      cwd: projectDirectory,
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { exitCode: 0, stdout: output.stdout, stderr: output.stderr };
  } catch (error) {
    return {
      exitCode: typeof error?.code === "number" ? error.code : 1,
      stdout: typeof error?.stdout === "string" ? error.stdout : "",
      stderr: typeof error?.stderr === "string" ? error.stderr : error instanceof Error ? error.message : String(error),
    };
  }
}

async function readState() {
  try {
    const value = JSON.parse(await readFile(statePath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

async function writeState(value) {
  await mkdir(stateDirectory, { recursive: true });
  await writeFile(statePath, `${JSON.stringify({ version: 1, ...value, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function parseJson(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* diagnostics may precede JSON */ }
  const start = text.lastIndexOf("\n{");
  if (start >= 0) {
    try { return JSON.parse(text.slice(start + 1)); } catch { /* keep null */ }
  }
  return null;
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const prefix = `${name}=`;
  const inline = args.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= minimum ? Math.min(parsed, maximum) : fallback;
}

function truncate(value) { return String(value ?? "").slice(-2_000); }
function fail(message) { console.error(JSON.stringify({ status: "fail", error: message }, null, 2)); process.exit(1); }

async function assertAutomationEnabled() {
  if (process.env.SEO_AUTOMATION_ENABLED?.trim().toLowerCase() !== "true") {
    fail("seo_automation_disabled_set_SEO_AUTOMATION_ENABLED_true_for_mutating_intake");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !serviceKey) fail("supabase_service_role_not_configured");
  const client = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const { data, error } = await client.from("seo_automation_config").select("enabled").eq("id", true).maybeSingle();
  if (error) fail(`seo_automation_config_unavailable:${error.message}`);
  if (!data?.enabled) fail("seo_automation_disabled_enable_the_database_kill_switch_before_mutating_intake");
}
