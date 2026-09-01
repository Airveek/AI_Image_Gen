import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import path from "node:path";

import { inspectSeoBriefAssets } from "../scripts/seo-brief-assets.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidate = JSON.parse(readFileSync(path.join(projectRoot, "docs/research/seo-brief-candidates/ECO01-listing.json"), "utf8"));

test("brief asset preflight records a checksum and keeps unverified branding review-gated", async () => {
  // The production fixtures now carry the fictional MORROW demo brand. Keep
  // this regression focused on the legacy/unbranded branch by removing that
  // optional field for this one preflight assertion.
  const result = await inspectSeoBriefAssets({ ...candidate, brand: undefined }, { projectDirectory: projectRoot });
  assert.equal(result.valid, true);
  assert.match(result.sourceAsset.checksum, /^sha256:[a-f0-9]{64}$/);
  assert.ok(result.sourceAsset.width >= 320);
  assert.equal(result.brandManifest.logoPolicy, "unverified_brand");
  assert.equal(result.brandManifest.logoAsset, null);
  assert.equal(result.brandManifest.rightsDecision, "pending-human-review");
});

test("brief asset preflight blocks a missing source instead of creating a blind handoff", async () => {
  const result = await inspectSeoBriefAssets({ ...candidate, sourceAssetPath: "public/images/does-not-exist.png" }, { projectDirectory: projectRoot });
  assert.equal(result.valid, false);
  assert.ok(result.blockers.includes("source_asset_missing"));
});

test("brief asset preflight blocks an authorized logo policy without a supplied logo asset", async () => {
  const result = await inspectSeoBriefAssets({ ...candidate, brand: { logoPolicy: "authorized_overlay_branding", requiresLogo: true } }, { projectDirectory: projectRoot });
  assert.equal(result.valid, false);
  assert.ok(result.blockers.includes("authorized_logo_asset_required"));
});

test("brief asset preflight never treats a candidate rights flag as human approval", async () => {
  const result = await inspectSeoBriefAssets({ ...candidate, rightsStatus: "approved" }, { projectDirectory: projectRoot });
  assert.equal(result.valid, false);
  assert.ok(result.blockers.includes("source_asset_rights_requires_persisted_human_approval"));
  assert.equal(result.sourceAsset.rightsApproved, false);
});
