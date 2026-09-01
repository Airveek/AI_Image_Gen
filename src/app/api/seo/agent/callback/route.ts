import { NextResponse } from "next/server";

import { sha256Hex, verifyAgentCallbackSignature } from "@/features/seo/server/agent-dispatch";
import { classifySeoAgentFailure, type SeoAgentRetryDecision } from "@/features/seo/server/agent-retry";
import { validateSeoPageDraft } from "@/features/seo/server/draft-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CALLBACK_BYTES = 2 * 1024 * 1024;

/**
 * Receive a signed completion from the external content agent. This endpoint
 * only ingests a non-live draft; it cannot approve, publish, redirect, merge,
 * prune, or change indexability.
 */
export async function POST(request: Request) {
  const enforceEvidence = process.env.SEO_EVIDENCE_GATES_ENABLED?.trim().toLowerCase() === "true";
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_CALLBACK_BYTES) {
    return json({ error: "callback_body_too_large" }, 413);
  }

  const secret = process.env.SEO_CONTENT_AGENT_SIGNING_SECRET?.trim();
  const validSignature = secret
    ? verifyAgentCallbackSignature({
        rawBody,
        timestamp: request.headers.get("x-airveek-agent-timestamp"),
        signature: request.headers.get("x-airveek-agent-signature"),
        secret,
      })
    : false;
  if (!validSignature) return json({ error: "invalid_agent_signature" }, 401);

  const parsed = parseJson(rawBody);
  if (!isRecord(parsed)) return json({ error: "callback_payload_must_be_object" }, 400);
  const dispatchId = typeof parsed.dispatchId === "string" ? parsed.dispatchId.trim() : "";
  const callbackStatus = parsed.status === "completed" || parsed.status === "failed" ? parsed.status : null;
  if (!isUuid(dispatchId) || !callbackStatus) return json({ error: "invalid_callback_identity" }, 400);

  const client = createSupabaseAdminClient();
  const { data: run, error: runError } = await client
    .from("seo_agent_runs")
    .select("id,brief_id,assignment_id,status,page_id,draft_checksum")
    .eq("id", dispatchId)
    .maybeSingle();
  if (runError) return json({ error: "agent_run_lookup_failed" }, 500);
  if (!run) return json({ error: "agent_run_not_found" }, 404);
  if (run.status === "completed") {
    // Preserve idempotent success for the exact completed callback, but do
    // not silently accept a different signed payload for the same dispatch.
    // A completed run's checksum is the immutable record of what was ingested.
    if (callbackStatus === "completed") {
      if (!isRecord(parsed.draft)) return json({ error: "completed_callback_requires_draft" }, 400);
      const incomingChecksum = sha256Hex(JSON.stringify(parsed.draft));
      if (run.draft_checksum && run.draft_checksum !== incomingChecksum) {
        return json({ error: "draft_checksum_mismatch" }, 409);
      }
    }
    return json({ accepted: true, duplicate: true, pageId: run.page_id ?? null }, 200);
  }
  if (!["sent", "accepted", "processing"].includes(String(run.status))) {
    return json({ error: "agent_run_not_accepting_callback", status: run.status }, 409);
  }

  const now = new Date().toISOString();
  if (callbackStatus === "failed") {
    const message = typeof parsed.error === "string" && parsed.error.trim()
      ? parsed.error.trim().slice(0, 4_000)
      : "The content agent reported a failed run.";
    const retryDecision = classifySeoAgentFailure(message, isRecord(parsed.metadata) ? parsed.metadata : {});
    const { data: claimed } = await client
      .from("seo_agent_runs")
      .update({
        status: "failed",
        last_error: message,
        retry_class: retryDecision.retryClass,
        next_attempt_at: retryDecision.nextAttemptAt,
        response_metadata: isRecord(parsed.metadata) ? parsed.metadata : {},
        received_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", dispatchId)
      .in("status", ["sent", "accepted", "processing"])
      .select("id")
      .maybeSingle();
    if (!claimed) return json({ accepted: true, duplicate: true }, 200);
    const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now, retryDecision);
    if (stateErrors.length) {
      return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
    }
    return json({ accepted: true, status: "failed" }, 200);
  }

  if (!isRecord(parsed.draft)) return json({ error: "completed_callback_requires_draft" }, 400);
  const draftRecord = parsed.draft;
  const draftChecksum = sha256Hex(JSON.stringify(parsed.draft));
  if (run.draft_checksum && run.draft_checksum !== draftChecksum) {
    return json({ error: "draft_checksum_mismatch" }, 409);
  }

  const { data: claimed } = await client
    .from("seo_agent_runs")
    .update({ status: "processing", draft_checksum: draftChecksum, received_at: now, updated_at: now })
    .eq("id", dispatchId)
    .in("status", ["sent", "accepted"])
    .select("id")
    .maybeSingle();
  if (!claimed) {
    const { data: current } = await client.from("seo_agent_runs").select("status,page_id").eq("id", dispatchId).maybeSingle();
    if (current?.status === "completed") return json({ accepted: true, duplicate: true, pageId: current.page_id ?? null }, 200);
    if (current?.status === "processing") {
      // Keep the legacy rights recovery check available for rollback. In
      // reader-first mode a retry can reconcile the private page directly.
      const recoveryRights = enforceEvidence
        ? await verifyPersistedRightsPacket(client, String(run.brief_id), draftRecord)
        : { ok: true as const };
      if (recoveryRights.ok) {
        const recoveredPageId = await recoverAlreadyIngestedDraft({
          client,
          run,
          draftRecord,
          draftChecksum,
        });
        if (recoveredPageId) return json({ accepted: true, duplicate: true, recovered: true, pageId: recoveredPageId }, 200);
      }
    }
    return json({ accepted: true, processing: true }, 202);
  }

  // Re-run the complete contract at the trust boundary. A valid HMAC proves
  // who sent the payload, not that the payload contains rights-cleared media,
  // independent generation evidence, authorship, crawlable links, or a safe
  // review state. Keep this check before collision/ingest so invalid drafts
  // never create partial evidence records.
  const contract = validateSeoPageDraft(draftRecord, { reviewOnly: true });
  if (!contract.valid) {
    const message = `Draft contract validation failed: ${contract.blockers.join(", ")}`.slice(0, 4_000);
    await client
      .from("seo_agent_runs")
      .update({ status: "failed", last_error: message, completed_at: now, updated_at: now })
      .eq("id", dispatchId)
      .eq("status", "processing");
    const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
    if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
    return json({ error: "draft_contract_failed", blockers: contract.blockers, warnings: contract.warnings, score: contract.score }, 422);
  }
  if (String(draftRecord.briefId ?? "") !== String(run.brief_id)) {
    const message = "Draft briefId does not match the dispatched brief.";
    await client
      .from("seo_agent_runs")
      .update({ status: "failed", last_error: message, completed_at: now, updated_at: now })
      .eq("id", dispatchId)
      .eq("status", "processing");
    const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
    if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
    return json({ error: "draft_brief_mismatch" }, 422);
  }

  if (enforceEvidence) {
    const persistedRights = await verifyPersistedRightsPacket(client, String(run.brief_id), draftRecord);
    if (!persistedRights.ok) {
      const message = `Persisted rights evidence validation failed: ${persistedRights.reason}`.slice(0, 4_000);
      await client
        .from("seo_agent_runs")
        .update({ status: "failed", last_error: message, completed_at: now, updated_at: now })
        .eq("id", dispatchId)
        .eq("status", "processing");
      const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
      if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
      return json({ error: "persisted_rights_evidence_failed", reason: persistedRights.reason }, 422);
    }
  }

  const contentEmbedding = readContentEmbedding(draftRecord.contentEmbedding);
  if (Object.prototype.hasOwnProperty.call(draftRecord, "contentEmbedding") && !contentEmbedding) {
    const message = "Content embedding must be a 1536-dimensional numeric vector.";
    await client.from("seo_agent_runs").update({ status: "failed", last_error: message, completed_at: now, updated_at: now }).eq("id", dispatchId).eq("status", "processing");
    const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
    if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
    return json({ error: "invalid_content_embedding" }, 422);
  }
  const { data: collision, error: collisionError } = await client.rpc("check_seo_intent_collision", {
    p_normalized_intent_key: slugify(String(draftRecord.intentKey ?? "")),
    p_locale: typeof draftRecord.locale === "string" && draftRecord.locale.trim() ? draftRecord.locale.trim() : "en",
    p_product_slug: slugify(String(draftRecord.productEntity ?? "")),
    p_embedding: contentEmbedding,
  });
  if (collisionError || (isRecord(collision) && collision.status === "blocked")) {
    const message = collisionError?.message ?? `Intent collision blocked: ${String((collision as Record<string, unknown>)?.reason ?? "existing_intent")}`;
    await client.from("seo_agent_runs").update({ status: "failed", last_error: message.slice(0, 4_000), completed_at: now, updated_at: now }).eq("id", dispatchId).eq("status", "processing");
    const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
    if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
    return json({ error: collisionError ? "intent_collision_check_failed" : "intent_collision_blocked" }, 422);
  }
  const draftPayload = {
    ...draftRecord,
    briefId: String(run.brief_id),
    // The validator computes this score from the same evidence gates used by
    // the worker. Preserve a stricter declared score when it is valid; add a
    // deterministic qualityChecks object for the database gate in either case.
    qualityScore: Number.isInteger(draftRecord.qualityScore) ? draftRecord.qualityScore : contract.score,
    qualityChecks: contract,
  };
  const ingestRpc = enforceEvidence ? "ingest_seo_page_draft" : "ingest_seo_page_draft_reader_first";
  const { data: pageId, error: ingestError } = await client.rpc(ingestRpc, { payload: draftPayload });
  if (ingestError || !pageId) {
    const message = `Draft ingest failed: ${ingestError?.message ?? "missing_page_id"}`.slice(0, 4_000);
    await client.from("seo_agent_runs").update({ status: "failed", last_error: message, completed_at: now, updated_at: now }).eq("id", dispatchId).eq("status", "processing");
    const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
    if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
    return json({ error: "draft_ingest_failed", message }, 422);
  }

  const safePageId = String(pageId);
  if (contentEmbedding) {
    const { error: embeddingError } = await client
      .from("seo_pages")
      .update({ content_embedding: contentEmbedding })
      .eq("id", safePageId)
      .eq("noindex", true);
    if (embeddingError) {
      const message = `Content embedding write failed: ${embeddingError.message}`.slice(0, 4_000);
      await client.from("seo_agent_runs").update({ status: "failed", last_error: message, completed_at: now, updated_at: now }).eq("id", dispatchId).eq("status", "processing");
      const stateErrors = await markBriefFailed(client, String(run.brief_id), run.assignment_id ? String(run.assignment_id) : null, message, now);
      if (stateErrors.length) return json({ error: "agent_failure_state_persist_failed", stateErrors }, 500);
      return json({ error: "content_embedding_write_failed" }, 422);
    }
  }
  const stateErrors = await persistAgentCompletionState({
    client,
    briefId: String(run.brief_id),
    assignmentId: run.assignment_id ? String(run.assignment_id) : null,
    pageId: safePageId,
    requestId: dispatchId,
    action: "agent.completed",
    now,
    draftChecksum,
  });
  if (stateErrors.length) {
    const message = `Agent completion state persistence failed: ${stateErrors.join(", ")}`.slice(0, 4_000);
    const { error: stateError } = await client.from("seo_agent_runs").update({
      last_error: message,
      response_metadata: { stateErrors },
      updated_at: now,
    }).eq("id", dispatchId).eq("status", "processing");
    if (stateError) stateErrors.push(`agent_run_state_error_persist_failed:${stateError.code}`);
    return json({ error: "agent_completion_state_persist_failed", stateErrors }, 500);
  }

  const { data: completedRun, error: updateError } = await client.from("seo_agent_runs").update({
    status: "completed",
    page_id: safePageId,
    completed_at: now,
    updated_at: now,
  }).eq("id", dispatchId).eq("status", "processing").select("id").maybeSingle();
  if (updateError || !completedRun) return json({ error: "agent_run_completion_update_failed" }, 500);

  return json({ accepted: true, status: "completed", pageId: safePageId }, 200);
}

