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
