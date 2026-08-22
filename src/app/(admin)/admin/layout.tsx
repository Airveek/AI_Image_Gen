import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/features/admin/components/admin-shell";
import { AdminAuthorizationError, requireAdminUser } from "@/features/admin/server/authorization";

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
