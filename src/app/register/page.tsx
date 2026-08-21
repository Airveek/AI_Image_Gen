import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create your Airveek account.",
};

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(typeof params.next === "string" ? params.next : undefined);

  return <AuthForm mode="register" nextPath={nextPath} />;
}
