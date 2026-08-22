import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  id: string;
  email: string;
};

export class AdminAuthorizationError extends Error {
  constructor(message = "You do not have permission to access the admin panel.") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export async function requireAdminUser(): Promise<AdminIdentity> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.email) {
    throw new AdminAuthorizationError("Please sign in before opening the admin panel.");
  }

  const email = data.user.email.toLowerCase();
  const allowedEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!allowedEmails.has(email)) {
    throw new AdminAuthorizationError();
  }

  return { id: data.user.id, email };
}

export function getActionErrorMessage(error: unknown): string {
  if (error instanceof AdminAuthorizationError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
