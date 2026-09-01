import "server-only";

import { revalidatePath } from "next/cache";

import { inngest } from "@/features/store-images/server/inngest-client";
import { upsertSeoAlert } from "@/features/seo/server/control-plane";
import { listSeoSitemapShards } from "@/features/seo/server/content";
import { crawlSeoPage } from "@/features/seo/server/providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/seo/site";
import { SITEMAP_FAMILY_SLUGS } from "@/lib/seo/sitemap";

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
 * stricter than the database CHECK constraint because it validates the public
 * render and crawl graph before the page enters a sitemap. Rights/evidence
 * checks are conditional on the operator-controlled reader-first mode flag.
 */
export async function evaluateSeoPublishGate(pageId: string): Promise<SeoPublishGateResult> {
  const safePageId = pageId.trim();
  if (!safePageId) return blockedResult(pageId, ["page_id_missing"]);

  try {
    const client = createSupabaseAdminClient();
    const { data: rawPage, error: pageError } = await client
      .from("seo_pages")
      .select("id,path,status,template_version,noindex,canonical_page_id,author_id,reviewer_id,quality_score,direct_answer,primary_intent,body,intent_collision_status")
      .eq("id", safePageId)
      .maybeSingle();
    if (pageError || !rawPage) return blockedResult(safePageId, ["page_not_found"]);

    // Evidence enforcement has two independent controls so the owner can
    // pause/resume this publishing mode without a schema rewrite or deploy.
    // A missing/temporarily unreadable mode row fails open to reader-first
    // (technical and content-quality checks below still remain mandatory).
    const { data: modeConfig, error: modeConfigError } = await client
      .from("seo_automation_config")
      .select("evidence_gates_enabled")
      .eq("id", true)
      .maybeSingle();
    const enforceEvidence = !modeConfigError
      && process.env.SEO_EVIDENCE_GATES_ENABLED?.trim().toLowerCase() === "true"
      && modeConfig?.evidence_gates_enabled === true;

    const page = rawPage as PageForGate;
    const canonicalUrl = absoluteUrl(page.path);
    const [evidenceResult, assetsResult, sourcesResult, inboundResult, outboundResult, inboundEdgeResult, outboundEdgeResult, rolloutResult] = await Promise.all([
      client.from("seo_page_generation_runs").select("generation_run_id").eq("page_id", page.id),
      client.from("seo_assets").select("id,role,rights_status,qa_status,public_url,checksum,provenance,generation_metadata").eq("page_id", page.id),
      client.from("seo_sources").select("id").eq("page_id", page.id),
      client.from("seo_links").select("source_page_id").eq("target_page_id", page.id),
      client.from("seo_links").select("target_page_id").eq("source_page_id", page.id),
      // Draft ingestion stores normalized crawlable paths with a trailing
      // slash, while the canonical URL helper intentionally emits the
      // slashless origin form. Accept both representations at the gate so a
      // valid edge is not misclassified as an orphan solely because of slash
      // normalization.
      client.from("seo_link_edges").select("source_url").in("target_url", [canonicalUrl, `${canonicalUrl}/`]),
      client.from("seo_link_edges").select("target_url").in("source_url", [canonicalUrl, `${canonicalUrl}/`]),
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

    const assets = (assetsResult.data ?? []) as Array<{ id?: string; role?: string; rights_status?: string; qa_status?: string; public_url?: string; checksum?: string; provenance?: string; generation_metadata?: unknown }>;
    const selectedAsset = assets.some((asset) =>
      (asset.role === "hero" || asset.role === "selected")
      && typeof asset.public_url === "string"
      && asset.public_url.startsWith("https://"),
    );
    const body = isRecord(page.body) ? page.body : {};
    const steps = Array.isArray(body.steps) ? body.steps : [];
    const negativeConstraints = Array.isArray(body.negativeConstraints) ? body.negativeConstraints.filter((item) => typeof item === "string" && item.trim()) : [];
    const checklist = Array.isArray(body.checklist) ? body.checklist.filter((item) => typeof item === "string" && item.trim()) : [];
    const limitations = Array.isArray(body.limitations) ? body.limitations.filter((item) => typeof item === "string" && item.trim()) : [];
    const faqs = Array.isArray(body.faqs) ? body.faqs.filter((item) => isRecord(item) && typeof item.question === "string" && typeof item.answer === "string") : [];
    const selectedOutputs = Array.isArray(body.selectedOutputs) ? body.selectedOutputs : [];
    const rejectedOutputs = Array.isArray(body.rejectedOutputs) ? body.rejectedOutputs : [];
    const sourceAsset = isRecord(body.sourceAsset) ? body.sourceAsset : {};
    const platform = isRecord(body.platform) ? body.platform : {};
    // Draft contracts use a stable external asset id before ingestion. Once
    // persisted, the database also has an internal UUID, so accept either
    // representation when resolving the approved source record.
    const sourceRecord = assets.find((asset) => {
      if (asset.role !== "source") return false;
      if (!sourceAsset.assetId) return true;
      if (asset.id === sourceAsset.assetId) return true;
      return isRecord(asset.generation_metadata)
        && asset.generation_metadata.externalAssetId === sourceAsset.assetId;
    });
    const sourceAssetChecksum = normalizeAssetChecksum(sourceAsset.checksum);
    const sourceRecordChecksum = normalizeAssetChecksum(sourceRecord?.checksum);
    const sourceRightsEvidenceId = isRecord(sourceRecord?.generation_metadata)
      && typeof sourceRecord.generation_metadata.rightsEvidenceId === "string"
      ? sourceRecord.generation_metadata.rightsEvidenceId
      : null;
    const sourceAssetMetadata = !enforceEvidence || (Boolean(sourceRecord)
      && ["approved", "owned", "user-supplied", "licensed"].includes(String(sourceAsset.rightsStatus ?? sourceRecord?.rights_status ?? ""))
      && sourceRecord?.rights_status === "approved"
      && typeof sourceRecord.public_url === "string"
      && sourceRecord.public_url.startsWith("https://")
      && sourceAssetChecksum !== null
      && sourceAssetChecksum === sourceRecordChecksum
      && isRecord(sourceRecord?.generation_metadata)
      && sourceRecord.generation_metadata.rightsApproved === true
      && sourceRightsEvidenceId !== null
      && typeof sourceAsset.rightsEvidenceId === "string"
      && sourceAsset.rightsEvidenceId === sourceRightsEvidenceId
      && typeof (sourceAsset.provenance ?? sourceRecord?.provenance) === "string"
      && String(sourceAsset.provenance ?? sourceRecord?.provenance).trim().length >= 3);
    // The default is deliberately not publishable. A reviewer must explicitly
    // classify brand handling as inherent to the supplied product, an
    // authorized overlay, or a marketplace-restricted asset before pixels can
    // become public evidence.
    const logoPolicy = ["inherent_product_branding", "authorized_overlay_branding", "marketplace_restricted"].includes(String(platform.logoPolicy ?? ""));
    const inboundSourceIds = (inboundResult.data ?? []).map((row) => String((row as { source_page_id?: unknown }).source_page_id ?? "")).filter(Boolean);
    const outboundTargetIds = (outboundResult.data ?? []).map((row) => String((row as { target_page_id?: unknown }).target_page_id ?? "")).filter(Boolean);
    const linkedPageIds = [...new Set([...inboundSourceIds, ...outboundTargetIds])];
    const linkedPageResult = linkedPageIds.length
      ? await client.from("seo_pages").select("id,status,noindex,canonical_page_id").in("id", linkedPageIds)
      : { data: [] as Array<{ id: string; status: string; noindex: boolean; canonical_page_id: string | null }> };
    // A publish wave is evaluated atomically: approved/scheduled sibling pages
    // are valid crawl-graph targets even while they remain noindex pending
    // their own publish transition. This prevents a correctly linked cluster
    // from deadlocking on publication order; the pages still must pass their
    // own gate before becoming indexable.
    const crawlableLinkedPageIds = new Set((linkedPageResult.data ?? [])
      .filter((row) => (
        (row.status === "live" && row.noindex === false)
        || (["approved", "scheduled"].includes(row.status) && row.noindex === true)
      ) && !row.canonical_page_id)
      .map((row) => String(row.id)));
    const edgePaths = [...new Set([
      ...(inboundEdgeResult.data ?? []).map((row) => publicPathFromUrl(String((row as { source_url?: unknown }).source_url ?? ""))),
      ...(outboundEdgeResult.data ?? []).map((row) => publicPathFromUrl(String((row as { target_url?: unknown }).target_url ?? ""))),
    ].filter((path): path is string => Boolean(path)))];
    const edgePageResult = edgePaths.length
      ? await client.from("seo_pages").select("path,status,noindex,canonical_page_id").in("path", edgePaths)
      : { data: [] as Array<{ path: string; status: string; noindex: boolean; canonical_page_id: string | null }> };
    const crawlableEdgePaths = new Set([
      ...STATIC_CRAWLABLE_PATHS,
      ...(edgePageResult.data ?? [])
        .filter((row) => (
          (row.status === "live" && row.noindex === false)
          || (["approved", "scheduled"].includes(row.status) && row.noindex === true)
        ) && !row.canonical_page_id)
        .map((row) => normalizePublicPath(row.path)),
    ]);
    const inboundLinks = new Set([
      ...inboundSourceIds.filter((source) => crawlableLinkedPageIds.has(source)),
      ...(inboundEdgeResult.data ?? [])
        .map((row) => String((row as { source_url?: unknown }).source_url ?? ""))
        .filter((url) => crawlableEdgePaths.has(publicPathFromUrl(url) ?? "")),
    ].filter(Boolean)).size;
    const outboundLinks = new Set([
      ...outboundTargetIds.filter((target) => crawlableLinkedPageIds.has(target)),
      ...(outboundEdgeResult.data ?? [])
        .map((row) => String((row as { target_url?: unknown }).target_url ?? ""))
        .filter((url) => crawlableEdgePaths.has(publicPathFromUrl(url) ?? "")),
    ].filter(Boolean)).size;
    const sourceIds = new Set((sourcesResult.data ?? []).map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean));
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
      statusReady: ["approved", "scheduled", "live"].includes(page.status),
      selfCanonical: !page.canonical_page_id,
      noindexBeforePublish: page.noindex === true,
      author: Boolean(page.author_id),
      reviewer: Boolean(page.reviewer_id),
      qualityScore,
      qualityThreshold: qualityScore >= MINIMUM_SCORE,
      directAnswer: typeof page.direct_answer === "string" && page.direct_answer.trim().length >= 40,
      primaryIntent: typeof page.primary_intent === "string" && page.primary_intent.trim().length >= 10,
      structuredSteps: steps.length >= 3,
      testedPrompt: typeof body.prompt === "string" && body.prompt.trim().length >= 40,
      creatorPreset: typeof body.presetId === "string" && body.presetId.trim().length >= 1,
      negativeConstraints: !enforceEvidence || negativeConstraints.length >= 2,
      checklist: checklist.length >= 3,
      limitations: limitations.length >= 1,
      faqCoverage: faqs.length >= 2,
      faqEvidence: !enforceEvidence || (faqs.length >= 2 && faqs.every((faq) => Array.isArray(faq.evidenceSourceIds) && faq.evidenceSourceIds.length > 0 && faq.evidenceSourceIds.every((sourceId: unknown) => typeof sourceId === "string" && sourceIds.has(sourceId.trim())))),
      selectedOutputs: selectedOutputs.length >= 1,
      rejectedOutputs: !enforceEvidence || rejectedOutputs.length >= 1,
      workflowProof: !enforceEvidence || assets.some((asset) => asset.role === "screenshot" || asset.role === "video"),
      mediaRightsMetadata: !enforceEvidence || (assets.filter((asset) => asset.role !== "video").length > 0 && assets.filter((asset) => asset.role !== "video").every((asset) => isRecord(asset.generation_metadata) && asset.generation_metadata.rightsApproved === true && sourceRightsEvidenceId !== null && asset.generation_metadata.rightsEvidenceId === sourceRightsEvidenceId)),
      evidenceRuns: evidenceJobs.size,
      independentEvidence: !enforceEvidence || (evidenceJobs.has("listing") && evidenceJobs.has("lifestyle") && evidenceJobs.has("detail")),
      selectedAsset,
      evidenceGatesEnabled: enforceEvidence,
      sourceAssetMetadata,
      logoPolicy: !enforceEvidence || logoPolicy,
      sourceCount: sourcesResult.data?.length ?? 0,
      sourceEvidence: (sourcesResult.data?.length ?? 0) >= 1,
      inboundLinks,
      inboundLinkThreshold: inboundLinks >= MINIMUM_INBOUND_LINKS,
      outboundLinks,
      outboundLinkThreshold: outboundLinks >= MINIMUM_OUTBOUND_LINKS,
      rollout: rollout?.status ?? "missing",
      provenRolloutHealthy: healthyEnough,
      intentCollisionStatus: page.intent_collision_status ?? "clear",
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
    if (!checks.testedPrompt) blockers.push("tested_prompt_missing");
    if (!checks.creatorPreset) blockers.push("creator_preset_missing");
    if (enforceEvidence && !checks.negativeConstraints) blockers.push("negative_constraints_missing");
    if (!checks.checklist) blockers.push("practical_checklist_missing");
    if (!checks.limitations) blockers.push("limitations_missing");
    if (!checks.faqCoverage) blockers.push("faq_evidence_missing");
    if (enforceEvidence && !checks.faqEvidence) blockers.push("faq_source_evidence_missing");
    if (!checks.selectedOutputs) blockers.push("selected_output_manifest_missing");
    if (enforceEvidence && !checks.rejectedOutputs) blockers.push("rejected_output_and_fix_missing");
    if (enforceEvidence && !checks.workflowProof) blockers.push("workflow_screenshot_or_video_missing");
    if (enforceEvidence && !checks.mediaRightsMetadata) blockers.push("media_rights_evidence_metadata_missing");
    if (enforceEvidence && !checks.independentEvidence) blockers.push("listing_lifestyle_detail_evidence_required");
    if (!checks.selectedAsset) blockers.push("selected_asset_missing");
    if (enforceEvidence && !checks.sourceAssetMetadata) blockers.push("source_asset_rights_or_provenance_missing");
    if (enforceEvidence && !checks.logoPolicy) blockers.push("logo_policy_missing_or_invalid");
    if (!checks.sourceEvidence) blockers.push("source_evidence_missing");
    if (!checks.inboundLinkThreshold) blockers.push("fewer_than_two_inbound_links");
    if (!checks.outboundLinkThreshold) blockers.push("related_internal_links_missing");
    if (checks.intentCollisionStatus !== "clear" && checks.intentCollisionStatus !== "resolved") blockers.push("intent_collision_requires_merge_review");
    if (!rollout) blockers.push("template_rollout_not_configured");
    if (isProvenRollout && !healthyEnough) blockers.push("proven_template_health_window_not_met");
    if (!isProvenRollout && !["approved", "scheduled", "live"].includes(page.status)) blockers.push("manual_review_required_for_new_template");

    const score = Math.max(0, Math.min(100, Math.round([
      qualityScore,
      checks.directAnswer ? 100 : 0,
      checks.structuredSteps ? 100 : 0,
      checks.testedPrompt ? 100 : 0,
      checks.creatorPreset ? 100 : 0,
      checks.negativeConstraints ? 100 : 0,
      checks.checklist ? 100 : 0,
      checks.limitations ? 100 : 0,
      checks.faqCoverage ? 100 : 0,
      checks.faqEvidence ? 100 : 0,
      checks.selectedOutputs ? 100 : 0,
      checks.rejectedOutputs ? 100 : 0,
      checks.workflowProof ? 100 : 0,
      checks.mediaRightsMetadata ? 100 : 0,
      checks.independentEvidence ? 100 : 0,
      checks.selectedAsset ? 100 : 0,
      checks.sourceAssetMetadata ? 100 : 0,
      checks.logoPolicy ? 100 : 0,
      checks.sourceEvidence ? 100 : 0,
      checks.inboundLinkThreshold ? 100 : 0,
      checks.outboundLinkThreshold ? 100 : 0,
    ].reduce((sum, value) => sum + value, 0) / 21)));
    const allowed = blockers.length === 0 && score >= MINIMUM_SCORE;

    const { error: qualityRunError } = await client.from("seo_quality_runs").insert({
      page_id: page.id,
      gate_version: "seo-gate-v1",
      status: allowed ? "pass" : "fail",
      score,
      checks,
      blockers,
    });
    if (qualityRunError) {
      // A publish decision without its immutable quality evidence cannot be
      // audited or safely retried. Fail closed even when every in-memory
      // check passed; the caller must rerun after persistence recovers.
      return {
        pageId: page.id,
        allowed: false,
        score,
        blockers: [...blockers, "quality_run_persist_failed"],
        checks: { ...checks, qualityRunPersisted: false },
      };
    }
    return { pageId: page.id, allowed, score, blockers, checks: { ...checks, qualityRunPersisted: true } };
  } catch (error) {
    console.warn("SEO publish gate unavailable.", error instanceof Error ? error.message : "Unknown error");
    return blockedResult(safePageId, ["publish_gate_unavailable"]);
  }
}

export async function publishSeoPage(pageId: string, options: { batchId?: string } = {}): Promise<SeoPublishResult> {
  // Track ownership of the live transition so an unexpected failure can
  // quarantine only the page changed by this invocation. This avoids leaving
  // a partially published page indexable while also avoiding interference
  // with a concurrent successful publisher.
  let transitionedToLive = false;
  // The environment flag is only one half of the kill switch. Re-read the
  // database row here as well so a direct/internal caller cannot publish after
  // an operator pauses automation without deploying new code.
  if (process.env.SEO_AUTOMATION_ENABLED !== "true") {
    return { ...blockedResult(pageId, ["seo_automation_disabled"]), published: false, indexNowQueued: false };
  }
  try {
    const configClient = createSupabaseAdminClient();
    const { data: automationConfig, error: configError } = await configClient
      .from("seo_automation_config")
      .select("enabled")
      .eq("id", true)
      .maybeSingle();
    if (configError) {
      return { ...blockedResult(pageId, ["seo_automation_config_unavailable"]), published: false, indexNowQueued: false };
    }
    if (automationConfig?.enabled !== true) {
      return { ...blockedResult(pageId, ["seo_automation_disabled"]), published: false, indexNowQueued: false };
    }
  } catch {
    return { ...blockedResult(pageId, ["seo_automation_config_unavailable"]), published: false, indexNowQueued: false };
  }

  const gate = await evaluateSeoPublishGate(pageId);
  if (!gate.allowed) return { ...gate, published: false, indexNowQueued: false };

  // Gate evaluation reads several tables and can include a public render. Re-
  // read the database switch immediately before the live transition so an
  // operator pause during that work takes effect without a deploy.
  if (process.env.SEO_AUTOMATION_ENABLED !== "true") {
    return { ...gate, allowed: false, blockers: [...gate.blockers, "seo_automation_disabled"], published: false, indexNowQueued: false };
  }
  try {
    const configClient = createSupabaseAdminClient();
    const { data: automationConfig, error: configError } = await configClient
      .from("seo_automation_config")
      .select("enabled")
      .eq("id", true)
      .maybeSingle();
    if (configError) {
      return { ...gate, allowed: false, blockers: [...gate.blockers, "seo_automation_config_unavailable"], published: false, indexNowQueued: false };
    }
    if (automationConfig?.enabled !== true) {
      return { ...gate, allowed: false, blockers: [...gate.blockers, "seo_automation_disabled"], published: false, indexNowQueued: false };
    }
  } catch {
    return { ...gate, allowed: false, blockers: [...gate.blockers, "seo_automation_config_unavailable"], published: false, indexNowQueued: false };
  }

  try {
    const client = createSupabaseAdminClient();
    const { data: page, error: pageError } = await client.from("seo_pages").select("id,path,page_family,published_at,search_lastmod_at").eq("id", pageId).maybeSingle();
    if (pageError || !page) return { ...gate, allowed: false, blockers: ["page_not_found"], published: false, indexNowQueued: false };
    const now = new Date().toISOString();

    if (options.batchId) {
      const { count } = await client.from("seo_publish_batch_pages").select("page_id", { count: "exact", head: true }).eq("batch_id", options.batchId).in("status", ["warming", "live"]);
      if ((count ?? 0) >= 50) return { ...gate, allowed: false, blockers: ["publish_wave_capacity_reached"], published: false, indexNowQueued: false };
      const { error: warmingError } = await client.from("seo_publish_batch_pages").upsert({ batch_id: options.batchId, page_id: pageId, status: "warming", updated_at: now }, { onConflict: "batch_id,page_id" });
      if (warmingError) throw new Error(`Publish wave reservation failed: ${warmingError.code}`);
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
    transitionedToLive = true;
    const canonicalUrl = absoluteUrl(page.path);
    // Keep the URL out of sitemap queries until the public render has passed.
    // Existing first-publish timestamps are preserved on republish.
    const { error: stateError } = await client.from("seo_url_state").upsert({ page_id: pageId, canonical_url: canonicalUrl, sitemap_url: absoluteUrl("/sitemap.xml"), eligible_for_indexing: false, updated_at: now }, { onConflict: "page_id" });
    if (stateError) {
      const quarantineErrors = await quarantinePublishedPage(client, pageId, now, options, "publish_url_state_seed_failed");
      await alertQuarantineFailure(pageId, "publish_url_state_seed_failed", quarantineErrors);
      throw stateError;
    }

    // Verify the public, server-rendered URL before it can enter a sitemap or
    // trigger discovery. This protects against route, deploy, cache, schema,
    // and media regressions that database-only checks cannot see.
    const render = await crawlSeoPage(canonicalUrl);
    const renderHealthy = render.status === 200 && render.issueCodes.length === 0;
    if (!renderHealthy) {
      const renderBlockers = [
        "render_preflight_failed",
        ...(render.status !== 200 ? ["render_non_200"] : []),
        ...render.issueCodes.map((code) => `render_${code}`),
      ].slice(0, 30);
      const quarantineErrors = await quarantinePublishedPage(client, pageId, now, options, renderBlockers.join(", ").slice(0, 1_000), {
        last_http_status: render.status,
        last_canonical_url: render.declaredCanonical,
        last_robots_directive: render.robots,
      });
      await alertQuarantineFailure(pageId, "render_preflight_failed", quarantineErrors);
      return {
        ...gate,
        allowed: false,
        blockers: [...gate.blockers, ...renderBlockers, ...(quarantineErrors.length ? ["quarantine_persist_failed"] : [])],
        checks: { ...gate.checks, renderPreflight: false, renderStatus: render.status ?? 0, quarantinePersisted: quarantineErrors.length === 0 },
        published: false,
        indexNowQueued: false,
      };
    }
    const { error: healthyStateError } = await client.from("seo_url_state")
      .update({
        eligible_for_indexing: true,
        first_published_at: page.published_at ?? now,
        last_http_status: render.status,
        last_canonical_url: render.declaredCanonical,
        last_robots_directive: render.robots,
        first_sitemap_at: now,
        updated_at: now,
      })
      .eq("page_id", pageId);
    if (healthyStateError) {
      const quarantineErrors = await quarantinePublishedPage(client, pageId, now, options, "url_state_health_update_failed");
      await alertQuarantineFailure(pageId, "url_state_health_update_failed", quarantineErrors);
      return {
        ...gate,
        allowed: false,
        blockers: [...gate.blockers, "url_state_health_update_failed", ...(quarantineErrors.length ? ["quarantine_persist_failed"] : [])],
        checks: { ...gate.checks, renderPreflight: true, renderStatus: render.status ?? 0, urlStateHealthy: false, quarantinePersisted: quarantineErrors.length === 0 },
        published: false,
        indexNowQueued: false,
      };
    }
    if (options.batchId) {
      const { error: batchStateError } = await client.from("seo_publish_batch_pages").update({ status: "live", updated_at: now }).eq("batch_id", options.batchId).eq("page_id", pageId);
      if (batchStateError) {
        const quarantineErrors = await quarantinePublishedPage(client, pageId, now, options, "publish_batch_state_update_failed");
        await alertQuarantineFailure(pageId, "publish_batch_state_update_failed", quarantineErrors);
        return {
          ...gate,
          allowed: false,
          blockers: [...gate.blockers, "publish_batch_state_update_failed", ...(quarantineErrors.length ? ["quarantine_persist_failed"] : [])],
          checks: { ...gate.checks, renderPreflight: true, renderStatus: render.status ?? 0, urlStateHealthy: true, batchStateHealthy: false, quarantinePersisted: quarantineErrors.length === 0 },
          published: false,
          indexNowQueued: false,
        };
      }
    }

    const relatedIds = new Set<string>();
    const [incoming, outgoing] = await Promise.all([
      client.from("seo_links").select("source_page_id").eq("target_page_id", pageId),
      client.from("seo_links").select("target_page_id").eq("source_page_id", pageId),
    ]);
    if (incoming.error || outgoing.error) {
      throw new Error(`SEO published link lookup failed: ${incoming.error?.code ?? outgoing.error?.code ?? "unknown_error"}`);
    }
    for (const row of [...(incoming.data ?? []), ...(outgoing.data ?? [])]) {
      const value = (row as { source_page_id?: unknown; target_page_id?: unknown }).source_page_id
        ?? (row as { target_page_id?: unknown }).target_page_id;
      if (typeof value === "string" && value !== pageId) relatedIds.add(value);
    }
    let relatedPageRows: Array<{ path: string }> = [];
    if (relatedIds.size) {
      const relatedPages = await client.from("seo_pages").select("path").in("id", [...relatedIds]);
      if (relatedPages.error) {
        throw new Error(`SEO related-page lookup failed: ${relatedPages.error.code ?? "unknown_error"}`);
      }
      relatedPageRows = (relatedPages.data ?? []) as Array<{ path: string }>;
    }
    const pathsToRevalidate = new Set([page.path, "/product-photography", "/product-photo-prompts", "/tutorials", "/sitemap.xml", "/sitemaps/static.xml"]);
    for (const related of relatedPageRows) {
      if (typeof related.path === "string") pathsToRevalidate.add(related.path);
    }
    // A publish can change the deterministic path ordering inside every
    // family/month shard (including when it creates a new shard). Resolve the
    // currently materialized shard descriptors and invalidate each affected
    // literal URL. The index is already invalidated above, so a first shard
    // in a new month is discovered on the next request even when no descriptor
    // existed before this publication.
    const sitemapFamily = SITEMAP_FAMILY_SLUGS[page.page_family] ?? "content";
    const sitemapMonths = new Set([
      now.slice(0, 7),
      sitemapMonth(page.search_lastmod_at),
      sitemapMonth(page.published_at),
    ].filter((month): month is string => Boolean(month)));
    try {
      const shardDescriptors = await listSeoSitemapShards();
      for (const descriptor of shardDescriptors) {
        if (descriptor.family === sitemapFamily && sitemapMonths.has(descriptor.month)) {
          pathsToRevalidate.add(`/sitemaps/${descriptor.slug}.xml`);
        }
      }
    } catch (error) {
      // Sitemap responses have a short bounded TTL and the index is still
      // invalidated, so do not quarantine an otherwise healthy page solely
      // because a shard-descriptor lookup is temporarily unavailable. Keep an
      // operational alert so the missing immediate purge is visible.
      console.warn("SEO sitemap shard invalidation lookup failed.", error instanceof Error ? error.message : "Unknown error");
      try {
        await upsertSeoAlert({
          dedupeKey: `seo:sitemap-shard-invalidation:${pageId}`,
          severity: "p1",
          category: "publishing",
          title: "SEO sitemap shard invalidation lookup failed",
          message: "A page passed publish QA, but its family/month sitemap shard descriptors could not be read. The sitemap index was invalidated and the short shard TTL remains the fallback.",
          evidence: { pageId, canonicalUrl, pageFamily: page.page_family, months: [...sitemapMonths] },
        });
      } catch (alertError) {
        console.warn("SEO sitemap shard invalidation alert failed.", alertError instanceof Error ? alertError.message : "Unknown error");
      }
    }
    for (const path of pathsToRevalidate) {
      try { revalidatePath(path); } catch { /* Inngest has no request cache context; the next request still sees the DB row. */ }
    }
    try { revalidatePath("/sitemaps/[shard]", "page"); } catch { /* Dynamic sitemap shards are also short-lived cached responses. */ }
    let indexNowQueued = false;
    try {
      await inngest.send({ name: "seo/page.published", data: { pageId, canonicalUrl, publishedAt: now } });
      indexNowQueued = true;
    } catch (error) {
      console.warn("IndexNow propagation event could not be queued.", error instanceof Error ? error.message : "Unknown error");
      await upsertSeoAlert({
        dedupeKey: `indexnow:event-queue:${pageId}`,
        severity: "p2",
        category: "indexnow",
        title: "IndexNow propagation event could not be queued",
        message: `The page was published and passed render QA, but its IndexNow notification could not be queued. The sitemap heartbeat remains the fallback discovery path for ${canonicalUrl}.`,
        evidence: { pageId, canonicalUrl },
      });
    }
    return { ...gate, checks: { ...gate.checks, renderPreflight: true, renderStatus: render.status ?? 0, urlStateHealthy: true, ...(options.batchId ? { batchStateHealthy: true } : {}) }, published: true, indexNowQueued };
  } catch (error) {
    console.warn("SEO page publish failed.", error instanceof Error ? error.message : "Unknown error");
    if (transitionedToLive) {
      // Fail closed if an unhandled error occurs after the live transition.
      // Sitemap membership is driven by seo_url_state, while the page itself
      // is also made explicitly noindex so a direct URL cannot remain
      // indexable during recovery.
      const now = new Date().toISOString();
      try {
        const recoveryClient = createSupabaseAdminClient();
        const quarantineErrors = await quarantinePublishedPage(recoveryClient, pageId, now, options, "publish_transaction_failed");
        await alertQuarantineFailure(pageId, "publish_transaction_failed", quarantineErrors);
        if (quarantineErrors.length) console.warn("SEO publish quarantine recovery had persistence errors.", quarantineErrors.join(", "));
      } catch (recoveryError) {
        console.warn("SEO publish quarantine recovery failed.", recoveryError instanceof Error ? recoveryError.message : "Unknown error");
        await alertQuarantineFailure(pageId, "publish_transaction_failed", [recoveryError instanceof Error ? recoveryError.message : "quarantine_client_unavailable"]);
      }
    }
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
  intent_collision_status: string | null;
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

function normalizeAssetChecksum(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, "");
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function sitemapMonth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const month = value.slice(0, 7);
  return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(month) ? month : null;
}

type QuarantineUrlStatePatch = {
  last_http_status?: number | null;
  last_canonical_url?: string | null;
  last_robots_directive?: string | null;
};

/**
 * Reverses a live transition and reports every persistence failure. Each
 * mutation is attempted independently so a failure in one table cannot leave
 * the other indexability controls untouched without being recorded.
 */
async function quarantinePublishedPage(
  client: ReturnType<typeof createSupabaseAdminClient>,
  pageId: string,
  now: string,
  options: { batchId?: string },
  batchErrorMessage: string,
  urlStatePatch: QuarantineUrlStatePatch = {},
): Promise<string[]> {
  const errors: string[] = [];
  try {
    const pageUpdate = await client
      .from("seo_pages")
      .update({ status: "qa_failed", noindex: true, search_lastmod_at: now, updated_at: now })
      .eq("id", pageId)
      .eq("status", "live");
    if (pageUpdate.error) errors.push(`seo_pages:${pageUpdate.error.code ?? "unknown"}`);
  } catch (error) {
    errors.push(`seo_pages:${quarantineErrorCode(error)}`);
  }

  try {
    const stateUpdate = await client
      .from("seo_url_state")
      .update({ eligible_for_indexing: false, updated_at: now, ...urlStatePatch })
      .eq("page_id", pageId);
    if (stateUpdate.error) errors.push(`seo_url_state:${stateUpdate.error.code ?? "unknown"}`);
  } catch (error) {
    errors.push(`seo_url_state:${quarantineErrorCode(error)}`);
  }

  if (options.batchId) {
    try {
      const batchUpdate = await client
        .from("seo_publish_batch_pages")
        .update({ status: "replaced", error_message: batchErrorMessage.slice(0, 1_000), updated_at: now })
        .eq("batch_id", options.batchId)
        .eq("page_id", pageId);
      if (batchUpdate.error) errors.push(`seo_publish_batch_pages:${batchUpdate.error.code ?? "unknown"}`);
    } catch (error) {
      errors.push(`seo_publish_batch_pages:${quarantineErrorCode(error)}`);
    }
  }
  return errors;
}

function quarantineErrorCode(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (isRecord(error) && typeof error.code === "string") return error.code;
  return "unknown";
}

async function alertQuarantineFailure(pageId: string, reason: string, errors: string[]): Promise<void> {
  if (!errors.length) return;
  await upsertSeoAlert({
    dedupeKey: `seo:publish:quarantine:${pageId}`,
    severity: "p0",
    category: "publishing",
    title: "SEO publish quarantine persistence failed",
    message: `A page failed after the live transition and one or more quarantine writes failed. Keep SEO automation paused until the page is verified and repaired (${reason}).`,
    evidence: { pageId, reason, errors },
  });
}

const STATIC_CRAWLABLE_PATHS = new Set([
  "/",
  "/product-photography/",
  "/product-photo-prompts/",
  "/tutorials/",
  "/features/",
  "/use-cases/",
  "/authors/",
]);

function publicPathFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(absoluteUrl("/")).origin) return null;
    if (url.search || url.hash) return null;
    return normalizePublicPath(url.pathname);
  } catch {
    return null;
  }
}

function normalizePublicPath(value: string): string {
  if (value === "/") return "/";
  return `/${value.replace(/^\/+|\/+$/g, "")}/`;
}
