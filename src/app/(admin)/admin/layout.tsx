import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { noIndexMetadata } from "@/lib/seo/site";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { AdminAuthorizationError, requireAdminUser } from "@/features/admin/server/authorization";

export const metadata: Metadata = {
  ...noIndexMetadata,
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      redirect("/");
    }

    throw error;
  }

  return <AdminShell>{children}</AdminShell>;
}
