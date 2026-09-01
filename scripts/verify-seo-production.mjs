#!/usr/bin/env node

/**
 * Read-only production readiness check for the SEO control plane.
 *
 * This command never writes to Supabase, Vercel, or the public site. It is
 * intentionally useful before and after a migration so an operator can see
 * exactly which boundary is still incomplete without inspecting raw rows.
 */
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

try { process.loadEnvFile?.(".env.local"); } catch { /* optional */ }
try { process.loadEnvFile?.(".env"); } catch { /* optional */ }

const checks = [];
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://airveek.com").replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
let databaseAutomationEnabled = false;
let databaseEvidenceGatesEnabled = false;

if (!supabaseUrl || !secretKey) {
  checks.push({ name: "supabase_credentials", status: "fail", detail: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required." });
} else {
  const client = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  const baselineTables = [
    "seo_topics", "seo_pages", "seo_generation_runs", "seo_assets", "seo_sources", "seo_link_edges",
    "seo_url_state", "seo_events", "seo_web_vitals", "seo_page_probes", "seo_job_runs", "seo_alerts", "seo_automation_config",
    "seo_recommendations",
    "seo_keyword_evidence",
    "seo_import_watermarks", "user_events", "user_profiles", "whop_transaction_facts",
  ];
  const operationTables = [
    "seo_content_briefs", "seo_evidence_packets", "seo_evidence_items", "seo_content_assignments",
    "seo_review_decisions", "seo_content_audit_events", "seo_agent_runs",
  ];

  const probeColumns = new Map([
    ["seo_import_watermarks", "source"],
    ["user_profiles", "user_id"],
  ]);
  await Promise.all(baselineTables.map((table) => probeTable(client, table, "baseline", probeColumns.get(table) ?? "id")));
  await Promise.all(operationTables.map((table) => probeTable(client, table, "content_operations")));
  await probeColumn(client, "seo_topics", "rights_evidence", "rights_guards");
  await probeColumn(client, "seo_pages", "intent_collision_status", "intent_collision_guards");
  await probeColumn(client, "seo_agent_runs", "next_attempt_at", "content_operations.agent_retry_state");
  await probeOperationsSummary(client);
  await probeRpc(client, "check_seo_intent_collision", "intent_collision_guards.rpc", {
    p_normalized_intent_key: "production-readiness-probe",
    p_locale: "en",
    p_product_slug: "production-readiness-probe",
    p_embedding: null,
    p_exclude_page_id: null,
  });
  await probeRpc(client, "recover_seo_agent_run", "content_operations.agent_recovery", {
    p_run_id: "00000000-0000-4000-8000-000000000000",
    p_expected_status: "sent",
    p_cutoff: new Date().toISOString(),
    p_requeue: true,
  });
  await probeRpc(client, "get_seo_web_vitals_summary", "baseline.seo_web_vitals_health", { since_date: new Date().toISOString().slice(0, 10) });
  await probeRpc(client, "get_seo_attribution_summary", "baseline.seo_attribution_summary", { since_date: new Date().toISOString().slice(0, 10) });
  await probeRpc(client, "get_seo_recommendation_summary", "baseline.seo_recommendation_summary", { since_date: new Date().toISOString().slice(0, 10) });
  await probeKeywordEvidenceSummary(client);
  await probeRecommendationLifecycle(client);
  await probeRpc(client, "get_seo_sitemap_shard_index", "baseline.seo_sitemap_shard_index", { p_shard_size: 2_000 });
  await probeRpc(client, "get_seo_sitemap_shard", "baseline.seo_sitemap_shard", {
    p_family: "listing-images",
    p_month: new Date().toISOString().slice(0, 7),
    p_shard_index: 1,
    p_shard_size: 2_000,
  });
  await probeAssignmentHandoff(client);
  await probeReviewHandoff(client);
  await probeRightsReview(client);

  const { data: config, error: configError } = await client
    .from("seo_automation_config")
    .select("id,enabled,reader_first_mode,evidence_gates_enabled,crawl_enabled,source_sync_enabled,recommendations_enabled,alert_webhook_enabled,daily_publish_limit,daily_publish_wave_size,gsc_inspection_daily_budget,updated_at")
    .limit(1)
    .maybeSingle();
  checks.push(configError
    ? { name: "automation_config", status: "fail", detail: configError.message }
    : { name: "automation_config", status: config ? "pass" : "warn", detail: config ? "Configuration row is readable." : "No automation configuration row was found.", config: redactConfig(config) });
  databaseAutomationEnabled = config?.enabled === true;
  databaseEvidenceGatesEnabled = config?.evidence_gates_enabled === true;
  checks.push({
    name: "reader_first_mode",
    status: configError ? "warn" : config?.reader_first_mode === true && !databaseEvidenceGatesEnabled ? "pass" : "warn",
    detail: configError
      ? "Unable to read reader-first configuration."
      : databaseEvidenceGatesEnabled
        ? "Evidence gates are enabled; reader-first publishing is paused by configuration."
        : "Reader-first publishing mode is active; rights/evidence gates are optional.",
  });
  await probeContentMembership(client, Boolean(config?.enabled) && process.env.SEO_AUTOMATION_ENABLED === "true");
  await probePilotContentReadiness(client, Boolean(config?.enabled) && process.env.SEO_AUTOMATION_ENABLED === "true");
}

for (const [name, value] of [
  ["canonical_site_url", /^https:\/\/airveek\.com$/.test(siteUrl)],
  ["gsc_site_url", Boolean(process.env.GSC_SITE_URL?.trim())],
  ["ga4_property_id", Boolean(process.env.GA4_PROPERTY_ID?.trim())],
  ["ga4_measurement_protocol_secret", Boolean(process.env.GA4_MEASUREMENT_PROTOCOL_SECRET?.trim())],
  ["google_service_account", Boolean(process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64?.trim())],
  ["inngest_event_key", Boolean(process.env.INNGEST_EVENT_KEY?.trim())],
  ["inngest_signing_key", Boolean(process.env.INNGEST_SIGNING_KEY?.trim())],
  ["bing_site_url", Boolean(process.env.BING_SITE_URL?.trim())],
  ["bing_stats_endpoint", isSupportedBingStatsEndpoint(process.env.BING_WEBMASTER_STATS_ENDPOINT)],
  ["indexnow_key", Boolean(process.env.INDEXNOW_KEY?.trim() && process.env.INDEXNOW_KEY_LOCATION?.trim())],
  ["attribution_signing_secret", Boolean(process.env.SEO_ATTRIBUTION_SIGNING_SECRET?.trim())],
]) {
  checks.push({ name, status: value ? "pass" : "warn", detail: value ? "Configured." : "Missing or blank." });
}

const contentAgentConfigured = Boolean(
  process.env.SEO_CONTENT_AGENT_WEBHOOK_URL?.trim()
  && process.env.SEO_CONTENT_AGENT_SIGNING_SECRET?.trim(),
);
const localAgentOnly = process.env.SEO_CONTENT_AGENT_LOCAL_ONLY?.trim().toLowerCase() === "true";
const automationEnabled = databaseAutomationEnabled && process.env.SEO_AUTOMATION_ENABLED === "true";
checks.push({
  name: "content_agent_dispatch",
  status: contentAgentConfigured || localAgentOnly || !automationEnabled ? "pass" : "fail",
  detail: localAgentOnly
    ? "Local Codex content-agent mode is enabled; hosted signed dispatch is intentionally disabled."
    : contentAgentConfigured
    ? "Signed content-agent dispatch is configured."
    : automationEnabled
      ? "Automation is enabled but the signed content-agent webhook is missing; no briefs can be processed safely."
      : "Optional while automation is disabled; configure the signed agent webhook before enabling long-running content production.",
});

await probeGoogleAnalyticsAccess();
await probeBigQueryExportAccess();
await probeGoogleSearchConsoleAccess();
await probeBingReportingAccess();

await probeCanonicalRedirects(siteUrl);
await Promise.all(["/robots.txt", "/sitemap.xml", "/sitemaps/static.xml"].map((pathname) => probePublicUrl(`${siteUrl}${pathname}`, pathname)));
await probeRobotsHeaderMatrix(siteUrl);
await probeIndexNowKeyLocation();

const failures = checks.filter((check) => check.status === "fail");
const warnings = checks.filter((check) => check.status === "warn");
const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  status: failures.length ? "fail" : warnings.length ? "warn" : "pass",
  summary: { checks: checks.length, failures: failures.length, warnings: warnings.length },
  checks,
  next: failures.some((check) => check.name.startsWith("robots."))
    ? "Deploy the current build and purge or revalidate the Vercel cache; private routes and query-string variants must emit X-Robots-Tag: noindex with private, no-store caching while the canonical public URL remains indexable."
    : failures.some((check) => check.name === "ga4_property_access")
    ? "Grant the SEO service account Viewer (or Analyst) access to the GA4 property, then rerun this check."
    : failures.some((check) => check.name === "gsc_property_access")
      ? "Grant the SEO service account Owner or Full access to the Search Console property, then rerun this check."
    : warnings.some((check) => check.name === "gsc_sitemap_submission")
      ? "Submit https://airveek.com/sitemap.xml in Search Console or allow the sitemap heartbeat to submit it."
    : failures.some((check) => check.name.startsWith("canonical."))
      ? "Deploy the canonical-origin redirect and ensure Vercel does not override https://www.airveek.com with a temporary redirect."
    : failures.some((check) => check.name === "content_operations" || check.name === "rights_guards" || check.name.startsWith("content_operations."))
      ? "Apply and verify the ordered SEO migrations through 202608310012 before enabling SEO automation."
      : warnings.some((check) => check.name === "pilot_content_readiness")
        ? "Complete the reader-first pilot gates in order while automation stays off: add an active writer, create a structured draft with useful product guidance, and review the first template pages before assigning any publish wave."
      : failures.some((check) => check.name === "content_members_readiness") || warnings.some((check) => check.name === "content_members_readiness")
        ? "Create at least one active writer and one active publisher or SEO-admin content member before enabling SEO automation."
      : warnings.some((check) => check.name === "bing_stats_endpoint")
        ? "Configure BING_WEBMASTER_STATS_ENDPOINT with Microsoft's supported REST reporting endpoint before enabling Bing imports."
    : failures.some((check) => check.name === "content_agent_dispatch") || warnings.some((check) => check.name === "content_agent_dispatch")
          ? "Configure SEO_CONTENT_AGENT_WEBHOOK_URL and SEO_CONTENT_AGENT_SIGNING_SECRET before enabling content production."
        : failures.some((check) => check.name === "bing_reporting_access")
          ? "Verify the Bing Webmaster JSON/HTTP GetPageStats endpoint and API key before enabling Bing imports."
        : automationEnabled && !databaseEvidenceGatesEnabled
          ? "Reader-first mode is active. Resolve any remaining provider warnings, then let the worker continue creating review-only drafts; publishing still depends on the technical/content gate and template rollout policy."
          : "Keep the kill switch off until the reviewed pilot and provider readbacks pass.",
};
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);

