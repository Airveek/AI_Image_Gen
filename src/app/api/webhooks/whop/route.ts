import type { UnwrapWebhookEvent } from "@whop/sdk/resources.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getWhopAccountId,
  getWhopClient,
  getWhopPlanIdentity,
  getWhopWebhookKey,
} from "@/lib/whop/client";
import {
  getWebhookMetadataUserId,
  isValidWebhookTimestamp,
  shouldIgnoreEntitlementEvent,
} from "@/lib/whop/webhooks";
import { buildWhopTransactionFact } from "@/lib/whop/transactions";
import { recordUserEvent } from "@/lib/analytics/user-events";

export const runtime = "nodejs";

function isMembershipEvent(event: UnwrapWebhookEvent): event is Extract<
  UnwrapWebhookEvent,
  { type: "membership.activated" | "membership.deactivated" }
> {
  return event.type === "membership.activated" || event.type === "membership.deactivated";
}

function isFinancialEvent(event: UnwrapWebhookEvent): event is Extract<
  UnwrapWebhookEvent,
  {
    type:
      | "payment.created"
      | "payment.pending"
      | "payment.succeeded"
      | "payment.failed"
      | "refund.created"
      | "refund.updated";
  }
> {
  return event.type === "payment.created"
    || event.type === "payment.pending"
    || event.type === "payment.succeeded"
    || event.type === "payment.failed"
    || event.type === "refund.created"
    || event.type === "refund.updated";
}