async function markBriefFailed(
  client: ReturnType<typeof createSupabaseAdminClient>,
  briefId: string,
  assignmentId: string | null,
  message: string,
  now: string,
  retryDecision: SeoAgentRetryDecision = classifySeoAgentFailure(message),
): Promise<string[]> {
  const errors: string[] = [];
  const nextQueueStatus = retryDecision.retryClass === "transient_provider" ? "assigned" : "blocked";
  const { data: brief, error: briefError } = await client
    .from("seo_content_briefs")
    .update({ status: nextQueueStatus, updated_at: now })
    .eq("id", briefId)
    .in("status", ["in_progress", "assigned", "ready_for_assignment"])
    .select("id")
    .maybeSingle();
  if (briefError || !brief) errors.push(`brief_failure_persist_failed:${briefError?.code ?? "state_changed"}`);

  if (assignmentId) {
    const { data: assignment, error: assignmentError } = await client
      .from("seo_content_assignments")
      .update({ status: nextQueueStatus, notes: message, updated_at: now })
      .eq("id", assignmentId)
      .in("status", ["assigned", "accepted", "in_progress"])
      .select("id")
      .maybeSingle();
    if (assignmentError || !assignment) errors.push(`assignment_failure_persist_failed:${assignmentError?.code ?? "state_changed"}`);
  }

  const { error: auditError } = await client.from("seo_content_audit_events").insert({
      entity_type: "brief",
      entity_id: briefId,
      action: retryDecision.retryClass === "transient_provider" ? "agent.retry_scheduled" : "agent.failed",
      to_status: nextQueueStatus,
      request_id: `agent-failure:${briefId}:${now}`.slice(0, 180),
      metadata: { message, retryClass: retryDecision.retryClass, nextAttemptAt: retryDecision.nextAttemptAt },
      occurred_at: now,
    });
  if (auditError) errors.push(`failure_audit_persist_failed:${auditError.code}`);
  return errors;
}

