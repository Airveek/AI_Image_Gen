import "server-only";

import { requireAdminUser } from "@/features/admin/server/authorization";
import type {
  AdminSeoAlert,
  AdminSeoAttributionRow,
  AdminSeoDashboardData,
  AdminSeoImportWatermark,
  AdminSeoKeywordEvidenceSummary,
  AdminSeoJobRun,
  AdminSeoRecommendation,
  SeoIntegrationReadiness,
  SeoJobStatus,
} from "@/features/seo/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSeoIntegrationReadiness } from "@/features/seo/server/control-plane";

export async function getAdminSeoDashboard(periodDays = 28): Promise<AdminSeoDashboardData> {
  await requireAdminUser();
  const safePeriodDays = Number.isInteger(periodDays) && periodDays >= 1 && periodDays <= 365 ? periodDays : 28;
  const sinceDate = new Date(Date.now() - (safePeriodDays - 1) * 86_400_000).toISOString().slice(0, 10);

  try {
    const client = createSupabaseAdminClient();
    const [summaryResult, alertsResult, recommendationsResult, recommendationSummaryResult, jobsResult, operationsResult, watermarksResult, membersResult, attributionResult, keywordEvidenceResult] = await Promise.all([
      client.rpc("get_seo_dashboard_summary", { since_date: sinceDate }),
      client
        .from("seo_alerts")
        .select("id,severity,category,title,message,status,last_seen_at")
        .in("status", ["open", "acknowledged"])
        .order("last_seen_at", { ascending: false })
        .limit(50),
      client
        .from("seo_recommendations")
        .select("id,severity,category,title,message,recommended_action,status,page_id,canonical_url,query,last_seen_at,due_at")
        .in("status", ["open", "acknowledged", "in_progress"])
        .order("severity", { ascending: true })
        .order("last_seen_at", { ascending: false })
        .limit(50),
      client.rpc("get_seo_recommendation_summary", { since_date: sinceDate }),
      client
        .from("seo_job_runs")
        .select("id,loop_name,status,checked_count,acted_count,note,started_at,completed_at")
        .order("started_at", { ascending: false })
        .limit(50),
      client.rpc("get_seo_operations_summary"),
      client
        .from("seo_import_watermarks")
        .select("source,status,last_attempted_metric_date,last_success_metric_date,last_error")
        .order("source", { ascending: true }),
      client
        .from("content_members")
        .select("role")
        .eq("is_active", true),
      client.rpc("get_seo_attribution_summary", { since_date: sinceDate }),
      client.rpc("get_seo_keyword_evidence_summary", { since_date: sinceDate }),
    ]);

    if (summaryResult.error || alertsResult.error || recommendationsResult.error || recommendationSummaryResult.error || jobsResult.error || operationsResult.error || watermarksResult.error || membersResult.error || attributionResult.error || keywordEvidenceResult.error) {
      throw new Error(summaryResult.error?.message ?? alertsResult.error?.message ?? recommendationsResult.error?.message ?? recommendationSummaryResult.error?.message ?? jobsResult.error?.message ?? operationsResult.error?.message ?? watermarksResult.error?.message ?? membersResult.error?.message ?? attributionResult.error?.message ?? keywordEvidenceResult.error?.message);
    }
    const summary = readSummary(summaryResult.data);
    const recommendationSummary = readRecommendationSummary(recommendationSummaryResult.data);
    summary.values.openRecommendations = recommendationSummary.open;
    summary.values.overdueRecommendations = recommendationSummary.overdue;
    return {
      available: true,
      setupMessage: null,
      generatedAt: summary.generatedAt,
      periodDays: safePeriodDays,
      readiness: getSeoIntegrationReadiness(),
      summary: summary.values,
      alerts: (alertsResult.data ?? []).map(mapAlert),
      recommendations: (recommendationsResult.data ?? []).map(mapRecommendation),
      jobs: (jobsResult.data ?? []).map(mapJob),
      importWatermarks: (watermarksResult.data ?? []).map(mapImportWatermark),
      keywordEvidence: readKeywordEvidenceSummary(keywordEvidenceResult.data),
      attribution: readAttributionSummary(attributionResult.data),
      operations: {
        ...readOperationsSummary(operationsResult.data),
        contentMembers: readContentMemberCounts(membersResult.data),
      },
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
    readiness: emptyReadiness(),
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
      openRecommendations: 0,
      overdueRecommendations: 0,
      coreWebVitals: {},
    },
    alerts: [],
    recommendations: [],
    jobs: [],
    importWatermarks: [],
    keywordEvidence: emptyKeywordEvidenceSummary(),
    attribution: { firstTouch: [], lastNonDirect: [] },
    operations: {
      briefsByStatus: {},
      activeAssignments: 0,
      reviewQueue: 0,
      evidenceQueue: 0,
      auditEvents: 0,
      contentMembers: { writers: 0, publishers: 0, seoAdmins: 0 },
      agentRunsByStatus: {},
      activeAgentRuns: 0,
      expiredAgentRuns: 0,
      failedAgentRuns: 0,
    },
  };
}