export async function POST(request: Request): Promise<Response> {
  const requestBody = await request.text();

  try {
    const event = getWhopClient().webhooks.unwrap(requestBody, {
      headers: Object.fromEntries(request.headers.entries()),
      key: getWhopWebhookKey(),
    });

    const accountId = getWhopAccountId();

    if (isFinancialEvent(event)) {
      return await recordFinancialEvent(event, accountId);
    }

    if (!isMembershipEvent(event)) {
      return new Response("Ignored", { status: 200 });
    }

    const membership = event.data;

    if (membership.company.id !== accountId || (event.company_id && event.company_id !== accountId)) {
      return new Response("Invalid company", { status: 400 });
    }

    const userId = getWebhookMetadataUserId(membership.metadata);

    if (!userId) {
      return new Response("Missing user metadata", { status: 400 });
    }

    const eventTime = Date.parse(event.timestamp);

    if (!isValidWebhookTimestamp(event.timestamp)) {
      return new Response("Invalid event timestamp", { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const identity = getWhopPlanIdentity(membership.plan.id);
    const billingMode = identity.billingKind === "legacy-lifetime" ? "one_time" : "subscription";
    const { error: canonicalError } = await supabase.rpc("apply_billing_entitlement_event", {
      p_user_id: userId,
      p_provider: "whop",
      p_provider_reference: membership.id,
      p_provider_plan_id: membership.plan.id,
      p_plan_key: identity.planKey,
      p_billing_mode: billingMode,
      p_status: membership.status,
      p_provider_customer_id: null,
      p_provider_payment_id: null,
      p_checkout_session_id: null,
      p_cancel_at_period_end: membership.cancel_at_period_end,
      p_access_expires_at: readIsoTimestamp(membership.renewal_period_end),
      p_event_id: event.id,
      p_event_type: event.type,
      p_event_at: event.timestamp,
    });

    if (canonicalError) {
      console.error("Unable to save canonical Whop entitlement.", canonicalError);
      return new Response("Unable to save entitlement", { status: 500 });
    }

    const { data: existingEntitlement, error: lookupError } = await supabase
      .from("whop_entitlements")
      .select("last_event_id, updated_at")
      .eq("whop_membership_id", membership.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Unable to check existing Whop entitlement.", lookupError);
      return new Response("Unable to check entitlement", { status: 500 });
    }

    if (shouldIgnoreEntitlementEvent(
      existingEntitlement
        ? {
            lastEventId: existingEntitlement.last_event_id,
            updatedAt: existingEntitlement.updated_at,
          }
        : null,
      event.id,
      eventTime,
    )) {
      return new Response("OK", { status: 200 });
    }

    const { error } = await supabase.from("whop_entitlements").upsert(
      {
        user_id: userId,
        whop_membership_id: membership.id,
        whop_plan_id: membership.plan.id,
        status: membership.status,
        last_event_id: event.id,
        updated_at: event.timestamp,
      },
      { onConflict: "whop_membership_id" },
    );

    if (error) {
      console.error("Unable to save Whop entitlement.", error);
      return new Response("Unable to save entitlement", { status: 500 });
    }

    await recordUserEvent({
      userId,
      eventName: event.type === "membership.activated" ? "membership_activated" : "membership_deactivated",
      properties: { planKey: readPlanKey(membership.plan.id) },
      externalEventId: event.id,
      occurredAt: event.timestamp,
    });

    return new Response("OK", { status: 200 });
  } catch (error: unknown) {
    console.error("Invalid Whop webhook.", error);
    return new Response("Invalid webhook", { status: 400 });
  }
}

async function recordFinancialEvent(
  event: Extract<
    UnwrapWebhookEvent,
    {
      type:
        | "payment.created"
        | "payment.pending"
        | "payment.succeeded"
        | "payment.failed"
        | "refund.created"
        | "refund.updated";
    }
  >,
  accountId: string,
): Promise<Response> {
  if (event.company_id && event.company_id !== accountId) {
    return new Response("Invalid company", { status: 400 });
  }

  if (!isValidWebhookTimestamp(event.timestamp)) {
    return new Response("Invalid event timestamp", { status: 400 });
  }

  const fact = buildWhopTransactionFact({
    id: event.id,
    type: event.type,
    timestamp: event.timestamp,
    data: event.data,
  });
  if (!fact) return new Response("Invalid transaction payload", { status: 400 });

  const supabase = createSupabaseAdminClient();
  let userId = fact.userId;

  if (!userId && fact.membershipId) {
    const { data: entitlement, error: entitlementError } = await supabase
      .from("whop_entitlements")
      .select("user_id")
      .eq("whop_membership_id", fact.membershipId)
      .maybeSingle();
    if (entitlementError) {
      console.error("Unable to resolve the Whop transaction owner.", entitlementError);
      return new Response("Unable to resolve transaction owner", { status: 500 });
    }
    userId = typeof entitlement?.user_id === "string" ? entitlement.user_id : null;
  }

  const { error } = await supabase
    .from("whop_transaction_facts")
    .insert({
      whop_event_id: fact.whopEventId,
      object_type: fact.objectType,
      whop_object_id: fact.whopObjectId,
      event_type: fact.eventType,
      user_id: userId,
      payment_id: fact.paymentId,
      refund_id: fact.refundId,
      membership_id: fact.membershipId,
      plan_id: fact.planId,
      checkout_configuration_id: fact.checkoutConfigurationId,
      status: fact.status,
      amount: fact.amount,
      amount_after_fees: fact.amountAfterFees,
      usd_amount: fact.usdAmount,
      currency: fact.currency,
      settlement_currency: fact.settlementCurrency,
      tax_amount: fact.taxAmount,
      refunded_amount: fact.refundedAmount,
      occurred_at: fact.occurredAt,
    });

  // Webhook delivery is at-least-once. The signed event ID is the immutable
  // idempotency key; an already-recorded event is a successful replay.
  if (error && error.code !== "23505") {
    console.error("Unable to save Whop transaction fact.", error);
    return new Response("Unable to save transaction fact", { status: 500 });
  }
  return new Response("OK", { status: 200 });
}

function readPlanKey(planId: string): "commercial" | "premium" | undefined {
  return getWhopPlanIdentity(planId).planKey ?? undefined;
}

function readIsoTimestamp(value: string | null): string | null {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}
