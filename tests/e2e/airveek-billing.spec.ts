import { expect, test } from "@playwright/test";

import { getPathWithNext, getSafeRedirectPath } from "@/lib/auth/redirect-path";
import { sanitizeUserEventProperties } from "@/lib/analytics/event-types";
import { isPrimaryGoal, isUserType } from "@/features/account/types";
import { isCheckoutRequest, isCheckoutResponse } from "@/lib/whop/checkout";
import { isPlanKey } from "@/lib/whop/types";
import {
  getWebhookMetadataUserId,
  isValidWebhookTimestamp,
  shouldIgnoreEntitlementEvent,
} from "@/lib/whop/webhooks";

test("accepts only supported Whop plans", () => {
  expect(isPlanKey("commercial")).toBe(true);
  expect(isPlanKey("premium")).toBe(true);
  expect(isPlanKey("free")).toBe(false);
  expect(isPlanKey(null)).toBe(false);
});

test("validates checkout request and response shapes", () => {
  expect(isCheckoutRequest({ plan: "commercial" })).toBe(true);
  expect(isCheckoutRequest({ plan: "unknown" })).toBe(false);
  expect(isCheckoutRequest(null)).toBe(false);
  expect(isCheckoutResponse({ purchaseUrl: "https://whop.com/checkout" })).toBe(true);
  expect(isCheckoutResponse({ purchaseUrl: "http://localhost:3001" })).toBe(false);
  expect(isCheckoutResponse({ purchaseUrl: 42 })).toBe(false);
});

test("keeps checkout redirects on the local site", () => {
  const checkoutPath = "/checkout?plan=commercial";

  expect(getSafeRedirectPath(checkoutPath)).toBe(checkoutPath);
  expect(getSafeRedirectPath("https://example.com")).toBe("/dashboard");
  expect(getSafeRedirectPath("//example.com")).toBe("/dashboard");
  expect(getPathWithNext("/login", checkoutPath)).toBe(
    "/login?next=%2Fcheckout%3Fplan%3Dcommercial",
  );
});

test("validates webhook metadata and timestamps", () => {
  expect(getWebhookMetadataUserId(null)).toBeNull();
  expect(getWebhookMetadataUserId({ supabase_user_id: "not-a-uuid" })).toBeNull();
  expect(getWebhookMetadataUserId({ supabase_user_id: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8" })).toBe(
    "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8",
  );
  expect(isValidWebhookTimestamp("2026-08-24T10:00:00.000Z")).toBe(true);
  expect(isValidWebhookTimestamp("not-a-date")).toBe(false);
});

test("ignores duplicate and older entitlement events", () => {
  const existing = {
    lastEventId: "evt_1",
    updatedAt: "2026-08-24T10:00:00.000Z",
  };
  const currentEventTime = Date.parse("2026-08-24T10:00:00.000Z");

  expect(shouldIgnoreEntitlementEvent(existing, "evt_1", currentEventTime)).toBe(true);
  expect(shouldIgnoreEntitlementEvent(existing, "evt_2", currentEventTime - 1)).toBe(true);
  expect(shouldIgnoreEntitlementEvent(existing, "evt_2", currentEventTime + 1)).toBe(false);
  expect(shouldIgnoreEntitlementEvent(null, "evt_1", currentEventTime)).toBe(false);
});

test("keeps user profile and event data limited to approved values", () => {
  expect(isUserType("designer")).toBe(true);
  expect(isUserType("admin")).toBe(false);
  expect(isPrimaryGoal("product-photos")).toBe(true);
  expect(isPrimaryGoal("private-data")).toBe(false);

  expect(sanitizeUserEventProperties({
    arenaId: "general-image",
    referenceCount: 2,
    errorCode: "provider_timeout",
  })).toEqual({
    arenaId: "general-image",
    referenceCount: 2,
    errorCode: "provider_timeout",
  });
});
