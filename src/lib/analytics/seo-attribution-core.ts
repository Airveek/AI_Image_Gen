import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  SeoAttributionCookie,
  SeoAttributionCookieMutation,
  SeoConsentState,
  SeoTouch,
} from "@/features/seo/types";

export const SEO_ATTRIBUTION_COOKIE_NAME = "airveek_acq";

const SEARCH_HOSTS = ["google.com", "bing.com", "duckduckgo.com", "search.yahoo.com", "yandex.com", "baidu.com"];
const AI_REFERRAL_HOSTS = ["chatgpt.com", "perplexity.ai", "copilot.microsoft.com", "gemini.google.com", "claude.ai"];

type BuildSeoAttributionInput = {
  currentUrl: string;
  referrer: string | null;
  consentState: SeoConsentState;
  existingCookieValue: string | null;
  signingSecret: string | null;
  siteHostname: string;
  now?: Date;
};

export function buildSeoAttributionCookieMutation(input: BuildSeoAttributionInput): SeoAttributionCookieMutation {
  if (input.consentState === "denied") return input.existingCookieValue ? { action: "clear" } : { action: "none" };
  if (input.consentState !== "granted" || !isStrongSigningSecret(input.signingSecret)) return { action: "none" };

  const existing = input.existingCookieValue ? parseSeoAttributionCookie(input.existingCookieValue, input.signingSecret) : null;
  const now = input.now ?? new Date();
  const touch = readTouch(input.currentUrl, input.referrer, input.siteHostname, now);
  if (existing && !touch) return { action: "none" };

  const firstTouch = existing?.firstTouch ?? touch ?? directTouch(input.currentUrl, now);
  const lastNonDirectTouch = touch && touch.medium !== "direct" ? touch : existing?.lastNonDirectTouch ?? null;
  const attribution: SeoAttributionCookie = {
    version: 1,
    anonymousId: existing?.anonymousId ?? randomUUID(),
    firstTouch,
    lastNonDirectTouch,
    updatedAt: now.toISOString(),
  };
  return {
    action: "set",
    cookieValue: signSeoAttributionCookie(attribution, input.signingSecret),
    attribution,
    touchToRecord: touch ?? (existing ? null : firstTouch),
  };
}

