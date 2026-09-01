/**
 * Classify a content-agent failure before it is handed back to the queue.
 *
 * This module is deliberately side-effect free so the HTTP callback and the
 * scheduled dispatcher use the same retry policy. Only provider/transport
 * failures are retried; rights, policy, malformed-input, and editorial
 * failures remain human-review blockers.
 */
export type SeoAgentRetryClass = "transient_provider" | "manual_review";

export type SeoAgentRetryDecision = {
  retryClass: SeoAgentRetryClass;
  nextAttemptAt: string | null;
};

const RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1_000;

export function classifySeoAgentFailure(
  message: string,
  metadata: Record<string, unknown> = {},
  nowMs = Date.now(),
): SeoAgentRetryDecision {
  const status = Number(metadata.httpStatus ?? metadata.status ?? metadata.http_code ?? 0);
  const transient = [408, 425, 429, 500, 502, 503, 504].includes(status)
    || /quota|used today|rate.?limit|temporar|network|connection reset|econn|timeout|\b429\b|\b5\d\d\b/i.test(message);
  return {
    retryClass: transient ? "transient_provider" : "manual_review",
    nextAttemptAt: transient ? new Date(nowMs + RETRY_COOLDOWN_MS).toISOString() : null,
  };
}
