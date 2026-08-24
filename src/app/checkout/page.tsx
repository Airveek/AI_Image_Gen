import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckoutLauncher } from "@/components/checkout/checkout-launcher";
import { getPathWithNext, getSafeRedirectPath } from "@/lib/auth/redirect-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlanKey, type PlanKey } from "@/lib/whop/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Airveek purchase.",
};

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const planValue = typeof params.plan === "string" ? params.plan : null;

  if (!isPlanKey(planValue)) {
    redirect("/#pricing");
  }

  const plan: PlanKey = planValue;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const nextPath = getSafeRedirectPath(`/checkout?plan=${encodeURIComponent(plan)}`);
    redirect(getPathWithNext("/login", nextPath));
  }

  return <CheckoutLauncher plan={plan} />;
}
