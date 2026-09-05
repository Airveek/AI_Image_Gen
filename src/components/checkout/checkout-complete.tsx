"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
    const redirectTimer = window.setTimeout(() => router.replace("/dashboard"), 1200);
    return () => window.clearTimeout(redirectTimer);
  }, [router, status]);

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md rounded-3xl border border-primary/20 bg-surface/95 p-8 text-center shadow-[0_24px_80px_rgba(var(--theme-shadow))]" aria-labelledby="checkout-complete-title">
        <h1 id="checkout-complete-title" className="font-display text-3xl font-extrabold text-foreground">Checkout complete</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover" href="/dashboard">Go to dashboard</Link>
      </section>
    </main>
  );
}
