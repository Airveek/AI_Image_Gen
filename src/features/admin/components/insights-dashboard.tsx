import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminInsightsData } from "@/features/admin/types";

export function InsightsDashboard({ data }: { data: AdminInsightsData }) {
  const metrics = [
    ["Registered", data.summary.registered.toLocaleString()],
    ["Verified", data.summary.verified.toLocaleString()],
    ["First creation", data.summary.activated.toLocaleString()],
    ["Checkout started", data.summary.checkoutStarters.toLocaleString()],
    ["Paid users", data.summary.paid.toLocaleString()],
    ["Paid conversion", `${data.summary.paidConversionRate}%`],
    ["Active · 7 days", data.summary.active7Days.toLocaleString()],
    ["Active · 30 days", data.summary.active30Days.toLocaleString()],
  ] as const;

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">User insights</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-white sm:text-4xl">What is working?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">See who registers, who pays, and which creation tools bring people back. This report uses first-party Airveek data.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account summary">
        {metrics.map(([label, value]) => (
          <Card className="p-5" key={label}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-3 font-display text-3xl font-bold text-brand-white">{value}</p>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>AI Fashion Photoshoot funnel</CardTitle>
          <CardDescription>Deduplicated first-party campaign events for the selected attribution window.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="mb-6 flex flex-col gap-3 sm:flex-row" method="get">
            <label className="text-sm font-semibold">Window<select className="mt-1 block min-h-11 rounded-xl border border-border bg-surface px-3 font-normal" defaultValue={String(data.fashionFunnel.periodDays)} name="days">{[7, 30, 90, 365].map((days) => <option value={days} key={days}>{days} days</option>)}</select></label>
            <label className="text-sm font-semibold">Campaign<select className="mt-1 block min-h-11 min-w-56 rounded-xl border border-border bg-surface px-3 font-normal" defaultValue={data.fashionFunnel.campaign ?? ""} name="campaign"><option value="">All campaigns</option>{data.fashionFunnel.campaigns.map((campaign) => <option value={campaign} key={campaign}>{campaign}</option>)}</select></label>
            <button className="min-h-11 self-end rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground" type="submit">Apply</button>
          </form>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {data.fashionFunnel.stages.map((stage) => <div className="rounded-2xl border border-border bg-surface-muted p-4" key={stage.eventName}><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{stage.label}</p><p className="mt-2 font-display text-3xl font-bold text-brand-white">{stage.count}</p><p className="mt-1 text-xs text-muted">{stage.conversionFromPrevious === null ? "Entry stage" : `${stage.conversionFromPrevious}% from prior`}</p></div>)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Feature demand</CardTitle>
            <CardDescription>Separate adoption, repeat use, and completion instead of one hidden score.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-brand-gray">
                  <tr><th className="pb-3 pr-4">Tool</th><th className="pb-3 pr-4">Users</th><th className="pb-3 pr-4">Attempts</th><th className="pb-3 pr-4">Success</th><th className="pb-3 pr-4">Repeat</th><th className="pb-3">Paid</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.arenas.map((arena) => (
                    <tr key={arena.arenaId}>
                      <td className="py-3 pr-4 font-semibold text-brand-white">{arena.label}</td>
                      <td className="py-3 pr-4 text-muted">{arena.uniqueUsers}</td>
                      <td className="py-3 pr-4 text-muted">{arena.attempts}</td>
                      <td className="py-3 pr-4 text-brand-soft">{arena.successRate}%</td>
                      <td className="py-3 pr-4 text-muted">{arena.repeatUserRate}%</td>
                      <td className="py-3 text-muted">{arena.paidUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signup cohorts</CardTitle>
            <CardDescription>Weekly users, first creation, payment, and return after seven days.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.cohorts.length === 0 ? <p className="text-sm text-muted">No cohort data yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-brand-gray"><tr><th className="pb-3 pr-4">Week</th><th className="pb-3 pr-4">Users</th><th className="pb-3 pr-4">Created</th><th className="pb-3 pr-4">Paid</th><th className="pb-3">Returned</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {data.cohorts.slice(0, 12).map((cohort) => <tr key={cohort.week}><td className="py-3 pr-4 font-semibold text-brand-white">{cohort.week}</td><td className="py-3 pr-4 text-muted">{cohort.registered}</td><td className="py-3 pr-4 text-muted">{cohort.generated}</td><td className="py-3 pr-4 text-brand-soft">{cohort.paid}</td><td className="py-3 text-muted">{cohort.retained}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User activity</CardTitle>
          <CardDescription>The latest 100 users, with plan, activity, and profile information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-[0.12em] text-brand-gray"><tr><th className="pb-3 pr-4">User</th><th className="pb-3 pr-4">Plan</th><th className="pb-3 pr-4">Last activity</th><th className="pb-3 pr-4">Generations</th><th className="pb-3 pr-4">Tool</th><th className="pb-3 pr-4">Type</th><th className="pb-3">Source</th></tr></thead>
              <tbody className="divide-y divide-border">
                {data.users.map((user) => <tr key={user.id}><td className="py-3 pr-4"><p className="font-semibold text-brand-white">{user.displayName}</p><p className="mt-1 text-xs text-muted">{user.email ?? "No email"}</p></td><td className="py-3 pr-4 text-muted">{user.paidPlan ? `${user.paidPlan} · ${user.paidStatus}` : "Free"}</td><td className="py-3 pr-4 text-muted">{formatDate(user.lastActivityAt)}</td><td className="py-3 pr-4 text-muted">{user.generationCount}</td><td className="py-3 pr-4 text-muted">{user.mostUsedArena ?? "—"}</td><td className="py-3 pr-4 text-muted">{user.userType ?? "—"}</td><td className="py-3 text-muted">{user.acquisitionSource ?? "—"}</td></tr>)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-brand-gray">Updated {formatDate(data.generatedAt)}. Prompts, image files, payment details, and cookies are not included in this report.</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
