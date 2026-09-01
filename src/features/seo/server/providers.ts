import "server-only";

import { createHash } from "node:crypto";

import { google } from "googleapis";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, SITE_URL } from "@/lib/seo/site";
import { upsertSeoAlert } from "@/features/seo/server/control-plane";

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
  // Search Analytics caps one response at 25,000 rows. Page through the
  // complete daily result so a larger content graph is not silently sampled.
  const [pageRows, queryRows] = await Promise.all([
    querySearchAnalyticsRows(client, siteUrl, metricDate, ["page"]),
    querySearchAnalyticsRows(client, siteUrl, metricDate, ["page", "query"]),
  ]);
  const metricUrls = new Set<string>();
  for (const row of [...pageRows, ...queryRows]) {
    const canonicalUrl = normalizeExternalPageUrl(row.keys?.[0]);
    if (canonicalUrl) metricUrls.add(canonicalUrl);
  }
  const pages = await loadPageIdMap(metricUrls);
  // Carry query facts back to their originating brief/topic when the page was
  // created through the Airveek content pipeline. This closes the feedback
  // loop for refreshes without guessing from a query string: only an explicit
  // persisted page→brief relationship is accepted.
  const briefContext = await loadBriefContextMap(pages.values());
  const supabase = createSupabaseAdminClient();

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
  let keywordEvidenceRows = 0;
  if (queryRows.length) {
    const importedAt = new Date().toISOString();
    const queryPayload = queryRows.flatMap((row) => {
      const canonicalUrl = normalizeExternalPageUrl(row.keys?.[0]);
      const query = sanitizeQuery(row.keys?.[1]);
      return canonicalUrl && query ? [{ metric_date: metricDate, canonical_url: canonicalUrl, page_id: pages.get(canonicalUrl) ?? null, query, clicks: integer(row.clicks), impressions: integer(row.impressions), ctr: ratio(row.ctr), position: nonNegative(row.position), country: "all", device: "all", search_type: "web", imported_at: importedAt }] : [];
    });
    const { error } = await supabase.from("seo_gsc_query_page_daily").upsert(queryPayload, { onConflict: "metric_date,canonical_url,query,country,device,search_type" });
    if (error) throw new Error(`GSC query import failed: ${error.code}`);
    const keywordPayload = queryPayload.map((row) => ({
      page_id: row.page_id,
      brief_id: row.page_id ? briefContext.get(row.page_id)?.briefId ?? null : null,
      topic_id: row.page_id ? briefContext.get(row.page_id)?.topicId ?? null : null,
      source: "gsc",
      query: row.query,
      canonical_url: row.canonical_url,
      metric_date: row.metric_date,
      country: row.country,
      device: row.device,
      search_type: row.search_type,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      source_url: "https://search.google.com/search-console",
      source_title: "Google Search Console Search Analytics",
      confidence: 100,
      evidence_key: sha256EvidenceKey(["gsc", row.metric_date, row.canonical_url, row.query, row.country, row.device, row.search_type]),
      metadata: { provider: "gsc", importedAt },
      collected_at: importedAt,
      updated_at: importedAt,
    }));
    await upsertInChunks(supabase, "seo_keyword_evidence", keywordPayload, "source,metric_date,query,canonical_url,country,device,search_type");
    keywordEvidenceRows = keywordPayload.length;
  }
  return { status: "succeeded" as const, provider: "gsc", metricDate, pageRows: pageRows.length, queryRows: queryRows.length, keywordEvidenceRows };
}

/**
 * Ask Search Console to re-fetch the sitemap index after a publication wave.
 * This is deliberately a sitemap submission—not the restricted Google
 * Indexing API—and is throttled by the Inngest heartbeat rather than called
 * once for every URL.
 */
export async function submitGoogleSitemap() {
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/webmasters"]);
  if (!siteUrl || !auth) return { status: "skipped" as const, reason: "not_configured" };
  const sitemapUrl = absoluteUrl("/sitemap.xml");
  await google.searchconsole({ version: "v1", auth }).sitemaps.submit({ siteUrl, feedpath: sitemapUrl });
  return { status: "succeeded" as const, provider: "gsc-sitemap", sitemapUrl };
}