async function verifyPersistedRightsPacket(
  client: ReturnType<typeof createSupabaseAdminClient>,
  briefId: string,
  draft: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const content = isRecord(draft.content) ? draft.content : {};
  const sourceAsset = isRecord(content.sourceAsset) ? content.sourceAsset : {};
  const evidenceId = typeof sourceAsset.rightsEvidenceId === "string" ? sourceAsset.rightsEvidenceId.trim() : "";
  if (!evidenceId || sourceAsset.rightsApproved !== true) return { ok: false, reason: "draft_rights_evidence_is_not_explicitly_approved" };

  const { data: packets, error: packetError } = await client
    .from("seo_evidence_packets")
    .select("id,status,rights_status,reviewed_by,reviewed_at,packet_checksum,version")
    .eq("brief_id", briefId)
    .eq("packet_type", "rights")
    .eq("status", "approved")
    .eq("rights_status", "approved")
    .order("version", { ascending: false })
    .limit(10);
  if (packetError) return { ok: false, reason: "rights_packet_lookup_failed" };
  const packet = (packets ?? []).find((item) => Boolean(item.reviewed_by && item.reviewed_at && item.packet_checksum));
  if (!packet) return { ok: false, reason: "no_reviewer_approved_rights_packet_for_brief" };

  const { data: items, error: itemError } = await client
    .from("seo_evidence_items")
    .select("rights_evidence_id,metadata")
    .eq("packet_id", packet.id)
    .eq("item_type", "rights")
    .eq("rights_status", "approved")
    .eq("rights_evidence_id", evidenceId)
    .limit(10);
  if (itemError) return { ok: false, reason: "rights_item_lookup_failed" };
  const sourceChecksum = typeof sourceAsset.checksum === "string" ? sourceAsset.checksum.toLowerCase().replace(/^sha256:/, "") : "";
  const matching = (items ?? []).find((item) => {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const recordedChecksum = typeof metadata.sourceAssetChecksum === "string"
      ? metadata.sourceAssetChecksum.toLowerCase().replace(/^sha256:/, "")
      : null;
    // The checksum is the binding between the reviewer-approved rights item
    // and the exact source asset. Missing metadata must fail closed; an
    // evidence ID alone is not sufficient because it can be reused across
    // different files or product variants.
    return Boolean(recordedChecksum && sourceChecksum && recordedChecksum === sourceChecksum);
  });
  return matching ? { ok: true } : { ok: false, reason: "draft_rights_evidence_id_is_not_approved_for_source_asset" };
}

