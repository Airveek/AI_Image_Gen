#!/usr/bin/env node

/**
 * Promote reviewed local kit media into the durable public image tree.
 *
 * The command is dry-run by default. It requires an explicit rights decision
 * and a per-asset media map; `--apply` is the only mode that writes files.
 * Existing files are never overwritten with different bytes.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createReadStream as openReadStream, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const projectDirectory = path.resolve(process.cwd());
const [kitArgument, rightsArgument, mediaMapArgument] = process.argv.slice(2).filter((value) => value !== "--apply");
const apply = process.argv.includes("--apply");
if (!kitArgument || !rightsArgument || !mediaMapArgument) {
  console.error("Usage: pnpm seo:promote-kit <kit-directory> <rights.json> <media-map.json> [--apply]");
  process.exit(2);
}

const kitDirectory = safeProjectPath(kitArgument, "kit directory");
const rightsPath = safeProjectPath(rightsArgument, "rights file");
const mediaMapPath = safeProjectPath(mediaMapArgument, "media map");
const manifest = await readJson(path.join(kitDirectory, "manifest.json"));
const rights = await readJson(rightsPath);
const mediaMap = await readJson(mediaMapPath);
const errors = [];
const warnings = [];

if (!manifest || typeof manifest.id !== "string" || !/^[A-Z0-9_-]+$/.test(manifest.id)) errors.push("manifest_missing_or_invalid_id");
if (!rights || rights.approvedForPublic !== true) errors.push("rights_approval_required");
const rightsStatus = String(rights?.rightsStatus ?? "").trim().toLowerCase();
if (rightsStatus !== "approved") errors.push("rights_status_must_be_approved");
if (typeof rights?.provenance !== "string" || rights.provenance.trim().length < 3) errors.push("rights_provenance_required");
const rightsEvidenceId = typeof rights?.evidenceId === "string" ? rights.evidenceId.trim() : "";
if (!rightsEvidenceId) errors.push("rights_evidence_id_required");
if (typeof rights?.reviewer !== "string" || rights.reviewer.trim().length < 2) errors.push("rights_reviewer_required");
if (typeof rights?.reviewedAt !== "string" || !Number.isFinite(Date.parse(rights.reviewedAt))) errors.push("rights_reviewed_at_required");
const validLogoPolicies = new Set(["inherent_product_branding", "authorized_overlay_branding", "marketplace_restricted"]);
const defaultLogoPolicy = String(rights?.logoPolicy ?? "").trim();
if (!validLogoPolicies.has(defaultLogoPolicy)) errors.push("logo_policy_required_and_must_be_verified");

const assets = Array.isArray(mediaMap?.assets) ? mediaMap.assets.filter((item) => item && typeof item === "object") : [];
if (!assets.length) errors.push("media_map_assets_required");
const seenFiles = new Set();
const promoted = [];
for (const [index, item] of assets.entries()) {
  const file = typeof item.file === "string" ? item.file.trim() : "";
  const role = typeof item.role === "string" ? item.role.trim() : "";
  const assetId = typeof item.assetId === "string" && item.assetId.trim() ? item.assetId.trim() : `${manifest?.id ?? "kit"}-${role}-${index + 1}`;
  if (!file || !role) {
    errors.push(`media_map_asset_${index + 1}_missing_file_or_role`);
    continue;
  }
  if (!new Set(["source", "hero", "selected", "rejected", "corrected", "screenshot", "video", "og"]).has(role)) {
    errors.push(`media_map_asset_${index + 1}_invalid_role`);
    continue;
  }
  if (seenFiles.has(file)) {
    errors.push(`media_map_duplicate_file:${file}`);
    continue;
  }
  seenFiles.add(file);
  const sourcePath = resolveAssetPath(file, kitDirectory);
  const info = await fileInfo(sourcePath);
  if (!info.exists || info.bytes < 1_024) {
    errors.push(`media_asset_missing_or_too_small:${file}`);
    continue;
  }
  if (role === "video") {
    warnings.push(`video_asset_requires_separate_video_metadata:${file}`);
    continue;
  }
  let metadata;
  try {
    metadata = await sharp(sourcePath).metadata();
  } catch {
    errors.push(`media_asset_not_a_supported_image:${file}`);
    continue;
  }
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (width < 320 || height < 320) errors.push(`media_asset_dimensions_too_small:${file}`);
  const checksum = await hashFile(sourcePath);
  const extension = extensionForMime(metadata.format);
  const publicPath = `/images/airveek/seo/${slugify(String(manifest?.id ?? "kit"))}/${checksum.slice(7, 23)}/${slugify(role)}-${checksum.slice(7, 23)}.${extension}`;
  const storageKey = publicPath.replace(/^\//, "");
  const url = `https://airveek.com${publicPath}`;
  const itemRights = String(item.rightsStatus ?? rightsStatus).trim().toLowerCase();
  const itemLogoPolicy = String(item.logoPolicy ?? defaultLogoPolicy).trim();
  if (itemRights !== "approved") errors.push(`media_asset_rights_not_approved:${file}`);
  if (!validLogoPolicies.has(itemLogoPolicy)) errors.push(`media_asset_logo_policy_invalid:${file}`);
  const alt = typeof item.alt === "string" ? item.alt.trim() : "";
  if (alt.length < 5) errors.push(`media_asset_alt_text_missing:${file}`);
  promoted.push({
    assetId,
    role,
    file,
    url,
    storageKey,
    mimeType: mimeForFormat(metadata.format),
    width,
    height,
    alt,
    caption: typeof item.caption === "string" ? item.caption.trim() : "",
    checksum,
    rightsStatus: itemRights,
    provenance: typeof item.provenance === "string" && item.provenance.trim() ? item.provenance.trim() : rights.provenance.trim(),
    logoPolicy: itemLogoPolicy,
    qaStatus: item.qaStatus === "pass" ? "pass" : "pending",
    generationMetadata: { rightsEvidenceId, rightsApproved: true },
  });
}

if (!promoted.some((item) => item.role === "source")) errors.push("media_map_source_asset_required");
if (!promoted.some((item) => item.role === "hero" || item.role === "selected")) errors.push("media_map_selected_asset_required");
if (manifest?.imageJob && !["listing", "lifestyle", "detail"].includes(String(manifest.imageJob).toLowerCase())) warnings.push("manifest_image_job_is_not_listing_lifestyle_or_detail");

const kitChecksum = await hashDirectory(kitDirectory);
const output = {
  version: 1,
  opportunityId: manifest?.id ?? null,
  kitPath: path.relative(projectDirectory, kitDirectory),
  kitChecksum,
  approvedForPublic: rights?.approvedForPublic === true,
  rightsStatus,
  provenance: typeof rights?.provenance === "string" ? rights.provenance.trim() : null,
  rightsEvidenceId,
  logoPolicy: defaultLogoPolicy,
  assets: promoted,
  warnings: [...new Set(warnings)],
  status: errors.length ? "blocked" : apply ? "applied" : "ready-to-apply",
};

if (errors.length) {
  console.log(JSON.stringify({ ...output, errors: [...new Set(errors)] }, null, 2));
  process.exit(1);
}

if (apply) {
  for (const asset of promoted) {
    const sourcePath = resolveAssetPath(asset.file, kitDirectory);
    const destinationPath = safeProjectPath(path.join("public", asset.storageKey), "public asset destination");
    await mkdir(path.dirname(destinationPath), { recursive: true });
    const existing = await fileInfo(destinationPath);
    if (existing.exists) {
      const existingChecksum = await hashFile(destinationPath);
      if (existingChecksum !== asset.checksum) throw new Error(`Refusing to overwrite a different public asset: ${destinationPath}`);
    } else {
      await copyFile(sourcePath, destinationPath);
    }
  }
  await writeFile(path.join(kitDirectory, "public-assets.json"), `${JSON.stringify(output, null, 2)}\n`);
}

console.log(JSON.stringify(output, null, 2));

function safeProjectPath(value, label) {
  const candidate = path.resolve(projectDirectory, value);
  const relative = path.relative(projectDirectory, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label} must be inside the project.`);
  return candidate;
}

function resolveAssetPath(value, kitDirectory) {
  const fromKit = path.resolve(kitDirectory, value);
  if (isInsideProject(fromKit) && existsSync(fromKit)) return fromKit;
  const fromProject = path.resolve(projectDirectory, value);
  if (isInsideProject(fromProject) && existsSync(fromProject)) return fromProject;
  throw new Error(`Media path must remain inside the project: ${value}`);
}

function isInsideProject(candidate) {
  const relative = path.relative(projectDirectory, candidate);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function readJson(filePath) {
  try { return JSON.parse(await readFile(filePath, "utf8")); } catch { return null; }
}

async function fileInfo(filePath) {
  try {
    const result = await stat(filePath);
    return { exists: result.isFile(), bytes: result.size };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of openReadStream(filePath)) hash.update(chunk);
  return `sha256:${hash.digest("hex")}`;
}

async function hashDirectory(directory) {
  const files = [];
  await collectFiles(directory, files);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(directory, file));
    for await (const chunk of openReadStream(file)) hash.update(chunk);
  }
  return hash.digest("hex");
}

async function collectFiles(directory, result) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(entryPath, result);
    else result.push(entryPath);
  }
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function extensionForMime(format) {
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  return "jpg";
}

function mimeForFormat(format) {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}