async function querySearchAnalyticsRows(
  client: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  metricDate: string,
  dimensions: string[],
): Promise<GscRow[]> {
  const rows: GscRow[] = [];
  const pageSize = 25_000;
  const maxRows = 250_000;
  for (let startRow = 0; startRow < maxRows; startRow += pageSize) {
    const response = await client.searchanalytics.query({
      siteUrl,
      requestBody: { startDate: metricDate, endDate: metricDate, dimensions, rowLimit: pageSize, startRow, searchType: "web" },
    });
    const batch = (response.data.rows ?? []) as GscRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

export async function syncGoogleAnalytics(metricDate: string) {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const bigQueryDataset = await resolveBigQueryDataset(propertyId);
  if (bigQueryDataset) {
    try {
      return await syncGoogleAnalyticsBigQuery(metricDate, bigQueryDataset);
    } catch (error) {
      // A linked GA4 export can be visible before its event tables/schema are
      // ready, or the service account can temporarily lose BigQuery access.
      // Only provider/query errors fall back. Supabase write failures must
      // still fail the job so the watermark cannot advance over lost data.
      if (!isBigQueryFallbackError(error)) throw error;
      const fallback = await syncGoogleAnalyticsDataApi(metricDate, propertyId);
      if (fallback.status !== "succeeded") return fallback;
      return {
        ...fallback,
        provider: "ga4-data-api-fallback" as const,
        fallbackFrom: "ga4-bigquery" as const,
        fallbackReason: summarizeProviderError(error),
      };
    }
  }
  return syncGoogleAnalyticsDataApi(metricDate, propertyId);
}

async function syncGoogleAnalyticsDataApi(metricDate: string, propertyId: string | undefined) {
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/analytics.readonly"]);
  if (!propertyId || !auth) return { status: "skipped" as const, reason: "not_configured" };

  const analytics = google.analyticsdata({ version: "v1beta", auth });
  const rows = await queryGa4Rows(analytics, propertyId, metricDate);
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

  const pages = await loadPageIdMap([...aggregate.values()].map((item) => absoluteUrl(item.landingPath)));
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

/**
 * BigQuery is the preferred historical source, but GA4 exports are not
 * immediately queryable after a link is created and their event schema has
 * versioned fields. Keep a narrow fallback for those provider failures while
 * leaving application/database failures visible to the job runner.
 */
function isBigQueryFallbackError(error: unknown): boolean {
  if (error instanceof Error && /^GA4 BigQuery query did not complete/.test(error.message)) return true;
  if (!isRecord(error)) return false;
  const response = isRecord(error.response) ? error.response : null;
  const responseData = response && isRecord(response.data) ? response.data : null;
  const apiError = responseData && isRecord(responseData.error) ? responseData.error : null;
  if (!apiError) return false;
  const status = numberValue(apiError.code) ?? numberValue(response?.status);
  const nestedReasons = Array.isArray(apiError.errors)
    ? apiError.errors.flatMap((item) => isRecord(item) ? [stringValue(item.reason), stringValue(item.message)] : [])
    : [];
  const detail = [stringValue(apiError.status), stringValue(apiError.message), ...nestedReasons].filter(Boolean).join(" ");
  return [400, 403, 404, 429, 500, 502, 503].includes(status ?? -1)
    || /accessdenied|backenderror|internalerror|invalid(?:query|schema)?|notfound|permissiondenied|rate.?limit|timeout/i.test(detail);
}

function summarizeProviderError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/\s+/g, " ").slice(0, 240);
  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : null;
    const responseData = response && isRecord(response.data) ? response.data : null;
    const apiError = responseData && isRecord(responseData.error) ? responseData.error : null;
    const message = apiError && stringValue(apiError.message);
    if (message) return message.replace(/\s+/g, " ").slice(0, 240);
  }
  return "BigQuery provider query failed; GA4 Data API fallback used.";
}

