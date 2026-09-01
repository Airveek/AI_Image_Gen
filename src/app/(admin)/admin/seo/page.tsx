import { SeoDashboardTabs } from "@/components/seo/seo-dashboard-tabs";
import { getAdminSeoDashboard } from "@/features/seo/server/admin-insights";
import { listSeoOperationsQueue } from "@/features/seo/server/content-operations";
import { SeoOperationsPanel } from "@/features/seo/components/seo-operations-panel";
import { SeoBriefIntakePanel } from "@/features/seo/components/seo-brief-intake-panel";
import { SeoRecommendationActions } from "@/features/seo/components/seo-recommendation-actions";
import type { AdminSeoDashboardData, AdminSeoJobRun } from "@/features/seo/types";
import type { SeoRecommendationStatus } from "@/features/seo/recommendation-contract";

export default async function AdminSeoPage() {
  const [data, operationsQueue] = await Promise.all([
    getAdminSeoDashboard(),
    listSeoOperationsQueue().catch(() => ({ briefs: [], assignments: [], members: [], rollouts: [] })),
  ]);
  const coverageCards = [
    ["Published URLs", data.summary.publishedUrls],
    ["Crawlable URLs", data.summary.crawlableUrls],
    ["Indexed (sampled)", data.summary.verifiedIndexedUrls],
  ] as const;
  const performanceCards = [
    ["Google clicks", data.summary.googleClicks],
    ["Google impressions", data.summary.googleImpressions],
    ["Organic sessions", data.summary.organicSessions],
    ["Organic signups", data.summary.organicSignups],
    ["Organic purchases", data.summary.organicPurchases],
    ["Organic revenue", `$${data.summary.organicRevenue.toFixed(2)}`],
  ] as const;
  const vitalCards = (["lcp", "inp", "cls"] as const).map((name) => {
    const metric = data.summary.coreWebVitals[name];
    const value = metric ? `${metric.p75.toFixed(name === "cls" ? 3 : 0)}${name === "cls" ? "" : " ms"}` : "—";
    return [name.toUpperCase(), value] as const;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">SEO control plane</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-brand-white sm:text-4xl">Search performance and publishing health</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">A gated operating view of the SEO system. Publishing, redirects, merges, pruning, and template promotion remain explicitly approval-controlled.</p>
      </header>

      {data.setupMessage ? <p className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100">{data.setupMessage}</p> : null}
      <SeoBriefIntakePanel />

      <SeoDashboardTabs
        tabs={[
          {
            id: "executive",
            label: "Executive",
            panel: <section className="space-y-4" aria-labelledby="executive-heading"><h2 id="executive-heading" className="font-display text-xl font-bold text-brand-white">Executive</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[...coverageCards, ["Open alerts", data.summary.openAlerts] as const, ["Open recommendations", data.summary.openRecommendations] as const, ["Overdue recommendations", data.summary.overdueRecommendations] as const].map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</div></section>,
          },
          {
            id: "coverage",
            label: "Coverage",
            panel: <section className="space-y-4" aria-labelledby="coverage-heading"><h2 id="coverage-heading" className="font-display text-xl font-bold text-brand-white">Coverage</h2><div className="grid gap-4 sm:grid-cols-3">{coverageCards.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</div><p className="rounded-2xl border border-white/10 bg-brand-panel p-5 text-sm leading-6 text-muted">Only live, canonical, indexable pages can enter a sitemap. Orphan, non-200, noindex, or failed pages remain out of the public discovery surface.</p></section>,
          },
          {
            id: "performance",
            label: "Performance",
            panel: <section className="space-y-4" aria-labelledby="performance-heading"><h2 id="performance-heading" className="font-display text-xl font-bold text-brand-white">Performance</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{performanceCards.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</div><div className="grid gap-4 sm:grid-cols-3">{vitalCards.map(([label, value]) => <MetricCard key={label} label={`P75 ${label}`} value={value} />)}</div><div className="grid gap-6 lg:grid-cols-2"><AttributionCard title="First-touch attribution" rows={data.attribution.firstTouch} /><AttributionCard title="Last non-direct attribution" rows={data.attribution.lastNonDirect} /></div><p className="rounded-2xl border border-white/10 bg-brand-panel p-5 text-sm leading-6 text-muted">GSC is the pre-click source of truth; GA4/BigQuery measures anonymous behavior; Whop remains the payment and refund source of truth. Core Web Vitals are consent-gated and reported as anonymous 75th-percentile samples; targets are LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1.</p></section>,
          },
          {
            id: "quality-links",
            label: "Quality & links",
            panel: <section className="grid gap-6 lg:grid-cols-2" aria-labelledby="quality-heading"><div className="rounded-2xl border border-white/10 bg-brand-panel p-6"><h2 id="quality-heading" className="font-display text-xl font-bold text-brand-white">Quality & links</h2><p className="mt-3 text-sm leading-6 text-muted">Every page is checked for evidence, rights, structured content, schema, canonical state, CTA health, and crawlable inbound/outbound links before publication.</p><p className="mt-4 text-sm text-brand-soft">Open alerts: {data.summary.openAlerts} · Open recommendations: {data.summary.openRecommendations}</p></div><AlertList alerts={data.alerts} /><RecommendationList recommendations={data.recommendations} /></section>,
          },
          {
            id: "experiments",
            label: "Experiments",
            panel: <section className="rounded-2xl border border-white/10 bg-brand-panel p-6" aria-labelledby="experiments-heading"><h2 id="experiments-heading" className="font-display text-xl font-bold text-brand-white">Experiments</h2><p className="mt-3 text-sm leading-6 text-muted">Template rollouts stay manual-review gated until 50 pages and 14 healthy days pass. Refreshes, merges, canonical changes, redirects, and pruning require explicit approval.</p></section>,
          },
          {
            id: "operations",
            label: "Operations",
            panel: <OperationsSummary data={data} operationsQueue={operationsQueue} />,
          },
        ]}
      />
    </div>
  );
}

function OperationsSummary({ data, operationsQueue }: { data: AdminSeoDashboardData; operationsQueue: Awaited<ReturnType<typeof listSeoOperationsQueue>> }) {
  const integrationReadiness = { GSC: data.readiness.gsc, GA4: data.readiness.ga4, Bing: data.readiness.bing, IndexNow: data.readiness.indexNow };
  const membersReady = data.operations.contentMembers.writers > 0 && (data.operations.contentMembers.publishers > 0 || data.operations.contentMembers.seoAdmins > 0);
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-brand-panel p-6" aria-labelledby="operations-heading">
        <h2 id="operations-heading" className="font-display text-xl font-bold text-brand-white">Operations</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">{Object.entries(integrationReadiness).map(([label, ready]) => <div className="rounded-xl border border-white/10 p-3" key={label}><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p><p className={`mt-2 text-sm font-bold ${ready ? "text-brand-neon" : "text-amber-200"}`}>{ready ? "Ready" : "Setup needed"}</p></div>)}</div>
        <div className="mt-4 rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Active content team</p><p className={`text-xs font-semibold ${membersReady ? "text-brand-neon" : "text-amber-200"}`}>{membersReady ? "Ready for controlled automation" : "Writer + publisher required"}</p></div><div className="mt-3 grid gap-2 sm:grid-cols-3"><MetricCard label="Active writers" value={data.operations.contentMembers.writers} /><MetricCard label="Active publishers" value={data.operations.contentMembers.publishers} /><MetricCard label="Active SEO admins" value={data.operations.contentMembers.seoAdmins} /></div></div>
        <div className="mt-4 rounded-xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Measurement import watermarks</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{data.importWatermarks.map((item) => <div className="rounded-xl border border-white/10 p-3" key={item.source}><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold uppercase text-brand-white">{item.source}</p><span className={`text-xs font-bold uppercase ${item.status === "failed" ? "text-amber-200" : item.status === "succeeded" ? "text-brand-neon" : "text-muted"}`}>{item.status}</span></div><p className="mt-2 text-xs text-muted">Success: {item.lastSuccessMetricDate ?? "—"}</p><p className="text-xs text-muted">Attempt: {item.lastAttemptedMetricDate ?? "—"}</p>{item.lastError ? <p className="mt-2 line-clamp-2 text-xs text-amber-100">{item.lastError}</p> : null}</div>)}</div></div>
        <div className="mt-4 rounded-xl border border-white/10 p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Keyword evidence feedback</p><p className="text-xs text-muted">Since {data.periodDays} days · latest {data.keywordEvidence.latestMetricDate ?? "—"}</p></div><div className="mt-3 grid gap-2 sm:grid-cols-4"><MetricCard label="Evidence rows" value={data.keywordEvidence.totalRows} /><MetricCard label="Measured rows" value={data.keywordEvidence.measuredRows} /><MetricCard label="Qualitative rows" value={data.keywordEvidence.qualitativeRows} /><MetricCard label="Brief/page-linked" value={data.keywordEvidence.linkedRows} /></div>{data.keywordEvidence.sources.length ? <div className="mt-3 flex flex-wrap gap-2">{data.keywordEvidence.sources.map((item) => <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-brand-soft" key={item.source}>{item.source}: {item.rows}</span>)}</div> : <p className="mt-3 text-xs text-muted">No keyword evidence has been imported yet. The ingest command is dry-run by default and never publishes.</p>}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4"><MetricCard label="Active assignments" value={data.operations.activeAssignments} /><MetricCard label="Review queue" value={data.operations.reviewQueue} /><MetricCard label="Evidence queue" value={data.operations.evidenceQueue} /><MetricCard label="Audit events" value={data.operations.auditEvents} /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4"><MetricCard label="Active agent runs" value={data.operations.activeAgentRuns} /><MetricCard label="Expired agent runs" value={data.operations.expiredAgentRuns} /><MetricCard label="Failed agent runs" value={data.operations.failedAgentRuns} /><MetricCard label="Agent run states" value={Object.keys(data.operations.agentRunsByStatus).length} /></div>
        <StatusChips title="Brief status" values={data.operations.briefsByStatus} />
        <StatusChips title="Agent run status" values={data.operations.agentRunsByStatus} />
        <JobRuns jobs={data.jobs} />
      </section>
      <SeoOperationsPanel briefs={operationsQueue.briefs} assignments={operationsQueue.assignments} members={operationsQueue.members} rollouts={operationsQueue.rollouts} />
    </div>
  );
}

