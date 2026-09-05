import { InsightsDashboard } from "@/features/admin/components/insights-dashboard";
import { getAdminInsights } from "@/features/admin/server/insights";

export default async function AdminInsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const daysValue = Array.isArray(params.days) ? params.days[0] : params.days;
  const campaignValue = Array.isArray(params.campaign) ? params.campaign[0] : params.campaign;
  const data = await getAdminInsights({
    funnelDays: Number(daysValue ?? 30),
    campaign: typeof campaignValue === "string" && campaignValue.length <= 160 ? campaignValue : null,
  });
  return <InsightsDashboard data={data} />;
}
