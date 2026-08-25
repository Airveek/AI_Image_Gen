import type { Metadata } from "next";

import { registerAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";
import type { FirstTouchAttribution } from "@/features/account/types";

export const metadata: Metadata = {
  title: "Register",
};

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const attribution: FirstTouchAttribution = {
    source: readAttributionParam(params.utm_source, 120),
    medium: readAttributionParam(params.utm_medium, 120),
    campaign: readAttributionParam(params.utm_campaign, 160),
  };

  return (
    <div className="flex justify-center">
      <AuthForm action={registerAction} mode="register" nextPath={nextPath} attribution={attribution} />
    </div>
  );
}

function readAttributionParam(value: string | string[] | undefined, maxLength: number): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string"
    ? candidate.trim().replace(/[^a-zA-Z0-9 _./-]/g, "").slice(0, maxLength)
    : "";
}
