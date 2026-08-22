import type { Metadata } from "next";

import { registerAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/features/auth/components/auth-form";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <div className="flex justify-center">
      <AuthForm action={registerAction} mode="register" />
    </div>
  );
}
