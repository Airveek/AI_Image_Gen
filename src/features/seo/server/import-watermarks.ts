export type SeoImportSource = "gsc" | "ga4" | "bing";

/**
 * Select the next metric day to import. A normal run advances one day at a
 * time; a short (up to seven day) gap is replayed from the first missing day.
 * Larger gaps intentionally converge on the provider's current safe target
 * instead of attempting an unbounded historical backfill in a cron request.
 */
export function chooseSeoImportMetricDate(
  targetDate: string,
  lastSuccessMetricDate: string | null | undefined,
  maxReplayDays = 7,
): string {
  const targetMs = parseMetricDate(targetDate);
  if (!Number.isFinite(targetMs)) return targetDate;

  const lastMs = parseMetricDate(lastSuccessMetricDate);
  if (!Number.isFinite(lastMs) || lastMs >= targetMs) return targetDate;

  const nextMs = lastMs + 86_400_000;
  const gapDays = Math.floor((targetMs - nextMs) / 86_400_000) + 1;
  if (gapDays <= Math.max(1, Math.floor(maxReplayDays))) {
    return new Date(nextMs).toISOString().slice(0, 10);
  }
  return targetDate;
}

function parseMetricDate(value: string | null | undefined): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
