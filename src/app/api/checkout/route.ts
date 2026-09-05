import { NextResponse, type NextRequest } from "next/server";

import { recordUserEvent } from "@/lib/analytics/user-events";
import { requireActiveBillingConfiguration } from "@/features/billing/server/settings";
import { getCurrentCreatorAccess } from "@/features/creator/server/entitlements";
import { isCheckoutRequest } from "@/lib/billing/checkout";
import { billingModeForBillingKind } from "@/lib/billing/plans";
import type { BillingMode, BillingProvider, CheckoutMetadata, PlanKey } from "@/lib/billing/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl, getStripeClient, getStripePriceId } from "@/lib/stripe/client";
import {
  getWhopAccountId,
  getWhopCheckoutPlanId,
  getWhopCheckoutRedirectUrl,
  getWhopClient,
} from "@/lib/whop/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in before checkout." }, { status: 401 });
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  }

  if (!isCheckoutRequest(requestBody)) {
    return NextResponse.json({ error: "Choose a valid plan." }, { status: 400 });
  }

  try {
    const access = await getCurrentCreatorAccess();
    const upgrade = access.hasActiveAccess ? getUpgradeSource(access) : null;
    if (access.hasActiveAccess && (!upgrade || access.planKey === requestBody.plan)) {
      return activePlanRedirect();
    }

    const configuration = await requireActiveBillingConfiguration();
    const provider = configuration.provider;
    const mode = upgrade?.mode ?? configuration.mode;

    const metadata = checkoutMetadata({
      userId: user.id,
      plan: requestBody.plan,
      mode,
      upgrade,
    });
    const purchaseUrl = provider === "stripe"
      ? await createStripeCheckout({
          userId: user.id,
          email: user.email,
          plan: requestBody.plan,
          mode,
          checkoutAttemptId: requestBody.checkoutAttemptId,
          customerId: upgrade?.provider === "stripe" ? access.providerCustomerId ?? undefined : undefined,
          metadata,
        })
      : await createWhopCheckout(requestBody.plan, mode, metadata);

    await recordUserEvent({
      userId: user.id,
      eventName: "checkout_started",
      properties: { planKey: requestBody.plan },
    });

    return NextResponse.json({ purchaseUrl });
  } catch (error: unknown) {
    console.error("Unable to create checkout session.", error);
    return NextResponse.json(
      { error: "We could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}

function activePlanRedirect(): Response {
  return NextResponse.json({
    code: "active_plan",
    redirectTo: "/plans",
    error: "This account already has paid access. Manage the current plan instead.",
  }, { status: 409 });
}

type UpgradeSource = {
  provider: BillingProvider;
  reference: string;
  mode: BillingMode;
};

function getUpgradeSource(access: Awaited<ReturnType<typeof getCurrentCreatorAccess>>): UpgradeSource | null {
  const mode = billingModeForBillingKind(access.billingKind);
  if (!access.provider || !access.providerReference || !mode) return null;
  return { provider: access.provider, reference: access.providerReference, mode };
}

function checkoutMetadata(input: {
  userId: string;
  plan: PlanKey;
  mode: BillingMode;
  upgrade: UpgradeSource | null;
}): CheckoutMetadata {
  const metadata: CheckoutMetadata = {
    supabase_user_id: input.userId,
    plan_key: input.plan,
    billing_mode: input.mode,
  };
  if (input.upgrade) {
    metadata.upgrade_from_provider = input.upgrade.provider;
    metadata.upgrade_from_reference = input.upgrade.reference;
    metadata.upgrade_from_billing_mode = input.upgrade.mode;
  }
  return metadata;
}

async function createWhopCheckout(plan: PlanKey, mode: BillingMode, metadata: CheckoutMetadata): Promise<string> {
  const checkout = await getWhopClient().checkoutConfigurations.create({
    account_id: getWhopAccountId(),
    metadata: providerMetadata(metadata),
    mode: "payment",
    plan_id: getWhopCheckoutPlanId(plan, mode),
    redirect_url: getWhopCheckoutRedirectUrl(),
  });
  if (!checkout.purchase_url) throw new Error("Whop did not return a checkout URL.");
  return checkout.purchase_url;
}

async function createStripeCheckout(input: {
  userId: string;
  email?: string;
  plan: "commercial" | "premium";
  mode: "one_time" | "subscription";
  checkoutAttemptId: string;
  customerId?: string;
  metadata: CheckoutMetadata;
}): Promise<string> {
  const session = await getStripeClient().checkout.sessions.create({
    mode: input.mode === "subscription" ? "subscription" : "payment",
    line_items: [{ price: getStripePriceId(input.plan, input.mode), quantity: 1 }],
    client_reference_id: input.userId,
    customer: input.customerId,
    customer_email: input.customerId ? undefined : input.email,
    customer_creation: input.customerId ? undefined : input.mode === "one_time" ? "always" : undefined,
    metadata: providerMetadata(input.metadata),
    payment_intent_data: input.mode === "one_time" ? { metadata: providerMetadata(input.metadata) } : undefined,
    subscription_data: input.mode === "subscription" ? { metadata: providerMetadata(input.metadata) } : undefined,
    allow_promotion_codes: true,
    success_url: getAppUrl("/checkout/complete?status=success&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: getAppUrl("/checkout/complete?status=error"),
  }, { idempotencyKey: `checkout:${input.userId}:${input.plan}:${input.mode}:${input.checkoutAttemptId}` });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}

function providerMetadata(metadata: CheckoutMetadata): Record<string, string> {
  const result: Record<string, string> = {
    supabase_user_id: metadata.supabase_user_id,
    plan_key: metadata.plan_key,
    billing_mode: metadata.billing_mode,
  };
  if (metadata.upgrade_from_provider && metadata.upgrade_from_reference && metadata.upgrade_from_billing_mode) {
    result.upgrade_from_provider = metadata.upgrade_from_provider;
    result.upgrade_from_reference = metadata.upgrade_from_reference;
    result.upgrade_from_billing_mode = metadata.upgrade_from_billing_mode;
  }
  return result;
}
