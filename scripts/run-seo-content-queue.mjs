#!/usr/bin/env node

/**
 * Long-running local worker for real Airveek product-photo evidence.
 *
 * It is intentionally separate from the Vercel/Inngest publisher: Playwright
 * needs the authenticated local browser and image generation can spend
 * provider credits. The worker is resumable, sequential by default, and never
 * ingests or publishes a page. `--apply` is required to start real recordings.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(process.cwd());
const queuePath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const statePath = path.resolve(process.env.SEO_CONTENT_QUEUE_STATE_PATH ?? path.join(projectDirectory, "content-kits", ".seo-content-queue-state.json"));
const lockPath = path.resolve(process.env.SEO_CONTENT_QUEUE_LOCK_PATH ?? path.join(projectDirectory, "content-kits", ".seo-content-queue.lock"));
// Accept both direct node invocation and pnpm's conventional `--` separator.
// Supporting `--name value` and `--name=value` keeps dry-runs and unattended
// workers predictable regardless of how the command is launched.
const args = process.argv.slice(2).filter((value) => value !== "--");
const apply = args.includes("--apply");
const continueOnError = args.includes("--continue-on-error");
const retryFailed = args.includes("--retry-failed");
const selectedOnly = optionValue("--only")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
const fromId = optionValue("--from")?.trim() || null;
const limit = parsePositive(optionValue("--limit"));
const maxRuntimeMinutes = parsePositive(optionValue("--max-runtime-minutes")) ?? 720;

const graphText = await readFile(queuePath, "utf8");
const graphChecksum = createHash("sha256").update(graphText).digest("hex");
const graph = JSON.parse(graphText);
const opportunities = Array.isArray(graph.opportunities) ? graph.opportunities : [];
const allIds = opportunities.map((item) => String(item.id));
let ids = selectedOnly.length ? selectedOnly : allIds;
if (fromId) {
  const start = ids.indexOf(fromId);
  if (start < 0) throw new Error(`Opportunity not found in selected queue: ${fromId}`);
  ids = ids.slice(start);
}
if (limit) ids = ids.slice(0, limit);
for (const id of ids) if (!allIds.includes(id)) throw new Error(`Opportunity not found: ${id}`);
if (!ids.length) throw new Error("No opportunity IDs selected.");

const state = await readState(graphChecksum);
const now = Date.now();
const pending = ids.filter((id) => {
  const result = state.results[id];
  if (!result) return true;
  // `--retry-failed` is deliberately exact: it can retry only an explicitly
  // failed opportunity and can never regenerate a completed product pack.
  if (retryFailed && result.status !== "failed") return false;
  if (result.status === "complete") return false;
  const retryAt = Date.parse(String(result.nextAttemptAt ?? ""));
  return !Number.isFinite(retryAt) || retryAt <= now;
});
const cooldownSkipped = ids.filter((id) => {
  const result = state.results[id];
  const retryAt = Date.parse(String(result?.nextAttemptAt ?? ""));
  return result?.status === "failed" && Number.isFinite(retryAt) && retryAt > now;
}).length;
const plan = { selected: ids.length, pending: pending.length, skipped: ids.length - pending.length, cooldownSkipped, apply, maxRuntimeMinutes, continueOnError, retryFailed, graphChecksum };
if (!apply) {
  console.log(JSON.stringify({ status: "dry_run", plan, next: "rerun with --apply to start real browser recordings" }, null, 2));
  process.exit(0);
}
if (!existsSync(path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json"))) {
  throw new Error("Recording login state is missing. Run pnpm recording:auth first.");
}

await mkdir(path.dirname(lockPath), { recursive: true });
await acquireLock();
await writeFile(path.join(lockPath, "owner.json"), `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), plan }, null, 2)}\n`);

const startedAt = Date.now();
let runFailures = 0;
try {
  for (const id of pending) {
    if (Date.now() - startedAt >= maxRuntimeMinutes * 60_000) break;
    const itemStartedAt = new Date().toISOString();
    state.results[id] = { status: "running", startedAt: itemStartedAt, attemptCount: Number(state.results[id]?.attemptCount ?? 0) + 1 };
    await writeState(state);
    try {
      await run("node", ["scripts/run-opportunity-production.mjs", id]);
      state.results[id] = { ...state.results[id], status: "complete", finishedAt: new Date().toISOString() };
    } catch (error) {
      runFailures += 1;
      const failure = classifyFailure(error);
      state.results[id] = {
        ...state.results[id],
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: failure.message,
        retryClass: failure.retryClass,
        ...(failure.nextAttemptAt ? { nextAttemptAt: failure.nextAttemptAt } : { nextAttemptAt: null }),
      };
      await writeState(state);
      if (!continueOnError) throw error;
    }
    await writeState(state);
  }
} finally {
  await writeState(state);
  await writeFile(path.join(lockPath, "finished.json"), `${JSON.stringify({ finishedAt: new Date().toISOString(), state }, null, 2)}\n`).catch(() => undefined);
  // Remove only the exact lock created by this worker; never use a recursive
  // delete against the content-kits root.
  await rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
}

const finalStatus = runFailures > 0 ? "partial" : "complete";
console.log(JSON.stringify({ status: finalStatus, plan, runFailures, results: state.results }, null, 2));
if (runFailures > 0) process.exitCode = 1;

async function run(command, commandArgs) {
  const result = await execFileAsync(command, commandArgs, { cwd: projectDirectory, maxBuffer: 20 * 1024 * 1024 });
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}

function classifyFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  // Provider quota/rate/network failures are retryable after a bounded
  // cooldown. Rights, policy, malformed input, and visual-QA failures remain
  // manual blockers and must not be retried by an unattended loop.
  const transient = /quota|used today|rate.?limit|\b429\b|temporar|network|connection reset|econn|timeout/i.test(message);
  const retryClass = transient ? "transient_provider" : "manual_review";
  const nextAttemptAt = transient ? new Date(Date.now() + 6 * 60 * 60 * 1_000).toISOString() : null;
  return { message, retryClass, nextAttemptAt };
}

async function readState(expectedGraphChecksum) {
  try {
    const value = JSON.parse(await readFile(statePath, "utf8"));
    if (value && typeof value === "object" && value.results && typeof value.results === "object") {
      if (value.graphChecksum && value.graphChecksum !== expectedGraphChecksum) {
        const error = new Error(`Queue graph changed since the saved state was created. Archive ${statePath} and rerun the queue with the new graph.`);
        error.code = "QUEUE_GRAPH_CHANGED";
        throw error;
      }
      return { ...value, graphChecksum: expectedGraphChecksum };
    }
    return { version: 1, graphChecksum: expectedGraphChecksum, results: {} };
  } catch (error) {
    if (error?.code === "QUEUE_GRAPH_CHANGED") throw error;
    return { version: 1, graphChecksum: expectedGraphChecksum, results: {} };
  }
}

async function writeState(value) {
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify({ version: 1, graphChecksum, updatedAt: new Date().toISOString(), ...value }, null, 2)}\n`);
  await rename(temporaryPath, statePath);
}

async function acquireLock() {
  try {
    await mkdir(lockPath);
    return;
  } catch {
    // A hard interruption can leave the exact lock directory behind. Reclaim
    // it only when the recorded owner is definitely no longer running; never
    // remove a live worker's lock.
    let owner = null;
    try { owner = JSON.parse(await readFile(path.join(lockPath, "owner.json"), "utf8")); } catch { /* inspect below */ }
    const ownerPid = Number(owner?.pid);
    if (Number.isInteger(ownerPid) && ownerPid > 0 && isProcessRunning(ownerPid)) {
      throw new Error(`Another SEO content queue worker already holds ${lockPath} (pid ${ownerPid}). Stop it or inspect the running process before retrying.`);
    }
    if (ownerPid > 0 || owner === null) {
      await rm(lockPath, { recursive: true, force: true });
      await mkdir(lockPath);
      return;
    }
    throw new Error(`Another SEO content queue worker already holds ${lockPath}. Stop it or inspect the running process before retrying.`);
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const prefix = `${name}=`;
  const inline = args.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function parsePositive(value) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
