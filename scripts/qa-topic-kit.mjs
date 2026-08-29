import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const kitDirectory = path.resolve(process.argv[2] ?? "");
if (!kitDirectory) throw new Error("Run: node scripts/qa-topic-kit.mjs <kit-directory>");

const [timeline, script, segments, manifest, framing, sync] = await Promise.all([
  readJson("timeline.json"),
  readJson("narration-script.json"),
  readJson("narration-segments.json"),
  readJson("manifest.json"),
  readJson("framing-plan.json"),
  readJson("sync-manifest.json"),
]);

const rawProbe = await probe(path.join(kitDirectory, "raw-demo.webm"));
const outputProbe = await probe(path.join(kitDirectory, "tutorial-16x9.mp4"));
const rawDecode = await fullDecode(path.join(kitDirectory, "raw-demo.webm"));
const outputDecode = await fullDecode(path.join(kitDirectory, "tutorial-16x9.mp4"));
const audioProbes = await Promise.all(
  (sync.segments ?? []).map(async (segment) => ({
    ...segment,
    durationSeconds: await probeDuration(path.join(kitDirectory, segment.file)),
  })),
);
const eventKeys = new Set((timeline.events ?? []).map((event) => `${event.name}:${event.index ?? ""}:${event.label ?? ""}`));
const missingAnchors = script.filter((segment) => {
  const index = Number.isInteger(segment.index) ? segment.index : "";
  const label = typeof segment.label === "string" ? segment.label : "";
  return !eventKeys.has(`${segment.event}:${index}:${label}`);
});
const overlaps = [];
for (let first = 0; first < audioProbes.length; first += 1) {
  const firstEnd = audioProbes[first].startMs + audioProbes[first].durationSeconds * 1000;
  for (let second = first + 1; second < audioProbes.length; second += 1) {
    const secondEnd = audioProbes[second].startMs + audioProbes[second].durationSeconds * 1000;
    const overlapMs = Math.min(firstEnd, secondEnd) - Math.max(audioProbes[first].startMs, audioProbes[second].startMs);
    if (overlapMs > 80) overlaps.push({ first: first + 1, second: second + 1, overlapMs: Math.round(overlapMs) });
  }
}
const forbiddenWords = ["leverage", "workflow", "conversion", "aspiration", "identity", "context", "synergy"];
const forbiddenFound = script.flatMap((segment) => forbiddenWords.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(segment.text)));
const audioGaps = [];
for (let index = 1; index < audioProbes.length; index += 1) {
  const previous = audioProbes[index - 1];
  const current = audioProbes[index];
  const gapMs = Math.max(0, current.startMs - (previous.startMs + previous.durationSeconds * 1000));
  audioGaps.push({ previous: index, current: index + 1, gapMs: Math.round(gapMs) });
}
const maxAudioGapMs = Math.max(0, ...audioGaps.map((gap) => gap.gapMs));
const maxVoiceGapMs = 5500;
const audioGapPass = maxAudioGapMs <= maxVoiceGapMs;
const audioStreamCount = outputProbe.audioStreams ?? 0;
const singleAudioStreamPass = audioStreamCount === 1;

const report = {
  version: 1,
  kitDirectory,
  useCaseId: manifest.id,
  status: missingAnchors.length === 0 && overlaps.length === 0 && audioGapPass && singleAudioStreamPass && rawProbe.valid && outputProbe.valid && rawDecode.pass && outputDecode.pass ? "pass" : "fail",
  checks: {
    sourceDecode: rawProbe,
    renderDecode: outputProbe,
    fullDecode: { source: rawDecode, render: outputDecode, pass: rawDecode.pass && outputDecode.pass },
    horizontalOnly: outputProbe.width === 1920 && outputProbe.height === 1080,
    segmentCount: script.length === segments.length,
    timelineAnchors: { pass: missingAnchors.length === 0, missing: missingAnchors },
    overlap: { pass: overlaps.length === 0, overlaps },
    audioGaps: { pass: audioGapPass, maxGapMs: maxAudioGapMs, limitMs: maxVoiceGapMs, gaps: audioGaps },
    audioStreams: { pass: singleAudioStreamPass, count: audioStreamCount, expected: 1 },
    plainEnglish: { pass: forbiddenFound.length === 0, forbiddenFound },
    branding: { pass: Boolean(framing.branding?.logoPath), logoPath: framing.branding?.logoPath ?? null },
    realWorkflow: { pass: Boolean(manifest.route && manifest.input), route: manifest.route, input: manifest.input },
  },
  output: "tutorial-16x9.mp4",
  researchArtifact: "docs/research/airveek-ecommerce-product-photo-opportunity-graph-v1.json",
};

await writeFile(path.join(kitDirectory, "qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, useCaseId: report.useCaseId, output: outputProbe, overlapCount: overlaps.length, maxAudioGapMs, audioStreamCount, fullDecode: report.checks.fullDecode.pass }, null, 2));

async function readJson(file) {
  await access(path.join(kitDirectory, file));
  return JSON.parse(await readFile(path.join(kitDirectory, file), "utf8"));
}

async function probe(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,channels", "-of", "json", filePath]);
    const value = JSON.parse(stdout);
    const video = (value.streams ?? []).find((stream) => stream.width && stream.height);
    return { valid: true, duration: Number(value.format?.duration ?? 0), codec: video?.codec_name ?? null, width: video?.width ?? null, height: video?.height ?? null, audioStreams: (value.streams ?? []).filter((stream) => stream.codec_type === "audio").length, streams: value.streams ?? [] };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function probeDuration(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath]);
    return Number(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

async function fullDecode(filePath) {
  try {
    await execFileAsync("ffmpeg", ["-v", "error", "-i", filePath, "-map", "0:v:0", "-map", "0:a:0?", "-f", "null", "-"]);
    return { pass: true };
  } catch (error) {
    return { pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}
