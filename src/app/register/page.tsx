import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create your Airveek account.",
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
