import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Local development commonly keeps credentials and the recording base URL in
// .env.local. Load it before .env so the explicit local file wins while
// preserving the production-style fallback for CI and Vercel jobs.
for (const envFile of [".env.local", ".env"]) {
  try { process.loadEnvFile?.(envFile); } catch { /* optional file */ }
}

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(process.cwd());
const opportunityId = (process.argv[2] ?? "").trim();
const REQUIRED_IMAGE_JOBS = ["listing", "lifestyle", "detail"];
if (!/^[A-Z0-9_-]+$/.test(opportunityId)) {
  throw new Error("Run: node scripts/run-opportunity-production.mjs ECO11");
}

const graph = JSON.parse(await readFile(path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json"), "utf8"));
const opportunity = graph.opportunities?.find((item) => item.id === opportunityId);
if (!opportunity) throw new Error(`Opportunity not found: ${opportunityId}`);

const opportunityKitsDirectory = path.join(projectDirectory, "content-kits", opportunityId);
let kitDirectory = await latestKit(opportunityKitsDirectory);
if (kitDirectory && await isImagePreview(kitDirectory)) {
  await run("node", ["scripts/qa-ecommerce-image.mjs", kitDirectory]);
  const previewReport = JSON.parse(await readFile(path.join(kitDirectory, "image-qa-report.json"), "utf8"));
  if (previewReport.status !== "pass") {
    throw new Error(`${opportunityId}: image preview is not approved; inspect the selected result image and add a human image-review.json pass before recording.`);
  }
  console.log(`${opportunityId}: approved image preview; recording the real workflow`);
  await recordRequiredJobs(opportunityId);
  kitDirectory = await latestKit(opportunityKitsDirectory);
}
if (!kitDirectory || !(await isUsableCapture(kitDirectory))) {
  console.log(`${opportunityId}: creating an unrecorded single-image preview first`);
  await run("pnpm", ["preview:usecase", opportunityId]);
  kitDirectory = await latestKit(path.join(projectDirectory, "content-kits", opportunityId));
  if (kitDirectory) await run("node", ["scripts/qa-ecommerce-image.mjs", kitDirectory]);
  throw new Error(`${opportunityId}: image preview created; inspect it, add image-review.json after approval, then rerun this opportunity.`);
}

// A page pack is not complete when one recording contains three variations.
// Each job must have its own prompt/settings/timeline so the evidence is
// independently auditable. Record any missing jobs from the reviewed source,
// then select the listing kit as the canonical tutorial/rendering source.
const jobKits = await latestUsableKitsByJob(opportunityKitsDirectory);
const missingJobs = REQUIRED_IMAGE_JOBS.filter((job) => !jobKits.has(job));
if (missingJobs.length) {
  await recordRequiredJobs(opportunityId, missingJobs);
}
const completedJobKits = await latestUsableKitsByJob(opportunityKitsDirectory);
const incompleteJobs = REQUIRED_IMAGE_JOBS.filter((job) => !completedJobKits.has(job));
if (incompleteJobs.length) {
  throw new Error(`${opportunityId}: independent ${incompleteJobs.join(", ")} recording kit(s) are missing; do not publish a single multi-variation kit as a complete SEO evidence pack.`);
}
kitDirectory = completedJobKits.get("listing") ?? kitDirectory;

// Run the job-aware image QA against every independently recorded job. The
// full narrated tutorial render is built from the listing job below, but all
// three evidence runs must have an explicit visual QA result before a draft
// can use them as publishable generation evidence.
for (const [job, jobKit] of completedJobKits) {
  await run("node", ["scripts/qa-recording-capture.mjs", jobKit]);
  const captureReport = await readOptionalJson(path.join(jobKit, "capture-qa-report.json"));
  if (captureReport?.status !== "pass") {
    throw new Error(`${opportunityId}: ${job} workflow capture gate failed; required screenshots, timeline events, and a decodable raw recording are missing.`);
  }
  await run("node", ["scripts/qa-seo-generation-job.mjs", jobKit]);
  const jobReport = await readFile(path.join(jobKit, "seo-generation-qa-report.json"), "utf8");
  const parsedJobReport = JSON.parse(jobReport);
  if (parsedJobReport.status !== "pass") {
    throw new Error(`${opportunityId}: ${job} image quality gate failed; inspect the selected result image in ${jobKit} and add image-review.json after approval.`);
  }
}

await run("node", ["scripts/qa-ecommerce-image.mjs", kitDirectory]);
const imageReport = JSON.parse(await readFile(path.join(kitDirectory, "image-qa-report.json"), "utf8"));
if (imageReport.status !== "pass") {
  throw new Error(`${opportunityId}: image quality gate failed; add a human image-review.json pass before narration.`);
}

await run("node", ["scripts/compile-topic-script.mjs", kitDirectory, opportunity.category]);
const narrationStatus = await readOptionalJson(path.join(kitDirectory, "narration-generation-status.json"));
const narrationSegments = await readOptionalJson(path.join(kitDirectory, "narration-segments.json"));
const script = JSON.parse(await readFile(path.join(kitDirectory, "narration-script.json"), "utf8"));
const segmentFilesComplete = Array.isArray(narrationSegments)
  && narrationSegments.length === script.length
  && (await Promise.all(narrationSegments.map((segment) => fileLargerThan(path.join(kitDirectory, segment.file), 1000)))).every(Boolean);
const narrationComplete = segmentFilesComplete
  && (!narrationStatus || (narrationStatus.status === "complete" && narrationStatus.generatedSegments === script.length));

if (!narrationComplete) {
  const requiredCharacters = script.reduce((total, segment) => total + String(segment.text ?? "").length, 0);
  await assertElevenLabsReady();
  await assertElevenLabsAllowance(requiredCharacters);
  await run("node", ["scripts/generate-elevenlabs-segments.mjs", kitDirectory]);
}

await run("node", ["scripts/compile-framing-plan.mjs", kitDirectory]);
await run("node", ["scripts/render-synced-recording.mjs", kitDirectory, path.join(kitDirectory, "narration-segments.json"), "16x9"]);
await run("node", ["scripts/qa-topic-kit.mjs", kitDirectory]);
const report = JSON.parse(await readFile(path.join(kitDirectory, "qa-report.json"), "utf8"));
if (report.status !== "pass") throw new Error(`${opportunityId}: QA failed; output was not approved.`);
await markGenerationQaPassed(completedJobKits, report);

await writeFile(path.join(kitDirectory, "production-run-status.json"), `${JSON.stringify({
  opportunityId,
  category: opportunity.category,
  status: "complete",
  output: "tutorial-16x9.mp4",
  qa: "qa-report.json",
  completedAt: new Date().toISOString(),
}, null, 2)}\n`);
console.log(`Completed ${opportunityId}: ${kitDirectory}/tutorial-16x9.mp4`);

async function run(command, args) {
  const result = await execFileAsync(command, args, { cwd: projectDirectory, maxBuffer: 20 * 1024 * 1024 });
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}

async function assertElevenLabsReady() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is missing; narration generation stopped before rendering.");
  const headers = { "xi-api-key": apiKey };
  const accountResponse = await fetch("https://api.elevenlabs.io/v1/user", { headers });
  if (!accountResponse.ok) throw new Error(`ElevenLabs account check failed with HTTP ${accountResponse.status}.`);
  const voicesResponse = await fetch("https://api.elevenlabs.io/v1/voices", { headers });
  if (!voicesResponse.ok) throw new Error(`ElevenLabs voice check failed with HTTP ${voicesResponse.status}.`);
  const voices = await voicesResponse.json();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";
  if (!(voices.voices ?? []).some((voice) => voice.voice_id === voiceId)) {
    throw new Error(`ElevenLabs voice ${voiceId} was not found; narration generation stopped.`);
  }
  const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ text: "A", model_id: process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5" }),
  });
  if (!ttsResponse.ok) throw new Error(`ElevenLabs text-to-speech check failed with HTTP ${ttsResponse.status}.`);
}

