import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckoutLauncher } from "@/components/checkout/checkout-launcher";
import { getCurrentCreatorAccess } from "@/features/creator/server/entitlements";
import { getPathWithNext, getSafeRedirectPath } from "@/lib/auth/redirect-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlanKey, type PlanKey } from "@/lib/whop/types";
import { noIndexMetadata } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Airveek purchase.",
  ...noIndexMetadata,
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

  const access = await getCurrentCreatorAccess();
  if (access.hasActiveAccess && (access.planKey === null || access.planKey === plan)) {
    redirect("/plans");
  }

  return <CheckoutLauncher plan={plan} />;
}