async function probeTable(client, table, group, probeColumn = "id") {
  // Select a concrete column so PostgREST must resolve the table in its
  // schema cache; `select('*', { head: true })` can otherwise hide a missing
  // table behind an empty HEAD response.
  const { error } = await client.from(table).select(probeColumn).limit(0);
  checks.push({ name: `${group}.${table}`, status: error ? "fail" : "pass", detail: error ? error.message : "Table is available." });
}

async function probeColumn(client, table, column, group) {
  const { error } = await client.from(table).select(column).limit(0);
  checks.push({ name: group, status: error ? "fail" : "pass", detail: error ? error.message : `${table}.${column} is available.` });
}

async function probeRpc(client, functionName, group, params = {}) {
  const { error } = await client.rpc(functionName, params);
  checks.push({ name: group, status: error ? "fail" : "pass", detail: error ? error.message : `${functionName} is callable.` });
}

async function probeRecommendationLifecycle(client) {
  // An unknown recommendation must fail before any write. This proves the
  // review-only lifecycle RPC is deployed without mutating production rows.
  const { data, error } = await client.rpc("update_seo_recommendation_status", {
    p_recommendation_id: "00000000-0000-4000-8000-000000000000",
    p_status: "acknowledged",
    p_resolution_note: null,
    p_assigned_to: null,
  });
  const expected = Boolean(error && error.code === "P0001" && /recommendation not found/i.test(error.message));
  checks.push({
    name: "baseline.seo_recommendation_lifecycle",
    status: expected ? "pass" : "fail",
    detail: expected
      ? "Review-only recommendation lifecycle RPC is deployed and rejects an unknown id before writing."
      : `Unexpected recommendation lifecycle response: ${error?.message ?? `data=${JSON.stringify(data)}`}.`,
  });
}

