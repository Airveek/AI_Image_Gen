"use server";

import { redirect } from "next/navigation";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { getCurrentStripeCustomerId } from "@/features/creator/server/entitlements";
import { getAppUrl, getStripeClient } from "@/lib/stripe/client";

export async function openStripeBillingPortal(): Promise<never> {
  await requireCreatorUser();
  const customer = await getCurrentStripeCustomerId();
  if (!customer) redirect("/support?topic=billing");
  const session = await getStripeClient().billingPortal.sessions.create({ customer, return_url: getAppUrl("/plans") });
  redirect(session.url);
}

