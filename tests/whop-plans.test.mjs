import assert from "node:assert/strict";
import { test } from "node:test";

const {
  PLAN_DEFINITIONS,
  hasPlanAccess,
  identifyWhopPlan,
  isSafeWhopManageUrl,
} = await import("../src/lib/whop/plans.ts");

const ids = {
  commercialMonthly: "plan_commercial_monthly",
  premiumMonthly: "plan_premium_monthly",
  commercialLegacy: "plan_commercial_legacy",
  premiumLegacy: "plan_premium_legacy",
};

test("keeps the public monthly prices in one typed catalog", () => {
  assert.equal(PLAN_DEFINITIONS.commercial.priceUsdCents, 4_900);
  assert.equal(PLAN_DEFINITIONS.premium.priceUsdCents, 14_700);
  assert.equal(PLAN_DEFINITIONS.commercial.billingCadence, "month");
  assert.equal(PLAN_DEFINITIONS.premium.billingCadence, "month");
});

test("distinguishes new monthly plans from legacy lifetime plans", () => {
  assert.deepEqual(identifyWhopPlan(ids.commercialMonthly, ids), {
    planKey: "commercial",
    planName: "Commercial",
    billingKind: "monthly",
  });
  assert.deepEqual(identifyWhopPlan(ids.premiumLegacy, ids), {
    planKey: "premium",
    planName: "Premium",
    billingKind: "legacy-lifetime",
  });
  assert.equal(identifyWhopPlan("plan_unknown", ids).billingKind, "unknown");
});

test("preserves completed lifetime access and end-of-period monthly access", () => {
  assert.equal(hasPlanAccess("legacy-lifetime", "completed"), true);
  assert.equal(hasPlanAccess("legacy-lifetime", "canceled"), false);
  assert.equal(hasPlanAccess("monthly", "trialing"), true);
  assert.equal(hasPlanAccess("monthly", "canceling"), true);
  assert.equal(hasPlanAccess("monthly", "expired"), false);
  assert.equal(hasPlanAccess("unknown", "active"), false);
});

test("accepts only secure Whop billing portal URLs", () => {
  assert.equal(isSafeWhopManageUrl("https://whop.com/billing/manage/mem_123"), true);
  assert.equal(isSafeWhopManageUrl("https://payments.whop.com/billing/mem_123"), true);
  assert.equal(isSafeWhopManageUrl("http://whop.com/billing/manage/mem_123"), false);
  assert.equal(isSafeWhopManageUrl("https://whop.com.example.com/billing/mem_123"), false);
  assert.equal(isSafeWhopManageUrl(null), false);
});
