import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const projectDirectory = path.resolve(process.cwd());
const graphPath = path.join(projectDirectory, "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json");
const outputPath = path.join(projectDirectory, "docs/research/airveek-production-queue-v1.json");
const graph = JSON.parse(await readFile(graphPath, "utf8"));

const topics = [];
for (const opportunity of graph.opportunities ?? []) {
  const opportunityDirectory = path.join(projectDirectory, "content-kits", opportunity.id);
  const kit = await latestKit(opportunityDirectory);
  const item = {
    opportunityId: opportunity.id,
    category: opportunity.category,
    order: topics.length + 1,
    brief: {
      buyerQuestion: opportunity.buyerQuestion,
      hook: opportunity.hook,
      practicalLesson: opportunity.practicalLesson,
      assetPlan: opportunity.assetPlan,
    },
    status: kit ? await classifyKit(kit) : "not-started",
    latestKit: kit ? path.relative(projectDirectory, kit) : null,
    output: kit && await exists(path.join(kit, "tutorial-16x9.mp4"))
      ? path.relative(projectDirectory, path.join(kit, "tutorial-16x9.mp4"))
      : null,
  };
  item.nextAction = nextAction(item.status);
  topics.push(item);
}

const queue = {
  version: 1,
  brand: "Airveek",
  generatedAt: new Date().toISOString(),
  sourceGraph: "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json",
  policy: {
    oneKitPerAttempt: "Never combine raw-demo.webm, timeline.json, result images, audio, or output video across timestamps.",
    retryOrder: ["provider-available", "record-real-workflow", "compile-from-that-timeline", "generate-ElevenLabs-audio", "render-16x9", "run-QA"],
    audioGapLimitMs: 5500,
    requiredOutput: "tutorial-16x9.mp4",
    blockedProviderHandling: "Preserve the incomplete kit, record the provider error, and resume from that kit only after the provider is available.",
  },
  summary: summarize(topics),
  topics,
};

await writeFile(outputPath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(projectDirectory, outputPath), summary: queue.summary }, null, 2));

function summarize(items) {
  return items.reduce((result, item) => {
    result[item.status] = (result[item.status] ?? 0) + 1;
    return result;
  }, {});
}

function nextAction(status) {
  if (status === "offline-qa-pass") return "review-output-and-log-publishing-feedback";
  if (status === "offline-qa-pass-narration-retry-pending") return "wait-for-ElevenLabs-then-regenerate-narration-render-and-QA";
  if (status === "offline-qa-pass-output-source-refresh-pending") return "regenerate-or-restore-complete-source-narration-then-render";
  if (status === "ready-for-narration") return "generate-ElevenLabs-narration-then-render-and-QA";
  if (status === "needs-render-or-qa") return "render-horizontal-output-then-run-QA";
  if (status === "capture-ready-generation-retry") return "retry-the-clean-recording-after-provider-is-stable";
  if (status === "mismatched-attempt-re-record") return "record-a-clean-attempt-and-do-not-reuse-this-kit";
  return "record-a-clean-real-workflow-attempt";
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

async function classifyKit(directory) {
  const hasRaw = await fileLargerThan(path.join(directory, "raw-demo.webm"), 100000);
  const manifest = await readOptionalJson(path.join(directory, "manifest.json"));
  const resultCount = Number(manifest?.variations ?? 3);
  const declaredResults = Array.isArray(manifest?.results)
    ? manifest.results.filter((file) => typeof file === "string" && file.trim() && isSafeKitFile(file))
    : [];
  const resultFiles = declaredResults.length === resultCount
    ? await Promise.all(declaredResults.map((file) => exists(path.join(directory, file))))
    : await Promise.all(Array.from({ length: resultCount }, (_, index) => index + 1).map((index) => exists(path.join(directory, `result-${index}.jpg`))));
  const hasAnyResults = resultFiles.some(Boolean);
  const hasAllResults = resultFiles.every(Boolean);
  const hasQa = await exists(path.join(directory, "qa-report.json"));
  const outputIsCurrent = await outputMatchesSource(directory);
  const narrationStatus = await readOptionalJson(path.join(directory, "narration-generation-status.json"));
  const narrationComplete = await hasCompleteNarration(directory, narrationStatus);
  if (hasQa) {
    try {
      const report = JSON.parse(await readFile(path.join(directory, "qa-report.json"), "utf8"));
      if (report.status === "pass") {
        if (narrationStatus && narrationStatus.status !== "complete") return "offline-qa-pass-narration-retry-pending";
        return outputIsCurrent ? "offline-qa-pass" : "offline-qa-pass-output-source-refresh-pending";
      }
    } catch {
      // Keep classifying the attempt from its files.
    }
  }
  if (hasRaw && !hasAllResults) return "capture-ready-generation-retry";
  if (!hasRaw && hasAnyResults) return "mismatched-attempt-re-record";
  if (hasRaw && hasAllResults) return narrationComplete ? "needs-render-or-qa" : "ready-for-narration";
  return "incomplete-attempt";
}

async function hasCompleteNarration(directory, narrationStatus) {
  if (narrationStatus && narrationStatus.status !== "complete") return false;
  const script = await readOptionalJson(path.join(directory, "narration-script.json"));
  const segments = await readOptionalJson(path.join(directory, "narration-segments.json"));
  if (!Array.isArray(script) || !Array.isArray(segments) || script.length === 0 || script.length !== segments.length) return false;
  return (await Promise.all(segments.map((segment) => fileLargerThan(path.join(directory, segment.file), 1000)))).every(Boolean);
}

async function outputMatchesSource(directory) {
  try {
    const output = await stat(path.join(directory, "tutorial-16x9.mp4"));
    const script = await stat(path.join(directory, "narration-script.json"));
    const segments = await stat(path.join(directory, "narration-segments.json"));
    return output.mtimeMs >= Math.max(script.mtimeMs, segments.mtimeMs);
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

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
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

function isSafeKitFile(file) {
  return !path.isAbsolute(file) && !file.includes("..") && !file.includes("/") && !file.includes("\\");
}
