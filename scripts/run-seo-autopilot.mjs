#!/usr/bin/env node

/**
 * Airveek's owner-operated SEO supervisor.
 *
 * This is a coordinator, not a second publisher. Every tick:
 *   1. runs the read-only production verifier;
 *   2. reconciles changed research into idempotent brief handoffs;
 *   3. lets the local evidence-led Codex bridge claim at most one brief; and
 *   4. records a bounded, resumable local status file.
 *
 * It is safe by default:
 * - --dry-run never claims a brief or writes a Supabase row;
 * - mutating mode requires both existing SEO kill switches;
 * - publish, redirects, canonicals, noindex, migrations, env files, commits,
 *   and pushes are never called here;
 * - a failed verifier blocks the tick before the worker can claim work.
 *
 * The hosted Inngest jobs remain the source of truth for scheduled crawling,
 * imports, monitoring, agent dispatch, and gated publish waves. This command
 * is the bridge for a workstation that has the authenticated Airveek browser
 * needed for real product-photo evidence.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  try { process.loadEnvFile?.(envFile); } catch { /* optional */ }
}

const projectDirectory = path.resolve(process.cwd());
const stateDirectory = path.resolve(process.env.SEO_AUTOPILOT_STATE_DIR ?? path.join(projectDirectory, ".seo-autopilot"));
const statePath = path.join(stateDirectory, "supervisor.json");
const lockPath = path.join(stateDirectory, "supervisor.lock");
const args = process.argv.slice(2).filter((value) => value !== "--");
const once = args.includes("--once") || !args.includes("--watch");
const dryRun = args.includes("--dry-run");
const pollSeconds = boundedInteger(optionValue("--poll-seconds"), 300, 30, 3_600);
const maxRuntimeMinutes = boundedInteger(optionValue("--max-runtime-minutes"), once ? 30 : 720, 1, 1_440);
const workerTimeoutMinutes = boundedInteger(optionValue("--worker-timeout-minutes"), 25, 5, 180);
const startedAt = Date.now();

if (args.includes("--help")) {
  console.log(`Usage: pnpm seo:autopilot -- [--once|--watch] [--dry-run] [--poll-seconds N] [--max-runtime-minutes N] [--worker-timeout-minutes N]\n\nThe supervisor verifies production, reconciles changed research briefs, then runs at most one safe local content-agent handoff per tick. It never publishes.`);
  process.exit(0);
}

if (!existsSync(path.join(projectDirectory, ".agents/skills/airveek-seo-content-autopilot/SKILL.md"))) {
  fail("airveek_seo_autopilot_skill_missing");
}
if (!dryRun) await assertAutomationEnabled();

await mkdir(stateDirectory, { recursive: true });
await acquireLock();
const state = await readState();
state.version = 1;
state.mode = once ? "once" : "watch";
state.dryRun = dryRun;
state.startedAt = new Date().toISOString();
state.pollSeconds = pollSeconds;
await writeState(state);

let ticks = 0;
let blocked = 0;
let workerFailures = 0;
try {
  while (Date.now() - startedAt < maxRuntimeMinutes * 60_000) {
    ticks += 1;
    const tick = await runTick(ticks);
    state.lastTick = tick;
    state.ticks = ticks;
    state.blocked = Number(state.blocked ?? 0) + (tick.status === "blocked" ? 1 : 0);
    state.workerFailures = Number(state.workerFailures ?? 0) + (tick.status === "worker_failed" ? 1 : 0);
    blocked += tick.status === "blocked" ? 1 : 0;
    workerFailures += tick.status === "worker_failed" ? 1 : 0;
    await writeState(state);
    if (once) break;
    await sleep(pollSeconds * 1_000);
  }
  state.finishedAt = new Date().toISOString();
  state.status = workerFailures > 0 ? "failed" : blocked > 0 ? "partial" : "complete";
  await writeState(state);
  console.log(JSON.stringify({ status: state.status, mode: once ? "once" : "watch", dryRun, ticks, blocked, workerFailures, statePath }, null, 2));
  if (workerFailures > 0) process.exitCode = 1;
} finally {
  await writeFile(path.join(stateDirectory, "finished.json"), `${JSON.stringify(state, null, 2)}\n`).catch(() => undefined);
  await rm(lockPath, { force: true }).catch(() => undefined);
}

