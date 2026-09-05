import { NextResponse } from "next/server";

import {
  buildSeoAttributionCookieMutation,
  getSeoAttributionSigningSecret,
  seoAttributionCookieOptions,
  SEO_ATTRIBUTION_COOKIE_NAME,
} from "@/lib/analytics/seo-attribution";
import { recordSeoTouchpoint } from "@/features/seo/server/attribution";

export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
};

export async function POST(request: Request) {
  const consentHeader = request.headers.get("x-airveek-analytics-consent");
  const consent = consentHeader === "granted" || consentHeader === "denied" ? consentHeader : "unknown";
  let payload: { currentUrl?: string; referrer?: string | null } = {};
  try {
    payload = await request.json() as { currentUrl?: string; referrer?: string | null };
  } catch {
    // Keep the request useful for clients that cannot send a body.
  }
  const cookieValue = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${SEO_ATTRIBUTION_COOKIE_NAME}=([^;]*)`))?.[1] ?? null;
  const requestUrl = new URL(request.url);
  const currentUrl = readSameSiteUrl(payload.currentUrl, requestUrl) ?? request.url;
  const mutation = buildSeoAttributionCookieMutation({
    currentUrl,
    referrer: readReferrer(payload.referrer) ?? request.headers.get("referer"),
    consentState: consent,
    existingCookieValue: cookieValue,
    signingSecret: getSeoAttributionSigningSecret(),
    siteHostname: requestUrl.hostname,
    fbp: readCookie(request.headers.get("cookie"), "_fbp"),
    fbc: readCookie(request.headers.get("cookie"), "_fbc"),
  });

  const response = NextResponse.json({ ok: true, action: mutation.action }, { status: 200, headers: PRIVATE_HEADERS });
  if (mutation.action === "clear") response.cookies.delete(SEO_ATTRIBUTION_COOKIE_NAME);
  if (mutation.action === "set") {
    response.cookies.set(SEO_ATTRIBUTION_COOKIE_NAME, mutation.cookieValue, seoAttributionCookieOptions());
    if (mutation.touchToRecord) await recordSeoTouchpoint({ attribution: mutation.attribution, touch: mutation.touchToRecord });
  }
  return response;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

function readReferrer(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const candidate = new URL(value);
    return candidate.protocol === "https:" || candidate.protocol === "http:" ? candidate.toString() : null;
  } catch {
    return null;
  }
}

function readSameSiteUrl(value: unknown, requestUrl: URL): string | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const candidate = new URL(value, requestUrl.origin);
    return candidate.origin === requestUrl.origin ? candidate.toString() : null;
  } catch {
    return null;
  }
}