function StatusChips({ title, values }: { title: string; values: Record<string, number> }) {
  if (!Object.keys(values).length) return null;
  return <div className="mt-4 rounded-xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{title}</p><div className="mt-3 flex flex-wrap gap-2">{Object.entries(values).map(([status, count]) => <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-brand-soft" key={status}>{status}: {count}</span>)}</div></div>;
}

function JobRuns({ jobs }: { jobs: AdminSeoJobRun[] }) {
  return jobs.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2">{jobs.map((job) => <li className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4" key={job.id}><div><p className="font-semibold text-brand-white">{job.loopName}</p><p className="mt-1 text-xs text-muted">Checked {job.checkedCount} · acted {job.actedCount}</p></div><span className="text-xs font-bold uppercase text-brand-neon">{job.status}</span></li>)}</ul> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">SEO jobs will appear after the Inngest control plane is enabled.</p>;
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl border border-white/10 bg-brand-panel p-5"><p className="text-sm text-muted">{label}</p><p className="mt-3 font-display text-3xl font-bold text-brand-white">{value}</p></div>;
}

function AlertList({ alerts }: { alerts: Array<{ id: string; severity: string; category: string; title: string; message: string }> }) {
  return alerts.length ? <div className="rounded-2xl border border-white/10 bg-brand-panel p-6"><h2 className="font-display text-xl font-bold text-brand-white">Current blockers</h2><ul className="mt-4 space-y-3">{alerts.slice(0, 8).map((alert) => <li className="rounded-xl border border-white/10 p-4" key={alert.id}><p className="text-xs font-bold uppercase text-brand-neon">{alert.severity} · {alert.category}</p><p className="mt-1 font-semibold text-brand-white">{alert.title}</p><p className="mt-1 text-sm text-muted">{alert.message}</p></li>)}</ul></div> : <div className="rounded-2xl border border-white/10 bg-brand-panel p-6"><h2 className="font-display text-xl font-bold text-brand-white">Current blockers</h2><p className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">No SEO alerts recorded.</p></div>;
}

