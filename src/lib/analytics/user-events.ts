import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeUserEventProperties } from "@/lib/analytics/event-types";
import type { RecordUserEventInput } from "@/lib/analytics/event-types";

export type { RecordUserEventInput, UserEventName, UserEventProperties } from "@/lib/analytics/event-types";

export async function recordUserEvent(input: RecordUserEventInput): Promise<void> {
  if (!isUuid(input.userId)) {
    return;
  }

  const properties = sanitizeUserEventProperties(input.properties);
  const externalEventId = normalizeExternalEventId(input.externalEventId);
  const occurredAt = normalizeOccurredAt(input.occurredAt);

  try {
    const { error } = await createSupabaseAdminClient()
      .from("user_events")
      .insert({
        user_id: input.userId,
        event_name: input.eventName,
        occurred_at: occurredAt,
        arena_id: properties.arenaId ?? null,
        plan_key: properties.planKey ?? null,
        properties,
        external_event_id: externalEventId,
      });

    if (error && !(externalEventId && error.code === "23505")) {
      console.error("Unable to record user event.", error.message);
    }
  } catch (error) {
    console.error(
      "Unable to record user event.",
      error instanceof Error ? error.message : "Unknown analytics error.",
    );
  }
}

function normalizeExternalEventId(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 160) : null;
}

function normalizeOccurredAt(value: string | undefined): string {
  if (value && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return new Date().toISOString();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
