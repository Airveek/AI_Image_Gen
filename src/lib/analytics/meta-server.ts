import "server-only";

import { inngest } from "@/features/store-images/server/inngest-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSeoAttributionSigningSecret,
  hashSeoAnonymousId,
  parseSeoAttributionCookie,
  SEO_ATTRIBUTION_COOKIE_NAME,
} from "@/lib/analytics/seo-attribution";
import {
  isMetaCapiEventName,
  sanitizeFunnelProperties,
  type FunnelEventName,
  type FunnelEventProperties,
} from "@/lib/analytics/meta";
import { normalizeAndHashMetaIdentifier } from "@/lib/analytics/meta-matching";

export type MetaUserData = {
  em?: string[];
  external_id?: string[];
  fbp?: string;
  fbc?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

export type AttributionSnapshot = {
  anonymousIdHash: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  fbclid: string | null;
};

export async function recordServerFunnelEvent(input: {
  eventName: FunnelEventName;
  eventId: string;
  sourceUrl: string;
  properties?: FunnelEventProperties;
  userId?: string | null;
  email?: string | null;
  request?: Request;
  cookieHeader?: string | null;
  userAgent?: string | null;
  clientIp?: string | null;
  consentGranted: boolean;
  userDataOverride?: MetaUserData;
  attributionOverride?: AttributionSnapshot;
  occurredAt?: string;
}): Promise<void> {
  if (!input.consentGranted) return;
  const cookieHeader = input.cookieHeader ?? input.request?.headers.get("cookie") ?? null;
  const attribution = input.attributionOverride ?? readAttributionSnapshot(cookieHeader);
  const properties = sanitizeFunnelProperties(input.properties);
  const occurredAt = input.occurredAt && Number.isFinite(Date.parse(input.occurredAt)) ? new Date(input.occurredAt).toISOString() : new Date().toISOString();
  const client = createSupabaseAdminClient();
  const { error: eventError } = await client.from("funnel_events").insert({
    event_id: input.eventId,
    event_name: input.eventName,
    user_id: input.userId ?? null,
    anonymous_id_hash: attribution.anonymousIdHash,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    properties,
    occurred_at: occurredAt,
  });
  if (eventError && eventError.code !== "23505") {
    console.warn("[funnel-analytics] event write skipped", { code: eventError.code, eventName: input.eventName });
  }
  if (!isMetaCapiEventName(input.eventName)) return;

  const userData = input.userDataOverride ?? buildMetaUserData({
    userId: input.userId,
    email: input.email,
    cookieHeader,
    userAgent: input.userAgent ?? input.request?.headers.get("user-agent"),
    clientIp: input.clientIp ?? readClientIp(input.request),
    fbclid: attribution.fbclid,
  });
  const { error: outboxError } = await client.from("meta_event_outbox").insert({
    event_id: input.eventId,
    event_name: input.eventName,
    occurred_at: occurredAt,
    user_id: input.userId ?? null,
    anonymous_id_hash: attribution.anonymousIdHash,
    source_url: readSourceUrl(input.sourceUrl),
    user_data: userData,
    custom_data: properties,
  });
  if (outboxError && outboxError.code !== "23505") {
    console.warn("[meta-capi] queue write skipped", { code: outboxError.code, eventName: input.eventName });
    return;
  }
  if (!outboxError) {
    await inngest.send({ name: "analytics/meta.event.queued", data: { eventId: input.eventId } }).catch(() => undefined);
  }
}

export async function recordVerifiedCheckoutPurchase(input: {
  provider: "stripe" | "whop";
  checkoutAttemptId?: string | null;
  providerCheckoutId?: string | null;
  providerReference: string;
  userId?: string | null;
  amount: number;
  currency: string;
  occurredAt: string;
}): Promise<boolean> {
  const client = createSupabaseAdminClient();
  let query = client.from("billing_checkout_attempts").select("*").eq("provider", input.provider);
  if (input.checkoutAttemptId && /^[0-9a-f-]{36}$/i.test(input.checkoutAttemptId)) query = query.eq("id", input.checkoutAttemptId);
  else if (input.providerCheckoutId) query = query.eq("provider_checkout_id", input.providerCheckoutId);
  else return false;
  if (input.userId) query = query.eq("user_id", input.userId);
  const { data: attempt, error } = await query.maybeSingle();
  if (error || !attempt) return false;
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || currency !== attempt.currency) {
    throw new Error("Verified checkout currency does not match its immutable snapshot.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0 || !Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("Verified checkout payment facts are invalid.");
  }
  if (attempt.purchase_provider_reference && attempt.purchase_provider_reference !== input.providerReference) return false;
  let verified = attempt;
  if (!attempt.verified_payment_at) {
    const { data: updated, error: updateError } = await client.from("billing_checkout_attempts").update({
      purchase_provider_reference: input.providerReference,
      verified_payment_at: new Date(input.occurredAt).toISOString(),
      verified_amount_cents: Math.round(input.amount * 100),
      verified_currency: currency,
      updated_at: new Date().toISOString(),
    }).eq("id", attempt.id).is("verified_payment_at", null).select("*").maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") return false;
      throw new Error(`Could not save verified checkout payment: ${updateError.message}`);
    }
    if (updated) verified = updated;
    else {
      const replay = await client.from("billing_checkout_attempts").select("*").eq("id", attempt.id).single();
      if (!replay.data) return false;
      verified = replay.data;
    }
  }
  return finalizeVerifiedCheckoutAttempt(verified);
}

