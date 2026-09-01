export type DraftValidationCheck = {
  field: string;
  pass: boolean;
};

export type DraftValidationResult = {
  version: 1;
  valid: boolean;
  status: "pass" | "fail";
  score: number;
  blockers: string[];
  warnings: string[];
  checks: DraftValidationCheck[];
};

export type DraftValidationOptions = {
  /** External agents may only submit non-live review states. */
  reviewOnly?: boolean;
};

const PAGE_FAMILIES = new Set([
  "product-hub",
  "category-hub",
  "listing",
  "lifestyle",
  "detail",
  "prompt",
  "tutorial",
  "feature",
]);

const REVIEW_STATUSES = new Set([
  "draft",
  "automated_qa",
  "editor_review",
  "changes_requested",
  "refresh",
]);

const ALL_STATUSES = new Set([
  ...REVIEW_STATUSES,
  "approved",
  "scheduled",
  "live",
  "qa_failed",
  "merged",
  "archived",
]);

const GENERATION_JOBS = new Set(["listing", "lifestyle", "detail", "prompt", "tutorial"]);
const REQUIRED_GENERATION_JOBS = ["listing", "lifestyle", "detail"] as const;
const RIGHTS_STATUSES = new Set(["approved", "owned", "user-supplied", "licensed"]);
const LOGO_POLICIES = new Set([
  "inherent_product_branding",
  "authorized_overlay_branding",
  "marketplace_restricted",
  "unverified_brand",
]);
const MEDIA_ROLES = new Set(["source", "hero", "selected", "rejected", "corrected", "screenshot", "video", "og"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLEAN_PATH_PATTERN = /^\/[a-z0-9][a-z0-9/_-]*\/?$/;

function evidenceGatesEnabled(): boolean {
  return process.env.SEO_EVIDENCE_GATES_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Validate the complete, structured SEO page-draft contract without network
 * access or database writes. This is shared by the local worker validator and
 * the signed callback so a worker cannot submit a weaker payload than the one
 * used during local QA.
 */
export function validateSeoPageDraft(
  value: unknown,
  options: DraftValidationOptions = {},
): DraftValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checks: DraftValidationCheck[] = [];
  const record = isRecord(value) ? value : {};
  const reviewOnly = options.reviewOnly ?? true;
  const enforceEvidence = evidenceGatesEnabled();

  if (!isRecord(value)) blockers.push("draft_must_be_an_object");

  const content = isRecord(record.content) ? record.content : {};
  const media = arrayOfRecords(record.media);
  const sources = arrayOfRecords(record.sources);
  const generationRuns = arrayOfRecords(record.generationRuns);
  const links = isRecord(record.links) ? record.links : {};
  const inbound = arrayOfRecords(links.inbound);
  const outbound = arrayOfRecords(links.outbound);
  const selectedOutputs = arrayOfRecords(content.selectedOutputs);
  const rejectedOutputs = arrayOfRecords(content.rejectedOutputs);
  const steps = arrayOfRecords(content.steps);
  const faqs = arrayOfRecords(content.faqs);
  const limitations = stringArray(content.limitations);
  const checklist = stringArray(content.checklist);
  const evidencePacket = arrayOfRecords(record.evidencePacket);
  const approvedRightsEvidence = evidencePacket.filter(
    (item) => item.type === "rights" && item.status === "approved",
  );
  const approvedRightsEvidenceIds = new Set(
    approvedRightsEvidence
      .map((item) => item.evidenceId)
      .filter(nonEmpty),
  );

  function requireString(field: string, config: { min?: number; pattern?: RegExp } = {}): boolean {
    const value = record[field];
    const valid = typeof value === "string"
      && value.trim().length >= (config.min ?? 1)
      && (!config.pattern || config.pattern.test(value.trim()));
    checks.push({ field, pass: valid });
    if (!valid) blockers.push(`${field}_missing_or_invalid`);
    return valid;
  }

  requireString("pageId");
  requireString("briefId", { pattern: UUID_PATTERN });
  const pathOk = requireString("path", { pattern: CLEAN_PATH_PATTERN });
  if (pathOk && /[?&#%]|\/\//.test(String(record.path))) blockers.push("path_must_be_clean_crawlable_path");
  const pageFamilyOk = typeof record.pageFamily === "string" && PAGE_FAMILIES.has(record.pageFamily);
  checks.push({ field: "pageFamily", pass: pageFamilyOk });
  if (!pageFamilyOk) blockers.push("page_family_invalid");
  requireString("intentKey", { min: 10 });
  requireString("productEntity");
  requireString("buyerQuestion", { min: 20 });
  requireString("title", { min: 12 });
  requireString("metaDescription", { min: 50 });
  const directAnswer = typeof record.directAnswer === "string" ? record.directAnswer.trim() : "";
  const directAnswerOk = directAnswer.length >= 40;
  checks.push({ field: "directAnswer", pass: directAnswerOk });
  if (!directAnswerOk) blockers.push("directAnswer_missing_or_invalid");
  if (directAnswer.length > 600) warnings.push("direct_answer_is_longer_than_above_fold_target");

  const statusOk = typeof record.status === "string"
    && (reviewOnly ? REVIEW_STATUSES.has(record.status) : ALL_STATUSES.has(record.status));
  checks.push({ field: "status", pass: statusOk });
  if (!statusOk) blockers.push(reviewOnly ? "status_must_be_non_live_review_state" : "status_invalid");
  requireString("templateVersion");

  if (Object.prototype.hasOwnProperty.call(record, "qualityScore")) {
    const declaredScore = record.qualityScore;
    if (!Number.isInteger(declaredScore) || Number(declaredScore) < 85 || Number(declaredScore) > 100) {
      blockers.push("quality_score_missing_or_out_of_range");
    }
  }

  const sourceAsset = isRecord(content.sourceAsset) ? content.sourceAsset : {};
  const sourceRightsOk = RIGHTS_STATUSES.has(String(sourceAsset.rightsStatus ?? ""));
  checks.push({ field: "sourceAssetRights", pass: enforceEvidence ? sourceRightsOk : true });
  if (enforceEvidence) {
    if (!sourceRightsOk) blockers.push("source_asset_rights_missing_or_unapproved");
    if (!isSha256(sourceAsset.checksum)) blockers.push("source_asset_checksum_missing");
    if (!nonEmpty(sourceAsset.provenance)) blockers.push("source_asset_provenance_missing");
    if (!nonEmpty(sourceAsset.rightsEvidenceId)) blockers.push("source_asset_rights_evidence_id_missing");
    if (sourceAsset.rightsApproved !== true) blockers.push("source_asset_rights_not_approved");
    if (nonEmpty(sourceAsset.rightsEvidenceId) && !approvedRightsEvidenceIds.has(sourceAsset.rightsEvidenceId)) {
      blockers.push("source_asset_rights_evidence_not_approved");
    }
    if (approvedRightsEvidence.length < 1) blockers.push("rights_evidence_packet_missing");
    for (const item of approvedRightsEvidence) {
      if (!nonEmpty(item.evidenceId) || !nonEmpty(item.reviewer) || !nonEmpty(item.reviewedAt)) {
        blockers.push("rights_evidence_metadata_missing");
      }
    }
  }

  const generationJobs = new Set<string>();
  const runIds = new Set<string>();
  if (enforceEvidence && generationRuns.length < 3) blockers.push("generation_runs_missing_or_incomplete");
  for (const run of generationRuns) {
    const runId = typeof run.runId === "string" ? run.runId.trim() : "";
    if (!runId) blockers.push("generation_run_id_missing");
    else if (runIds.has(runId)) blockers.push("generation_run_id_duplicate");
    else runIds.add(runId);

    const imageJob = typeof run.imageJob === "string" ? run.imageJob.trim() : "";
    if (!GENERATION_JOBS.has(imageJob)) blockers.push("generation_run_job_invalid");
    else generationJobs.add(imageJob);
    if (enforceEvidence && !nonEmpty(run.provider)) blockers.push("generation_run_provider_missing");
    if (enforceEvidence && !nonEmpty(run.model)) blockers.push("generation_run_model_missing");
    const outputs = arrayOfRecords(run.outputs);
    if (enforceEvidence && outputs.length < 1) blockers.push("generation_run_outputs_missing");
    if (enforceEvidence && outputs.some((output) => !nonEmpty(output.assetId) || !isSha256(output.checksum))) {
      blockers.push("generation_run_output_manifest_invalid");
    }
    if (enforceEvidence && !/^\/create\//.test(String(run.creatorRoute ?? ""))) blockers.push("generation_run_creator_route_missing");
    if (enforceEvidence && !nonEmpty(run.arenaId)) blockers.push("generation_run_arena_missing");
    if (enforceEvidence && (!nonEmpty(run.prompt) || String(run.prompt).trim().length < 10)) blockers.push("generation_run_prompt_missing");
    if (enforceEvidence && !isRawSha256(run.kitChecksum)) blockers.push("generation_run_kit_checksum_missing");
    if (enforceEvidence && String(run.qaStatus ?? "") !== "pass") blockers.push("generation_run_qa_not_passed");
    if (enforceEvidence && !isRecord(run.sourceAsset)) blockers.push("generation_run_source_asset_missing");
    if (enforceEvidence && isRecord(run.sourceAsset)) {
      if (!nonEmpty(run.sourceAsset.rightsEvidenceId)) blockers.push("generation_run_rights_evidence_id_missing");
      if (run.sourceAsset.rightsApproved !== true) blockers.push("generation_run_rights_not_approved");
      if (nonEmpty(sourceAsset.rightsEvidenceId) && run.sourceAsset.rightsEvidenceId !== sourceAsset.rightsEvidenceId) {
        blockers.push("generation_run_rights_evidence_mismatch");
      }
      if (isSha256(sourceAsset.checksum) && run.sourceAsset.checksum !== sourceAsset.checksum) {
        blockers.push("generation_run_source_checksum_mismatch");
      }
    }
  }
  if (enforceEvidence && !REQUIRED_GENERATION_JOBS.every((job) => generationJobs.has(job))) {
    blockers.push("independent_generation_runs_required");
  }

  const prompt = typeof content.prompt === "string" ? content.prompt.trim() : "";
  const promptOk = prompt.length >= 40;
  checks.push({ field: "testedPrompt", pass: promptOk });
  if (!promptOk) blockers.push("tested_prompt_missing");
  const creatorPresetOk = nonEmpty(content.presetId);
  checks.push({ field: "creatorPreset", pass: creatorPresetOk });
  if (!creatorPresetOk) blockers.push("creator_preset_missing");
  // Negative constraints remain accepted as optional internal prompt data, but
  // are no longer a public-content or ingestion gate.
  if (steps.length < 3 || steps.some((step) => !nonEmpty(step.title) || !nonEmpty(step.description))) {
    blockers.push("workflow_steps_missing_or_incomplete");
  }
  if (enforceEvidence && limitations.length < 1) blockers.push("limitations_missing");
  if (checklist.length < 3) warnings.push("practical_checklist_has_fewer_than_three_items");

  // Source records carry a stable draft-local key (`id` or `sourceKey`), and
  // every FAQ citation must point at one of those keys. The ingest transaction
  // rewrites these keys to the persisted `seo_sources.id` values; checking the
  // relationship here prevents a page from passing QA with decorative,
  // unresolved citation IDs.
  const sourceKeys = sources.map(sourceKeyForRecord);
  const sourceKeySet = new Set(sourceKeys.filter(Boolean));
  if (enforceEvidence && sources.length < 3) blockers.push("three_demand_sources_required");
  if (enforceEvidence && sourceKeys.some((key) => !key)) blockers.push("source_stable_id_missing");
  if (enforceEvidence && sourceKeySet.size !== sourceKeys.filter(Boolean).length) blockers.push("source_stable_id_duplicate");
  const faqCoverageOk = faqs.length >= 2;
  const faqEvidenceOk = !enforceEvidence || (faqCoverageOk && faqs.every(
    (faq) => nonEmpty(faq.question)
      && nonEmpty(faq.answer)
      && Array.isArray(faq.evidenceSourceIds)
      && faq.evidenceSourceIds.length > 0
      && faq.evidenceSourceIds.every((sourceId) => nonEmpty(sourceId) && sourceKeySet.has(sourceId.trim())),
  ));
  checks.push({ field: "faqCoverage", pass: faqCoverageOk });
  checks.push({ field: "faqEvidence", pass: faqEvidenceOk });
  if (!faqCoverageOk) blockers.push("faq_evidence_missing");
  if (enforceEvidence && !faqEvidenceOk) blockers.push("faq_source_evidence_missing");

  const platform = isRecord(content.platform) ? content.platform : {};
  const platformTargetOk = nonEmpty(platform.target);
  const outputDimensionsOk = Array.isArray(platform.outputDimensions)
    && platform.outputDimensions.some((dimension) => nonEmpty(dimension));
  if (!platformTargetOk) blockers.push("platform_target_missing");
  if (!outputDimensionsOk) blockers.push("platform_output_dimensions_missing");
  const logoPolicy = platform.logoPolicy;
  if (enforceEvidence && !LOGO_POLICIES.has(String(logoPolicy ?? ""))) blockers.push("logo_policy_missing_or_invalid");
  if (enforceEvidence && String(logoPolicy) === "unverified_brand") blockers.push("logo_policy_requires_explicit_reviewer_classification");
  if (enforceEvidence && String(logoPolicy) === "authorized_overlay_branding" && !nonEmpty(content.logoAssetId)) {
    blockers.push("authorized_logo_asset_required");
  }

  const expectedRightsEvidenceId = nonEmpty(sourceAsset.rightsEvidenceId) ? sourceAsset.rightsEvidenceId : null;
  if (selectedOutputs.length < 1) blockers.push("selected_output_missing");
  for (const output of selectedOutputs) {
    if (!isSha256(output.checksum)) blockers.push("selected_output_checksum_missing");
    const matching = media.find((item) => item.assetId === output.assetId && (item.role === "selected" || item.role === "hero"));
    if (!matching) blockers.push("selected_output_media_record_missing");
  }
  if (enforceEvidence && rejectedOutputs.length < 1) blockers.push("rejected_output_missing");
  if (enforceEvidence && rejectedOutputs.some((output) => !nonEmpty(output.assetId) || !nonEmpty(output.reason) || !nonEmpty(output.fix))) {
    blockers.push("rejected_output_failure_fix_missing");
  }
  if (media.length < 1) blockers.push("media_missing");
  const mediaRoles = new Set(media.map((item) => String(item.role ?? "")));
  if (enforceEvidence && !mediaRoles.has("source")) blockers.push("source_media_role_missing");
  if (!mediaRoles.has("selected") && !mediaRoles.has("hero")) blockers.push("selected_media_role_missing");
  const sourceMedia = media.find((item) => item.role === "source" && (!sourceAsset.assetId || item.assetId === sourceAsset.assetId));
  if (enforceEvidence && !sourceMedia) blockers.push("source_asset_media_record_missing");
  if (enforceEvidence && sourceMedia && sourceMedia.checksum !== sourceAsset.checksum) blockers.push("source_asset_checksum_mismatch");
  for (const item of media) {
    if (!MEDIA_ROLES.has(String(item.role ?? ""))) blockers.push("media_role_invalid");
    if (!isHttpsUrl(item.url)) blockers.push("media_url_must_be_https");
    if (!Number.isInteger(item.width) || Number(item.width) < 320 || !Number.isInteger(item.height) || Number(item.height) < 320) {
      blockers.push("media_dimensions_missing_or_too_small");
    }
    if (!nonEmpty(item.alt)) blockers.push("media_alt_text_missing");
    if (!nonEmpty(item.caption)) warnings.push("media_caption_missing");
    if (!isSha256(item.checksum)) blockers.push("media_checksum_missing");
    if (enforceEvidence && String(item.qaStatus ?? "") !== "pass") blockers.push("media_qa_not_passed");
    if (enforceEvidence && !RIGHTS_STATUSES.has(String(item.rightsStatus ?? ""))) blockers.push("media_rights_missing_or_unapproved");
    if (enforceEvidence) {
      const generationMetadata = isRecord(item.generationMetadata) ? item.generationMetadata : {};
      if (!nonEmpty(generationMetadata.rightsEvidenceId) || generationMetadata.rightsApproved !== true) {
        blockers.push("media_rights_evidence_missing");
      }
      if (expectedRightsEvidenceId && generationMetadata.rightsEvidenceId !== expectedRightsEvidenceId) {
        blockers.push("media_rights_evidence_mismatch");
      }
      if (!LOGO_POLICIES.has(String(item.logoPolicy ?? ""))) blockers.push("media_logo_policy_missing_or_invalid");
      if (String(item.logoPolicy) === "unverified_brand") blockers.push("media_logo_policy_requires_explicit_reviewer_classification");
    }
  }

  if (sources.length < 1) blockers.push("sources_missing");
  for (const source of sources) {
    if (!isHttpsUrl(source.url)) blockers.push("source_url_must_be_https");
    if (!nonEmpty(source.title) || !nonEmpty(source.accessedAt)) blockers.push("source_metadata_missing");
    if (enforceEvidence && (!Array.isArray(source.claimsSupported) || source.claimsSupported.length < 1 || !source.claimsSupported.every(nonEmpty))) {
      blockers.push("source_claim_mapping_missing");
    }
  }
  if (inbound.length < 2) blockers.push("fewer_than_two_inbound_links");
  if (outbound.length < 4) blockers.push("fewer_than_four_outbound_links");
  for (const link of [...inbound, ...outbound]) {
    if (!isCleanInternalPath(link.path) || !nonEmpty(link.anchor)) blockers.push("internal_link_invalid");
  }
  const authorsOk = isRecord(record.author) && nonEmpty(record.author.id) && nonEmpty(record.author.name);
  const reviewersOk = isRecord(record.reviewer) && nonEmpty(record.reviewer.id) && nonEmpty(record.reviewer.name);
  if (!authorsOk) blockers.push("author_missing");
  if (!reviewersOk) blockers.push("reviewer_missing");

  // Search the user-facing copy for placeholders without treating an
  // author/reviewer email or a legitimate source URL such as
  // `example.com` as page copy.
  const text = JSON.stringify({
    title: record.title,
    metaDescription: record.metaDescription,
    directAnswer: record.directAnswer,
    content,
  }).toLowerCase();
  const placeholders = ["lorem ipsum", "todo", "tbd", "insert copy", "example.com", "{product}", "[product]"];
  if (placeholders.some((value) => text.includes(value))) blockers.push("generic_placeholder_detected");
  if (new Set(inbound.map((link) => link.path)).size !== inbound.length || new Set(outbound.map((link) => link.path)).size !== outbound.length) {
    warnings.push("duplicate_internal_link_targets");
  }
  if (enforceEvidence && record.pageFamily === "listing" && String(logoPolicy) === "marketplace_restricted" && text.includes("add logo")) {
    blockers.push("marketplace_logo_instruction_conflict");
  }

  const scoredChecks = [
    isValidUuid(record.briefId),
    directAnswerOk,
    promptOk,
    creatorPresetOk,
    faqCoverageOk,
    enforceEvidence ? faqEvidenceOk : true,
    enforceEvidence ? sourceRightsOk : true,
    steps.length >= 3 && steps.every((step) => nonEmpty(step.title) && nonEmpty(step.description)),
    selectedOutputs.length >= 1,
    !enforceEvidence || (rejectedOutputs.length >= 1 && rejectedOutputs.every((output) => nonEmpty(output.assetId) && nonEmpty(output.reason) && nonEmpty(output.fix))),
    media.length >= 1 && media.every((item) => isHttpsUrl(item.url) && Number.isInteger(item.width) && Number.isInteger(item.height)),
    !enforceEvidence || (media.length >= 1 && media.every((item) => String(item.qaStatus ?? "") === "pass")),
    !enforceEvidence || (sources.length >= 3 && sourceKeySet.size === sourceKeys.filter(Boolean).length),
    !enforceEvidence || (approvedRightsEvidence.length >= 1 && expectedRightsEvidenceId !== null && sourceAsset.rightsApproved === true),
    inbound.length >= 2,
    outbound.length >= 4,
    authorsOk,
    reviewersOk,
    !enforceEvidence || (LOGO_POLICIES.has(String(logoPolicy ?? "")) && String(logoPolicy) !== "unverified_brand"),
    !enforceEvidence || (generationRuns.length >= 3 && generationRuns.every((run) => nonEmpty(run.runId) && nonEmpty(run.provider) && nonEmpty(run.model) && arrayOfRecords(run.outputs).length > 0 && isRecord(run.sourceAsset) && nonEmpty(run.sourceAsset.rightsEvidenceId) && run.sourceAsset.rightsApproved === true)),
    !enforceEvidence || (REQUIRED_GENERATION_JOBS.every((job) => generationJobs.has(job)) && generationRuns.every((run) => String(run.qaStatus ?? "") === "pass")),
    platformTargetOk && outputDimensionsOk,
  ];
  const score = Math.round((scoredChecks.filter(Boolean).length / scoredChecks.length) * 100);
  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  const valid = uniqueBlockers.length === 0 && score >= 85;
  return {
    version: 1,
    valid,
    status: valid ? "pass" : "fail",
    score,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    checks,
  };
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpsUrl(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/[^\s]+$/i.test(value);
}

function isCleanInternalPath(value: unknown): value is string {
  return typeof value === "string" && CLEAN_PATH_PATTERN.test(value) && !/[?&#%]/.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function isRawSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value.replace(/^sha256:/i, ""));
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function sourceKeyForRecord(source: Record<string, unknown>): string {
  const explicit = String(source.id ?? source.sourceKey ?? "").trim();
  if (explicit) return explicit;
  // Compatibility for the first pilot drafts, which stored their stable
  // citation key as the first claim mapping. New handoffs must use `id` or
  // `sourceKey`; this fallback exists only so old review artifacts can be
  // repaired without being silently discarded.
  return Array.isArray(source.claimsSupported) && typeof source.claimsSupported[0] === "string"
    ? source.claimsSupported[0].trim()
    : "";
}
