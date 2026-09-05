import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFunnelEventName, isSanitizedFunnelProperties, isUuid } from "@/lib/analytics/meta";
import { readAnalyticsConsent, recordServerFunnelEvent } from "@/lib/analytics/meta-server";

const PRIVATE_HEADERS = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (request.headers.get("x-airveek-analytics-consent") !== "granted" || !readAnalyticsConsent(cookieHeader)) {
    return NextResponse.json({ ok: true, skipped: "consent" }, { headers: PRIVATE_HEADERS });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid event." }, { status: 400, headers: PRIVATE_HEADERS }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid event." }, { status: 400, headers: PRIVATE_HEADERS });
  const record = body as Record<string, unknown>;
  if (!isFunnelEventName(record.eventName) || !isUuid(record.eventId)) return NextResponse.json({ error: "Invalid event." }, { status: 400, headers: PRIVATE_HEADERS });
  const properties = record.properties ?? {};
  if (!isSanitizedFunnelProperties(properties)) return NextResponse.json({ error: "Invalid event properties." }, { status: 400, headers: PRIVATE_HEADERS });
  const sourceUrl = readSameOriginUrl(record.sourceUrl, request.url);
  if (!sourceUrl) return NextResponse.json({ error: "Invalid source URL." }, { status: 400, headers: PRIVATE_HEADERS });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  await recordServerFunnelEvent({
    eventName: record.eventName,
    eventId: record.eventId,
    sourceUrl,
    properties,
    userId: user?.id,
    email: user?.email,
    request,
    consentGranted: true,
  });
  return NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
}

function readSameOriginUrl(value: unknown, requestUrl: string): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const source = new URL(value);
    const requestOrigin = new URL(requestUrl).origin;
    return source.origin === requestOrigin ? source.toString() : null;
  } catch { return null; }
}
