export const SEO_RECOMMENDATION_ACTIVE_STATUSES = ["open", "acknowledged", "in_progress"] as const;
export const SEO_RECOMMENDATION_TERMINAL_STATUSES = ["completed", "dismissed", "expired"] as const;

export type SeoRecommendationStatus =
  | "open"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "dismissed"
  | "expired";

export function normalizeSeoRecommendationDedupeKey(value: string): string {
  const dedupeKey = value.trim().slice(0, 240);
  if (dedupeKey.length < 8) throw new Error("SEO recommendation dedupe key is invalid.");
  return dedupeKey;
}

export function isActiveSeoRecommendationStatus(value: unknown): value is (typeof SEO_RECOMMENDATION_ACTIVE_STATUSES)[number] {
  return SEO_RECOMMENDATION_ACTIVE_STATUSES.includes(value as (typeof SEO_RECOMMENDATION_ACTIVE_STATUSES)[number]);
}

export function isSeoRecommendationStatus(value: unknown): value is SeoRecommendationStatus {
  return isActiveSeoRecommendationStatus(value) || isTerminalSeoRecommendationStatus(value);
}

export function isTerminalSeoRecommendationStatus(value: unknown): value is (typeof SEO_RECOMMENDATION_TERMINAL_STATUSES)[number] {
  return SEO_RECOMMENDATION_TERMINAL_STATUSES.includes(value as (typeof SEO_RECOMMENDATION_TERMINAL_STATUSES)[number]);
}

export function canTransitionSeoRecommendationStatus(from: SeoRecommendationStatus, to: SeoRecommendationStatus): boolean {
  if (from === to) return true;
  if (isTerminalSeoRecommendationStatus(from)) return false;
  return isActiveSeoRecommendationStatus(to) || isTerminalSeoRecommendationStatus(to);
}

export function requiresSeoRecommendationResolutionNote(status: SeoRecommendationStatus): boolean {
  return isTerminalSeoRecommendationStatus(status);
}
