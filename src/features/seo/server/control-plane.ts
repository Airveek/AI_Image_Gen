import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SeoIntegrationReadiness, SeoJobStart, SeoJobStatus } from "@/features/seo/types";

const DEFAULT_CONFIG: SeoJobStart["config"] = {
  crawlEnabled: false,
  sourceSyncEnabled: false,
  crawlBatchSize: 50,
  dailyPublishLimit: 200,
  dailyPublishWaveSize: 50,
};

export function getSeoIntegrationReadiness(): SeoIntegrationReadiness {
  return {
    gsc: Boolean(
      process.env.GSC_SITE_URL
      && process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64,
    ),
    ga4: Boolean(
      process.env.GA4_PROPERTY_ID
      && process.env.GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64,
    ),
    bing: Boolean(process.env.BING_WEBMASTER_API_KEY),
    indexNow: Boolean(process.env.INDEXNOW_KEY && process.env.INDEXNOW_KEY_LOCATION),
  };
}

export async function startSeoJob(input: {
  loopName: string;
  idempotencyKey: string;
  capability: "crawl" | "source-sync" | "always";
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
      .select("enabled,crawl_enabled,source_sync_enabled,crawl_batch_size,daily_publish_limit,daily_publish_wave_size")
      .eq("id", true)
      .maybeSingle();
    if (configError) return unavailableStart();

    const config = rawConfig
      ? {
          crawlEnabled: Boolean(rawConfig.crawl_enabled),
          sourceSyncEnabled: Boolean(rawConfig.source_sync_enabled),
          crawlBatchSize: positiveInteger(rawConfig.crawl_batch_size, 50),
          dailyPublishLimit: positiveInteger(rawConfig.daily_publish_limit, 200),
          dailyPublishWaveSize: positiveInteger(rawConfig.daily_publish_wave_size, 50),
        }
      : DEFAULT_CONFIG;
    const globallyEnabled = Boolean(rawConfig?.enabled) && process.env.SEO_AUTOMATION_ENABLED === "true";
    const capabilityEnabled = input.capability === "always"
      ? globallyEnabled
      : input.capability === "crawl"
        ? globallyEnabled && config.crawlEnabled
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
  try {
    const client = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await client.from("seo_job_runs").update({
      status: input.status,
      checked_count: nonNegativeInteger(input.checkedCount),
      acted_count: nonNegativeInteger(input.actedCount),
      note: input.note.slice(0, 2_000),
      error_code: input.errorCode?.slice(0, 120) ?? null,
      completed_at: now,
    }).eq("id", input.runId).eq("status", "running");
    if (error) throw error;

    const succeeded = input.status === "succeeded";
    const { data: existing } = await client
      .from("seo_job_state")
      .select("consecutive_failures")
      .eq("loop_name", input.loopName)
      .maybeSingle();
    const failureCount = succeeded ? 0 : positiveInteger(existing?.consecutive_failures, 0) + (input.status === "failed" ? 1 : 0);
    await client.from("seo_job_state").upsert({
      loop_name: input.loopName,
      cursor: sanitizeMetadata(input.cursor),
      last_run_at: now,
      last_success_at: succeeded ? now : undefined,
      consecutive_failures: failureCount,
      updated_at: now,
    }, { onConflict: "loop_name" });
  } catch (error) {
    console.warn("[seo-control] job completion unavailable", {
      loop: input.loopName,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function upsertSeoAlert(input: {
  dedupeKey: string;
  severity: "p0" | "p1" | "p2";
  category: string;
  title: string;
  message: string;
  evidence?: Record<string, unknown>;
}): Promise<void> {
  try {
    const client = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: existing } = await client
      .from("seo_alerts")
      .select("id")
      .eq("dedupe_key", input.dedupeKey.slice(0, 180))
      .in("status", ["open", "acknowledged"])
      .maybeSingle();
    const payload = {
      severity: input.severity,
      category: input.category.slice(0, 80),
      title: input.title.slice(0, 180),
      message: input.message.slice(0, 4_000),
      evidence: sanitizeMetadata(input.evidence),
      last_seen_at: now,
    };
    if (existing) {
      await client.from("seo_alerts").update(payload).eq("id", existing.id);
    } else {
      await client.from("seo_alerts").insert({
        ...payload,
        dedupe_key: input.dedupeKey.slice(0, 180),
        status: "open",
        first_seen_at: now,
      });
    }
  } catch (error) {
    console.warn("[seo-control] alert persistence unavailable", {
      category: input.category,
      error: error instanceof Error ? error.name : "unknown",
    });
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
