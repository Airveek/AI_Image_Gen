"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/features/auth/types";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordUserEvent } from "@/lib/analytics/user-events";
import { saveInitialAttribution } from "@/features/account/server/profile";
import { cookies } from "next/headers";
import { linkSeoAttributionToUser } from "@/features/seo/server/attribution";
import { getSeoAttributionSigningSecret, parseSeoAttributionCookie, SEO_ATTRIBUTION_COOKIE_NAME } from "@/lib/analytics/seo-attribution";
import { SITE_URL } from "@/lib/seo/site";

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readField(formData, "email");
  const password = readField(formData, "password");

  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: "The email or password is incorrect." };
  }

  if (data.user) {
    await recordUserEvent({ userId: data.user.id, eventName: "login_succeeded" });
  }

  redirect(getSafeRedirectPath(readField(formData, "next")));
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const displayName = readField(formData, "displayName");
  const email = readField(formData, "email");
  const password = readField(formData, "password");

  if (!displayName || !email || !password) {
    return { ok: false, message: "Complete all fields before registering." };
  }

  if (password.length < 6) {
    return { ok: false, message: "Your password must be at least 6 characters." };
  }

  const nextPath = getSafeRedirectPath(readField(formData, "next"));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: displayName },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (data.user) {
    await recordUserEvent({ userId: data.user.id, eventName: "account_created" });
    await saveInitialAttribution(data.user.id, {
      source: readLimitedField(formData, "firstTouchSource", 120),
      medium: readLimitedField(formData, "firstTouchMedium", 120),
      campaign: readLimitedField(formData, "firstTouchCampaign", 160),
    });
    const attributionCookie = (await cookies()).get(SEO_ATTRIBUTION_COOKIE_NAME)?.value;
    const signingSecret = getSeoAttributionSigningSecret();
    if (attributionCookie && signingSecret) {
      const attribution = parseSeoAttributionCookie(attributionCookie, signingSecret);
      if (attribution) await linkSeoAttributionToUser({ userId: data.user.id, attribution });
    }
  }

  if (data.session) {
    redirect(nextPath);
  }

  return {
    ok: true,
    message: "Account created. Check your email to confirm your account.",
  };
}

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readLimitedField(formData: FormData, name: string, maxLength: number): string {
  return readField(formData, name).replace(/[^a-zA-Z0-9 _./-]/g, "").slice(0, maxLength);
}

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL;
}
