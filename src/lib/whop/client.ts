import "server-only";

import Whop from "@whop/sdk";

import { identifyWhopPlan, type WhopPlanIdentity } from "@/lib/whop/plans";
import type { BillingMode, PlanKey } from "@/lib/billing/types";

let whopClient: Whop | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getWebhookKey(secret: string): string {
  return Buffer.from(secret, "utf8").toString("base64");
}

export function getWhopWebhookKey(): string {
  return getWebhookKey(getRequiredEnv("WHOP_WEBHOOK_SECRET"));
}

export function getWhopClient(): Whop {
  if (whopClient) {
    return whopClient;
  }

  const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
  const baseURL = process.env.WHOP_SANDBOX === "true"
    ? "https://sandbox-api.whop.com/api/v1"
    : undefined;

  whopClient = new Whop({
    apiKey: getRequiredEnv("WHOP_API_KEY"),
    webhookKey: webhookSecret ? getWebhookKey(webhookSecret) : undefined,
    baseURL,
  });

  return whopClient;
}

export function getWhopAccountId(): string {
  return getRequiredEnv("WHOP_COMPANY_ID");
}

export function getWhopCheckoutPlanId(plan: PlanKey, mode: BillingMode = "subscription"): string {
  const prefix = plan === "commercial" ? "WHOP_COMMERCIAL" : "WHOP_PREMIUM";
  const envName = `${prefix}_${mode === "subscription" ? "MONTHLY_PLAN_ID" : "PLAN_ID"}`;

  return getRequiredEnv(envName);
}

export function getWhopPlanIdentity(planId: string): WhopPlanIdentity {
  return identifyWhopPlan(planId, {
    commercialMonthly: process.env.WHOP_COMMERCIAL_MONTHLY_PLAN_ID,
    premiumMonthly: process.env.WHOP_PREMIUM_MONTHLY_PLAN_ID,
    commercialLegacy: process.env.WHOP_COMMERCIAL_PLAN_ID,
    premiumLegacy: process.env.WHOP_PREMIUM_PLAN_ID,
  });
}

export function getWhopCheckoutRedirectUrl(): string {
  const appUrl = getRequiredEnv("NEXT_PUBLIC_APP_URL");
  let redirectUrl: URL;

  try {
    redirectUrl = new URL(appUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid URL.");
  }

  const isLocalHttp = redirectUrl.protocol === "http:" &&
    (redirectUrl.hostname === "localhost" || redirectUrl.hostname === "127.0.0.1");

  if (redirectUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS outside local development.");
  }

  return new URL("/checkout/complete", redirectUrl).toString();
}
