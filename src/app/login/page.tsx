import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Airveek account.",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const nextPath = getSafeRedirectPath(typeof params.next === "string" ? params.next : undefined);

  return <AuthForm mode="login" initialError={error} nextPath={nextPath} />;
}
