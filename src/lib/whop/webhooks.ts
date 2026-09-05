export type StoredEntitlementEvent = {
  lastEventId: string;
  updatedAt: string;
};

export function getWebhookMetadataUserId(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return null;
  }

  const userId = (metadata as Record<string, unknown>).supabase_user_id;

  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return null;
  }

  return userId;
}

export function getWebhookCheckoutAttemptId(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).checkout_attempt_id;
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

export function isValidWebhookTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function shouldIgnoreEntitlementEvent(
  existing: StoredEntitlementEvent | null,
  eventId: string,
  eventTime: number,
): boolean {
  if (!existing) {
    return false;
  }

  return existing.lastEventId === eventId || Date.parse(existing.updatedAt) >= eventTime;
}