async function assertElevenLabsAllowance(requiredCharacters = 1) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is missing; narration generation stopped before rendering.");
  const response = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": apiKey } });
  if (!response.ok) throw new Error(`ElevenLabs account check failed with HTTP ${response.status}.`);
  const account = await response.json();
  const subscription = account?.subscription;
  const used = Number(subscription?.character_count ?? 0);
  const limit = Number(subscription?.character_limit ?? 0);
  const remaining = limit > 0 ? limit - used : Number.POSITIVE_INFINITY;
  if (remaining < requiredCharacters) {
    const reset = Number(subscription?.next_character_count_reset_unix ?? 0);
    const resetAt = reset > 0 ? new Date(reset * 1000).toISOString() : "unknown";
    throw new Error(`ElevenLabs character allowance is too low for this run (${used}/${limit}, ${remaining} remaining; ${requiredCharacters} required); next reset: ${resetAt}.`);
  }
}

async function latestKit(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const kits = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    // A failed browser attempt can be newer than a valid preview or capture.
    // Resume from the newest usable stage, never from the newest directory.
    for (const kit of kits) {
      const candidate = path.join(directory, kit);
      if (await isImagePreview(candidate) || await isUsableCapture(candidate)) return candidate;
    }
    return null;
  } catch {
    return null;
  }
}

