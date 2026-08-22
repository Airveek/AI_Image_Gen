import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireAdminUser } from "@/features/admin/server/authorization";
import { getDriveAuthorizationUrl } from "@/features/creator/server/drive";

const STATE_COOKIE = "airveek_drive_oauth_state";

export async function GET() {
  try {
    await requireAdminUser();
    const state = randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/admin/integrations/google-drive",
    });
    return NextResponse.redirect(getDriveAuthorizationUrl(state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive connection could not start.";
    return NextResponse.redirect(new URL(`/admin/integrations?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"));
  }
}
