import { InsightsDashboard } from "@/features/admin/components/insights-dashboard";
import { getAdminInsights } from "@/features/admin/server/insights";

export default async function AdminInsightsPage() {
  const data = await getAdminInsights();
  return <InsightsDashboard data={data} />;
}
