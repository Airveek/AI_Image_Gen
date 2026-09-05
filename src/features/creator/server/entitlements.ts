import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWhopClient, getWhopPlanIdentity } from "@/lib/whop/client";
import { isSafeWhopManageUrl } from "@/lib/whop/plans";
import { billingKindForMode, hasBillingAccess, PLAN_DEFINITIONS } from "@/lib/billing/plans";
import type { AccountBillingSummary, BillingMode, BillingProvider, BillingStatus, CreatorAccessSummary, PlanKey } from "@/lib/billing/types";

type EntitlementRow = { provider: BillingProvider; provider_reference: string; provider_plan_id: string;
  plan_key: PlanKey | null; billing_mode: BillingMode; status: string; cancel_at_period_end: boolean;
  access_expires_at: string | null; provider_customer_id: string | null; updated_at: string };
type SelectedEntitlement = { row: EntitlementRow; access: CreatorAccessSummary };

const EMPTY_ACCESS: CreatorAccessSummary = { provider: null, planName: "No plan yet", planKey: null, billingKind: "unknown", status: null, hasActiveAccess: false };
const EMPTY_BILLING: AccountBillingSummary = { ...EMPTY_ACCESS, cancelAtPeriodEnd: false, canManageBilling: false, manageUrl: null, renewalAt: null };

export async function getCurrentCreatorAccess(): Promise<CreatorAccessSummary> {
  try { return (await readSelectedEntitlement())?.access ?? EMPTY_ACCESS; } catch { return EMPTY_ACCESS; }
}

export async function getCurrentAccountBilling(): Promise<AccountBillingSummary> {
  let selected: SelectedEntitlement | null;
  try { selected = await readSelectedEntitlement(); } catch { return EMPTY_BILLING; }
  if (!selected) return EMPTY_BILLING;
  const fallback: AccountBillingSummary = { ...selected.access,
    cancelAtPeriodEnd: selected.row.cancel_at_period_end || selected.access.status === "canceling",
    canManageBilling: selected.row.provider === "stripe" && Boolean(selected.row.provider_customer_id),
    manageUrl: null, renewalAt: selected.row.access_expires_at };
  if (selected.row.provider !== "whop") return fallback;
  try {
    const membership = await getWhopClient().memberships.retrieve(selected.row.provider_reference);
    const manageUrl = isSafeWhopManageUrl(membership.manage_url) ? membership.manage_url : null;
    return { ...fallback, cancelAtPeriodEnd: membership.cancel_at_period_end, canManageBilling: Boolean(manageUrl),
      manageUrl, renewalAt: readTimestamp(membership.renewal_period_end) };
  } catch { return fallback; }
}

export async function getCurrentStripeCustomerId(): Promise<string | null> {
  const selected = await readSelectedEntitlement();
  return selected?.row.provider === "stripe" && selected.row.provider_customer_id ? selected.row.provider_customer_id : null;
}

async function readSelectedEntitlement(): Promise<SelectedEntitlement | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const canonical = await supabase.from("billing_entitlements")
    .select("provider,provider_reference,provider_plan_id,plan_key,billing_mode,status,cancel_at_period_end,access_expires_at,provider_customer_id,updated_at")
    .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30);
  if (!canonical.error && Array.isArray(canonical.data)) return selectRows(canonical.data);

  const legacy = await supabase.from("whop_entitlements").select("whop_membership_id,whop_plan_id,status,updated_at")
    .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20);
  if (legacy.error || !Array.isArray(legacy.data)) return null;
  return selectRows(legacy.data.map((row) => {
    const identity = getWhopPlanIdentity(row.whop_plan_id);
    return { provider: "whop", provider_reference: row.whop_membership_id, provider_plan_id: row.whop_plan_id,
      plan_key: identity.planKey, billing_mode: identity.billingKind === "legacy-lifetime" ? "one_time" : "subscription",
      status: row.status, cancel_at_period_end: row.status === "canceling", access_expires_at: null,
      provider_customer_id: null, updated_at: row.updated_at };
  }));
}

function selectRows(values: unknown[]): SelectedEntitlement | null {
  const candidates = values.map(readEntitlementRow).filter((row): row is EntitlementRow => Boolean(row)).map((row) => ({ row, access: mapAccess(row) }));
  candidates.sort(compareEntitlements);
  return candidates[0] ?? null;
}

function mapAccess(row: EntitlementRow): CreatorAccessSummary {
  const whopIdentity = row.provider === "whop" ? getWhopPlanIdentity(row.provider_plan_id) : null;
  const planKey = row.plan_key ?? whopIdentity?.planKey ?? null;
  const legacy = whopIdentity?.billingKind === "legacy-lifetime";
  const status = readBillingStatus(row.status);
  return { provider: row.provider, planName: planKey ? PLAN_DEFINITIONS[planKey].name : whopIdentity?.planName ?? "Paid plan",
    planKey, billingKind: legacy ? "legacy-lifetime" : billingKindForMode(row.billing_mode), status,
    hasActiveAccess: legacy ? hasBillingAccess("one_time", status) : hasBillingAccess(row.billing_mode, status) };
}

function compareEntitlements(left: SelectedEntitlement, right: SelectedEntitlement): number {
  if (left.access.hasActiveAccess !== right.access.hasActiveAccess) return left.access.hasActiveAccess ? -1 : 1;
  const leftTier = left.access.planKey === "premium" ? 1 : 0;
  const rightTier = right.access.planKey === "premium" ? 1 : 0;
  if (leftTier !== rightTier) return rightTier - leftTier;
  return Date.parse(right.row.updated_at) - Date.parse(left.row.updated_at);
}

function readEntitlementRow(value: unknown): EntitlementRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if ((row.provider !== "whop" && row.provider !== "stripe") || typeof row.provider_reference !== "string" || typeof row.provider_plan_id !== "string"
    || (row.billing_mode !== "one_time" && row.billing_mode !== "subscription") || typeof row.status !== "string" || typeof row.updated_at !== "string") return null;
  return { provider: row.provider, provider_reference: row.provider_reference, provider_plan_id: row.provider_plan_id,
    plan_key: row.plan_key === "commercial" || row.plan_key === "premium" ? row.plan_key : null, billing_mode: row.billing_mode,
    status: row.status, cancel_at_period_end: row.cancel_at_period_end === true,
    access_expires_at: readTimestamp(typeof row.access_expires_at === "string" ? row.access_expires_at : null),
    provider_customer_id: typeof row.provider_customer_id === "string" ? row.provider_customer_id : null, updated_at: row.updated_at };
}

function readBillingStatus(value: string): BillingStatus | null {
  const statuses: BillingStatus[] = ["pending", "trialing", "active", "past_due", "completed", "canceled", "expired", "unresolved", "drafted", "canceling", "paused", "unpaid", "incomplete", "incomplete_expired", "failed", "refunded"];
  return statuses.includes(value as BillingStatus) ? value as BillingStatus : null;
}
function readTimestamp(value: string | null): string | null { return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
