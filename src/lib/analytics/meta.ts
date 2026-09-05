export const FUNNEL_EVENT_NAMES = [
  "PageView", "ViewContent", "CompleteRegistration", "InitiateCheckout", "Purchase",
  "LandingPageCTA", "PlaygroundView", "GenerationIntent", "ModelReferenceUploaded",
  "ProductImageUploaded", "FashionShootConfigured", "GenerationStarted",
  "GenerationSucceeded", "FreeGenerationUsed", "PaywallView", "PricingView",
  "LifetimeOfferClick",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number];

export const META_CAPI_EVENT_NAMES = [
  "ViewContent", "CompleteRegistration", "GenerationSucceeded", "PaywallView",
  "InitiateCheckout", "Purchase",
] as const;

export type MetaCapiEventName = (typeof META_CAPI_EVENT_NAMES)[number];

export type FunnelEventProperties = {
  arena_id?: "product-fashion" | "general-image" | "storybook-page" | "image-to-sketch";
  billing_mode?: "one_time" | "subscription";
  content_category?: string;
  content_name?: string;
  currency?: "USD";
  generation_count?: 1 | 2 | 3;
  placement?: string;
  plan_key?: "commercial" | "premium";
  remaining_credits?: number;
  value?: number;
};

const STRING_LIMITS: Record<string, number> = {
  arena_id: 40,
  billing_mode: 20,
  content_category: 80,
  content_name: 120,
  currency: 3,
  placement: 60,
  plan_key: 20,
};
const ALLOWED_PROPERTY_KEYS = new Set([...Object.keys(STRING_LIMITS), "value", "remaining_credits", "generation_count"]);

export function isFunnelEventName(value: unknown): value is FunnelEventName {
  return typeof value === "string" && (FUNNEL_EVENT_NAMES as readonly string[]).includes(value);
}

export function isMetaCapiEventName(value: FunnelEventName): value is MetaCapiEventName {
  return (META_CAPI_EVENT_NAMES as readonly string[]).includes(value);
}

export function sanitizeFunnelProperties(value: unknown): FunnelEventProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, string | number> = {};
  for (const [key, maxLength] of Object.entries(STRING_LIMITS)) {
    const candidate = source[key];
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim().replace(/[^a-zA-Z0-9 _./:-]/g, "").slice(0, maxLength);
    if (normalized) result[key] = normalized;
  }
  if (source.currency === "USD") result.currency = "USD";
  if (source.plan_key === "commercial" || source.plan_key === "premium") result.plan_key = source.plan_key;
  if (source.billing_mode === "one_time" || source.billing_mode === "subscription") result.billing_mode = source.billing_mode;
  if (["product-fashion", "general-image", "storybook-page", "image-to-sketch"].includes(String(source.arena_id))) result.arena_id = String(source.arena_id);
  if (typeof source.value === "number" && Number.isFinite(source.value) && source.value >= 0 && source.value <= 1_000_000) result.value = Math.round(source.value * 100) / 100;
  if (typeof source.remaining_credits === "number" && Number.isInteger(source.remaining_credits) && source.remaining_credits >= 0 && source.remaining_credits <= 100) result.remaining_credits = source.remaining_credits;
  if ([1, 2, 3].includes(Number(source.generation_count))) result.generation_count = Number(source.generation_count);
  return result as FunnelEventProperties;
}

export function isSanitizedFunnelProperties(value: unknown): value is FunnelEventProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  if (!keys.every((key) => ALLOWED_PROPERTY_KEYS.has(key))) return false;
  const sanitized = sanitizeFunnelProperties(source) as Record<string, unknown>;
  return keys.length === Object.keys(sanitized).length
    && keys.every((key) => sanitized[key] === source[key]);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
