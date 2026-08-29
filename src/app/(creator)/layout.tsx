import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { noIndexMetadata } from "@/lib/seo/site";

import { CreatorShell } from "@/features/creator/components/creator-shell";
import {
  CreatorAuthorizationError,
  requireCreatorUser,
} from "@/features/creator/server/authorization";
import type { CreatorIdentity } from "@/features/creator/types";

export const metadata: Metadata = {
  ...noIndexMetadata,
};

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
