#!/usr/bin/env node

/**
 * Audit local Airveek recording kits against the SEO page evidence contract.
 *
 * This is intentionally read-only. A recording kit is not an SEO page draft
 * and is never promoted automatically: the report identifies the missing
 * evidence that a writer/editor must supply before `seo:ingest-draft` can run.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const projectDirectory = path.resolve(process.cwd());
const kitsRoot = path.join(projectDirectory, "content-kits");
const graphPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const includeAll = process.argv.includes("--all");
const selectedOnly = optionValue("--only")
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  ?? [];

const graph = await readJson(graphPath);
const opportunityById = new Map((graph?.opportunities ?? []).map((item) => [String(item.id), item]));
const opportunityIds = new Set(opportunityById.keys());

for (const id of await listDirectories(kitsRoot)) opportunityIds.add(id);

for (const id of selectedOnly) {
  if (!opportunityIds.has(id)) throw new Error(`Opportunity not found: ${id}`);
}

const opportunities = [];
const idsToAudit = selectedOnly.length ? [...new Set(selectedOnly)] : [...opportunityIds].sort();
for (const opportunityId of idsToAudit) {
  const opportunityDirectory = path.join(kitsRoot, opportunityId);
  const kits = (await listDirectories(opportunityDirectory)).sort().reverse();
  const manifests = await Promise.all(kits.map(async (kitName) => ({
    kitName,
    manifest: await readJson(path.join(opportunityDirectory, kitName, "manifest.json")),
  })));
  const latestPerJob = new Map();
  for (const item of manifests) {
    const job = typeof item.manifest?.imageJob === "string" ? item.manifest.imageJob.trim().toLowerCase() : "";
    if (["listing", "lifestyle", "detail"].includes(job) && !latestPerJob.has(job)) latestPerJob.set(job, item.kitName);
  }
  const selectedKits = includeAll
    ? kits
    : [...new Set([kits[0], ...latestPerJob.values()].filter(Boolean))];
  const auditedKits = [];
  for (const kitName of selectedKits) {
    auditedKits.push(await auditKit(opportunityId, path.join(opportunityDirectory, kitName), opportunityById.get(opportunityId)));
  }
  const jobCoverage = ["listing", "lifestyle", "detail"].map((job) => {
    const kitName = latestPerJob.get(job) ?? null;
    const audited = auditedKits.find((kit) => kit.kit.endsWith(`/${kitName}`));
    return { job, kit: audited?.kit ?? (kitName ? path.relative(projectDirectory, path.join(opportunityDirectory, kitName)) : null), status: audited?.status ?? "not-audited" };
  });
  const packStatus = jobCoverage.every((item) => item.status === "ready-for-draft") ? "ready-for-draft-pack" : "blocked";
  opportunities.push({
    opportunityId,
    category: opportunityById.get(opportunityId)?.category ?? null,
    kitCount: kits.length,
    kits: auditedKits,
    latestStatus: auditedKits[0]?.status ?? "not-started",
    jobCoverage,
    packStatus,
  });
}

const kits = opportunities.flatMap((item) => item.kits);
const summary = kits.reduce((result, kit) => {
  result[kit.status] = (result[kit.status] ?? 0) + 1;
  return result;
}, {});

process.stdout.write(`${JSON.stringify({
  version: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    source: "A real product source asset with rights/provenance is mandatory.",
    jobs: "A page needs independent listing, lifestyle, and detail generation records; one recording with three variations is not equivalent.",
    media: "Indexable assets need durable HTTPS URLs, dimensions, checksums, alt text, and a logo policy.",
    workflow: "A recorded kit must include the four checkpoint screenshots emitted by the real Airveek workflow.",
    publishing: "This audit is read-only and never changes a kit, page, sitemap, or automation switch.",
  },
  summary,
  opportunities,
}, null, 2)}\n`);

async function auditKit(opportunityId, directory, opportunity) {
  const manifest = await readJson(path.join(directory, "manifest.json"));
  const captureQa = await readJson(path.join(directory, "capture-qa-report.json"));
  // Prefer the job-aware report when it exists. A missing report is never
  // treated as an implicit pass.
  const imageQa = await firstJson(directory, ["seo-generation-qa-report.json", "image-qa-report.json"]);
  const imageReview = await readJson(path.join(directory, "image-review.json"));
  const renderQa = await readJson(path.join(directory, "qa-report.json"));
  const editorial = await firstJson(directory, ["editorial-review.json", "seo-editorial.json", "review.json"]);
  const rights = await firstJson(directory, ["rights.json", "provenance.json", "asset-provenance.json"]);
  const media = await firstJson(directory, ["media.json", "public-assets.json", "seo-assets.json"]);
  const generationEvidence = await firstJson(directory, ["generation-runs.json", "seo-generation-runs.json", "generation-evidence.json"]);

  const manifestResults = Array.isArray(manifest?.results) ? manifest.results.filter((item) => typeof item === "string") : [];
  const manifestScreenshots = Array.isArray(manifest?.screenshots) ? manifest.screenshots.filter((item) => typeof item === "string") : [];
  const unsafeResultFiles = manifestResults.filter((file) => !isSafeKitFile(file));
  const unsafeScreenshotFiles = manifestScreenshots.filter((file) => !isSafeKitFile(file));
  const safeResultFiles = manifestResults.filter(isSafeKitFile);
  const safeScreenshotFiles = manifestScreenshots.filter(isSafeKitFile);
  const resultFiles = await Promise.all(safeResultFiles.map(async (file) => ({ file, ...(await fileInfo(path.join(directory, file))) })));
  const screenshotFiles = await Promise.all(safeScreenshotFiles.map(async (file) => ({ file, ...(await fileInfo(path.join(directory, file))) })));
  const sourceRelative = typeof manifest?.input === "string" ? manifest.input : null;
  const imageJob = typeof manifest?.imageJob === "string" ? manifest.imageJob.trim().toLowerCase() : null;
  const sourcePath = sourceRelative ? path.resolve(projectDirectory, sourceRelative) : null;
  const sourceInsideProject = sourcePath ? isInsideProject(sourcePath) : false;
  const sourceInfo = sourceInsideProject && sourcePath ? await fileInfo(sourcePath) : { exists: false, bytes: 0 };
  const sourceChecksum = sourceInfo.exists && sourcePath ? await fileChecksum(sourcePath) : null;

  const runs = extractRuns(generationEvidence, manifest);
  const jobNames = new Set(runs.map((run) => String(run.imageJob ?? run.job ?? "").trim().toLowerCase()).filter(Boolean));
  // A production pack is intentionally split across three independently
  // recorded kits. A labeled kit therefore needs evidence for its own job;
  // the all-three-jobs requirement is enforced by `packStatus` below.
  const labeledJobKit = ["listing", "lifestyle", "detail"].includes(imageJob ?? "");
  const matchingJobRun = labeledJobKit ? runs.some((run) => run.imageJob === imageJob) : false;
  const independentJobs = labeledJobKit ? matchingJobRun : ["listing", "lifestyle", "detail"].every((job) => jobNames.has(job));
  const publicMedia = extractPublicMedia(media, manifest);
  const rightsStatus = extractRightsStatus(rights, media, manifest);
  const author = extractIdentity(editorial, manifest, "author");
  const reviewer = extractIdentity(editorial, manifest, "reviewer");
  const blockers = [];
  const warnings = [];

  if (!manifest || manifest.id !== opportunityId) blockers.push("manifest_missing_or_id_mismatch");
  if (!imageJob || !["listing", "lifestyle", "detail"].includes(imageJob)) blockers.push("image_job_label_missing_or_invalid");
  if (unsafeResultFiles.length) blockers.push("generated_output_path_invalid");
  if (unsafeScreenshotFiles.length) blockers.push("workflow_screenshot_path_invalid");
  if (sourcePath && !sourceInsideProject) blockers.push("source_asset_outside_project");
  if (!sourceInfo.exists) blockers.push("source_asset_missing_or_not_in_project");
  if (sourceInfo.exists && sourceInfo.bytes < 1024) blockers.push("source_asset_too_small");
  const claimedSourceChecksum = extractSourceChecksum(rights, media, manifest);
  if (claimedSourceChecksum && (!sourceChecksum || claimedSourceChecksum.toLowerCase() !== sourceChecksum.toLowerCase())) {
    blockers.push("source_checksum_mismatch");
  }
  if (rights?.approvedForPublic === true && !["approved", "owned", "user-supplied", "licensed"].includes(rightsStatus ?? "")) {
    blockers.push("rights_approval_flag_inconsistent");
  }
  if (captureQa?.status !== "pass") blockers.push("capture_qa_not_passed");
  if (!imageQa) blockers.push("image_qa_missing");
  else if (imageQa.status !== "pass") blockers.push("image_qa_not_passed");
  if (!imageReview) blockers.push("image_review_missing");
  else if (imageReview.status !== "pass") blockers.push("image_review_not_passed");
  if (renderQa && renderQa.status !== "pass") blockers.push("render_qa_not_passed");
  if (!safeResultFiles.length || resultFiles.some((item) => !item.exists || item.bytes < 1024)) blockers.push("generated_output_missing_or_too_small");
  if (safeScreenshotFiles.length < 4 || screenshotFiles.some((item) => !item.exists || item.bytes < 1024)) blockers.push("workflow_screenshot_sequence_missing");
  if (labeledJobKit) {
    if (!matchingJobRun) blockers.push("generation_run_for_labeled_job_missing");
  } else {
    if (runs.length < 3) blockers.push("independent_generation_runs_missing");
    if (!independentJobs) blockers.push("listing_lifestyle_detail_jobs_required");
  }
  if (runs.some((run) => !run.provider || !run.model || !run.prompt || !run.kitChecksum)) blockers.push("generation_run_metadata_incomplete");
  if (!rightsStatus || !["approved", "owned", "user-supplied", "licensed"].includes(rightsStatus)) blockers.push("rights_or_provenance_not_explicitly_approved");
  if (!publicMedia.length || publicMedia.some((item) => !isHttpsUrl(item.url))) blockers.push("durable_public_https_media_missing");
  if (publicMedia.some((item) => !isSha256(item.checksum) || !Number.isInteger(item.width) || !Number.isInteger(item.height) || !item.alt)) blockers.push("public_media_metadata_incomplete");
  if (!author) blockers.push("author_missing");
  if (!reviewer) blockers.push("reviewer_missing");
  if (!opportunity?.buyerQuestion || !opportunity?.assetPlan) warnings.push("opportunity_brief_missing_or_incomplete");
  if (manifest?.baseUrl && /^https?:\/\/127\.0\.0\.1|localhost/.test(String(manifest.baseUrl))) warnings.push("kit_was_recorded_against_local_origin");
  if (manifestResults.length === 1) warnings.push("single_variation_kit_needs_three_independent_jobs_for_a_page");

  const inventoryFingerprint = await directoryInventoryFingerprint(directory);
  const status = blockers.length === 0 ? "ready-for-draft" : "blocked";
  return {
    opportunityId,
    kit: path.relative(projectDirectory, directory),
    recordedAt: manifest?.recordedAt ?? null,
    imageJob,
    status,
    inventoryFingerprint,
    source: { path: sourceRelative, exists: sourceInfo.exists, bytes: sourceInfo.bytes, checksum: sourceChecksum, claimedChecksum: claimedSourceChecksum },
    outputs: resultFiles,
    screenshots: screenshotFiles,
    generation: { runCount: runs.length, jobs: [...jobNames].sort(), labeledJobKit, matchingJobRun, independentJobs },
    rightsStatus,
    publicMediaCount: publicMedia.length,
    author,
    reviewer,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}

function extractRuns(value, manifest) {
  const candidates = [
    Array.isArray(value) ? value : null,
    value && Array.isArray(value.runs) ? value.runs : null,
    value && Array.isArray(value.generationRuns) ? value.generationRuns : null,
    Array.isArray(manifest?.generationRuns) ? manifest.generationRuns : null,
  ];
  return (candidates.find(Array.isArray) ?? []).filter((run) => run && typeof run === "object").map((run) => ({
    imageJob: String(run.imageJob ?? run.job ?? "").trim().toLowerCase(),
    provider: typeof run.provider === "string" ? run.provider.trim() : "",
    model: typeof run.model === "string" ? run.model.trim() : "",
    prompt: typeof run.prompt === "string" ? run.prompt.trim() : "",
    kitChecksum: typeof run.kitChecksum === "string" ? run.kitChecksum.trim() : "",
  }));
}

function extractPublicMedia(value, manifest) {
  const candidates = [
    Array.isArray(value) ? value : null,
    value && Array.isArray(value.assets) ? value.assets : null,
    Array.isArray(manifest?.publicAssets) ? manifest.publicAssets : null,
  ];
  return (candidates.find(Array.isArray) ?? []).filter((item) => item && typeof item === "object").map((item) => ({
    url: String(item.url ?? item.publicUrl ?? item.public_url ?? ""),
    checksum: String(item.checksum ?? ""),
    width: Number.isInteger(item.width) ? item.width : null,
    height: Number.isInteger(item.height) ? item.height : null,
    alt: typeof item.alt === "string" ? item.alt.trim() : typeof item.altText === "string" ? item.altText.trim() : "",
  }));
}

function extractRightsStatus(...values) {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const candidate = value.rightsStatus ?? value.rights_status ?? value.source?.rightsStatus ?? value.source?.rights_status;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().toLowerCase();
    if (Array.isArray(value.assets)) {
      const nested = value.assets.find((item) => typeof item?.rightsStatus === "string" || typeof item?.rights_status === "string");
      const nestedStatus = nested?.rightsStatus ?? nested?.rights_status;
      if (typeof nestedStatus === "string" && nestedStatus.trim()) return nestedStatus.trim().toLowerCase();
    }
  }
  return null;
}

function extractSourceChecksum(...values) {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const candidate = value.sourceChecksum ?? value.source_checksum ?? value.source?.checksum ?? value.source?.sourceChecksum;
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractIdentity(editorial, manifest, kind) {
  const values = [editorial?.[kind], editorial?.[`${kind}Id`], editorial?.[`${kind}_id`], manifest?.[kind], manifest?.[`${kind}Id`]];
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object" && typeof (value.id ?? value.name) === "string") return String(value.id ?? value.name).trim();
  }
  return null;
}

async function firstJson(directory, names) {
  for (const name of names) {
    const value = await readJson(path.join(directory, name));
    if (value) return value;
  }
  return null;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function listDirectories(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function fileInfo(filePath) {
  try {
    const result = await stat(filePath);
    return { exists: result.isFile(), bytes: result.size };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

async function fileChecksum(filePath) {
  try {
    const hash = createHash("sha256");
    hash.update(await readFile(filePath));
    return `sha256:${hash.digest("hex")}`;
  } catch {
    return null;
  }
}

// This is an inexpensive inventory fingerprint, not the evidence checksum
// accepted by the draft validator. The validator still requires a real
// sha256:<64-hex> checksum for every source/output asset.
async function directoryInventoryFingerprint(directory) {
  const files = [];
  await collectFiles(directory, files);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(directory, file));
    hash.update(String((await stat(file)).size));
  }
  return `sha256:${hash.digest("hex")}`;
}

async function collectFiles(directory, result) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(entryPath, result);
    else result.push(entryPath);
  }
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\/[^\s]+$/i.test(value);
}

function isSafeKitFile(value) {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\0")) return false;
  const segments = value.split(/[\\/]+/);
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function isInsideProject(filePath) {
  const relative = path.relative(projectDirectory, filePath);
  return relative === ""
    || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/i.test(value);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}
