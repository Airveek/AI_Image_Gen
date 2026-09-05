export type PlanKey = "commercial" | "premium";
export type BillingProvider = "whop" | "stripe";
export type BillingMode = "one_time" | "subscription";
export type BillingKind = "monthly" | "one-time" | "legacy-lifetime" | "unknown";

export type BillingStatus =
  | "pending" | "trialing" | "active" | "past_due" | "completed" | "canceled"
  | "expired" | "unresolved" | "drafted" | "canceling" | "paused"
  | "unpaid" | "incomplete" | "incomplete_expired" | "failed" | "refunded";

export type CheckoutRequest = { plan: PlanKey; checkoutAttemptId: string };
export type CheckoutResponse = { purchaseUrl: string; metaEventId: string };

export type CreatorAccessSummary = {
  provider: BillingProvider | null;
  planName: string;
  planKey: PlanKey | null;
  billingKind: BillingKind;
  status: BillingStatus | null;
  hasActiveAccess: boolean;
};

export type AccountBillingSummary = CreatorAccessSummary & {
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
  manageUrl: string | null;
  renewalAt: string | null;
};

export type PurchaseHistoryItem = {
  id: string;
  provider: BillingProvider;
  kind: "payment" | "refund" | "dispute";
  planName: string;
  status: string;
  amount: number | null;
  currency: string | null;
  occurredAt: string;
};

export type PurchaseHistorySummary = { items: PurchaseHistoryItem[]; available: boolean };

export type BillingConfiguration = {
  provider: BillingProvider;
  mode: BillingMode;
};

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "commercial" || value === "premium";
}

export function isBillingProvider(value: unknown): value is BillingProvider {
  return value === "whop" || value === "stripe";
}

export function isBillingMode(value: unknown): value is BillingMode {
  return value === "one_time" || value === "subscription";
}
