export const CORE_WEB_VITAL_BUDGETS = {
  lcp: 2_500,
  inp: 200,
  cls: 0.1,
} as const;

export type CoreWebVitalName = keyof typeof CORE_WEB_VITAL_BUDGETS;

export function coreWebVitalRating(name: CoreWebVitalName, value: number): "good" | "needs-improvement" | "poor" {
  const budget = CORE_WEB_VITAL_BUDGETS[name];
  if (name === "lcp") {
    if (value <= budget) return "good";
    if (value <= 4_000) return "needs-improvement";
    return "poor";
  }
  if (name === "inp") {
    if (value <= budget) return "good";
    if (value <= 500) return "needs-improvement";
    return "poor";
  }
  if (value <= budget) return "good";
  if (value <= 0.25) return "needs-improvement";
  return "poor";
}
