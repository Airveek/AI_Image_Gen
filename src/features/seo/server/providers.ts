import "server-only";

import { createHash } from "node:crypto";

import { google } from "googleapis";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, SITE_URL } from "@/lib/seo/site";
import { listAllLiveSeoPages } from "@/features/seo/server/content";

type GscRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type Ga4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

export async function syncGoogleSearchConsole(metricDate: string) {
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/webmasters.readonly"]);
  if (!siteUrl || !auth) return { status: "skipped" as const, reason: "not_configured" };

  const client = google.searchconsole({ version: "v1", auth });
  const pageResponse = await client.searchanalytics.query({
    siteUrl,
    requestBody: { startDate: metricDate, endDate: metricDate, dimensions: ["page"], rowLimit: 25_000, searchType: "web" },
  });
  const queryResponse = await client.searchanalytics.query({
    siteUrl,
    requestBody: { startDate: metricDate, endDate: metricDate, dimensions: ["page", "query"], rowLimit: 25_000, searchType: "web" },
  });
  const pages = await loadPageIdMap();
  const supabase = createSupabaseAdminClient();
  const pageRows = (pageResponse.data.rows ?? []) as GscRow[];
  const queryRows = (queryResponse.data.rows ?? []) as GscRow[];

  if (pageRows.length) {
    const { error } = await supabase.from("seo_gsc_page_daily").upsert(
      pageRows.flatMap((row) => {
        const canonicalUrl = normalizeExternalPageUrl(row.keys?.[0]);
        return canonicalUrl ? [{ metric_date: metricDate, canonical_url: canonicalUrl, page_id: pages.get(canonicalUrl) ?? null, clicks: integer(row.clicks), impressions: integer(row.impressions), ctr: ratio(row.ctr), position: nonNegative(row.position), country: "all", device: "all", search_type: "web", imported_at: new Date().toISOString() }] : [];
      }),
      { onConflict: "metric_date,canonical_url,country,device,search_type" },
    );
    if (error) throw new Error(`GSC page import failed: ${error.code}`);
  }
  if (queryRows.length) {
    const { error } = await supabase.from("seo_gsc_query_page_daily").upsert(
      queryRows.flatMap((row) => {
        const canonicalUrl = normalizeExternalPageUrl(row.keys?.[0]);
        const query = sanitizeQuery(row.keys?.[1]);
        return canonicalUrl && query ? [{ metric_date: metricDate, canonical_url: canonicalUrl, page_id: pages.get(canonicalUrl) ?? null, query, clicks: integer(row.clicks), impressions: integer(row.impressions), ctr: ratio(row.ctr), position: nonNegative(row.position), country: "all", device: "all", search_type: "web", imported_at: new Date().toISOString() }] : [];
      }),
      { onConflict: "metric_date,canonical_url,query,country,device,search_type" },
    );
    if (error) throw new Error(`GSC query import failed: ${error.code}`);
  }
  return { status: "succeeded" as const, provider: "gsc", metricDate, pageRows: pageRows.length, queryRows: queryRows.length };
}

