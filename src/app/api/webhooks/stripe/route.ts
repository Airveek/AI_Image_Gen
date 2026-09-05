import type Stripe from "stripe";

import { recordUserEvent } from "@/lib/analytics/user-events";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe/client";
import { identifyStripePrice } from "@/lib/stripe/plans";
import type { BillingMode, PlanKey } from "@/lib/billing/types";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(await request.text(), signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("Invalid Stripe webhook signature.", error);
    return new Response("Invalid webhook", { status: 400 });
  }

  try {
    if (isCheckoutEvent(event)) await applyCheckoutEvent(event);
    else if (isSubscriptionEvent(event)) await applySubscriptionEvent(event);
    else if (isTransactionEvent(event)) await recordStripeTransaction(event);
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`Unable to process Stripe webhook ${event.id}.`, error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}

function isCheckoutEvent(event: Stripe.Event): event is Stripe.Event & { data: { object: Stripe.Checkout.Session } } {
  return ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type);
}

function isSubscriptionEvent(event: Stripe.Event): event is Stripe.Event & { data: { object: Stripe.Subscription } } {
  return ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"].includes(event.type);
}

function isTransactionEvent(event: Stripe.Event): boolean {
  return ["payment_intent.succeeded", "invoice.paid", "invoice.payment_failed", "refund.created", "refund.updated", "charge.dispute.created", "charge.dispute.closed"].includes(event.type);
}

async function applyCheckoutEvent(event: Stripe.Event & { data: { object: Stripe.Checkout.Session } }): Promise<void> {
  const session = event.data.object;
  const mode: BillingMode = session.mode === "subscription" ? "subscription" : "one_time";
  if (mode === "subscription") return;
  const userId = metadataUserId(session.metadata) ?? validUuid(session.client_reference_id);
  const planKey = metadataPlanKey(session.metadata);
  const lineItems = await getStripeClient().checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id;
  if (!userId || !priceId) throw new Error("Stripe Checkout Session is missing trusted user or price metadata.");
  const identified = identifyStripePrice(priceId);
  const resolvedPlan = planKey ?? identified.planKey;
  if (!resolvedPlan || identified.mode !== "one_time" || identified.planKey !== resolvedPlan) {
    throw new Error("Stripe Checkout Session uses an unknown or mismatched one-time Price.");
  }
  const status = event.type === "checkout.session.async_payment_failed"
    ? "failed"
    : (session.payment_status === "paid" || session.payment_status === "no_payment_required" ? "completed" : "pending");

  await applyEntitlement({
    userId, reference: session.id, planId: priceId, planKey: resolvedPlan, mode,
    status, customerId: idOf(session.customer), paymentId: idOf(session.payment_intent),
    checkoutSessionId: session.id, cancelAtPeriodEnd: false, accessExpiresAt: null, event,
  });
  await recordMembershipAnalytics(userId, resolvedPlan, status === "completed", event);
}

async function applySubscriptionEvent(event: Stripe.Event & { data: { object: Stripe.Subscription } }): Promise<void> {
  // Retrieve the current object so delayed/out-of-order deliveries cannot
  // restore an older subscription state.
  const subscription = await getStripeClient().subscriptions.retrieve(event.data.object.id);
  const userId = metadataUserId(subscription.metadata);
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const identity = priceId ? identifyStripePrice(priceId) : { planKey: null, mode: null };
  const planKey = metadataPlanKey(subscription.metadata) ?? identity.planKey;
  if (!userId || !priceId || !planKey || identity.mode !== "subscription" || identity.planKey !== planKey) {
    throw new Error("Stripe Subscription is missing trusted user or Price metadata.");
  }
  const status = subscription.cancel_at_period_end && subscription.status === "active" ? "canceling" : subscription.status;
  const periodEnd = item && typeof item.current_period_end === "number" ? new Date(item.current_period_end * 1000).toISOString() : null;
  await applyEntitlement({
    userId, reference: subscription.id, planId: priceId, planKey, mode: "subscription",
    status, customerId: idOf(subscription.customer), paymentId: null, checkoutSessionId: null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end, accessExpiresAt: periodEnd, event,
  });
  await recordMembershipAnalytics(userId, planKey, ["active", "trialing", "canceling"].includes(status), event);
}

async function applyEntitlement(input: {
  userId: string; reference: string; planId: string; planKey: PlanKey; mode: BillingMode;
  status: string; customerId: string | null; paymentId: string | null; checkoutSessionId: string | null;
  cancelAtPeriodEnd: boolean; accessExpiresAt: string | null; event: Stripe.Event;
}): Promise<void> {
  const { error } = await createSupabaseAdminClient().rpc("apply_billing_entitlement_event", {
    p_user_id: input.userId, p_provider: "stripe", p_provider_reference: input.reference,
    p_provider_plan_id: input.planId, p_plan_key: input.planKey, p_billing_mode: input.mode,
    p_status: input.status, p_provider_customer_id: input.customerId, p_provider_payment_id: input.paymentId,
    p_checkout_session_id: input.checkoutSessionId, p_cancel_at_period_end: input.cancelAtPeriodEnd,
    p_access_expires_at: input.accessExpiresAt, p_event_id: input.event.id, p_event_type: input.event.type,
    p_event_at: new Date(input.event.created * 1000).toISOString(),
  });
  if (error) throw new Error(`Could not save Stripe entitlement: ${error.message}`);
}

