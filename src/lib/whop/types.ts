export type PlanKey = "commercial" | "premium";

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
  status: WhopEntitlementStatus | null;
  hasActiveAccess: boolean;
};
