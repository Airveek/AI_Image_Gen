import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SeoIntegrationReadiness, SeoJobStart, SeoJobStatus } from "@/features/seo/types";
import {
  canTransitionSeoRecommendationStatus,
  isSeoRecommendationStatus,
  normalizeSeoRecommendationDedupeKey,
  SEO_RECOMMENDATION_ACTIVE_STATUSES,
  type SeoRecommendationStatus,
} from "@/features/seo/recommendation-contract";

const DEFAULT_CONFIG: SeoJobStart["config"] = {
  crawlEnabled: false,
  sourceSyncEnabled: false,
  recommendationsEnabled: false,
  crawlBatchSize: 50,
  dailyPublishLimit: 200,
  dailyPublishWaveSize: 50,
};

export function getSeoIntegrationReadiness(): SeoIntegrationReadiness {
  const bingStatsEndpoint = process.env.BING_WEBMASTER_STATS_ENDPOINT?.trim();
  return {
    gsc: Boolean(
      process.env.GSC_SITE_URL
      && process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64,
    ),
    ga4: Boolean(
      (process.env.GA4_PROPERTY_ID || (process.env.GCP_PROJECT_ID && process.env.GA4_BIGQUERY_DATASET))
      && process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64,
    ),
    // The legacy Bing SOAP/POX stats endpoint is being retired. Treat Bing
    // reporting as configured only when an explicit replacement endpoint is
    // supplied; IndexNow discovery is tracked independently below.
    bing: Boolean(process.env.BING_WEBMASTER_API_KEY && bingStatsEndpoint),
    indexNow: Boolean(process.env.INDEXNOW_KEY && process.env.INDEXNOW_KEY_LOCATION),
  };
}

export async function startSeoJob(input: {
  loopName: string;
  idempotencyKey: string;
  capability: "crawl" | "source-sync" | "recommendations" | "monitoring" | "always";
  metadata?: Record<string, unknown>;
}): Promise<SeoJobStart> {
  const safeLoopName = input.loopName.trim().slice(0, 100);
  const safeIdempotencyKey = input.idempotencyKey.trim().slice(0, 180);
  if (safeLoopName.length < 3 || safeIdempotencyKey.length < 8) {
    throw new Error("SEO job identity is invalid.");
  }

  try {
    const client = createSupabaseAdminClient();
    const { data: rawConfig, error: configError } = await client
      .from("seo_automation_config")
      .select("enabled,crawl_enabled,source_sync_enabled,recommendations_enabled,crawl_batch_size,daily_publish_limit,daily_publish_wave_size")
      .eq("id", true)
      .maybeSingle();
    if (configError) return unavailableStart();

    const config = rawConfig
      ? {
          crawlEnabled: Boolean(rawConfig.crawl_enabled),
          sourceSyncEnabled: Boolean(rawConfig.source_sync_enabled),
          recommendationsEnabled: Boolean(rawConfig.recommendations_enabled),
          crawlBatchSize: positiveInteger(rawConfig.crawl_batch_size, 50),
          dailyPublishLimit: positiveInteger(rawConfig.daily_publish_limit, 200),
          dailyPublishWaveSize: positiveInteger(rawConfig.daily_publish_wave_size, 50),
        }
      : DEFAULT_CONFIG;
    const globallyEnabled = Boolean(rawConfig?.enabled) && process.env.SEO_AUTOMATION_ENABLED === "true";
    const capabilityEnabled = input.capability === "monitoring"
      ? Boolean(rawConfig)
      : input.capability === "always"
        ? globallyEnabled
        : input.capability === "crawl"
          ? globallyEnabled && config.crawlEnabled
          : input.capability === "recommendations"
            ? globallyEnabled && config.recommendationsEnabled
            : globallyEnabled && config.sourceSyncEnabled;
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("seo_job_runs")
      .insert({
        loop_name: safeLoopName,
        idempotency_key: safeIdempotencyKey,
        status: capabilityEnabled ? "running" : "skipped",
        note: capabilityEnabled ? "Job accepted." : "Automation or capability is disabled.",
        completed_at: capabilityEnabled ? null : now,
        metadata: sanitizeMetadata(input.metadata),
      })
      .select("id")
      .single();

    if (error?.code === "23505") {
      return { runId: null, shouldRun: false, reason: "duplicate", config };
    }
    if (error || !data) return unavailableStart(config);
    return {
      runId: String(data.id),
      shouldRun: capabilityEnabled,
      reason: capabilityEnabled ? "ready" : "disabled",
      config,
    };
  } catch (error) {
    console.warn("[seo-control] job start unavailable", {
      loop: safeLoopName,
      error: error instanceof Error ? error.name : "unknown",
    });
    return unavailableStart();
  }
}

