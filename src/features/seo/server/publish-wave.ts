/**
 * Decide whether a failed pre-live publish candidate should leave the
 * approved queue. Keep infrastructure/race failures retryable; permanent
 * quality/evidence failures must return to editorial review so a wave can
 * consume a replacement from the approved buffer.
 */
const RETRYABLE_PUBLISH_BLOCKERS = new Set([
  "seo_automation_disabled",
  "seo_automation_config_unavailable",
  "publish_gate_unavailable",
  "quality_run_persist_failed",
  "publish_wave_capacity_reached",
  "page_changed_before_publish",
  "page_not_found",
]);

export function shouldReturnPublishCandidateToReview(blockers: readonly string[]): boolean {
  if (!blockers.length) return false;
  // Post-transition failures already quarantine the page out of the public
  // queue. Preserve that state instead of overwriting it with review status.
  if (blockers.some((blocker) => blocker === "publish_transaction_failed" || blocker.startsWith("render_") || blocker.endsWith("_health_update_failed") || blocker === "publish_batch_state_update_failed")) return false;
  return blockers.some((blocker) => !RETRYABLE_PUBLISH_BLOCKERS.has(blocker));
}
