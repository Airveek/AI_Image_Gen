import type { CheckoutRedirectResponse, CheckoutRequest, CheckoutResponse } from "@/lib/billing/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCheckoutRequest(value: unknown): value is CheckoutRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (record.plan === "commercial" || record.plan === "premium")
    && typeof record.checkoutAttemptId === "string" && UUID.test(record.checkoutAttemptId);
}

export function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const url = (value as Record<string, unknown>).purchaseUrl;
  const metaEventId = (value as Record<string, unknown>).metaEventId;
  return typeof url === "string" && url.startsWith("https://") && typeof metaEventId === "string" && UUID.test(metaEventId);
}

export function isCheckoutRedirectResponse(value: unknown): value is CheckoutRedirectResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.code === "active_plan" && record.redirectTo === "/plans";
}
