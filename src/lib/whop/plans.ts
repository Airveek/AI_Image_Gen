import type {
  BillingKind,
  PlanKey,
  WhopEntitlementStatus,
} from "@/lib/whop/types";

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceUsdCents: number;
  billingCadence: "month";
  description: string;
  bestFor: string;
  features: readonly string[];
};

export type WhopPlanIdConfiguration = {
  commercialMonthly?: string;
  premiumMonthly?: string;
  commercialLegacy?: string;
  premiumLegacy?: string;
};

export type WhopPlanIdentity = {
  planKey: PlanKey | null;
  planName: string;
  billingKind: BillingKind;
};

export const PLAN_DEFINITIONS: Readonly<Record<PlanKey, PlanDefinition>> = {
  commercial: {
    key: "commercial",
    name: "Commercial",
    priceUsdCents: 4_900,
    billingCadence: "month",
    description: "The practical toolkit for everyday business images, campaigns, and client work.",
    bestFor: "you need dependable marketing visuals and commercial-use downloads.",
    features: [
      "Unlimited designs subject to fair use",
      "HD image downloads",
      "Commercial license",
      "No watermarks",
      "30-day money-back guarantee",
    ],
  },
  premium: {
    key: "premium",
    name: "Premium",
    priceUsdCents: 14_700,
    billingCadence: "month",
    description: "Advanced creation for businesses that need consistency, better text, and premium product workflows.",
    bestFor: "your brand depends on repeatable characters, readable text, mockups, or virtual models.",
    features: [
      "Everything in Commercial",
      "Consistent characters",
      "Your face in AI images",
      "Product mockups and virtual models",
      "Perfect text in AI images",
      "Faster generation and premium tools",
    ],
  },
};

export function getPlanDefinition(plan: PlanKey): PlanDefinition {
  return PLAN_DEFINITIONS[plan];
}

export function identifyWhopPlan(
  planId: string,
  configuration: WhopPlanIdConfiguration,
): WhopPlanIdentity {
  if (configuration.premiumMonthly && planId === configuration.premiumMonthly) {
    return { planKey: "premium", planName: "Premium", billingKind: "monthly" };
  }
  if (configuration.commercialMonthly && planId === configuration.commercialMonthly) {
    return { planKey: "commercial", planName: "Commercial", billingKind: "monthly" };
  }
  if (configuration.premiumLegacy && planId === configuration.premiumLegacy) {
    return { planKey: "premium", planName: "Premium", billingKind: "legacy-lifetime" };
  }
  if (configuration.commercialLegacy && planId === configuration.commercialLegacy) {
    return { planKey: "commercial", planName: "Commercial", billingKind: "legacy-lifetime" };
  }
  return { planKey: null, planName: "Paid plan", billingKind: "unknown" };
}

export function hasPlanAccess(
  billingKind: BillingKind,
  status: WhopEntitlementStatus | null,
): boolean {
  if (!status) return false;
  if (billingKind === "unknown") return false;
  if (billingKind === "legacy-lifetime") {
    return status === "active" || status === "completed";
  }
  return status === "active" || status === "trialing" || status === "canceling";
}

export function isSafeWhopManageUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com"));
  } catch {
    return false;
  }
}
