import "server-only";

import { randomUUID } from "node:crypto";
import { inngest } from "@/features/store-images/server/inngest-client";
import {
  finishSeoJob,
  getSeoIntegrationReadiness,
  startSeoJob,
  upsertSeoAlert,
  upsertSeoRecommendation,
} from "@/features/seo/server/control-plane";
import { publishSeoPage } from "@/features/seo/server/publishing";
import { crawlEligibleSeoUrls, crawlSeoPage, inspectGoogleUrls, submitGoogleSitemap, syncBingWebmaster, syncGoogleAnalytics, syncGoogleSearchConsole } from "@/features/seo/server/providers";
import { buildSeoAgentEnvelope, postSeoAgentEnvelope, sha256Hex, type SeoAgentBrief } from "@/features/seo/server/agent-dispatch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo/site";
import { CORE_WEB_VITAL_BUDGETS, type CoreWebVitalName } from "@/lib/seo/performance";
import { chooseSeoImportMetricDate, type SeoImportSource } from "@/features/seo/server/import-watermarks";
import { summarizePublishPropagation } from "@/features/seo/server/publish-propagation";
import { shouldReturnPublishCandidateToReview } from "@/features/seo/server/publish-wave";

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
        try { results.push({ provider: "gsc", ...(await runWatermarkedSeoImport("gsc", metricDate, syncGoogleSearchConsole)) }); }
        catch (error) { results.push({ provider: "gsc", status: "failed", error: error instanceof Error ? error.message : "unknown_error" }); }
      }
      if (readiness.ga4) {
        try { results.push({ provider: "ga4", ...(await runWatermarkedSeoImport("ga4", metricDate, syncGoogleAnalytics)) }); }
        catch (error) { results.push({ provider: "ga4", status: "failed", error: error instanceof Error ? error.message : "unknown_error" }); }
      }
      if (readiness.bing) {
        try { results.push({ provider: "bing", ...(await runWatermarkedSeoImport("bing", metricDate, syncBingWebmaster)) }); }
        catch (error) { results.push({ provider: "bing", status: "failed", error: error instanceof Error ? error.message : "unknown_error" }); }
      }
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
        .or("eligible_for_indexing.eq.true,last_crawled_at.not.is.null");
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

