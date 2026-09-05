"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { isCheckoutResponse } from "@/lib/billing/checkout";
import type { PlanKey } from "@/lib/billing/types";
import { trackGa4Event } from "@/lib/analytics/browser";
import { trackServerMirroredPixelEvent } from "@/lib/analytics/meta-browser";

type CheckoutLauncherProps = {
  plan: PlanKey;
};

export function CheckoutLauncher({ plan }: CheckoutLauncherProps) {
  const started = useRef(false);
  const attemptId = useRef<string>(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    let cancelled = false;

    async function startCheckout() {
      try {
        trackGa4Event("begin_checkout", { plan: plan });
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, checkoutAttemptId: attemptId.current }),
        });

        const responseBody: unknown = await response.json();

        if (!response.ok || !isCheckoutResponse(responseBody)) {
          throw new Error("Checkout could not be started.");
        }

        if (!cancelled) {
          trackServerMirroredPixelEvent("InitiateCheckout", responseBody.metaEventId, { plan_key: plan, content_name: `Airveek ${plan === "premium" ? "Premium" : "Commercial"}`, content_category: "paid_access", value: plan === "premium" ? 147 : 49, currency: "USD" });
          window.location.assign(responseBody.purchaseUrl);
        }
      } catch (checkoutError: unknown) {
        if (!cancelled) {
          console.error("Checkout request failed.", checkoutError);
          setError("We could not start checkout. Please try again.");
        }
      }
    }

    void startCheckout();

    return () => {
      cancelled = true;
    };
  }, [plan]);

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-3xl border border-primary/20 bg-surface/95 p-8 text-center shadow-[0_24px_80px_rgba(var(--theme-shadow))]" aria-labelledby="checkout-title">
        {error ? (
          <>
            <h1 id="checkout-title" className="font-display text-3xl font-extrabold text-foreground">Checkout unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
            <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover" href={`/checkout?plan=${plan}`}>Try again</Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 h-10 w-10 animate-pulse rounded-full bg-primary/20" aria-hidden="true" />
            <h1 id="checkout-title" className="font-display text-3xl font-extrabold text-foreground">Opening secure checkout</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">You are being redirected to secure checkout to complete your purchase.</p>
          </>
        )}
      </section>
    </main>
  );
}
