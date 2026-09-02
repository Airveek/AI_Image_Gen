import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWhopClient, getWhopPlanIdentity } from "@/lib/whop/client";
import { hasPlanAccess, isSafeWhopManageUrl } from "@/lib/whop/plans";
import type {
  AccountBillingSummary,
  CreatorAccessSummary,
  WhopEntitlementStatus,
} from "@/lib/whop/types";

type EntitlementRow = {
  whop_membership_id: string;
  whop_plan_id: string;
  status: string;
  updated_at: string;
};

type SelectedEntitlement = {
  row: EntitlementRow;
  access: CreatorAccessSummary;
};

const EMPTY_ACCESS: CreatorAccessSummary = {
  planName: "No plan yet",
  planKey: null,
  billingKind: "unknown",
  status: null,
  hasActiveAccess: false,
};

const EMPTY_BILLING: AccountBillingSummary = {
  ...EMPTY_ACCESS,
  cancelAtPeriodEnd: false,
  manageUrl: null,
  renewalAt: null,
};

export async function getCurrentCreatorAccess(): Promise<CreatorAccessSummary> {
  try {
    return (await readSelectedEntitlement())?.access ?? EMPTY_ACCESS;
  } catch {
    return EMPTY_ACCESS;
  }
}

export async function getCurrentAccountBilling(): Promise<AccountBillingSummary> {
  let selected: SelectedEntitlement | null;
  try {
    selected = await readSelectedEntitlement();
  } catch {
    return EMPTY_BILLING;
  }

  if (!selected) return EMPTY_BILLING;

  const fallback: AccountBillingSummary = {
    ...selected.access,
    cancelAtPeriodEnd: selected.access.status === "canceling",
    manageUrl: null,
    renewalAt: null,
  };

  try {
    const membership = await getWhopClient().memberships.retrieve(selected.row.whop_membership_id);
    return {
      ...fallback,
      cancelAtPeriodEnd: membership.cancel_at_period_end,
      manageUrl: isSafeWhopManageUrl(membership.manage_url) ? membership.manage_url : null,
      renewalAt: readTimestamp(membership.renewal_period_end),
    };
  } catch {
    return fallback;
  }
}

async function readSelectedEntitlement(): Promise<SelectedEntitlement | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("whop_entitlements")
    .select("whop_membership_id, whop_plan_id, status, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data)) return null;

  const candidates = data
    .map((value: unknown) => readEntitlementRow(value))
    .filter((value): value is EntitlementRow => value !== null)
    .map((row) => ({ row, access: mapAccess(row) }));

  candidates.sort(compareEntitlements);
  return candidates[0] ?? null;
}

function mapAccess(row: EntitlementRow): CreatorAccessSummary {
  const identity = getWhopPlanIdentity(row.whop_plan_id);
  const status = readWhopEntitlementStatus(row.status);
  return {
    planName: identity.planName,
    planKey: identity.planKey,
    billingKind: identity.billingKind,
    status,
    hasActiveAccess: hasPlanAccess(identity.billingKind, status),
  };
}

function compareEntitlements(left: SelectedEntitlement, right: SelectedEntitlement): number {
  if (left.access.hasActiveAccess !== right.access.hasActiveAccess) {
    return left.access.hasActiveAccess ? -1 : 1;
  }
  const leftTier = left.access.planKey === "premium" ? 1 : 0;
  const rightTier = right.access.planKey === "premium" ? 1 : 0;
  if (leftTier !== rightTier) return rightTier - leftTier;
  return Date.parse(right.row.updated_at) - Date.parse(left.row.updated_at);
}

function readEntitlementRow(value: unknown): EntitlementRow | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return typeof row.whop_membership_id === "string"
    && typeof row.whop_plan_id === "string"
    && typeof row.status === "string"
    && typeof row.updated_at === "string"
    ? {
        whop_membership_id: row.whop_membership_id,
        whop_plan_id: row.whop_plan_id,
        status: row.status,
        updated_at: row.updated_at,
      }
    : null;
}

function readWhopEntitlementStatus(value: string): WhopEntitlementStatus | null {
  return [
    "trialing",
    "active",
    "past_due",
    "completed",
    "canceled",
    "expired",
    "unresolved",
    "drafted",
    "canceling",
  ].includes(value)
    ? value as WhopEntitlementStatus
    : null;
}

function readTimestamp(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
