#!/usr/bin/env node

/**
 * Create the durable handoff from research to the writer queue.
 *
 * This is deliberately dry-run by default. It creates a topic, a content
 * brief, and empty versioned research/rights packets only with --apply; it
 * never creates a page or changes indexability.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { inspectSeoBriefAssets } from "./seo-brief-assets.mjs";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const inputPath = process.argv.slice(2).find((value) => !value.startsWith("-"));
const apply = process.argv.includes("--apply");
if (!inputPath) {
  console.error("Usage: pnpm seo:create-brief <brief.json> [--apply]");
  process.exit(2);
}

let input;
try {
  input = JSON.parse(await readFile(path.resolve(inputPath), "utf8"));
} catch (error) {
  fail(`brief_unreadable:${error instanceof Error ? error.message : "unknown_error"}`);
}

const brief = isRecord(input) ? input : {};
const blockers = [];
for (const [field, minimum] of [["briefKey", 8], ["productEntity", 2], ["primaryQuery", 2], ["intentKey", 10], ["buyerQuestion", 10]]) {
  if (!isNonEmpty(brief[field], minimum)) blockers.push(`${field}_missing_or_invalid`);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(brief.briefKey ?? ""))) blockers.push("briefKey_must_be_slug");
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(brief.intentKey ?? ""))) blockers.push("intentKey_must_be_slug");
const families = new Set(["product-hub", "category-hub", "listing", "lifestyle", "detail", "prompt", "tutorial", "feature"]);
if (!families.has(String(brief.pageFamily ?? ""))) blockers.push("pageFamily_invalid");
const demandEvidence = normalizeDemandEvidence(brief.demandEvidence, blockers);
if (demandEvidence.length < 3) blockers.push("demandEvidence_requires_at_least_three_distinct_https_sources");
if (blockers.length) fail(...blockers);

const assetPreflight = await inspectSeoBriefAssets(brief, { projectDirectory: process.cwd() });
if (!assetPreflight.valid) fail(...assetPreflight.blockers);

const payload = {
  briefKey: String(brief.briefKey),
  topic: {
    locale: typeof brief.locale === "string" && brief.locale.trim() ? brief.locale.trim() : "en",
    kind: brief.pageFamily === "tutorial" || brief.pageFamily === "feature" ? brief.pageFamily : brief.pageFamily === "category-hub" ? "category" : "product",
    name: String(brief.productEntity).slice(0, 160),
    slug: slugify(String(brief.productEntity)),
  },
  pageFamily: String(brief.pageFamily),
  productEntity: String(brief.productEntity),
  primaryQuery: String(brief.primaryQuery),
  normalizedIntentKey: slugify(String(brief.intentKey)),
  buyerQuestion: String(brief.buyerQuestion),
  demandEvidence,
  opportunityScore: integerOrNull(brief.opportunityScore),
  priority: Number.isInteger(brief.priority) ? Math.max(0, Math.min(100, brief.priority)) : 50,
  templateVersion: typeof brief.templateVersion === "string" && brief.templateVersion.trim() ? brief.templateVersion.trim() : "seo-v1",
  sourceAssetPath: typeof brief.sourceAssetPath === "string" && brief.sourceAssetPath.trim() ? brief.sourceAssetPath.trim() : null,
  rightsStatus: typeof brief.rightsStatus === "string" && brief.rightsStatus.trim() ? brief.rightsStatus.trim() : "unreviewed",
  sourceAssetManifest: assetPreflight.sourceAsset,
  brandManifest: assetPreflight.brandManifest,
  research: isRecord(brief.research) ? brief.research : {},
  constraints: Array.isArray(brief.constraints) ? brief.constraints.filter((value) => typeof value === "string").slice(0, 20) : [],
};

if (!apply) {
  console.log(JSON.stringify({ status: "validated", action: "dry_run", payload, assetPreflight, next: "rerun with --apply to create the research-to-writer handoff" }, null, 2));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) fail("supabase_service_role_not_configured");
const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });

const { data: handoff, error: handoffError } = await client.rpc("create_seo_brief_handoff", { p_payload: payload });
if (handoffError || !isRecord(handoff)) {
  fail(`brief_handoff_failed:${handoffError?.message ?? "invalid_rpc_response"}`);
}
const idempotent = handoff.idempotent === true;
console.log(JSON.stringify({
  status: idempotent ? "already_exists" : "created",
  briefId: handoff.briefId,
  briefKey: handoff.briefKey,
  state: handoff.status,
  idempotent,
  note: "No page was created or published. Add research/rights items and assign the writer next.",
}, null, 2));

function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isNonEmpty(value, minimum) { return typeof value === "string" && value.trim().length >= minimum; }
function slugify(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160); }
function integerOrNull(value) { return Number.isInteger(value) ? Math.max(0, Math.min(100, value)) : null; }
function normalizeDemandEvidence(value, blockers) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  value.forEach((item, index) => {
    if (!isRecord(item)) {
      blockers.push(`demandEvidence_${index + 1}_must_be_an_object`);
      return;
    }
    const rawUrl = typeof item.url === "string" ? item.url : typeof item.source === "string" ? item.source : "";
    const rawTitle = typeof item.title === "string" ? item.title : typeof item.label === "string" ? item.label : "";
    let parsed;
    try { parsed = new URL(rawUrl.trim()); } catch { parsed = null; }
    if (!parsed || parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.hash) {
      blockers.push(`demandEvidence_${index + 1}_must_be_a_public_https_url`);
      return;
    }
    const key = parsed.toString().replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) {
      blockers.push(`demandEvidence_${index + 1}_duplicates_another_source`);
      return;
    }
    if (rawTitle.trim().length < 2) {
      blockers.push(`demandEvidence_${index + 1}_title_missing`);
      return;
    }
    const rawAccessedAt = typeof item.accessedAt === "string" ? item.accessedAt : typeof item.accessed_at === "string" ? item.accessed_at : "";
    const rawClaim = typeof item.claimSupported === "string"
      ? item.claimSupported
      : typeof item.claim_supported === "string"
        ? item.claim_supported
        : typeof item.signal === "string"
          ? item.signal
          : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawAccessedAt.trim())) {
      blockers.push(`demandEvidence_${index + 1}_accessedAt_must_be_yyyy_mm_dd`);
      return;
    }
    if (rawClaim.trim().length < 10) {
      blockers.push(`demandEvidence_${index + 1}_claimSupported_missing`);
      return;
    }
    seen.add(key);
    normalized.push({
      ...item,
      url: parsed.toString(),
      title: rawTitle.trim().slice(0, 300),
      accessedAt: rawAccessedAt.trim(),
      claimSupported: rawClaim.trim().slice(0, 1_000),
    });
  });
  return normalized;
}
function fail(...values) { console.error(JSON.stringify({ status: "fail", blockers: values }, null, 2)); process.exit(1); }
