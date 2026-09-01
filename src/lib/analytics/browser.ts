"use client";

type Gtag = (command: "event", eventName: string, parameters?: Record<string, string | number | boolean>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

/** Send a consent-gated GA4 event without making analytics a product dependency. */
export function trackGa4Event(eventName: string, parameters: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined" || !hasAnalyticsConsent() || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, parameters);
}

export function hasAnalyticsConsent(): boolean {
  return typeof document !== "undefined"
    && document.cookie.split("; ").some((entry) => entry.startsWith("airveek_analytics_consent=granted"));
}
