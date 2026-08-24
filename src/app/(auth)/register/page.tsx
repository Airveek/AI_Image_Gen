import type { Metadata } from "next";

import { registerAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getSafeRedirectPath } from "@/lib/auth/redirect-path";

export const metadata: Metadata = {
  title: "Register",
};

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = getSafeRedirectPath(typeof params.next === "string" ? params.next : undefined);

  return (
    <div className="flex justify-center">
      <AuthForm action={registerAction} mode="register" nextPath={nextPath} />
    </div>
  );
}
