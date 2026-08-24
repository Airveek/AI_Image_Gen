import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const kitArgument = process.argv[2]?.trim();
if (!kitArgument) {
  throw new Error("Run: pnpm render:recording <content-kit-directory> [segments.json]");
}
const kitDirectory = path.resolve(kitArgument);
const segmentsPath = path.resolve(
  process.argv[3] ?? path.join(kitDirectory, "narration-segments.json"),
);

if (!kitDirectory || !segmentsPath) {
  throw new Error("Run: pnpm render:recording <content-kit-directory> [segments.json]");
}

const rawVideoPath = path.join(kitDirectory, "raw-demo.webm");
const timelinePath = path.join(kitDirectory, "timeline.json");
const musicPath = path.join(kitDirectory, "music-loop.mp3");
const [timeline, segmentSpecs] = await Promise.all([
  readJson(timelinePath),
  readJson(segmentsPath),
]);

await assertFile(rawVideoPath);
if (!Array.isArray(timeline.events)) throw new Error("timeline.json must contain an events array.");
if (!Array.isArray(segmentSpecs) || segmentSpecs.length === 0) {
  throw new Error("narration-segments.json must contain at least one audio segment.");
}

const durationSeconds = await probeDuration(rawVideoPath);
const segments = [];

for (const [index, spec] of segmentSpecs.entries()) {
  if (!isRecord(spec)) throw new Error(`Audio segment ${index + 1} must be an object.`);
  const event = requiredString(spec.event, `audio segment ${index + 1} event`);
  const file = requiredString(spec.file, `audio segment ${index + 1} file`);
  const eventMatch = timeline.events.find((candidate) => matchesEvent(candidate, spec, event));
  if (!eventMatch) {
    throw new Error(`No timeline event matched audio segment ${index + 1}: ${event}.`);
  }

  const audioPath = path.resolve(kitDirectory, file);
  await assertFile(audioPath);
  const offsetMs = integerOrDefault(spec.offsetMs, 0);
  const startMs = Math.max(0, Math.round(Number(eventMatch.atMs) + offsetMs));
  segments.push({
    event,
    file,
    path: audioPath,
      startMs,
      shot: typeof spec.shot === "string" ? spec.shot : undefined,
      label: typeof spec.label === "string" ? spec.label : undefined,
      index: Number.isInteger(spec.index) ? spec.index : undefined,
  });
}

const outputs = [];
for (const format of [
  { name: "16x9", width: 1920, height: 1080 },
  { name: "9x16", width: 1080, height: 1920 },
]) {
  const outputPath = path.join(kitDirectory, `tutorial-${format.name}.mp4`);
  await renderFormat({ durationSeconds, format, outputPath, segments });
  outputs.push(path.basename(outputPath));
}

await writeFile(
  path.join(kitDirectory, "sync-manifest.json"),
  JSON.stringify(
    {
      sourceVideo: path.basename(rawVideoPath),
      timeline: path.basename(timelinePath),
      segments: segments.map(({ event, file, startMs, shot, label, index }) => ({
        event,
        file,
        startMs,
        ...(shot ? { shot } : {}),
        ...(label ? { label } : {}),
        ...(index === undefined ? {} : { index }),
      })),
      outputs,
    },
    null,
    2,
  ),
);

console.log(`Synchronized recordings written to ${kitDirectory}`);

async function renderFormat({ durationSeconds, format, outputPath, segments }) {
  const args = ["-y", "-i", rawVideoPath];
  for (const segment of segments) args.push("-i", segment.path);
  const musicInputIndex = 1 + segments.length;
  const hasMusic = await fileExists(musicPath);
  if (hasMusic) args.push("-stream_loop", "-1", "-i", musicPath);

  const audioLabels = [];
  segments.forEach((segment, index) => {
    const label = `voice${index}`;
    audioLabels.push(
      `[${index + 1}:a]adelay=delays=${segment.startMs}:all=1,volume=1.0[${label}]`,
    );
  });

  if (hasMusic) {
    audioLabels.push(
      `[${musicInputIndex}:a]volume=0.12,atrim=duration=${durationSeconds}[music]`,
    );
  }

  const mixInputs = [
    ...segments.map((_segment, index) => `[voice${index}]`),
    ...(hasMusic ? ["[music]"] : []),
  ];
  const mixCount = mixInputs.length;
  if (mixCount === 0) throw new Error("Add at least one narration segment or music file.");
  audioLabels.push(
    `${mixInputs.join("")}amix=inputs=${mixCount}:duration=longest:dropout_transition=0,aresample=async=1:first_pts=0[aout]`,
  );

  args.push(
    "-filter_complex",
    audioLabels.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-vf",
    `scale=${format.width}:${format.height}:force_original_aspect_ratio=increase,crop=${format.width}:${format.height}`,
    "-t",
    String(durationSeconds),
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  );

  await execFileAsync("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 });
}

async function probeDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not read source video duration.");
  return duration;
}

function matchesEvent(candidate, spec, event) {
  if (!isRecord(candidate) || candidate.name !== event) return false;
  if (typeof spec.shot === "string" && candidate.shot !== spec.shot) return false;
  if (typeof spec.label === "string" && candidate.label !== spec.label) return false;
  if (Number.isInteger(spec.index) && candidate.index !== spec.index) return false;
  return true;
}

async function readJson(filePath) {
  const value = JSON.parse(await readFile(filePath, "utf8"));
  return value;
}

async function assertFile(filePath) {
  if (!(await fileExists(filePath))) throw new Error(`File not found: ${filePath}`);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function integerOrDefault(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}
