#!/usr/bin/env node

/**
 * Validate and optionally import a bounded keyword-evidence packet.
 *
 * This is a research handoff, not a publishing command. It accepts measured
 * provider rows (GSC/Bing/Planner) and qualitative research rows (SERP,
 * Reddit, YouTube, social, competitor, manual), computes a stable evidence
 * key, rejects ambiguous duplicates, and upserts only seo_keyword_evidence.
 * Dry-run is the default; --apply requires the Supabase service-role key.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const args = process.argv.slice(2).filter((value) => value !== "--");
const inputPath = args.find((value) => !value.startsWith("-"));
const apply = args.includes("--apply");
const MAX_ROWS = 5_000;
const ALLOWED_SOURCES = new Set(["gsc", "bing", "keyword_planner", "serp", "reddit", "youtube", "social", "competitor", "manual"]);
const QUALITATIVE_SOURCES = new Set(["serp", "reddit", "youtube", "social", "competitor", "manual"]);
const INVALID = Symbol("invalid");

if (args.includes("--help") || !inputPath) {
  console.log("Usage: pnpm seo:ingest-keyword-evidence <packet.json> [--apply]\n\nDry-run is the default. The packet must contain an array or { rows: [] }; --apply only upserts seo_keyword_evidence.");
  process.exit(inputPath ? 0 : 2);
}

let packet;
try {
  packet = JSON.parse(await readFile(path.resolve(inputPath), "utf8"));
} catch (error) {
  fail([`packet_unreadable:${error instanceof Error ? error.message : "unknown_error"}`]);
}

const rawRows = Array.isArray(packet) ? packet : packet && typeof packet === "object" && Array.isArray(packet.rows) ? packet.rows : null;
if (!rawRows) fail(["packet_rows_must_be_an_array"]);
if (rawRows.length === 0) fail(["packet_rows_must_not_be_empty"]);
if (rawRows.length > MAX_ROWS) fail([`packet_exceeds_${MAX_ROWS}_row_limit`]);

const rows = [];
const blockers = [];
const byEvidenceKey = new Map();
for (const [index, raw] of rawRows.entries()) {
  const result = normalizeRow(raw, index);
  if (!result.row) {
    blockers.push(...result.blockers);
    continue;
  }
  const previous = byEvidenceKey.get(result.row.evidence_key);
  if (previous) {
    if (stableFingerprint(previous) !== stableFingerprint(result.row)) {
      blockers.push(`row_${index}:duplicate_evidence_key_conflict:${result.row.evidence_key}`);
    }
    continue;
  }
  byEvidenceKey.set(result.row.evidence_key, result.row);
  rows.push(result.row);
}

if (blockers.length) fail(blockers);
const report = {
  status: apply ? "validated" : "validated",
  action: apply ? "apply_pending" : "dry_run",
  input: path.resolve(inputPath),
  rows: rawRows.length,
  uniqueRows: rows.length,
  sources: [...new Set(rows.map((row) => row.source))].sort(),
  evidenceKeys: rows.map((row) => row.evidence_key),
};

if (!apply) {
  console.log(JSON.stringify({ ...report, next: "rerun with --apply to upsert only seo_keyword_evidence" }, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !serviceKey) fail(["supabase_service_role_not_configured"]);
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });

for (let offset = 0; offset < rows.length; offset += 500) {
  const chunk = rows.slice(offset, offset + 500);
  const { error } = await supabase
    .from("seo_keyword_evidence")
    .upsert(chunk, { onConflict: "source,metric_date,query,canonical_url,country,device,search_type" });
  if (error) fail([`keyword_evidence_upsert_failed:${error.message}`]);
}

console.log(JSON.stringify({ ...report, status: "applied", action: "upserted", chunks: Math.ceil(rows.length / 500) }, null, 2));

function normalizeRow(raw, index) {
  const blockersForRow = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { blockers: [`row_${index}:must_be_an_object`] };
  const source = text(raw.source).toLowerCase();
  if (!ALLOWED_SOURCES.has(source)) blockersForRow.push(`row_${index}:unsupported_source`);
  const query = text(raw.query);
  if (!query || query.length > 500) blockersForRow.push(`row_${index}:query_required_and_must_be_1_to_500_chars`);
  const metricDate = normalizeDate(raw.metricDate ?? raw.metric_date);
  if (!metricDate) blockersForRow.push(`row_${index}:metric_date_must_be_yyyy_mm_dd`);
  const canonicalUrl = normalizeHttpsUrl(raw.canonicalUrl ?? raw.canonical_url, true);
  if (canonicalUrl === null) blockersForRow.push(`row_${index}:canonical_url_must_be_https_or_empty`);
  const country = boundedDimension(raw.country, "all");
  const device = boundedDimension(raw.device, "all");
  const searchType = boundedDimension(raw.searchType ?? raw.search_type, "web");
  if (!country || !device || !searchType) blockersForRow.push(`row_${index}:dimensions_must_be_1_to_32_chars`);
  const sourceUrlInput = raw.sourceUrl ?? raw.source_url;
  const sourceUrl = text(sourceUrlInput) ? normalizeHttpsUrl(sourceUrlInput, false) : "";
  if (text(sourceUrlInput) && sourceUrl === null) blockersForRow.push(`row_${index}:source_url_must_be_https`);
  const sourceTitle = text(raw.sourceTitle ?? raw.source_title) || null;
  if (sourceTitle && sourceTitle.length > 500) blockersForRow.push(`row_${index}:source_title_exceeds_500_chars`);
  if (QUALITATIVE_SOURCES.has(source) && !sourceUrl) blockersForRow.push(`row_${index}:qualitative_source_requires_https_source_url`);
  const metadata = raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata) ? raw.metadata : {};
  if (QUALITATIVE_SOURCES.has(source) && !text(metadata.signal) && !text(metadata.claimSupported)) {
    blockersForRow.push(`row_${index}:qualitative_source_requires_metadata_signal_or_claimSupported`);
  }
  const confidence = boundedInteger(raw.confidence, 100, 0, 100);
  const clicks = nonNegativeInteger(raw.clicks, 0);
  const impressions = nonNegativeInteger(raw.impressions, 0);
  const volume = nullableNonNegativeInteger(raw.volume);
  const competition = nullableRatio(raw.competition);
  const ctr = raw.ctr == null ? (impressions > 0 ? Math.min(1, clicks / impressions) : null) : nullableRatio(raw.ctr);
  const position = nullableNonNegativeNumber(raw.position);
  const pageId = optionalUuid(raw.pageId ?? raw.page_id);
  const topicId = optionalUuid(raw.topicId ?? raw.topic_id);
  const briefId = optionalUuid(raw.briefId ?? raw.brief_id);
  if ((text(raw.pageId ?? raw.page_id) && !pageId) || (text(raw.topicId ?? raw.topic_id) && !topicId) || (text(raw.briefId ?? raw.brief_id) && !briefId)) {
    blockersForRow.push(`row_${index}:page_topic_and_brief_ids_must_be_valid_uuids`);
  }
  const collectedAtInput = raw.collectedAt ?? raw.collected_at;
  const collectedAt = normalizeTimestamp(collectedAtInput);
  if (collectedAtInput != null && !collectedAt) blockersForRow.push(`row_${index}:collected_at_must_be_a_valid_timestamp`);
  if ([clicks, impressions, confidence].some((value) => value === null) || volume === INVALID || competition === INVALID || ctr === INVALID || position === INVALID) {
    blockersForRow.push(`row_${index}:metric_values_are_invalid`);
  }
  if (blockersForRow.length) return { blockers: blockersForRow };
  const evidenceKey = sha256([source, metricDate, query, canonicalUrl, country, device, searchType].join("\u001f"));
  const row = {
    page_id: pageId,
    topic_id: topicId,
    brief_id: briefId,
    source,
    query,
    canonical_url: canonicalUrl,
    metric_date: metricDate,
    country,
    device,
    search_type: searchType,
    clicks,
    impressions,
    ctr,
    position,
    volume,
    competition,
    source_url: sourceUrl,
    source_title: sourceTitle,
    confidence,
    evidence_key: evidenceKey,
    metadata: { ...metadata, metricLabel: text(metadata.metricLabel) || (source === "gsc" || source === "bing" ? "Measured" : "Qualitative") },
    collected_at: collectedAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return { row };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value) {
  const valueText = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return null;
  const parsed = Date.parse(`${valueText}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === valueText ? valueText : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeHttpsUrl(value, emptyAllowed) {
  const valueText = text(value);
  if (!valueText && emptyAllowed) return "";
  if (!valueText) return null;
  try {
    const url = new URL(valueText);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "") || "https://";
  } catch {
    return null;
  }
}

function boundedDimension(value, fallback) {
  const dimension = text(value) || fallback;
  return dimension.length >= 1 && dimension.length <= 32 ? dimension : null;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function nonNegativeInteger(value, fallback) {
  const parsed = boundedInteger(value, fallback, 0, Number.MAX_SAFE_INTEGER);
  return parsed;
}

function nullableNonNegativeInteger(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= Number.MAX_SAFE_INTEGER ? parsed : INVALID;
}

function nullableNonNegativeNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : INVALID;
}

function nullableRatio(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : INVALID;
}

function optionalUuid(value) {
  const valueText = text(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valueText) ? valueText : null;
}

function stableFingerprint(row) {
  const stable = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "collected_at" && key !== "updated_at"));
  return JSON.stringify(stable);
}

function sha256(value) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function fail(blockers) {
  console.error(JSON.stringify({ status: "blocked", blockers: blockers.slice(0, 100) }, null, 2));
  process.exit(1);
}