function emptyKeywordEvidenceSummary(): AdminSeoKeywordEvidenceSummary {
  return { totalRows: 0, measuredRows: 0, qualitativeRows: 0, linkedRows: 0, latestMetricDate: null, sources: [] };
}

function readKeywordEvidenceSummary(value: unknown): AdminSeoKeywordEvidenceSummary {
  const row = isRecord(value) ? value : {};
  const sources = Array.isArray(row.sources)
    ? row.sources.flatMap((item) => {
      if (!isRecord(item)) return [];
      const source = readString(item.source);
      return source ? [{ source, rows: readNumber(item.rows) }] : [];
    }).slice(0, 20)
    : [];
  return {
    totalRows: readNumber(row.totalRows),
    measuredRows: readNumber(row.measuredRows),
    qualitativeRows: readNumber(row.qualitativeRows),
    linkedRows: readNumber(row.linkedRows),
    latestMetricDate: readString(row.latestMetricDate),
    sources,
  };
}

function readAttributionSummary(value: unknown): { firstTouch: AdminSeoAttributionRow[]; lastNonDirect: AdminSeoAttributionRow[] } {
  const row = isRecord(value) ? value : {};
  return {
    firstTouch: readAttributionRows(row.firstTouch),
    lastNonDirect: readAttributionRows(row.lastNonDirect),
  };
}

function readAttributionRows(value: unknown): AdminSeoAttributionRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const source = readString(item.source);
    const medium = readString(item.medium);
    if (!source || !medium) return [];
    return [{
      source,
      medium,
      users: readNumber(item.users),
      signups: readNumber(item.signups),
      firstGenerations: readNumber(item.firstGenerations),
      checkoutStarts: readNumber(item.checkoutStarts),
      activations: readNumber(item.activations),
      paidUsers: readNumber(item.paidUsers),
      verifiedPayments: readNumber(item.verifiedPayments),
      refundEvents: readNumber(item.refundEvents),
      verifiedRevenueUsd: readNumber(item.verifiedRevenueUsd),
    }];
  }).slice(0, 50);
}

function readOperationsSummary(value: unknown): AdminSeoDashboardData["operations"] {
  const row = isRecord(value) ? value : {};
  const briefs = isRecord(row.briefsByStatus) ? Object.fromEntries(
    Object.entries(row.briefsByStatus).flatMap(([key, count]) => {
      const parsed = readNumber(count);
      return key.trim() ? [[key, parsed]] : [];
    }),
  ) : {};
  const agentRuns = isRecord(row.agentRunsByStatus) ? Object.fromEntries(
    Object.entries(row.agentRunsByStatus).flatMap(([key, count]) => {
      const parsed = readNumber(count);
      return key.trim() ? [[key, parsed]] : [];
    }),
  ) : {};
  return {
    briefsByStatus: briefs,
    activeAssignments: readNumber(row.activeAssignments),
    reviewQueue: readNumber(row.reviewQueue),
    evidenceQueue: readNumber(row.evidenceQueue),
    auditEvents: readNumber(row.auditEvents),
    contentMembers: { writers: 0, publishers: 0, seoAdmins: 0 },
    agentRunsByStatus: agentRuns,
    activeAgentRuns: readNumber(row.activeAgentRuns),
    expiredAgentRuns: readNumber(row.expiredAgentRuns),
    failedAgentRuns: readNumber(row.failedAgentRuns),
  };
}