async function probeAssignmentHandoff(client) {
  // The RPC is intentionally called with a non-existent brief. A P0001
  // "brief not found" response proves the function is deployed and that its
  // validation runs before any assignment write; this probe never mutates
  // production rows.
  const { data, error } = await client.rpc("assign_seo_brief", {
    p_brief_id: "00000000-0000-4000-8000-000000000000",
    p_assignee_id: "00000000-0000-4000-8000-000000000001",
    p_assignment_role: "writer",
    p_priority: 50,
    p_due_at: null,
    p_notes: null,
    p_assigned_by: null,
  });
  const expected = Boolean(error && error.code === "P0001" && /brief not found/i.test(error.message));
  checks.push({
    name: "content_operations.assignment_handoff",
    status: expected ? "pass" : "fail",
    detail: expected
      ? "Atomic assignment RPC is deployed and rejects an unknown brief before writing."
      : `Unexpected assignment RPC response: ${error?.message ?? `data=${JSON.stringify(data)}`}.`,
  });
}

async function probeReviewHandoff(client) {
  // As with the assignment probe, use an unknown brief so the transaction
  // exits before any decision or status write. This confirms the atomic review
  // RPC is deployed without touching production data.
  const { data, error } = await client.rpc("record_seo_review_decision", {
    p_brief_id: "00000000-0000-4000-8000-000000000000",
    p_page_id: null,
    p_packet_id: null,
    p_review_type: "draft",
    p_decision: "changes_requested",
    p_content_version: "probe",
    p_reviewer_id: "00000000-0000-4000-8000-000000000001",
    p_score: null,
    p_checklist: {},
    p_blockers: [],
    p_notes: null,
  });
  const expected = Boolean(error && error.code === "P0001" && /brief not found/i.test(error.message));
  checks.push({
    name: "content_operations.review_handoff",
    status: expected ? "pass" : "fail",
    detail: expected
      ? "Atomic review RPC is deployed and rejects an unknown brief before writing."
      : `Unexpected review RPC response: ${error?.message ?? `data=${JSON.stringify(data)}`}.`,
  });
}

