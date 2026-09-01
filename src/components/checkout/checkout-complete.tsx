"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackGa4Event } from "@/lib/analytics/browser";

type CheckoutCompleteProps = {
  status: string | null;
};

export function CheckoutComplete({ status }: CheckoutCompleteProps) {
  const router = useRouter();
  const message = status === "success"
    ? "Payment received. Your access will update shortly."
    : status === "error"
      ? "Checkout was cancelled or could not be completed."
      : "Your checkout status is being confirmed.";

  useEffect(() => {
    if (status === "success" && !window.sessionStorage.getItem("airveek_purchase_tracked")) {
      window.sessionStorage.setItem("airveek_purchase_tracked", "1");
      trackGa4Event("purchase", { transaction_status: "success" });
    }
    const redirectTimer = window.setTimeout(() => router.replace("/dashboard"), 1200);
    return () => window.clearTimeout(redirectTimer);
  }, [router, status]);

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-3xl border border-[#83ff00]/20 bg-[#0b120b]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]" aria-labelledby="checkout-complete-title">
        <h1 id="checkout-complete-title" className="font-display text-3xl font-extrabold text-[#fdfdfd]">Checkout complete</h1>
        <p className="mt-3 text-sm leading-6 text-[#a4b19e]">{message}</p>
        <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#83ff00] px-5 py-2 text-sm font-bold text-[#040404]" href="/dashboard">Go to dashboard</Link>
      </section>
    </main>
  );
}
