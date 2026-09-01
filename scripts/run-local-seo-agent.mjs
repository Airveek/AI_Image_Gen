#!/usr/bin/env node

/**
 * Local Codex bridge for the Airveek SEO content queue.
 *
 * Vercel/Inngest remains the control-plane scheduler. This worker is for the
 * owner workstation because real browser recording, image review, and Codex
 * skill execution cannot run inside a Vercel function. It claims one brief at
 * a time, asks Codex to create a contract draft, validates/ingests that draft
 * through the existing service-role command, and leaves the page non-live.
 *
 * Safe defaults:
 * - disabled unless explicitly started by the operator;
 * - one Codex process at a time;
 * - no publish, redirect, merge, prune, canonical, or noindex operation;
 * - reader-first mode does not invent rights/evidence records, and keeps every
 *   draft review-only until the technical/content gate and human review pass;
 * - state and logs stay in the ignored .seo-content-agent directory.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const projectDirectory = path.resolve(process.cwd());
const stateDirectory = path.join(projectDirectory, ".seo-content-agent");
const lockPath = path.join(stateDirectory, "worker.lock");
const statePath = path.join(stateDirectory, "state.json");
const logsDirectory = path.join(stateDirectory, "runs");
const args = process.argv.slice(2).filter((value) => value !== "--");
const once = args.includes("--once") || !args.includes("--watch");
const dryRun = args.includes("--dry-run");
const limit = positiveInteger(optionValue("--limit"), 1, 1, 3);
const pollSeconds = positiveInteger(optionValue("--poll-seconds"), 300, 30, 3_600);
const maxRuntimeMinutes = positiveInteger(optionValue("--max-runtime-minutes"), 720, 1, 1_440);
const agentTimeoutMinutes = positiveInteger(optionValue("--agent-timeout-minutes"), 20, 5, 180);
const startedAt = Date.now();

if (args.includes("--help")) {
  console.log(`Usage: pnpm seo:local-agent [--once|--watch] [--dry-run] [--limit N] [--poll-seconds N] [--max-runtime-minutes N] [--agent-timeout-minutes N]\n\nDefault mode is one safe poll. --watch keeps the local Codex worker alive.`);
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!supabaseUrl || !serviceKey) fail("supabase_service_role_not_configured");
if (!existsSync(path.join(projectDirectory, ".agents/skills/airveek-seo-content-autopilot/SKILL.md"))) {
  fail("airveek_seo_autopilot_skill_missing");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

if (!dryRun) await assertAutomationEnabled();

await mkdir(logsDirectory, { recursive: true });
await acquireLock();
const state = await readState();
state.startedAt = new Date().toISOString();
state.mode = once ? "once" : "watch";
state.dryRun = dryRun;
await writeState(state);

try {
  let processed = 0;
  let failed = 0;
  let retryScheduled = 0;
  while (Date.now() - startedAt < maxRuntimeMinutes * 60_000) {
    // Assignment is part of the guarded local control plane. It runs only
    // after both kill switches have passed and never runs during a dry-run.
    // This keeps a newly-created brief from waiting forever for a human to
    // click the assignment form while preserving the writer-role trigger and
    // atomic assign_seo_brief RPC as the final authority.
    if (!dryRun) await ensureWriterAssignments(limit);
    const candidates = await findCandidates(limit);
    if (!candidates.length) {
      if (once) break;
      await sleep(pollSeconds * 1_000);
      continue;
    }

    for (const candidate of candidates) {
      if (Date.now() - startedAt >= maxRuntimeMinutes * 60_000) break;
      const result = await processCandidate(candidate);
      processed += 1;
      if (result.status === "failed") failed += 1;
      if (result.status === "retry_scheduled") retryScheduled += 1;
      state.lastRun = result;
      state.processed = Number(state.processed ?? 0) + 1;
      await writeState(state);
      if (result.status !== "completed" && once) break;
    }
    if (once) break;
    if (processed === 0) await sleep(pollSeconds * 1_000);
  }
  state.finishedAt = new Date().toISOString();
  state.status = failed > 0 ? "failed" : retryScheduled > 0 ? "partial" : "complete";
  await writeState(state);
  console.log(JSON.stringify({ status: state.status, processed, failed, retryScheduled, mode: once ? "once" : "watch", dryRun }, null, 2));
  if (failed > 0) process.exitCode = 1;
} finally {
  await writeFile(path.join(stateDirectory, "finished.json"), `${JSON.stringify(state, null, 2)}\n`).catch(() => undefined);
  await rm(lockPath, { force: true }).catch(() => undefined);
}

async function ensureWriterAssignments(batchSize) {
  const [{ data: writers, error: writerError }, { data: briefs, error: briefError }] = await Promise.all([
    supabase.from("content_members")
      .select("user_id,role")
      .eq("is_active", true)
      .eq("role", "writer")
      .order("role", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(100),
    supabase.from("seo_content_briefs")
      .select("id,priority,due_at")
      .eq("status", "ready_for_assignment")
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(Math.max(batchSize * 3, 3)),
  ]);
  if (writerError || briefError) fail(`agent_assignment_queue_unavailable:${writerError?.message ?? briefError?.message ?? "unknown_error"}`);
  const activeWriters = (writers ?? []).map((row) => ({
    userId: String(row.user_id),
    role: String(row.role),
  })).sort((left, right) => {
    const rank = (role) => role === "writer" ? 0 : role === "editor" ? 1 : 2;
    return rank(left.role) - rank(right.role);
  });
  if (!activeWriters.length || !briefs?.length) return { assigned: 0, availableWriters: activeWriters.length };
  const briefIds = briefs.map((row) => String(row.id));
  const { data: assignments, error: assignmentError } = await supabase.from("seo_content_assignments")
    .select("brief_id")
    .in("brief_id", briefIds)
    .eq("assignment_role", "writer")
    .in("status", ["assigned", "accepted", "in_progress", "blocked", "submitted"]);
  if (assignmentError) fail(`agent_assignment_lookup_failed:${assignmentError.message}`);
  const assignedBriefIds = new Set((assignments ?? []).map((row) => String(row.brief_id)));
  const pending = briefs.filter((row) => !assignedBriefIds.has(String(row.id))).slice(0, batchSize);
  const outcomes = [];
  for (const [index, brief] of pending.entries()) {
    const writer = activeWriters[index % activeWriters.length];
    const { data, error } = await supabase.rpc("assign_seo_brief", {
      p_brief_id: String(brief.id),
      p_assignee_id: writer.userId,
      p_assignment_role: "writer",
      p_priority: Number(brief.priority ?? 50),
      p_due_at: typeof brief.due_at === "string" ? brief.due_at : null,
      p_notes: "Autopilot writer assignment; reader-first technical, content-quality, and editorial gates remain mandatory.",
      p_assigned_by: null,
    });
    if (error || !data) fail(`agent_assignment_create_failed:${error?.message ?? "missing_assignment_id"}`);
    outcomes.push({ briefId: String(brief.id), assignmentId: String(data), assigneeId: writer.userId });
  }
  return { assigned: outcomes.length, availableWriters: activeWriters.length, outcomes };
}

async function findCandidates(batchSize) {
  const { data: briefs, error: briefError } = await supabase
    .from("seo_content_briefs")
    .select("id,brief_key,topic_id,page_family,product_entity,primary_query,normalized_intent_key,buyer_question,locale,template_version,priority,due_at,brief,demand_evidence,updated_at")
    .in("status", ["ready_for_assignment", "assigned"])
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(Math.max(batchSize * 3, 3));
  if (briefError) fail(`brief_queue_unavailable:${briefError.message}`);
  const rows = briefs ?? [];
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id));
  const [{ data: assignments, error: assignmentError }, { data: activeRuns, error: runError }, { data: activeWriters, error: writerError }, { data: keywordEvidence, error: keywordEvidenceError }] = await Promise.all([
    supabase.from("seo_content_assignments")
      .select("id,brief_id,assignee_id,assignment_role,status")
      .in("brief_id", ids)
      .eq("assignment_role", "writer")
      .in("status", ["assigned", "accepted", "in_progress"]),
    supabase.from("seo_agent_runs")
      .select("brief_id,dispatch_key,status,next_attempt_at")
      .in("brief_id", ids)
      .in("status", ["queued", "sent", "accepted", "processing", "failed"]),
    supabase.from("content_members")
      .select("user_id")
      .eq("role", "writer")
      .eq("is_active", true),
    supabase.from("seo_keyword_evidence")
      .select("brief_id,source,query,canonical_url,metric_date,country,device,search_type,clicks,impressions,ctr,position,volume,competition,source_url,source_title,confidence,metadata")
      .in("brief_id", ids)
      .order("impressions", { ascending: false })
      .order("metric_date", { ascending: false })
      .limit(Math.min(batchSize * 20, 500)),
  ]);
  if (assignmentError || runError || writerError || keywordEvidenceError) fail(`agent_queue_unavailable:${assignmentError?.message ?? runError?.message ?? writerError?.message ?? keywordEvidenceError?.message ?? "unknown_error"}`);
  const activeWriterIds = new Set((activeWriters ?? []).map((member) => String(member.user_id)));
  const writerByBrief = new Map();
  for (const assignment of assignments ?? []) {
    const briefId = String(assignment.brief_id);
    if (!activeWriterIds.has(String(assignment.assignee_id))) continue;
    if (!writerByBrief.has(briefId)) writerByBrief.set(briefId, { id: String(assignment.id), assigneeId: String(assignment.assignee_id) });
  }
  const activeDispatches = new Set();
  const retryAtByBrief = new Map();
  for (const run of activeRuns ?? []) {
    const briefId = String(run.brief_id);
    if (["queued", "sent", "accepted", "processing"].includes(String(run.status))) activeDispatches.add(briefId);
    if (run.status === "failed" && typeof run.next_attempt_at === "string") {
      const retryAt = Date.parse(run.next_attempt_at);
      if (Number.isFinite(retryAt)) retryAtByBrief.set(briefId, Math.max(retryAtByBrief.get(briefId) ?? 0, retryAt));
    }
  }
  const evidenceByBrief = new Map();
  for (const row of keywordEvidence ?? []) {
    const briefId = String(row.brief_id ?? "");
    if (!briefId) continue;
    const bucket = evidenceByBrief.get(briefId) ?? [];
    if (bucket.length < 20) bucket.push({
      source: String(row.source ?? "manual"),
      query: String(row.query ?? ""),
      canonicalUrl: String(row.canonical_url ?? ""),
      metricDate: String(row.metric_date ?? ""),
      country: String(row.country ?? "all"),
      device: String(row.device ?? "all"),
      searchType: String(row.search_type ?? "web"),
      clicks: Number(row.clicks ?? 0),
      impressions: Number(row.impressions ?? 0),
      ctr: row.ctr == null ? null : Number(row.ctr),
      position: row.position == null ? null : Number(row.position),
      volume: row.volume == null ? null : Number(row.volume),
      competition: row.competition == null ? null : Number(row.competition),
      sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
      sourceTitle: typeof row.source_title === "string" ? row.source_title : null,
      confidence: Number(row.confidence ?? 0),
      metadata: isRecord(row.metadata) ? row.metadata : {},
    });
    evidenceByBrief.set(briefId, bucket);
  }
  return rows.flatMap((row) => {
    const id = String(row.id);
    const writer = writerByBrief.get(id);
    if (!writer || activeDispatches.has(id)) return [];
    if ((retryAtByBrief.get(id) ?? 0) > Date.now()) return [];
    const updatedAt = typeof row.updated_at === "string" ? row.updated_at : String(row.updated_at ?? "");
    return [{
      id,
      briefKey: String(row.brief_key),
      topicId: String(row.topic_id),
      pageFamily: String(row.page_family),
      productEntity: String(row.product_entity),
      primaryQuery: String(row.primary_query),
      normalizedIntentKey: String(row.normalized_intent_key),
      buyerQuestion: String(row.buyer_question),
      locale: String(row.locale),
      templateVersion: String(row.template_version),
      priority: Number(row.priority ?? 0),
      dueAt: typeof row.due_at === "string" ? row.due_at : null,
      brief: isRecord(row.brief) ? row.brief : {},
      demandEvidence: Array.isArray(row.demand_evidence) ? row.demand_evidence : [],
      keywordEvidence: evidenceByBrief.get(id) ?? [],
      assignmentId: writer.id,
      assigneeId: writer.assigneeId,
      dispatchKey: `local-codex:${id}:${updatedAt}`.slice(0, 240),
    }];
  }).slice(0, batchSize);
}

async function processCandidate(candidate) {
  const runId = randomUUID();
  const runDirectory = path.join(logsDirectory, runId);
  await mkdir(runDirectory, { recursive: true });
  const briefPath = path.join(runDirectory, "brief.json");
  const draftPath = path.join(runDirectory, "draft.json");
  const outputPath = path.join(runDirectory, "codex-last-message.txt");
  const request = {
    type: "seo.content.brief",
    version: 1,
    dispatchId: runId,
    dispatchKey: candidate.dispatchKey,
    createdAt: new Date().toISOString(),
    brief: candidate,
    contract: {
      callbackPath: null,
      publishes: false,
      requires: [
        "product_specific_reader_first_content",
        "structured_page_draft_with_useful_media_when_available",
        "passing_page_contract_qa",
      ],
    },
  };
  const requestChecksum = sha256(JSON.stringify(request));
  await writeFile(briefPath, `${JSON.stringify(request, null, 2)}\n`);

  if (dryRun) return { runId, briefId: candidate.id, status: "dry_run", briefPath };

  const { error: insertError } = await supabase.from("seo_agent_runs").insert({
    id: runId,
    brief_id: candidate.id,
    assignment_id: candidate.assignmentId,
    dispatch_key: candidate.dispatchKey,
    request_checksum: requestChecksum,
    external_run_id: `local-codex:${runId}`,
    status: "processing",
    attempt_count: 1,
    accepted_at: new Date().toISOString(),
  });
  if (insertError?.code === "23505") return { runId, briefId: candidate.id, status: "duplicate" };
  if (insertError) return await failRun(candidate, runId, `agent_run_create_failed:${insertError.message}`);
  // Claim both queue records before starting an expensive Codex process. A
  // silent update failure here would leave the run processing while the
  // assignment/brief remained claimable, allowing a second worker to start a
  // duplicate job after a retry. `select` + `maybeSingle` also detects a
  // concurrent state transition that matched zero rows.
  const { data: claimedAssignment, error: assignmentClaimError } = await supabase
    .from("seo_content_assignments")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", candidate.assignmentId)
    .in("status", ["assigned", "accepted"])
    .select("id")
    .maybeSingle();
  if (assignmentClaimError || !claimedAssignment) {
    return await failRun(candidate, runId, `assignment_claim_failed:${assignmentClaimError?.message ?? "state_changed"}`);
  }

  const { data: claimedBrief, error: briefClaimError } = await supabase
    .from("seo_content_briefs")
    .update({ status: "in_progress" })
    .eq("id", candidate.id)
    .in("status", ["ready_for_assignment", "assigned"])
    .select("id")
    .maybeSingle();
  if (briefClaimError || !claimedBrief) {
    return await failRun(candidate, runId, `brief_claim_failed:${briefClaimError?.message ?? "state_changed"}`);
  }

  const prompt = buildCodexPrompt({ briefPath, draftPath, runDirectory, candidate });
  const codex = await runCodex(prompt, outputPath);
  await writeFile(path.join(runDirectory, "codex-result.json"), `${JSON.stringify(codex, null, 2)}\n`);
  if (codex.exitCode !== 0 || !existsSync(draftPath)) {
    const failureReason = await classifyCodexFailure(codex, runDirectory, draftPath);
    return await failRun(candidate, runId, failureReason);
  }

  const ingest = await runCommand("pnpm", ["seo:ingest-draft", draftPath, "--apply"], runDirectory);
  await writeFile(path.join(runDirectory, "ingest-result.json"), `${JSON.stringify(ingest, null, 2)}\n`);
  if (ingest.exitCode !== 0) return await failRun(candidate, runId, "draft_ingest_failed");

  const { data: briefAfterIngest, error: briefLookupError } = await supabase
    .from("seo_content_briefs")
    .select("page_id,status")
    .eq("id", candidate.id)
    .maybeSingle();
  if (briefLookupError) return await failRun(candidate, runId, `brief_after_ingest_lookup_failed:${briefLookupError.message}`);
  const pageId = typeof briefAfterIngest?.page_id === "string" ? briefAfterIngest.page_id : null;
  if (!pageId) return await failRun(candidate, runId, "draft_ingest_did_not_link_page");
  const completedAt = new Date().toISOString();
  // Persist the local handoff state before declaring the agent run complete.
  // A page may already exist after ingest, so a missing assignment/audit/run
  // write must become a visible failed state rather than a false success.
  const { error: assignmentCompletionError, data: completedAssignment } = await supabase
    .from("seo_content_assignments")
    .update({ status: "completed", completed_at: completedAt, updated_at: completedAt })
    .eq("id", candidate.assignmentId)
    .in("status", ["in_progress", "accepted", "assigned"])
    .select("id")
    .maybeSingle();
  if (assignmentCompletionError || !completedAssignment) {
    return await failRun(candidate, runId, `assignment_completion_persist_failed:${assignmentCompletionError?.message ?? "state_changed"}`, { includeSubmitted: true });
  }

  const { error: auditError, data: auditEvent } = await supabase.from("seo_content_audit_events").insert({
    entity_type: "brief",
    entity_id: candidate.id,
    action: "agent.local.completed",
    to_status: "submitted",
    request_id: runId,
    metadata: { pageId, runId, draftPath },
    occurred_at: completedAt,
  }).select("id").maybeSingle();
  if (auditError || !auditEvent) {
    return await failRun(candidate, runId, `completion_audit_persist_failed:${auditError?.message ?? "audit_not_created"}`, { includeCompleted: true, includeSubmitted: true });
  }

  const { error: runCompletionError, data: completedRun } = await supabase
    .from("seo_agent_runs")
    .update({ status: "completed", page_id: pageId, completed_at: completedAt, received_at: completedAt, updated_at: completedAt })
    .eq("id", runId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (runCompletionError || !completedRun) {
    return await failRun(candidate, runId, `agent_completion_persist_failed:${runCompletionError?.message ?? "state_changed"}`, { includeCompleted: true, includeSubmitted: true });
  }
  return { runId, briefId: candidate.id, pageId, status: "completed", runDirectory };
}

function buildCodexPrompt({ briefPath, draftPath, runDirectory, candidate }) {
  return [
    "You are the local Airveek SEO content-agent worker.",
    `Workspace: ${projectDirectory}`,
    `Read the skill: ${path.join(projectDirectory, ".agents/skills/airveek-seo-content-autopilot/SKILL.md")}`,
    `Read the exact dispatched brief: ${briefPath}`,
    `Brief ID: ${candidate.id}`,
    "Work only on this one brief. Use the reader-first Airveek workflow: research the task, choose a useful source when available, create product-specific guidance, use a real Airveek recording when available, and finish with structured writing and deterministic QA. Rights packets and independent listing/lifestyle/detail evidence are optional in the current mode; never fabricate them.",
    "Use the brief's demandEvidence and keywordEvidence as labelled research inputs. Treat each metric as measured only when its source/date is present; community and editorial signals are qualitative evidence, not search-volume claims. Do not fabricate product facts, screenshots, generation runs, timestamps, citations, metrics, or outputs. If an asset or recording is unavailable, continue with a useful reader-first draft and make the limitation practical and concise.",
    "For fictional demo-brand briefs, use the supplied brand manifest and logo reference exactly. The MORROW wordmark is a mock product brand for examples, not a real customer or trademark claim: place it naturally on the product or package, keep the exact lowercase wordmark and two sparkle stars, and never invent other brand text.",
    "Write visible copy for the reader, not for internal audit: never expose rights status, provenance, checksums, evidence packets, reviewer names, logo-policy labels, or legal/compliance language. Use positive instructions and product-specific decisions about lighting, composition, crop, scale, detail visibility, mobile thumbnails, and export settings. Keep any internal metadata out of the visible content body.",
    "Do not publish. Do not call publishSeoPage. Do not change redirects, canonicals, noindex, migrations, env files, application code, or unrelated files. Do not commit or push.",
    `When and only when every page-contract gate passes, write the complete review-only JSON draft to exactly: ${draftPath}`,
    `Run the validator against that file with: node --experimental-strip-types ${path.join(projectDirectory, ".agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs")} ${draftPath}`,
    "The draft must use the supplied briefId, status draft/editor_review/automated_qa/changes_requested/refresh, and must never use approved/scheduled/live.",
    `Keep all run notes and evidence references under ${runDirectory}. Finish with a short machine-readable summary in your final response; the parent worker performs ingestion after your process exits.`,
  ].join("\n\n");
}

async function runCodex(prompt, outputPath) {
  return await runCommand(
    "codex",
    // `--approve-for-me` now selects the workspace-write sandbox itself. Keep
    // the worker on that reviewed policy instead of passing the mutually
    // exclusive legacy `--sandbox workspace-write` flag (which newer Codex
    // CLIs reject before the agent can start).
    ["exec", "--cd", projectDirectory, "--approve-for-me", "--ephemeral", "--output-last-message", outputPath, prompt],
    projectDirectory,
    agentTimeoutMinutes * 60_000,
    sanitizedAgentEnvironment(),
  );
}

async function classifyCodexFailure(codex, runDirectory, draftPath) {
  if (codex.exitCode === 124) return "codex_agent_timeout";
  if (existsSync(draftPath)) return "codex_agent_failed_before_ingest";

  // The content agent is required to leave a structured blocked.json when a
  // provider, browser, or editorial gate prevents a draft. Preserve its retry
  // classification instead of collapsing every no-draft result into manual
  // review. In reader-first mode an unavailable rights/evidence record is not
  // a blocker and must never be fabricated.
  try {
    const blocked = JSON.parse(await readFile(path.join(runDirectory, "blocked.json"), "utf8"));
    const providerFailure = blocked?.providerFailure;
    if (providerFailure?.retryClass === "transient_provider" || providerFailure?.retryable === true) {
      const providerCode = String(providerFailure.providerCode ?? "provider_transient_failure").trim();
      return `provider_transient:${providerCode}`;
    }
    if (blocked?.status === "blocked") return `codex_agent_blocked:${String(blocked.nextAction ?? "manual_review").slice(0, 300)}`;
  } catch {
    // Missing or malformed blocked evidence is a manual review condition.
  }
  return "codex_agent_did_not_create_draft";
}

async function runCommand(command, commandArgs, cwd, timeoutMs = 10 * 60_000, environment = process.env) {
  return await new Promise((resolve) => {
    // Start the Codex process as its own process group so a timeout terminates
    // Playwright/browser descendants too. Without this, a killed parent could
    // keep generating in the background while the queue safely retries.
    const child = spawn(command, commandArgs, { cwd, env: environment, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    const timer = setTimeout(() => {
      terminateProcessGroup(child);
      setTimeout(() => terminateProcessGroup(child, "SIGKILL"), 5_000).unref();
      resolve({ exitCode: 124, stdout, stderr: `${stderr}\ncommand_timeout` });
    }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${error.message}` }); });
    child.on("close", (code, signal) => { clearTimeout(timer); resolve({ exitCode: typeof code === "number" ? code : 1, signal, stdout, stderr }); });
  });
}

function terminateProcessGroup(child, signal = "SIGTERM") {
  const pid = Number(child.pid);
  try {
    if (Number.isInteger(pid) && pid > 0) process.kill(-pid, signal);
    else child.kill(signal);
  } catch {
    // The child may already have exited between the timeout and the kill.
  }
}

async function assertAutomationEnabled() {
  if (process.env.SEO_AUTOMATION_ENABLED?.trim().toLowerCase() !== "true") {
    fail("seo_automation_disabled_set_SEO_AUTOMATION_ENABLED_true_for_mutating_local_agent_runs");
  }
  const { data, error } = await supabase
    .from("seo_automation_config")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) fail(`seo_automation_config_unavailable:${error.message}`);
  if (!data?.enabled) fail("seo_automation_disabled_enable_the_database_kill_switch_before_running_local_agent");
}

function sanitizedAgentEnvironment() {
  const environment = { ...process.env };
  for (const key of [
    "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64",
    "GA4_MEASUREMENT_PROTOCOL_SECRET", "BING_WEBMASTER_API_KEY", "INDEXNOW_KEY",
    "SEO_ATTRIBUTION_SIGNING_SECRET", "SEO_ALERT_WEBHOOK_URL", "SEO_CONTENT_AGENT_SIGNING_SECRET",
    "WHOP_API_KEY", "WHOP_WEBHOOK_SECRET", "APINDEX_STORE_API_TOKEN", "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY", "ELEVENLABS_API_KEY", "GOOGLE_DRIVE_CLIENT_SECRET", "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
  ]) delete environment[key];
  return environment;
}

async function failRun(candidate, runId, message, options = {}) {
  const now = new Date().toISOString();
  const classification = classifyAgentFailure(message);
  const assignmentStatuses = ["assigned", "accepted", "in_progress", ...(options.includeCompleted ? ["completed"] : [])];
  const briefStatuses = ["ready_for_assignment", "assigned", "in_progress", ...(options.includeSubmitted ? ["submitted"] : [])];
  const stateErrors = [];
  const { error: runError, data: failedRun } = await supabase.from("seo_agent_runs").update({
    status: "failed",
    last_error: message.slice(0, 4_000),
    retry_class: classification.retryClass,
    next_attempt_at: classification.nextAttemptAt,
    completed_at: now,
    received_at: now,
    updated_at: now,
  }).eq("id", runId).in("status", ["processing", "completed"]).select("id").maybeSingle();
  if (runError || !failedRun) stateErrors.push(`agent_run_failure_persist_failed:${runError?.message ?? "state_changed"}`);
  const nextQueueStatus = classification.retryClass === "transient_provider" ? "assigned" : "blocked";
  const { error: assignmentError, data: updatedAssignment } = await supabase.from("seo_content_assignments").update({ status: nextQueueStatus, notes: message.slice(0, 4_000), updated_at: now }).eq("id", candidate.assignmentId).in("status", assignmentStatuses).select("id").maybeSingle();
  if (assignmentError || !updatedAssignment) stateErrors.push(`assignment_failure_persist_failed:${assignmentError?.message ?? "state_changed"}`);
  const { error: briefError, data: updatedBrief } = await supabase.from("seo_content_briefs").update({ status: nextQueueStatus, updated_at: now }).eq("id", candidate.id).in("status", briefStatuses).select("id").maybeSingle();
  if (briefError || !updatedBrief) stateErrors.push(`brief_failure_persist_failed:${briefError?.message ?? "state_changed"}`);
  if (stateErrors.length && classification.retryClass === "transient_provider") {
    // A queue-state persistence failure makes the attempt ambiguous. Do not
    // requeue it automatically when the durable reconciliation is uncertain.
    classification.retryClass = "manual_review";
    classification.nextAttemptAt = null;
    const { error: retryStateError } = await supabase.from("seo_agent_runs").update({ retry_class: "manual_review", next_attempt_at: null, updated_at: now }).eq("id", runId).eq("status", "failed");
    if (retryStateError) stateErrors.push(`retry_state_persist_failed:${retryStateError.message}`);
  }
  const auditMessage = stateErrors.length ? `${message} state errors: ${stateErrors.join(", ")}` : message;
  const { error: auditError } = await supabase.from("seo_content_audit_events").insert({
    entity_type: "brief",
    entity_id: candidate.id,
    action: classification.retryClass === "transient_provider" ? "agent.local.retry_scheduled" : "agent.local.failed",
    to_status: classification.retryClass === "transient_provider" ? "assigned" : "blocked",
    request_id: runId,
    metadata: { message: auditMessage.slice(0, 4_000), runId, retryClass: classification.retryClass, nextAttemptAt: classification.nextAttemptAt, ...(stateErrors.length ? { stateErrors } : {}) },
    occurred_at: now,
  });
  if (auditError) stateErrors.push(`audit_failure_persist_failed:${auditError.message}`);
  return {
    runId,
    briefId: candidate.id,
    status: classification.retryClass === "transient_provider" && !stateErrors.length ? "retry_scheduled" : "failed",
    retryClass: classification.retryClass,
    nextAttemptAt: classification.nextAttemptAt,
    error: stateErrors.length ? auditMessage : message,
    ...(stateErrors.length ? { stateErrors } : {}),
  };
}

function classifyAgentFailure(message) {
  const transient = /quota|used today|rate.?limit|\b429\b|temporar|network|connection reset|econn|timeout/i.test(String(message));
  return {
    retryClass: transient ? "transient_provider" : "manual_review",
    nextAttemptAt: transient ? new Date(Date.now() + 6 * 60 * 60 * 1_000).toISOString() : null,
  };
}

async function acquireLock() {
  const lockContents = `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFile(lockPath, lockContents, { flag: "wx" });
      return;
    } catch {
      let lock = null;
      try { lock = JSON.parse(await readFile(lockPath, "utf8")); } catch { /* stale/partial lock */ }
      const ownerPid = Number(lock?.pid);
      if (ownerPid > 0 && isProcessRunning(ownerPid)) fail(`another_local_seo_agent_running:${ownerPid}`);
      await rm(lockPath, { force: true });
    }
  }
  fail("local_seo_agent_lock_unavailable");
}

function isProcessRunning(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code === "EPERM"; }
}

async function readState() {
  try {
    const value = JSON.parse(await readFile(statePath, "utf8"));
    return isRecord(value) ? value : { version: 1, processed: 0 };
  } catch { return { version: 1, processed: 0 }; }
}

async function writeState(value) {
  const temporaryPath = `${statePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify({ ...value, version: 1, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  await rename(temporaryPath, statePath);
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

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function fail(message) { console.error(JSON.stringify({ status: "fail", error: message }, null, 2)); process.exit(1); }