async function probeRightsReview(client) {
  // The rights RPC is also probed with an unknown brief. All arguments pass
  // local validation, then the transaction exits before inserting any item or
  // approval record.
  const { data, error } = await client.rpc("review_seo_rights", {
    p_brief_id: "00000000-0000-4000-8000-000000000000",
    p_reviewer_id: "00000000-0000-4000-8000-000000000001",
    p_rights_evidence_id: "production-readiness-source",
    p_source_checksum: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    p_item_key: "rights:0123456789abcdef0123456789abcdef",
    p_request_id: "production-readiness-rights-probe",
    p_source_url: null,
    p_source_label: null,
    p_review_after: null,
    p_notes: null,
    p_reviewed_at: new Date().toISOString(),
  });
  const expected = Boolean(error && error.code === "P0001" && /brief not found/i.test(error.message));
  checks.push({
    name: "content_operations.rights_review",
    status: expected ? "pass" : "fail",
    detail: expected
      ? "Atomic rights-review RPC is deployed and rejects an unknown brief before writing."
      : `Unexpected rights-review RPC response: ${error?.message ?? `data=${JSON.stringify(data)}`}.`,
  });
}

async function probeOperationsSummary(client) {
  const { data, error } = await client.rpc("get_seo_operations_summary");
  if (error) {
    checks.push({ name: "content_operations", status: "fail", detail: error.message });
    return;
  }
  const requiredFields = ["briefsByStatus", "agentRunsByStatus", "activeAgentRuns", "expiredAgentRuns", "failedAgentRuns"];
  const missing = requiredFields.filter((field) => !data || typeof data !== "object" || !(field in data));
  checks.push({
    name: "content_operations",
    status: missing.length ? "fail" : "pass",
    detail: missing.length ? `Operations summary is missing: ${missing.join(", ")}.` : "Aggregate operations summary is callable with agent-run health fields.",
  });
}

async function probeKeywordEvidenceSummary(client) {
  const { data, error } = await client.rpc("get_seo_keyword_evidence_summary", {
    since_date: new Date().toISOString().slice(0, 10),
  });
  const requiredFields = ["totalRows", "measuredRows", "qualitativeRows", "linkedRows", "sources"];
  const missing = requiredFields.filter((field) => !data || typeof data !== "object" || !(field in data));
  checks.push({
    name: "baseline.seo_keyword_evidence_summary",
    status: error || missing.length ? "fail" : "pass",
    detail: error ? error.message : missing.length ? `Keyword evidence summary is missing: ${missing.join(", ")}.` : "Keyword evidence aggregate is callable.",
  });
}

async function probeContentMembership(client, automationEnabled) {
  const { data, error } = await client
    .from("content_members")
    .select("role")
    .eq("is_active", true)
    .in("role", ["writer", "publisher", "seo_admin"]);
  if (error) {
    checks.push({ name: "content_members_readiness", status: "fail", detail: error.message });
    return;
  }
  const counts = { writer: 0, publisher: 0, seo_admin: 0 };
  for (const row of data ?? []) {
    if (row.role === "writer" || row.role === "publisher" || row.role === "seo_admin") counts[row.role] += 1;
  }
  const ready = counts.writer > 0 && counts.publisher + counts.seo_admin > 0;
  checks.push({
    name: "content_members_readiness",
    status: ready ? "pass" : automationEnabled ? "fail" : "warn",
    detail: ready
      ? "At least one active writer and publisher/SEO-admin are configured."
      : "No active writer and publisher/SEO-admin pair is configured; automated production cannot claim or publish work.",
    counts,
  });
}

