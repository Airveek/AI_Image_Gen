import "server-only";

import { inngest } from "@/features/store-images/server/inngest-client";
import { recoverVerifiedPurchaseTracking } from "@/lib/analytics/meta-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OutboxRow = {
  event_id: string;
  event_name: string;
  occurred_at: string;
  source_url: string;
  user_data: Record<string, unknown>;
  custom_data: Record<string, unknown>;
  attempts: number;
  status: string;
};

export async function deliverMetaEvent(eventId: string): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("meta_event_outbox")
    .select("event_id,event_name,occurred_at,source_url,user_data,custom_data,attempts,status")
    .eq("event_id", eventId).maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Meta event was not found.");
  const row = data as OutboxRow;
  if (row.status === "sent" || Number(row.attempts ?? 0) >= 8) return;
  const config = metaConfiguration();
  const attempt = Number(row.attempts ?? 0) + 1;
  await client.from("meta_event_outbox").update({ status: "sending", attempts: attempt, updated_at: new Date().toISOString() }).eq("event_id", eventId);
  if (!config) {
    await markFailure(eventId, attempt, "Meta CAPI is not configured.");
    return;
  }
  try {
    const payload: Record<string, unknown> = {
      data: [{
        event_name: row.event_name,
        event_time: Math.floor(Date.parse(row.occurred_at) / 1000),
        event_id: row.event_id,
        event_source_url: row.source_url,
        action_source: "website",
        user_data: row.user_data,
        custom_data: row.custom_data,
      }],
    };
    if (config.testEventCode) payload.test_event_code = config.testEventCode;
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.pixelId}/events?access_token=${encodeURIComponent(config.accessToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Meta CAPI returned HTTP ${response.status}.`);
    await client.from("meta_event_outbox").update({
      status: "sent", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      last_error: null, user_data: {},
    }).eq("event_id", eventId);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Meta CAPI delivery failed.";
    await markFailure(eventId, attempt, message);
    throw error;
  }
}

async function markFailure(eventId: string, attempt: number, message: string): Promise<void> {
  const retryMinutes = Math.min(360, 2 ** Math.min(attempt, 8));
  await createSupabaseAdminClient().from("meta_event_outbox").update({
    status: "failed",
    last_error: message,
    next_attempt_at: new Date(Date.now() + retryMinutes * 60_000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("event_id", eventId);
}

function metaConfiguration(): { pixelId: string; accessToken: string; version: string; testEventCode: string | null } | null {
  const serverPixelId = process.env.META_PIXEL_ID?.trim();
  const publicPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  if (serverPixelId && publicPixelId && serverPixelId !== publicPixelId) return null;
  const pixelId = serverPixelId || publicPixelId;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim();
  if (!pixelId || !/^\d{6,30}$/.test(pixelId) || !accessToken || !version || !/^v\d{1,2}\.\d{1,2}$/.test(version)) return null;
  return { pixelId, accessToken, version, testEventCode: process.env.META_TEST_EVENT_CODE?.trim() || null };
}

export const metaDeliveryFunctions = [
  inngest.createFunction(
    { id: "deliver-meta-capi-event", retries: 5, triggers: [{ event: "analytics/meta.event.queued" }] },
    async ({ event, step }) => step.run("deliver-meta-event", () => deliverMetaEvent(String(event.data.eventId))),
  ),
  inngest.createFunction(
    { id: "recover-meta-capi-outbox", retries: 2, triggers: [{ cron: "*/15 * * * *" }] },
    async ({ step }) => step.run("recover-meta-events", async () => {
      const recoveredPurchases = await recoverVerifiedPurchaseTracking();
      const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await createSupabaseAdminClient().from("meta_event_outbox").update({ user_data: {}, updated_at: new Date().toISOString() })
        .lt("created_at", retentionCutoff);
      await createSupabaseAdminClient().from("meta_event_outbox").update({
        status: "failed",
        last_error: "Recovered an interrupted delivery.",
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("status", "sending").lt("updated_at", new Date(Date.now() - 15 * 60 * 1000).toISOString()).lt("attempts", 8);
      await createSupabaseAdminClient().from("billing_checkout_attempts").update({ meta_user_data: {}, updated_at: new Date().toISOString() })
        .lt("created_at", retentionCutoff);
      const { data } = await createSupabaseAdminClient().from("meta_event_outbox")
        .select("event_id").in("status", ["pending", "failed"])
        .lt("attempts", 8).lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(50);
      const events = (data ?? []).map((row) => ({ name: "analytics/meta.event.queued" as const, data: { eventId: row.event_id } }));
      if (events.length) await inngest.send(events);
      return { queued: events.length, recoveredPurchases };
    }),
  ),
  inngest.createFunction(
    { id: "recover-generation-credit-reservations", retries: 2, triggers: [{ cron: "*/20 * * * *" }] },
    async ({ step }) => step.run("release-stale-generation-credits", async () => {
      const { data, error } = await createSupabaseAdminClient().rpc("release_stale_generation_credit_reservations", { p_user_id: null });
      if (error) throw new Error(error.message);
      return { released: Number(data ?? 0) };
    }),
  ),
];
