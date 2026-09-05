import { NextResponse, type NextRequest } from "next/server";

import { recordUserEvent } from "@/lib/analytics/user-events";
import { requireActiveBillingConfiguration } from "@/features/billing/server/settings";
import { getCurrentCreatorAccess } from "@/features/creator/server/entitlements";
import { isCheckoutRequest } from "@/lib/billing/checkout";
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

  if ((await getCurrentCreatorAccess()).hasActiveAccess) {
    return NextResponse.json({ error: "This account already has paid access. Manage the current plan instead." }, { status: 409 });
  }

  try {
    const configuration = await requireActiveBillingConfiguration();
    const purchaseUrl = configuration.provider === "stripe"
      ? await createStripeCheckout({
          userId: user.id,
          email: user.email,
          plan: requestBody.plan,
          mode: configuration.mode,
          checkoutAttemptId: requestBody.checkoutAttemptId,
        })
      : await createWhopCheckout(user.id, requestBody.plan, configuration.mode);

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

async function createWhopCheckout(userId: string, plan: "commercial" | "premium", mode: "one_time" | "subscription"): Promise<string> {
  const checkout = await getWhopClient().checkoutConfigurations.create({
    account_id: getWhopAccountId(),
    metadata: { supabase_user_id: userId, plan_key: plan, billing_mode: mode },
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
}): Promise<string> {
  const metadata = { supabase_user_id: input.userId, plan_key: input.plan, billing_mode: input.mode };
  const session = await getStripeClient().checkout.sessions.create({
    mode: input.mode === "subscription" ? "subscription" : "payment",
    line_items: [{ price: getStripePriceId(input.plan, input.mode), quantity: 1 }],
    client_reference_id: input.userId,
    customer_email: input.email,
    customer_creation: input.mode === "one_time" ? "always" : undefined,
    metadata,
    payment_intent_data: input.mode === "one_time" ? { metadata } : undefined,
    subscription_data: input.mode === "subscription" ? { metadata } : undefined,
    allow_promotion_codes: true,
    success_url: getAppUrl("/checkout/complete?status=success&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: getAppUrl("/checkout/complete?status=error"),
  }, { idempotencyKey: `checkout:${input.userId}:${input.plan}:${input.mode}:${input.checkoutAttemptId}` });
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}