export async function syncGoogleAnalytics(metricDate: string) {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/analytics.readonly"]);
  if (!propertyId || !auth) return { status: "skipped" as const, reason: "not_configured" };

  const analytics = google.analyticsdata({ version: "v1beta", auth });
  const response = await analytics.properties.runReport({
    property: propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: metricDate, endDate: metricDate }],
      dimensions: [{ name: "landingPagePlusQueryString" }, { name: "sessionSource" }, { name: "sessionMedium" }, { name: "eventName" }],
      metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "eventCount" }, { name: "totalRevenue" }],
      limit: "25000",
    },
  });
  const rows = (response.data.rows ?? []) as Ga4Row[];
  const aggregate = new Map<string, { landingPath: string; source: string; medium: string; sessions: number; engagedSessions: number; signups: number; firstGenerations: number; checkoutStarts: number; purchases: number; revenue: number }>();
  const sessionTotalsSeen = new Set<string>();
  for (const row of rows) {
    const dimensions = row.dimensionValues ?? [];
    const metrics = row.metricValues ?? [];
    const landingPath = normalizeLandingPath(dimensions[0]?.value);
    const source = sanitizeDimension(dimensions[1]?.value, "(direct)");
    const medium = sanitizeDimension(dimensions[2]?.value, "(none)");
    const eventName = dimensions[3]?.value ?? "";
    if (!landingPath) continue;
    const key = `${landingPath}|${source}|${medium}`;
    const item = aggregate.get(key) ?? { landingPath, source, medium, sessions: 0, engagedSessions: 0, signups: 0, firstGenerations: 0, checkoutStarts: 0, purchases: 0, revenue: 0 };
    const eventCount = integerString(metrics[2]?.value);
    if (!sessionTotalsSeen.has(key)) {
      item.sessions += integerString(metrics[0]?.value);
      item.engagedSessions += integerString(metrics[1]?.value);
      sessionTotalsSeen.add(key);
    }
    item.revenue += decimalString(metrics[3]?.value);
    if (eventName === "sign_up" || eventName === "signup") item.signups += eventCount;
    if (eventName === "first_generation" || eventName === "generate_first") item.firstGenerations += eventCount;
    if (eventName === "begin_checkout" || eventName === "checkout_start") item.checkoutStarts += eventCount;
    if (eventName === "purchase") item.purchases += eventCount;
    aggregate.set(key, item);
  }

  const pages = await loadPageIdMap();
  const payload = [...aggregate.values()].map((item) => ({
    metric_date: metricDate,
    landing_path: item.landingPath,
    page_id: pages.get(absoluteUrl(item.landingPath)) ?? null,
    source: item.source,
    medium: item.medium,
    sessions: item.sessions,
    engaged_sessions: item.engagedSessions,
    signups: item.signups,
    first_generations: item.firstGenerations,
    checkout_starts: item.checkoutStarts,
    purchases: item.purchases,
    revenue: item.revenue,
    currency: "USD",
    imported_at: new Date().toISOString(),
  }));
  if (payload.length) {
    const { error } = await createSupabaseAdminClient().from("seo_ga4_landing_daily").upsert(payload, { onConflict: "metric_date,landing_path,source,medium,currency" });
    if (error) throw new Error(`GA4 import failed: ${error.code}`);
  }
  return { status: "succeeded" as const, provider: "ga4", metricDate, rows: payload.length };
}

export async function inspectGoogleUrls(limit: number) {
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/webmasters"]);
  if (!siteUrl || !auth) return { status: "skipped" as const, reason: "not_configured" };
  const safeLimit = Math.max(0, Math.min(10_000, Math.floor(limit)));
  if (safeLimit === 0) return { status: "skipped" as const, reason: "budget_zero" };
  const client = createSupabaseAdminClient();
  const { data: queue, error } = await client
    .from("seo_url_state")
    .select("page_id,canonical_url")
    .eq("eligible_for_indexing", true)
    .order("google_inspected_at", { ascending: true, nullsFirst: true })
    .limit(safeLimit);
  if (error) throw new Error(`GSC inspection queue is unavailable: ${error.code}`);
  const searchconsole = google.searchconsole({ version: "v1", auth });
  let inspected = 0;
  for (const row of queue ?? []) {
    const canonicalUrl = String(row.canonical_url);
    const response = await searchconsole.urlInspection.index.inspect({ requestBody: { inspectionUrl: canonicalUrl, siteUrl, languageCode: "en-US" } });
    const result = response.data.inspectionResult;
    const indexStatus = result?.indexStatusResult;
    const now = new Date().toISOString();
    await client.from("seo_url_state").update({
      google_inspection_verdict: indexStatus?.verdict ?? null,
      google_inspected_at: now,
      last_canonical_url: indexStatus?.googleCanonical ?? indexStatus?.userCanonical ?? null,
      updated_at: now,
      ...(indexStatus?.verdict === "PASS" || indexStatus?.verdict === "VERDICT_PASS" ? { first_indexed_at: now } : {}),
    }).eq("canonical_url", canonicalUrl);
    inspected += 1;
  }
  return { status: "succeeded" as const, provider: "gsc-inspection", inspected, queued: queue?.length ?? 0 };
}

