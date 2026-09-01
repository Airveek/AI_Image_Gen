#!/usr/bin/env node

/**
 * Refresh research/source context on existing brief handoffs.
 *
 * The brief handoff RPC is intentionally idempotent and therefore does not
 * overwrite an existing identity. This dry-run-first command updates only the
 * non-identity context (source asset, research notes, constraints, and rights
 * state) after verifying that the candidate still matches the durable brief.
 * It never creates pages, changes rights approvals, assigns work, or publishes.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  try { process.loadEnvFile?.(envFile); } catch { /* optional */ }
}

const projectDirectory = path.resolve(process.cwd());
const candidateDirectory = path.resolve(optionValue("--dir") ?? "docs/research/seo-brief-candidates");
const only = new Set((optionValue("--only") ?? "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean));
const apply = process.argv.includes("--apply");

const files = (await readdir(candidateDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .filter((entry) => !only.size || only.has(entry.name.split("-", 1)[0].toUpperCase()))
  .map((entry) => entry.name)
  .sort();
if (!files.length) fail("no_candidates_selected");

let client = null;
if (apply) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) fail("supabase_service_role_not_configured");
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

const results = [];
for (const file of files) {
  const candidate = await readJson(path.join(candidateDirectory, file));
  const briefKey = typeof candidate?.briefKey === "string" ? candidate.briefKey.trim() : "";
  const sourceAssetPath = typeof candidate?.sourceAssetPath === "string" ? candidate.sourceAssetPath.trim() : "";
  const blockers = [];
  if (!briefKey) blockers.push("brief_key_missing");
  if (!sourceAssetPath || !existsSync(path.resolve(projectDirectory, sourceAssetPath))) blockers.push("source_asset_missing");
  if (!Array.isArray(candidate?.demandEvidence) || candidate.demandEvidence.length < 3) blockers.push("demand_evidence_incomplete");
  if (blockers.length) {
    results.push({ file, status: "blocked", briefKey, blockers });
    continue;
  }
  if (!apply) {
    results.push({ file, status: "ready", briefKey, sourceAssetPath });
    continue;
  }

  const { data: row, error: readError } = await client.from("seo_content_briefs")
    .select("id,brief_key,locale,page_family,product_entity,primary_query,normalized_intent_key,buyer_question,template_version,brief")
    .eq("brief_key", briefKey)
    .maybeSingle();
  if (readError || !row) {
    results.push({ file, status: "blocked", briefKey, blockers: [readError?.message ?? "brief_not_found"] });
    continue;
  }
  if (!identityMatches(row, candidate)) {
    results.push({ file, status: "blocked", briefKey, blockers: ["durable_brief_identity_mismatch"] });
    continue;
  }
  const nextBrief = {
    ...(isRecord(row.brief) ? row.brief : {}),
    sourceAssetPath,
    rightsStatus: typeof candidate.rightsStatus === "string" ? candidate.rightsStatus : "unreviewed",
    brand: isRecord(candidate.brand) ? candidate.brand : isRecord(row.brief?.brand) ? row.brief.brand : undefined,
    research: isRecord(candidate.research) ? candidate.research : {},
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints.filter((value) => typeof value === "string").slice(0, 20) : [],
    contextRefreshedAt: new Date().toISOString(),
  };
  const checksum = sha256(JSON.stringify(nextBrief));
  const { error: updateError, data: updated } = await client.from("seo_content_briefs")
    .update({ brief: nextBrief, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("brief_key", briefKey)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    results.push({ file, status: "failed", briefKey, blockers: [updateError?.message ?? "brief_context_update_failed"] });
    continue;
  }
  const requestId = randomUUID();
  const { error: auditError } = await client.from("seo_content_audit_events").insert({
    entity_type: "brief",
    entity_id: row.id,
    action: "brief.context_refreshed",
    request_id: requestId,
    metadata: { checksum, sourceAssetPath, candidateFile: file },
    occurred_at: new Date().toISOString(),
  });
  results.push(auditError
    ? { file, status: "failed", briefKey, blockers: [`audit_persist_failed:${auditError.message}`] }
    : { file, status: "updated", briefKey, checksum });
}

const blocked = results.filter((result) => result.status === "blocked" || result.status === "failed");
console.log(JSON.stringify({
  status: blocked.length ? "partial" : "complete",
  action: apply ? "apply" : "dry_run",
  selected: results.length,
  ready: results.filter((result) => result.status === "ready").length,
  updated: results.filter((result) => result.status === "updated").length,
  blocked: blocked.length,
  results,
  next: apply ? "Review updated context and proceed through rights, assignment, recording, draft, and publish gates." : "Rerun with --apply only after reviewing the complete report.",
}, null, 2));
if (blocked.length) process.exit(1);

function identityMatches(row, candidate) {
  return row.locale === (candidate.locale || "en")
    && row.page_family === candidate.pageFamily
    && row.product_entity === candidate.productEntity
    && row.primary_query === candidate.primaryQuery
    && row.normalized_intent_key === candidate.intentKey
    && row.buyer_question === candidate.buyerQuestion
    && row.template_version === (candidate.templateVersion || "seo-v1");
}

async function readJson(filePath) {
  try { return JSON.parse(await readFile(filePath, "utf8")); } catch { return null; }
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(name) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}
function fail(error) { console.error(JSON.stringify({ status: "fail", error }, null, 2)); process.exit(1); }