/**
 * If the page RPC committed but the subsequent run-status update timed out,
 * the retry arrives while the run is still `processing`. Reuse the stable
 * draft page id only when the page is still a private review record and the
 * path belongs to the same brief. This prevents duplicate inserts without
 * ever treating a live or unrelated page as an agent completion.
 */
async function recoverAlreadyIngestedDraft(input: {
  client: ReturnType<typeof createSupabaseAdminClient>;
  run: { id: string; brief_id: string; assignment_id: string | null; page_id: string | null; draft_checksum: string | null };
  draftRecord: Record<string, unknown>;
  draftChecksum: string;
}): Promise<string | null> {
  const candidatePageId = isUuid(String(input.run.page_id ?? ""))
    ? String(input.run.page_id)
    : isUuid(String(input.draftRecord.pageId ?? ""))
      ? String(input.draftRecord.pageId)
      : null;
  if (!candidatePageId) return null;

  const { data: page, error: pageError } = await input.client
    .from("seo_pages")
    .select("id,path,status,noindex")
    .eq("id", candidatePageId)
    .maybeSingle();
  if (pageError || !page) return null;
  if (page.noindex !== true || !["draft", "automated_qa", "editor_review", "changes_requested", "refresh"].includes(String(page.status))) return null;

  const rawPath = typeof input.draftRecord.path === "string" ? input.draftRecord.path.trim() : "";
  const normalizedPath = rawPath === "/" ? "/" : rawPath ? `/${rawPath.replace(/^\/+|\/+$/g, "")}/` : "";
  if (!normalizedPath || normalizedPath !== String(page.path)) return null;

  const { data: brief, error: briefError } = await input.client
    .from("seo_content_briefs")
    .select("id,page_id")
    .eq("id", String(input.run.brief_id))
    .maybeSingle();
  if (briefError || !brief || (brief.page_id && String(brief.page_id) !== candidatePageId)) return null;

  const now = new Date().toISOString();
  const stateErrors = await persistAgentCompletionState({
    client: input.client,
    briefId: String(input.run.brief_id),
    assignmentId: input.run.assignment_id ? String(input.run.assignment_id) : null,
    pageId: candidatePageId,
    requestId: String(input.run.id),
    action: "agent.recovered",
    now,
    draftChecksum: input.draftChecksum,
  });
  if (stateErrors.length) {
    await input.client.from("seo_agent_runs").update({
      last_error: stateErrors.join(", ").slice(0, 4_000),
      updated_at: now,
    }).eq("id", String(input.run.id)).eq("status", "processing");
    return null;
  }

  const { data: claimed, error: completionError } = await input.client
    .from("seo_agent_runs")
    .update({ status: "completed", page_id: candidatePageId, draft_checksum: input.draftChecksum, completed_at: now, updated_at: now })
    .eq("id", String(input.run.id))
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (completionError || !claimed) return null;
  return candidatePageId;
}

