"use client";

import { useEffect } from "react";

import { hasAnalyticsConsent } from "@/lib/analytics/browser";
import { coreWebVitalRating, type CoreWebVitalName } from "@/lib/seo/performance";

type CoreWebVitalsReporterProps = {
  pageId?: string;
};

/**
 * Collects the three Core Web Vitals locally and sends only aggregate-safe
 * samples after optional analytics consent. No URL query, user ID, or user
 * agent is persisted by the endpoint.
 */
export function CoreWebVitalsReporter({ pageId }: CoreWebVitalsReporterProps) {
  useEffect(() => {
    let stop: (() => void) | null = null;
    const start = () => {
      stop?.();
      stop = hasAnalyticsConsent() ? observeVitals(pageId) : null;
    };
    start();
    window.addEventListener("airveek:analytics-consent", start);
    return () => {
      window.removeEventListener("airveek:analytics-consent", start);
      stop?.();
    };
  }, [pageId]);

  return null;
}

function observeVitals(pageId?: string): () => void {
  const values: Partial<Record<CoreWebVitalName, number>> = {};
  const sent = new Set<CoreWebVitalName>();
  const observers: PerformanceObserver[] = [];

  const observe = (type: string, callback: (entries: PerformanceEntryList) => void, options?: PerformanceObserverInit) => {
    if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true, ...options });
      observers.push(observer);
    } catch {
      // Unsupported browsers simply contribute no sample.
    }
  };

  observe("largest-contentful-paint", (entries) => {
    const last = entries.at(-1);
    if (last) values.lcp = last.startTime;
  });
  observe("layout-shift", (entries) => {
    values.cls = (values.cls ?? 0) + entries.reduce((sum, entry) => {
      const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
      return sum + (shift.hadRecentInput ? 0 : Number(shift.value ?? 0));
    }, 0);
  });
  observe("event", (entries) => {
    const maxDuration = entries.reduce((max, entry) => Math.max(max, entry.duration), values.inp ?? 0);
    if (maxDuration > 0) values.inp = maxDuration;
  }, { durationThreshold: 16 } as unknown as PerformanceObserverInit);

  const flush = () => {
    for (const name of ["lcp", "inp", "cls"] as const) {
      const value = values[name];
      if (sent.has(name) || value === undefined || !Number.isFinite(value) || value < 0) continue;
      sent.add(name);
      void sendVital({ name, value, pageId });
    }
  };
  const timeout = window.setTimeout(flush, 10_000);
  document.addEventListener("visibilitychange", flush, { once: true });

  return () => {
    window.clearTimeout(timeout);
    document.removeEventListener("visibilitychange", flush);
    observers.forEach((observer) => observer.disconnect());
  };
}

async function sendVital(input: { name: CoreWebVitalName; value: number; pageId?: string }) {
  try {
    await fetch("/api/seo/vitals", {
      method: "POST",
      headers: { "content-type": "application/json", "x-airveek-analytics-consent": "granted" },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        metric: input.name,
        value: input.value,
        rating: coreWebVitalRating(input.name, input.value),
        pageId: input.pageId ?? null,
        pagePath: window.location.pathname,
        navigationType: performance.getEntriesByType("navigation")[0]?.name ? "navigate" : "unknown",
      }),
      keepalive: true,
    });
  } catch {
    // Measurement must never affect page use.
  }
}