export async function recoverVerifiedPurchaseTracking(limit = 50): Promise<number> {
  const client = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: checkoutRows, error: checkoutError } = await client.from("billing_checkout_attempts")
    .select("*")
    .eq("marketing_consent", true)
    .not("purchase_url", "is", null)
    .gte("created_at", cutoff)
    .order("created_at")
    .limit(Math.max(1, Math.min(100, limit)));
  if (checkoutError) throw new Error(checkoutError.message);
  let recovered = 0;
  for (const row of checkoutRows ?? []) {
    const eventId = String(row.initiate_checkout_event_id);
    const { data: existing } = await client.from("meta_event_outbox").select("event_id").eq("event_id", eventId).maybeSingle();
    if (existing) continue;
    await recordServerFunnelEvent({
      eventName: "InitiateCheckout",
      eventId,
      sourceUrl: purchaseSourceUrl(),
      properties: {
        plan_key: row.plan_key === "premium" ? "premium" : "commercial",
        billing_mode: row.billing_mode === "subscription" ? "subscription" : "one_time",
        content_name: `Airveek ${row.plan_key === "premium" ? "Premium" : "Commercial"}`,
        content_category: "paid_access",
        value: Math.max(0, Number(row.amount_cents ?? 0) / 100),
        currency: row.currency === "USD" ? "USD" : undefined,
      },
      userId: typeof row.user_id === "string" ? row.user_id : null,
      consentGranted: true,
      userDataOverride: readStoredMetaUserData(row.meta_user_data),
      attributionOverride: readStoredAttribution(row.attribution),
      occurredAt: typeof row.created_at === "string" ? row.created_at : undefined,
    });
    const { data: queued } = await client.from("meta_event_outbox").select("event_id").eq("event_id", eventId).maybeSingle();
    if (queued) recovered += 1;
  }
  const { data, error } = await client.from("billing_checkout_attempts")
    .select("*")
    .not("verified_payment_at", "is", null)
    .gte("verified_payment_at", cutoff)
    .order("verified_payment_at")
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    if (!row.purchased_at && await finalizeVerifiedCheckoutAttempt(row)) recovered += 1;
    const eventId = String(row.purchase_event_id);
    const { data: existing } = await client.from("meta_event_outbox").select("event_id").eq("event_id", eventId).maybeSingle();
    if (row.purchased_at && row.marketing_consent === true && !existing) {
      await recordPurchaseEventForAttempt(row);
      const { data: queued } = await client.from("meta_event_outbox").select("event_id").eq("event_id", eventId).maybeSingle();
      if (queued) recovered += 1;
    }
    if (row.purchased_at) await clearCheckoutMatchingDataWhenQueued(String(row.id), eventId, row.marketing_consent === true);
  }
  return recovered;
}

async function finalizeVerifiedCheckoutAttempt(attempt: Record<string, unknown>): Promise<boolean> {
  if (attempt.purchased_at || typeof attempt.verified_payment_at !== "string") return false;
  const client = createSupabaseAdminClient();
  const { count, error: entitlementError } = await client.from("billing_entitlements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", attempt.user_id)
    .eq("provider", attempt.provider)
    .eq("plan_key", attempt.plan_key)
    .eq("billing_mode", attempt.billing_mode)
    .eq("has_access", true);
  if (entitlementError) throw new Error(`Could not verify paid access: ${entitlementError.message}`);
  if (!count) return false;
  const { data: purchased, error } = await client.from("billing_checkout_attempts").update({
    purchased_at: attempt.verified_payment_at,
    updated_at: new Date().toISOString(),
  }).eq("id", attempt.id).is("purchased_at", null).select("*").maybeSingle();
  if (error) throw new Error(`Could not finalize verified checkout: ${error.message}`);
  if (!purchased) return false;
  await recordPurchaseEventForAttempt(purchased);
  await clearCheckoutMatchingDataWhenQueued(String(purchased.id), String(purchased.purchase_event_id), purchased.marketing_consent === true);
  return true;
}

async function recordPurchaseEventForAttempt(attempt: Record<string, unknown>): Promise<void> {
  await recordServerFunnelEvent({
    eventName: "Purchase",
    eventId: String(attempt.purchase_event_id),
    sourceUrl: purchaseSourceUrl(),
    properties: {
      plan_key: attempt.plan_key === "premium" ? "premium" : "commercial",
      billing_mode: attempt.billing_mode === "subscription" ? "subscription" : "one_time",
      content_name: `Airveek ${attempt.plan_key === "premium" ? "Premium" : "Commercial"}`,
      content_category: "paid_access",
      value: Math.max(0, Number(attempt.verified_amount_cents ?? attempt.amount_cents ?? 0) / 100),
      currency: attempt.verified_currency === "USD" || attempt.currency === "USD" ? "USD" : undefined,
    },
    userId: typeof attempt.user_id === "string" ? attempt.user_id : null,
    consentGranted: attempt.marketing_consent === true,
    userDataOverride: readStoredMetaUserData(attempt.meta_user_data),
    attributionOverride: readStoredAttribution(attempt.attribution),
    occurredAt: typeof attempt.verified_payment_at === "string" ? attempt.verified_payment_at : undefined,
  });
}

