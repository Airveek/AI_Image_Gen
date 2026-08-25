import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ShieldAlert, Users, UserRoundCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminDashboardData } from "@/features/admin/server/users";
import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import type { AdminDashboardData } from "@/features/admin/types";
import { cn } from "@/lib/utils";

export default async function AdminOverviewPage() {
  let dashboard: AdminDashboardData;
  try {
    dashboard = await getAdminDashboardData();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/");
    throw error;
  }

  const stats = [
    { label: "Total users", value: dashboard.totalUsers, icon: Users, tone: "text-brand-soft" },
    { label: "Verified users", value: dashboard.verifiedUsers, icon: UserRoundCheck, tone: "text-brand-soft" },
    { label: "Active users", value: dashboard.activeUsers, icon: CheckCircle2, tone: "text-brand-soft" },
    { label: "Suspended users", value: dashboard.suspendedUsers, icon: ShieldAlert, tone: "text-red-200" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">Overview</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-white sm:text-4xl">Your user dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">A simple view of the people using Airveek.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-neon px-4 text-sm font-bold text-brand-black transition hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-neon" href="/admin/users">
          Manage users <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return <Card className="p-5" key={stat.label}><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-muted">{stat.label}</p><p className="mt-3 font-display text-3xl font-bold text-brand-white">{stat.value}</p></div><span className={cn("grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06]", stat.tone)}><Icon aria-hidden="true" className="h-5 w-5" /></span></div></Card>;
        })}
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle>Recent registrations</CardTitle><CardDescription>The five newest accounts from Supabase Auth.</CardDescription></div>
          <Link className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-soft hover:bg-brand-neon/10 sm:inline-flex" href="/admin/users">View all <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
        </CardHeader>
        <CardContent>
          {dashboard.recentUsers.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">No registered users yet.</p> : <div className="divide-y divide-white/[0.06]">{dashboard.recentUsers.map((user) => <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between" key={user.id}><div><p className="font-semibold text-brand-white">{user.displayName}</p><p className="mt-1 text-sm text-muted">{user.email ?? "No email address"}</p></div><Badge variant={user.status === "suspended" ? "danger" : "success"}>{user.status === "suspended" ? "Suspended" : "Active"}</Badge></div>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
