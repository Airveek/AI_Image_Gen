import "server-only";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import type { PlanKey, PurchaseHistoryItem, PurchaseHistorySummary } from "@/lib/billing/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWhopPlanIdentity } from "@/lib/whop/client";

type WhopRow = { whop_event_id: string; object_type: "payment" | "refund"; whop_object_id: string;
  event_type: string; status: string; amount: number | null; currency: string | null; plan_id: string | null; occurred_at: string };
type StripeRow = { stripe_event_id: string; object_type: "payment" | "refund" | "dispute"; stripe_object_id: string;
  event_type: string; status: string; amount_cents: number | null; currency: string | null; plan_key: PlanKey | null; occurred_at: string };

export async function getCurrentPurchaseHistory(): Promise<PurchaseHistorySummary> {
  const user = await requireCreatorUser();
  const client = createSupabaseAdminClient();
  try {
    const [whop, stripe] = await Promise.all([
      client.from("whop_transaction_facts")
        .select("whop_event_id,object_type,whop_object_id,event_type,status,amount,currency,plan_id,occurred_at")
        .eq("user_id", user.id).in("event_type", ["payment.succeeded", "refund.created", "refund.updated"])
        .order("occurred_at", { ascending: false }).limit(100),
      client.from("stripe_transaction_facts")
        .select("stripe_event_id,object_type,stripe_object_id,event_type,status,amount_cents,currency,plan_key,occurred_at")
        .eq("user_id", user.id).in("event_type", ["payment_intent.succeeded", "invoice.paid", "refund.created", "refund.updated", "charge.dispute.created", "charge.dispute.closed"])
        .order("occurred_at", { ascending: false }).limit(100),
    ]);
    if (whop.error && stripe.error) return { items: [], available: false };
    const whopItems = whop.error ? [] : dedupeWhop((whop.data ?? []) as WhopRow[]);
    const stripeItems = stripe.error ? [] : dedupeStripe((stripe.data ?? []) as StripeRow[]);
    return { available: true, items: [...whopItems, ...stripeItems].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 50) };
  } catch { return { items: [], available: false }; }
}

function dedupeWhop(rows: WhopRow[]): PurchaseHistoryItem[] {
  const latest = new Map<string, WhopRow>();
  for (const row of rows) {
    if (row.object_type === "refund" && !["completed", "refunded", "succeeded", "successful"].includes(row.status.toLowerCase())) continue;
    const key = `${row.object_type}:${row.whop_object_id}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].map((row) => ({ id: `whop:${row.whop_event_id}`, provider: "whop", kind: row.object_type,
    planName: row.plan_id ? getWhopPlanIdentity(row.plan_id).planName : "Airveek plan", status: row.status,
    amount: row.amount, currency: row.currency, occurredAt: row.occurred_at }));
}

function dedupeStripe(rows: StripeRow[]): PurchaseHistoryItem[] {
  const latest = new Map<string, StripeRow>();
  for (const row of rows) {
    const key = `${row.object_type}:${row.stripe_object_id}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].map((row) => ({ id: `stripe:${row.stripe_event_id}`, provider: "stripe", kind: row.object_type,
    planName: row.plan_key ? PLAN_DEFINITIONS[row.plan_key].name : "Airveek plan", status: row.status,
    amount: row.amount_cents === null ? null : row.amount_cents / 100, currency: row.currency, occurredAt: row.occurred_at }));
}