async function queryGa4Rows(
  analytics: ReturnType<typeof google.analyticsdata>,
  propertyId: string,
  metricDate: string,
): Promise<Ga4Row[]> {
  // GA4 reports are paginated. Keep the cap finite so a malformed or very
  // high-cardinality report cannot exhaust an Inngest worker, while still
  // covering substantially more than the default first page.
  const rows: Ga4Row[] = [];
  const pageSize = 25_000;
  const maxRows = 250_000;
  const property = propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const response = await analytics.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: metricDate, endDate: metricDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }, { name: "sessionSource" }, { name: "sessionMedium" }, { name: "eventName" }],
        metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "eventCount" }, { name: "totalRevenue" }],
        limit: String(pageSize),
        offset: String(offset),
      },
    });
    const batch = (response.data.rows ?? []) as Ga4Row[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

/**
 * Read the durable GA4 export when a dataset is configured. The Data API is
 * retained as the local fallback, but BigQuery is preferred for a historical
 * event stream and a stable re-import watermark.
 */
async function syncGoogleAnalyticsBigQuery(metricDate: string, datasetName?: string) {
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const dataset = datasetName ?? normalizeBigQueryDataset(process.env.GA4_BIGQUERY_DATASET, projectId);
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/bigquery.readonly"]);
  if (!projectId || !dataset || !auth) return { status: "skipped" as const, reason: "not_configured" };

  const client = google.bigquery({ version: "v2", auth });
  const response = await client.jobs.query({
    projectId,
    requestBody: {
      query: `
        WITH raw_events AS (
          SELECT
            (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
            -- traffic_source is user-scoped first-acquisition data. The
            -- landing table is session-scoped, so prefer GA4's last-click
            -- session record and retain older/export variants as fallbacks.
            COALESCE(
              NULLIF(session_traffic_source_last_click.cross_channel_campaign.source, '(not set)'),
              NULLIF(session_traffic_source_last_click.manual_campaign.source, '(not set)'),
              NULLIF(collected_traffic_source.manual_source, '(not set)'),
              NULLIF(traffic_source.source, '(not set)'),
              '(direct)'
            ) AS source,
            COALESCE(
              NULLIF(session_traffic_source_last_click.cross_channel_campaign.medium, '(not set)'),
              NULLIF(session_traffic_source_last_click.manual_campaign.medium, '(not set)'),
              NULLIF(collected_traffic_source.manual_medium, '(not set)'),
              NULLIF(traffic_source.medium, '(not set)'),
              '(none)'
            ) AS medium,
            event_name,
            user_pseudo_id,
            (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS ga_session_id,
            COALESCE(
              (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'session_engaged'),
              SAFE_CAST((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_engaged') AS INT64),
              0
            ) AS session_engaged,
            ecommerce.purchase_revenue_in_usd AS purchase_revenue_usd
          FROM \`${dataset}.events_*\`
          WHERE _TABLE_SUFFIX = @tableDate
        ),
        source_events AS (
          SELECT
            *,
            CONCAT(user_pseudo_id, '-', CAST(ga_session_id AS STRING)) AS session_key
          FROM raw_events
          WHERE page_location IS NOT NULL
        ),
        session_rollup AS (
          SELECT
            page_location,
            source,
            medium,
            COUNT(DISTINCT session_key) AS sessions,
            COUNT(DISTINCT IF(session_engaged = 1, session_key, NULL)) AS engaged_sessions
          FROM source_events
          GROUP BY page_location, source, medium
        ),
        event_rollup AS (
          SELECT
            page_location,
            source,
            medium,
            event_name,
            COUNT(*) AS event_count,
            SUM(COALESCE(purchase_revenue_usd, 0)) AS revenue
          FROM source_events
          GROUP BY page_location, source, medium, event_name
        )
        SELECT
          event_rollup.page_location,
          event_rollup.source,
          event_rollup.medium,
          event_rollup.event_name,
          event_rollup.event_count,
          session_rollup.sessions,
          session_rollup.engaged_sessions,
          event_rollup.revenue
        FROM event_rollup
        INNER JOIN session_rollup
          USING (page_location, source, medium)
      `,
      useLegacySql: false,
      parameterMode: "NAMED",
      queryParameters: [{ name: "tableDate", parameterType: { type: "STRING" }, parameterValue: { value: metricDate.replace(/-/g, "") } }],
      timeoutMs: 30_000,
    },
  });
  if (response.data.jobComplete === false) throw new Error("GA4 BigQuery query did not complete within the timeout.");

  const aggregate = new Map<string, { landingPath: string; source: string; medium: string; sessions: number; engagedSessions: number; signups: number; firstGenerations: number; checkoutStarts: number; purchases: number; revenue: number }>();
  const sessionTotalsSeen = new Set<string>();
  for (const row of response.data.rows ?? []) {
    const values = (row.f ?? []).map((field) => field.v);
    const landingPath = normalizeLandingPath(bigQueryString(values[0]));
    if (!landingPath) continue;
    const source = sanitizeDimension(bigQueryString(values[1]), "(direct)");
    const medium = sanitizeDimension(bigQueryString(values[2]), "(none)");
    const eventName = bigQueryString(values[3]) ?? "";
    const key = `${landingPath}|${source}|${medium}`;
    const item = aggregate.get(key) ?? { landingPath, source, medium, sessions: 0, engagedSessions: 0, signups: 0, firstGenerations: 0, checkoutStarts: 0, purchases: 0, revenue: 0 };
    if (!sessionTotalsSeen.has(key)) {
      item.sessions += integerString(bigQueryString(values[5]));
      item.engagedSessions += integerString(bigQueryString(values[6]));
      sessionTotalsSeen.add(key);
    }
    const eventCount = integerString(bigQueryString(values[4]));
    item.revenue += decimalString(bigQueryString(values[7]));
    if (eventName === "sign_up" || eventName === "signup") item.signups += eventCount;
    if (eventName === "first_generation" || eventName === "generate_first") item.firstGenerations += eventCount;
    if (eventName === "begin_checkout" || eventName === "checkout_start") item.checkoutStarts += eventCount;
    if (eventName === "purchase") item.purchases += eventCount;
    aggregate.set(key, item);
  }

  const pages = await loadPageIdMap([...aggregate.values()].map((item) => absoluteUrl(item.landingPath)));
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
    if (error) throw new Error(`GA4 BigQuery import failed: ${error.code}`);
  }
  return { status: "succeeded" as const, provider: "ga4-bigquery", metricDate, rows: payload.length, dataset };
}

