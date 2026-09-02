"use client";

import { useActionState, useState } from "react";

import { updateSeoRecommendationAction, type SeoOperationActionState } from "@/app/(admin)/admin/seo/actions";
import type { SeoRecommendationStatus } from "@/features/seo/recommendation-contract";

const initialState: SeoOperationActionState = { status: "idle", message: "" };
const terminalStatuses = new Set<SeoRecommendationStatus>(["completed", "dismissed", "expired"]);

export function SeoRecommendationActions({
  recommendationId,
  currentStatus,
}: {
  recommendationId: string;
  currentStatus: SeoRecommendationStatus;
}) {
  const [state, action, pending] = useActionState(updateSeoRecommendationAction, initialState);
  const [nextStatus, setNextStatus] = useState<SeoRecommendationStatus>(currentStatus === "open" ? "acknowledged" : currentStatus === "acknowledged" ? "in_progress" : "completed");
  const requiresNote = terminalStatuses.has(nextStatus);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <form action={action} className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
        <input name="recommendationId" type="hidden" value={recommendationId} />
        <label className="block space-y-1 text-xs font-semibold text-brand-soft">
          <span>Update status</span>
          <select className="min-h-10 w-full rounded-lg border border-border bg-brand-black px-2 text-xs text-brand-white" name="status" onChange={(event) => setNextStatus(event.target.value as SeoRecommendationStatus)} value={nextStatus}>
            {availableStatuses(currentStatus).map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="block space-y-1 text-xs font-semibold text-brand-soft">
          <span>{requiresNote ? "Resolution note (required)" : "Operator note (optional)"}</span>
          <textarea className="min-h-10 w-full rounded-lg border border-border bg-brand-black px-2 py-2 text-xs text-brand-white placeholder:text-muted" maxLength={4000} name="resolutionNote" placeholder={requiresNote ? "What evidence-backed action was taken?" : "Optional context for the next operator."} required={requiresNote} rows={2} />
        </label>
        <button className="min-h-10 rounded-lg bg-brand-neon px-3 text-xs font-bold text-brand-black disabled:cursor-not-allowed disabled:opacity-50" disabled={pending} type="submit">{pending ? "Saving…" : "Save"}</button>
      </form>
      {state.message ? <p aria-live="polite" className={`mt-2 text-xs ${state.status === "error" ? "text-danger" : "text-brand-soft"}`} role="status">{state.message}</p> : null}
    </div>
  );
}

function availableStatuses(currentStatus: SeoRecommendationStatus): SeoRecommendationStatus[] {
  if (currentStatus === "open") return ["open", "acknowledged", "in_progress", "completed", "dismissed", "expired"];
  if (currentStatus === "acknowledged") return ["acknowledged", "in_progress", "completed", "dismissed", "expired"];
  if (currentStatus === "in_progress") return ["in_progress", "completed", "dismissed", "expired"];
  return [currentStatus];
}
