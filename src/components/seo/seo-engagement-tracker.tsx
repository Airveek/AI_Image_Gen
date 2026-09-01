"use client";

import { useEffect } from "react";

import type { SeoAnalyticsEventName, SeoAnalyticsEventProperties } from "@/features/seo/types";

export function SeoEngagementTracker({ properties }: { properties: SeoAnalyticsEventProperties }) {
  useEffect(() => {
    const sendPageView = () => {
      if (!document.cookie.split("; ").some((entry) => entry.startsWith("airveek_analytics_consent=granted"))) return;
      void fetch("/api/seo/event", {
        method: "POST",
        headers: { "content-type": "application/json", "x-airveek-analytics-consent": "granted" },
        body: JSON.stringify({ eventName: "seo_page_view" satisfies SeoAnalyticsEventName, properties }),
        keepalive: true,
      }).catch(() => undefined);
    };
    sendPageView();
    window.addEventListener("airveek:analytics-consent", sendPageView);
    return () => window.removeEventListener("airveek:analytics-consent", sendPageView);
  }, [properties]);

  return null;
}
