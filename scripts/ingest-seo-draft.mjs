#!/usr/bin/env node

/**
 * Validate and atomically import one structured SEO draft. This command never
 * publishes a page; --apply only creates a non-live review record and its
 * evidence graph through the service-role RPC.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* caller may provide env */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional fallback */ }

const execFileAsync = promisify(execFile);
const cliArgs = process.argv.slice(2);
const draftPath = cliArgs.find((value) => !value.startsWith("-"));
const apply = cliArgs.includes("--apply");
if (!draftPath) {
  console.error("Usage: pnpm seo:ingest-draft <draft.json> [--apply]");
  process.exit(2);
}

const absoluteDraftPath = path.resolve(draftPath);
let draft;
try {
  draft = JSON.parse(await readFile(absoluteDraftPath, "utf8"));
} catch (error) {
  console.error(JSON.stringify({ status: "fail", blockers: [`draft_unreadable:${error instanceof Error ? error.message : "unknown_error"}`] }, null, 2));
  process.exit(1);
}

const validatorPath = path.resolve(".agents/skills/airveek-seo-content-autopilot/scripts/validate-page-draft.mjs");
let validation;
try {
  const result = await execFileAsync(process.execPath, ["--experimental-strip-types", validatorPath, absoluteDraftPath], { maxBuffer: 4 * 1024 * 1024 });
  validation = parseValidation(result.stdout);
} catch (error) {
  const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
  validation = parseValidation(stdout) ?? { status: "fail", blockers: ["draft_validator_failed"], warnings: [], score: 0 };
}

if (!validation || validation.status !== "pass") {
  console.error(JSON.stringify({ status: "fail", phase: "validation", validation }, null, 2));
  process.exit(1);
}

