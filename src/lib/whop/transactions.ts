const PAYMENT_EVENT_TYPES = new Set([
  "payment.created",
  "payment.pending",
  "payment.succeeded",
  "payment.failed",
]);

const REFUND_EVENT_TYPES = new Set(["refund.created", "refund.updated"]);

export type WhopTransactionFact = {
  whopEventId: string;
  objectType: "payment" | "refund";
  whopObjectId: string;
  eventType:
    | "payment.created"
    | "payment.pending"
    | "payment.succeeded"
    | "payment.failed"
    | "refund.created"
    | "refund.updated";
  userId: string | null;
  paymentId: string | null;
  refundId: string | null;
  membershipId: string | null;
  planId: string | null;
  checkoutConfigurationId: string | null;
  status: string;
  amount: number | null;
  amountAfterFees: number | null;
  usdAmount: number | null;
  currency: string | null;
  settlementCurrency: string | null;
  taxAmount: number | null;
  refundedAmount: number | null;
  occurredAt: string;
};

/**
 * Convert a verified Whop payment/refund webhook into a bounded, non-PII
 * transaction fact. Raw payloads, addresses, card data, and email addresses
 * are intentionally not persisted. Returning null is a hard validation
 * failure; the webhook route responds non-2xx so the provider retries it.
 */
export function buildWhopTransactionFact(input: {
  id: string;
  type: string;
  timestamp: string;
  data: unknown;
}): WhopTransactionFact | null {
  const eventId = normalizeIdentifier(input.id);
  const eventType = normalizeEventType(input.type);
  const occurredAt = normalizeTimestamp(input.timestamp);
  const data = asRecord(input.data);
  if (!eventId || eventId.length < 8 || !eventType || !occurredAt || !data) return null;

  if (PAYMENT_EVENT_TYPES.has(eventType)) {
    const paymentId = normalizeIdentifier(data.id);
    if (!paymentId) return null;
    const plan = asRecord(data.plan);
    const membership = asRecord(data.membership);
    return {
      whopEventId: eventId,
      objectType: "payment",
      whopObjectId: paymentId,
      eventType: eventType as WhopTransactionFact["eventType"],
      userId: readMetadataUserId(data.metadata),
      paymentId,
      refundId: null,
      membershipId: normalizeIdentifier(membership?.id),
      planId: normalizeIdentifier(plan?.id),
      checkoutConfigurationId: normalizeIdentifier(data.checkout_configuration_id),
      status: normalizeStatus(data.status) ?? statusForPaymentEvent(eventType),
      amount: finiteMoney(data.settlement_amount ?? data.total),
      amountAfterFees: finiteMoney(data.amount_after_fees),
      usdAmount: finiteMoney(data.usd_total),
      currency: normalizeCurrency(data.currency),
      settlementCurrency: normalizeCurrency(data.settlement_currency),
      taxAmount: finiteMoney(data.tax_amount),
      refundedAmount: finiteMoney(data.refunded_amount),
      occurredAt,
    };
  }

  if (REFUND_EVENT_TYPES.has(eventType)) {
    const refundId = normalizeIdentifier(data.id);
    const payment = asRecord(data.payment);
    if (!refundId) return null;
    const plan = asRecord(payment?.plan);
    const membership = asRecord(payment?.membership);
    return {
      whopEventId: eventId,
      objectType: "refund",
      whopObjectId: refundId,
      eventType: eventType as WhopTransactionFact["eventType"],
      userId: readMetadataUserId(payment?.metadata),
      paymentId: normalizeIdentifier(payment?.id),
      refundId,
      membershipId: normalizeIdentifier(membership?.id),
      planId: normalizeIdentifier(plan?.id),
      checkoutConfigurationId: null,
      status: normalizeStatus(data.status) ?? "created",
      amount: finiteMoney(data.amount),
      amountAfterFees: null,
      usdAmount: null,
      currency: normalizeCurrency(data.currency),
      settlementCurrency: null,
      taxAmount: finiteMoney(data.tax_refunded_amount),
      refundedAmount: finiteMoney(data.amount),
      occurredAt,
    };
  }

  return null;
}

function statusForPaymentEvent(eventType: string): string {
  if (eventType === "payment.succeeded") return "succeeded";
  if (eventType === "payment.failed") return "failed";
  if (eventType === "payment.pending") return "pending";
  return "created";
}

function normalizeEventType(value: string): WhopTransactionFact["eventType"] | null {
  return PAYMENT_EVENT_TYPES.has(value) || REFUND_EVENT_TYPES.has(value)
    ? value as WhopTransactionFact["eventType"]
    : null;
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 160 ? normalized : null;
}

function normalizeTimestamp(value: string): string | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return normalized || null;
}

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function finiteMoney(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000
    ? Math.round(value * 10_000) / 10_000
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readMetadataUserId(value: unknown): string | null {
  const metadata = asRecord(value);
  const userId = metadata?.supabase_user_id;
  return typeof userId === "string" && /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}
