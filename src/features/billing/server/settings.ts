import "server-only";

import { requireAdminUser } from "@/features/admin/server/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BillingConfiguration, BillingMode, BillingProvider } from "@/lib/billing/types";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import { getStripeClient, getStripePriceId } from "@/lib/stripe/client";
import { getWhopAccountId, getWhopCheckoutPlanId, getWhopClient } from "@/lib/whop/client";

export type ProviderReadiness = {
  provider: BillingProvider;
  mode: BillingMode;
  ready: boolean;
  message: string;
};

export type AdminBillingSettings = BillingConfiguration & { readiness: ProviderReadiness[] };

const DEFAULT: BillingConfiguration = { provider: "whop", mode: "subscription" };

export async function getActiveBillingConfiguration(): Promise<BillingConfiguration> {
  try { return await requireActiveBillingConfiguration(); } catch { return DEFAULT; }
}

export async function requireActiveBillingConfiguration(): Promise<BillingConfiguration> {
  const { data, error } = await createSupabaseAdminClient().from("billing_settings")
    .select("active_provider,active_mode").eq("singleton", true).maybeSingle();
  if (error) throw new Error(`Could not read billing settings: ${error.message}`);
  if (!data) throw new Error("Billing settings have not been initialized.");
  if ((data.active_provider === "whop" || data.active_provider === "stripe")
    && (data.active_mode === "one_time" || data.active_mode === "subscription")) {
    return { provider: data.active_provider, mode: data.active_mode };
  }
  throw new Error("Billing settings contain unsupported values.");
}

export async function getAdminBillingSettings(): Promise<AdminBillingSettings> {
  await requireAdminUser();
  const configuration = await requireActiveBillingConfiguration();
  const combinations: Array<[BillingProvider, BillingMode]> = [
    ["whop", "subscription"], ["whop", "one_time"],
    ["stripe", "subscription"], ["stripe", "one_time"],
  ];
  const readiness = await Promise.all(combinations.map(([provider, mode]) => checkBillingReadiness(provider, mode, false)));
  return { ...configuration, readiness };
}

export async function updateBillingConfiguration(provider: BillingProvider, mode: BillingMode): Promise<void> {
  const admin = await requireAdminUser();
  const readiness = await checkBillingReadiness(provider, mode, true);
  if (!readiness.ready) throw new Error(readiness.message);
  const { error } = await createSupabaseAdminClient().from("billing_settings").upsert({
    singleton: true, active_provider: provider, active_mode: mode,
    updated_by: admin.id, updated_at: new Date().toISOString(),
  }, { onConflict: "singleton" });
  if (error) throw new Error(`Could not update billing settings: ${error.message}`);
}

async function checkBillingReadiness(provider: BillingProvider, mode: BillingMode, verifyRemote: boolean): Promise<ProviderReadiness> {
  try {
    if (!isValidAppUrl(process.env.NEXT_PUBLIC_APP_URL)) {
      return { provider, mode, ready: false, message: "NEXT_PUBLIC_APP_URL must be HTTPS (or localhost HTTP)." };
    }
    if (provider === "stripe") {
      const required = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
        `STRIPE_COMMERCIAL_${mode === "subscription" ? "SUBSCRIPTION" : "ONE_TIME"}_PRICE_ID`,
        `STRIPE_PREMIUM_${mode === "subscription" ? "SUBSCRIPTION" : "ONE_TIME"}_PRICE_ID`];
      const missing = required.filter((name) => !process.env[name]?.trim());
      if (missing.length) return { provider, mode, ready: false, message: `Missing ${missing.join(", ")}.` };
      const priceIds = [process.env[required[2]], process.env[required[3]]];
      if (new Set(priceIds).size !== priceIds.length) return { provider, mode, ready: false, message: "Commercial and Premium must use different Stripe Price IDs." };
      if (verifyRemote) {
        for (const plan of ["commercial", "premium"] as const) {
          const price = await getStripeClient().prices.retrieve(getStripePriceId(plan, mode));
          const recurringMatches = mode === "subscription"
            ? price.recurring?.interval === "month" && price.recurring.interval_count === 1
            : !price.recurring;
          if (!price.active || !recurringMatches || price.currency !== "usd" || price.unit_amount !== PLAN_DEFINITIONS[plan].priceUsdCents) {
            throw new Error(`${plan} Stripe Price is inactive or has the wrong billing type.`);
          }
        }
      }
    } else {
      const suffix = mode === "subscription" ? "MONTHLY_PLAN_ID" : "PLAN_ID";
      const required = ["WHOP_API_KEY", "WHOP_COMPANY_ID", "WHOP_WEBHOOK_SECRET", `WHOP_COMMERCIAL_${suffix}`, `WHOP_PREMIUM_${suffix}`];
      const missing = required.filter((name) => !process.env[name]?.trim());
      if (missing.length) return { provider, mode, ready: false, message: `Missing ${missing.join(", ")}.` };
      const planIds = [process.env[required[3]], process.env[required[4]]];
      if (new Set(planIds).size !== planIds.length) return { provider, mode, ready: false, message: "Commercial and Premium must use different Whop plan IDs." };
      if (verifyRemote) {
        getWhopAccountId();
        for (const plan of ["commercial", "premium"] as const) {
          const planId = mode === "subscription" ? getWhopCheckoutPlanId(plan) : process.env[`WHOP_${plan.toUpperCase()}_PLAN_ID`]!;
          const remote = await getWhopClient().plans.retrieve(planId);
          const expected = mode === "subscription" ? "renewal" : "one_time";
          if (remote.plan_type !== expected) throw new Error(`${plan} Whop plan has the wrong billing type.`);
          const price = mode === "subscription" ? remote.renewal_price : remote.initial_price;
          const cadenceMatches = mode === "subscription" ? remote.billing_period === 30 : remote.expiration_days === null;
          if (!cadenceMatches || remote.currency !== "usd" || price !== PLAN_DEFINITIONS[plan].priceUsdCents / 100 || remote.release_method !== "buy_now") {
            throw new Error(`${plan} Whop plan must be an available USD ${PLAN_DEFINITIONS[plan].priceUsdCents / 100} plan.`);
          }
        }
      }
    }
    return { provider, mode, ready: true, message: "Configured" };
  } catch (error) {
    return { provider, mode, ready: false, message: error instanceof Error ? error.message : "Configuration check failed." };
  }
}

function isValidAppUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}
