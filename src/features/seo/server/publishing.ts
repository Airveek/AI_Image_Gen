import "server-only";

import { revalidatePath } from "next/cache";

import { inngest } from "@/features/store-images/server/inngest-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo/site";

const MINIMUM_SCORE = 85;
const MINIMUM_INBOUND_LINKS = 2;
const MINIMUM_OUTBOUND_LINKS = 4;
const PROVEN_TEMPLATE_HEALTH_DAYS = 14;

export type SeoPublishGateResult = {
  pageId: string;
  allowed: boolean;
  score: number;
  blockers: string[];
  checks: Record<string, boolean | number | string>;
};

export type SeoPublishResult = SeoPublishGateResult & {
  published: boolean;
  indexNowQueued: boolean;
};

/**
 * The only path that may turn a draft into an indexable page. It is deliberately
 * stricter than the database CHECK constraint because it validates evidence and
 * the crawl graph before the page enters a sitemap.
 */
export async function evaluateSeoPublishGate(pageId: string): Promise<SeoPublishGateResult> {
  const safePageId = pageId.trim();
  if (!safePageId) return blockedResult(pageId, ["page_id_missing"]);

  try {
    const client = createSupabaseAdminClient();
    const { data: rawPage, error: pageError } = await client
      .from("seo_pages")
      .select("id,path,status,template_version,noindex,canonical_page_id,author_id,reviewer_id,quality_score,direct_answer,primary_intent,body")
      .eq("id", safePageId)
      .maybeSingle();
    if (pageError || !rawPage) return blockedResult(safePageId, ["page_not_found"]);

    const page = rawPage as PageForGate;
    const [evidenceResult, assetsResult, sourcesResult, inboundResult, outboundResult, rolloutResult] = await Promise.all([
      client.from("seo_page_generation_runs").select("generation_run_id").eq("page_id", page.id),
      client.from("seo_assets").select("role,rights_status,qa_status,public_url").eq("page_id", page.id),
      client.from("seo_sources").select("id").eq("page_id", page.id),
      client.from("seo_links").select("source_page_id").eq("target_page_id", page.id),
      client.from("seo_links").select("target_page_id").eq("source_page_id", page.id),
      client.from("seo_template_rollouts").select("status,reviewed_page_count,healthy_since,last_incident_at").eq("template_version", page.template_version).maybeSingle(),
    ]);

    const evidenceIds = (evidenceResult.data ?? []).map((row) => String((row as { generation_run_id?: unknown }).generation_run_id ?? "")).filter(Boolean);
    const generationRuns = evidenceIds.length
      ? await client.from("seo_generation_runs").select("image_job,qa_status").in("id", evidenceIds)
      : { data: [], error: null };
    const evidenceJobs = new Set(
      (generationRuns.data ?? [])
        .filter((run) => (run as { qa_status?: string }).qa_status === "pass")
        .map((run) => (run as { image_job?: string }).image_job)
        .filter((job): job is string => Boolean(job)),
    );

    const assets = (assetsResult.data ?? []) as Array<{ role?: string; rights_status?: string; qa_status?: string; public_url?: string }>;
    const selectedAsset = assets.some((asset) =>
      (asset.role === "hero" || asset.role === "selected")
      && asset.rights_status === "approved"
      && asset.qa_status === "pass"
      && typeof asset.public_url === "string"
      && asset.public_url.startsWith("https://"),
    );
    const body = isRecord(page.body) ? page.body : {};
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const inboundLinks = inboundResult.data?.length ?? 0;
    const outboundLinks = outboundResult.data?.length ?? 0;
    const qualityScore = typeof page.quality_score === "number" ? page.quality_score : 0;
    const rollout = rolloutResult.data as Rollout | null;
    const isProvenRollout = rollout?.status === "proven";
    const healthyEnough = Boolean(
      rollout
      && rollout.reviewed_page_count >= 50
      && rollout.healthy_since
      && Date.parse(rollout.healthy_since) <= Date.now() - PROVEN_TEMPLATE_HEALTH_DAYS * 86_400_000
      && (!rollout.last_incident_at || Date.parse(rollout.last_incident_at) < Date.parse(rollout.healthy_since)),
    );

    const checks: SeoPublishGateResult["checks"] = {
      status: page.status,
      statusReady: page.status === "approved" || page.status === "scheduled",
      selfCanonical: !page.canonical_page_id,
      noindexBeforePublish: page.noindex === true,
      author: Boolean(page.author_id),
      reviewer: Boolean(page.reviewer_id),
      qualityScore,
      qualityThreshold: qualityScore >= MINIMUM_SCORE,
      directAnswer: typeof page.direct_answer === "string" && page.direct_answer.trim().length >= 40,
      primaryIntent: typeof page.primary_intent === "string" && page.primary_intent.trim().length >= 10,
      structuredSteps: steps.length >= 3,
      evidenceRuns: evidenceJobs.size,
      independentEvidence: evidenceJobs.has("listing") && evidenceJobs.has("lifestyle") && evidenceJobs.has("detail"),
      selectedAsset,
      sourceCount: sourcesResult.data?.length ?? 0,
      sourceEvidence: (sourcesResult.data?.length ?? 0) >= 1,
      inboundLinks,
      inboundLinkThreshold: inboundLinks >= MINIMUM_INBOUND_LINKS,
      outboundLinks,
      outboundLinkThreshold: outboundLinks >= MINIMUM_OUTBOUND_LINKS,
      rollout: rollout?.status ?? "missing",
      provenRolloutHealthy: healthyEnough,
    };

    const blockers: string[] = [];
    if (!checks.statusReady) blockers.push("status_not_approved_or_scheduled");
    if (!checks.selfCanonical) blockers.push("canonical_points_to_another_page");
    if (!checks.noindexBeforePublish && page.status !== "live") blockers.push("unexpected_indexability_state");
    if (!checks.author) blockers.push("author_missing");
    if (!checks.reviewer) blockers.push("reviewer_missing");
    if (!checks.qualityThreshold) blockers.push("quality_score_below_85");
    if (!checks.directAnswer) blockers.push("direct_answer_missing");
    if (!checks.primaryIntent) blockers.push("primary_intent_missing");
    if (!checks.structuredSteps) blockers.push("workflow_steps_missing");
    if (!checks.independentEvidence) blockers.push("listing_lifestyle_detail_evidence_required");
    if (!checks.selectedAsset) blockers.push("approved_selected_asset_missing");
    if (!checks.sourceEvidence) blockers.push("source_evidence_missing");
    if (!checks.inboundLinkThreshold) blockers.push("fewer_than_two_inbound_links");
    if (!checks.outboundLinkThreshold) blockers.push("related_internal_links_missing");
    if (!rollout) blockers.push("template_rollout_not_configured");
    if (isProvenRollout && !healthyEnough) blockers.push("proven_template_health_window_not_met");
    if (!isProvenRollout && page.status !== "approved") blockers.push("manual_review_required_for_new_template");

    const score = Math.max(0, Math.min(100, Math.round([
      qualityScore,
      checks.directAnswer ? 100 : 0,
      checks.structuredSteps ? 100 : 0,
      checks.independentEvidence ? 100 : 0,
      checks.selectedAsset ? 100 : 0,
      checks.sourceEvidence ? 100 : 0,
      checks.inboundLinkThreshold ? 100 : 0,
      checks.outboundLinkThreshold ? 100 : 0,
    ].reduce((sum, value) => sum + value, 0) / 8)));
    const allowed = blockers.length === 0 && score >= MINIMUM_SCORE;

    await client.from("seo_quality_runs").insert({
      page_id: page.id,
      gate_version: "seo-gate-v1",
      status: allowed ? "pass" : "fail",
      score,
      checks,
      blockers,
    });
    return { pageId: page.id, allowed, score, blockers, checks };
  } catch (error) {
    console.warn("SEO publish gate unavailable.", error instanceof Error ? error.message : "Unknown error");
    return blockedResult(safePageId, ["publish_gate_unavailable"]);
  }
}

