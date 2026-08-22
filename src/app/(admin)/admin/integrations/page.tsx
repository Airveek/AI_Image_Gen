import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminAuthorizationError, requireAdminUser } from "@/features/admin/server/authorization";
import { IntegrationSettings } from "@/features/creator/components/integration-settings";
import { getDriveConnectionStatus } from "@/features/creator/server/drive";
import { listImageProviderSettings } from "@/features/creator/server/integrations";
import { getR2Status } from "@/features/creator/server/r2";
import type { ImageProviderSetting } from "@/features/creator/types";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ drive?: string; error?: string }>;
}) {
  const query = await searchParams;
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/");
    throw error;
  }
  let providers: ImageProviderSetting[] = [];
  let setupMessage: string | null = null;
  try {
    providers = await listImageProviderSettings();
  } catch (error) {
    setupMessage = error instanceof Error ? error.message : "Integration settings are unavailable.";
  }

  const [drive, r2] = await Promise.all([
    getDriveConnectionStatus(),
    getR2Status(),
  ]);

  return (
    <IntegrationSettings
      providers={providers}
      drive={drive}
      r2={r2}
      setupMessage={setupMessage}
      initialMessage={query.error ?? (query.drive === "connected" ? "Google Drive connected successfully." : "")}
    />
  );
}
