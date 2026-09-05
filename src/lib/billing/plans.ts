import type { BillingMode, PlanKey } from "@/lib/billing/types";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceUsdCents: number;
  description: string;
  bestFor: string;
  features: readonly string[];
};

export const PLAN_DEFINITIONS: Readonly<Record<PlanKey, PlanDefinition>> = {
  commercial: {
    key: "commercial", name: "Commercial", priceUsdCents: 4_900,
    description: "The practical toolkit for everyday business images, campaigns, and client work.",
    bestFor: "you need dependable marketing visuals and commercial-use downloads.",
    features: ["Unlimited designs subject to fair use", "HD image downloads", "Commercial license", "No watermarks", "30-day money-back guarantee"],
  },
  premium: {
    key: "premium", name: "Premium", priceUsdCents: 14_700,
    description: "Advanced creation for businesses that need consistency, better text, and premium product workflows.",
    bestFor: "your brand depends on repeatable characters, readable text, mockups, or virtual models.",
    features: ["Everything in Commercial", "Consistent characters", "Your face in AI images", "Product mockups and virtual models", "Perfect text in AI images", "Faster generation and premium tools"],
  },
};

export function getPlanDefinition(plan: PlanKey): PlanDefinition { return PLAN_DEFINITIONS[plan]; }
export function billingKindForMode(mode: BillingMode): "monthly" | "one-time" {
  return mode === "subscription" ? "monthly" : "one-time";
}
export function hasBillingAccess(mode: BillingMode, status: string | null): boolean {
  if (!status) return false;
  return mode === "one_time"
    ? status === "completed" || status === "active"
    : status === "active" || status === "trialing" || status === "canceling";
}