async function latestUsableKitsByJob(directory) {
  const kits = await listDirectories(directory);
  const result = new Map();
  for (const kitName of kits.sort().reverse()) {
    const candidate = path.join(directory, kitName);
    if (!(await isUsableCapture(candidate))) continue;
    const manifest = await readOptionalJson(path.join(candidate, "manifest.json"));
    const job = typeof manifest?.imageJob === "string" ? manifest.imageJob.trim().toLowerCase() : "";
    if (REQUIRED_IMAGE_JOBS.includes(job) && !result.has(job)) result.set(job, candidate);
  }
  return result;
}

async function recordRequiredJobs(id, jobs = REQUIRED_IMAGE_JOBS) {
  for (const job of jobs) {
    console.log(`${id}: recording independent ${job} generation evidence`);
    await run("pnpm", ["record:usecase", id, job]);
  }
}

async function markGenerationQaPassed(jobKits, report) {
  for (const jobKit of jobKits.values()) {
    const manifestPath = path.join(jobKit, "manifest.json");
    const manifest = await readOptionalJson(manifestPath);
    if (!manifest || !Array.isArray(manifest.generationRuns)) continue;
    manifest.generationRuns = manifest.generationRuns.map((run) => ({
      ...run,
      qaStatus: "pass",
      qaSummary: { imageQa: "pass", topicKitQa: jobKit === kitDirectory ? report : null },
    }));
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

async function listDirectories(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function isUsableCapture(directory) {
  try {
    const raw = await stat(path.join(directory, "raw-demo.webm"));
    const timeline = await stat(path.join(directory, "timeline.json"));
    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
    const resultCount = Number(manifest.variations ?? 3);
    const resultFiles = Array.isArray(manifest.results)
      ? manifest.results.filter((file) => typeof file === "string" && file.trim())
      : [];
    if (!Number.isInteger(resultCount) || resultCount < 1 || resultFiles.length !== resultCount || resultFiles.some((file) => !isSafeKitFile(file))) return false;
    const results = await Promise.all(resultFiles.map((file) => stat(path.join(directory, file))));
    if (!(raw.size > 100000 && timeline.size > 0 && results.every((result) => result.size > 1000))) return false;
    const screenshotNames = Array.isArray(manifest.screenshots) ? manifest.screenshots : [];
    const expectedScreenshots = [
      "screenshots/01-workspace-ready.png",
      "screenshots/02-reference-selected.png",
      "screenshots/03-settings-complete.png",
      ...Array.from({ length: resultCount }, (_, offset) => `screenshots/04-result-${String(offset + 1).padStart(2, "0")}.png`),
    ];
    if (!expectedScreenshots.every((file) => screenshotNames.includes(file))) return false;
    const screenshotStats = await Promise.all(expectedScreenshots.map((file) => stat(path.join(directory, file)).catch(() => null)));
    if (screenshotStats.some((value) => !value || value.size < 1024)) return false;
    const timelinePayload = JSON.parse(await readFile(path.join(directory, "timeline.json"), "utf8"));
    const events = Array.isArray(timelinePayload?.events) ? timelinePayload.events : [];
    const requiredEventCount = (name) => events.filter((event) => event?.name === name).length;
    return requiredEventCount("generation_started") >= resultCount
      && requiredEventCount("generation_ready") >= resultCount
      && requiredEventCount("result_saved") >= resultCount;
  } catch {
    return false;
  }
}

function isSafeKitFile(file) {
  return !path.isAbsolute(file) && !file.includes("..") && !file.includes("/") && !file.includes("\\");
}

async function isImagePreview(directory) {
  try {
    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
    return manifest.captureMode === "image-preview";
  } catch {
    return false;
  }
}

async function fileLargerThan(filePath, minimumBytes) {
  try {
    return (await stat(filePath)).size > minimumBytes;
  } catch {
    return false;
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
