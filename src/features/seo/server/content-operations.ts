import "server-only";

import { createHash } from "node:crypto";

import { requireAdminUser } from "@/features/admin/server/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SeoBriefQueueItem = {
  id: string;
  pageId: string | null;
  briefKey: string;
  pageFamily: string;
  productEntity: string;
  primaryQuery: string;
  normalizedIntentKey: string;
  priority: number;
  status: string;
  rightsStatus: "unreviewed" | "approved" | "restricted" | "rejected";
  sourceAssetPath: string | null;
  sourceAssetChecksum: string | null;
  dueAt: string | null;
  createdAt: string;
};

export type SeoContentMemberOption = {
  userId: string;
  displayName: string;
  role: "writer" | "brief_lead" | "editor" | "publisher" | "seo_admin";
};

export type SeoAssignmentQueueItem = {
  id: string;
  briefId: string;
  assigneeId: string;
  assignmentRole: string;
  status: string;
  priority: number;
  dueAt: string | null;
};

export type SeoTemplateRollout = {
  templateVersion: string;
  status: "manual_review" | "proven" | "paused";
  reviewedPageCount: number;
  healthySince: string | null;
  lastIncidentAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type SeoBriefInput = {
  briefKey?: string | null;
  productEntity: string;
  pageFamily: "product-hub" | "category-hub" | "listing" | "lifestyle" | "detail" | "prompt" | "tutorial" | "feature";
  primaryQuery: string;
  intentKey: string;
  buyerQuestion: string;
  evidence: Array<{ url: string; title: string; accessedAt: string; claimSupported: string }>;
  opportunityScore?: number | null;
  priority?: number;
  templateVersion?: string | null;
};

export async function listSeoOperationsQueue(limit = 500): Promise<{
  briefs: SeoBriefQueueItem[];
  assignments: SeoAssignmentQueueItem[];
  members: SeoContentMemberOption[];
  rollouts: SeoTemplateRollout[];
}> {
  await requireAdminUser();
  const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(500, limit)) : 100;
  const client = createSupabaseAdminClient();
  const [briefsResult, assignmentsResult, membersResult, rolloutsResult, rightsPacketsResult, rightsItemsResult] = await Promise.all([
    client
      .from("seo_content_briefs")
      .select("id,page_id,brief_key,page_family,product_entity,primary_query,normalized_intent_key,priority,status,due_at,created_at,brief")
      .not("status", "in", "(archived,merged)")
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(safeLimit),
    client
      .from("seo_content_assignments")
      .select("id,brief_id,assignee_id,assignment_role,status,priority,due_at")
      .not("status", "in", "(completed,reassigned,cancelled)")
      .order("priority", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(safeLimit),
    client
      .from("content_members")
      .select("user_id,display_name,role")
      .eq("is_active", true)
      .in("role", ["writer", "brief_lead", "editor", "publisher", "seo_admin"])
      .order("display_name", { ascending: true })
      .limit(500),
    client
      .from("seo_template_rollouts")
      .select("template_version,status,reviewed_page_count,healthy_since,last_incident_at,notes,updated_at")
      .order("template_version", { ascending: true })
      .limit(200),
    client
      .from("seo_evidence_packets")
      .select("id,brief_id,status,rights_status,version,updated_at")
      .eq("packet_type", "rights")
      .order("version", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(safeLimit),
    client
      .from("seo_evidence_items")
      .select("packet_id,item_type,rights_status,metadata")
      .eq("item_type", "rights")
      .eq("rights_status", "approved")
      .limit(safeLimit),
  ]);
  if (briefsResult.error || assignmentsResult.error || membersResult.error || rolloutsResult.error || rightsPacketsResult.error || rightsItemsResult.error) {
    throw new Error("SEO content operations are not ready. Apply migration 202608300009 before opening the queue.");
  }
  const approvedChecksumByPacket = new Map<string, string>();
  for (const row of rightsItemsResult.data ?? []) {
    const metadata = isRecord(row.metadata) ? row.metadata : {};
    const rawChecksum = typeof metadata.sourceAssetChecksum === "string" ? metadata.sourceAssetChecksum.trim().toLowerCase() : "";
    const checksum = rawChecksum.replace(/^sha256:/, "");
    if (typeof row.packet_id === "string" && /^[a-f0-9]{64}$/.test(checksum)) {
      approvedChecksumByPacket.set(String(row.packet_id), `sha256:${checksum}`);
    }
  }
  const rightsByBrief = new Map<string, { status: SeoBriefQueueItem["rightsStatus"]; checksum: string | null }>();
  for (const row of rightsPacketsResult.data ?? []) {
    const briefId = typeof row.brief_id === "string" ? row.brief_id : "";
    if (!briefId || rightsByBrief.has(briefId)) continue;
    const rawStatus = String(row.rights_status ?? "unreviewed");
    const status = rawStatus === "approved" || rawStatus === "restricted" || rawStatus === "rejected" ? rawStatus : "unreviewed";
    rightsByBrief.set(briefId, { status, checksum: approvedChecksumByPacket.get(String(row.id)) ?? null });
  }
  return {
    briefs: (briefsResult.data ?? []).map((row) => ({
      id: String(row.id),
      pageId: typeof row.page_id === "string" ? row.page_id : null,
      briefKey: String(row.brief_key),
      pageFamily: String(row.page_family),
      productEntity: String(row.product_entity),
      primaryQuery: String(row.primary_query),
      normalizedIntentKey: String(row.normalized_intent_key),
      priority: numberValue(row.priority),
      status: String(row.status),
      rightsStatus: rightsByBrief.get(String(row.id))?.status ?? "unreviewed",
      sourceAssetPath: briefSourceAssetPath(row.brief),
      sourceAssetChecksum: rightsByBrief.get(String(row.id))?.checksum ?? briefSourceAssetChecksum(row.brief),
      dueAt: stringValue(row.due_at),
      createdAt: String(row.created_at),
    })),
    assignments: (assignmentsResult.data ?? []).map((row) => ({
      id: String(row.id),
      briefId: String(row.brief_id),
      assigneeId: String(row.assignee_id),
      assignmentRole: String(row.assignment_role),
      status: String(row.status),
      priority: numberValue(row.priority),
      dueAt: stringValue(row.due_at),
    })),
    members: (membersResult.data ?? []).flatMap((row) => {
      const role = row.role;
      if (!isContentMemberRole(role)) return [];
      return [{ userId: String(row.user_id), displayName: String(row.display_name), role }];
    }),
    rollouts: (rolloutsResult.data ?? []).flatMap((row) => {
      const status = row.status;
      if (status !== "manual_review" && status !== "proven" && status !== "paused") return [];
      return [{
        templateVersion: String(row.template_version),
        status,
        reviewedPageCount: numberValue(row.reviewed_page_count),
        healthySince: stringValue(row.healthy_since),
        lastIncidentAt: stringValue(row.last_incident_at),
        notes: stringValue(row.notes),
        updatedAt: String(row.updated_at),
      }];
    }),
  };
}

function briefSourceAssetPath(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const manifest = isRecord(value.sourceAssetManifest) ? value.sourceAssetManifest : {};
  const sourcePath = typeof manifest.path === "string" ? manifest.path : value.sourceAssetPath;
  return typeof sourcePath === "string" && sourcePath.trim() ? sourcePath.trim() : null;
}

function briefSourceAssetChecksum(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const manifest = isRecord(value.sourceAssetManifest) ? value.sourceAssetManifest : {};
  const checksum = typeof manifest.checksum === "string" ? manifest.checksum.trim().toLowerCase() : "";
  return /^sha256:[a-f0-9]{64}$/.test(checksum) ? checksum : null;
}

export async function updateSeoTemplateRollout(input: {
  templateVersion: string;
  status: SeoTemplateRollout["status"];
  reviewedPageCount: number;
  healthySince?: string | null;
  lastIncidentAt?: string | null;
  notes?: string | null;
}): Promise<SeoTemplateRollout> {
  await requireAdminUser();
  const templateVersion = input.templateVersion.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(templateVersion)) {
    throw new Error("Template version must use letters, numbers, dots, underscores, or hyphens.");
  }
  if (!["manual_review", "proven", "paused"].includes(input.status)) {
    throw new Error("Choose a valid template rollout status.");
  }
  const reviewedPageCount = Number.isInteger(input.reviewedPageCount) ? input.reviewedPageCount : -1;
  if (reviewedPageCount < 0 || reviewedPageCount > 100_000) {
    throw new Error("Reviewed page count must be a whole number from 0 to 100,000.");
  }
  const healthySince = normalizeTimestamp(input.healthySince);
  const lastIncidentAt = normalizeTimestamp(input.lastIncidentAt);
  if (input.status === "proven") {
    if (reviewedPageCount < 50 || !healthySince) {
      throw new Error("A proven template requires at least 50 reviewed pages and a healthy-since timestamp.");
    }
    const healthyAt = Date.parse(healthySince);
    if (!Number.isFinite(healthyAt) || healthyAt > Date.now() - 14 * 86_400_000) {
      throw new Error("A template can be marked proven only after 14 healthy days have elapsed.");
    }
    if (lastIncidentAt && Date.parse(lastIncidentAt) >= healthyAt) {
      throw new Error("The last incident must be before the healthy-since timestamp.");
    }
  }
  const client = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await client
    .from("seo_template_rollouts")
    .select("notes")
    .eq("template_version", templateVersion)
    .maybeSingle();
  if (existingError) throw new Error(`Template rollout could not be loaded: ${existingError.message}`);
  const { data, error } = await client
    .from("seo_template_rollouts")
    .upsert({
      template_version: templateVersion,
      status: input.status,
      reviewed_page_count: reviewedPageCount,
      healthy_since: healthySince,
      last_incident_at: lastIncidentAt,
      notes: input.notes?.trim().slice(0, 2_000) || existing?.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "template_version" })
    .select("template_version,status,reviewed_page_count,healthy_since,last_incident_at,notes,updated_at")
    .single();
  if (error || !data) throw new Error(`Template rollout could not be saved: ${error?.message ?? "unknown error"}`);
  const status = data.status;
  if (status !== "manual_review" && status !== "proven" && status !== "paused") throw new Error("Template rollout returned an invalid status.");
  return {
    templateVersion: String(data.template_version),
    status,
    reviewedPageCount: numberValue(data.reviewed_page_count),
    healthySince: stringValue(data.healthy_since),
    lastIncidentAt: stringValue(data.last_incident_at),
    notes: stringValue(data.notes),
    updatedAt: String(data.updated_at),
  };
}

export async function createSeoBrief(input: SeoBriefInput): Promise<{ briefId: string; briefKey: string }> {
  await requireAdminUser();
  const productEntity = input.productEntity.trim().slice(0, 180);
  const primaryQuery = input.primaryQuery.trim().slice(0, 240);
  const intentKey = slugify(input.intentKey).slice(0, 160);
  const buyerQuestion = input.buyerQuestion.trim().slice(0, 500);
  const briefKey = slugify(input.briefKey?.trim() || `${productEntity}-${intentKey}`).slice(0, 160);
  const evidence = input.evidence.map((item) => ({
    type: "source",
    url: item.url.trim(),
    title: item.title.trim().slice(0, 300),
    accessedAt: item.accessedAt.trim(),
    claimSupported: item.claimSupported.trim().slice(0, 1_000),
  }));
  if (productEntity.length < 2 || primaryQuery.length < 2 || intentKey.length < 10 || buyerQuestion.length < 10) {
    throw new Error("Product, query, intent key, and buyer question must be complete.");
  }
  if (briefKey.length < 8 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(briefKey)) throw new Error("Brief key must be a valid slug.");
  if (evidence.length < 3 || evidence.some((item) => (
    !/^https:\/\//.test(item.url)
    || item.title.length < 2
    || !/^\d{4}-\d{2}-\d{2}$/.test(item.accessedAt)
    || item.claimSupported.length < 10
  ))) {
    throw new Error("Add at least three HTTPS evidence sources with a label, access date, and claim supported.");
  }
  const client = createSupabaseAdminClient();
  const payload = {
    briefKey,
    topic: {
      locale: "en",
      kind: input.pageFamily === "tutorial" || input.pageFamily === "feature" ? input.pageFamily : input.pageFamily === "category-hub" ? "category" : "product",
      name: productEntity.slice(0, 160),
      slug: slugify(productEntity),
    },
    pageFamily: input.pageFamily,
    productEntity,
    primaryQuery,
    normalizedIntentKey: intentKey,
    buyerQuestion,
    demandEvidence: evidence,
    opportunityScore: Number.isInteger(input.opportunityScore) ? Math.max(0, Math.min(100, input.opportunityScore as number)) : null,
    priority: Number.isInteger(input.priority) ? Math.max(0, Math.min(100, input.priority as number)) : 50,
    templateVersion: input.templateVersion?.trim().slice(0, 40) || "seo-v1",
  };
  const { data, error } = await client.rpc("create_seo_brief_handoff", { p_payload: payload });
  if (error || !isRecord(data) || typeof data.briefId !== "string" || typeof data.briefKey !== "string") {
    throw new Error(`SEO brief could not be created: ${error?.message ?? "invalid handoff response"}`);
  }
  return { briefId: data.briefId, briefKey: data.briefKey };
}

export async function assignSeoBrief(input: {
  briefId: string;
  assigneeId: string;
  assignmentRole: "researcher" | "brief_lead" | "writer" | "editor" | "reviewer" | "publisher";
  priority?: number;
  dueAt?: string | null;
  notes?: string | null;
}): Promise<string> {
  const actor = await requireAdminUser();
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("assign_seo_brief", {
    p_brief_id: input.briefId,
    p_assignee_id: input.assigneeId,
    p_assignment_role: input.assignmentRole,
    p_priority: Number.isInteger(input.priority) ? Math.max(0, Math.min(100, input.priority as number)) : 50,
    p_due_at: input.dueAt ?? null,
    p_notes: input.notes?.slice(0, 4_000) ?? null,
    p_assigned_by: actor.id,
  });
  if (error || !data) throw new Error(`SEO assignment could not be saved: ${error?.message ?? "unknown error"}`);
  return String(data);
}

export async function recordSeoReviewDecision(input: {
  briefId: string;
  pageId?: string | null;
  packetId?: string | null;
  reviewType: "research" | "rights" | "workflow" | "draft" | "quality" | "editorial" | "publish" | "refresh";
  decision: "approved" | "changes_requested" | "rejected" | "merged" | "deferred";
  contentVersion: string;
  score?: number | null;
  checklist?: Record<string, unknown>;
  blockers?: string[];
  notes?: string | null;
}): Promise<string> {
  const actor = await requireAdminUser();
  const client = createSupabaseAdminClient();
  const score = input.score == null ? null : Math.max(0, Math.min(100, Math.round(input.score)));
  if (input.decision === "approved" && (score ?? 0) < 85) {
    throw new Error("An approved SEO review requires a score of at least 85.");
  }
  if (input.decision === "approved" && (input.blockers?.length ?? 0) > 0) {
    throw new Error("An approved SEO review cannot contain blockers.");
  }
  const { data, error } = await client.rpc("record_seo_review_decision", {
    p_brief_id: input.briefId,
    p_page_id: input.pageId ?? null,
    p_packet_id: input.packetId ?? null,
    p_review_type: input.reviewType,
    p_decision: input.decision,
    p_content_version: input.contentVersion.slice(0, 120),
    p_reviewer_id: actor.id,
    p_score: score,
    p_checklist: input.checklist ?? {},
    p_blockers: (input.blockers ?? []).slice(0, 100),
    p_notes: input.notes?.slice(0, 8_000) ?? null,
  });
  if (error || !data) throw new Error(`SEO review decision could not be saved: ${error?.message ?? "unknown error"}`);
  return String(data);
}

export async function reviewSeoRights(input: {
  briefId: string;
  rightsEvidenceId: string;
  sourceChecksum: string;
  sourceUrl?: string | null;
  sourceLabel?: string | null;
  reviewAfter?: string | null;
  notes?: string | null;
}): Promise<Record<string, unknown>> {
  const actor = await requireAdminUser();
  const checksum = input.sourceChecksum.trim().toLowerCase().replace(/^sha256:/, "");
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Source checksum must be a SHA-256 hex digest.");
  const rightsEvidenceId = input.rightsEvidenceId.trim();
  if (rightsEvidenceId.length < 3 || rightsEvidenceId.length > 200) throw new Error("Rights evidence ID must be 3–200 characters.");
  const sourceUrl = input.sourceUrl?.trim() || null;
  if (sourceUrl) {
    let parsed: URL;
    try { parsed = new URL(sourceUrl); } catch { throw new Error("Source URL must be a valid HTTPS URL."); }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Source URL must use HTTPS.");
  }
  const itemKey = `rights:${sha256(rightsEvidenceId).slice(0, 32)}`;
  const requestId = `rights-review:${input.briefId}:${sha256(rightsEvidenceId).slice(0, 16)}:${checksum}`.slice(0, 180);
  const { data, error } = await createSupabaseAdminClient().rpc("review_seo_rights", {
    p_brief_id: input.briefId,
    p_reviewer_id: actor.id,
    p_rights_evidence_id: rightsEvidenceId,
    p_source_checksum: `sha256:${checksum}`,
    p_item_key: itemKey,
    p_request_id: requestId,
    p_source_url: sourceUrl,
    p_source_label: input.sourceLabel?.trim().slice(0, 500) || null,
    p_review_after: input.reviewAfter ?? null,
    p_notes: input.notes?.trim().slice(0, 8_000) || null,
    p_reviewed_at: new Date().toISOString(),
  });
  if (error || !isRecord(data)) throw new Error(`SEO rights review could not be saved: ${error?.message ?? "invalid response"}`);
  return data;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isContentMemberRole(value: unknown): value is SeoContentMemberOption["role"] {
  return value === "writer" || value === "brief_lead" || value === "editor" || value === "publisher" || value === "seo_admin";
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value.trim()) ? `${value.trim()}:00Z` : value.trim();
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new Error("Rollout timestamps must be valid dates.");
  return parsed.toISOString();
}
