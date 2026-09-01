#!/usr/bin/env node

/**
 * Reconcile draft-local FAQ source keys with the persisted seo_sources UUIDs.
 *
 * This is intentionally dry-run by default. It is useful after the source-key
 * integrity migration for older pages that were ingested before FAQ citations
 * were resolved transactionally. It never changes page status or indexability.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const apply = process.argv.includes("--apply");
const projectRoot = process.cwd();
const draftsDirectory = path.join(projectRoot, ".seo-content-agent", "pilot");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !serviceKey) fail("supabase_service_role_not_configured");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
const draftFiles = (await readdir(draftsDirectory)).filter((file) => /^ECO\d+-.*-draft\.json$/.test(file)).sort();
const report = [];

for (const draftFile of draftFiles) {
  const draft = JSON.parse(await readFile(path.join(draftsDirectory, draftFile), "utf8"));
  const draftPath = normalizePath(String(draft.path ?? ""));
  const { data: page, error: pageError } = await supabase
    .from("seo_pages")
    .select("id,path,status,noindex,body")
    .eq("path", draftPath)
    .maybeSingle();
  if (pageError) fail(`page_lookup_failed:${draftFile}:${pageError.message}`);
  if (!page) {
    report.push({ draftFile, status: "missing_page" });
    continue;
  }

  const { data: sourceRows, error: sourceError } = await supabase
    .from("seo_sources")
    .select("id,url,source_key")
    .eq("page_id", page.id);
  if (sourceError) fail(`source_lookup_failed:${draftFile}:${sourceError.message}`);
  const persistedByUrl = new Map((sourceRows ?? []).map((source) => [String(source.url), source]));
  const keyToId = new Map();
  const sourceUpdates = [];
  for (const source of Array.isArray(draft.sources) ? draft.sources : []) {
    // Early pilot drafts stored the stable citation key in claimsSupported
    // instead of an explicit id. Accept that legacy shape only for this
    // one-time repair; all new drafts are required to provide id/sourceKey by
    // the shared validator and ingest wrapper.
    const key = String(source.id ?? source.sourceKey ?? (Array.isArray(source.claimsSupported) ? source.claimsSupported[0] : "") ?? "").trim();
    const row = persistedByUrl.get(String(source.url ?? ""));
    if (!key || !row) fail(`source_mapping_missing:${draftFile}:${key || source.url || "unknown"}`);
    if (keyToId.has(key)) fail(`source_key_duplicate:${draftFile}:${key}`);
    keyToId.set(key, String(row.id));
    if (String(row.source_key ?? "") !== key) sourceUpdates.push({ id: String(row.id), sourceKey: key });
  }

  const body = isRecord(page.body) ? page.body : {};
  const faqs = Array.isArray(body.faqs) ? body.faqs : [];
  const resolvedFaqs = faqs.map((faq) => {
    if (!isRecord(faq)) fail(`faq_invalid:${draftFile}`);
    const refs = Array.isArray(faq.evidenceSourceIds) ? faq.evidenceSourceIds : [];
    const resolved = refs.map((ref) => {
      const id = keyToId.get(String(ref).trim());
      if (!id) {
        // Already-repaired UUIDs are accepted when they point at one of this
        // page's persisted sources; arbitrary IDs remain a hard failure.
        const persisted = (sourceRows ?? []).some((source) => String(source.id) === String(ref).trim());
        if (persisted) return String(ref).trim();
        fail(`faq_source_unresolved:${draftFile}:${String(ref)}`);
      }
      return id;
    });
    return { ...faq, evidenceSourceIds: [...new Set(resolved)] };
  });
  const changed = JSON.stringify(faqs) !== JSON.stringify(resolvedFaqs) || sourceUpdates.length > 0;
  report.push({ draftFile, pageId: String(page.id), path: page.path, status: changed ? "needs_repair" : "healthy", faqCount: faqs.length, sourceUpdates: sourceUpdates.length });

  if (!apply || !changed) continue;
  for (const update of sourceUpdates) {
    const { error } = await supabase.from("seo_sources").update({ source_key: update.sourceKey }).eq("id", update.id).eq("page_id", page.id);
    if (error) fail(`source_key_update_failed:${draftFile}:${error.message}`);
  }
  const { error: bodyError } = await supabase.from("seo_pages").update({ body: { ...body, faqs: resolvedFaqs }, updated_at: new Date().toISOString() }).eq("id", page.id);
  if (bodyError) fail(`faq_body_update_failed:${draftFile}:${bodyError.message}`);
}

console.log(JSON.stringify({ status: "complete", apply, inspected: report.length, repaired: report.filter((row) => row.status === "needs_repair").length, report }, null, 2));

function normalizePath(value) {
  const trimmed = value.trim();
  return trimmed === "/" ? "/" : `/${trimmed.replace(/^\/+|\/+$/g, "")}/`;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message) {
  console.error(JSON.stringify({ status: "fail", error: message }, null, 2));
  process.exit(1);
}
