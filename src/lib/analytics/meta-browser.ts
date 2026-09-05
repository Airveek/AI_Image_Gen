"use client";

import {
  isMetaCapiEventName,
  sanitizeFunnelProperties,
  type FunnelEventName,
  type FunnelEventProperties,
} from "@/lib/analytics/meta";

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    _airveekMetaInitialized?: boolean;
  }
}

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
};

const STANDARD_EVENTS = new Set(["PageView", "ViewContent", "CompleteRegistration", "InitiateCheckout", "Purchase"]);

export function hasAnalyticsConsent(): boolean {
  return document.cookie.split("; ").some((entry) => entry === "airveek_analytics_consent=granted");
}

export function ensureMetaPixel(pixelId: string): void {
  if (!/^\d{6,30}$/.test(pixelId) || window._airveekMetaInitialized) return;
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as MetaPixelFunction;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;
  }
  window.fbq("init", pixelId);
  window._airveekMetaInitialized = true;
}

export function trackFunnelEvent(
  eventName: FunnelEventName,
  properties: FunnelEventProperties = {},
  eventId = crypto.randomUUID(),
): string {
  if (!hasAnalyticsConsent()) return eventId;
  const sanitized = sanitizeFunnelProperties(properties);
  trackPixelEvent(eventName, eventId, sanitized);
  void fetch("/api/analytics/meta", {
    method: "POST",
    headers: { "content-type": "application/json", "x-airveek-analytics-consent": "granted" },
    body: JSON.stringify({ eventName, eventId, sourceUrl: window.location.href, properties: sanitized }),
    keepalive: true,
  }).catch(() => undefined);
  return eventId;
}

export function trackPixelEvent(eventName: FunnelEventName, eventId: string, properties: FunnelEventProperties = {}): void {
  if (!hasAnalyticsConsent() || typeof window.fbq !== "function") return;
  const command = STANDARD_EVENTS.has(eventName) ? "track" : "trackCustom";
  window.fbq(command, eventName, sanitizeFunnelProperties(properties), { eventID: eventId });
}

export function trackServerMirroredPixelEvent(eventName: FunnelEventName, eventId: string, properties: FunnelEventProperties = {}): void {
  if (isMetaCapiEventName(eventName)) trackPixelEvent(eventName, eventId, properties);
}
