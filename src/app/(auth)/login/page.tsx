import type { Metadata } from "next";

import { signInAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <div className="flex justify-center">
      <AuthForm action={signInAction} mode="login" />
    </div>
  );
}
