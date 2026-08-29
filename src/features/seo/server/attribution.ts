import "server-only";

import { createHash } from "node:crypto";

import type { SeoAttributionCookie, SeoTouch } from "@/features/seo/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSeoAttributionSigningSecret, hashSeoAnonymousId } from "@/lib/analytics/seo-attribution";

export type SeoAttributionWriteResult =
  | { ok: true; anonymousIdHash: string }
  | { ok: false; reason: "not_configured" | "invalid_input" | "schema_unavailable" };

export async function recordSeoTouchpoint(input: {
  attribution: SeoAttributionCookie;
  touch: SeoTouch;
}): Promise<SeoAttributionWriteResult> {
  const secret = getSeoAttributionSigningSecret();
  if (!secret) return { ok: false, reason: "not_configured" };
  const anonymousIdHash = hashSeoAnonymousId(input.attribution.anonymousId, secret);
  if (!anonymousIdHash || !isUuid(input.touch.id)) return { ok: false, reason: "invalid_input" };

  try {
    const client = createSupabaseAdminClient();
    const pageId = await resolveSeoPageId(input.touch.landingPath);
    const { error } = await client.from("seo_touchpoints").upsert(
      touchpointPayload(input.touch, anonymousIdHash, pageId),
      { onConflict: "event_key", ignoreDuplicates: true },
    );
    if (error) {
      console.warn("[seo-attribution] touchpoint write skipped", { code: error.code });
      return { ok: false, reason: "schema_unavailable" };
    }
    return { ok: true, anonymousIdHash };
  } catch (error) {
    console.warn("[seo-attribution] touchpoint write skipped", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "schema_unavailable" };
  }
}

export async function linkSeoAttributionToUser(input: {
  userId: string;
  attribution: SeoAttributionCookie;
}): Promise<SeoAttributionWriteResult> {
  if (!isUuid(input.userId)) return { ok: false, reason: "invalid_input" };
  const secret = getSeoAttributionSigningSecret();
  if (!secret) return { ok: false, reason: "not_configured" };
  const anonymousIdHash = hashSeoAnonymousId(input.attribution.anonymousId, secret);
  if (!anonymousIdHash) return { ok: false, reason: "invalid_input" };

  try {
    const client = createSupabaseAdminClient();
    const touches = uniqueTouches([
      input.attribution.firstTouch,
      input.attribution.lastNonDirectTouch,
    ]);

    for (const touch of touches) {
      const pageId = await resolveSeoPageId(touch.landingPath);
      const { error } = await client.from("seo_touchpoints").upsert(
        touchpointPayload(touch, anonymousIdHash, pageId),
        { onConflict: "event_key", ignoreDuplicates: true },
      );
      if (error) {
        console.warn("[seo-attribution] journey write skipped", { code: error.code });
        return { ok: false, reason: "schema_unavailable" };
      }
    }

    const eventKeys = touches.map((touch) => touchEventKey(anonymousIdHash, touch));
    const { data: storedTouches, error: lookupError } = await client
      .from("seo_touchpoints")
      .select("id,event_key")
      .in("event_key", eventKeys);
    if (lookupError) return { ok: false, reason: "schema_unavailable" };

    const touchIds = new Map((storedTouches ?? []).map((row) => [String(row.event_key), String(row.id)]));
    const firstTouchId = touchIds.get(touchEventKey(anonymousIdHash, input.attribution.firstTouch)) ?? null;
    const lastTouch = input.attribution.lastNonDirectTouch;
    const lastTouchId = lastTouch
      ? touchIds.get(touchEventKey(anonymousIdHash, lastTouch)) ?? null
      : null;
    const { error } = await client.from("seo_user_attribution").upsert(
      {
        user_id: input.userId,
        anonymous_id_hash: anonymousIdHash,
        first_touch_id: firstTouchId,
        last_non_direct_touch_id: lastTouchId,
        first_content_id: input.attribution.firstTouch.contentId,
        last_content_id: lastTouch?.contentId ?? input.attribution.firstTouch.contentId,
        source_basis: "journey_linked",
        source_confidence: firstTouchId ? 100 : 80,
        linked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.warn("[seo-attribution] user link skipped", { code: error.code });
      return { ok: false, reason: "schema_unavailable" };
    }

    return { ok: true, anonymousIdHash };
  } catch (error) {
    console.warn("[seo-attribution] user link skipped", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, reason: "schema_unavailable" };
  }
}

function touchpointPayload(touch: SeoTouch, anonymousIdHash: string, pageId: string | null) {
  return {
    id: touch.id,
    event_key: touchEventKey(anonymousIdHash, touch),
    anonymous_id_hash: anonymousIdHash,
    page_id: pageId,
    content_id: touch.contentId,
    landing_path: touch.landingPath,
    source: touch.source,
    medium: touch.medium,
    campaign: touch.campaign,
    referrer_host: touch.referrerHost,
    consent_state: "granted",
    occurred_at: touch.occurredAt,
  };
}

function touchEventKey(anonymousIdHash: string, touch: SeoTouch): string {
  return createHash("sha256")
    .update(`${anonymousIdHash}:${touch.id}:${touch.occurredAt}`)
    .digest("hex");
}

async function resolveSeoPageId(landingPath: string): Promise<string | null> {
  const normalized = landingPath === "/" ? "/" : `${landingPath.replace(/\/+$/, "")}/`;
  const { data, error } = await createSupabaseAdminClient()
    .from("seo_pages")
    .select("id")
    .eq("path", normalized)
    .maybeSingle();
  return error || !data ? null : String(data.id);
}

function uniqueTouches(touches: Array<SeoTouch | null>): SeoTouch[] {
  const result = new Map<string, SeoTouch>();
  for (const touch of touches) {
    if (touch) result.set(touch.id, touch);
  }
  return [...result.values()];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