function RecommendationList({ recommendations }: { recommendations: Array<{ id: string; severity: string; category: string; title: string; message: string; recommendedAction: string; query: string | null; status: SeoRecommendationStatus }> }) {
  return recommendations.length ? <div className="rounded-2xl border border-white/10 bg-brand-panel p-6 lg:col-span-2"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-display text-xl font-bold text-brand-white">Improvement queue</h2><span className="text-xs text-muted">deduplicated measurement work</span></div><ul className="mt-4 grid gap-3 lg:grid-cols-2">{recommendations.slice(0, 12).map((recommendation) => <li className="rounded-xl border border-white/10 p-4" key={recommendation.id}><p className="text-xs font-bold uppercase text-brand-neon">{recommendation.severity} · {recommendation.category}{recommendation.query ? ` · ${recommendation.query}` : ""}</p><p className="mt-1 font-semibold text-brand-white">{recommendation.title}</p><p className="mt-1 text-sm text-muted">{recommendation.message}</p><p className="mt-3 text-sm leading-6 text-brand-soft"><span className="font-semibold text-brand-white">Next action:</span> {recommendation.recommendedAction}</p><SeoRecommendationActions currentStatus={recommendation.status} recommendationId={recommendation.id} /></li>)}</ul></div> : <div className="rounded-2xl border border-white/10 bg-brand-panel p-6 lg:col-span-2"><h2 className="font-display text-xl font-bold text-brand-white">Improvement queue</h2><p className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">No measurement recommendations recorded.</p></div>;
}

