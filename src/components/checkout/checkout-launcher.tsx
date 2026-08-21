"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PlanKey } from "@/lib/whop/types";

type CheckoutResponse = {
  purchaseUrl: string;
};

function isCheckoutResponse(value: unknown): value is CheckoutResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const purchaseUrl = (value as Record<string, unknown>).purchaseUrl;
  return typeof purchaseUrl === "string" && purchaseUrl.startsWith("https://");
}

type CheckoutLauncherProps = {
  plan: PlanKey;
};

export function CheckoutLauncher({ plan }: CheckoutLauncherProps) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    let cancelled = false;

    async function startCheckout() {
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });

        const responseBody: unknown = await response.json();

        if (!response.ok || !isCheckoutResponse(responseBody)) {
          throw new Error("Checkout could not be started.");
        }

        if (!cancelled) {
          window.location.assign(responseBody.purchaseUrl);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error("Checkout request failed.", error);
          toast.error("We could not start checkout. Please try again.");
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
      <section className="w-full max-w-md rounded-3xl border border-[#83ff00]/20 bg-[#0b120b]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]" aria-labelledby="checkout-title">
        <div className="mx-auto mb-5 h-10 w-10 animate-pulse rounded-full bg-[#83ff00]/20" aria-hidden="true" />
        <h1 id="checkout-title" className="font-display text-3xl font-extrabold text-[#fdfdfd]">Opening secure checkout</h1>
        <p className="mt-3 text-sm leading-6 text-[#a4b19e]">You are being redirected to Whop to complete your purchase.</p>
      </section>
    </main>
  );
}

