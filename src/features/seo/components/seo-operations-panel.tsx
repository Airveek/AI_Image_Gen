"use client";

import { useActionState, type ReactNode } from "react";

import { assignSeoBriefAction, recordSeoReviewDecisionAction, reviewSeoRightsAction, updateSeoTemplateRolloutAction, type SeoOperationActionState } from "@/app/(admin)/admin/seo/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SeoAssignmentQueueItem, SeoBriefQueueItem, SeoContentMemberOption, SeoTemplateRollout } from "@/features/seo/server/content-operations";

const initialState: SeoOperationActionState = { status: "idle", message: "" };
const inputClassName = "min-h-11 w-full rounded-xl border border-white/10 bg-brand-black px-3 text-sm text-brand-white placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon";

export function SeoOperationsPanel({
  briefs,
  assignments,
  members,
  rollouts,
}: {
  briefs: SeoBriefQueueItem[];
  assignments: SeoAssignmentQueueItem[];
  members: SeoContentMemberOption[];
  rollouts: SeoTemplateRollout[];
}) {
  const [assignmentState, assignmentAction, assignmentPending] = useActionState(assignSeoBriefAction, initialState);
  const [reviewState, reviewAction, reviewPending] = useActionState(recordSeoReviewDecisionAction, initialState);
  const [rightsState, rightsAction, rightsPending] = useActionState(reviewSeoRightsAction, initialState);
  const [rolloutState, rolloutAction, rolloutPending] = useActionState(updateSeoTemplateRolloutAction, initialState);
  const feedback = assignmentState.message || reviewState.message || rightsState.message || rolloutState.message;
  const hasError = assignmentState.status === "error" || reviewState.status === "error" || rightsState.status === "error" || rolloutState.status === "error";
  const pendingRights = briefs.filter((brief) => brief.rightsStatus !== "approved").length;
  const assignmentByBrief = new Map<string, SeoAssignmentQueueItem[]>();
  for (const assignment of assignments) {
    const current = assignmentByBrief.get(assignment.briefId) ?? [];
    current.push(assignment);
    assignmentByBrief.set(assignment.briefId, current);
  }

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-neon">Content operations</p>
        <h3 className="mt-2 font-display text-xl font-bold text-brand-white">Assign, review, and keep the queue moving</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">These controls create an auditable assignment or review decision only. They do not create accounts, publish pages, change redirects, or enable automation.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold"><span className={`rounded-full border px-3 py-1 ${pendingRights ? "border-amber-200/30 bg-amber-200/10 text-amber-100" : "border-brand-neon/30 bg-brand-neon/10 text-brand-neon"}`}>Human rights approvals pending: {pendingRights}</span><span className="rounded-full border border-white/10 px-3 py-1 text-muted">Rights approval never publishes a page</span></div>
      </div>

      {feedback ? <p aria-live="polite" className={`mx-5 mt-5 rounded-xl border px-4 py-3 text-sm sm:mx-6 ${hasError ? "border-red-300/20 bg-red-300/5 text-red-100" : "border-brand-neon/20 bg-brand-neon/5 text-brand-soft"}`} role="status">{feedback}</p> : null}

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
        <form action={assignmentAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div><h4 className="font-display text-lg font-bold text-brand-white">Assign queue work</h4><p className="mt-1 text-xs leading-5 text-muted">The database checks that the selected member is active and compatible with the role.</p></div>
          <Field label="Brief"><select className={inputClassName} name="briefId" required defaultValue=""><option disabled value="">Select a brief</option>{briefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.briefKey} · {brief.productEntity} · rights {brief.rightsStatus}</option>)}</select></Field>
          <Field label="Active member"><select className={inputClassName} name="assigneeId" required defaultValue=""><option disabled value="">Select a member</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName} · {member.role}</option>)}</select></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Role"><select className={inputClassName} name="assignmentRole" defaultValue="writer"><option value="researcher">Researcher</option><option value="brief_lead">Brief lead</option><option value="writer">Writer</option><option value="editor">Editor</option><option value="reviewer">Reviewer</option><option value="publisher">Publisher</option></select></Field><Field label="Priority"><input className={inputClassName} defaultValue="50" max="100" min="0" name="priority" type="number" /></Field></div>
          <Field label="Due date (optional)"><input className={inputClassName} name="dueAt" type="datetime-local" /></Field>
          <Field label="Assignment notes (optional)"><textarea className={`${inputClassName} py-3`} maxLength={4000} name="notes" rows={3} /></Field>
          <Button disabled={assignmentPending || briefs.length === 0 || members.length === 0} type="submit" variant="primary">{assignmentPending ? "Saving…" : "Save assignment"}</Button>
          {briefs.length === 0 ? <p className="text-xs text-amber-100">No open briefs are currently available.</p> : null}
          {members.length === 0 ? <p className="text-xs text-amber-100">No active content members are configured.</p> : null}
        </form>

        <form action={reviewAction} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div><h4 className="font-display text-lg font-bold text-brand-white">Record a review decision</h4><p className="mt-1 text-xs leading-5 text-muted">Approving a review is not the same as publishing; the evidence and publish gates still run afterward.</p></div>
          <Field label="Brief"><select className={inputClassName} name="briefId" required defaultValue=""><option disabled value="">Select a brief</option>{briefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.briefKey} · {brief.status}{brief.pageId ? " · page ready" : " · no page yet"}</option>)}</select></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Review type"><select className={inputClassName} name="reviewType" defaultValue="draft"><option value="research">Research</option><option value="rights">Rights (non-approval note)</option><option value="workflow">Workflow</option><option value="draft">Draft</option><option value="quality">Quality</option><option value="editorial">Editorial</option><option value="publish">Publish</option><option value="refresh">Refresh</option></select></Field><Field label="Decision"><select className={inputClassName} name="decision" defaultValue="changes_requested"><option value="approved">Approved</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected</option><option value="merged">Merged</option><option value="deferred">Deferred</option></select></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Score (0–100, required for approval)"><input className={inputClassName} max="100" min="0" name="score" type="number" /></Field><Field label="Content version"><input className={inputClassName} defaultValue="seo-v1" maxLength={120} name="contentVersion" required /></Field></div>
          <Field label="Blockers (comma or line separated)"><textarea className={`${inputClassName} py-3`} maxLength={4000} name="blockers" rows={3} /></Field>
          <Field label="Reviewer notes (optional)"><textarea className={`${inputClassName} py-3`} maxLength={8000} name="notes" rows={3} /></Field>
          <Button disabled={reviewPending || briefs.length === 0} type="submit" variant="secondary">{reviewPending ? "Saving…" : "Record review"}</Button>
        </form>
      </div>

      <div className="border-t border-white/10 p-5 sm:p-6">
        <form action={rightsAction} className="space-y-4 rounded-2xl border border-amber-200/20 bg-amber-200/[0.025] p-5">
          <div><h4 className="font-display text-lg font-bold text-brand-white">Approve source-asset rights</h4><p className="mt-1 max-w-3xl text-xs leading-5 text-muted">This is the human rights gate. The signed checksum must match the exact source file used for the Airveek run. Approval is recorded with your admin identity and never publishes a page.</p></div>
          <div className="grid gap-4 lg:grid-cols-2"><Field label="Brief"><select className={inputClassName} name="briefId" required defaultValue=""><option disabled value="">Select a brief</option>{briefs.map((brief) => <option key={brief.id} value={brief.id}>{brief.briefKey} · {brief.productEntity} · rights {brief.rightsStatus}</option>)}</select></Field><Field label="Rights evidence ID"><input className={inputClassName} maxLength={200} name="rightsEvidenceId" placeholder="e.g. airveek-pilot-serum-source" required /></Field></div>
          <div className="grid gap-4 lg:grid-cols-2"><Field label="Source SHA-256 checksum"><input className={inputClassName} maxLength={71} name="sourceChecksum" placeholder="64 hex characters (sha256: prefix optional)" required /><span className="block text-xs font-normal leading-5 text-muted">The queue card shows the persisted checksum when available. Otherwise compute locally with <code>shasum -a 256 path/to/source.png</code> and verify the bytes before approving.</span></Field><Field label="Source URL (optional)"><input className={inputClassName} name="sourceUrl" placeholder="https://…" type="url" /></Field></div>
          <div className="grid gap-4 lg:grid-cols-2"><Field label="Source label (optional)"><input className={inputClassName} maxLength={500} name="sourceLabel" placeholder="Owned Airveek source asset" /></Field><Field label="Review expiry (optional)"><input className={inputClassName} name="reviewAfter" type="datetime-local" /></Field></div>
          <Field label="Rights review notes (optional)"><textarea className={`${inputClassName} py-3`} maxLength={8000} name="notes" placeholder="Why this source is owned or licensed for this workflow" rows={3} /></Field>
          <Button disabled={rightsPending || briefs.length === 0} type="submit" variant="secondary">{rightsPending ? "Saving rights approval…" : "Approve rights for this source"}</Button>
          {briefs.length === 0 ? <p className="text-xs text-amber-100">Create a brief before recording rights evidence.</p> : null}
        </form>
      </div>

      <div className="border-t border-white/10 p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-neon">Template safety</p>
          <h4 className="mt-2 font-display text-lg font-bold text-brand-white">Rollout health and promotion gate</h4>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted">New templates start in manual review. Marking a template proven requires 50 reviewed pages and a healthy-since date at least 14 days old; this control never publishes a page.</p>
        </div>
        {rollouts.length ? <div className="mt-4 space-y-4">{rollouts.map((rollout) => <form action={rolloutAction} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end" key={rollout.templateVersion}>
          <Field label="Template version"><input className={inputClassName} name="templateVersion" readOnly value={rollout.templateVersion} /></Field>
          <Field label="Status"><select className={inputClassName} defaultValue={rollout.status} name="status"><option value="manual_review">Manual review</option><option value="proven">Proven</option><option value="paused">Paused</option></select></Field>
          <Field label="Reviewed pages"><input className={inputClassName} defaultValue={String(rollout.reviewedPageCount)} min="0" max="100000" name="reviewedPageCount" type="number" /></Field>
          <Field label="Healthy since (UTC)"><input className={inputClassName} defaultValue={toDateTimeLocal(rollout.healthySince)} name="healthySince" type="datetime-local" /></Field>
          <div className="lg:col-span-5"><Field label="Last incident (optional, UTC)"><input className={inputClassName} defaultValue={toDateTimeLocal(rollout.lastIncidentAt)} name="lastIncidentAt" type="datetime-local" /></Field><Field label="Notes (optional)"><textarea className={`${inputClassName} py-3`} defaultValue={rollout.notes ?? ""} maxLength={2000} name="notes" rows={2} /></Field></div>
          <div className="lg:col-span-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">Updated {formatDate(rollout.updatedAt)}{rollout.lastIncidentAt ? ` · incident ${formatDate(rollout.lastIncidentAt)}` : " · no incident recorded"}</p><Button disabled={rolloutPending} type="submit" variant="secondary">{rolloutPending ? "Saving…" : "Save rollout"}</Button></div>
        </form>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted">No template rollout rows exist yet. New page templates will be registered automatically in manual review.</p>}
      </div>

      <div className="border-t border-white/10 p-5 sm:p-6">
        <h4 className="font-display text-lg font-bold text-brand-white">Open brief queue</h4>
        {briefs.length ? <div className="mt-4 space-y-3">{briefs.map((brief) => <div className="rounded-xl border border-white/10 bg-black/20 p-4" key={brief.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-brand-white">{brief.briefKey}</p><p className="mt-1 text-sm text-muted">{brief.productEntity} · {brief.pageFamily} · {brief.primaryQuery}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase text-brand-soft">{brief.status}</span><span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${brief.rightsStatus === "approved" ? "border-brand-neon/30 text-brand-neon" : "border-amber-200/30 text-amber-100"}`}>rights {brief.rightsStatus}</span></div></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted"><span>Priority {brief.priority}</span><span>•</span><span>{brief.pageId ? "Draft linked" : "Awaiting draft"}</span>{(assignmentByBrief.get(brief.id) ?? []).map((assignment) => <span className="rounded-full bg-white/[0.06] px-2 py-1" key={assignment.id}>{assignment.assignmentRole}</span>)}</div>{brief.rightsStatus !== "approved" ? <div className="mt-3 rounded-lg border border-amber-200/10 bg-amber-200/[0.03] p-3 text-xs leading-5 text-amber-100"><p>Source asset: {brief.sourceAssetPath ?? "missing path"}</p><p>Checksum: {brief.sourceAssetChecksum ?? "compute and verify locally before approval"}</p></div> : null}</div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted">The queue is empty. Create a reviewed brief before assigning work.</p>}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2 text-sm font-semibold text-brand-white"><span>{label}</span>{children}</label>;
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 10);
}
