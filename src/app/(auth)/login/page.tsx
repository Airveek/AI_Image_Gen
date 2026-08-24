import type { Metadata } from "next";

import { signInAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";

export const metadata: Metadata = {
  title: "Log in",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const callbackMessage = params.error === "missing_code"
    ? "The confirmation link is incomplete. Please use the link from your email."
    : params.error === "confirmation_failed"
      ? "That confirmation link is invalid or expired. Please register again."
      : undefined;

  return (
    <div className="flex justify-center">
      <AuthForm
        action={signInAction}
        mode="login"
        nextPath={nextPath}
        initialMessage={callbackMessage}
      />
    </div>
  );
}