async function resolveBigQueryDataset(propertyId: string | undefined): Promise<string | null> {
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const configured = normalizeBigQueryDataset(process.env.GA4_BIGQUERY_DATASET, projectId);
  if (!projectId) return null;
  const auth = createGoogleAuth(["https://www.googleapis.com/auth/bigquery.readonly"]);
  if (!auth) return null;

  const datasetId = configured?.split(".").at(-1)
    ?? (propertyId && /^\d+$/.test(propertyId.replace(/^properties\//, ""))
      ? `analytics_${propertyId.replace(/^properties\//, "")}`
      : null);
  if (!datasetId || !/^[a-zA-Z0-9_]+$/.test(datasetId)) return null;
  try {
    await google.bigquery({ version: "v2", auth }).datasets.get({ projectId, datasetId });
    return `${projectId}.${datasetId}`;
  } catch {
    // The GA4 link may exist before Google creates the dataset, or the service
    // account may not have BigQuery access yet. Fall back to the GA4 Data API.
    return null;
  }
}

/**
 * Import Bing's page-level performance snapshot into the first-party store.
 * Bing is retiring the legacy SOAP/POX surface on 2026-08-31, so the endpoint
 * is configurable while Microsoft exposes the replacement REST contract.
 * IndexNow remains the real-time discovery path and is independent of reports.
 */
export async function syncBingWebmaster(metricDate: string) {
  const apiKey = process.env.BING_WEBMASTER_API_KEY?.trim();
  const siteUrl = (process.env.BING_SITE_URL?.trim() || absoluteUrl("/")).replace(/\/$/, "");
  const endpoint = process.env.BING_WEBMASTER_STATS_ENDPOINT?.trim();
  if (!apiKey || !siteUrl || !endpoint) return { status: "skipped" as const, reason: "not_configured" };
  const requestUrl = new URL(endpoint);
  if (!isSupportedBingReportingEndpoint(requestUrl)) {
    throw new Error("BING_WEBMASTER_STATS_ENDPOINT must be Microsoft's JSON/HTTP GetPageStats endpoint.");
  }
  if (isLegacyBingEndpoint(requestUrl) && Date.now() >= Date.parse("2026-08-31T00:00:00.000Z")) {
    throw new Error("Bing legacy stats API retired; configure BING_WEBMASTER_STATS_ENDPOINT with Microsoft's supported replacement.");
  }
  requestUrl.searchParams.set("siteUrl", siteUrl);
  requestUrl.searchParams.set("apikey", apiKey);
  const response = await fetch(requestUrl, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Bing Webmaster stats import failed: HTTP ${response.status}`);
  const payload = await response.json() as { d?: unknown };
  const rows = Array.isArray(payload.d) ? payload.d.filter(isRecord) : [];
  const metricUrls = rows.flatMap((row) => {
    const canonicalUrl = normalizeExternalPageUrl(stringValue(row.Query));
    return canonicalUrl ? [canonicalUrl] : [];
  });
  const pages = await loadPageIdMap(metricUrls);
  const records = rows.flatMap((row) => {
    const canonicalUrl = normalizeExternalPageUrl(stringValue(row.Query));
    if (!canonicalUrl) return [];
    const rowDate = bingMetricDate(row.Date, metricDate);
    const impressions = integer(numberValue(row.Impressions));
    const clicks = integer(numberValue(row.Clicks));
    return [{
      metric_date: rowDate,
      page_id: pages.get(canonicalUrl) ?? null,
      canonical_url: canonicalUrl,
      clicks,
      impressions,
      ctr: impressions > 0 ? Math.min(1, clicks / impressions) : 0,
      position: nonNegative(numberValue(row.AvgImpressionPosition)),
      crawled_pages: 0,
      crawl_errors: 0,
      imported_at: new Date().toISOString(),
    }];
  });
  if (records.length) {
    const { error } = await createSupabaseAdminClient()
      .from("seo_bing_page_daily")
      .upsert(records, { onConflict: "metric_date,canonical_url" });
    if (error) throw new Error(`Bing Webmaster import failed: ${error.code}`);
  }
  return { status: "succeeded" as const, provider: "bing", metricDate, rows: records.length, source: endpoint };
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
  let failed = 0;
  for (const row of queue ?? []) {
    const canonicalUrl = String(row.canonical_url);
    try {
      const response = await searchconsole.urlInspection.index.inspect({ requestBody: { inspectionUrl: canonicalUrl, siteUrl, languageCode: "en-US" } });
      const result = response.data.inspectionResult;
      const indexStatus = result?.indexStatusResult;
      const now = new Date().toISOString();
      const { error: updateError } = await client.from("seo_url_state").update({
        google_inspection_verdict: indexStatus?.verdict ?? null,
        google_inspected_at: now,
        last_canonical_url: indexStatus?.googleCanonical ?? indexStatus?.userCanonical ?? null,
        updated_at: now,
      }).eq("canonical_url", canonicalUrl);
      if (updateError) throw updateError;
      // `first_indexed_at` is a milestone, not a heartbeat. Preserve the
      // original timestamp when a later inspection is also a PASS.
      if (indexStatus?.verdict === "PASS" || indexStatus?.verdict === "VERDICT_PASS") {
        const { error: firstIndexedError } = await client
          .from("seo_url_state")
          .update({ first_indexed_at: now })
          .eq("canonical_url", canonicalUrl)
          .is("first_indexed_at", null);
        if (firstIndexedError) throw firstIndexedError;
      }
      inspected += 1;
    } catch (error) {
      failed += 1;
      await upsertSeoAlert({
        dedupeKey: `gsc-inspection:${canonicalUrl}`,
        severity: "p2",
        category: "gsc-inspection",
        title: "Google URL Inspection failed",
        message: `${canonicalUrl} could not be inspected; it will remain eligible for a later retry.`,
        evidence: { canonicalUrl, error: error instanceof Error ? error.name : "unknown_error" },
      });
    }
  }
  return { status: "succeeded" as const, provider: "gsc-inspection", inspected, failed, queued: queue?.length ?? 0 };
}

export async function crawlEligibleSeoUrls(limit: number) {
  const client = createSupabaseAdminClient();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const { data: urls, error: queueError } = await client
    .from("seo_url_state")
    .select("page_id,canonical_url")
    // Include previously crawled unhealthy rows so a later deploy can
    // recover them; never include a brand-new preflight row without a crawl.
    .or("eligible_for_indexing.eq.true,last_crawled_at.not.is.null")
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
    const { error: snapshotError } = await client.from("seo_crawl_snapshots").upsert({ run_id: run.id, page_id: row.page_id, canonical_url: canonicalUrl, fetched_url: canonicalUrl, http_status: result.status, response_ms: result.responseMs, declared_canonical_url: result.declaredCanonical, robots_directive: result.robots, title: result.title, h1_count: result.h1Count, schema_types: result.schemaTypes, content_hash: result.contentHash, issue_codes: result.issueCodes }, { onConflict: "run_id,canonical_url" });
    if (snapshotError) throw new Error(`SEO crawl snapshot persistence failed: ${snapshotError.code}`);
    // A failed render must disappear from discovery immediately, while a
    // previously crawled URL remains in this queue so a later healthy crawl
    // can automatically restore it. Sitemap queries require both this flag
    // and a 200 response.
    const crawledAt = new Date().toISOString();
    const { error: stateError } = await client.from("seo_url_state").update({ eligible_for_indexing: result.status === 200 && result.issueCodes.length === 0, last_crawled_at: crawledAt, last_http_status: result.status, last_canonical_url: result.declaredCanonical, last_robots_directive: result.robots, updated_at: crawledAt }).eq("canonical_url", canonicalUrl);
    if (stateError) throw new Error(`SEO crawl URL state update failed: ${stateError.code}`);
    if (result.internalLinks.length) {
      const now = new Date().toISOString();
      const { error: edgeError } = await client.from("seo_link_edges").upsert(
        result.internalLinks.map((link) => ({
          source_page_id: row.page_id,
          source_url: canonicalUrl,
          target_page_id: null,
          target_url: link.url,
          anchor_text: link.anchor,
          placement: "body",
          nofollow: false,
          first_seen_at: now,
          last_seen_at: now,
        })),
        { onConflict: "source_url,target_url,anchor_text,placement" },
      );
      if (edgeError) throw new Error(`SEO crawl link graph persistence failed: ${edgeError.code}`);
    }
  }
  const { error: finishError } = await client.from("seo_crawl_runs").update({ status: "succeeded", checked_count: checkedCount, issue_count: issueCount, completed_at: new Date().toISOString(), note: issueCount ? `${issueCount} crawl issue(s) found.` : "No crawl issues found." }).eq("id", run.id);
  if (finishError) throw new Error(`SEO crawl run finalization failed: ${finishError.code}`);
  return { status: "succeeded" as const, checkedCount, issueCount };
}

/**
 * Run the same rendered-page checks used by the scheduled crawler for a
 * single URL. Probe jobs use this without creating a second crawl run.
 */
export async function crawlSeoPage(url: string) {
  return crawlOne(url);
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

async function loadPageIdMap(canonicalUrls: Iterable<string>) {
  const paths = [...new Set([...canonicalUrls].flatMap((value) => {
    const path = pathFromCanonicalUrl(value);
    return path ? [path] : [];
  }))];
  const pageIds = new Map<string, string>();
  const client = createSupabaseAdminClient();
  // Supabase/PostgREST URL length and planner limits make small batches safer
  // than one giant IN clause when a provider returns many dimensions.
  for (let offset = 0; offset < paths.length; offset += 500) {
    const chunk = paths.slice(offset, offset + 500);
    const { data, error } = await client
      .from("seo_pages")
      .select("id,path")
      .in("path", chunk)
      .not("status", "in", "(merged,archived)");
    if (error) throw new Error(`SEO page identity lookup failed: ${error.code}`);
    for (const row of data ?? []) {
      if (typeof row.id === "string" && typeof row.path === "string") {
        pageIds.set(absoluteUrl(row.path), row.id);
      }
    }
  }
  return pageIds;
}

async function loadBriefContextMap(pageIds: Iterable<string>) {
  const ids = [...new Set([...pageIds].filter((value) => typeof value === "string" && value.trim()))];
  const contexts = new Map<string, { briefId: string; topicId: string | null }>();
  if (!ids.length) return contexts;
  const client = createSupabaseAdminClient();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const chunk = ids.slice(offset, offset + 500);
    const { data, error } = await client
      .from("seo_content_briefs")
      .select("id,page_id,topic_id")
      .in("page_id", chunk)
      .not("status", "in", "(merged,archived)");
    if (error) throw new Error(`SEO brief identity lookup failed: ${error.code}`);
    for (const row of data ?? []) {
      if (typeof row.id === "string" && typeof row.page_id === "string") {
        contexts.set(row.page_id, { briefId: row.id, topicId: typeof row.topic_id === "string" ? row.topic_id : null });
      }
    }
  }
  return contexts;
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

function pathFromCanonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== SITE_URL || url.search || url.hash) return null;
    if (url.pathname === "/") return "/";
    return `/${url.pathname.replace(/^\/+|\/+$/g, "")}/`;
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

async function upsertInChunks(
  client: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
): Promise<void> {
  const chunkSize = 5_000;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const { error } = await client.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`SEO keyword evidence import failed: ${error.code}`);
  }
}

function sha256EvidenceKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}

function normalizeBigQueryDataset(value: string | undefined, projectId: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !projectId || !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?$/.test(raw)) return null;
  return raw.includes(".") ? raw : `${projectId}.${raw}`;
}

function bigQueryString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && "value" in value) return bigQueryString((value as { value?: unknown }).value);
  return undefined;
}

async function crawlOne(url: string) {
  const started = Date.now();
  const issueCodes: string[] = [];
  if (!isSiteUrl(url)) return { status: null, responseMs: 0, declaredCanonical: null, robots: null, title: null, h1Count: null, schemaTypes: [], contentHash: null, issueCodes: ["external_url"], internalLinks: [] };
  try {
    const response = await fetch(url, { headers: { accept: "text/html,application/xhtml+xml" }, redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const html = (await response.text()).slice(0, 2_000_000);
    const title = matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Count = [...html.matchAll(/<h1\b/gi)].length;
    const declaredCanonical = matchOne(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const robots = matchOne(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    const schemaTypes = readSchemaTypes(html, issueCodes);
    const mainText = visibleText(matchOne(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ?? html);
    const imageTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    const internalLinks = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .flatMap((match) => {
        const target = normalizeInternalPath(match[1]);
        if (!target) return [];
        const anchor = decodeHtml(match[2].replace(/<[^>]+>/g, ""))?.slice(0, 240) ?? "";
        return [{ url: absoluteUrl(target), anchor: anchor || target }];
      })
      .filter((link, index, values) => values.findIndex((candidate) => candidate.url === link.url && candidate.anchor === link.anchor) === index)
      .slice(0, 500);
    const contentHash = createHash("sha256").update(html).digest("hex");
    if (response.status !== 200) issueCodes.push("http_not_200");
    if (!title) issueCodes.push("title_missing");
    if (h1Count !== 1) issueCodes.push("h1_count_not_one");
    if (!canonicalMatches(declaredCanonical, url)) issueCodes.push("canonical_mismatch");
    if (robots?.toLowerCase().includes("noindex")) issueCodes.push("unexpected_noindex");
    if (response.status === 200 && mainText.length < 180) issueCodes.push("visible_content_too_thin");
    if (!schemaTypes.includes("Article") || !schemaTypes.includes("BreadcrumbList")) issueCodes.push("required_schema_missing");
    if (imageTags.some((tag) => !/\balt\s*=\s*["'][^"']*["']/i.test(tag))) issueCodes.push("image_alt_missing");
    if (imageTags.some((tag) => !/\bsrc\s*=\s*["'][^"']+["']/i.test(tag))) issueCodes.push("image_src_missing");
    return { status: response.status, responseMs: Date.now() - started, declaredCanonical, robots, title: decodeHtml(title), h1Count, schemaTypes, contentHash, issueCodes, internalLinks };
  } catch {
    return { status: null, responseMs: Date.now() - started, declaredCanonical: null, robots: null, title: null, h1Count: null, schemaTypes: [], contentHash: null, issueCodes: ["fetch_failed"], internalLinks: [] };
  }
}

function readSchemaTypes(html: string, issueCodes: string[]): string[] {
  const types = new Set<string>();
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!blocks.length) {
    issueCodes.push("schema_jsonld_missing");
    return [];
  }
  for (const block of blocks) {
    try {
      collectSchemaTypes(JSON.parse(block[1]), types);
    } catch {
      issueCodes.push("schema_json_invalid");
    }
  }
  return [...types].slice(0, 20);
}

function collectSchemaTypes(value: unknown, types: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaTypes(item, types);
    return;
  }
  if (!isRecord(value)) return;
  const type = value["@type"];
  if (typeof type === "string") types.add(type);
  if (Array.isArray(type)) for (const item of type) if (typeof item === "string") types.add(item);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") collectSchemaTypes(nested, types);
  }
}

function visibleText(value: string): string {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ")) ?? "";
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

function canonicalMatches(declaredCanonical: string | null, requestedUrl: string): boolean {
  if (!declaredCanonical) return false;
  try {
    const canonical = new URL(declaredCanonical, SITE_URL);
    const requested = new URL(requestedUrl, SITE_URL);
    return canonical.origin === SITE_URL
      && requested.origin === SITE_URL
      && absoluteUrl(canonical.pathname) === absoluteUrl(requested.pathname);
  } catch {
    return false;
  }
}

function normalizeInternalPath(value: string | undefined): string | null {
  if (!value || value.startsWith("#") || value.startsWith("javascript:") || value.startsWith("mailto:")) return null;
  try {
    const url = new URL(value, SITE_URL);
    if (url.origin !== SITE_URL || url.search || url.hash) return null;
    return url.pathname === "/" ? "/" : `${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function bingMetricDate(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString().slice(0, 10);
  if (typeof value === "string") {
    const wcf = /\/Date\((-?\d+)(?:[+-]\d{4})?\)\//.exec(value);
    if (wcf) return new Date(Number(wcf[1])).toISOString().slice(0, 10);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  return fallback;
}

function isSupportedBingReportingEndpoint(value: URL | string): boolean {
  try {
    const url = typeof value === "string" ? new URL(value) : value;
    return ["ssl.bing.com", "www.bing.com"].includes(url.hostname.toLowerCase())
      && url.pathname === "/webmaster/api.svc/json/GetPageStats";
  } catch {
    return false;
  }
}

function isLegacyBingEndpoint(value: URL | string): boolean {
  try {
    const url = typeof value === "string" ? new URL(value) : value;
    // Microsoft is retiring SOAP and POX, not JSON/HTTP. Keep this guard
    // precise so the supported JSON endpoint continues working after the
    // 2026-08-31 retirement date.
    return ["ssl.bing.com", "www.bing.com"].includes(url.hostname.toLowerCase())
      && (url.pathname.startsWith("/webmaster/api.svc/pox/") || url.pathname.endsWith("/webmaster/api.svc/soap"));
  } catch {
    return false;
  }
}
