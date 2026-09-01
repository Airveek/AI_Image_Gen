#!/usr/bin/env node

/**
 * Approve only Airveek-owned synthetic mock source fixtures.
 *
 * This is intentionally narrower than the normal rights-review command:
 * every source must be a local generic-*.png fixture under the repository's
 * content-reference directory. Real customer uploads, retailer assets,
 * third-party brands, and arbitrary paths are rejected. The selected active
 * SEO-admin is written as the reviewer so the normal immutable rights packet,
 * checksum, decision, topic mirror, and audit trail are still created.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const envFile of [".env.local", ".env"]) {
  try { process.loadEnvFile?.(envFile); } catch { /* optional */ }
}

const projectDirectory = path.resolve(process.cwd());
const mockRoot = "public/images/airveek/content-reference";
const args = process.argv.slice(2).filter((value) => value !== "--");
const apply = args.includes("--apply");
const limit = positiveInteger(optionValue("--limit"), Number.MAX_SAFE_INTEGER);

if (args.includes("--help")) {
  console.log("Usage: pnpm seo:approve-mock-briefs [--limit N] [--apply]\n\nDry-run is the default. Only local generic-*.png mock fixtures are eligible; no real or third-party asset can pass this command.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !serviceKey) fail(["supabase_service_role_not_configured"]);
const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });

const [{ data: briefs, error: briefError }, { data: reviewers, error: reviewerError }] = await Promise.all([
  client.from("seo_content_briefs")
    .select("id,brief_key,status,brief,product_entity")
    .not("status", "in", "(archived,merged)")
    .order("created_at", { ascending: true })
    .limit(Math.min(limit, 1_000)),
  client.from("content_members")
    .select("user_id,display_name,role,is_active")
    .eq("is_active", true)
    .eq("role", "seo_admin")
    .order("created_at", { ascending: true })
    .limit(10),
]);
if (briefError) fail([`brief_lookup_failed:${briefError.message}`]);
if (reviewerError) fail([`reviewer_lookup_failed:${reviewerError.message}`]);
const reviewer = reviewers?.[0];
if (!reviewer?.user_id) fail(["active_seo_admin_reviewer_missing"]);

const briefIds = (briefs ?? []).map((brief) => String(brief.id));
const { data: approvedPackets, error: packetError } = briefIds.length
  ? await client.from("seo_evidence_packets")
    .select("brief_id")
    .in("brief_id", briefIds)
    .eq("packet_type", "rights")
    .eq("status", "approved")
    .eq("rights_status", "approved")
  : { data: [], error: null };
if (packetError) fail([`rights_packet_lookup_failed:${packetError.message}`]);
const alreadyApproved = new Set((approvedPackets ?? []).map((packet) => String(packet.brief_id)));

const results = [];
for (const brief of briefs ?? []) {
  if (alreadyApproved.has(String(brief.id))) continue;
  const context = isRecord(brief.brief) ? brief.brief : {};
  const sourcePath = typeof context.sourceAssetPath === "string" ? context.sourceAssetPath.trim() : "";
  const normalizedSource = sourcePath.replaceAll("\\", "/");
  const eligible = normalizedSource.startsWith(`${mockRoot}/generic-`)
    && normalizedSource.endsWith(".png")
    && !normalizedSource.includes("..")
    && /^public\/images\/airveek\/content-reference\/generic-[a-z0-9-]+\.png$/.test(normalizedSource);
  if (!eligible) continue;
  const filePath = path.join(projectDirectory, normalizedSource);
  if (!existsSync(filePath)) {
    results.push({ briefId: brief.id, briefKey: brief.brief_key, status: "blocked", reason: "mock_source_missing", sourcePath: normalizedSource });
    continue;
  }
  const fileInfo = await stat(filePath);
  if (!fileInfo.isFile() || fileInfo.size < 1_024) {
    results.push({ briefId: brief.id, briefKey: brief.brief_key, status: "blocked", reason: "mock_source_invalid", sourcePath: normalizedSource });
    continue;
  }
  const checksum = `sha256:${createHash("sha256").update(await readFile(filePath)).digest("hex")}`;
  const evidenceId = `morrow-mock:${path.basename(normalizedSource, ".png")}`;
  const label = `MORROW fictional demo source — ${path.basename(normalizedSource)}`;
  const notes = "Owner-authorized Airveek synthetic mock fixture for the fictional MORROW demo brand. No third-party product identity, customer asset, retailer image, or real trademark is represented. The MORROW logo is a fictional supplied reference used only to demonstrate consistent product branding.";
  const requestId = `morrow-mock-rights:${brief.id}:${checksum}`;
  const itemKey = `rights:${sha256(evidenceId).slice(0, 32)}`;
  if (!apply) {
    results.push({ briefId: brief.id, briefKey: brief.brief_key, status: "validated", sourcePath: normalizedSource, checksum, evidenceId, reviewerId: reviewer.user_id });
    continue;
  }
  const { data, error } = await client.rpc("review_seo_rights", {
    p_brief_id: brief.id,
    p_reviewer_id: reviewer.user_id,
    p_rights_evidence_id: evidenceId,
    p_source_checksum: checksum,
    p_item_key: itemKey,
    p_request_id: requestId,
    p_source_url: null,
    p_source_label: label,
    p_review_after: null,
    p_notes: notes,
    p_reviewed_at: new Date().toISOString(),
  });
  results.push(error || !data
    ? { briefId: brief.id, briefKey: brief.brief_key, status: "failed", reason: error?.message ?? "rights_review_failed", sourcePath: normalizedSource }
    : { briefId: brief.id, briefKey: brief.brief_key, status: "approved", sourcePath: normalizedSource, checksum, evidenceId, reviewerId: reviewer.user_id });
}

const failed = results.filter((result) => result.status === "failed" || result.status === "blocked");
console.log(JSON.stringify({
  status: failed.length ? "partial" : "complete",
  action: apply ? "apply" : "dry_run",
  reviewer: { id: reviewer.user_id, name: reviewer.display_name ?? null, role: reviewer.role },
  selected: results.length,
  validated: results.filter((result) => result.status === "validated").length,
  approved: results.filter((result) => result.status === "approved").length,
  blocked: results.filter((result) => result.status === "blocked").length,
  failed: results.filter((result) => result.status === "failed").length,
  results,
  next: apply ? "Only synthetic mock rights packets changed; recording, media QA, editorial review, and publishing remain separate gates." : "Review the eligible mock list, then rerun with --apply to persist the guarded approvals.",
}, null, 2));
if (failed.length) process.exit(1);

function optionValue(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1] ?? null;
  const inline = args.find((value) => value.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(blockers) {
  console.error(JSON.stringify({ status: "fail", blockers }, null, 2));
  process.exit(1);
}
