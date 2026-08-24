import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth/redirect-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return redirectToLogin(request, "missing_code", nextPath);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToLogin(request, "confirmation_failed", nextPath);
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}

function redirectToLogin(request: NextRequest, error: string, nextPath: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);

  if (nextPath !== "/dashboard") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}
