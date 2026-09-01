#!/usr/bin/env node

/**
 * Record a human approval for a brief's source-asset rights packet.
 *
 * This command is deliberately dry-run by default. `--apply` only records a
 * reviewer-attributed rights item/packet, mirrors the decision onto the topic
 * evidence, and appends an audit event. It never creates Auth users, pages,
 * media, redirects, or publish state, and it cannot approve an unknown user.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const args = process.argv.slice(2).filter((value) => value !== "--");
if (args.includes("--help") || args.length === 0) {
  console.log(`Usage: pnpm seo:review-evidence -- --brief-id <uuid> --reviewer-id <uuid> --rights-evidence-id <id> --source-checksum <sha256:hex|hex> [--source-url https://...] [--source-label <label>] [--review-after <ISO timestamp>] [--notes <text>] [--apply]\n\nDry-run is the default. --apply records a human rights decision only; it never creates a page, publishes content, creates Auth users, or enables automation.`);
  process.exit(args.includes("--help") ? 0 : 2);
}

const briefId = optionValue("--brief-id");
const reviewerId = optionValue("--reviewer-id");
const rightsEvidenceId = optionValue("--rights-evidence-id");
const sourceChecksum = normalizeChecksum(optionValue("--source-checksum"));
const sourceUrl = normalizeHttpsUrl(optionValue("--source-url"));
const sourceLabel = normalizeText(optionValue("--source-label"), 500);
const notes = normalizeText(optionValue("--notes"), 8000);
const reviewAfter = normalizeTimestamp(optionValue("--review-after"));
const apply = args.includes("--apply");

const blockers = [];
if (!UUID_PATTERN.test(briefId ?? "")) blockers.push("brief_id_must_be_a_uuid");
if (!UUID_PATTERN.test(reviewerId ?? "")) blockers.push("reviewer_id_must_be_a_uuid");
if (!rightsEvidenceId || rightsEvidenceId.length < 3 || rightsEvidenceId.length > 200 || /[\u0000-\u001f\u007f]/.test(rightsEvidenceId)) {
  blockers.push("rights_evidence_id_must_be_3_to_200_printable_characters");
}
if (!sourceChecksum) blockers.push("source_checksum_must_be_a_sha256_hex_digest");
if (optionValue("--source-url") && !sourceUrl) blockers.push("source_url_must_be_https");
if (optionValue("--source-label") && !sourceLabel) blockers.push("source_label_must_be_1_to_500_characters");
if (optionValue("--notes") && !notes) blockers.push("notes_must_be_1_to_8000_characters");
if (optionValue("--review-after") && !reviewAfter) blockers.push("review_after_must_be_a_valid_timestamp");
if (blockers.length) fail(blockers);

const reviewedAt = new Date().toISOString();
const itemKey = `rights:${sha256(rightsEvidenceId).slice(0, 32)}`;
const requestId = `rights-review:${briefId}:${sha256(rightsEvidenceId).slice(0, 16)}:${sourceChecksum}`;
const payload = {
  briefId,
  reviewerId,
  rightsEvidenceId,
  sourceChecksum: `sha256:${sourceChecksum}`,
  sourceUrl: sourceUrl ?? null,
  sourceLabel: sourceLabel ?? null,
  reviewAfter: reviewAfter ?? null,
  notes: notes ?? null,
  itemKey,
  requestId,
};

if (!apply) {
  console.log(JSON.stringify({
    status: "validated",
    action: "dry_run",
    payload,
    next: "Confirm the reviewer and source asset, then rerun with --apply to persist the rights decision.",
  }, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) fail(["supabase_service_role_not_configured"]);
const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });

const { data: applied, error: applyError } = await client.rpc("review_seo_rights", {
  p_brief_id: briefId,
  p_reviewer_id: reviewerId,
  p_rights_evidence_id: rightsEvidenceId,
  p_source_checksum: `sha256:${sourceChecksum}`,
  p_item_key: itemKey,
  p_request_id: requestId,
  p_source_url: sourceUrl,
  p_source_label: sourceLabel,
  p_review_after: reviewAfter,
  p_notes: notes,
  p_reviewed_at: reviewedAt,
});
if (applyError || !isRecord(applied)) {
  fail([`rights_review_transaction_failed:${applyError?.message ?? "missing_result"}`]);
}

console.log(JSON.stringify({
  status: "applied",
  ...applied,
  note: "Only the reviewer-attributed rights evidence, packet, topic evidence, and append-only audit event were changed in one transaction. No page was created or published and automation switches were not changed.",
}, null, 2));

function optionValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function normalizeText(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

function normalizeChecksum(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, "");
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function normalizeHttpsUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(values) {
  console.error(JSON.stringify({ status: "fail", blockers: values }, null, 2));
  process.exit(1);
}