export async function publishSeoPage(pageId: string, options: { batchId?: string } = {}): Promise<SeoPublishResult> {
  const gate = await evaluateSeoPublishGate(pageId);
  if (!gate.allowed) return { ...gate, published: false, indexNowQueued: false };
  if (process.env.SEO_AUTOMATION_ENABLED !== "true") {
    return { ...gate, allowed: false, blockers: ["seo_automation_disabled"], published: false, indexNowQueued: false };
  }

  try {
    const client = createSupabaseAdminClient();
    const { data: page, error: pageError } = await client.from("seo_pages").select("id,path,published_at,search_lastmod_at").eq("id", pageId).maybeSingle();
    if (pageError || !page) return { ...gate, allowed: false, blockers: ["page_not_found"], published: false, indexNowQueued: false };
    const now = new Date().toISOString();

    if (options.batchId) {
      const { count } = await client.from("seo_publish_batch_pages").select("page_id", { count: "exact", head: true }).eq("batch_id", options.batchId).in("status", ["warming", "live"]);
      if ((count ?? 0) >= 50) return { ...gate, allowed: false, blockers: ["publish_wave_capacity_reached"], published: false, indexNowQueued: false };
      await client.from("seo_publish_batch_pages").upsert({ batch_id: options.batchId, page_id: pageId, status: "warming", updated_at: now }, { onConflict: "batch_id,page_id" });
    }

    const { data: publishedPage, error: updateError } = await client
      .from("seo_pages")
      .update({ status: "live", noindex: false, published_at: page.published_at ?? now, search_lastmod_at: now, updated_at: now })
      .eq("id", pageId)
      .in("status", ["approved", "scheduled"])
      .select("id,status")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!publishedPage || publishedPage.status !== "live") {
      return { ...gate, allowed: false, blockers: ["page_changed_before_publish"], published: false, indexNowQueued: false };
    }
    const canonicalUrl = absoluteUrl(page.path);
    const { error: stateError } = await client.from("seo_url_state").upsert({ page_id: pageId, canonical_url: canonicalUrl, sitemap_url: absoluteUrl("/sitemap.xml"), eligible_for_indexing: true, first_published_at: page.published_at ?? now, updated_at: now }, { onConflict: "page_id" });
    if (stateError) {
      await client.from("seo_pages").update({ status: "qa_failed", noindex: true, search_lastmod_at: now, updated_at: now }).eq("id", pageId).eq("status", "live");
      throw stateError;
    }
    if (options.batchId) await client.from("seo_publish_batch_pages").update({ status: "live", updated_at: now }).eq("batch_id", options.batchId).eq("page_id", pageId);

    for (const path of [page.path, "/product-photography", "/product-photo-prompts", "/tutorials", "/sitemap.xml"]) {
      try { revalidatePath(path); } catch { /* Inngest has no request cache context; the next request still sees the DB row. */ }
    }
    let indexNowQueued = false;
    try {
      await inngest.send({ name: "seo/page.published", data: { pageId, canonicalUrl, publishedAt: now } });
      indexNowQueued = true;
    } catch (error) {
      console.warn("IndexNow propagation event could not be queued.", error instanceof Error ? error.message : "Unknown error");
    }
    return { ...gate, published: true, indexNowQueued };
  } catch (error) {
    console.warn("SEO page publish failed.", error instanceof Error ? error.message : "Unknown error");
    return { ...gate, allowed: false, blockers: ["publish_transaction_failed"], published: false, indexNowQueued: false };
  }
}

type PageForGate = {
  id: string;
  path: string;
  status: string;
  template_version: string;
  noindex: boolean;
  canonical_page_id: string | null;
  author_id: string | null;
  reviewer_id: string | null;
  quality_score: number | null;
  direct_answer: string;
  primary_intent: string;
  body: unknown;
};

type Rollout = {
  status: string;
  reviewed_page_count: number;
  healthy_since: string | null;
  last_incident_at: string | null;
};

function blockedResult(pageId: string, blockers: string[]): SeoPublishGateResult {
  return { pageId, allowed: false, score: 0, blockers, checks: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
