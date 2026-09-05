import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { recordUserEvent } from "@/lib/analytics/user-events";
import { requireActiveBillingConfiguration } from "@/features/billing/server/settings";
import { getCurrentCreatorAccess } from "@/features/creator/server/entitlements";
import { isCheckoutRequest } from "@/lib/billing/checkout";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, getStripeClient, getStripePriceId } from "@/lib/stripe/client";
import {
  getWhopAccountId,
  getWhopCheckoutPlanId,
  getWhopCheckoutRedirectUrl,
  getWhopClient,
} from "@/lib/whop/client";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import type { BillingConfiguration, PlanKey } from "@/lib/billing/types";
import {
  buildMetaUserData,
  readAnalyticsConsent,
  readAttributionSnapshot,
  recordServerFunnelEvent,
} from "@/lib/analytics/meta-server";

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
    const attempt = await getOrCreateCheckoutAttempt({
      attemptId: requestBody.checkoutAttemptId,
      userId: user.id,
      email: user.email,
      plan: requestBody.plan,
      request,
    });
    if (attempt.purchaseUrl) {
      return NextResponse.json({ purchaseUrl: attempt.purchaseUrl, metaEventId: attempt.initiateEventId });
    }
    const checkout = attempt.configuration.provider === "stripe"
      ? await createStripeCheckout({
          userId: user.id,
          email: user.email,
          plan: requestBody.plan,
          mode: attempt.configuration.mode,
          checkoutAttemptId: requestBody.checkoutAttemptId,
        })
      : await createWhopCheckout(user.id, requestBody.plan, attempt.configuration.mode, requestBody.checkoutAttemptId);

    const { error: updateError } = await createSupabaseAdminClient().from("billing_checkout_attempts").update({
      provider_checkout_id: checkout.id,
      purchase_url: checkout.url,
      updated_at: new Date().toISOString(),
    }).eq("id", requestBody.checkoutAttemptId).eq("user_id", user.id);
    if (updateError) throw new Error(`Could not save checkout attempt: ${updateError.message}`);

    await recordServerFunnelEvent({
      eventName: "InitiateCheckout",
      eventId: attempt.initiateEventId,
      sourceUrl: request.headers.get("referer") ?? request.url,
      properties: {
        plan_key: requestBody.plan,
        billing_mode: attempt.configuration.mode,
        content_name: `Airveek ${PLAN_DEFINITIONS[requestBody.plan].name}`,
        content_category: "paid_access",
        value: PLAN_DEFINITIONS[requestBody.plan].priceUsdCents / 100,
        currency: "USD",
      },
      userId: user.id,
      email: user.email,
      request,
      consentGranted: attempt.marketingConsent,
      attributionOverride: attempt.attribution,
      userDataOverride: attempt.metaUserData,
    }).catch(() => undefined);

    await recordUserEvent({
      userId: user.id,
      eventName: "checkout_started",
      properties: { planKey: requestBody.plan },
    });

    return NextResponse.json({ purchaseUrl: checkout.url, metaEventId: attempt.initiateEventId });
  } catch (error: unknown) {
    console.error("Unable to create checkout session.", error);
    return NextResponse.json(
      { error: "We could not start checkout. Please try again." },
      { status: 502 },
    );
  }
}

async function createWhopCheckout(userId: string, plan: "commercial" | "premium", mode: "one_time" | "subscription", checkoutAttemptId: string): Promise<{ id: string; url: string }> {
  const checkout = await getWhopClient().checkoutConfigurations.create({
    account_id: getWhopAccountId(),
    metadata: { supabase_user_id: userId, plan_key: plan, billing_mode: mode, checkout_attempt_id: checkoutAttemptId },
    mode: "payment",
    plan_id: getWhopCheckoutPlanId(plan, mode),
    redirect_url: getWhopCheckoutRedirectUrl(),
  });
  if (!checkout.purchase_url) throw new Error("Whop did not return a checkout URL.");
  return { id: checkout.id, url: checkout.purchase_url };
}

