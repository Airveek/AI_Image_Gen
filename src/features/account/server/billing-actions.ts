"use server";

import { redirect } from "next/navigation";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { getCurrentStripeCustomerId } from "@/features/creator/server/entitlements";
import { getAppUrl, getStripeClient } from "@/lib/stripe/client";

export async function openStripeBillingPortal(): Promise<never> {
  await requireCreatorUser();
  const customer = await getCurrentStripeCustomerId();
  if (!customer) redirect("/support?topic=billing");
  let session: { url: string };
  try {
    session = await getStripeClient().billingPortal.sessions.create({ customer, return_url: getAppUrl("/plans") });
  } catch (error: unknown) {
    console.error("Unable to open Stripe billing portal.", error);
    redirect("/support?topic=billing");
  }
  redirect(session.url);
}

