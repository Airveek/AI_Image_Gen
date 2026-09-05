import type { BillingMode, BillingProvider } from "@/lib/billing/types";

export type UpgradeSource = {
  provider: BillingProvider;
  reference: string;
  billingMode: BillingMode;
};

export function readUpgradeSource(metadata: Record<string, unknown> | null | undefined): UpgradeSource | null {
  if (!metadata) return null;
  const hasUpgradeFields = "upgrade_from_provider" in metadata
    || "upgrade_from_reference" in metadata
    || "upgrade_from_billing_mode" in metadata;
  if (!hasUpgradeFields) return null;
  if ((metadata.upgrade_from_provider !== "whop" && metadata.upgrade_from_provider !== "stripe")
    || typeof metadata.upgrade_from_reference !== "string"
    || metadata.upgrade_from_reference.length === 0
    || (metadata.upgrade_from_billing_mode !== "one_time" && metadata.upgrade_from_billing_mode !== "subscription")) {
    throw new Error("Checkout metadata contains an invalid upgrade source.");
  }

  return {
    provider: metadata.upgrade_from_provider,
    reference: metadata.upgrade_from_reference,
    billingMode: metadata.upgrade_from_billing_mode,
  };
}
