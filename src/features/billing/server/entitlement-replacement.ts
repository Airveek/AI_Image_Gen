import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingProvider } from "@/lib/billing/types";

export async function replacePreviousEntitlement(input: {
  userId: string;
  provider: BillingProvider;
  previousReference: string;
  currentReference: string;
  eventId: string;
  eventAt: string;
  cancelRemote: () => Promise<void>;
}): Promise<void> {
  if (input.previousReference === input.currentReference) return;

  const supabase = createSupabaseAdminClient();
  const { data: canonical, error: canonicalError } = await supabase
    .from("billing_entitlements")
    .select("provider_reference")
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
    .eq("provider_reference", input.previousReference)
    .eq("has_access", true)
    .maybeSingle();

  if (canonicalError) throw new Error(`Could not locate previous entitlement: ${canonicalError.message}`);

  let hasActivePreviousEntitlement = Boolean(canonical);
  if (!hasActivePreviousEntitlement && input.provider === "whop") {
    const { data: legacy, error: legacyError } = await supabase
      .from("whop_entitlements")
      .select("whop_membership_id")
      .eq("user_id", input.userId)
      .eq("whop_membership_id", input.previousReference)
      .in("status", ["active", "trialing", "completed", "canceling"])
      .maybeSingle();

    if (legacyError) throw new Error(`Could not locate previous Whop entitlement: ${legacyError.message}`);
    hasActivePreviousEntitlement = Boolean(legacy);
  }

  if (!hasActivePreviousEntitlement) return;

  await input.cancelRemote();

  const replacementEventId = `upgrade-${input.eventId}`;
  const { error: updateError } = await supabase
    .from("billing_entitlements")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      access_expires_at: null,
      last_event_id: replacementEventId,
      last_event_at: input.eventAt,
      updated_at: input.eventAt,
    })
    .eq("user_id", input.userId)
    .eq("provider", input.provider)
    .eq("provider_reference", input.previousReference)
    .eq("has_access", true);

  if (updateError) throw new Error(`Could not replace previous entitlement: ${updateError.message}`);

  if (input.provider === "whop") {
    const { error: legacyUpdateError } = await supabase
      .from("whop_entitlements")
      .update({ status: "canceled", updated_at: input.eventAt })
      .eq("user_id", input.userId)
      .eq("whop_membership_id", input.previousReference)
      .in("status", ["active", "trialing", "completed", "canceling"]);

    if (legacyUpdateError) throw new Error(`Could not replace previous Whop entitlement: ${legacyUpdateError.message}`);
  }
}
