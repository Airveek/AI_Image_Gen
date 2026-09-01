"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage, requireAdminUser } from "@/features/admin/server/authorization";
import { assignSeoBrief, createSeoBrief, recordSeoReviewDecision, reviewSeoRights, updateSeoTemplateRollout } from "@/features/seo/server/content-operations";
import { updateSeoRecommendationStatus } from "@/features/seo/server/control-plane";
import { isSeoRecommendationStatus, type SeoRecommendationStatus } from "@/features/seo/recommendation-contract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SeoOperationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSIGNMENT_ROLES = new Set(["researcher", "brief_lead", "writer", "editor", "reviewer", "publisher"]);
const REVIEW_TYPES = new Set(["research", "rights", "workflow", "draft", "quality", "editorial", "publish", "refresh"]);
const DECISIONS = new Set(["approved", "changes_requested", "rejected", "merged", "deferred"]);
const PAGE_FAMILIES = new Set(["product-hub", "category-hub", "listing", "lifestyle", "detail", "prompt", "tutorial", "feature"]);
const TEMPLATE_ROLLOUT_STATUSES = new Set(["manual_review", "proven", "paused"]);

export async function createSeoBriefAction(
  _previousState: SeoOperationActionState,
  formData: FormData,
): Promise<SeoOperationActionState> {
  try {
    await requireAdminUser();
    const productEntity = requiredField(formData, "productEntity");
    const pageFamily = requiredField(formData, "pageFamily");
    const primaryQuery = requiredField(formData, "primaryQuery");
    const intentKey = requiredField(formData, "intentKey");
    const buyerQuestion = requiredField(formData, "buyerQuestion");
    if (!PAGE_FAMILIES.has(pageFamily)) throw new Error("Choose a valid SEO page family.");
    const evidence = [1, 2, 3].map((index) => ({
      url: requiredField(formData, `evidenceUrl${index}`),
      title: requiredField(formData, `evidenceTitle${index}`),
      accessedAt: requiredField(formData, `evidenceAccessedAt${index}`),
      claimSupported: requiredField(formData, `evidenceClaim${index}`),
    }));
    for (const item of evidence) {
      let parsed: URL;
      try { parsed = new URL(item.url); } catch { throw new Error("Each evidence source must be a valid HTTPS URL."); }
      if (parsed.protocol !== "https:" || !parsed.hostname) throw new Error("Each evidence source must use HTTPS.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.accessedAt)) throw new Error("Each evidence source needs an access date in YYYY-MM-DD format.");
      if (item.claimSupported.length < 10) throw new Error("Each evidence source needs a claim or signal it supports.");
    }
    const priority = readPriority(formData.get("priority"));
    const opportunityScore = readOptionalScore(formData.get("opportunityScore"));
    const result = await createSeoBrief({
      briefKey: readText(formData.get("briefKey"), 160),
      productEntity,
      pageFamily: pageFamily as "product-hub" | "category-hub" | "listing" | "lifestyle" | "detail" | "prompt" | "tutorial" | "feature",
      primaryQuery,
      intentKey,
      buyerQuestion,
      evidence,
      opportunityScore,
      priority,
      templateVersion: readText(formData.get("templateVersion"), 40),
    });
    revalidatePath("/admin/seo");
    return { status: "success", message: `Brief ${result.briefKey} created. It remains rights/review gated until evidence and workflow checks pass.` };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function assignSeoBriefAction(
  _previousState: SeoOperationActionState,
  formData: FormData,
): Promise<SeoOperationActionState> {
  try {
    await requireAdminUser();
    const briefId = requiredField(formData, "briefId");
    const assigneeId = requiredField(formData, "assigneeId");
    const assignmentRole = requiredField(formData, "assignmentRole");
    if (!UUID_PATTERN.test(briefId) || !UUID_PATTERN.test(assigneeId)) throw new Error("Choose a valid brief and content member.");
    if (!ASSIGNMENT_ROLES.has(assignmentRole)) throw new Error("Choose a valid assignment role.");
    const priority = readPriority(formData.get("priority"));
    await assignSeoBrief({
      briefId,
      assigneeId,
      assignmentRole: assignmentRole as "researcher" | "brief_lead" | "writer" | "editor" | "reviewer" | "publisher",
      priority,
      dueAt: readTimestamp(formData.get("dueAt")),
      notes: readText(formData.get("notes"), 4_000),
    });
    revalidatePath("/admin/seo");
    return { status: "success", message: "Assignment saved. The worker will only claim it when the member role is active and compatible." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function recordSeoReviewDecisionAction(
  _previousState: SeoOperationActionState,
  formData: FormData,
): Promise<SeoOperationActionState> {
  try {
    await requireAdminUser();
    const briefId = requiredField(formData, "briefId");
    const reviewType = requiredField(formData, "reviewType");
    const decision = requiredField(formData, "decision");
    const contentVersion = requiredField(formData, "contentVersion");
    if (!UUID_PATTERN.test(briefId)) throw new Error("Choose a valid brief.");
    if (!REVIEW_TYPES.has(reviewType) || !DECISIONS.has(decision)) throw new Error("Choose a valid review type and decision.");
    if (reviewType === "rights" && decision === "approved") {
      throw new Error("Use pnpm seo:review-evidence for rights approval so the reviewer, checksum, and evidence item are persisted together.");
    }
    if (contentVersion.length > 120) throw new Error("Content version is too long.");
    const score = readOptionalScore(formData.get("score"));
    const blockers = readText(formData.get("blockers"), 4_000)
      ?.split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100) ?? [];
    const client = createSupabaseAdminClient();
    const { data: brief, error: briefError } = await client
      .from("seo_content_briefs")
      .select("page_id")
      .eq("id", briefId)
      .maybeSingle();
    if (briefError) throw new Error("The selected brief could not be loaded.");
    if (!brief) throw new Error("The selected brief does not exist.");
    await recordSeoReviewDecision({
      briefId,
      pageId: typeof brief.page_id === "string" ? brief.page_id : null,
      reviewType: reviewType as "research" | "rights" | "workflow" | "draft" | "quality" | "editorial" | "publish" | "refresh",
      decision: decision as "approved" | "changes_requested" | "rejected" | "merged" | "deferred",
      contentVersion,
      score,
      checklist: {
        operatorReview: true,
        reviewedFrom: "admin/seo",
        blockerCount: blockers.length,
      },
      blockers,
      notes: readText(formData.get("notes"), 8_000),
    });
    revalidatePath("/admin/seo");
    return { status: "success", message: `Review recorded as ${decision}. Publishing and indexability remain separately gated.` };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function reviewSeoRightsAction(
  _previousState: SeoOperationActionState,
  formData: FormData,
): Promise<SeoOperationActionState> {
  try {
    await requireAdminUser();
    const briefId = requiredField(formData, "briefId");
    const rightsEvidenceId = requiredField(formData, "rightsEvidenceId");
    const rawChecksum = requiredField(formData, "sourceChecksum").toLowerCase().replace(/^sha256:/, "");
    if (!UUID_PATTERN.test(briefId)) throw new Error("Choose a valid brief.");
    if (!/^[a-f0-9]{64}$/.test(rawChecksum)) throw new Error("Source checksum must be a 64-character SHA-256 hex digest.");
    const sourceUrl = readText(formData.get("sourceUrl"), 2_000);
    if (sourceUrl) {
      let parsed: URL;
      try { parsed = new URL(sourceUrl); } catch { throw new Error("Source URL must be a valid HTTPS URL."); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Source URL must use HTTPS.");
    }
    const result = await reviewSeoRights({
      briefId,
      rightsEvidenceId,
      sourceChecksum: rawChecksum,
      sourceUrl,
      sourceLabel: readText(formData.get("sourceLabel"), 500),
      reviewAfter: readTimestamp(formData.get("reviewAfter")),
      notes: readText(formData.get("notes"), 8_000),
    });
    revalidatePath("/admin/seo");
    return { status: "success", message: result.action === "idempotent_rights_approval" ? "Rights approval already exists for this exact source and checksum." : "Rights approval recorded. Draft and publishing gates remain separate." };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function updateSeoTemplateRolloutAction(
  _previousState: SeoOperationActionState,
  formData: FormData,
): Promise<SeoOperationActionState> {
  try {
    await requireAdminUser();
    const templateVersion = requiredField(formData, "templateVersion");
    const status = requiredField(formData, "status");
    if (!TEMPLATE_ROLLOUT_STATUSES.has(status)) throw new Error("Choose a valid template rollout status.");
    const reviewedPageCount = readWholeNumber(formData.get("reviewedPageCount"), "Reviewed page count", 0, 100_000);
    const rollout = await updateSeoTemplateRollout({
      templateVersion,
      status: status as "manual_review" | "proven" | "paused",
      reviewedPageCount,
      healthySince: readText(formData.get("healthySince"), 80),
      lastIncidentAt: readText(formData.get("lastIncidentAt"), 80),
      notes: readText(formData.get("notes"), 2_000),
    });
    revalidatePath("/admin/seo");
    return { status: "success", message: `${rollout.templateVersion} rollout saved as ${rollout.status}. No page was published or made indexable.` };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

export async function updateSeoRecommendationAction(
  _previousState: SeoOperationActionState,
  formData: FormData,
): Promise<SeoOperationActionState> {
  try {
    await requireAdminUser();
    const recommendationId = requiredField(formData, "recommendationId");
    const statusValue = requiredField(formData, "status");
    if (!UUID_PATTERN.test(recommendationId)) throw new Error("Choose a valid recommendation.");
    if (!isSeoRecommendationStatus(statusValue)) throw new Error("Choose a valid recommendation status.");
    const resolutionNote = readText(formData.get("resolutionNote"), 4_000);
    await updateSeoRecommendationStatus({
      recommendationId,
      status: statusValue as SeoRecommendationStatus,
      resolutionNote,
    });
    revalidatePath("/admin/seo");
    return { status: "success", message: `Recommendation marked ${statusValue.replace("_", " ")}.` };
  } catch (error) {
    return { status: "error", message: getActionErrorMessage(error) };
  }
}

function requiredField(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function readText(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function readPriority(value: FormDataEntryValue | null): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : 50;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) throw new Error("Priority must be a whole number from 0 to 100.");
  return parsed;
}

function readOptionalScore(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) throw new Error("Score must be a whole number from 0 to 100.");
  return parsed;
}

function readWholeNumber(value: FormDataEntryValue | null, label: string, minimum: number, maximum: number): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} must be a whole number from ${minimum.toLocaleString()} to ${maximum.toLocaleString()}.`);
  return parsed;
}

function readTimestamp(value: FormDataEntryValue | null): string | null {
  const text = readText(value, 80);
  if (!text) return null;
  const timestamp = new Date(text);
  if (Number.isNaN(timestamp.getTime())) throw new Error("Due date must be a valid timestamp.");
  return timestamp.toISOString();
}