async function recordStripeTransaction(event: Stripe.Event): Promise<void> {
  let fact: Record<string, unknown> | null = null;
  let fullyRefundedPaymentIntent: string | null = null;
  if (event.type === "payment_intent.succeeded") {
    const payment = event.data.object as Stripe.PaymentIntent;
    if (payment.metadata.billing_mode !== "one_time") return;
    fact = transactionFact(event, "payment", payment.id, metadataUserId(payment.metadata), payment.id, null,
      metadataPlanKey(payment.metadata), payment.status, payment.amount_received, payment.currency);
  } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionDetails = invoice.parent?.subscription_details;
    const metadata = subscriptionDetails?.metadata ?? null;
    const invoicePayments = await getStripeClient().invoicePayments.list({ invoice: invoice.id, limit: 1 });
    const paymentIntentId = idOf(invoicePayments.data[0]?.payment.payment_intent);
    fact = transactionFact(event, "payment", invoice.id, metadataUserId(metadata), paymentIntentId,
      idOf(subscriptionDetails?.subscription), metadataPlanKey(metadata),
      event.type === "invoice.paid" ? "succeeded" : "failed",
      event.type === "invoice.paid" ? invoice.amount_paid : invoice.amount_due, invoice.currency);
  } else if (event.type === "refund.created" || event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    const paymentIntentId = idOf(refund.payment_intent);
    const payment = paymentIntentId ? await getStripeClient().paymentIntents.retrieve(paymentIntentId) : null;
    const chargeId = idOf(refund.charge);
    const charge = chargeId ? await getStripeClient().charges.retrieve(chargeId) : null;
    if (paymentIntentId && charge && charge.amount_refunded >= charge.amount) fullyRefundedPaymentIntent = paymentIntentId;
    const owner = await resolveTransactionOwner(paymentIntentId, payment?.metadata ?? null);
    fact = transactionFact(event, "refund", refund.id, owner.userId,
      paymentIntentId, null, owner.planKey, refund.status ?? "pending", refund.amount, refund.currency);
  } else if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId = idOf(dispute.payment_intent);
    const payment = paymentIntentId ? await getStripeClient().paymentIntents.retrieve(paymentIntentId) : null;
    const owner = await resolveTransactionOwner(paymentIntentId, payment?.metadata ?? null);
    fact = transactionFact(event, "dispute", dispute.id, owner.userId,
      paymentIntentId, null, owner.planKey, dispute.status, dispute.amount, dispute.currency);
  }
  if (!fact) return;
  const { error } = await createSupabaseAdminClient().from("stripe_transaction_facts").insert(fact);
  if (error && error.code !== "23505") throw new Error(`Could not save Stripe transaction: ${error.message}`);
  if (fullyRefundedPaymentIntent) await revokeFullyRefundedOneTimeAccess(fullyRefundedPaymentIntent, event);
}

async function resolveTransactionOwner(paymentIntentId: string | null, metadata: Stripe.Metadata | null): Promise<{ userId: string | null; planKey: PlanKey | null }> {
  const direct = { userId: metadataUserId(metadata), planKey: metadataPlanKey(metadata) };
  if (direct.userId || !paymentIntentId) return direct;
  const { data, error } = await createSupabaseAdminClient().from("stripe_transaction_facts")
    .select("user_id,plan_key").eq("payment_intent_id", paymentIntentId)
    .not("user_id", "is", null).order("occurred_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Could not resolve Stripe transaction owner: ${error.message}`);
  return { userId: typeof data?.user_id === "string" ? data.user_id : null,
    planKey: data?.plan_key === "commercial" || data?.plan_key === "premium" ? data.plan_key : direct.planKey };
}

async function revokeFullyRefundedOneTimeAccess(paymentIntentId: string, event: Stripe.Event): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("billing_entitlements")
    .select("user_id,provider_reference,provider_plan_id,plan_key,provider_customer_id,checkout_session_id")
    .eq("provider", "stripe").eq("billing_mode", "one_time").eq("provider_payment_id", paymentIntentId).maybeSingle();
  if (error) throw new Error(`Could not locate refunded Stripe entitlement: ${error.message}`);
  if (!data || (data.plan_key !== "commercial" && data.plan_key !== "premium")) return;
  await applyEntitlement({ userId: data.user_id, reference: data.provider_reference, planId: data.provider_plan_id,
    planKey: data.plan_key, mode: "one_time", status: "refunded", customerId: data.provider_customer_id,
    paymentId: paymentIntentId, checkoutSessionId: data.checkout_session_id, cancelAtPeriodEnd: false,
    accessExpiresAt: null, event });
}

function transactionFact(event: Stripe.Event, kind: string, objectId: string, userId: string | null,
  paymentIntentId: string | null, subscriptionId: string | null, planKey: PlanKey | null,
  status: string, amount: number | null, currency: string | null): Record<string, unknown> {
  return { stripe_event_id: event.id, object_type: kind, stripe_object_id: objectId, event_type: event.type,
    user_id: userId, payment_intent_id: paymentIntentId, checkout_session_id: null, subscription_id: subscriptionId,
    plan_key: planKey, status, amount_cents: amount, currency: currency?.toUpperCase() ?? null,
    occurred_at: new Date(event.created * 1000).toISOString() };
}

async function recordMembershipAnalytics(userId: string, planKey: PlanKey, active: boolean, event: Stripe.Event): Promise<void> {
  await recordUserEvent({ userId, eventName: active ? "membership_activated" : "membership_deactivated",
    properties: { planKey }, externalEventId: event.id,
    occurredAt: new Date(event.created * 1000).toISOString() });
}

function metadataUserId(metadata: Stripe.Metadata | null): string | null { return validUuid(metadata?.supabase_user_id); }
function metadataPlanKey(metadata: Stripe.Metadata | null): PlanKey | null {
  return metadata?.plan_key === "commercial" || metadata?.plan_key === "premium" ? metadata.plan_key : null;
}
function validUuid(value: unknown): string | null { return typeof value === "string" && UUID.test(value) ? value : null; }
function idOf(value: unknown): string | null { return typeof value === "string" ? value : value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : null; }
