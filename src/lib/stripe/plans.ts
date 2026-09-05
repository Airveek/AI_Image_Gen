import type { BillingMode, PlanKey } from "@/lib/billing/types";

export function identifyStripePrice(priceId: string): { planKey: PlanKey | null; mode: BillingMode | null } {
  const mappings: Array<[string | undefined, PlanKey, BillingMode]> = [
    [process.env.STRIPE_COMMERCIAL_ONE_TIME_PRICE_ID, "commercial", "one_time"],
    [process.env.STRIPE_PREMIUM_ONE_TIME_PRICE_ID, "premium", "one_time"],
    [process.env.STRIPE_COMMERCIAL_SUBSCRIPTION_PRICE_ID, "commercial", "subscription"],
    [process.env.STRIPE_PREMIUM_SUBSCRIPTION_PRICE_ID, "premium", "subscription"],
  ];
  const match = mappings.find(([configured]) => configured && configured === priceId);
  return match ? { planKey: match[1], mode: match[2] } : { planKey: null, mode: null };
}