export async function finishSeoJob(input: {
  runId: string | null;
  loopName: string;
  status: Exclude<SeoJobStatus, "running">;
  checkedCount?: number;
  actedCount?: number;
  note: string;
  errorCode?: string;
  cursor?: Record<string, unknown>;
}): Promise<void> {
  if (!input.runId) return;
  const client = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const succeeded = input.status === "succeeded";

  // Persist the loop checkpoint before closing the run. If this mutation
  // fails, the caller must see an exception so Inngest retries the step rather
  // than recording a completed run whose cursor/failure counter is missing.
  const { data: existing, error: stateReadError } = await client
    .from("seo_job_state")
    .select("consecutive_failures")
    .eq("loop_name", input.loopName)
    .maybeSingle();
  if (stateReadError) {
    throw new Error(`SEO job state read failed: ${stateReadError.message}`);
  }
  const failureCount = succeeded
    ? 0
    : positiveInteger(existing?.consecutive_failures, 0) + (input.status === "failed" ? 1 : 0);
  const { error: stateWriteError } = await client.from("seo_job_state").upsert({
    loop_name: input.loopName,
    cursor: sanitizeMetadata(input.cursor),
    last_run_at: now,
    last_success_at: succeeded ? now : undefined,
    consecutive_failures: failureCount,
    updated_at: now,
  }, { onConflict: "loop_name" });
  if (stateWriteError) {
    throw new Error(`SEO job state write failed: ${stateWriteError.message}`);
  }

  const { data: finishedRun, error: runError } = await client.from("seo_job_runs").update({
    status: input.status,
    checked_count: nonNegativeInteger(input.checkedCount),
    acted_count: nonNegativeInteger(input.actedCount),
    note: input.note.slice(0, 2_000),
    error_code: input.errorCode?.slice(0, 120) ?? null,
    completed_at: now,
  }).eq("id", input.runId).eq("status", "running").select("id").maybeSingle();
  if (runError) throw new Error(`SEO job run completion failed: ${runError.message}`);
  if (finishedRun) return;

  // A retried Inngest step may arrive after another attempt already closed the
  // run. Treat the same terminal status as idempotent; any other state is a
  // genuine race and must remain visible to the caller.
  const { data: currentRun, error: currentRunError } = await client
    .from("seo_job_runs")
    .select("status")
    .eq("id", input.runId)
    .maybeSingle();
  if (currentRunError) throw new Error(`SEO job run state lookup failed: ${currentRunError.message}`);
  if (currentRun?.status === input.status) return;
  throw new Error(`SEO job run ${input.runId} could not be finalized from running state.`);
}

export async function upsertSeoAlert(input: {
  dedupeKey: string;
  severity: "p0" | "p1" | "p2";
  category: string;
  title: string;
  message: string;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  const client = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const dedupeKey = input.dedupeKey.slice(0, 180);
  const payload = {
    severity: input.severity,
    category: input.category.slice(0, 80),
    title: input.title.slice(0, 180),
    message: input.message.slice(0, 4_000),
    evidence: sanitizeMetadata(input.evidence),
    last_seen_at: now,
  };
  const { data: existing, error: lookupError } = await client
    .from("seo_alerts")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["open", "acknowledged"])
    .maybeSingle();
  if (lookupError) throw new Error(`SEO alert lookup failed: ${lookupError.message}`);

  if (existing) {
    const { error: updateError } = await client.from("seo_alerts").update(payload).eq("id", existing.id);
    if (updateError) throw new Error(`SEO alert update failed: ${updateError.message}`);
    return;
  }

  const { error: insertError } = await client.from("seo_alerts").insert({
    ...payload,
    dedupe_key: dedupeKey,
    status: "open",
    first_seen_at: now,
  });
  if (insertError?.code === "23505") {
    // Another worker may have opened the same dedupe key between the lookup
    // and insert. Re-read the active row and update it; never drop the alert
    // or create a second notification for a harmless race.
    const { data: raced, error: raceLookupError } = await client
      .from("seo_alerts")
      .select("id,status")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (raceLookupError || !raced) throw new Error(`SEO alert race reconciliation failed: ${raceLookupError?.message ?? insertError.message}`);
    const reopened = raced.status === "resolved";
    const { error: raceUpdateError } = await client
      .from("seo_alerts")
      .update({ ...payload, ...(reopened ? { status: "open" } : {}) })
      .eq("id", raced.id);
    if (raceUpdateError) throw new Error(`SEO alert race update failed: ${raceUpdateError.message}`);
    if (reopened) await deliverSeoAlertWebhook(client, input, now);
    return;
  }
  if (insertError) throw new Error(`SEO alert insert failed: ${insertError.message}`);
  await deliverSeoAlertWebhook(client, input, now);
}

