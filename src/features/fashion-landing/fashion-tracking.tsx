"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { hasAnalyticsConsent, trackFunnelEvent, trackPixelEvent } from "@/lib/analytics/meta-browser";

const VIEW_CONTENT_PROPERTIES = { content_name: "AI Fashion Photoshoot", content_category: "fashion_ecommerce" } as const;

export function FashionViewTracker() {
  const tracked = useRef(false);
  const eventId = useRef<string | null>(null);
  useEffect(() => {
    const track = () => {
      if (tracked.current || !hasAnalyticsConsent()) return;
      eventId.current ??= crypto.randomUUID();
      tracked.current = true;
      trackFunnelEvent("ViewContent", VIEW_CONTENT_PROPERTIES, eventId.current);
    };
    const retryBrowserCopy = () => {
      if (!tracked.current || !eventId.current || !hasAnalyticsConsent()) return;
      trackPixelEvent("ViewContent", eventId.current, VIEW_CONTENT_PROPERTIES);
    };
    track();
    window.addEventListener("airveek:analytics-consent", track);
    window.addEventListener("airveek:meta-pixel-ready", retryBrowserCopy);
    return () => {
      window.removeEventListener("airveek:analytics-consent", track);
      window.removeEventListener("airveek:meta-pixel-ready", retryBrowserCopy);
    };
  }, []);
  return null;
}

export function FashionCta({ placement, className, children, offerMode }: { placement: string; className: string; children: ReactNode; offerMode?: "one_time" | "subscription" }) {
  return <Link href="/playground/fashion-photoshoot" className={className} onClick={() => {
    trackFunnelEvent("LandingPageCTA", { placement, content_name: "AI Fashion Photoshoot", content_category: "fashion_ecommerce" });
    if (offerMode === "one_time") trackFunnelEvent("LifetimeOfferClick", { placement, plan_key: "commercial", billing_mode: offerMode, value: 49, currency: "USD" });
  }}>{children}</Link>;
}

export function PricingTracker({ mode }: { mode: "one_time" | "subscription" }) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let visible = false;
    const track = () => {
      if (tracked.current || !visible || !hasAnalyticsConsent()) return;
      tracked.current = true;
      trackFunnelEvent("PricingView", { placement: "fashion_landing", plan_key: "commercial", billing_mode: mode, value: 49, currency: "USD" });
      observer.disconnect();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      track();
    }, { threshold: 0.35 });
    observer.observe(node);
    window.addEventListener("airveek:analytics-consent", track);
    return () => {
      observer.disconnect();
      window.removeEventListener("airveek:analytics-consent", track);
    };
  }, [mode]);
  return <div ref={ref} className="sr-only" aria-hidden="true" />;
}
