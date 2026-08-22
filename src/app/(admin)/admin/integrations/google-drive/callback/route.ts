import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdminUser } from "@/features/admin/server/authorization";
import { connectGoogleDrive } from "@/features/creator/server/drive";

const STATE_COOKIE = "airveek_drive_oauth_state";

export async function GET(request: NextRequest) {
  const destination = new URL("/admin/integrations", request.url);
  try {
    await requireAdminUser();
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const code = request.nextUrl.searchParams.get("code") ?? "";
    const cookieStore = await cookies();
    const expectedState = cookieStore.get(STATE_COOKIE)?.value ?? "";
    cookieStore.delete(STATE_COOKIE);

    if (!code || !secureEqual(state, expectedState)) {
      throw new Error("Google Drive returned an invalid or expired connection state.");
    }
    await connectGoogleDrive(code);
    destination.searchParams.set("drive", "connected");
  } catch (error) {
    destination.searchParams.set("error", error instanceof Error ? error.message : "Google Drive connection failed.");
  }
  return NextResponse.redirect(destination);
}

function secureEqual(first: string, second: string): boolean {
  if (!first || first.length !== second.length) return false;
  return timingSafeEqual(Buffer.from(first), Buffer.from(second));
}