export async function upsertSeoRecommendation(input: {
  dedupeKey: string;
  severity?: "p0" | "p1" | "p2";
  category: string;
  title: string;
  message: string;
  recommendedAction: string;
  pageId?: string | null;
  canonicalUrl?: string | null;
  query?: string | null;
  dueAt?: string | null;
  sourceLoop: string;
  sourceRunId?: string | null;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  const dedupeKey = normalizeSeoRecommendationDedupeKey(input.dedupeKey);
  const client = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const payload = {
    severity: input.severity ?? "p2",
    category: input.category.trim().slice(0, 80),
    title: input.title.trim().slice(0, 180),
    message: input.message.trim().slice(0, 4_000),
    recommended_action: input.recommendedAction.trim().slice(0, 2_000),
    page_id: input.pageId ?? null,
    canonical_url: input.canonicalUrl?.trim().slice(0, 2_000) ?? null,
    query: input.query?.trim().slice(0, 2_048) ?? null,
    source_loop: input.sourceLoop.trim().slice(0, 100),
    source_run_id: input.sourceRunId ?? null,
    evidence: sanitizeMetadata(input.evidence),
    last_seen_at: now,
    resolved_at: null,
    resolution_note: null,
  };
  const activeStatuses = [...SEO_RECOMMENDATION_ACTIVE_STATUSES];
  const { data: existing, error: lookupError } = await client
    .from("seo_recommendations")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .in("status", activeStatuses)
    .maybeSingle();
  if (lookupError) throw new Error(`SEO recommendation lookup failed: ${lookupError.message}`);

  if (existing) {
    const { error: updateError } = await client.from("seo_recommendations").update(payload).eq("id", existing.id);
    if (updateError) throw new Error(`SEO recommendation update failed: ${updateError.message}`);
    return;
  }

  const { error: insertError } = await client.from("seo_recommendations").insert({
    ...payload,
    dedupe_key: dedupeKey,
    status: "open",
    first_seen_at: now,
    due_at: input.dueAt ?? null,
  });
  if (insertError?.code === "23505") {
    // Two scheduled workers may observe no active row at the same time. The
    // partial unique index makes one insert win; reconcile the loser into the
    // winning row so evidence is never silently discarded.
    const { data: raced, error: raceLookupError } = await client
      .from("seo_recommendations")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .in("status", activeStatuses)
      .maybeSingle();
    if (raceLookupError || !raced) throw new Error(`SEO recommendation race reconciliation failed: ${raceLookupError?.message ?? insertError.message}`);
    const { error: raceUpdateError } = await client.from("seo_recommendations").update(payload).eq("id", raced.id);
    if (raceUpdateError) throw new Error(`SEO recommendation race update failed: ${raceUpdateError.message}`);
    return;
  }
  if (insertError) throw new Error(`SEO recommendation insert failed: ${insertError.message}`);
}

export async function updateSeoRecommendationStatus(input: {
  recommendationId: string;
  status: SeoRecommendationStatus;
  resolutionNote?: string | null;
  assignedTo?: string | null;
}): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await client
    .from("seo_recommendations")
    .select("id,status")
    .eq("id", input.recommendationId)
    .maybeSingle();
  if (lookupError) throw new Error(`SEO recommendation lookup failed: ${lookupError.message}`);
  if (!existing) throw new Error("SEO recommendation not found.");

  if (!isSeoRecommendationStatus(existing.status)) throw new Error("SEO recommendation has an invalid lifecycle state.");
  const currentStatus = existing.status;
  if (!canTransitionSeoRecommendationStatus(currentStatus, input.status)) {
    throw new Error("That SEO recommendation is already closed and cannot be changed.");
  }
  const resolutionNote = input.resolutionNote?.trim().slice(0, 4_000) || null;
  if (["completed", "dismissed", "expired"].includes(input.status) && (!resolutionNote || resolutionNote.length < 3)) {
    throw new Error("Closing an SEO recommendation requires a resolution note.");
  }
  const { error } = await client.rpc("update_seo_recommendation_status", {
    p_recommendation_id: input.recommendationId,
    p_status: input.status,
    p_resolution_note: resolutionNote,
    p_assigned_to: input.assignedTo ?? null,
  });
  if (error) throw new Error(`SEO recommendation status update failed: ${error.message}`);
}

async function deliverSeoAlertWebhook(
  client: ReturnType<typeof createSupabaseAdminClient>,
  input: { dedupeKey: string; severity: "p0" | "p1" | "p2"; category: string; title: string; message: string; evidence?: Record<string, unknown> },
  occurredAt: string,
): Promise<void> {
  const webhookUrl = process.env.SEO_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl || !/^https:\/\/[^\s]+$/i.test(webhookUrl)) return;
  const { data } = await client.from("seo_automation_config").select("alert_webhook_enabled").eq("id", true).maybeSingle();
  if (!data?.alert_webhook_enabled) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        source: "airveek-seo",
        dedupeKey: input.dedupeKey.slice(0, 180),
        severity: input.severity,
        category: input.category.slice(0, 80),
        title: input.title.slice(0, 180),
        message: input.message.slice(0, 4_000),
        evidence: sanitizeMetadata(input.evidence),
        occurredAt,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.warn("[seo-control] alert webhook delivery unavailable", error instanceof Error ? error.name : "unknown");
  }
}

function unavailableStart(config = DEFAULT_CONFIG): SeoJobStart {
  return { runId: null, shouldRun: false, reason: "schema_unavailable", config };
}

function sanitizeMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => key.length <= 80 && isSafeMetadataValue(item))
      .slice(0, 50),
  );
}

function isSafeMetadataValue(value: unknown): boolean {
  return value === null
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
    || (typeof value === "string" && value.length <= 500);
}

function nonNegativeInteger(value: number | undefined): number {
  return Number.isInteger(value) && (value ?? 0) >= 0 ? value as number : 0;
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}
