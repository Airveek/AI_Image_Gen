import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { CreatorShell } from "@/features/creator/components/creator-shell";
import {
  CreatorAuthorizationError,
  requireCreatorUser,
} from "@/features/creator/server/authorization";
import type { CreatorIdentity } from "@/features/creator/types";

export default async function CreatorLayout({ children }: { children: ReactNode }) {
  let user: CreatorIdentity;
  try {
    user = await requireCreatorUser();
  } catch (error) {
    if (error instanceof CreatorAuthorizationError) {
      redirect("/login");
    }
    throw error;
  }

  return <CreatorShell user={user}>{children}</CreatorShell>;
}