async function runTick(tickNumber) {
  const tickStartedAt = new Date().toISOString();
  const verification = await runCommand(process.execPath, ["scripts/verify-seo-production.mjs"], projectDirectory, 120_000);
  const verifier = parseJsonOutput(verification.stdout);
  const failures = Array.isArray(verifier?.checks)
    ? verifier.checks.filter((check) => check?.status === "fail").map((check) => String(check.name ?? "unknown"))
    : verification.exitCode !== 0 ? ["verifier_process_failed"] : [];
  if (failures.length) {
    return {
      tick: tickNumber,
      startedAt: tickStartedAt,
      finishedAt: new Date().toISOString(),
      status: "blocked",
      reason: "production_verifier_failed",
      verifier: { status: verifier?.status ?? "fail", failures: failures.slice(0, 20), warningCount: countWarnings(verifier) },
      worker: null,
    };
  }

  const intakeArgs = ["scripts/run-seo-brief-intake.mjs"];
  if (dryRun) intakeArgs.push("--dry-run"); else intakeArgs.push("--apply");
  const intake = await runCommand(process.execPath, intakeArgs, projectDirectory, 120_000);
  const intakeSummary = parseJsonOutput(intake.stdout);
  if (intake.exitCode !== 0) {
    return {
      tick: tickNumber,
      startedAt: tickStartedAt,
      finishedAt: new Date().toISOString(),
      status: "blocked",
      reason: "brief_intake_failed",
      verifier: { status: verifier?.status ?? "pass", warningCount: countWarnings(verifier) },
      intake: intakeSummary ?? { stdout: truncate(intake.stdout), stderr: truncate(intake.stderr) },
      worker: null,
    };
  }

  const workerArgs = ["scripts/run-local-seo-agent.mjs", "--once", "--limit", "1"];
  if (dryRun) workerArgs.push("--dry-run");
  const worker = await runCommand(process.execPath, workerArgs, projectDirectory, workerTimeoutMinutes * 60_000);
  const workerSummary = parseJsonOutput(worker.stdout);
  const workerStatus = worker.exitCode === 0
    ? String(workerSummary?.status ?? (dryRun ? "dry_run" : "complete"))
    : "failed";
  return {
    tick: tickNumber,
    startedAt: tickStartedAt,
    finishedAt: new Date().toISOString(),
    status: workerStatus === "failed" ? "worker_failed" : "complete",
    verifier: { status: verifier?.status ?? "pass", warningCount: countWarnings(verifier) },
    intake: intakeSummary ?? { stdout: truncate(intake.stdout), stderr: truncate(intake.stderr) },
    worker: {
      status: workerStatus,
      exitCode: worker.exitCode,
      summary: workerSummary ?? { stdout: truncate(worker.stdout), stderr: truncate(worker.stderr) },
    },
  };
}

async function runCommand(command, commandArgs, cwd, timeoutMs) {
  return await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: process.env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve({ stdout, stderr, ...value });
    };
    const timer = setTimeout(() => {
      terminateGroup(child, "SIGTERM");
      setTimeout(() => terminateGroup(child, "SIGKILL"), 5_000).unref();
      finish({ exitCode: 124, signal: "SIGTERM", timedOut: true });
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({ exitCode: 1, error: error.message });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      finish({ exitCode: typeof exitCode === "number" ? exitCode : 1, signal });
    });
  });
}

function terminateGroup(child, signal) {
  try {
    const pid = Number(child.pid);
    if (Number.isInteger(pid) && pid > 0) process.kill(-pid, signal);
    else child.kill(signal);
  } catch { /* process already exited */ }
}

async function acquireLock() {
  try {
    await writeFile(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, { flag: "wx" });
    return;
  } catch {
    let lock = null;
    try { lock = JSON.parse(await readFile(lockPath, "utf8")); } catch { /* stale lock */ }
    const ownerPid = Number(lock?.pid);
    if (ownerPid > 0 && isProcessRunning(ownerPid)) fail(`another_seo_autopilot_running:${ownerPid}`);
    await rm(lockPath, { force: true });
    await writeFile(lockPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`, { flag: "wx" }).catch(() => fail("seo_autopilot_lock_unavailable"));
  }
}

function isProcessRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function readState() {
  try {
    const value = JSON.parse(await readFile(statePath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

async function writeState(value) {
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  await rename(temporaryPath, statePath);
}

function parseJsonOutput(output) {
  const text = String(output ?? "").trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* diagnostics may precede JSON */ }
  const start = text.lastIndexOf("\n{");
  const candidate = start >= 0 ? text.slice(start + 1) : text.slice(text.indexOf("{"));
  try { return JSON.parse(candidate); } catch { return null; }
}

function countWarnings(value) {
  return Array.isArray(value?.checks) ? value.checks.filter((check) => check?.status === "warn").length : 0;
}

async function assertAutomationEnabled() {
  if (process.env.SEO_AUTOMATION_ENABLED?.trim().toLowerCase() !== "true") {
    fail("seo_automation_disabled_set_SEO_AUTOMATION_ENABLED_true_for_mutating_supervisor_runs");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !serviceKey) fail("supabase_service_role_not_configured");
  const client = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.from("seo_automation_config").select("enabled").eq("id", true).maybeSingle();
  if (error) fail(`seo_automation_config_unavailable:${error.message}`);
  if (!data?.enabled) fail("seo_automation_disabled_enable_the_database_kill_switch_before_mutating_supervisor_runs");
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
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function fail(message) { console.error(JSON.stringify({ status: "fail", error: message }, null, 2)); process.exit(1); }