export function buildMetaUserData(input: {
  userId?: string | null;
  email?: string | null;
  cookieHeader?: string | null;
  userAgent?: string | null;
  clientIp?: string | null;
  fbclid?: string | null;
}): MetaUserData {
  const cookies = parseCookies(input.cookieHeader);
  const data: MetaUserData = {};
  const email = input.email?.trim().toLowerCase();
  const hashedEmail = normalizeAndHashMetaIdentifier(email);
  const hashedExternalId = normalizeAndHashMetaIdentifier(input.userId);
  if (hashedEmail) data.em = [hashedEmail];
  if (hashedExternalId) data.external_id = [hashedExternalId];
  if (isFbp(cookies._fbp)) data.fbp = cookies._fbp;
  const fbc = isFbc(cookies._fbc) ? cookies._fbc : buildFbc(input.fbclid ?? cookies.airveek_fbclid);
  if (fbc) data.fbc = fbc;
  if (input.clientIp?.trim()) data.client_ip_address = input.clientIp.trim().slice(0, 64);
  if (input.userAgent?.trim()) data.client_user_agent = input.userAgent.trim().slice(0, 500);
  return data;
}

export function readAttributionSnapshot(cookieHeader: string | null | undefined): AttributionSnapshot {
  const cookies = parseCookies(cookieHeader);
  const secret = getSeoAttributionSigningSecret();
  const attribution = secret && cookies[SEO_ATTRIBUTION_COOKIE_NAME]
    ? parseSeoAttributionCookie(cookies[SEO_ATTRIBUTION_COOKIE_NAME], secret)
    : null;
  const touch = attribution?.lastNonDirectTouch ?? attribution?.firstTouch ?? null;
  return {
    anonymousIdHash: attribution && secret ? hashSeoAnonymousId(attribution.anonymousId, secret) : null,
    source: touch?.source ?? null,
    medium: touch?.medium ?? null,
    campaign: touch?.campaign ?? null,
    content: touch?.utmContent ?? touch?.contentId ?? null,
    term: touch?.utmTerm ?? null,
    fbclid: touch?.fbclid ?? null,
  };
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator <= 0) return [];
    const key = part.slice(0, separator).trim();
    const raw = part.slice(separator + 1).trim();
    try { return [[key, decodeURIComponent(raw)]]; } catch { return [[key, raw]]; }
  }));
}

export function readAnalyticsConsent(cookieHeader: string | null | undefined): boolean {
  return parseCookies(cookieHeader).airveek_analytics_consent === "granted";
}

function isFbp(value: string | undefined): value is string { return Boolean(value && /^fb\.1\.\d{10,16}\.[A-Za-z0-9]+$/.test(value)); }
function isFbc(value: string | undefined): value is string { return Boolean(value && /^fb\.1\.\d{10,16}\.[A-Za-z0-9_-]+$/.test(value)); }
function buildFbc(fbclid: string | undefined): string | undefined {
  return fbclid && /^[A-Za-z0-9_-]{8,300}$/.test(fbclid) ? `fb.1.${Date.now()}.${fbclid}` : undefined;
}
function readClientIp(request?: Request): string | null {
  if (!request) return null;
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || null;
}
function readSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString().slice(0, 2000) : "https://airveek.com/";
  } catch { return "https://airveek.com/"; }
}

function readStoredAttribution(value: unknown): AttributionSnapshot {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof row[key] === "string" ? row[key] as string : null;
  return { anonymousIdHash: text("anonymousIdHash"), source: text("source"), medium: text("medium"), campaign: text("campaign"), content: text("content"), term: text("term"), fbclid: text("fbclid") };
}

function readStoredMetaUserData(value: unknown): MetaUserData {
  return value && typeof value === "object" && !Array.isArray(value) ? value as MetaUserData : {};
}

async function clearCheckoutMatchingDataWhenQueued(attemptId: string, eventId: string, consentGranted: boolean): Promise<void> {
  const client = createSupabaseAdminClient();
  if (consentGranted) {
    const { data } = await client.from("meta_event_outbox").select("event_id").eq("event_id", eventId).maybeSingle();
    if (!data) return;
  }
  await client.from("billing_checkout_attempts").update({ meta_user_data: {}, updated_at: new Date().toISOString() }).eq("id", attemptId);
}

function purchaseSourceUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://airveek.com";
  try { return new URL("/checkout/complete", base).toString(); } catch { return "https://airveek.com/checkout/complete"; }
}
