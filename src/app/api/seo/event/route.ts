import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildSeoAnalyticsEvent } from "@/lib/analytics/seo-events";
import { getSeoAttributionSigningSecret, parseSeoAttributionCookie, SEO_ATTRIBUTION_COOKIE_NAME } from "@/lib/analytics/seo-attribution";
import type { SeoAnalyticsEventName, SeoAnalyticsEventProperties } from "@/features/seo/types";

export async function POST(request: Request) {
  if (request.headers.get("x-airveek-analytics-consent") !== "granted") return new NextResponse(null, { status: 204 });
  let payload: { eventName?: SeoAnalyticsEventName; properties?: SeoAnalyticsEventProperties };
  try {
    payload = await request.json() as { eventName?: SeoAnalyticsEventName; properties?: SeoAnalyticsEventProperties };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!payload.eventName || !payload.properties) return NextResponse.json({ ok: false }, { status: 400 });
  const event = buildSeoAnalyticsEvent({ eventName: payload.eventName, properties: payload.properties });
  if (!event) return NextResponse.json({ ok: false }, { status: 400 });

  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  const apiSecret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET?.trim();
  if (!measurementId || !apiSecret) return NextResponse.json({ ok: true, delivered: false }, { status: 202 });

  const cookieValue = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SEO_ATTRIBUTION_COOKIE_NAME}=([^;]*)`))?.[1] ?? null;
  const signingSecret = getSeoAttributionSigningSecret();
  const attribution = cookieValue && signingSecret ? parseSeoAttributionCookie(cookieValue, signingSecret) : null;
  const clientId = attribution?.anonymousId ?? randomUUID();
  try {
    const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, events: [{ name: event.eventName, params: event.properties }] }),
      signal: AbortSignal.timeout(5_000),
    });
    return NextResponse.json({ ok: response.ok, delivered: response.ok }, { status: response.ok ? 202 : 502 });
  } catch {
    return NextResponse.json({ ok: false, delivered: false }, { status: 202 });
  }
}
