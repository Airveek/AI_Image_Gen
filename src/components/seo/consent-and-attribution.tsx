"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/next";

import { CoreWebVitalsReporter } from "@/components/seo/core-web-vitals-reporter";
import { trackGa4Event } from "@/lib/analytics/browser";
import { ensureMetaPixel, trackFunnelEvent } from "@/lib/analytics/meta-browser";

const CONSENT_COOKIE = "airveek_analytics_consent";
// Never emit a guessed or malformed measurement ID. The public env value is
// injected at build time; when it is absent, analytics stays disabled rather
// than sending data to an unintended GA4 property.
const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim() || null;
const META_PIXEL_ID = /^\d{6,30}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "")
  ? process.env.NEXT_PUBLIC_META_PIXEL_ID!.trim()
  : null;

export function ConsentAndAttribution() {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const lastMetaPathname = useRef<string | null>(null);
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  const privateRoute = isPrivateRoute(pathname);
  const analyticsExcludedRoute = isAnalyticsExcludedRoute(pathname);

  useEffect(() => {
    document.cookie = `${CONSENT_COOKIE}=granted; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    if (!analyticsExcludedRoute && pathname && META_PIXEL_ID) {
      ensureMetaPixel(META_PIXEL_ID);
      lastMetaPathname.current = pathname;
      trackFunnelEvent("PageView", { content_name: document.title });
    }
    queueMicrotask(() => setConsent("granted"));
    window.dispatchEvent(new Event("airveek:analytics-consent"));
    if (!privateRoute) void syncAttribution("granted");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privateRoute]);

  // The GA4 config tag records the initial document view. Next navigation is
  // client-side, so record subsequent public route changes explicitly; this
  // keeps landing-page and engagement reports complete without double-counting
  // the first view.
  useEffect(() => {
    const previous = previousPathname.current;
    previousPathname.current = pathname;
    if (!previous || previous === pathname || consent !== "granted" || analyticsExcludedRoute || !pathname) return;
    trackGa4Event("page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, consent, analyticsExcludedRoute]);

  useEffect(() => {
    if (consent !== "granted" || analyticsExcludedRoute || !pathname || !META_PIXEL_ID) return;
    if (lastMetaPathname.current === pathname) return;
    lastMetaPathname.current = pathname;
    ensureMetaPixel(META_PIXEL_ID);
    trackFunnelEvent("PageView", { content_name: document.title });
  }, [pathname, consent, analyticsExcludedRoute]);

  return <>
    {consent === "granted" && !analyticsExcludedRoute ? <GoogleAnalyticsTag /> : null}
    {consent === "granted" && !analyticsExcludedRoute ? <Analytics /> : null}
    {consent === "granted" && !analyticsExcludedRoute && META_PIXEL_ID ? <Script id="airveek-meta-pixel" async src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" /> : null}
    {consent === "granted" && !privateRoute ? <CoreWebVitalsReporter /> : null}
  </>;
}

function isPrivateRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return ["/admin", "/api", "/auth", "/checkout", "/create", "/dashboard", "/library", "/login", "/preview", "/register", "/store-images"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Exclude surfaces that can contain operational, callback, or user-specific
// data and are not acquisition steps.
function isAnalyticsExcludedRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  return ["/admin", "/api", "/auth", "/dashboard", "/library", "/login", "/preview", "/store-images"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function GoogleAnalyticsTag() {
  if (!GA4_MEASUREMENT_ID) return null;
  return <>
    <Script id="airveek-gtag-init" strategy="afterInteractive">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_MEASUREMENT_ID}');`}
    </Script>
    <Script id="airveek-gtag" async src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`} strategy="afterInteractive" />
  </>;
}

async function syncAttribution(consent: "granted" | "denied") {
  try {
    await fetch("/api/seo/attribution", { method: "POST", headers: { "content-type": "application/json", "x-airveek-analytics-consent": consent }, body: JSON.stringify({ currentUrl: window.location.href, referrer: document.referrer || null }), keepalive: true });
  } catch {
    // Attribution is optional; a blocked analytics request must not affect page use.
  }
}
