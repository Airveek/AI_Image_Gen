import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildSeoAnalyticsEvent } from "@/lib/analytics/seo-events";
import { readGaClientIdFromCookie } from "@/lib/analytics/ga-client-id";
import { getSeoAttributionSigningSecret, hashSeoAnonymousId, parseSeoAttributionCookie, SEO_ATTRIBUTION_COOKIE_NAME } from "@/lib/analytics/seo-attribution";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SeoAnalyticsEventName, SeoAnalyticsEventProperties } from "@/features/seo/types";

// Analytics events contain consented, user-associated request data. Keep the
// endpoint dynamic and private even when a caller probes it with an unsupported
// method; otherwise a framework-generated 405 can inherit a public cache
// policy from the deployment layer.
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
};

export function GET() {
  return new NextResponse(null, { status: 405, headers: { ...PRIVATE_HEADERS, allow: "POST" } });
}

export async function POST(request: Request) {
  if (request.headers.get("x-airveek-analytics-consent") !== "granted") return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
  let payload: { eventName?: SeoAnalyticsEventName; properties?: SeoAnalyticsEventProperties };
  try {
    payload = await request.json() as { eventName?: SeoAnalyticsEventName; properties?: SeoAnalyticsEventProperties };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: PRIVATE_HEADERS });
  }
  if (!payload.eventName || !payload.properties) return NextResponse.json({ ok: false }, { status: 400, headers: PRIVATE_HEADERS });
  const event = buildSeoAnalyticsEvent({ eventName: payload.eventName, properties: payload.properties });
  if (!event) return NextResponse.json({ ok: false }, { status: 400, headers: PRIVATE_HEADERS });

  const cookieHeader = request.headers.get("cookie");
  const cookieValue = cookieHeader?.match(new RegExp(`(?:^|; )${SEO_ATTRIBUTION_COOKIE_NAME}=([^;]*)`))?.[1] ?? null;
  const signingSecret = getSeoAttributionSigningSecret();
  const attribution = cookieValue && signingSecret ? parseSeoAttributionCookie(cookieValue, signingSecret) : null;
  // The signed acquisition ID is preferred. During the first consented page
  // view, attribution and the event request can race; reusing GA4's own
  // first-party client ID prevents that short race from fragmenting a visit.
  const clientId = attribution?.anonymousId ?? readGaClientIdFromCookie(cookieHeader) ?? randomUUID();
  try {
    await createSupabaseAdminClient().from("seo_events").insert({
      event_key: randomUUID(),
      event_name: event.eventName,
      anonymous_id_hash: attribution && signingSecret ? hashSeoAnonymousId(attribution.anonymousId, signingSecret) : null,
      page_id: event.properties.pageId ?? null,
      content_id: event.properties.contentId,
      properties: event.properties,
      consent_state: "granted",
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Analytics delivery remains best-effort if the optional event table is unavailable.
  }

  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET?.trim();
  if (!measurementId || !apiSecret) return NextResponse.json({ ok: true, delivered: false, recorded: true }, { status: 202, headers: PRIVATE_HEADERS });

  try {
    const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, events: [{ name: event.eventName, params: event.properties }] }),
      signal: AbortSignal.timeout(5_000),
    });
    return NextResponse.json({ ok: response.ok, delivered: response.ok }, { status: response.ok ? 202 : 502, headers: PRIVATE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, delivered: false }, { status: 202, headers: PRIVATE_HEADERS });
  }
}
