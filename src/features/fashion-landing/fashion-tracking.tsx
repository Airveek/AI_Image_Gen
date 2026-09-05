"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { hasAnalyticsConsent, trackFunnelEvent } from "@/lib/analytics/meta-browser";

export function FashionViewTracker() {
  const tracked = useRef(false);
  useEffect(() => {
    const track = () => {
      if (tracked.current || !hasAnalyticsConsent()) return;
      tracked.current = true;
      trackFunnelEvent("ViewContent", { content_name: "AI Fashion Photoshoot", content_category: "fashion_ecommerce" });
    };
    track();
    window.addEventListener("airveek:analytics-consent", track);
    return () => window.removeEventListener("airveek:analytics-consent", track);
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
