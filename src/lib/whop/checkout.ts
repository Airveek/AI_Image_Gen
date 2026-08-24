import { isPlanKey, type CheckoutRequest, type CheckoutResponse } from "@/lib/whop/types";

export function isCheckoutRequest(value: unknown): value is CheckoutRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const plan = (value as Record<string, unknown>).plan;
  return isPlanKey(plan);
}

export function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const purchaseUrl = (value as Record<string, unknown>).purchaseUrl;
  return typeof purchaseUrl === "string" && purchaseUrl.startsWith("https://");
}
