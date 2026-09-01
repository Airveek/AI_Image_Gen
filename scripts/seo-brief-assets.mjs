import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RIGHTS_STATUSES = new Set(["unreviewed", "approved", "owned", "user-supplied", "licensed", "restricted", "rejected"]);
const LOGO_POLICIES = new Set([
  "inherent_product_branding",
  "authorized_overlay_branding",
  "marketplace_restricted",
  "unverified_brand",
]);
const IMAGE_MIME_TYPES = new Map([
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
  ["gif", "image/gif"],
  ["tiff", "image/tiff"],
]);

/**
 * Inspect the durable source and optional brand/logo inputs carried by a
 * research brief. This is intentionally a preflight only: it computes a
 * checksum and dimensions, but it never claims ownership or approves rights.
 * A supplied logo is accepted only as an asset candidate; the human rights
 * decision remains a separate persisted packet/checksum handoff.
 */
export async function inspectSeoBriefAssets(input, options = {}) {
  const projectDirectory = path.resolve(options.projectDirectory ?? process.cwd());
  const blockers = [];
  const warnings = [];
  const brief = isRecord(input) ? input : {};
  const sourceAssetPath = text(brief.sourceAssetPath);
  let sourceAsset = null;

  if (!sourceAssetPath) {
    blockers.push("source_asset_path_required");
  } else {
    const inspected = await inspectImage(sourceAssetPath, projectDirectory, "source_asset", blockers);
    if (inspected) {
      const rightsStatus = text(brief.rightsStatus).toLowerCase() || "unreviewed";
      if (!RIGHTS_STATUSES.has(rightsStatus)) blockers.push("source_asset_rights_status_invalid");
      if (["approved", "owned", "user-supplied", "licensed"].includes(rightsStatus)) {
        // A candidate file cannot self-approve an asset. The durable rights
        // packet, reviewer identity, evidence ID, and exact checksum are the
        // only authority for an approval decision.
        blockers.push("source_asset_rights_requires_persisted_human_approval");
      }
      sourceAsset = {
        ...inspected,
        rightsStatus,
        rightsApproved: false,
        rightsEvidenceId: null,
        provenance: "brief-source-asset-awaiting-human-rights-review",
      };
    }
  }

  const brand = isRecord(brief.brand) ? brief.brand : {};
  const logoPolicy = text(brand.logoPolicy || brief.logoPolicy).toLowerCase() || "unverified_brand";
  const logoRequired = brand.requiresLogo === true || logoPolicy === "authorized_overlay_branding";
  const logoAssetPath = text(brand.logoAssetPath || brief.logoAssetPath);
  const logoRightsStatus = text(brand.logoRightsStatus || brief.logoRightsStatus).toLowerCase() || "unreviewed";
  let logoAsset = null;

  if (!LOGO_POLICIES.has(logoPolicy)) {
    blockers.push("brand_logo_policy_invalid");
  }
  if (logoRequired && !logoAssetPath) {
    blockers.push("authorized_logo_asset_required");
  }
  if (logoAssetPath && logoPolicy === "unverified_brand") {
    blockers.push("brand_logo_policy_must_be_explicit_before_using_logo_asset");
  }
  if (logoAssetPath) {
    if (!RIGHTS_STATUSES.has(logoRightsStatus)) blockers.push("brand_logo_rights_status_invalid");
    logoAsset = await inspectImage(logoAssetPath, projectDirectory, "brand_logo_asset", blockers);
    if (logoAsset && logoRightsStatus === "unreviewed") {
      warnings.push("brand_logo_rights_review_required");
    }
  } else if (logoPolicy === "unverified_brand") {
    // Do not silently add a logo or infer permission from a generated image.
    warnings.push("brand_logo_not_supplied; keep output unbranded until a reviewer classifies the brand policy");
  }

  return {
    valid: blockers.length === 0,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    sourceAsset,
    brandManifest: {
      logoPolicy,
      logoRequired,
      logoRightsStatus,
      logoAsset,
      rightsDecision: "pending-human-review",
    },
  };
}

async function inspectImage(rawPath, projectDirectory, label, blockers) {
  const resolved = safeProjectPath(rawPath, projectDirectory);
  if (!resolved) {
    blockers.push(`${label}_path_must_be_relative_to_project`);
    return null;
  }
  let info;
  try {
    info = await stat(resolved);
  } catch {
    blockers.push(`${label}_missing`);
    return null;
  }
  if (!info.isFile() || info.size < 1_024) {
    blockers.push(`${label}_missing_or_too_small`);
    return null;
  }
  let metadata;
  try {
    metadata = await sharp(resolved).metadata();
  } catch {
    blockers.push(`${label}_not_a_supported_image`);
    return null;
  }
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (width < 320 || height < 320) blockers.push(`${label}_dimensions_too_small`);
  const format = String(metadata.format ?? "").toLowerCase();
  if (!IMAGE_MIME_TYPES.has(format)) blockers.push(`${label}_mime_type_unknown`);
  const checksum = await hashFile(resolved);
  return {
    path: path.relative(projectDirectory, resolved).split(path.sep).join("/"),
    checksum,
    bytes: info.size,
    width,
    height,
    format: format || null,
    mimeType: IMAGE_MIME_TYPES.get(format) ?? null,
  };
}

function safeProjectPath(rawPath, projectDirectory) {
  if (typeof rawPath !== "string" || !rawPath.trim() || path.isAbsolute(rawPath)) return null;
  const candidate = path.resolve(projectDirectory, rawPath.trim());
  const relative = path.relative(projectDirectory, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return candidate;
}

async function hashFile(filePath) {
  return `sha256:${createHash("sha256").update(await readFile(filePath)).digest("hex")}`;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
