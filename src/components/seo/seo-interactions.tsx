"use client";

import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";

import type { SeoAnalyticsEventName, SeoAnalyticsEventProperties } from "@/features/seo/types";

export function sendSeoEvent(eventName: SeoAnalyticsEventName, properties: SeoAnalyticsEventProperties) {
  if (!hasAnalyticsConsent()) return;
  void fetch("/api/seo/event", {
    method: "POST",
    headers: { "content-type": "application/json", "x-airveek-analytics-consent": "granted" },
    body: JSON.stringify({ eventName, properties }),
    keepalive: true,
  }).catch(() => undefined);
}

export function SeoTrackedLink({
  href,
  properties,
  targetContentId,
  eventName = "seo_internal_link_clicked",
  children,
  className,
}: {
  href: string;
  properties: SeoAnalyticsEventProperties;
  targetContentId?: string;
  eventName?: SeoAnalyticsEventName;
  children: ReactNode;
  className?: string;
}) {
  function handleClick() {
    sendSeoEvent(eventName, { ...properties, linkTargetContentId: targetContentId });
  }

  return <Link className={className} href={href} onClick={handleClick}>{children}</Link>;
}

export function SeoTrackedGallery({
  properties,
  children,
}: {
  properties: SeoAnalyticsEventProperties;
  children: ReactNode;
}) {
  function handleClick() {
    sendSeoEvent("seo_result_gallery_engaged", properties);
  }

  return <div onClick={handleClick}>{children}</div>;
}

export function SeoPromptCopyButton({
  prompt,
  properties,
}: {
  prompt: string;
  properties: SeoAnalyticsEventProperties;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      sendSeoEvent("seo_prompt_copied", properties);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  return <button type="button" onClick={handleCopy} className="mt-4 min-h-10 rounded-full border border-primary/35 px-4 text-sm font-bold text-primary transition hover:bg-primary/10">{copied ? "Copied" : "Copy prompt"}</button>;
}

function hasAnalyticsConsent() {
  return typeof document !== "undefined" && document.cookie.split("; ").some((entry) => entry.startsWith("airveek_analytics_consent=granted"));
}
