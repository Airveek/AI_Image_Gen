"use server";

import { redirect } from "next/navigation";

import type { AuthActionState } from "@/features/auth/types";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, message: "The email or password is incorrect." };
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

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
}