export async function crawlEligibleSeoUrls(limit: number) {
  const client = createSupabaseAdminClient();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const { data: urls, error: queueError } = await client
    .from("seo_url_state")
    .select("page_id,canonical_url")
    .eq("eligible_for_indexing", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })
    .limit(safeLimit);
  if (queueError) throw new Error(`SEO crawl queue is unavailable: ${queueError.code}`);

  const runKey = `scheduled:${new Date().toISOString().slice(0, 13)}`;
  const { data: run, error: runError } = await client.from("seo_crawl_runs").upsert({ run_key: runKey, trigger_kind: "scheduled", status: "running" }, { onConflict: "run_key" }).select("id").single();
  if (runError || !run) throw new Error("SEO crawl run could not be started.");

  let issueCount = 0;
  let checkedCount = 0;
  for (const row of urls ?? []) {
    const canonicalUrl = String(row.canonical_url);
    const result = await crawlOne(canonicalUrl);
    checkedCount += 1;
    issueCount += result.issueCodes.length;
    await client.from("seo_crawl_snapshots").upsert({ run_id: run.id, page_id: row.page_id, canonical_url: canonicalUrl, fetched_url: canonicalUrl, http_status: result.status, response_ms: result.responseMs, declared_canonical_url: result.declaredCanonical, robots_directive: result.robots, title: result.title, h1_count: result.h1Count, schema_types: result.schemaTypes, content_hash: result.contentHash, issue_codes: result.issueCodes }, { onConflict: "run_id,canonical_url" });
    await client.from("seo_url_state").update({ last_crawled_at: new Date().toISOString(), last_http_status: result.status, last_canonical_url: result.declaredCanonical, last_robots_directive: result.robots, updated_at: new Date().toISOString() }).eq("canonical_url", canonicalUrl);
  }
  await client.from("seo_crawl_runs").update({ status: "succeeded", checked_count: checkedCount, issue_count: issueCount, completed_at: new Date().toISOString(), note: issueCount ? `${issueCount} crawl issue(s) found.` : "No crawl issues found." }).eq("id", run.id);
  return { status: "succeeded" as const, checkedCount, issueCount };
}

function createGoogleAuth(scopes: string[]) {
  const encoded = process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!encoded) return null;
  try {
    const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>;
    if (typeof credentials.client_email !== "string" || typeof credentials.private_key !== "string") return null;
    return new google.auth.GoogleAuth({ credentials, scopes });
  } catch {
    return null;
  }
}

async function loadPageIdMap() {
  const rows = await listAllLiveSeoPages();
  return new Map(rows.map((row) => [absoluteUrl(row.path), row.id]));
}

function normalizeExternalPageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== SITE_URL) return null;
    return absoluteUrl(url.pathname);
  } catch {
    return null;
  }
}

function normalizeLandingPath(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, SITE_URL);
    if (url.origin !== SITE_URL) return null;
    return url.pathname === "/" ? "/" : `${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return null;
  }
}

function sanitizeQuery(value: string | undefined): string | null {
  const query = value?.trim().slice(0, 2_048);
  return query || null;
}

function sanitizeDimension(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).slice(0, 120);
}

function integer(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;
}

function ratio(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value as number)) : 0;
}

function nonNegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value as number) : 0;
}

function integerString(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function decimalString(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

async function crawlOne(url: string) {
  const started = Date.now();
  const issueCodes: string[] = [];
  if (!isSiteUrl(url)) return { status: null, responseMs: 0, declaredCanonical: null, robots: null, title: null, h1Count: null, schemaTypes: [], contentHash: null, issueCodes: ["external_url"] };
  try {
    const response = await fetch(url, { headers: { accept: "text/html,application/xhtml+xml" }, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const html = (await response.text()).slice(0, 2_000_000);
    const title = matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Count = [...html.matchAll(/<h1\b/gi)].length;
    const declaredCanonical = matchOne(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const robots = matchOne(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    const schemaTypes = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((match) => match[1]).slice(0, 20);
    const contentHash = createHash("sha256").update(html).digest("hex");
    if (response.status !== 200) issueCodes.push("http_not_200");
    if (!title) issueCodes.push("title_missing");
    if (h1Count !== 1) issueCodes.push("h1_count_not_one");
    if (!declaredCanonical || !isSiteUrl(new URL(declaredCanonical, SITE_URL).toString()) || absoluteUrl(new URL(declaredCanonical, SITE_URL).pathname) !== absoluteUrl(url)) issueCodes.push("canonical_mismatch");
    if (robots?.toLowerCase().includes("noindex")) issueCodes.push("unexpected_noindex");
    return { status: response.status, responseMs: Date.now() - started, declaredCanonical, robots, title: decodeHtml(title), h1Count, schemaTypes, contentHash, issueCodes };
  } catch {
    return { status: null, responseMs: Date.now() - started, declaredCanonical: null, robots: null, title: null, h1Count: null, schemaTypes: [], contentHash: null, issueCodes: ["fetch_failed"] };
  }
}

function isSiteUrl(value: string): boolean {
  try { return new URL(value).origin === SITE_URL; } catch { return false; }
}

function matchOne(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1]?.trim() ?? null;
}

function decodeHtml(value: string | null): string | null {
  return value?.replace(/\s+/g, " ").replace(/&amp;/g, "&").slice(0, 500) ?? null;
}