async function probePilotContentReadiness(client, automationEnabled) {
  // Keep this aggregate bounded: counts are computed by PostgREST/Postgres
  // rather than loading years of briefs, packets, or generation rows into the
  // verifier process. A deployment can be technically healthy while still
  // having no evidence-backed pilot work available to the agent.
  const [briefsResult, rightsResult, generationResult, writerResult, approvedPagesResult, livePagesResult] = await Promise.all([
    client.from("seo_content_briefs")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(archived,merged)"),
    client.from("seo_evidence_packets")
      .select("id", { count: "exact", head: true })
      .eq("packet_type", "rights")
      .eq("status", "approved")
      .eq("rights_status", "approved"),
    client.from("seo_generation_runs")
      .select("id", { count: "exact", head: true })
      .eq("qa_status", "pass"),
    client.from("content_members")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "writer")
      .eq("is_active", true),
    client.from("seo_pages")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    client.from("seo_pages")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .eq("noindex", false),
  ]);
  const failed = [briefsResult, rightsResult, generationResult, writerResult, approvedPagesResult, livePagesResult]
    .find((result) => result.error);
  if (failed?.error) {
    checks.push({ name: "pilot_content_readiness", status: "fail", detail: failed.error.message });
    return;
  }
  const counts = {
    briefs: briefsResult.count ?? 0,
    approvedRightsPackets: rightsResult.count ?? 0,
    passingGenerationRuns: generationResult.count ?? 0,
    activeWriters: writerResult.count ?? 0,
    approvedPages: approvedPagesResult.count ?? 0,
    livePages: livePagesResult.count ?? 0,
  };
  const missing = [
    counts.briefs === 0 ? "brief_queue" : null,
    counts.approvedRightsPackets === 0 ? "approved_rights_packet" : null,
    counts.passingGenerationRuns === 0 ? "passing_generation_evidence" : null,
    counts.activeWriters === 0 ? "active_writer" : null,
  ].filter(Boolean);
  const ready = missing.length === 0;
  checks.push({
    name: "pilot_content_readiness",
    status: ready ? "pass" : automationEnabled ? "fail" : "warn",
    detail: ready
      ? "An evidence-backed brief queue, rights approval, passing generation evidence, and active writer are available for the pilot."
      : `Pilot content prerequisites are missing: ${missing.join(", ")}.`,
    counts,
  });
}