async function createStripeCheckout(input: {
  userId: string;
  email?: string;
  plan: "commercial" | "premium";
  mode: "one_time" | "subscription";
  checkoutAttemptId: string;
}): Promise<{ id: string; url: string }> {
  const metadata = { supabase_user_id: input.userId, plan_key: input.plan, billing_mode: input.mode, checkout_attempt_id: input.checkoutAttemptId };
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
  return { id: session.id, url: session.url };
}

type CheckoutAttempt = {
  configuration: BillingConfiguration;
  initiateEventId: string;
  purchaseUrl: string | null;
  marketingConsent: boolean;
  attribution: ReturnType<typeof readAttributionSnapshot>;
  metaUserData: ReturnType<typeof buildMetaUserData>;
};

async function getOrCreateCheckoutAttempt(input: {
  attemptId: string;
  userId: string;
  email?: string | null;
  plan: PlanKey;
  request: NextRequest;
}): Promise<CheckoutAttempt> {
  const client = createSupabaseAdminClient();
  const existing = await client.from("billing_checkout_attempts").select("*")
    .eq("id", input.attemptId).eq("user_id", input.userId).maybeSingle();
  if (existing.error) throw new Error(`Could not read checkout attempt: ${existing.error.message}`);
  if (existing.data) {
    if (existing.data.plan_key !== input.plan) throw new Error("Checkout attempt does not match this plan.");
    return mapCheckoutAttempt(existing.data);
  }

  const configuration = await requireActiveBillingConfiguration();
  const cookieHeader = input.request.headers.get("cookie");
  const attribution = readAttributionSnapshot(cookieHeader);
  const marketingConsent = readAnalyticsConsent(cookieHeader);
  const metaUserData = buildMetaUserData({
    userId: input.userId,
    email: input.email,
    cookieHeader,
    userAgent: input.request.headers.get("user-agent"),
    clientIp: input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? input.request.headers.get("x-real-ip"),
    fbclid: attribution.fbclid,
  });
  const initiateEventId = randomUUID();
  const purchaseEventId = randomUUID();
  const { data, error } = await client.from("billing_checkout_attempts").insert({
    id: input.attemptId,
    user_id: input.userId,
    plan_key: input.plan,
    provider: configuration.provider,
    billing_mode: configuration.mode,
    amount_cents: PLAN_DEFINITIONS[input.plan].priceUsdCents,
    currency: "USD",
    anonymous_id_hash: attribution.anonymousIdHash,
    marketing_consent: marketingConsent,
    attribution,
    meta_user_data: metaUserData,
    initiate_checkout_event_id: initiateEventId,
    purchase_event_id: purchaseEventId,
  }).select("*").single();
  if (error || !data) {
    if (error?.code === "23505") {
      const replay = await client.from("billing_checkout_attempts").select("*").eq("id", input.attemptId).eq("user_id", input.userId).single();
      if (replay.data) return mapCheckoutAttempt(replay.data);
    }
    throw new Error(`Could not create checkout attempt: ${error?.message ?? "unknown error"}`);
  }
  return mapCheckoutAttempt(data);
}

function mapCheckoutAttempt(row: Record<string, unknown>): CheckoutAttempt {
  if ((row.provider !== "stripe" && row.provider !== "whop") || (row.billing_mode !== "one_time" && row.billing_mode !== "subscription") || typeof row.initiate_checkout_event_id !== "string") {
    throw new Error("Stored checkout attempt is invalid.");
  }
  return {
    configuration: { provider: row.provider, mode: row.billing_mode },
    initiateEventId: row.initiate_checkout_event_id,
    purchaseUrl: typeof row.purchase_url === "string" ? row.purchase_url : null,
    marketingConsent: row.marketing_consent === true,
    attribution: readStoredAttribution(row.attribution),
    metaUserData: row.meta_user_data && typeof row.meta_user_data === "object" && !Array.isArray(row.meta_user_data) ? row.meta_user_data as ReturnType<typeof buildMetaUserData> : {},
  };
}

function readStoredAttribution(value: unknown): ReturnType<typeof readAttributionSnapshot> {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof row[key] === "string" ? row[key] as string : null;
  return { anonymousIdHash: text("anonymousIdHash"), source: text("source"), medium: text("medium"), campaign: text("campaign"), content: text("content"), term: text("term"), fbclid: text("fbclid") };
}
