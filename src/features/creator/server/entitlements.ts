import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type CreatorAccessSummary,
  type WhopEntitlementStatus,
} from "@/lib/whop/types";

type EntitlementRow = {
  whop_plan_id: string;
  status: string;
};

const EMPTY_ACCESS: CreatorAccessSummary = {
  planName: "No plan yet",
  status: null,
  hasActiveAccess: false,
};

export async function getCurrentCreatorAccess(): Promise<CreatorAccessSummary> {
  try {
    return await readCurrentCreatorAccess();
  } catch {
    return EMPTY_ACCESS;
  }
}

async function readCurrentCreatorAccess(): Promise<CreatorAccessSummary> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return EMPTY_ACCESS;
  }

  const { data, error } = await supabase
    .from("whop_entitlements")
    .select("whop_plan_id, status")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return EMPTY_ACCESS;
  }

  const row: unknown = data;

  if (!isEntitlementRow(row)) {
    return EMPTY_ACCESS;
  }

  const status = isWhopEntitlementStatus(row.status) ? row.status : null;
  const planName = row.whop_plan_id === process.env.WHOP_PREMIUM_PLAN_ID
    ? "Premium"
    : row.whop_plan_id === process.env.WHOP_COMMERCIAL_PLAN_ID
      ? "Commercial"
      : "Paid plan";

  return {
    planName,
    status,
    hasActiveAccess: status === "active" || status === "trialing",
  };
}

function isEntitlementRow(value: unknown): value is EntitlementRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return typeof row.whop_plan_id === "string" && typeof row.status === "string";
}

function isWhopEntitlementStatus(value: string): value is WhopEntitlementStatus {
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
  ].includes(value);
}
