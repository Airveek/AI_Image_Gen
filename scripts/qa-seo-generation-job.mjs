#!/usr/bin/env node

/**
 * Job-aware visual QA for one independent SEO generation recording.
 *
 * This intentionally remains conservative: it verifies one result, the
 * recorded job label, the real workflow capture checkpoints, basic
 * dimensions, and an attributable human review decision. The
 * listing/lifestyle/detail rules differ, so a single generic image-review
 * rubric must not silently make a lifestyle scene pass as a marketplace
 * listing or vice versa.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const kitDirectory = path.resolve(process.argv[2] ?? "");
if (!kitDirectory) throw new Error("Run: node scripts/qa-seo-generation-job.mjs <content-kit-directory>");

const manifest = JSON.parse(await readFile(path.join(kitDirectory, "manifest.json"), "utf8"));
const review = await readOptionalJson(path.join(kitDirectory, "image-review.json"));
const job = typeof manifest.imageJob === "string" ? manifest.imageJob.trim().toLowerCase() : "";
const declaredResult = Array.isArray(manifest.results)
  ? manifest.results.find((file) => typeof file === "string" && file.trim() && isSafeKitFile(file))
  : null;
const resultFile = declaredResult ?? "result-1.jpg";
const resultPath = path.join(kitDirectory, resultFile);
const resultProbe = await probeImage(resultPath, resultFile);
const captureEvidence = await auditWorkflowCapture(kitDirectory, manifest);
const reviewIdentityPass = typeof review?.reviewer === "string"
  && review.reviewer.trim().length >= 2
  && typeof review?.reviewedAt === "string"
  && Number.isFinite(Date.parse(review.reviewedAt));
const baseReviewPass = review?.status === "pass"
  && review?.productIdentity === "pass"
  && review?.buyerDetail === "pass"
  && review?.thumbnailReadability === "pass"
  && reviewIdentityPass;
const jobReviewPass = job === "listing"
  ? review?.plainBackgroundOnly === "pass"
  : job === "lifestyle"
    ? review?.realWorldScene === "pass"
    : job === "detail"
      ? review?.detailReadability === "pass" || review?.buyerDetail === "pass"
      : false;

const checks = {
  job: { pass: ["listing", "lifestyle", "detail"].includes(job), value: job },
  oneVariation: { pass: Number(manifest.variations) === 1, value: manifest.variations ?? null },
  workflowCapture: captureEvidence,
  resultFile: resultProbe,
  humanReview: {
    pass: baseReviewPass && jobReviewPass,
    file: review ? "image-review.json" : null,
    status: review?.status ?? "missing",
    requiredForJob: job === "listing" ? "plainBackgroundOnly" : job === "lifestyle" ? "realWorldScene" : "detailReadability|buyerDetail",
  },
};
const report = {
  version: 2,
  kitDirectory,
  opportunityId: manifest.id ?? null,
  imageJob: job || null,
  status: Object.values(checks).every((check) => check.pass) ? "pass" : "fail",
  checks,
  rule: "Every listing, lifestyle, and detail job needs its own one-variation recorded workflow, four checkpoints, decodable raw video, and attributable human review before draft ingestion.",
};
await writeFile(path.join(kitDirectory, "seo-generation-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, id: manifest.id ?? null, imageJob: job, checks }, null, 2));
process.exit(report.status === "pass" ? 0 : 1);

async function probeImage(filePath, fileName) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=size:stream=codec_name,width,height", "-of", "json", filePath]);
    const value = JSON.parse(stdout);
    const stream = (value.streams ?? []).find((item) => item.width && item.height);
    const width = Number(stream?.width ?? 0);
    const height = Number(stream?.height ?? 0);
    return {
      pass: Boolean(stream) && width >= 600 && height >= 600 && width <= 16384 && height <= 16384,
      file: fileName,
      bytes: Number(value.format?.size ?? 0),
      width,
      height,
      codec: stream?.codec_name ?? null,
    };
  } catch (error) {
    return { pass: false, file: fileName, error: error instanceof Error ? error.message : String(error) };
  }
}

async function auditWorkflowCapture(directory, value) {
  const resultCount = Number(value?.variations);
  const expectedScreenshots = [
    "screenshots/01-workspace-ready.png",
    "screenshots/02-reference-selected.png",
    "screenshots/03-settings-complete.png",
    ...Array.from({ length: Number.isInteger(resultCount) && resultCount > 0 ? resultCount : 1 }, (_, offset) => `screenshots/04-result-${String(offset + 1).padStart(2, "0")}.png`),
  ];
  const declared = Array.isArray(value?.screenshots) ? value.screenshots : [];
  const screenshots = await Promise.all(expectedScreenshots.map(async (file) => {
    try {
      const info = await stat(path.join(directory, file));
      return { file, pass: declared.includes(file) && info.size >= 1024, bytes: info.size };
    } catch {
      return { file, pass: false, bytes: 0 };
    }
  }));
  const rawPath = path.join(directory, "raw-demo.webm");
  const raw = await probeVideo(rawPath);
  const timeline = await readOptionalJson(path.join(directory, "timeline.json"));
  const events = Array.isArray(timeline?.events) ? timeline.events : [];
  const eventCounts = {
    generationStarted: events.filter((event) => event?.name === "generation_started").length,
    generationReady: events.filter((event) => event?.name === "generation_ready").length,
    resultSaved: events.filter((event) => event?.name === "result_saved").length,
  };
  const eventPass = Number.isInteger(resultCount) && resultCount === 1
    && eventCounts.generationStarted >= resultCount
    && eventCounts.generationReady >= resultCount
    && eventCounts.resultSaved >= resultCount;
  return {
    pass: value?.captureMode === "recorded-workflow" && raw.pass && screenshots.every((item) => item.pass) && eventPass,
    captureMode: value?.captureMode ?? null,
    raw,
    screenshots: { pass: screenshots.every((item) => item.pass), expected: expectedScreenshots, files: screenshots },
    timeline: { pass: eventPass, eventCounts },
  };
}

async function probeVideo(filePath) {
  try {
    const info = await stat(filePath);
    if (info.size < 100_000) return { pass: false, bytes: info.size, error: "raw_recording_too_small" };
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", filePath]);
    const value = JSON.parse(stdout);
    const video = (value.streams ?? []).find((stream) => stream.width && stream.height);
    await execFileAsync("ffmpeg", ["-v", "error", "-i", filePath, "-map", "0:v:0", "-f", "null", "-"]);
    return { pass: Boolean(video), bytes: info.size, duration: Number(value.format?.duration ?? 0), codec: video?.codec_name ?? null, width: video?.width ?? null, height: video?.height ?? null };
  } catch (error) {
    return { pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function isSafeKitFile(file) {
  return !path.isAbsolute(file) && !file.includes("..") && !file.includes("/") && !file.includes("\\");
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
