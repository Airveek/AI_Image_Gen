import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { recordUserEvent } from "@/lib/analytics/user-events";
import { requireActiveBillingConfiguration } from "@/features/billing/server/settings";
import { getCurrentCreatorAccess } from "@/features/creator/server/entitlements";
import { isCheckoutRequest } from "@/lib/billing/checkout";
import { billingModeForBillingKind, PLAN_DEFINITIONS } from "@/lib/billing/plans";
import type { BillingConfiguration, BillingMode, BillingProvider, CheckoutMetadata, PlanKey } from "@/lib/billing/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAppUrl, getStripeClient, getStripePriceId } from "@/lib/stripe/client";
import {
  getWhopAccountId,
  getWhopCheckoutPlanId,
  getWhopCheckoutRedirectUrl,
  getWhopClient,
} from "@/lib/whop/client";
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

  try {
    const access = await getCurrentCreatorAccess();
    const upgrade = access.hasActiveAccess ? getUpgradeSource(access) : null;
    if (access.hasActiveAccess && (!upgrade || access.planKey === requestBody.plan)) {
      return activePlanRedirect();
    }

    const activeConfiguration = await requireActiveBillingConfiguration();
    const requestedConfiguration: BillingConfiguration = {
      provider: activeConfiguration.provider,
      mode: upgrade?.mode ?? activeConfiguration.mode,
    };
    const attempt = await getOrCreateCheckoutAttempt({
      attemptId: requestBody.checkoutAttemptId,
      userId: user.id,
      email: user.email,
      plan: requestBody.plan,
      request,
      configuration: requestedConfiguration,
    });
    if (attempt.purchaseUrl) {
      return NextResponse.json({ purchaseUrl: attempt.purchaseUrl, metaEventId: attempt.initiateEventId });
    }

    const metadata = checkoutMetadata({
      userId: user.id,
      plan: requestBody.plan,
      mode: attempt.configuration.mode,
      checkoutAttemptId: requestBody.checkoutAttemptId,
      upgrade,
    });
    const checkout = attempt.configuration.provider === "stripe"
      ? await createStripeCheckout({
          userId: user.id,
          email: user.email,
          plan: requestBody.plan,
          mode: attempt.configuration.mode,
          checkoutAttemptId: requestBody.checkoutAttemptId,
          customerId: upgrade?.provider === "stripe" ? access.providerCustomerId ?? undefined : undefined,
          metadata,
        })
      : await createWhopCheckout(requestBody.plan, attempt.configuration.mode, metadata);

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
  checkoutAttemptId: string;
  upgrade: UpgradeSource | null;
}): CheckoutMetadata {
  const metadata: CheckoutMetadata = {
    supabase_user_id: input.userId,
    plan_key: input.plan,
    billing_mode: input.mode,
    checkout_attempt_id: input.checkoutAttemptId,
  };
  if (input.upgrade) {
    metadata.upgrade_from_provider = input.upgrade.provider;
    metadata.upgrade_from_reference = input.upgrade.reference;
    metadata.upgrade_from_billing_mode = input.upgrade.mode;
  }
  return metadata;
}

async function createWhopCheckout(plan: PlanKey, mode: BillingMode, metadata: CheckoutMetadata): Promise<{ id: string; url: string }> {
  const checkout = await getWhopClient().checkoutConfigurations.create({
    account_id: getWhopAccountId(),
    metadata: providerMetadata(metadata),
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
  customerId?: string;
  metadata: CheckoutMetadata;
}): Promise<{ id: string; url: string }> {
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
  configuration: BillingConfiguration;
}): Promise<CheckoutAttempt> {
  const client = createSupabaseAdminClient();
  const existing = await client.from("billing_checkout_attempts").select("*")
    .eq("id", input.attemptId).eq("user_id", input.userId).maybeSingle();
  if (existing.error) throw new Error(`Could not read checkout attempt: ${existing.error.message}`);
  if (existing.data) {
    if (existing.data.plan_key !== input.plan) throw new Error("Checkout attempt does not match this plan.");
    return mapCheckoutAttempt(existing.data);
  }

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
    provider: input.configuration.provider,
    billing_mode: input.configuration.mode,
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

function providerMetadata(metadata: CheckoutMetadata): Record<string, string> {
  const result: Record<string, string> = {
    supabase_user_id: metadata.supabase_user_id,
    plan_key: metadata.plan_key,
    billing_mode: metadata.billing_mode,
    checkout_attempt_id: metadata.checkout_attempt_id,
  };
  if (metadata.upgrade_from_provider && metadata.upgrade_from_reference && metadata.upgrade_from_billing_mode) {
    result.upgrade_from_provider = metadata.upgrade_from_provider;
    result.upgrade_from_reference = metadata.upgrade_from_reference;
    result.upgrade_from_billing_mode = metadata.upgrade_from_billing_mode;
  }
  return result;
}