export const seoPageProbeHeartbeat = inngest.createFunction(
  {
    id: "seo-page-probe-heartbeat",
    triggers: [{ cron: "TZ=UTC */15 * * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-page-probes";
    const job = await step.run("claim-page-probes", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${readEventTimestamp(event.ts)}`,
      capability: "monitoring",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const candidates = await step.run("read-due-page-probes", async () => {
      const client = createSupabaseAdminClient();
      const { data, error } = await client
        .from("seo_url_state")
        .select("page_id,canonical_url,first_published_at")
        .not("first_published_at", "is", null)
        .order("first_published_at", { ascending: true })
        .limit(2_000);
      if (error) throw new Error(`SEO probe queue is unavailable: ${error.code}`);
      const rows = (data ?? []).flatMap((row) => {
        const pageId = typeof row.page_id === "string" ? row.page_id : null;
        const canonicalUrl = typeof row.canonical_url === "string" ? row.canonical_url : null;
        const publishedAt = typeof row.first_published_at === "string" ? Date.parse(row.first_published_at) : Number.NaN;
        if (!pageId || !canonicalUrl || !Number.isFinite(publishedAt)) return [];
        return [{ pageId, canonicalUrl, publishedAt }];
      });
      if (!rows.length) return [];
      const pageIds = rows.map((row) => row.pageId);
      const { data: existing, error: existingError } = await client
        .from("seo_page_probes")
        .select("page_id,stage")
        .in("page_id", pageIds);
      if (existingError) throw new Error(`SEO probe history is unavailable: ${existingError.code}`);
      const seen = new Set((existing ?? []).map((row) => `${String(row.page_id)}:${String(row.stage)}`));
      const now = Date.now();
      const stages = [
        ["five_minutes", 5 * 60_000],
        ["one_day", 24 * 60 * 60_000],
        ["seven_days", 7 * 24 * 60 * 60_000],
      ] as const;
      return rows.flatMap((row) => stages.flatMap(([stage, delayMs]) => {
        const dueAt = row.publishedAt + delayMs;
        return now >= dueAt && !seen.has(`${row.pageId}:${stage}`)
          ? [{ ...row, stage, scheduledFor: new Date(dueAt).toISOString() }]
          : [];
      })).slice(0, 100);
    });

    const results = await step.run("run-page-probes", async () => {
      const client = createSupabaseAdminClient();
      const outcomes: Array<{ pageId: string; stage: string; status: "pass" | "fail"; issueCount: number }> = [];
      for (const candidate of candidates) {
        const result = await crawlSeoPage(candidate.canonicalUrl);
        const status = result.status === 200 && result.issueCodes.length === 0 ? "pass" : "fail";
        const { error: probeError } = await client.from("seo_page_probes").upsert({
          page_id: candidate.pageId,
          canonical_url: candidate.canonicalUrl,
          stage: candidate.stage,
          scheduled_for: candidate.scheduledFor,
          checked_at: new Date().toISOString(),
          status,
          http_status: result.status,
          response_ms: result.responseMs,
          declared_canonical_url: result.declaredCanonical,
          robots_directive: result.robots,
          title: result.title,
          h1_count: result.h1Count,
          schema_types: result.schemaTypes,
          content_hash: result.contentHash,
          issue_codes: result.issueCodes,
        }, { onConflict: "page_id,stage" });
        if (probeError) throw new Error(`SEO page probe persistence failed: ${probeError.code}`);
        const checkedAt = new Date().toISOString();
        const { error: stateError } = await client.from("seo_url_state").update({
          eligible_for_indexing: status === "pass",
          last_crawled_at: checkedAt,
          last_http_status: result.status,
          last_canonical_url: result.declaredCanonical,
          last_robots_directive: result.robots,
          updated_at: checkedAt,
        }).eq("page_id", candidate.pageId);
        if (stateError) throw new Error(`SEO page probe URL state update failed: ${stateError.code}`);
        if (status === "fail") {
          await upsertSeoAlert({
            dedupeKey: `seo-page-probe:${candidate.pageId}:${candidate.stage}`,
            severity: "p1",
            category: "published-page-health",
            title: "Published SEO page failed a health probe",
            message: `${candidate.canonicalUrl} failed its ${candidate.stage.replace("_", " ")} probe: ${result.issueCodes.join(", ") || "non-200 response"}.`,
            evidence: { pageId: candidate.pageId, stage: candidate.stage, canonicalUrl: candidate.canonicalUrl, status: result.status, issueCodes: result.issueCodes },
          });
        }
        outcomes.push({ pageId: candidate.pageId, stage: candidate.stage, status, issueCount: result.issueCodes.length });
      }
      return outcomes;
    });
    await step.run("finish-page-probes", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: candidates.length,
      actedCount: results.filter((result) => result.status === "pass").length,
      note: results.some((result) => result.status === "fail")
        ? `${results.filter((result) => result.status === "fail").length} probe(s) failed and were alerted.`
        : `${results.length} scheduled probe(s) passed.`,
      cursor: { checkedAt: new Date().toISOString(), stages: ["five_minutes", "one_day", "seven_days"] },
    }));
    return { status: "succeeded", checked: results.length, failed: results.filter((result) => result.status === "fail").length };
  },
);

export const seoSurfaceHeartbeat = inngest.createFunction(
  {
    id: "seo-surface-heartbeat",
    triggers: [{ cron: "TZ=UTC 0 * * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const loopName = "seo-surface";
    const job = await step.run("claim-seo-surface", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${new Date().toISOString().slice(0, 13)}`,
      capability: "monitoring",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const checks = await step.run("check-public-seo-surface", async () => {
      const targets = [
        { name: "robots", url: absoluteUrl("/robots.txt"), marker: "Sitemap:" },
        { name: "sitemap", url: absoluteUrl("/sitemap.xml"), marker: "<sitemapindex" },
        { name: "static-sitemap", url: absoluteUrl("/sitemaps/static.xml"), marker: "<urlset" },
      ];
      return Promise.all(targets.map(async (target) => {
        try {
          const response = await fetch(target.url, { signal: AbortSignal.timeout(10_000) });
          const body = await response.text();
          return { ...target, status: response.status, healthy: response.status === 200 && body.includes(target.marker) };
        } catch {
          return { ...target, status: null, healthy: false };
        }
      }));
    });
    const failures = checks.filter((check) => !check.healthy);
    if (failures.length) {
      await step.run("alert-seo-surface", () => upsertSeoAlert({
        dedupeKey: "seo-surface:unhealthy",
        severity: "p0",
        category: "technical-seo",
        title: "Public SEO discovery surface is unhealthy",
        message: failures.map((failure) => `${failure.name} (${failure.status ?? "fetch failed"})`).join(", "),
        evidence: { checks },
      }));
    }
    await step.run("finish-seo-surface", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: failures.length ? "failed" : "succeeded",
      checkedCount: checks.length,
      actedCount: failures.length,
      note: failures.length ? `${failures.length} public SEO surface check(s) failed.` : "Robots and sitemap endpoints are healthy.",
      errorCode: failures.length ? "seo_surface_unhealthy" : undefined,
      cursor: { checkedAt: new Date().toISOString(), checks },
    }));
    return { status: failures.length ? "failed" : "succeeded", checks };
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
      capability: "monitoring",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const snapshot = await step.run("read-source-freshness", readSeoSourceFreshness);
    const vitalHealth = await step.run("read-core-web-vital-health", () => readCoreWebVitalHealth(28));
    const inspection = getSeoIntegrationReadiness().gsc
      ? await step.run("inspect-google-index", () => inspectGoogleUrls(readInspectionBudget()))
      : { status: "skipped" as const, reason: "gsc_not_configured" };
    const staleSources = Object.entries(snapshot)
      .filter(([, value]) => value.configured && value.stale)
      .map(([source]) => source);
    const inspectionFailures = "failed" in inspection ? inspection.failed : 0;
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
    const vitalBreaches = Object.entries(vitalHealth).flatMap(([name, metric]) => {
      if (!metric || metric.sampleCount < 20) return [];
      const vitalName = name as CoreWebVitalName;
      return metric.p75 > CORE_WEB_VITAL_BUDGETS[vitalName] ? [{ name: vitalName, ...metric, budget: CORE_WEB_VITAL_BUDGETS[vitalName] }] : [];
    });
    if (vitalBreaches.length > 0) {
      await step.run("record-core-web-vital-alert", () => upsertSeoAlert({
        dedupeKey: `seo-tracking-qa:cwv:${vitalBreaches.map((item) => item.name).sort().join("-")}`,
        severity: "p1",
        category: "performance",
        title: "Core Web Vitals budget exceeded",
        message: vitalBreaches.map((item) => `${item.name.toUpperCase()} P75 ${item.p75.toFixed(1)} exceeds ${item.budget}`).join("; "),
        evidence: { sinceDays: 28, vitalBreaches },
      }));
    }
    await step.run("finish-tracking-qa", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: Object.values(snapshot).filter((value) => value.configured).length,
      actedCount: staleSources.length + vitalBreaches.length + ("inspected" in inspection ? inspection.inspected : 0),
      note: staleSources.length > 0
        ? `${staleSources.length} configured source(s) are stale; alert staged.`
        : vitalBreaches.length > 0
          ? `${vitalBreaches.length} Core Web Vital budget(s) are exceeded; alert staged.`
        : inspectionFailures > 0
          ? `${inspectionFailures} URL inspection(s) failed; alerts staged and URLs remain queued for retry.`
        : "Configured SEO measurement sources are within their freshness windows.",
      cursor: { checkedAt: new Date().toISOString(), inspection, vitalHealth },
    }));
    return { status: "succeeded", staleSources, vitalHealth, vitalBreaches, inspection };
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
      const { error: stateError } = await client.from("seo_url_state").update({
        bing_index_status: ok ? "submitted" : `failed:${response.status}`,
        bing_inspected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("page_id", pageId);
      if (stateError) throw new Error(`IndexNow status persistence failed: ${stateError.code}`);
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

/**
 * Re-submit the sitemap index at a bounded cadence. Search Console owns the
 * crawl schedule; this only tells it that the index changed after a publish
 * wave, and never submits individual content URLs through the Indexing API.
 */
export const seoSitemapSubmitHeartbeat = inngest.createFunction(
  {
    id: "seo-sitemap-submit",
    triggers: [{ cron: "TZ=UTC 10 */6 * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-sitemap-submit";
    const job = await step.run("claim-sitemap-submit", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${utcDateBucket(event.ts)}:${Math.floor(readEventTimestamp(event.ts) / (6 * 60 * 60 * 1_000))}`,
      capability: "always",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    try {
      const result = await step.run("submit-google-sitemap", submitGoogleSitemap);
      await step.run("finish-sitemap-submit", () => finishSeoJob({
        runId: job.runId,
        loopName,
        status: result.status === "succeeded" ? "succeeded" : "skipped",
        actedCount: result.status === "succeeded" ? 1 : 0,
        note: result.status === "succeeded" ? "Google Search Console sitemap index submitted." : "Google Search Console sitemap submission is not configured.",
        cursor: result,
      }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 4_000) : "Google sitemap submission failed.";
      await step.run("alert-sitemap-submit", () => upsertSeoAlert({
        dedupeKey: `seo-sitemap-submit:${utcDateBucket(event.ts)}`,
        severity: "p1",
        category: "gsc-sitemap",
        title: "Google Search Console sitemap submission failed",
        message,
        evidence: { sitemapUrl: absoluteUrl("/sitemap.xml") },
      }));
      await step.run("finish-sitemap-submit-failed", () => finishSeoJob({
        runId: job.runId,
        loopName,
        status: "failed",
        note: message,
        errorCode: "gsc_sitemap_submit_failed",
      }));
      return { status: "failed" as const, error: message };
    }
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

    const queue = await step.run("read-approved-pages", async () => {
      const client = createSupabaseAdminClient();
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { data: previousRuns, error: previousRunsError } = await client
        .from("seo_job_runs")
        .select("acted_count")
        .eq("loop_name", loopName)
        .gte("started_at", startOfDay.toISOString())
        .in("status", ["succeeded", "skipped"]);
      if (previousRunsError) throw new Error(`SEO publish history is unavailable: ${previousRunsError.code}`);
      const publishedToday = (previousRuns ?? []).reduce((sum, row) => sum + (typeof row.acted_count === "number" ? row.acted_count : 0), 0);
      const remaining = Math.max(0, job.config.dailyPublishLimit - publishedToday);
      if (remaining === 0) return { pageIds: [], batchId: null as string | null, cohortId: null as string | null, wave: null as number | null };
      const { data, error } = await client
        .from("seo_pages")
        .select("id")
        .in("status", ["approved", "scheduled"])
        .eq("noindex", true)
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(Math.min(job.config.dailyPublishWaveSize, remaining));
      if (error) throw new Error(`SEO publish queue is unavailable: ${error.code}`);
      const pageIds = (data ?? []).map((row) => String((row as { id: unknown }).id));
      if (!pageIds.length) return { pageIds, batchId: null as string | null, cohortId: null as string | null, wave: null as number | null };

      const cohortId = `auto-${startOfDay.toISOString().slice(0, 10)}`;
      const { data: latestBatch, error: latestBatchError } = await client
        .from("seo_publish_batches")
        .select("wave")
        .eq("cohort_id", cohortId)
        .order("wave", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestBatchError) throw new Error(`SEO publish batch history is unavailable: ${latestBatchError.code}`);
      const wave = Number(latestBatch?.wave ?? 0) + 1;
      if (!Number.isInteger(wave) || wave > 4) return { pageIds: [], batchId: null, cohortId, wave: null };

      const { data: publisher, error: publisherError } = await client
        .from("content_members")
        .select("user_id")
        .in("role", ["publisher", "seo_admin"])
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (publisherError) throw new Error(`SEO publisher lookup is unavailable: ${publisherError.code}`);
      if (!publisher?.user_id) {
        await upsertSeoAlert({
          dedupeKey: "seo-publish-wave:no-publisher-member",
          severity: "p1",
          category: "publishing-configuration",
          title: "SEO publishing is waiting for a publisher member",
          message: "Create an active publisher or SEO-admin content member before enabling automated waves.",
          evidence: { cohortId, candidateCount: pageIds.length },
        });
        return { pageIds: [], batchId: null, cohortId, wave: null };
      }

      const now = new Date().toISOString();
      const { data: batch, error: batchError } = await client
        .from("seo_publish_batches")
        .insert({ cohort_id: cohortId, wave, status: "running", scheduled_for: now, started_at: now, created_by: publisher.user_id })
        .select("id")
        .single();
      if (batchError || !batch) throw new Error(`SEO publish batch could not be created: ${batchError?.code ?? "unknown"}`);
      const { error: pagesError } = await client.from("seo_publish_batch_pages").insert(pageIds.map((pageId) => ({ batch_id: batch.id, page_id: pageId, status: "pending" })));
      if (pagesError) {
        // The batch header is not useful without its complete page ledger. A
        // failed insert is removed immediately so a later wave cannot mistake
        // this partial setup for an in-flight publish. If cleanup itself fails,
        // retain the evidence and alert an operator rather than hiding the
        // orphaned batch behind a generic retry.
        const { error: cleanupError } = await client
          .from("seo_publish_batches")
          .delete()
          .eq("id", batch.id);
        if (cleanupError) {
          await upsertSeoAlert({
            dedupeKey: `seo-publish-wave:orphaned-batch:${batch.id}`,
            severity: "p0",
            category: "publishing",
            title: "SEO publish batch cleanup failed",
            message: "A publish batch header was created but its page ledger could not be inserted or cleaned up. Keep publishing paused until the orphaned batch is reviewed.",
            evidence: { batchId: batch.id, pageCount: pageIds.length, pagesError: pagesError.code ?? "unknown", cleanupError: cleanupError.code ?? "unknown" },
          });
          throw new Error(`SEO publish batch pages failed (${pagesError.code ?? "unknown"}); cleanup failed (${cleanupError.code ?? "unknown"})`);
        }
        throw new Error(`SEO publish batch pages could not be created: ${pagesError.code ?? "unknown"}`);
      }
      return { pageIds, batchId: String(batch.id), cohortId, wave };
    });
    const candidates = queue.pageIds;
    const results = queue.batchId
      ? await step.run("publish-approved-pages", async () => Promise.all(candidates.map((pageId) => publishSeoPage(pageId, { batchId: queue.batchId ?? undefined }))))
      : [];
    const propagation = summarizePublishPropagation(results);
    const { published, indexNowQueued, indexNowFailed } = propagation;
    const blocked = results.length - published;
    if (queue.batchId) {
      await step.run("finish-publish-batch", async () => {
        const client = createSupabaseAdminClient();
        for (const [index, result] of results.entries()) {
          if (!result.published) {
            const { error } = await client
              .from("seo_publish_batch_pages")
              .update({ status: "replaced", error_message: result.blockers.join(", ").slice(0, 1_000), updated_at: new Date().toISOString() })
              .eq("batch_id", queue.batchId)
              .eq("page_id", candidates[index]);
            if (error) throw new Error(`SEO publish batch page finalization failed: ${error.code}`);

            // Do not select a permanently invalid page again on the next
            // wave. Return quality/evidence failures to editorial review so
            // the approved buffer can supply a replacement. Transient
            // configuration, persistence, and race failures stay retryable.
            if (shouldReturnPublishCandidateToReview(result.blockers)) {
              const { error: reviewError } = await client
                .from("seo_pages")
                .update({ status: "changes_requested", noindex: true, updated_at: new Date().toISOString() })
                .eq("id", candidates[index])
                .in("status", ["approved", "scheduled"]);
              if (reviewError) throw new Error(`SEO publish candidate review transition failed: ${reviewError.code}`);
            }
          }
        }
        const { error: batchUpdateError } = await client.from("seo_publish_batches").update({
          status: blocked ? (published ? "partial" : "failed") : "complete",
          sitemap_status: published ? "ready" : "failed",
          indexnow_status: propagation.indexNowStatus,
          finished_at: new Date().toISOString(),
        }).eq("id", queue.batchId);
        if (batchUpdateError) throw new Error(`SEO publish batch finalization failed: ${batchUpdateError.code}`);
      });
    }
    await step.run("finish-publish-wave", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: candidates.length,
      actedCount: published,
      note: queue.batchId === null && candidates.length > 0
        ? "Publishing was paused because no active publisher member is configured."
        : blocked > 0
        ? `${published} pages published; ${blocked} remained blocked by the evidence or rollout gate${indexNowFailed > 0 ? `; ${indexNowFailed} IndexNow notification(s) failed` : ""}.`
        : `${published} pages published from the approved queue${indexNowFailed > 0 ? `; ${indexNowFailed} IndexNow notification(s) failed` : ""}.`,
      cursor: { checkedAt: new Date().toISOString(), candidates: candidates.length, published, indexNowQueued, indexNowFailed, batchId: queue.batchId, cohortId: queue.cohortId, wave: queue.wave },
    }));
    return { status: "succeeded", candidates: candidates.length, published, blocked, indexNowQueued, indexNowFailed, batchId: queue.batchId, cohortId: queue.cohortId, wave: queue.wave };
  },
);

/**
 * Dispatch assigned briefs to the configured content agent. The worker only
 * creates a signed, resumable handoff; its callback ingests a non-live draft
 * and may record instant editorial approval after deterministic checks. It
 * never bypasses the technical publish gate.
 */
export const seoContentAgentDispatchHeartbeat = inngest.createFunction(
  {
    id: "seo-content-agent-dispatch",
    // Keep the handoff cadence aligned with the owner-operated bridge: a
    // brief can enter the external worker queue every five minutes while the
    // configured batch size and downstream evidence gates remain the controls
    // on actual throughput.
    triggers: [{ cron: "TZ=UTC */5 * * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-content-agent-dispatch";
    const job = await step.run("claim-content-agent-dispatch", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${readEventTimestamp(event.ts)}`,
      capability: "always",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    // The owner-operated Codex bridge is the execution worker when the
    // workstation is intentionally running local browser automation. Keep
    // the hosted Inngest heartbeat quiet in that mode: it must not raise a
    // misleading "worker not configured" alert or compete for the same brief.
    const localAgentOnly = process.env.SEO_CONTENT_AGENT_LOCAL_ONLY?.trim().toLowerCase() === "true";
    if (localAgentOnly) {
      await step.run("finish-agent-local-only", () => finishSeoJob({
        runId: job.runId,
        loopName,
        status: "skipped",
        note: "Local Codex content-agent mode is enabled; hosted dispatch intentionally skipped.",
      }));
      return { status: "skipped", reason: "local_agent_only" };
    }

    const endpoint = process.env.SEO_CONTENT_AGENT_WEBHOOK_URL?.trim();
    const signingSecret = process.env.SEO_CONTENT_AGENT_SIGNING_SECRET?.trim();
    if (!endpoint || !signingSecret) {
      await step.run("alert-agent-not-configured", () => upsertSeoAlert({
        dedupeKey: "seo-content-agent:not-configured",
        severity: "p1",
        category: "content-production",
        title: "SEO content agent dispatch is not configured",
        message: "Briefs remain review-gated because SEO_CONTENT_AGENT_WEBHOOK_URL and SEO_CONTENT_AGENT_SIGNING_SECRET are not configured.",
      }));
      await step.run("finish-agent-not-configured", () => finishSeoJob({
        runId: job.runId,
        loopName,
        status: "skipped",
        note: "Content agent dispatch is not configured; no brief was claimed.",
      }));
      return { status: "skipped", reason: "agent_not_configured" };
    }

    const candidates = await step.run("read-agent-queue", async () => {
      const client = createSupabaseAdminClient();
      const batchSize = boundedInteger(process.env.SEO_CONTENT_AGENT_BATCH_SIZE, 5, 1, 25);
      const { data: briefs, error: briefError } = await client
        .from("seo_content_briefs")
        .select("id,brief_key,topic_id,page_family,product_entity,primary_query,normalized_intent_key,buyer_question,locale,template_version,priority,due_at,brief,demand_evidence,updated_at")
        .in("status", ["ready_for_assignment", "assigned"])
        .order("priority", { ascending: false })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(batchSize * 3);
      if (briefError) throw new Error(`SEO content-agent brief queue is unavailable: ${briefError.code}`);
      const rows = briefs ?? [];
      if (!rows.length) return [];
      const briefIds = rows.map((row) => String(row.id));
      const [{ data: assignments, error: assignmentError }, { data: activeRuns, error: runError }, { data: activeWriters, error: writerError }, { data: keywordEvidence, error: keywordEvidenceError }] = await Promise.all([
        client
          .from("seo_content_assignments")
          .select("id,brief_id,assignee_id,assignment_role,status")
          .in("brief_id", briefIds)
          .eq("assignment_role", "writer")
          .in("status", ["assigned", "accepted", "in_progress"]),
        client
          .from("seo_agent_runs")
          .select("brief_id,dispatch_key,status,next_attempt_at")
          .in("brief_id", briefIds)
          .in("status", ["queued", "sent", "accepted", "processing", "failed"]),
        client
          .from("content_members")
          .select("user_id")
          .eq("role", "writer")
          .eq("is_active", true),
        client
          .from("seo_keyword_evidence")
          .select("brief_id,source,query,canonical_url,metric_date,country,device,search_type,clicks,impressions,ctr,position,volume,competition,source_url,source_title,confidence,metadata")
          .in("brief_id", briefIds)
          .order("impressions", { ascending: false })
          .order("metric_date", { ascending: false })
          .limit(Math.min(batchSize * 20, 500)),
      ]);
      if (assignmentError || runError || writerError || keywordEvidenceError) throw new Error(`SEO content-agent handoff queue is unavailable: ${assignmentError?.code ?? runError?.code ?? writerError?.code ?? keywordEvidenceError?.code ?? "unknown"}`);
      const activeWriterIds = new Set((activeWriters ?? []).map((member) => String(member.user_id)));
      const writerByBrief = new Map<string, { id: string; assigneeId: string }>();
      for (const assignment of assignments ?? []) {
        const briefId = String(assignment.brief_id);
        if (!activeWriterIds.has(String(assignment.assignee_id))) continue;
        if (!writerByBrief.has(briefId)) writerByBrief.set(briefId, { id: String(assignment.id), assigneeId: String(assignment.assignee_id) });
      }
      const activeDispatches = new Set<string>();
      const retryAtByBrief = new Map<string, number>();
      for (const run of activeRuns ?? []) {
        const briefId = String(run.brief_id);
        if (["queued", "sent", "accepted", "processing"].includes(String(run.status))) activeDispatches.add(briefId);
        if (run.status === "failed" && typeof run.next_attempt_at === "string") {
          const retryAt = Date.parse(run.next_attempt_at);
          if (Number.isFinite(retryAt)) retryAtByBrief.set(briefId, Math.max(retryAtByBrief.get(briefId) ?? 0, retryAt));
        }
      }
      const evidenceByBrief = new Map<string, SeoAgentBrief["keywordEvidence"]>();
      for (const row of keywordEvidence ?? []) {
        const briefId = String(row.brief_id ?? "");
        if (!briefId) continue;
        const bucket: SeoAgentBrief["keywordEvidence"] = evidenceByBrief.get(briefId) ?? [];
        if (bucket.length < 20) bucket.push({
          source: String(row.source ?? "manual"),
          query: String(row.query ?? ""),
          canonicalUrl: String(row.canonical_url ?? ""),
          metricDate: String(row.metric_date ?? ""),
          country: String(row.country ?? "all"),
          device: String(row.device ?? "all"),
          searchType: String(row.search_type ?? "web"),
          clicks: Number(row.clicks ?? 0),
          impressions: Number(row.impressions ?? 0),
          ctr: row.ctr == null ? null : Number(row.ctr),
          position: row.position == null ? null : Number(row.position),
          volume: row.volume == null ? null : Number(row.volume),
          competition: row.competition == null ? null : Number(row.competition),
          sourceUrl: typeof row.source_url === "string" ? row.source_url : null,
          sourceTitle: typeof row.source_title === "string" ? row.source_title : null,
          confidence: Number(row.confidence ?? 0),
          metadata: isRecord(row.metadata) ? row.metadata : {},
        });
        evidenceByBrief.set(briefId, bucket);
      }
      return rows.flatMap((row) => {
        const briefId = String(row.id);
        const writer = writerByBrief.get(briefId);
        if (!writer || activeDispatches.has(briefId)) return [];
        if ((retryAtByBrief.get(briefId) ?? 0) > Date.now()) return [];
        const updatedAt = typeof row.updated_at === "string" ? row.updated_at : String(row.updated_at ?? "");
        const dispatchKey = `seo-agent:${briefId}:${updatedAt}`.slice(0, 240);
        return [{
          id: briefId,
          briefKey: String(row.brief_key),
          topicId: String(row.topic_id),
          pageFamily: String(row.page_family),
          productEntity: String(row.product_entity),
          primaryQuery: String(row.primary_query),
          normalizedIntentKey: String(row.normalized_intent_key),
          buyerQuestion: String(row.buyer_question),
          locale: String(row.locale),
          templateVersion: String(row.template_version),
          priority: Number(row.priority ?? 0),
          dueAt: typeof row.due_at === "string" ? row.due_at : null,
          brief: isRecord(row.brief) ? row.brief : {},
          demandEvidence: Array.isArray(row.demand_evidence) ? row.demand_evidence : [],
          keywordEvidence: evidenceByBrief.get(briefId) ?? [],
          assignmentId: writer.id,
          assigneeId: writer.assigneeId,
          dispatchKey,
        }];
      }).slice(0, batchSize);
    });

    const outcomes = [] as Array<{ briefId: string; status: string; dispatchId?: string; externalRunId?: string | null; error?: string }>;
    for (const candidate of candidates) {
      const outcome = await step.run(`dispatch-agent-${candidate.id}`, async () => {
        const client = createSupabaseAdminClient();
        const dispatchId = randomUUID();
        const envelope = buildSeoAgentEnvelope({ dispatchId, dispatchKey: candidate.dispatchKey, brief: candidate });
        const rawEnvelope = JSON.stringify(envelope);
        const requestChecksum = sha256Hex(rawEnvelope);
        const { error: insertError } = await client.from("seo_agent_runs").insert({
          id: dispatchId,
          brief_id: candidate.id,
          assignment_id: candidate.assignmentId,
          dispatch_key: candidate.dispatchKey,
          request_checksum: requestChecksum,
          status: "queued",
          attempt_count: 1,
        });
        if (insertError?.code === "23505") return { briefId: candidate.id, status: "duplicate" };
        if (insertError) throw new Error(`SEO agent run could not be queued: ${insertError.code}`);

        const sentAt = new Date().toISOString();
        const { data: sentRun, error: sentError } = await client
          .from("seo_agent_runs")
          .update({ status: "sent", sent_at: sentAt, updated_at: sentAt })
          .eq("id", dispatchId)
          .eq("status", "queued")
          .select("id")
          .maybeSingle();
        if (sentError || !sentRun) {
          // Never call the external worker unless the durable run is visibly
          // in `sent`; the callback intentionally rejects `queued` runs.
          const stateError = `SEO agent run could not be marked sent: ${sentError?.code ?? "run_state_changed"}`;
          await client
            .from("seo_agent_runs")
            .update({ status: "failed", last_error: stateError.slice(0, 4_000), completed_at: sentAt, updated_at: sentAt })
            .eq("id", dispatchId)
            .eq("status", "queued");
          throw new Error(stateError);
        }
        try {
          const result = await postSeoAgentEnvelope(envelope);
          const completedAt = new Date().toISOString();
          if (result.accepted) {
            const acceptedMetadata = isRecord(result.metadata) ? result.metadata : {};
            const stateErrors: string[] = [];
            const { data: acceptedRun, error: acceptedRunError } = await client.from("seo_agent_runs").update({
              status: "accepted",
              external_run_id: result.externalRunId,
              response_metadata: result.metadata,
              accepted_at: completedAt,
              updated_at: completedAt,
            }).eq("id", dispatchId).eq("status", "sent").select("id").maybeSingle();
            if (acceptedRunError || !acceptedRun) {
              // The external worker has already accepted the handoff. Retry
              // only the durable state transition; never repost the envelope.
              const { data: retriedAcceptedRun, error: retryError } = await client.from("seo_agent_runs").update({
                status: "accepted",
                external_run_id: result.externalRunId,
                response_metadata: result.metadata,
                accepted_at: completedAt,
                updated_at: completedAt,
              }).eq("id", dispatchId).in("status", ["sent", "accepted"]).select("id").maybeSingle();
              if (retryError || !retriedAcceptedRun) stateErrors.push(`agent_run_acceptance_persist_failed:${retryError?.code ?? acceptedRunError?.code ?? "state_changed"}`);
            }

            const { data: acceptedAssignment, error: assignmentStateError } = await client
              .from("seo_content_assignments")
              .update({ status: "in_progress", started_at: sentAt, updated_at: completedAt })
              .eq("id", candidate.assignmentId)
              .in("status", ["assigned", "accepted", "in_progress"])
              .select("id")
              .maybeSingle();
            if (assignmentStateError || !acceptedAssignment) stateErrors.push(`assignment_acceptance_persist_failed:${assignmentStateError?.code ?? "state_changed"}`);

            const { data: acceptedBrief, error: briefStateError } = await client
              .from("seo_content_briefs")
              .update({ status: "in_progress", updated_at: completedAt })
              .eq("id", candidate.id)
              .in("status", ["ready_for_assignment", "assigned", "in_progress"])
              .select("id")
              .maybeSingle();
            if (briefStateError || !acceptedBrief) stateErrors.push(`brief_acceptance_persist_failed:${briefStateError?.code ?? "state_changed"}`);

            if (stateErrors.length) {
              const stateError = stateErrors.join(", ").slice(0, 4_000);
              // Keep an accepted run in-flight so the recovery heartbeat will
              // block it for review rather than requeueing external work.
              const { error: stateErrorWrite } = await client.from("seo_agent_runs").update({
                last_error: stateError,
                response_metadata: { ...acceptedMetadata, stateErrors },
                updated_at: completedAt,
              }).eq("id", dispatchId).in("status", ["accepted", "sent"]);
              if (stateErrorWrite) stateErrors.push(`accepted_state_error_persist_failed:${stateErrorWrite.code}`);
              await upsertSeoAlert({
                dedupeKey: `seo-content-agent:accepted-state:${dispatchId}`,
                severity: "p1",
                category: "content-production",
                title: "Accepted SEO content-agent state needs repair",
                message: "The external content agent accepted a brief, but one or more local queue records could not be reconciled. The run remains non-requeueable for manual review.",
                evidence: { briefId: candidate.id, dispatchId, stateErrors },
              });
            }
            const auditError = await recordSeoAgentAudit(client, {
              briefId: candidate.id,
              action: stateErrors.length ? "agent.accepted.state_error" : "agent.accepted",
              toStatus: "in_progress",
              requestId: dispatchId,
              metadata: { dispatchId, externalRunId: result.externalRunId, ...(stateErrors.length ? { stateErrors } : {}) },
              occurredAt: completedAt,
            });
            if (auditError) {
              stateErrors.push(`accepted_audit_persist_failed:${auditError}`);
              await client.from("seo_agent_runs").update({
                last_error: stateErrors.join(", ").slice(0, 4_000),
                response_metadata: { ...acceptedMetadata, stateErrors },
                updated_at: completedAt,
              }).eq("id", dispatchId).in("status", ["accepted", "sent"]);
            }
            return { briefId: candidate.id, status: "accepted", dispatchId, externalRunId: result.externalRunId, ...(stateErrors.length ? { error: stateErrors.join(", ") } : {}) };
          }
          const errorMessage = `Agent rejected dispatch with HTTP ${result.status}.`;
          const stateErrors = await markSeoAgentDispatchFailed(client, {
            dispatchId,
            assignmentId: candidate.assignmentId,
            briefId: candidate.id,
            errorMessage,
            responseMetadata: result.metadata,
            occurredAt: completedAt,
          });
          return { briefId: candidate.id, status: "failed", dispatchId, error: stateErrors.length ? `${errorMessage} state errors: ${stateErrors.join(", ")}` : errorMessage };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message.slice(0, 4_000) : "Agent dispatch failed.";
          const failedAt = new Date().toISOString();
          const stateErrors = await markSeoAgentDispatchFailed(client, {
            dispatchId,
            assignmentId: candidate.assignmentId,
            briefId: candidate.id,
            errorMessage,
            occurredAt: failedAt,
          });
          return { briefId: candidate.id, status: "failed", dispatchId, error: stateErrors.length ? `${errorMessage} state errors: ${stateErrors.join(", ")}` : errorMessage };
        }
      });
      outcomes.push(outcome);
      if (outcome.status === "failed") {
        await upsertSeoAlert({
          dedupeKey: `seo-content-agent:${candidate.id}`,
          severity: "p1",
          category: "content-production",
          title: "SEO content-agent dispatch failed",
          message: "error" in outcome ? outcome.error ?? "The content agent did not accept the brief." : "The content agent did not accept the brief.",
          evidence: { briefId: candidate.id, dispatchId: "dispatchId" in outcome ? outcome.dispatchId : undefined },
        });
      }
    }
    const failed = outcomes.filter((item) => item.status === "failed");
    await step.run("finish-content-agent-dispatch", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: failed.length === outcomes.length && outcomes.length > 0 ? "failed" : "succeeded",
      checkedCount: candidates.length,
      actedCount: outcomes.filter((item) => item.status === "accepted").length,
      note: failed.length ? `${failed.length} content-agent dispatch(es) failed.` : `${outcomes.filter((item) => item.status === "accepted").length} brief(s) accepted by the content agent.`,
      errorCode: failed.length ? "content_agent_dispatch_failed" : undefined,
      cursor: { dispatchedAt: new Date().toISOString(), outcomes },
    }));
    return { status: "succeeded", candidates: candidates.length, outcomes };
  },
);

/**
 * Keep the writer queue supplied for both the hosted signed worker and the
 * owner-operated local bridge. Brief creation deliberately stops at
 * `ready_for_assignment`; this guarded loop performs only the reversible
 * queue handoff. Approval and indexability are handled by their own gates.
 */
export const seoContentAssignmentHeartbeat = inngest.createFunction(
  {
    id: "seo-content-assignment-heartbeat",
    triggers: [{ cron: "TZ=UTC */5 * * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-content-assignment";
    const fiveMinuteBucket = Math.floor(readEventTimestamp(event.ts) / (5 * 60 * 1_000));
    const job = await step.run("claim-content-assignment", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${fiveMinuteBucket}`,
      capability: "always",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const result = await step.run("assign-ready-briefs", () => assignReadySeoBriefs());
    if (result.failures.length) {
      await step.run("alert-content-assignment-failures", () => upsertSeoAlert({
        dedupeKey: `seo-content-assignment:${fiveMinuteBucket}`,
        severity: "p1",
        category: "content-production",
        title: "SEO writer assignment loop needs review",
        message: `${result.failures.length} brief assignment(s) failed while ${result.assigned.length} were assigned. No evidence or page state was approved automatically.`,
        evidence: { assigned: result.assigned, failures: result.failures, availableWriters: result.availableWriters },
      }));
    }
    await step.run("finish-content-assignment", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: result.failures.length && !result.assigned.length ? "failed" : "succeeded",
      checkedCount: result.checkedCount,
      actedCount: result.assigned.length,
      note: result.failures.length
        ? `Assigned ${result.assigned.length} brief(s); ${result.failures.length} assignment(s) need review.`
        : result.assigned.length
          ? `Assigned ${result.assigned.length} ready brief(s) to active writer(s).`
          : result.availableWriters === 0
            ? "No active writer is configured; ready briefs remain unassigned."
            : "No unassigned ready briefs were found.",
      errorCode: result.failures.length && !result.assigned.length ? "seo_content_assignment_failed" : undefined,
      cursor: { checkedAt: new Date().toISOString(), ...result },
    }));
    return { status: "succeeded", ...result };
  },
);

async function markSeoAgentDispatchFailed(
  client: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    dispatchId: string;
    assignmentId: string;
    briefId: string;
    errorMessage: string;
    responseMetadata?: unknown;
    occurredAt: string;
  },
): Promise<string[]> {
  const stateErrors: string[] = [];
  const responseMetadata = isRecord(input.responseMetadata) ? input.responseMetadata : {};
  const failure = classifySeoAgentDispatchFailure(input.errorMessage, responseMetadata);
  const { data: failedRun, error: runError } = await client
    .from("seo_agent_runs")
    .update({
      status: "failed",
      last_error: input.errorMessage,
      response_metadata: responseMetadata,
      retry_class: failure.retryClass,
      next_attempt_at: failure.nextAttemptAt,
      completed_at: input.occurredAt,
      updated_at: input.occurredAt,
    })
    .eq("id", input.dispatchId)
    .in("status", ["queued", "sent", "accepted", "processing"])
    .select("id")
    .maybeSingle();
  if (runError || !failedRun) stateErrors.push(`agent_run_failure_persist_failed:${runError?.code ?? "state_changed"}`);

  const nextQueueStatus = failure.retryClass === "transient_provider" ? "assigned" : "blocked";
  const { data: updatedAssignment, error: assignmentError } = await client
    .from("seo_content_assignments")
    .update({ status: nextQueueStatus, notes: input.errorMessage, updated_at: input.occurredAt })
    .eq("id", input.assignmentId)
    .in("status", ["assigned", "accepted", "in_progress", "blocked"])
    .select("id")
    .maybeSingle();
  if (assignmentError || !updatedAssignment) stateErrors.push(`assignment_failure_persist_failed:${assignmentError?.code ?? "state_changed"}`);

  const { data: updatedBrief, error: briefError } = await client
    .from("seo_content_briefs")
    .update({ status: nextQueueStatus, updated_at: input.occurredAt })
    .eq("id", input.briefId)
    .in("status", ["ready_for_assignment", "assigned", "in_progress", "blocked"])
    .select("id")
    .maybeSingle();
  if (briefError || !updatedBrief) stateErrors.push(`brief_failure_persist_failed:${briefError?.code ?? "state_changed"}`);

  const auditError = await recordSeoAgentAudit(client, {
    briefId: input.briefId,
    action: failure.retryClass === "transient_provider" ? "agent.retry_scheduled" : "agent.failed",
    toStatus: nextQueueStatus,
    requestId: input.dispatchId,
    metadata: { dispatchId: input.dispatchId, error: input.errorMessage, retryClass: failure.retryClass, nextAttemptAt: failure.nextAttemptAt, response: responseMetadata, ...(stateErrors.length ? { stateErrors } : {}) },
    occurredAt: input.occurredAt,
  });
  if (auditError) stateErrors.push(`audit_persist_failed:${auditError}`);

  if (stateErrors.length) {
    const stateError = stateErrors.join(", ").slice(0, 4_000);
    const { error: stateErrorWrite } = await client
      .from("seo_agent_runs")
      .update({ last_error: `${input.errorMessage} ${stateError}`.slice(0, 4_000), response_metadata: { ...responseMetadata, stateErrors }, updated_at: input.occurredAt })
      .eq("id", input.dispatchId)
      .in("status", ["failed", "queued", "sent", "accepted", "processing"]);
    if (stateErrorWrite) stateErrors.push(`agent_run_error_state_persist_failed:${stateErrorWrite.code}`);
  }
  return stateErrors;
}

function classifySeoAgentDispatchFailure(message: string, metadata: Record<string, unknown>) {
  const status = Number(metadata.httpStatus ?? metadata.status ?? 0);
  const transient = [408, 425, 429, 500, 502, 503, 504].includes(status)
    || /timeout|temporar|network|connection reset|econn|rate.?limit|\b429\b|\b5\d\d\b/i.test(message);
  return {
    retryClass: transient ? "transient_provider" : "manual_review",
    nextAttemptAt: transient ? new Date(Date.now() + 6 * 60 * 60 * 1_000).toISOString() : null,
  } as const;
}

async function recordSeoAgentAudit(
  client: ReturnType<typeof createSupabaseAdminClient>,
  input: {
    briefId: string;
    action: string;
    toStatus: string;
    requestId: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  },
): Promise<string | null> {
  const { error } = await client.from("seo_content_audit_events").insert({
    entity_type: "brief",
    entity_id: input.briefId,
    action: input.action,
    to_status: input.toStatus,
    request_id: input.requestId,
    metadata: input.metadata,
    occurred_at: input.occurredAt,
  });
  return error?.code ?? null;
}

/**
 * Recover agent handoffs that stopped making progress. An unaccepted HTTP
 * handoff is safe to requeue; an accepted/processing handoff may have already
 * produced external work, so it is expired and blocked for explicit review
 * instead of being duplicated automatically.
 */
export const seoContentAgentRecoveryHeartbeat = inngest.createFunction(
  {
    id: "seo-content-agent-recovery",
    triggers: [{ cron: "TZ=UTC */15 * * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ event, step }) => {
    const loopName = "seo-content-agent-recovery";
    const quarterHour = Math.floor(readEventTimestamp(event.ts) / (15 * 60 * 1_000));
    const job = await step.run("claim-content-agent-recovery", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${quarterHour}`,
      capability: "always",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const now = new Date();
    const sentCutoff = new Date(now.getTime() - 30 * 60 * 1_000).toISOString();
    const workCutoff = new Date(now.getTime() - 6 * 60 * 60 * 1_000).toISOString();
    const stale = await step.run("read-stale-content-agent-runs", async () => {
      const client = createSupabaseAdminClient();
      const [{ data: queued, error: queuedError }, { data: sent, error: sentError }, { data: work, error: workError }] = await Promise.all([
        client
          .from("seo_agent_runs")
          .select("id,brief_id,assignment_id,status,updated_at")
          .eq("status", "queued")
          .lt("updated_at", sentCutoff)
          .order("updated_at", { ascending: true })
          .limit(100),
        client
          .from("seo_agent_runs")
          .select("id,brief_id,assignment_id,status,updated_at")
          .eq("status", "sent")
          .lt("updated_at", sentCutoff)
          .order("updated_at", { ascending: true })
          .limit(100),
        client
          .from("seo_agent_runs")
          .select("id,brief_id,assignment_id,status,updated_at")
          .in("status", ["accepted", "processing"])
          .lt("updated_at", workCutoff)
          .order("updated_at", { ascending: true })
          .limit(100),
      ]);
      if (queuedError || sentError || workError) throw new Error(`SEO content-agent recovery queue is unavailable: ${queuedError?.code ?? sentError?.code ?? workError?.code ?? "unknown"}`);
      return [...(queued ?? []), ...(sent ?? []), ...(work ?? [])];
    });

    const outcomes = [] as Array<{ id: string; status: string; briefId: string }>;
    for (const run of stale) {
      const outcome = await step.run(`recover-agent-run-${String(run.id)}`, async () => {
        const client = createSupabaseAdminClient();
        const runStatus = String(run.status);
        const isSafeToRequeue = runStatus === "queued" || runStatus === "sent";
        const { data, error } = await client.rpc("recover_seo_agent_run", {
          p_run_id: String(run.id),
          p_expected_status: runStatus,
          p_cutoff: isSafeToRequeue ? sentCutoff : workCutoff,
          p_requeue: isSafeToRequeue,
        });
        if (error) throw new Error(`SEO content-agent recovery update failed: ${error.code}`);
        const result = isRecord(data) ? data : {};
        const recoveryStatus = result.status === "requeued" || result.status === "blocked" ? result.status : "raced";
        return {
          id: String(run.id),
          status: recoveryStatus,
          briefId: typeof result.briefId === "string" ? result.briefId : String(run.brief_id),
        };
      });
      outcomes.push(outcome);
      if (outcome.status !== "raced") {
        await upsertSeoAlert({
          dedupeKey: `seo-content-agent:expired:${outcome.id}`,
          severity: outcome.status === "blocked" ? "p1" : "p2",
          category: "content-production",
          title: outcome.status === "blocked" ? "SEO content-agent run expired" : "SEO content-agent handoff requeued",
          message: outcome.status === "blocked"
            ? "An accepted content-agent run stopped progressing and was blocked for manual review; no duplicate run was started."
            : "A content-agent handoff was not accepted and was safely returned to its assigned brief queue.",
          evidence: { agentRunId: outcome.id, briefId: outcome.briefId },
        });
      }
    }

    const requeued = outcomes.filter((item) => item.status === "requeued").length;
    const blocked = outcomes.filter((item) => item.status === "blocked").length;
    await step.run("finish-content-agent-recovery", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: stale.length,
      actedCount: requeued + blocked,
      note: `Reviewed ${stale.length} stale agent run(s); requeued ${requeued} and blocked ${blocked} for review.`,
      cursor: { sentCutoff, workCutoff, outcomes },
    }));
    return { status: "succeeded", stale: stale.length, requeued, blocked, outcomes };
  },
);

/**
 * Keep the publishing queue supplied without manufacturing pages. A healthy
 * autopilot publishes from an approved buffer; when it drops below the target
 * this loop raises an actionable alert so the brief/research workers can
 * replenish it. It never auto-approves or auto-publishes content.
 */
export const seoApprovedBufferHeartbeat = inngest.createFunction(
  {
    id: "seo-approved-buffer-health",
    triggers: [{ cron: "TZ=UTC 0 */6 * * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const loopName = "seo-approved-buffer";
    const job = await step.run("claim-approved-buffer-health", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${new Date().toISOString().slice(0, 13)}`,
      capability: "monitoring",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const snapshot = await step.run("read-approved-buffer", async () => {
      const client = createSupabaseAdminClient();
      const [approved, review] = await Promise.all([
        client.from("seo_pages").select("id", { count: "exact", head: true }).in("status", ["approved", "scheduled"]).eq("noindex", true),
        client.from("seo_pages").select("id", { count: "exact", head: true }).in("status", ["idea", "assigned", "draft", "automated_qa", "editor_review", "changes_requested"]),
      ]);
      if (approved.error || review.error) throw new Error(`SEO approved-buffer query is unavailable: ${approved.error?.code ?? review.error?.code ?? "unknown"}`);
      return {
        approved: approved.count ?? 0,
        reviewQueue: review.count ?? 0,
        target: 600,
      };
    });
    const deficit = Math.max(0, snapshot.target - snapshot.approved);
    if (deficit > 0) {
      await step.run("alert-approved-buffer-deficit", () => upsertSeoAlert({
        dedupeKey: "seo-approved-buffer:below-target",
        severity: snapshot.approved === 0 ? "p1" : "p2",
        category: "publishing-buffer",
        title: "Approved SEO publishing buffer is below target",
        message: `${snapshot.approved} approved/scheduled pages are queued; ${deficit} more are needed to maintain the 600-page buffer. ${snapshot.reviewQueue} pages are still in review and cannot be auto-approved.`,
        evidence: snapshot,
      }));
    }
    await step.run("finish-approved-buffer-health", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: snapshot.approved + snapshot.reviewQueue,
      actedCount: deficit > 0 ? 1 : 0,
      note: deficit > 0 ? `Approved buffer is short by ${deficit} page(s); replenishment remains review-gated.` : "Approved publishing buffer is at or above target.",
      cursor: snapshot,
    }));
    return { status: "succeeded", ...snapshot, deficit };
  },
);

export const seoOpportunityAnalysisHeartbeat = inngest.createFunction(
  {
    id: "seo-opportunity-analysis-heartbeat",
    triggers: [{ cron: "TZ=UTC 45 4 * * 1" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const loopName = "seo-opportunity-analysis";
    const job = await step.run("claim-opportunity-analysis", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${new Date().toISOString().slice(0, 10)}`,
      capability: "recommendations",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const analysis = await step.run("analyze-search-opportunities", async () => {
      const since = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
      const client = createSupabaseAdminClient();
      const { data, error } = await client
        .from("seo_gsc_query_page_daily")
        .select("canonical_url,query,clicks,impressions,ctr,position,metric_date")
        .gte("metric_date", since)
        .eq("country", "all")
        .eq("device", "all")
        .eq("search_type", "web")
        .order("impressions", { ascending: false })
        .limit(20_000);
      if (error) throw new Error(`SEO opportunity analysis is unavailable: ${error.code}`);
      const rows = (data ?? []).map((row) => ({
        canonicalUrl: String(row.canonical_url),
        query: String(row.query).trim().toLowerCase(),
        clicks: toMetricNumber(row.clicks),
        impressions: toMetricNumber(row.impressions),
        ctr: toMetricNumber(row.ctr),
        position: toMetricNumber(row.position),
        metricDate: String(row.metric_date ?? ""),
      })).filter((row) => row.query && row.impressions > 0);
      const lowCtr = rows.filter((row) => row.impressions >= 100 && row.position > 0 && row.position <= 10 && row.ctr < 0.02).sort((a, b) => b.impressions - a.impressions).slice(0, 20);
      const cannibalization = findCannibalization(rows).slice(0, 20);
      const rankingOpportunities = rows.filter((row) => row.impressions >= 100 && row.position > 10 && row.position <= 20).sort((a, b) => b.impressions - a.impressions).slice(0, 20);
      for (const item of lowCtr) {
        await upsertSeoAlert({
          dedupeKey: `seo-low-ctr:${item.canonicalUrl}:${item.query}`,
          severity: "p2",
          category: "search-opportunity",
          title: "High-impression page has low CTR",
          message: `${item.canonicalUrl} receives ${item.impressions} impressions for “${item.query}” at position ${item.position.toFixed(1)} but CTR is ${(item.ctr * 100).toFixed(2)}%.`,
          evidence: item,
        });
        await upsertSeoRecommendation({
          dedupeKey: `seo-low-ctr:${item.canonicalUrl}:${item.query}`,
          severity: "p2",
          category: "search-opportunity",
          title: "Improve the title and snippet for a high-impression page",
          message: `${item.canonicalUrl} receives ${item.impressions} impressions for “${item.query}” at position ${item.position.toFixed(1)} but CTR is ${(item.ctr * 100).toFixed(2)}%.`,
          recommendedAction: "Review the page title, meta description, and direct answer against the query. Change only after confirming the page intent and evidence still match.",
          canonicalUrl: item.canonicalUrl,
          query: item.query,
          dueAt: recommendationDueAt(14),
          sourceLoop: loopName,
          sourceRunId: job.runId,
          evidence: item,
        });
      }
      for (const item of rankingOpportunities) {
        await upsertSeoAlert({
          dedupeKey: `seo-ranking-opportunity:${item.canonicalUrl}:${item.query}`,
          severity: "p2",
          category: "ranking-opportunity",
          title: "Page is close enough to improve with evidence-led work",
          message: `${item.canonicalUrl} receives ${item.impressions} impressions for “${item.query}” at position ${item.position.toFixed(1)}.`,
          evidence: item,
        });
        await upsertSeoRecommendation({
          dedupeKey: `seo-ranking-opportunity:${item.canonicalUrl}:${item.query}`,
          severity: "p2",
          category: "ranking-opportunity",
          title: "Move a page from positions 11–20 into the first page",
          message: `${item.canonicalUrl} receives ${item.impressions} impressions for “${item.query}” at position ${item.position.toFixed(1)}.`,
          recommendedAction: "Compare the query with the page’s visible answer, first-party workflow evidence, and relevant internal links. Submit a reviewed improvement only when the task remains distinct and the evidence is current.",
          canonicalUrl: item.canonicalUrl,
          query: item.query,
          dueAt: recommendationDueAt(14),
          sourceLoop: loopName,
          sourceRunId: job.runId,
          evidence: item,
        });
      }
      for (const item of cannibalization) {
        await upsertSeoAlert({
          dedupeKey: `seo-cannibalization:${item.query}`,
          severity: "p2",
          category: "cannibalization",
          title: "Multiple Airveek pages share a query",
          message: `Review ${item.pages.length} sibling pages sharing ${(item.overlap * 100).toFixed(0)}% of their top queries for “${item.query}”; rankings alternate across the review window.`,
          evidence: item,
        });
        await upsertSeoRecommendation({
          dedupeKey: `seo-cannibalization:${item.query}`,
          severity: "p2",
          category: "cannibalization",
          title: "Resolve overlapping pages competing for one query",
          message: `Review ${item.pages.length} sibling pages sharing ${(item.overlap * 100).toFixed(0)}% of their top queries for “${item.query}”; rankings alternate across the review window.`,
          recommendedAction: "Compare the pages’ evidence and task intent. Merge, redirect, canonicalize, or rewrite only after an editor documents the distinct user job (or confirms the duplicate).",
          query: item.query,
          dueAt: recommendationDueAt(14),
          sourceLoop: loopName,
          sourceRunId: job.runId,
          evidence: { query: item.query, overlap: item.overlap, alternatingQueries: item.alternatingQueries, pageUrls: item.pages.join(" | ") },
        });
      }
      return { since, rows: rows.length, lowCtr: lowCtr.length, cannibalization: cannibalization.length, rankingOpportunities: rankingOpportunities.length };
    });
    await step.run("finish-opportunity-analysis", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: analysis.rows,
      actedCount: analysis.lowCtr + analysis.rankingOpportunities + analysis.cannibalization,
      note: `Reviewed ${analysis.rows} GSC query/page rows; staged ${analysis.lowCtr} CTR, ${analysis.rankingOpportunities} ranking, and ${analysis.cannibalization} overlap recommendations.`,
      cursor: analysis,
    }));
    return { status: "succeeded", ...analysis };
  },
);

export const seoContentDecayHeartbeat = inngest.createFunction(
  {
    id: "seo-content-decay-heartbeat",
    triggers: [{ cron: "TZ=UTC 15 2 1 * *" }],
    retries: 2,
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const loopName = "seo-content-decay";
    const job = await step.run("claim-content-decay", () => startSeoJob({
      loopName,
      idempotencyKey: `${loopName}:${new Date().toISOString().slice(0, 7)}`,
      capability: "recommendations",
    }));
    if (!job.shouldRun) return { status: "skipped", reason: job.reason };

    const decay = await step.run("find-decaying-pages", async () => {
      const client = createSupabaseAdminClient();
      const { data: pages, error: pageError } = await client
        .from("seo_pages")
        .select("id,path,title,search_lastmod_at")
        .eq("status", "live")
        .eq("noindex", false)
        .lt("search_lastmod_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
        .limit(5_000);
      if (pageError) throw new Error(`SEO decay page query is unavailable: ${pageError.code}`);
      const currentSince = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
      const priorSince = new Date(Date.now() - 56 * 86_400_000).toISOString().slice(0, 10);
      const { data: metrics, error: metricError } = await client
        .from("seo_gsc_page_daily")
        .select("canonical_url,metric_date,impressions,clicks")
        .gte("metric_date", priorSince)
        .eq("country", "all")
        .eq("device", "all")
        .eq("search_type", "web")
        .limit(20_000);
      if (metricError) throw new Error(`SEO decay metrics are unavailable: ${metricError.code}`);
      const totals = new Map<string, { prior: number; current: number; clicksPrior: number; clicksCurrent: number }>();
      for (const row of metrics ?? []) {
        const key = String(row.canonical_url);
        const value = totals.get(key) ?? { prior: 0, current: 0, clicksPrior: 0, clicksCurrent: 0 };
        const impressions = toMetricNumber(row.impressions);
        const clicks = toMetricNumber(row.clicks);
        if (String(row.metric_date) >= currentSince) {
          value.current += impressions;
          value.clicksCurrent += clicks;
        } else {
          value.prior += impressions;
          value.clicksPrior += clicks;
        }
        totals.set(key, value);
      }
      const decaying = (pages ?? []).flatMap((page) => {
        const metrics = totals.get(absoluteUrl(String(page.path)));
        if (!metrics || metrics.prior < 100 || metrics.current >= metrics.prior * 0.5) return [];
        return [{ pageId: String(page.id), path: String(page.path), title: String(page.title), ...metrics }];
      }).slice(0, 100);
      for (const page of decaying) {
        await upsertSeoAlert({
          dedupeKey: `seo-decay:${page.pageId}`,
          severity: "p2",
          category: "content-decay",
          title: "Organic demand has declined on an aging page",
          message: `${page.path} fell from ${page.prior} to ${page.current} impressions across the comparison windows. Review evidence, intent, and the workflow before refreshing.`,
          evidence: page,
        });
        await upsertSeoRecommendation({
          dedupeKey: `seo-decay:${page.pageId}`,
          severity: "p2",
          category: "content-decay",
          title: "Refresh an aging page whose organic demand declined",
          message: `${page.path} fell from ${page.prior} to ${page.current} impressions across the comparison windows. Review evidence, intent, and the workflow before refreshing.`,
          recommendedAction: "Audit the source evidence, screenshots, prompt/settings, and internal links, then submit a reviewed refresh. Do not overwrite an established page automatically.",
          pageId: page.pageId,
          canonicalUrl: absoluteUrl(page.path),
          dueAt: recommendationDueAt(30),
          sourceLoop: loopName,
          sourceRunId: job.runId,
          evidence: page,
        });
      }
      return { pagesChecked: pages?.length ?? 0, decaying: decaying.length };
    });
    await step.run("finish-content-decay", () => finishSeoJob({
      runId: job.runId,
      loopName,
      status: "succeeded",
      checkedCount: decay.pagesChecked,
      actedCount: decay.decaying,
      note: `Reviewed ${decay.pagesChecked} aging pages and staged ${decay.decaying} refresh recommendations.`,
      cursor: { checkedAt: new Date().toISOString(), decay },
    }));
    return { status: "succeeded", ...decay };
  },
);

export const seoFunctions = [
  seoSourceSyncHeartbeat,
  seoCrawlHeartbeat,
  seoPageProbeHeartbeat,
  seoSurfaceHeartbeat,
  seoTrackingQaHeartbeat,
  seoIndexNowNotifier,
  seoSitemapSubmitHeartbeat,
  seoPublishWaveHeartbeat,
  seoContentAssignmentHeartbeat,
  seoContentAgentDispatchHeartbeat,
  seoContentAgentRecoveryHeartbeat,
  seoApprovedBufferHeartbeat,
  seoOpportunityAnalysisHeartbeat,
  seoContentDecayHeartbeat,
];

async function assignReadySeoBriefs(): Promise<{
  checkedCount: number;
  availableWriters: number;
  assigned: Array<{ briefId: string; assignmentId: string; assigneeId: string }>;
  failures: Array<{ briefId: string; error: string }>;
}> {
  const client = createSupabaseAdminClient();
  const batchSize = boundedInteger(process.env.SEO_CONTENT_ASSIGNMENT_BATCH_SIZE, 25, 1, 100);
  const [{ data: writers, error: writerError }, { data: briefs, error: briefError }] = await Promise.all([
    client
      .from("content_members")
      .select("user_id")
      .eq("role", "writer")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(100),
    client
      .from("seo_content_briefs")
      .select("id,priority,due_at")
      .eq("status", "ready_for_assignment")
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(Math.max(batchSize * 3, 3)),
  ]);
  if (writerError || briefError) {
    throw new Error(`SEO content assignment queue is unavailable: ${writerError?.code ?? briefError?.code ?? "unknown"}`);
  }
  const activeWriters = (writers ?? []).map((row) => String(row.user_id));
  const readyBriefs = briefs ?? [];
  if (!activeWriters.length || !readyBriefs.length) {
    return { checkedCount: readyBriefs.length, availableWriters: activeWriters.length, assigned: [], failures: [] };
  }
  const briefIds = readyBriefs.map((row) => String(row.id));
  const { data: currentAssignments, error: assignmentError } = await client
    .from("seo_content_assignments")
    .select("brief_id")
    .in("brief_id", briefIds)
    .eq("assignment_role", "writer")
    .in("status", ["assigned", "accepted", "in_progress", "blocked", "submitted"]);
  if (assignmentError) throw new Error(`SEO content assignment lookup is unavailable: ${assignmentError.code}`);
  const alreadyAssigned = new Set((currentAssignments ?? []).map((row) => String(row.brief_id)));
  const pending = readyBriefs.filter((row) => !alreadyAssigned.has(String(row.id))).slice(0, batchSize);
  const assigned: Array<{ briefId: string; assignmentId: string; assigneeId: string }> = [];
  const failures: Array<{ briefId: string; error: string }> = [];
  for (const [index, brief] of pending.entries()) {
    const briefId = String(brief.id);
    const assigneeId = activeWriters[index % activeWriters.length];
    const { data, error } = await client.rpc("assign_seo_brief", {
      p_brief_id: briefId,
      p_assignee_id: assigneeId,
      p_assignment_role: "writer",
      p_priority: Number(brief.priority ?? 50),
      p_due_at: typeof brief.due_at === "string" ? brief.due_at : null,
      p_notes: "Autopilot writer assignment; evidence, rights, and editorial gates remain mandatory.",
      p_assigned_by: null,
    });
    if (error || !data) {
      failures.push({ briefId, error: error?.code ?? "assignment_not_created" });
      continue;
    }
    assigned.push({ briefId, assignmentId: String(data), assigneeId });
  }
  return { checkedCount: readyBriefs.length, availableWriters: activeWriters.length, assigned, failures };
}

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
    // Bing's page-statistics report is a weekly snapshot, unlike GSC/GA4 daily rows.
    bing: sourceFreshness(readiness.bing, bing, 10),
  };

  async function latestMetricDate(table: string): Promise<string | null> {
    const { data, error } = await client.from(table).select("metric_date").order("metric_date", { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return typeof data?.metric_date === "string" ? data.metric_date : null;
  }
}

/**
 * Persist a provider watermark around the existing idempotent fact import.
 * The watermark is advisory state, not a correctness boundary: an upsert may
 * be replayed safely, while a failed run never claims that its metric day was
 * complete. The seven-day resume window handles ordinary transient outages.
 */
async function runWatermarkedSeoImport<T extends { status: string }>(
  source: SeoImportSource,
  targetMetricDate: string,
  importer: (metricDate: string) => Promise<T>,
): Promise<T & { importMetricDate: string }> {
  const client = createSupabaseAdminClient();
  const { data: watermark, error: watermarkReadError } = await client
    .from("seo_import_watermarks")
    .select("last_success_metric_date")
    .eq("source", source)
    .maybeSingle();
  if (watermarkReadError) throw new Error(`SEO ${source} watermark read failed: ${watermarkReadError.code}`);
  const lastSuccessMetricDate = typeof watermark?.last_success_metric_date === "string" ? watermark.last_success_metric_date : null;
  const importMetricDate = chooseSeoImportMetricDate(
    targetMetricDate,
    lastSuccessMetricDate,
  );
  const attemptedAt = new Date().toISOString();
  const { error: runningWatermarkError } = await client.from("seo_import_watermarks").upsert({
    source,
    status: "running",
    last_attempted_metric_date: importMetricDate,
    last_attempted_at: attemptedAt,
    last_error: null,
    updated_at: attemptedAt,
  }, { onConflict: "source" });
  if (runningWatermarkError) throw new Error(`SEO ${source} watermark start failed: ${runningWatermarkError.code}`);

  try {
    const result = await importer(importMetricDate);
    const completedAt = new Date().toISOString();
    if (result.status === "succeeded") {
      // A delayed retry must never move a successful watermark backwards.
      // Inngest serializes the scheduled loop, but this guard also protects a
      // manually replayed step or two deployments running during a rollout.
      const successfulMetricDate = maxMetricDate(lastSuccessMetricDate, importMetricDate);
      const { error: successWatermarkError } = await client.from("seo_import_watermarks").upsert({
        source,
        status: "succeeded",
        last_attempted_metric_date: importMetricDate,
        last_success_metric_date: successfulMetricDate,
        last_attempted_at: attemptedAt,
        last_success_at: completedAt,
        last_error: null,
        cursor: { result: summarizeImportResult(result) },
        updated_at: completedAt,
      }, { onConflict: "source" });
      if (successWatermarkError) throw new Error(`SEO ${source} watermark success update failed: ${successWatermarkError.code}`);
    } else {
      const { error: idleWatermarkError } = await client.from("seo_import_watermarks").upsert({
        source,
        status: "idle",
        last_attempted_metric_date: importMetricDate,
        last_attempted_at: attemptedAt,
        cursor: { result: summarizeImportResult(result) },
        updated_at: completedAt,
      }, { onConflict: "source" });
      if (idleWatermarkError) throw new Error(`SEO ${source} watermark idle update failed: ${idleWatermarkError.code}`);
    }
    return { ...result, importMetricDate };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const { error: failureWatermarkError } = await client.from("seo_import_watermarks").upsert({
      source,
      status: "failed",
      last_attempted_metric_date: importMetricDate,
      last_attempted_at: attemptedAt,
      last_error: (error instanceof Error ? error.message : "SEO provider import failed").slice(0, 4_000),
      updated_at: failedAt,
    }, { onConflict: "source" });
    if (failureWatermarkError) {
      const original = error instanceof Error ? error.message : "SEO provider import failed";
      throw new Error(`${original}; ${source} failure watermark update failed: ${failureWatermarkError.code}`);
    }
    throw error;
  }
}

function summarizeImportResult(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) =>
    item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean",
  ).slice(0, 20));
}

function maxMetricDate(first: string | null, second: string): string {
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first)) return second;
  return first > second ? first : second;
}

async function readCoreWebVitalHealth(sinceDays: number): Promise<Record<string, { p75: number; sampleCount: number }>> {
  const sinceDate = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await createSupabaseAdminClient().rpc("get_seo_web_vitals_summary", { since_date: sinceDate });
  if (error) throw new Error(`Core Web Vitals summary is unavailable: ${error.code}`);
  if (!isRecord(data)) return {};
  return Object.fromEntries(Object.entries(data).flatMap(([name, raw]) => {
    if (!isRecord(raw)) return [];
    const p75 = toMetricNumber(raw.p75);
    const sampleCount = Math.floor(toMetricNumber(raw.sampleCount));
    return name in CORE_WEB_VITAL_BUDGETS && sampleCount > 0 ? [[name, { p75, sampleCount }]] : [];
  }));
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

function recommendationDueAt(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMetricNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

type CannibalizationRow = {
  canonicalUrl: string;
  query: string;
  impressions: number;
  position: number;
  metricDate: string;
};

function findCannibalization(rows: CannibalizationRow[]) {
  const byPage = new Map<string, Map<string, { impressions: number; positions: Map<string, number> }>>();
  for (const row of rows) {
    const queries = byPage.get(row.canonicalUrl) ?? new Map();
    const query = queries.get(row.query) ?? { impressions: 0, positions: new Map<string, number>() };
    query.impressions += row.impressions;
    if (row.metricDate && row.position > 0) query.positions.set(row.metricDate, row.position);
    queries.set(row.query, query);
    byPage.set(row.canonicalUrl, queries);
  }

  // Compare only the highest-impression pages to keep the weekly analysis
  // bounded even when the site has hundreds of thousands of query rows.
  const pages = [...byPage.entries()]
    .map(([url, queries]) => ({
      url,
      queries,
      topQueries: new Set([...queries.entries()].sort((a, b) => b[1].impressions - a[1].impressions).slice(0, 20).map(([query]) => query)),
      totalImpressions: [...queries.values()].reduce((sum, query) => sum + query.impressions, 0),
    }))
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, 250);
  const results: Array<{ query: string; pages: string[]; overlap: number; alternatingQueries: number }> = [];
  const siblingGroups = new Map<string, typeof pages>();
  for (const page of pages) {
    const siblings = siblingGroups.get(siblingGroup(page.url)) ?? [];
    siblings.push(page);
    siblingGroups.set(siblingGroup(page.url), siblings);
  }
  for (const siblings of siblingGroups.values()) {
    for (let left = 0; left < siblings.length; left += 1) {
      for (let right = left + 1; right < siblings.length; right += 1) {
        const shared = [...siblings[left].topQueries].filter((query) => siblings[right].topQueries.has(query));
        const overlap = shared.length / Math.max(1, Math.min(siblings[left].topQueries.size, siblings[right].topQueries.size));
        if (overlap < 0.4) continue;
        const alternatingQueries = shared.filter((query) => rankingsAlternate(siblings[left].queries.get(query)?.positions, siblings[right].queries.get(query)?.positions)).length;
        if (alternatingQueries === 0) continue;
        results.push({ query: shared.slice(0, 3).join(", ") || "shared queries", pages: [siblings[left].url, siblings[right].url], overlap, alternatingQueries });
      }
    }
  }
  return results.sort((a, b) => b.overlap - a.overlap || b.alternatingQueries - a.alternatingQueries);
}

function siblingGroup(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return `/${segments.slice(0, -1).join("/")}`;
  } catch {
    return "/";
  }
}

function rankingsAlternate(left: Map<string, number> | undefined, right: Map<string, number> | undefined): boolean {
  if (!left || !right) return false;
  let leftWins = false;
  let rightWins = false;
  for (const [date, leftPosition] of left) {
    const rightPosition = right.get(date);
    if (rightPosition === undefined || leftPosition <= 0 || rightPosition <= 0) continue;
    if (leftPosition < rightPosition) leftWins = true;
    if (rightPosition < leftPosition) rightWins = true;
    if (leftWins && rightWins) return true;
  }
  return false;
}
