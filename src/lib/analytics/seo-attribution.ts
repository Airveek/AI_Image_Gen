import "server-only";

export {
  buildSeoAttributionCookieMutation,
  hashSeoAnonymousId,
  parseSeoAttributionCookie,
  SEO_ATTRIBUTION_COOKIE_NAME,
} from "./seo-attribution-core";

export const SEO_ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

export function getSeoAttributionSigningSecret(): string | null {
  const secret = process.env.SEO_ATTRIBUTION_SIGNING_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function seoAttributionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEO_ATTRIBUTION_MAX_AGE_SECONDS,
  };
}
