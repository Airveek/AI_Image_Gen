import "server-only";

import { requireAdminUser } from "@/features/admin/server/authorization";
import type {
  AdminSeoAlert,
  AdminSeoDashboardData,
  AdminSeoJobRun,
  SeoJobStatus,
} from "@/features/seo/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getAdminSeoDashboard(periodDays = 28): Promise<AdminSeoDashboardData> {
  await requireAdminUser();
  const safePeriodDays = Number.isInteger(periodDays) && periodDays >= 1 && periodDays <= 365 ? periodDays : 28;
  const sinceDate = new Date(Date.now() - (safePeriodDays - 1) * 86_400_000).toISOString().slice(0, 10);

  try {
    const client = createSupabaseAdminClient();
    const [summaryResult, alertsResult, jobsResult] = await Promise.all([
      client.rpc("get_seo_dashboard_summary", { since_date: sinceDate }),
      client
        .from("seo_alerts")
        .select("id,severity,category,title,message,status,last_seen_at")
        .in("status", ["open", "acknowledged"])
        .order("last_seen_at", { ascending: false })
        .limit(50),
      client
        .from("seo_job_runs")
        .select("id,loop_name,status,checked_count,acted_count,note,started_at,completed_at")
        .order("started_at", { ascending: false })
        .limit(50),
    ]);

    if (summaryResult.error || alertsResult.error || jobsResult.error) {
      throw new Error(summaryResult.error?.message ?? alertsResult.error?.message ?? jobsResult.error?.message);
    }
    const summary = readSummary(summaryResult.data);
    return {
      available: true,
      setupMessage: null,
      generatedAt: summary.generatedAt,
      periodDays: safePeriodDays,
      summary: summary.values,
      alerts: (alertsResult.data ?? []).map(mapAlert),
      jobs: (jobsResult.data ?? []).map(mapJob),
    };
  } catch (error) {
    return {
      ...emptySeoDashboard(safePeriodDays),
      setupMessage: error instanceof Error
        ? "SEO measurement is not ready. Apply the control-plane migration and enable integrations."
        : "SEO measurement is not ready.",
    };
  }
}

function emptySeoDashboard(periodDays: number): AdminSeoDashboardData {
  return {
    available: false,
    setupMessage: null,
    generatedAt: new Date().toISOString(),
    periodDays,
    summary: {
      publishedUrls: 0,
      crawlableUrls: 0,
      verifiedIndexedUrls: 0,
      impressionActiveUrls: 0,
      googleClicks: 0,
      googleImpressions: 0,
      organicSessions: 0,
      organicSignups: 0,
      organicPurchases: 0,
      organicRevenue: 0,
      bingClicks: 0,
      openAlerts: 0,
    },
    alerts: [],
    jobs: [],
  };
}

function readSummary(value: unknown): {
  generatedAt: string;
  values: AdminSeoDashboardData["summary"];
} {
  const row = isRecord(value) ? value : {};
  return {
    generatedAt: readString(row.generatedAt) ?? new Date().toISOString(),
    values: {
      publishedUrls: readNumber(row.publishedUrls),
      crawlableUrls: readNumber(row.crawlableUrls),
      verifiedIndexedUrls: readNumber(row.verifiedIndexedUrls),
      impressionActiveUrls: readNumber(row.impressionActiveUrls),
      googleClicks: readNumber(row.googleClicks),
      googleImpressions: readNumber(row.googleImpressions),
      organicSessions: readNumber(row.organicSessions),
      organicSignups: readNumber(row.organicSignups),
      organicPurchases: readNumber(row.organicPurchases),
      organicRevenue: readNumber(row.organicRevenue),
      bingClicks: readNumber(row.bingClicks),
      openAlerts: readNumber(row.openAlerts),
    },
  };
}

function mapAlert(row: Record<string, unknown>): AdminSeoAlert {
  return {
    id: readString(row.id) ?? "unknown",
    severity: readSeverity(row.severity),
    category: readString(row.category) ?? "unknown",
    title: readString(row.title) ?? "SEO alert",
    message: readString(row.message) ?? "No details are available.",
    status: readAlertStatus(row.status),
    lastSeenAt: readString(row.last_seen_at) ?? new Date(0).toISOString(),
  };
}

function mapJob(row: Record<string, unknown>): AdminSeoJobRun {
  return {
    id: readString(row.id) ?? "unknown",
    loopName: readString(row.loop_name) ?? "unknown",
    status: readJobStatus(row.status),
    checkedCount: readNumber(row.checked_count),
    actedCount: readNumber(row.acted_count),
    note: readString(row.note),
    startedAt: readString(row.started_at) ?? new Date(0).toISOString(),
    completedAt: readString(row.completed_at),
  };
}

function readSeverity(value: unknown): AdminSeoAlert["severity"] {
  return value === "p0" || value === "p1" || value === "p2" ? value : "p2";
}

function readAlertStatus(value: unknown): AdminSeoAlert["status"] {
  return value === "open" || value === "acknowledged" || value === "resolved" ? value : "open";
}

function readJobStatus(value: unknown): SeoJobStatus {
  return value === "running" || value === "succeeded" || value === "failed" || value === "skipped"
    ? value
    : "failed";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