type AttributionRow = { source: string; medium: string; users: number; signups: number; firstGenerations: number; checkoutStarts: number; activations: number; paidUsers: number; verifiedPayments: number; refundEvents: number; verifiedRevenueUsd: number };

function AttributionCard({ title, rows }: { title: string; rows: AttributionRow[] }) {
  return <div className="rounded-2xl border border-white/10 bg-brand-panel p-5"><div className="flex items-baseline justify-between gap-3"><h3 className="font-display text-lg font-bold text-brand-white">{title}</h3><span className="text-xs text-muted">linked users</span></div>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><caption className="sr-only">{title} by source and medium</caption><thead className="text-muted"><tr><th className="pb-2 pr-3 font-semibold">Source / medium</th><th className="pb-2 pr-3 font-semibold">Users</th><th className="pb-2 pr-3 font-semibold">Signups</th><th className="pb-2 pr-3 font-semibold">Generations</th><th className="pb-2 pr-3 font-semibold">Checkouts</th><th className="pb-2 pr-3 font-semibold">Activations</th><th className="pb-2 pr-3 font-semibold">Paid</th><th className="pb-2 pr-3 font-semibold">Verified payments</th><th className="pb-2 pr-3 font-semibold">Refunds</th><th className="pb-2 font-semibold">Verified USD</th></tr></thead><tbody>{rows.map((row) => <tr className="border-t border-white/10 text-brand-soft" key={`${row.source}:${row.medium}`}><td className="py-2 pr-3 font-semibold text-brand-white">{row.source} / {row.medium}</td><td className="py-2 pr-3">{row.users}</td><td className="py-2 pr-3">{row.signups}</td><td className="py-2 pr-3">{row.firstGenerations}</td><td className="py-2 pr-3">{row.checkoutStarts}</td><td className="py-2 pr-3">{row.activations}</td><td className="py-2 pr-3">{row.paidUsers}</td><td className="py-2 pr-3">{row.verifiedPayments}</td><td className="py-2 pr-3">{row.refundEvents}</td><td className="py-2">${row.verifiedRevenueUsd.toFixed(2)}</td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted">No linked attribution data yet.</p>}</div>;
}
