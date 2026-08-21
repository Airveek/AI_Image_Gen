import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeRedirectPath(searchParams.get("next"));

  if (!code) {
    return redirectToLogin(origin, "missing_code", nextPath);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectToLogin(origin, "confirmation_failed", nextPath);
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}

function redirectToLogin(origin: string, error: string, nextPath: string) {
  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", error);

  if (nextPath !== "/dashboard") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}