if (!apply) {
  console.log(JSON.stringify({ status: "validated", action: "dry_run", validation, next: "rerun with --apply to create a non-live review record" }, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error(JSON.stringify({ status: "fail", phase: "configuration", blockers: ["supabase_service_role_not_configured"] }, null, 2));
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const draftRecord = draft && typeof draft === "object" && !Array.isArray(draft) ? draft : {};
const contentEmbedding = readContentEmbedding(draftRecord.contentEmbedding);
if (Object.prototype.hasOwnProperty.call(draftRecord, "contentEmbedding") && !contentEmbedding) {
  fail("content_embedding_must_be_a_1536_dimension_numeric_vector");
}
const briefId = typeof draftRecord.briefId === "string" ? draftRecord.briefId.trim() : "";
if (briefId) {
  // The page RPC and the brief link are intentionally kept compatible with
  // older migrations, so the link is a second update. Fail before creating a
  // page when the referenced handoff is missing or already archived; this
  // avoids leaving an otherwise valid-looking orphan review record.
  const { data: brief, error: briefLookupError } = await supabase
    .from("seo_content_briefs")
    .select("id,status")
    .eq("id", briefId)
    .maybeSingle();
  if (briefLookupError) fail(`brief_lookup_failed:${briefLookupError.message}`);
  if (!brief) fail("brief_not_found");
  if (brief.status === "archived" || brief.status === "merged") fail("brief_not_open_for_ingest");

  // Reader-first mode intentionally removes ownership/evidence approval as a
  // blocking condition. Keep the legacy verifier available behind the
  // explicit environment flag so operators can re-enable it during rollback.
  if (process.env.SEO_EVIDENCE_GATES_ENABLED?.trim().toLowerCase() === "true") {
    const persistedRights = await verifyPersistedRightsPacket(supabase, briefId, draftRecord);
    if (!persistedRights.ok) fail(`persisted_rights_evidence_failed:${persistedRights.reason}`);
  }
}
const { data: collision, error: collisionError } = await supabase.rpc("check_seo_intent_collision", {
  p_normalized_intent_key: slugify(String(draftRecord.intentKey ?? "")),
  p_locale: typeof draftRecord.locale === "string" && draftRecord.locale.trim() ? draftRecord.locale.trim() : "en",
  p_product_slug: slugify(String(draftRecord.productEntity ?? "")),
  p_embedding: contentEmbedding,
});
if (collisionError) fail(`intent_collision_check_failed:${collisionError.message}`);
if (collision && typeof collision === "object" && collision.status === "blocked") {
  fail(`intent_collision_blocked:${String(collision.reason ?? "existing_intent")}`);
}
const ingestPayload = {
  ...draftRecord,
  // Migration 007 projects these immutable evidence fields into queryable
  // generation-run columns. Keep the original top-level contract intact.
  generationRuns: Array.isArray(draftRecord.generationRuns)
    ? draftRecord.generationRuns.map((run) => {
      const sourceAsset = run && typeof run === "object" && !Array.isArray(run) && run.sourceAsset && typeof run.sourceAsset === "object" && !Array.isArray(run.sourceAsset)
        ? { ...run.sourceAsset }
        : {};
      if (run && typeof run === "object" && !Array.isArray(run)) {
        if (typeof run.provider === "string") sourceAsset.provider = run.provider;
        if (typeof run.model === "string") sourceAsset.model = run.model;
        if (Array.isArray(run.outputs)) sourceAsset.outputManifest = run.outputs;
      }
      return run && typeof run === "object" && !Array.isArray(run) ? { ...run, sourceAsset } : run;
    })
    : draftRecord.generationRuns,
  // Persist the exact deterministic score used for the pre-insert contract
  // check unless an explicit, stricter editorial score was supplied.
  qualityScore: Number.isInteger(draftRecord.qualityScore) ? draftRecord.qualityScore : validation.score,
  qualityChecks: validation,
};
const ingestRpc = process.env.SEO_EVIDENCE_GATES_ENABLED?.trim().toLowerCase() === "true"
  ? "ingest_seo_page_draft"
  : "ingest_seo_page_draft_reader_first";
const { data, error } = await supabase.rpc(ingestRpc, { payload: ingestPayload });
if (error) {
  console.error(JSON.stringify({ status: "fail", phase: "ingest", blockers: ["database_ingest_failed"], message: error.message }, null, 2));
  process.exit(1);
}
if (contentEmbedding) {
  const { error: embeddingError } = await supabase
    .from("seo_pages")
    .update({ content_embedding: contentEmbedding })
    .eq("id", String(data));
  if (embeddingError) fail(`content_embedding_write_failed:${embeddingError.message}`);
}

// Link the newly ingested page back to its research brief. This is deliberately
// a separate update so migration 006 remains backwards-compatible with older
// drafts while migration 009 provides the durable brief/evidence queue.
if (briefId) {
  const { error: briefLinkError } = await supabase
    .from("seo_content_briefs")
    .update({ page_id: String(data), status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", briefId);
  if (briefLinkError) {
    console.error(JSON.stringify({ status: "fail", phase: "brief_link", pageId: data, blockers: ["brief_link_failed"], message: briefLinkError.message }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({ status: "ingested", pageId: data, validation, indexable: false, note: "The page remains in its submitted review state; publishSeoPage is the only indexability transition." }, null, 2));

function parseValidation(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* validator output may have a diagnostic prefix */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* keep the generic failure below */ }
  }
  return null;
}

function readContentEmbedding(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length !== 1536) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  return `[${value.join(",")}]`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

async function verifyPersistedRightsPacket(client, currentBriefId, draftRecord) {
  const content = isRecord(draftRecord.content) ? draftRecord.content : {};
  const sourceAsset = isRecord(content.sourceAsset) ? content.sourceAsset : {};
  const evidenceId = typeof sourceAsset.rightsEvidenceId === "string" ? sourceAsset.rightsEvidenceId.trim() : "";
  if (!evidenceId || sourceAsset.rightsApproved !== true) return { ok: false, reason: "draft_rights_evidence_is_not_explicitly_approved" };
  const { data: packets, error: packetError } = await client
    .from("seo_evidence_packets")
    .select("id,reviewed_by,reviewed_at,packet_checksum,version")
    .eq("brief_id", currentBriefId)
    .eq("packet_type", "rights")
    .eq("status", "approved")
    .eq("rights_status", "approved")
    .order("version", { ascending: false })
    .limit(10);
  if (packetError) return { ok: false, reason: "rights_packet_lookup_failed" };
  const packet = (packets ?? []).find((item) => Boolean(item.reviewed_by && item.reviewed_at && item.packet_checksum));
  if (!packet) return { ok: false, reason: "no_reviewer_approved_rights_packet_for_brief" };
  const { data: items, error: itemError } = await client
    .from("seo_evidence_items")
    .select("rights_evidence_id,metadata")
    .eq("packet_id", packet.id)
    .eq("item_type", "rights")
    .eq("rights_status", "approved")
    .eq("rights_evidence_id", evidenceId)
    .limit(10);
  if (itemError) return { ok: false, reason: "rights_item_lookup_failed" };
  const sourceChecksum = typeof sourceAsset.checksum === "string" ? sourceAsset.checksum.toLowerCase().replace(/^sha256:/, "") : "";
  const matching = (items ?? []).find((item) => {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const recordedChecksum = typeof metadata.sourceAssetChecksum === "string"
      ? metadata.sourceAssetChecksum.toLowerCase().replace(/^sha256:/, "")
      : null;
    // Bind the approved rights record to the exact source asset. Missing
    // checksum metadata is not an implicit match and must fail closed.
    return Boolean(recordedChecksum && sourceChecksum && recordedChecksum === sourceChecksum);
  });
  return matching ? { ok: true } : { ok: false, reason: "draft_rights_evidence_id_is_not_approved_for_source_asset" };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message) {
  console.error(JSON.stringify({ status: "fail", phase: "ingest", blockers: [String(message)] }, null, 2));
  process.exit(1);
}
