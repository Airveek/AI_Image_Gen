import assert from "node:assert/strict";
import { test } from "node:test";

const { billingKindForMode, billingModeForBillingKind, hasBillingAccess } = await import("../src/lib/billing/plans.ts");
const { isCheckoutRedirectResponse, isCheckoutRequest, isCheckoutResponse } = await import("../src/lib/billing/checkout.ts");
const { readUpgradeSource } = await import("../src/lib/billing/upgrade.ts");
process.env.STRIPE_COMMERCIAL_ONE_TIME_PRICE_ID = "price_commercial_once";
process.env.STRIPE_PREMIUM_SUBSCRIPTION_PRICE_ID = "price_premium_monthly";
const { identifyStripePrice } = await import("../src/lib/stripe/plans.ts");

test("maps the global mode to customer-facing billing semantics", () => {
  assert.equal(billingKindForMode("subscription"), "monthly");
  assert.equal(billingKindForMode("one_time"), "one-time");
});

test("preserves access independently for recurring and one-time purchases", () => {
  assert.equal(hasBillingAccess("subscription", "active"), true);
  assert.equal(hasBillingAccess("subscription", "canceling"), true);
  assert.equal(hasBillingAccess("subscription", "canceled"), false);
  assert.equal(hasBillingAccess("one_time", "completed"), true);
  assert.equal(hasBillingAccess("one_time", "refunded"), false);
});

test("requires an unguessable checkout attempt id and an HTTPS response", () => {
  const checkoutAttemptId = "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8";
  assert.equal(isCheckoutRequest({ plan: "premium", checkoutAttemptId }), true);
  assert.equal(isCheckoutRequest({ plan: "premium", checkoutAttemptId: "bad" }), false);
  assert.equal(isCheckoutResponse({ purchaseUrl: "https://checkout.stripe.com/c/pay/test" }), true);
  assert.equal(isCheckoutResponse({ purchaseUrl: "javascript:alert(1)" }), false);
});

test("recognizes the active-plan checkout redirect response", () => {
  assert.equal(isCheckoutRedirectResponse({ code: "active_plan", redirectTo: "/plans" }), true);
  assert.equal(isCheckoutRedirectResponse({ code: "active_plan", redirectTo: "/checkout" }), false);
  assert.equal(isCheckoutRedirectResponse({ code: "other", redirectTo: "/plans" }), false);
  assert.equal(isCheckoutRedirectResponse(null), false);
});

test("keeps the original billing mode for upgrades", () => {
  assert.equal(billingModeForBillingKind("monthly"), "subscription");
  assert.equal(billingModeForBillingKind("one-time"), "one_time");
  assert.equal(billingModeForBillingKind("legacy-lifetime"), "one_time");
  assert.equal(billingModeForBillingKind("unknown"), null);

  assert.deepEqual(readUpgradeSource({
    upgrade_from_provider: "stripe",
    upgrade_from_reference: "sub_previous",
    upgrade_from_billing_mode: "subscription",
  }), {
    provider: "stripe",
    reference: "sub_previous",
    billingMode: "subscription",
  });
  assert.equal(readUpgradeSource({ supabase_user_id: "user" }), null);
  assert.throws(() => readUpgradeSource({ upgrade_from_provider: "stripe" }));
});

test("never confuses Stripe tiers or billing modes", () => {
  assert.deepEqual(identifyStripePrice("price_commercial_once"), { planKey: "commercial", mode: "one_time" });
  assert.deepEqual(identifyStripePrice("price_premium_monthly"), { planKey: "premium", mode: "subscription" });
  assert.deepEqual(identifyStripePrice("price_unknown"), { planKey: null, mode: null });
});