function readContentMemberCounts(value: unknown): AdminSeoDashboardData["operations"]["contentMembers"] {
  const counts = { writers: 0, publishers: 0, seoAdmins: 0 };
  if (!Array.isArray(value)) return counts;
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (item.role === "writer") counts.writers += 1;
    if (item.role === "publisher") counts.publishers += 1;
    if (item.role === "seo_admin") counts.seoAdmins += 1;
  }
  return counts;
}

function emptyReadiness(): SeoIntegrationReadiness {
  return { gsc: false, ga4: false, bing: false, indexNow: false };
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
      openRecommendations: readNumber(row.openRecommendations),
      overdueRecommendations: readNumber(row.overdueRecommendations),
      coreWebVitals: readCoreWebVitals(row.coreWebVitals),
    },
  };
}

function readRecommendationSummary(value: unknown): { open: number; overdue: number } {
  const row = isRecord(value) ? value : {};
  return {
    open: readNumber(row.open) + readNumber(row.acknowledged) + readNumber(row.inProgress),
    overdue: readNumber(row.overdue),
  };
}

function readCoreWebVitals(value: unknown): AdminSeoDashboardData["summary"]["coreWebVitals"] {
  if (!isRecord(value)) return {};
  const result: AdminSeoDashboardData["summary"]["coreWebVitals"] = {};
  for (const name of ["lcp", "inp", "cls"] as const) {
    const metric = isRecord(value[name]) ? value[name] : null;
    if (!metric) continue;
    const p75 = readNumber(metric.p75);
    const sampleCount = readNumber(metric.sampleCount);
    if (sampleCount > 0) result[name] = { p75, sampleCount };
  }
  return result;
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

function mapRecommendation(row: Record<string, unknown>): AdminSeoRecommendation {
  return {
    id: readString(row.id) ?? "unknown",
    severity: readSeverity(row.severity),
    category: readString(row.category) ?? "unknown",
    title: readString(row.title) ?? "SEO recommendation",
    message: readString(row.message) ?? "No details are available.",
    recommendedAction: readString(row.recommended_action) ?? "Review the evidence before taking action.",
    status: readRecommendationStatus(row.status),
    pageId: readString(row.page_id),
    canonicalUrl: readString(row.canonical_url),
    query: readString(row.query),
    lastSeenAt: readString(row.last_seen_at) ?? new Date(0).toISOString(),
    dueAt: readString(row.due_at),
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

function mapImportWatermark(row: Record<string, unknown>): AdminSeoImportWatermark {
  const source = row.source === "gsc" || row.source === "ga4" || row.source === "bing" ? row.source : "gsc";
  const status = row.status === "idle" || row.status === "running" || row.status === "succeeded" || row.status === "failed" ? row.status : "idle";
  return {
    source,
    status,
    lastAttemptedMetricDate: readString(row.last_attempted_metric_date),
    lastSuccessMetricDate: readString(row.last_success_metric_date),
    lastError: readString(row.last_error),
  };
}

function readSeverity(value: unknown): AdminSeoAlert["severity"] {
  return value === "p0" || value === "p1" || value === "p2" ? value : "p2";
}

function readAlertStatus(value: unknown): AdminSeoAlert["status"] {
  return value === "open" || value === "acknowledged" || value === "resolved" ? value : "open";
}

function readRecommendationStatus(value: unknown): AdminSeoRecommendation["status"] {
  return value === "open" || value === "acknowledged" || value === "in_progress" || value === "completed" || value === "dismissed" || value === "expired"
    ? value
    : "open";
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
