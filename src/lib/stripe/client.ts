import "server-only";

import Stripe from "stripe";

import type { BillingMode, PlanKey } from "@/lib/billing/types";

let stripeClient: Stripe | null = null;

export function requiredServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(requiredServerEnv("STRIPE_SECRET_KEY"));
  return stripeClient;
}

export function getStripeWebhookSecret(): string { return requiredServerEnv("STRIPE_WEBHOOK_SECRET"); }

export function getStripePriceId(plan: PlanKey, mode: BillingMode): string {
  const prefix = plan === "commercial" ? "STRIPE_COMMERCIAL" : "STRIPE_PREMIUM";
  return requiredServerEnv(`${prefix}_${mode === "subscription" ? "SUBSCRIPTION" : "ONE_TIME"}_PRICE_ID`);
}

export function getAppUrl(path: string): string {
  const base = new URL(requiredServerEnv("NEXT_PUBLIC_APP_URL"));
  const local = base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname);
  if (base.protocol !== "https:" && !local) throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS outside local development.");
  return new URL(path, base).toString();
}

