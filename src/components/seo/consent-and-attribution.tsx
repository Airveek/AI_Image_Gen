"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const CONSENT_COOKIE = "airveek_analytics_consent";
const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "G-2FZ4GPQLP";

export function ConsentAndAttribution() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);

  useEffect(() => {
    const consent = readCookie(CONSENT_COOKIE);
    if (consent === "granted" || consent === "denied") queueMicrotask(() => setConsent(consent));
    // The initial state is hidden for SSR; reveal the banner after hydration when needed.
    if (!consent) queueMicrotask(() => setVisible(true));
    if (consent === "granted") void syncAttribution("granted");
  }, []);

  function decide(value: "granted" | "denied") {
    document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    setConsent(value);
    setVisible(false);
    void syncAttribution(value);
  }

  return <>
    {consent === "granted" ? <GoogleAnalyticsTag /> : null}
    {visible ? <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-[#83ff00]/30 bg-[#071007]/95 p-5 text-sm text-[#d9ffb8] shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between" role="dialog" aria-label="Analytics preferences"><p className="max-w-xl leading-6">Airveek uses optional analytics to understand which guides help people create and buy. Essential cookies work without this choice.</p><div className="flex shrink-0 gap-2"><button className="rounded-full border border-white/20 px-4 py-2 font-bold text-[#b8c5b2] hover:border-white/50" onClick={() => decide("denied")} type="button">Decline</button><button className="rounded-full bg-[#83ff00] px-4 py-2 font-black text-[#040404] hover:bg-[#b8ff6b]" onClick={() => decide("granted")} type="button">Allow analytics</button></div></aside> : null}
  </>;
}

function GoogleAnalyticsTag() {
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

function readCookie(name: string): string | null {
  return document.cookie.split("; ").find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

async function syncAttribution(consent: "granted" | "denied") {
  try {
    await fetch("/api/seo/attribution", { method: "POST", headers: { "content-type": "application/json", "x-airveek-analytics-consent": consent }, body: JSON.stringify({ currentUrl: window.location.href, referrer: document.referrer || null }), keepalive: true });
  } catch {
    // Attribution is optional; a blocked analytics request must not affect page use.
  }
}
