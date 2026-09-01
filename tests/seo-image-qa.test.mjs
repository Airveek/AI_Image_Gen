import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const qaScript = path.join(projectRoot, "scripts", "qa-ecommerce-image.mjs");
const fixtureImage = path.join(projectRoot, "public", "images", "airveek", "audiences", "ecommerce-product-mockup-v1.png");

const passingReview = {
  status: "pass",
  productIdentity: "pass",
  buyerDetail: "pass",
  realWorldScene: "pass",
  thumbnailReadability: "pass",
  plainBackgroundOnly: "pass",
};

async function createKit(review) {
  const directory = await mkdtemp(path.join(tmpdir(), "airveek-image-qa-"));
  await copyFile(fixtureImage, path.join(directory, "result-1.png"));
  await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify({
    id: "TEST01",
    variations: 1,
    results: ["result-1.png"],
  })}\n`);
  if (review) await writeFile(path.join(directory, "image-review.json"), `${JSON.stringify(review)}\n`);
  return directory;
}

function runQa(directory) {
  return spawnSync(process.execPath, [qaScript, directory], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("image QA fails closed when human review is missing", async () => {
  const directory = await createKit(null);
  try {
    const result = runQa(directory);
    assert.notEqual(result.status, 0, result.stdout);
    const report = JSON.parse(await readFile(path.join(directory, "image-qa-report.json"), "utf8"));
    assert.equal(report.status, "fail");
    assert.equal(report.checks.humanReview.status, "missing");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("image QA exits successfully only after every review field passes", async () => {
  const directory = await createKit(passingReview);
  try {
    const result = runQa(directory);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(await readFile(path.join(directory, "image-qa-report.json"), "utf8"));
    assert.equal(report.status, "pass");
    assert.equal(report.checks.oneImage.pass, true);
    assert.equal(report.checks.humanReview.pass, true);
    assert.equal(report.checks.resultFile.pass, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
