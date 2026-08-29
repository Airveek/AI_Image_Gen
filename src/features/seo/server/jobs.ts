import "server-only";

import { inngest } from "@/features/store-images/server/inngest-client";
import {
  finishSeoJob,
  getSeoIntegrationReadiness,
  startSeoJob,
  upsertSeoAlert,
} from "@/features/seo/server/control-plane";
import { publishSeoPage } from "@/features/seo/server/publishing";
import { crawlEligibleSeoUrls, inspectGoogleUrls, syncGoogleAnalytics, syncGoogleSearchConsole } from "@/features/seo/server/providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo/site";

export const seoSourceSyncHeartbeat = inngest.createFunction(
  {
    id: "seo-source-sync-heartbeat",
    triggers: [{ cron: "TZ=UTC 15 5 * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-source-sync";
    const job = await step.run("claim-source-sync", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${utcDateBucket(event.ts)}`,
      capability: "source-sync",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const readiness = getSeoIntegrationReadiness();
    const configuredCount = [readiness.gsc, readiness.ga4, readiness.bing].filter(Boolean).length;
    if (configuredCount === 0) {
      await step.run("record-missing-source-alert", () => upsertSeoAlert({
        dedupeKey: "seo-source-sync:no-integrations",
        severity: "p1",
        category: "source-configuration",
        title: "SEO data sources are not connected",
        message: "SEO source sync is enabled, but no GSC, GA4, or Bing credentials are available.",
        evidence: readiness,
      }));
      await step.run("skip-source-sync", () => finishSeoJob({
        runId: job.runId,
        loopName,
        status: "skipped",
        note: "No external SEO source is configured; no partial import was attempted.",
      }));
      return { status: "skipped", reason: "not_configured" };
    }

    const metricDate = metricDateBucket(event.ts);
    const outcomes = await step.run("sync-configured-sources", async () => {
      const results: Array<{ provider: string; status: string; error?: string }> = [];
      if (readiness.gsc) {
        try { results.push({ provider: "gsc", ...(await syncGoogleSearchConsole(metricDate)) }); }
        catch (error) { results.push({ provider: "gsc", status: "failed", error: error instanceof Error ? error.message : "unknown_error" }); }
      }
      if (readiness.ga4) {
        try { results.push({ provider: "ga4", ...(await syncGoogleAnalytics(metricDate)) }); }
        catch (error) { results.push({ provider: "ga4", status: "failed", error: error instanceof Error ? error.message : "unknown_error" }); }
      }
      if (readiness.bing) results.push({ provider: "bing", status: "skipped", error: "bing_provider_not_configured" });
      return results;
    });
    const failed = outcomes.filter((result) => result.status === "failed");
    if (failed.length) {
      await step.run("record-source-sync-alert", () => upsertSeoAlert({
        dedupeKey: `seo-source-sync:failed:${metricDate}`,
        severity: "p1",
        category: "source-sync",
        title: "SEO source import failed",
        message: failed.map((result) => `${result.provider}: ${result.error ?? "unknown error"}`).join("; "),
        evidence: { metricDate, outcomes },
      }));
    }
    await step.run("finish-source-sync", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: failed.length === outcomes.length ? "failed" : outcomes.some((result) => result.status === "succeeded") ? "succeeded" : "skipped",
      checkedCount: outcomes.length,
      actedCount: outcomes.filter((result) => result.status === "succeeded").length,
      note: failed.length ? `${failed.length} provider import(s) failed.` : "Configured SEO source imports completed.",
      errorCode: failed.length ? "provider_import_failed" : undefined,
      cursor: { metricDate, outcomes },
    }));
    return { status: failed.length ? "partial" : "succeeded", metricDate, outcomes };
  },
);

export const seoCrawlHeartbeat = inngest.createFunction(
  {
    id: "seo-crawl-heartbeat",
    triggers: [{ cron: "TZ=UTC 30 3 * * 0" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-crawl";
    const job = await step.run("claim-crawl", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${utcWeekBucket(event.ts)}`,
      capability: "crawl",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const queuedUrls = await step.run("count-crawl-queue", async () => {
      const { count, error } = await createSupabaseAdminClient()
        .from("seo_url_state")
        .select("id", { count: "exact", head: true })
        .eq("eligible_for_indexing", true);
      if (error) throw new Error(`SEO crawl queue is unavailable: ${error.code}`);
      return count ?? 0;
    });
    if (queuedUrls === 0) {
      await step.run("finish-empty-crawl", () => finishSeoJob({ runId: job.runId, loopName, status: "succeeded", note: "No eligible URLs are present in the crawl queue.", cursor: { queuedUrls } }));
      return { status: "succeeded", queuedUrls, checkedCount: 0 };
    }
    const crawl = await step.run("crawl-eligible-urls", () => crawlEligibleSeoUrls(job.config.crawlBatchSize));
    await step.run("finish-crawl", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: crawl.checkedCount,
      actedCount: crawl.issueCount,
      note: crawl.issueCount ? `${crawl.issueCount} crawl issue(s) found.` : "No crawl issues found.",
      cursor: { queuedUrls, batchSize: job.config.crawlBatchSize },
    }));
    return { ...crawl, status: "succeeded" as const, queuedUrls };
  },
);

export const seoTrackingQaHeartbeat = inngest.createFunction(
  {
    id: "seo-tracking-qa-heartbeat",
    triggers: [{ cron: "TZ=UTC 45 6 * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-tracking-qa";
    const job = await step.run("claim-tracking-qa", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${utcDateBucket(event.ts)}`,
      capability: "always",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const snapshot = await step.run("read-source-freshness", readSeoSourceFreshness);
    const inspection = getSeoIntegrationReadiness().gsc
      ? await step.run("inspect-google-index", () => inspectGoogleUrls(readInspectionBudget()))
      : { status: "skipped" as const, reason: "gsc_not_configured" };
    const staleSources = Object.entries(snapshot)
      .filter(([, value]) => value.configured && value.stale)
      .map(([source]) => source);
    if (staleSources.length > 0) {
      await step.run("record-stale-source-alert", () => upsertSeoAlert({
        dedupeKey: `seo-tracking-qa:stale:${staleSources.sort().join("-")}`,
        severity: "p1",
        category: "tracking-freshness",
        title: "SEO measurement source is stale",
        message: `No fresh daily data was found for: ${staleSources.join(", ")}. Downstream recommendations must remain paused.`,
        evidence: { sources: staleSources.join(",") },
      }));
    }
    await step.run("finish-tracking-qa", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: Object.values(snapshot).filter((value) => value.configured).length,
      actedCount: staleSources.length + ("inspected" in inspection ? inspection.inspected : 0),
      note: staleSources.length > 0
        ? `${staleSources.length} configured source(s) are stale; alert staged.`
        : "Configured SEO measurement sources are within their freshness windows.",
      cursor: { checkedAt: new Date().toISOString(), inspection },
    }));
    return { status: "succeeded", staleSources, inspection };
  },
);

export const seoIndexNowNotifier = inngest.createFunction(
  {
    id: "seo-indexnow-notifier",
    triggers: [{ event: "seo/page.published" }],
    retries: 3,
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const key = process.env.INDEXNOW_KEY;
    const keyLocation = process.env.INDEXNOW_KEY_LOCATION;
    const canonicalUrl = typeof event.data?.canonicalUrl === "string" ? event.data.canonicalUrl : null;
    const pageId = typeof event.data?.pageId === "string" ? event.data.pageId : null;
    if (!key || !keyLocation || !canonicalUrl || !pageId) {
      return { status: "skipped", reason: "indexnow_not_configured" };
    }

    const siteOrigin = new URL(absoluteUrl("/")).origin;
    if (!isSameOriginUrl(canonicalUrl, siteOrigin) || !isSameOriginUrl(keyLocation, siteOrigin) || !isUuid(pageId)) {
      return { status: "skipped", reason: "invalid_indexnow_payload" };
    }

    const endpoint = process.env.INDEXNOW_ENDPOINT ?? "https://api.indexnow.org/indexnow";
    const response = await step.run("submit-indexnow", async () => {
      const result = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          host: new URL(siteOrigin).hostname,
          key,
          keyLocation,
          urlList: [canonicalUrl],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return { ok: result.ok || result.status === 202, status: result.status };
    });
    const ok = response.ok;
    const client = createSupabaseAdminClient();
    await step.run("record-indexnow-status", async () => {
      await client.from("seo_url_state").update({
        bing_index_status: ok ? "submitted" : `failed:${response.status}`,
        bing_inspected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("page_id", pageId);
      if (!ok) {
        await upsertSeoAlert({
          dedupeKey: `indexnow:${pageId}:${response.status}`,
          severity: "p2",
          category: "indexnow",
          title: "IndexNow submission failed",
          message: `IndexNow returned HTTP ${response.status} for ${canonicalUrl}.`,
          evidence: { pageId, canonicalUrl, status: response.status },
        });
      }
    });
    return { status: ok ? "submitted" : "failed", httpStatus: response.status, pageId };
  },
);

export const seoPublishWaveHeartbeat = inngest.createFunction(
  {
    id: "seo-publish-wave-heartbeat",
    triggers: [{ cron: "TZ=UTC */15 * * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-publish-wave";
    const job = await step.run("claim-publish-wave", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${readEventTimestamp(event.ts)}`,
      capability: "always",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const candidates = await step.run("read-approved-pages", async () => {
      const client = createSupabaseAdminClient();
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { data: previousRuns } = await client
        .from("seo_job_runs")
        .select("acted_count")
        .eq("loop_name", loopName)
        .gte("started_at", startOfDay.toISOString())
        .in("status", ["succeeded", "skipped"]);
      const publishedToday = (previousRuns ?? []).reduce((sum, row) => sum + (typeof row.acted_count === "number" ? row.acted_count : 0), 0);
      const remaining = Math.max(0, job.config.dailyPublishLimit - publishedToday);
      if (remaining === 0) return [];
      const { data, error } = await client
        .from("seo_pages")
        .select("id")
        .in("status", ["approved", "scheduled"])
        .eq("noindex", true)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(Math.min(job.config.dailyPublishWaveSize, remaining));
      if (error) throw new Error(`SEO publish queue is unavailable: ${error.code}`);
      return (data ?? []).map((row) => String((row as { id: unknown }).id));
    });
    const results = await step.run("publish-approved-pages", async () => Promise.all(candidates.map((pageId) => publishSeoPage(pageId))));
    const published = results.filter((result) => result.published).length;
    const blocked = results.length - published;
    await step.run("finish-publish-wave", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: candidates.length,
      actedCount: published,
      note: blocked > 0
        ? `${published} pages published; ${blocked} remained blocked by the evidence or rollout gate.`
        : `${published} pages published from the approved queue.`,
      cursor: { checkedAt: new Date().toISOString(), candidates: candidates.length },
    }));
    return { status: "succeeded", candidates: candidates.length, published, blocked };
  },
);

export const seoFunctions = [seoSourceSyncHeartbeat, seoCrawlHeartbeat, seoTrackingQaHeartbeat, seoIndexNowNotifier, seoPublishWaveHeartbeat];

async function readSeoSourceFreshness() {
  const readiness = getSeoIntegrationReadiness();
  const client = createSupabaseAdminClient();
  const [gsc, ga4, bing] = await Promise.all([
    latestMetricDate("seo_gsc_page_daily"),
    latestMetricDate("seo_ga4_landing_daily"),
    latestMetricDate("seo_bing_page_daily"),
  ]);
  return {
    gsc: sourceFreshness(readiness.gsc, gsc, 5),
    ga4: sourceFreshness(readiness.ga4, ga4, 4),
    bing: sourceFreshness(readiness.bing, bing, 5),
  };

  async function latestMetricDate(table: string): Promise<string | null> {
    const { data, error } = await client.from(table).select("metric_date").order("metric_date", { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return typeof data?.metric_date === "string" ? data.metric_date : null;
  }
}

function sourceFreshness(configured: boolean, metricDate: string | null, allowedLagDays: number) {
  const ageMs = metricDate ? Date.now() - Date.parse(`${metricDate}T00:00:00Z`) : Number.POSITIVE_INFINITY;
  return {
    configured,
    stale: configured && (!Number.isFinite(ageMs) || ageMs > allowedLagDays * 86_400_000),
  };
}

function utcDateBucket(timestamp: unknown): string {
  return new Date(readEventTimestamp(timestamp)).toISOString().slice(0, 10);
}

function metricDateBucket(timestamp: unknown): string {
  const date = new Date(readEventTimestamp(timestamp) - 2 * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function readInspectionBudget(): number {
  const parsed = Number(process.env.SEO_GSC_INSPECTION_DAILY_BUDGET ?? 20);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10_000, Math.floor(parsed))) : 20;
}

function utcWeekBucket(timestamp: unknown): string {
  const date = new Date(readEventTimestamp(timestamp));
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function readEventTimestamp(timestamp: unknown): number {
  return typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : Date.now();
}

function isSameOriginUrl(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin;
  } catch {
    return false;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
