import "server-only";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWhopPlanIdentity } from "@/lib/whop/client";
import type {
  PurchaseHistoryItem,
  PurchaseHistorySummary,
} from "@/lib/whop/types";

type TransactionRow = {
  whop_event_id: string;
  object_type: "payment" | "refund";
  whop_object_id: string;
  event_type: string;
  status: string;
  amount: number | null;
  currency: string | null;
  plan_id: string | null;
  occurred_at: string;
};

export async function getCurrentPurchaseHistory(): Promise<PurchaseHistorySummary> {
  const user = await requireCreatorUser();

  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("whop_transaction_facts")
      .select("whop_event_id, object_type, whop_object_id, event_type, status, amount, currency, plan_id, occurred_at")
      .eq("user_id", user.id)
      .in("event_type", ["payment.succeeded", "refund.created", "refund.updated"])
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (error || !Array.isArray(data)) return { items: [], available: false };

    const latestByObject = new Map<string, TransactionRow>();
    for (const value of data) {
      const row = readTransactionRow(value);
      if (!row || !isCompletedTransaction(row)) continue;
      const key = `${row.object_type}:${row.whop_object_id}`;
      if (!latestByObject.has(key)) latestByObject.set(key, row);
    }

    return {
      items: [...latestByObject.values()].slice(0, 50).map(mapPurchaseHistoryItem),
      available: true,
    };
  } catch {
    return { items: [], available: false };
  }
}

function mapPurchaseHistoryItem(row: TransactionRow): PurchaseHistoryItem {
  const identity = row.plan_id ? getWhopPlanIdentity(row.plan_id) : null;
  return {
    id: row.whop_event_id,
    kind: row.object_type,
    planName: identity?.planName ?? "Airveek plan",
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    occurredAt: row.occurred_at,
  };
}

function readTransactionRow(value: unknown): TransactionRow | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.whop_event_id !== "string"
    || (row.object_type !== "payment" && row.object_type !== "refund")
    || typeof row.whop_object_id !== "string"
    || typeof row.event_type !== "string"
    || typeof row.status !== "string"
    || (row.amount !== null && typeof row.amount !== "number")
    || (row.currency !== null && typeof row.currency !== "string")
    || (row.plan_id !== null && typeof row.plan_id !== "string")
    || typeof row.occurred_at !== "string"
    || !Number.isFinite(Date.parse(row.occurred_at))
  ) return null;

  return {
    whop_event_id: row.whop_event_id,
    object_type: row.object_type,
    whop_object_id: row.whop_object_id,
    event_type: row.event_type,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    plan_id: row.plan_id,
    occurred_at: row.occurred_at,
  };
}

function isCompletedTransaction(row: TransactionRow): boolean {
  if (row.object_type === "payment") return row.event_type === "payment.succeeded";
  return ["completed", "refunded", "succeeded", "successful"].includes(row.status.toLowerCase());
}
