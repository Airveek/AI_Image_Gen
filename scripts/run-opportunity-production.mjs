import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

try {
  process.loadEnvFile?.(".env");
} catch {
  // Environment may already be loaded by the caller.
}

const execFileAsync = promisify(execFile);
const projectDirectory = path.resolve(process.cwd());
const opportunityId = (process.argv[2] ?? "").trim();
if (!/^[A-Z0-9_-]+$/.test(opportunityId)) {
  throw new Error("Run: node scripts/run-opportunity-production.mjs ECO11");
}

const graph = JSON.parse(await readFile(path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json"), "utf8"));
const opportunity = graph.opportunities?.find((item) => item.id === opportunityId);
if (!opportunity) throw new Error(`Opportunity not found: ${opportunityId}`);

let kitDirectory = await latestKit(path.join(projectDirectory, "content-kits", opportunityId));
if (kitDirectory && await isImagePreview(kitDirectory)) {
  await run("node", ["scripts/qa-ecommerce-image.mjs", kitDirectory]);
  const previewReport = JSON.parse(await readFile(path.join(kitDirectory, "image-qa-report.json"), "utf8"));
  if (previewReport.status !== "pass") {
    throw new Error(`${opportunityId}: image preview is not approved; inspect result-1.jpg and add a human image-review.json pass before recording.`);
  }
  console.log(`${opportunityId}: approved image preview; recording the real workflow`);
  await run("pnpm", ["record:usecase", opportunityId]);
  kitDirectory = await latestKit(path.join(projectDirectory, "content-kits", opportunityId));
}
if (!kitDirectory || !(await isUsableCapture(kitDirectory))) {
  console.log(`${opportunityId}: creating an unrecorded single-image preview first`);
  await run("pnpm", ["preview:usecase", opportunityId]);
  kitDirectory = await latestKit(path.join(projectDirectory, "content-kits", opportunityId));
  if (kitDirectory) await run("node", ["scripts/qa-ecommerce-image.mjs", kitDirectory]);
  throw new Error(`${opportunityId}: image preview created; inspect it, add image-review.json after approval, then rerun this opportunity.`);
}
if (!kitDirectory || !(await isUsableCapture(kitDirectory))) throw new Error(`${opportunityId}: no valid recording kit after capture.`);

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
    return kits.length ? path.join(directory, kits[0]) : null;
  } catch {
    return null;
  }
}

async function isUsableCapture(directory) {
  try {
    const raw = await stat(path.join(directory, "raw-demo.webm"));
    const timeline = await stat(path.join(directory, "timeline.json"));
    const manifest = JSON.parse(await readFile(path.join(directory, "manifest.json"), "utf8"));
    const resultCount = Number(manifest.variations ?? 3);
    const results = await Promise.all(Array.from({ length: resultCount }, (_, index) => index + 1).map((index) => stat(path.join(directory, `result-${index}.jpg`))));
    return raw.size > 100000 && timeline.size > 0 && results.every((result) => result.size > 1000);
  } catch {
    return false;
  }
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
