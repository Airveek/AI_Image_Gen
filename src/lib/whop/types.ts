export type PlanKey = "commercial" | "premium";

export function isPlanKey(value: unknown): value is PlanKey {
  return value === "commercial" || value === "premium";
}

