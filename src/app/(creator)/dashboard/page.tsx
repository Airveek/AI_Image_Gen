import type { Metadata } from "next";

import { CreatorDashboard } from "@/features/creator/components/creator-dashboard";
import { getCurrentUserProfile } from "@/features/account/server/profile";
import { listRecentCreatorAssets } from "@/features/creator/server/assets";
import { getCurrentCreatorAccess } from "@/features/creator/server/entitlements";
import type { CreatorAsset } from "@/features/creator/types";

export const metadata: Metadata = { title: "Creator Dashboard" };

export default async function DashboardPage() {
  let recent: CreatorAsset[] = [];
  let storageMessage: string | null = null;
  const access = await getCurrentCreatorAccess();
  const profile = await getCurrentUserProfile();

  try {
    recent = await listRecentCreatorAssets(6);
  } catch (error) {
    storageMessage = error instanceof Error ? error.message : "Creator storage is not ready.";
  }

  return <CreatorDashboard recent={recent} storageMessage={storageMessage} access={access} profile={profile} />;
}
