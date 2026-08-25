import type { UnwrapWebhookEvent } from "@whop/sdk/resources.js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWhopAccountId, getWhopClient, getWhopWebhookKey } from "@/lib/whop/client";
import {
  getWebhookMetadataUserId,
  isValidWebhookTimestamp,
  shouldIgnoreEntitlementEvent,
} from "@/lib/whop/webhooks";
import { recordUserEvent } from "@/lib/analytics/user-events";

export const runtime = "nodejs";

function isMembershipEvent(event: UnwrapWebhookEvent): event is Extract<
  UnwrapWebhookEvent,
  { type: "membership.activated" | "membership.deactivated" }
> {
  return event.type === "membership.activated" || event.type === "membership.deactivated";
}

export async function POST(request: Request): Promise<Response> {
  const requestBody = await request.text();

  try {
    const event = getWhopClient().webhooks.unwrap(requestBody, {
      headers: Object.fromEntries(request.headers.entries()),
      key: getWhopWebhookKey(),
    });

    if (!isMembershipEvent(event)) {
      return new Response("Ignored", { status: 200 });
    }

    const membership = event.data;
    const accountId = getWhopAccountId();

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

function readPlanKey(planId: string): "commercial" | "premium" | undefined {
  if (planId === process.env.WHOP_PREMIUM_PLAN_ID) return "premium";
  if (planId === process.env.WHOP_COMMERCIAL_PLAN_ID) return "commercial";
  return undefined;
}