async function probePublicUrl(url, name) {
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    checks.push({ name: `public.${name}`, status: response.status === 200 ? "pass" : "fail", detail: `HTTP ${response.status}.` });
  } catch (error) {
    checks.push({ name: `public.${name}`, status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}

async function probeRobotsHeaderMatrix(canonicalUrl) {
  const probes = [
    { name: "robots.private_login", url: `${canonicalUrl}/login`, requireNoindex: true, requireNoStore: true },
    { name: "robots.private_api", url: `${canonicalUrl}/api/seo/event`, requireNoindex: true, requireNoStore: true },
    { name: "robots.query_filter", url: `${canonicalUrl}/use-cases?sort=popular`, requireNoindex: true, requireNoStore: true },
    { name: "robots.query_attribution", url: `${canonicalUrl}/product-photography?utm_source=seo-verifier`, requireNoindex: true, requireNoStore: true },
    { name: "robots.canonical_public", url: `${canonicalUrl}/product-photography`, requireNoindex: false, requireNoStore: false },
  ];
  await Promise.all(probes.map(async ({ name, url, requireNoindex, requireNoStore }) => {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
      const robots = (response.headers.get("x-robots-tag") ?? "").toLowerCase();
      const cacheControl = (response.headers.get("cache-control") ?? "").toLowerCase();
      const hasNoindex = robots.includes("noindex");
      const hasPrivateNoStore = cacheControl.includes("private") && cacheControl.includes("no-store");
      const validStatus = response.status >= 200 && response.status < 500;
      const valid = validStatus
        && (requireNoindex ? hasNoindex : !hasNoindex)
        && (!requireNoStore || hasPrivateNoStore);
      checks.push({
        name,
        status: valid ? "pass" : "fail",
        detail: valid
          ? `${requireNoindex ? "Non-indexable" : "Indexable"} response contract is present (HTTP ${response.status}).`
          : `Expected HTTP 2xx–4xx with ${requireNoindex ? "an X-Robots-Tag containing noindex" : "no noindex X-Robots-Tag"}${requireNoStore ? " and private no-store caching" : ""}; received HTTP ${response.status}, ${robots || "no X-Robots-Tag"}, ${cacheControl || "no Cache-Control"}.`,
      });
    } catch (error) {
      checks.push({ name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
    }
  }));
}

async function probeIndexNowKeyLocation() {
  const key = process.env.INDEXNOW_KEY?.trim();
  const location = process.env.INDEXNOW_KEY_LOCATION?.trim();
  if (!key || !location) return;
  try {
    const response = await fetch(location, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const body = (await response.text()).trim();
    const valid = response.status === 200 && body === key;
    checks.push({
      name: "indexnow_key_location",
      status: valid ? "pass" : "fail",
      detail: valid
        ? "Public IndexNow key file is reachable and matches the configured key."
        : `Expected HTTP 200 with the configured key; received HTTP ${response.status} and ${body.length} body characters.`,
    });
  } catch (error) {
    checks.push({
      name: "indexnow_key_location",
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function probeCanonicalRedirects(canonicalUrl) {
  try {
    const canonical = new URL(canonicalUrl);
    const apexHost = canonical.hostname.replace(/^www\./i, "");
    const variants = [
      { name: "canonical.http_redirect", url: new URL(`${canonical.pathname}${canonical.search}`, `http://${canonical.host}`).toString() },
      { name: "canonical.www_redirect", url: new URL(`${canonical.pathname}${canonical.search}`, `https://www.${apexHost}`).toString() },
    ];
    await Promise.all(variants.map(async ({ name, url }) => {
      try {
        const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
        const location = response.headers.get("location");
        let targetUrl = null;
        try { targetUrl = location ? new URL(location, url) : null; } catch { /* malformed location is reported below */ }
        const expectedUrl = new URL(url);
        const valid = response.status === 308
          && Boolean(targetUrl)
          && targetUrl.origin === canonical.origin
          && targetUrl.pathname === expectedUrl.pathname
          && targetUrl.search === expectedUrl.search;
        checks.push({
          name,
          status: valid ? "pass" : "fail",
          detail: valid ? "Permanent redirect to the canonical HTTPS origin." : `Expected HTTP 308 to ${canonical.origin} with the same path/query; received HTTP ${response.status}${targetUrl ? ` to ${targetUrl.toString()}` : " without a valid Location header"}.`,
        });
      } catch (error) {
        checks.push({ name, status: "fail", detail: error instanceof Error ? error.message : String(error) });
      }
    }));
  } catch (error) {
    checks.push({ name: "canonical.redirects", status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}

function redactConfig(config) {
  if (!config) return null;
  return {
    enabled: Boolean(config.enabled),
    readerFirstMode: Boolean(config.reader_first_mode),
    evidenceGatesEnabled: Boolean(config.evidence_gates_enabled),
    crawlEnabled: Boolean(config.crawl_enabled),
    sourceSyncEnabled: Boolean(config.source_sync_enabled),
    recommendationsEnabled: Boolean(config.recommendations_enabled),
    alertWebhookEnabled: Boolean(config.alert_webhook_enabled),
    dailyPublishLimit: config.daily_publish_limit ?? null,
    dailyPublishWaveSize: config.daily_publish_wave_size ?? null,
    inspectionBudget: config.gsc_inspection_daily_budget ?? null,
    updatedAt: config.updated_at ?? null,
  };
}

function isSupportedBingStatsEndpoint(value) {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return ["ssl.bing.com", "www.bing.com"].includes(url.hostname.toLowerCase())
      && url.pathname === "/webmaster/api.svc/json/GetPageStats";
  } catch {
    return false;
  }
}

async function probeGoogleAnalyticsAccess() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const encoded = process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!propertyId || !encoded) return;
  try {
    const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (typeof credentials.client_email !== "string" || typeof credentials.private_key !== "string") {
      checks.push({ name: "ga4_property_access", status: "fail", detail: "Service-account JSON is missing client_email or private_key." });
      return;
    }
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
    const analytics = google.analyticsdata({ version: "v1beta", auth });
    await analytics.properties.runReport({
      property: propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        limit: "1",
      },
    });
    checks.push({ name: "ga4_property_access", status: "pass", detail: "Service account can read the GA4 property." });
  } catch (error) {
    const statusCode = error && typeof error === "object" && "response" in error
      ? Number(error.response?.status ?? 0)
      : 0;
    checks.push({
      name: "ga4_property_access",
      status: statusCode === 403 ? "fail" : "warn",
      detail: statusCode === 403
        ? "Service account cannot read this GA4 property; grant it Viewer (or Analyst) access in GA4 Admin."
        : `GA4 access probe failed${statusCode ? ` with HTTP ${statusCode}` : ""}.`,
    });
  }
}

async function probeBigQueryExportAccess() {
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const propertyId = process.env.GA4_PROPERTY_ID?.trim().replace(/^properties\//, "");
  const encoded = process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  const configuredDataset = process.env.GA4_BIGQUERY_DATASET?.trim();
  if (!projectId || !propertyId || !encoded) {
    checks.push({
      name: "ga4_bigquery_export",
      status: "warn",
      detail: "GCP_PROJECT_ID, GA4_PROPERTY_ID, and the Google service account are required to verify the GA4 BigQuery export; the GA4 Data API remains the fallback.",
    });
    return;
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    checks.push({ name: "ga4_bigquery_export", status: "fail", detail: "Service-account JSON could not be decoded." });
    return;
  }
  if (typeof credentials.client_email !== "string" || typeof credentials.private_key !== "string") {
    checks.push({ name: "ga4_bigquery_export", status: "fail", detail: "Service-account JSON is missing client_email or private_key." });
    return;
  }

  const datasetReference = resolveBigQueryDatasetReference(configuredDataset, projectId, propertyId);
  if (!datasetReference) {
    checks.push({ name: "ga4_bigquery_export", status: "warn", detail: "GA4_BIGQUERY_DATASET is not a valid project.dataset reference and the standard analytics_<property-id> dataset could not be derived." });
    return;
  }
  const linkProbe = await probeGa4BigQueryLink(credentials, propertyId);
  checks.push(linkProbe.check);
  try {
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/bigquery.readonly"] });
    const bigquery = google.bigquery({ version: "v2", auth });
    const response = await bigquery.datasets.get({ projectId: datasetReference.projectId, datasetId: datasetReference.datasetId });
    checks.push({
      name: "ga4_bigquery_export",
      status: "pass",
      detail: `GA4 export dataset is readable (${datasetReference.projectId}.${datasetReference.datasetId}${response.data.location ? `, ${response.data.location}` : ""}).`,
    });
  } catch (error) {
    const statusCode = error && typeof error === "object" && "response" in error
      ? Number(error.response?.status ?? 0)
      : 0;
    checks.push({
      name: "ga4_bigquery_export",
      status: "warn",
      detail: statusCode === 404
        ? linkProbe.enabled
          ? `GA4 BigQuery link is enabled, but dataset ${datasetReference.projectId}.${datasetReference.datasetId} is not visible yet; the first export may still be provisioning. The GA4 Data API remains the fallback.`
          : `GA4 export dataset ${datasetReference.projectId}.${datasetReference.datasetId} is not visible yet; export provisioning may still be pending. The GA4 Data API remains the fallback.`
        : `GA4 BigQuery dataset probe failed${statusCode ? ` with HTTP ${statusCode}` : ""}; the GA4 Data API remains the fallback.`,
    });
  }
}

async function probeGa4BigQueryLink(credentials, propertyId) {
  try {
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });
    const token = await auth.getAccessToken();
    const accessToken = typeof token === "string" ? token : token?.token;
    if (!accessToken) throw new Error("Analytics Admin API did not return an access token.");
    const response = await fetch(`https://analyticsadmin.googleapis.com/v1alpha/properties/${encodeURIComponent(propertyId)}/bigQueryLinks`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const text = (await response.text()).slice(0, 8_000);
    let payload = {};
    try {
      const parsed = JSON.parse(text);
      if (isRecord(parsed)) payload = parsed;
    } catch {
      // Keep the bounded HTTP status below; never include a token or raw body.
    }
    if (!response.ok) throw new Error(`Analytics Admin API returned HTTP ${response.status}.`);
    const links = Array.isArray(payload.bigqueryLinks) ? payload.bigqueryLinks : [];
    const enabled = links.some((link) => isRecord(link) && link.dailyExportEnabled === true);
    return {
      enabled,
      check: {
        name: "ga4_bigquery_link",
        status: enabled ? "pass" : "warn",
        detail: enabled
          ? "GA4 has an enabled daily BigQuery export link; the dataset may still be awaiting its first export."
          : "No enabled daily GA4 BigQuery export link was found for this property.",
      },
    };
  } catch (error) {
    return {
      enabled: false,
      check: {
        name: "ga4_bigquery_link",
        status: "warn",
        detail: error instanceof Error && error.message.includes("HTTP 403")
          ? "The Analytics Admin API denied the BigQuery-link probe; grant the service account Analytics Viewer access and enable the Analytics Admin API."
          : "The GA4 BigQuery-link probe could not be completed; the dataset check and GA4 Data API fallback remain active.",
      },
    };
  }
}

function resolveBigQueryDatasetReference(value, defaultProjectId, propertyId) {
  const raw = value || `analytics_${propertyId}`;
  const parts = raw.split(".").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    if (!/^[a-zA-Z0-9_]+$/.test(parts[0])) return null;
    return { projectId: defaultProjectId, datasetId: parts[0] };
  }
  if (parts.length !== 2 || !/^[a-zA-Z0-9_-]+$/.test(parts[0]) || !/^[a-zA-Z0-9_]+$/.test(parts[1])) return null;
  return { projectId: parts[0], datasetId: parts[1] };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function probeGoogleSearchConsoleAccess() {
  const gscSiteUrl = process.env.GSC_SITE_URL?.trim();
  const encoded = process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!gscSiteUrl || !encoded) return;
  try {
    const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (typeof credentials.client_email !== "string" || typeof credentials.private_key !== "string") {
      checks.push({ name: "gsc_property_access", status: "fail", detail: "Service-account JSON is missing client_email or private_key." });
      return;
    }
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/webmasters.readonly"] });
    const searchConsole = google.searchconsole({ version: "v1", auth });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await searchConsole.searchanalytics.query({
      siteUrl: gscSiteUrl,
      requestBody: {
        startDate: yesterday,
        endDate: yesterday,
        dimensions: ["date"],
        rowLimit: 1,
      },
    });
    checks.push({ name: "gsc_property_access", status: "pass", detail: "Service account can read Search Console Search Analytics." });
    const sitemapUrl = `${siteUrl}/sitemap.xml`;
    try {
      const sitemapList = await searchConsole.sitemaps.list({ siteUrl: gscSiteUrl });
      const submitted = (sitemapList.data.sitemap ?? []).some((item) => item.path === sitemapUrl);
      checks.push({
        name: "gsc_sitemap_submission",
        status: submitted ? "pass" : "warn",
        detail: submitted ? "The canonical sitemap index is submitted in Search Console." : "The canonical sitemap index is not listed in Search Console yet.",
      });
    } catch (error) {
      const statusCode = error && typeof error === "object" && "response" in error
        ? Number(error.response?.status ?? 0)
        : 0;
      checks.push({
        name: "gsc_sitemap_submission",
        status: statusCode === 403 ? "fail" : "warn",
        detail: statusCode === 403
          ? "The service account can query Search Analytics but cannot read submitted sitemaps."
          : `Search Console sitemap status probe failed${statusCode ? ` with HTTP ${statusCode}` : ""}.`,
      });
    }
  } catch (error) {
    const statusCode = error && typeof error === "object" && "response" in error
      ? Number(error.response?.status ?? 0)
      : 0;
    checks.push({
      name: "gsc_property_access",
      status: statusCode === 403 ? "fail" : "warn",
      detail: statusCode === 403
        ? "Service account cannot read this Search Console property; grant it Owner or Full access in Search Console."
        : `Search Console access probe failed${statusCode ? ` with HTTP ${statusCode}` : ""}.`,
    });
  }
}

async function probeBingReportingAccess() {
  const apiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  const site = (process.env.BING_SITE_URL?.trim() || siteUrl).replace(/\/$/, "");
  const endpoint = process.env.BING_WEBMASTER_STATS_ENDPOINT?.trim();
  if (!apiKey || !endpoint) return;
  let requestUrl;
  try {
    requestUrl = new URL(endpoint);
  } catch {
    checks.push({ name: "bing_reporting_access", status: "fail", detail: "BING_WEBMASTER_STATS_ENDPOINT is not a valid URL." });
    return;
  }
  if (!isSupportedBingStatsEndpoint(endpoint)) {
    checks.push({ name: "bing_reporting_access", status: "fail", detail: "BING_WEBMASTER_STATS_ENDPOINT must be Microsoft's JSON/HTTP GetPageStats endpoint." });
    return;
  }
  requestUrl.searchParams.set("siteUrl", site);
  requestUrl.searchParams.set("apikey", apiKey);
  try {
    const response = await fetch(requestUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
    const body = await response.text();
    let payload = null;
    try { payload = JSON.parse(body); } catch { /* invalid response is reported below */ }
    const valid = response.status === 200 && payload && typeof payload === "object" && Array.isArray(payload.d);
    checks.push({
      name: "bing_reporting_access",
      status: valid ? "pass" : "fail",
      detail: valid
        ? `Bing JSON/HTTP page-statistics endpoint is reachable (${payload.d.length} rows returned; an empty warm-up response is valid).`
        : `Bing page-statistics endpoint returned HTTP ${response.status} with an invalid JSON/HTTP response shape.`,
    });
  } catch (error) {
    checks.push({ name: "bing_reporting_access", status: "fail", detail: error instanceof Error ? error.message : String(error) });
  }
}
