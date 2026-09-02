export type PlanKey = "commercial" | "premium";

export type BillingKind = "monthly" | "legacy-lifetime" | "unknown";

export type CheckoutRequest = {
  plan: PlanKey;
};

export type CheckoutResponse = {
  purchaseUrl: string;
};

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "commercial" || value === "premium";
}

export type WhopEntitlementStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "completed"
  | "canceled"
  | "expired"
  | "unresolved"
  | "drafted"
  | "canceling";

export type CreatorAccessSummary = {
  planName: string;
  planKey: PlanKey | null;
  billingKind: BillingKind;
  status: WhopEntitlementStatus | null;
  hasActiveAccess: boolean;
};

export type AccountBillingSummary = CreatorAccessSummary & {
  cancelAtPeriodEnd: boolean;
  manageUrl: string | null;
  renewalAt: string | null;
};

export type PurchaseHistoryItem = {
  id: string;
  kind: "payment" | "refund";
  planName: string;
  status: string;
  amount: number | null;
  currency: string | null;
  occurredAt: string;
};

export type PurchaseHistorySummary = {
  items: PurchaseHistoryItem[];
  available: boolean;
};