export function parseSeoAttributionCookie(value: string, signingSecret: string): SeoAttributionCookie | null {
  if (!isStrongSigningSecret(signingSecret) || value.length > 8_000) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const encoded = value.slice(0, separator);
  if (!safeEqual(value.slice(separator + 1), signature(encoded, signingSecret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    return isSeoAttributionCookie(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hashSeoAnonymousId(anonymousId: string, signingSecret: string): string | null {
  if (!isUuid(anonymousId) || !isStrongSigningSecret(signingSecret)) return null;
  return createHmac("sha256", signingSecret).update(`seo-anonymous:${anonymousId}`).digest("hex");
}

function signSeoAttributionCookie(attribution: SeoAttributionCookie, signingSecret: string): string {
  const encoded = Buffer.from(JSON.stringify(attribution), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, signingSecret)}`;
}

function signature(encoded: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(encoded).digest("base64url");
}

function safeEqual(first: string, second: string): boolean {
  const firstBytes = Buffer.from(first);
  const secondBytes = Buffer.from(second);
  return firstBytes.length === secondBytes.length && timingSafeEqual(firstBytes, secondBytes);
}

function readTouch(currentUrl: string, referrer: string | null, siteHostname: string, now: Date): SeoTouch | null {
  let url: URL;
  try { url = new URL(currentUrl); } catch { return null; }
  const sourceParam = sanitize(url.searchParams.get("utm_source"), 120);
  const mediumParam = sanitize(url.searchParams.get("utm_medium"), 120);
  const campaign = sanitize(url.searchParams.get("utm_campaign"), 160);
  const contentId = sanitize(url.searchParams.get("contentId"), 160);
  const referrerHost = readReferrerHost(referrer);
  const externalReferrer = referrerHost && !isSameSite(referrerHost, siteHostname) ? referrerHost : null;
  if (!sourceParam && !mediumParam && !campaign && !externalReferrer) return null;
  const classified = classifyTouch(sourceParam, mediumParam, externalReferrer);
  return { id: randomUUID(), occurredAt: now.toISOString(), landingPath: normalizeLandingPath(url.pathname), source: classified.source, medium: classified.medium, campaign, referrerHost: externalReferrer, contentId };
}

function directTouch(currentUrl: string, now: Date): SeoTouch {
  let path = "/";
  let contentId: string | null = null;
  try {
    const url = new URL(currentUrl);
    path = normalizeLandingPath(url.pathname);
    contentId = sanitize(url.searchParams.get("contentId"), 160);
  } catch { /* malformed URL becomes a direct root visit */ }
  return { id: randomUUID(), occurredAt: now.toISOString(), landingPath: path, source: "direct", medium: "direct", campaign: null, referrerHost: null, contentId };
}

function classifyTouch(sourceParam: string | null, mediumParam: string | null, referrerHost: string | null): { source: string; medium: string } {
  if (sourceParam || mediumParam) return { source: sourceParam ?? "unknown", medium: mediumParam ?? "unknown" };
  if (referrerHost && SEARCH_HOSTS.some((host) => hostMatches(referrerHost, host))) return { source: sourceName(referrerHost), medium: "organic" };
  if (referrerHost && AI_REFERRAL_HOSTS.some((host) => hostMatches(referrerHost, host))) return { source: sourceName(referrerHost), medium: "referral" };
  return referrerHost ? { source: referrerHost, medium: "referral" } : { source: "direct", medium: "direct" };
}

function sourceName(host: string): string {
  if (hostMatches(host, "google.com")) return "google";
  if (hostMatches(host, "bing.com")) return "bing";
  if (hostMatches(host, "duckduckgo.com")) return "duckduckgo";
  if (hostMatches(host, "search.yahoo.com")) return "yahoo";
  if (hostMatches(host, "chatgpt.com")) return "chatgpt";
  if (hostMatches(host, "perplexity.ai")) return "perplexity";
  if (hostMatches(host, "claude.ai")) return "claude";
  if (hostMatches(host, "gemini.google.com")) return "gemini";
  if (hostMatches(host, "copilot.microsoft.com")) return "copilot";
  return host;
}

function readReferrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try { return new URL(referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

function isSameSite(host: string, siteHostname: string): boolean {
  const normalizedSite = siteHostname.toLowerCase().replace(/^www\./, "");
  return host === normalizedSite || host.endsWith(`.${normalizedSite}`);
}

function hostMatches(host: string, expected: string): boolean { return host === expected || host.endsWith(`.${expected}`); }
function normalizeLandingPath(pathname: string): string { const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`; return normalized.slice(0, 500) || "/"; }
function sanitize(value: string | null, maxLength: number): string | null { if (!value) return null; const normalized = value.trim().replace(/[^a-zA-Z0-9 _./:-]/g, "").slice(0, maxLength); return normalized || null; }
function isStrongSigningSecret(value: string | null | undefined): value is string { return typeof value === "string" && value.length >= 32; }

function isSeoAttributionCookie(value: unknown): value is SeoAttributionCookie {
  if (!isRecord(value) || value.version !== 1 || !isUuid(value.anonymousId)) return false;
  return isSeoTouch(value.firstTouch) && (value.lastNonDirectTouch === null || isSeoTouch(value.lastNonDirectTouch)) && isIsoDate(value.updatedAt);
}

function isSeoTouch(value: unknown): value is SeoTouch {
  if (!isRecord(value)) return false;
  return isUuid(value.id) && isIsoDate(value.occurredAt) && typeof value.landingPath === "string" && value.landingPath.startsWith("/") && typeof value.source === "string" && typeof value.medium === "string" && (value.campaign === null || typeof value.campaign === "string") && (value.referrerHost === null || typeof value.referrerHost === "string") && (value.contentId === null || typeof value.contentId === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isIsoDate(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
