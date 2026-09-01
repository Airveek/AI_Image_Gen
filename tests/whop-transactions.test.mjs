import assert from "node:assert/strict";
import { test } from "node:test";

const { buildWhopTransactionFact } = await import("../src/lib/whop/transactions.ts");

const userId = "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8";

test("normalizes a payment webhook into a non-PII transaction fact", () => {
  const fact = buildWhopTransactionFact({
    id: "evt_payment_123456",
    type: "payment.succeeded",
    timestamp: "2026-08-30T10:00:00.000Z",
    data: {
      id: "pay_123",
      metadata: { supabase_user_id: userId, email: "private@example.com" },
      plan: { id: "plan_premium" },
      membership: { id: "mship_123" },
      checkout_configuration_id: "checkout_123",
      status: "paid",
      settlement_amount: 19.995,
      amount_after_fees: 18.5,
      usd_total: 19.995,
      currency: "usd",
      settlement_currency: "usd",
      tax_amount: 0,
      refunded_amount: 0,
      billing_address: { line1: "must not be stored" },
    },
  });

  assert.deepEqual(fact, {
    whopEventId: "evt_payment_123456",
    objectType: "payment",
    whopObjectId: "pay_123",
    eventType: "payment.succeeded",
    userId,
    paymentId: "pay_123",
    refundId: null,
    membershipId: "mship_123",
    planId: "plan_premium",
    checkoutConfigurationId: "checkout_123",
    status: "paid",
    amount: 19.995,
    amountAfterFees: 18.5,
    usdAmount: 19.995,
    currency: "USD",
    settlementCurrency: "USD",
    taxAmount: 0,
    refundedAmount: 0,
    occurredAt: "2026-08-30T10:00:00.000Z",
  });
});

test("captures a refund even when Whop cannot provide a linked Supabase user", () => {
  const fact = buildWhopTransactionFact({
    id: "evt_refund_123456",
    type: "refund.updated",
    timestamp: "2026-08-30T11:00:00.000Z",
    data: {
      id: "refund_123",
      amount: 5.25,
      currency: "eur",
      status: "succeeded",
      tax_refunded_amount: 0,
      payment: {
        id: "pay_123",
        metadata: { unrelated: "value" },
        plan: { id: "plan_premium" },
        membership: { id: "mship_123" },
      },
    },
  });

  assert.equal(fact?.objectType, "refund");
  assert.equal(fact?.paymentId, "pay_123");
  assert.equal(fact?.currency, "EUR");
  assert.equal(fact?.amount, 5.25);
  assert.equal(fact?.userId, null);
});

test("rejects malformed or unsupported webhook facts", () => {
  assert.equal(buildWhopTransactionFact({ id: "short", type: "payment.succeeded", timestamp: "2026-08-30T10:00:00Z", data: { id: "pay_1" } }), null);
  assert.equal(buildWhopTransactionFact({ id: "evt_payment_123456", type: "payment.succeeded", timestamp: "bad", data: { id: "pay_1" } }), null);
  assert.equal(buildWhopTransactionFact({ id: "evt_unknown_123456", type: "invoice.paid", timestamp: "2026-08-30T10:00:00Z", data: { id: "inv_1" } }), null);
  assert.equal(buildWhopTransactionFact({ id: "evt_payment_123456", type: "payment.succeeded", timestamp: "2026-08-30T10:00:00Z", data: {} }), null);
});
