import "server-only";

import Whop from "@whop/sdk";

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

export function getWhopPlanId(plan: "commercial" | "premium"): string {
  const envName = plan === "commercial"
    ? "WHOP_COMMERCIAL_PLAN_ID"
    : "WHOP_PREMIUM_PLAN_ID";

  return getRequiredEnv(envName);
}

export function getWhopCheckoutRedirectUrl(): string {
  const appUrl = getRequiredEnv("NEXT_PUBLIC_APP_URL");
  let redirectUrl: URL;

  try {
    redirectUrl = new URL(appUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid URL.");
  }

  if (redirectUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS for Whop checkout.");
  }

  return new URL("/checkout/complete", redirectUrl).toString();
}
