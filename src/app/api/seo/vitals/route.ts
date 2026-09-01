import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getSeoAttributionSigningSecret, hashSeoAnonymousId, parseSeoAttributionCookie, SEO_ATTRIBUTION_COOKIE_NAME } from "@/lib/analytics/seo-attribution";
import { coreWebVitalRating, type CoreWebVitalName } from "@/lib/seo/performance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METRICS = new Set<CoreWebVitalName>(["lcp", "inp", "cls"]);
const NAVIGATION_TYPES = new Set(["navigate", "reload", "back_forward", "prerender", "unknown"]);
const PRIVATE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
};

export async function POST(request: Request) {
  if (request.headers.get("x-airveek-analytics-consent") !== "granted") return new NextResponse(null, { status: 204, headers: PRIVATE_HEADERS });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return response({ ok: false, error: "invalid_json" }, 400);
  }
  if (!isRecord(payload)) return response({ ok: false, error: "invalid_payload" }, 400);

  const metric = typeof payload.metric === "string" && METRICS.has(payload.metric as CoreWebVitalName) ? payload.metric as CoreWebVitalName : null;
  const value = typeof payload.value === "number" ? payload.value : Number(payload.value);
  const eventId = typeof payload.eventId === "string" && isUuid(payload.eventId) ? payload.eventId : randomUUID();
  const pagePath = readPagePath(payload.pagePath, request.url);
  const pageId = typeof payload.pageId === "string" && isUuid(payload.pageId) ? payload.pageId : null;
  const navigationType = typeof payload.navigationType === "string" && NAVIGATION_TYPES.has(payload.navigationType) ? payload.navigationType : "unknown";
  if (!metric || !Number.isFinite(value) || value < 0 || value > (metric === "cls" ? 10 : 60_000) || !pagePath) {
    return response({ ok: false, error: "invalid_metric" }, 400);
  }

  const rating = coreWebVitalRating(metric, value);
  const cookieValue = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SEO_ATTRIBUTION_COOKIE_NAME}=([^;]*)`))?.[1] ?? null;
  const secret = getSeoAttributionSigningSecret();
  const attribution = cookieValue && secret ? parseSeoAttributionCookie(cookieValue, secret) : null;
  const anonymousIdHash = attribution && secret ? hashSeoAnonymousId(attribution.anonymousId, secret) : null;

  const { error } = await createSupabaseAdminClient().from("seo_web_vitals").upsert({
    event_key: eventId,
    anonymous_id_hash: anonymousIdHash,
    page_id: pageId,
    page_path: pagePath,
    metric_name: metric,
    value,
    rating,
    navigation_type: navigationType,
    occurred_at: new Date().toISOString(),
  }, { onConflict: "event_key", ignoreDuplicates: true });
  if (error) return response({ ok: false, error: "vital_recording_unavailable" }, 202);
  return response({ ok: true }, 202);
}

function readPagePath(value: unknown, requestUrl: string): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const candidate = new URL(value, requestUrl);
    const requestOrigin = new URL(requestUrl).origin;
    if (candidate.origin !== requestOrigin || candidate.search || candidate.hash || !candidate.pathname.startsWith("/")) return null;
    return candidate.pathname;
  } catch {
    return null;
  }
}

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, { status, headers: PRIVATE_HEADERS });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