async function persistAgentCompletionState(input: {
  client: ReturnType<typeof createSupabaseAdminClient>;
  briefId: string;
  assignmentId: string | null;
  pageId: string;
  requestId: string;
  action: "agent.completed" | "agent.recovered";
  now: string;
  draftChecksum: string;
}): Promise<string[]> {
  const errors: string[] = [];
  const { data: brief, error: briefError } = await input.client.from("seo_content_briefs").update({
    page_id: input.pageId,
    status: "submitted",
    submitted_at: input.now,
    updated_at: input.now,
  }).eq("id", input.briefId).in("status", ["in_progress", "assigned", "ready_for_assignment", "submitted"]).select("id").maybeSingle();
  if (briefError || !brief) errors.push(`brief_completion_persist_failed:${briefError?.code ?? "state_changed"}`);

  if (input.assignmentId) {
    const { data: assignment, error: assignmentError } = await input.client.from("seo_content_assignments").update({
      status: "completed",
      completed_at: input.now,
      updated_at: input.now,
    }).eq("id", input.assignmentId).in("status", ["assigned", "accepted", "in_progress", "completed"]).select("id").maybeSingle();
    if (assignmentError || !assignment) errors.push(`assignment_completion_persist_failed:${assignmentError?.code ?? "state_changed"}`);
  }

  const { data: existingAudits, error: auditLookupError } = await input.client
    .from("seo_content_audit_events")
    .select("id")
    .eq("entity_type", "brief")
    .eq("entity_id", input.briefId)
    .eq("action", input.action)
    .eq("request_id", input.requestId)
    .limit(1);
  if (auditLookupError) {
    errors.push(`audit_lookup_failed:${auditLookupError.code}`);
  } else if (!(existingAudits ?? []).length) {
    const { error: auditInsertError } = await input.client.from("seo_content_audit_events").insert({
      entity_type: "brief",
      entity_id: input.briefId,
      action: input.action,
      to_status: "submitted",
      request_id: input.requestId,
      metadata: { pageId: input.pageId, draftChecksum: input.draftChecksum },
      occurred_at: input.now,
    });
    if (auditInsertError) errors.push(`audit_persist_failed:${auditInsertError.code}`);
  }
  return errors;
}

function parseJson(rawBody: string): unknown {
  try { return JSON.parse(rawBody) as unknown; } catch { return null; }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readContentEmbedding(value: unknown): string | null {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length !== 1536) return null;
  if (!value.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  return `[${value.join(",")}]`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" },
  });
}
