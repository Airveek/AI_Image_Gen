import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const kitArgument = process.argv[2]?.trim();
const formatArgument = process.argv[4]?.trim();
if (!kitArgument) {
  throw new Error("Run: pnpm render:recording <content-kit-directory> [segments.json] [16x9|9x16]");
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
const framingPlanPath = path.join(kitDirectory, "framing-plan.json");
const [timeline, segmentSpecs] = await Promise.all([
  readJson(timelinePath),
  readJson(segmentsPath),
]);
const framingPlan = await readOptionalJson(framingPlanPath);

await assertFile(rawVideoPath);
if (!Array.isArray(timeline.events)) throw new Error("timeline.json must contain an events array.");
if (!Array.isArray(segmentSpecs) || segmentSpecs.length === 0) {
  throw new Error("narration-segments.json must contain at least one audio segment.");
}

const durationSeconds = await probeDuration(rawVideoPath);
const mainStartSeconds = normalizeMainStart(framingPlan, durationSeconds);
const mainStartMs = Math.round(mainStartSeconds * 1000);
const coldOpen = normalizeColdOpen(framingPlan, durationSeconds);
const coldOpenDurationMs = Math.round((coldOpen?.durationSeconds ?? 0) * 1000);
const branding = await normalizeBranding(framingPlan, kitDirectory);
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
  const timelineStartMs = Math.max(0, Math.round(Number(eventMatch.atMs) + offsetMs));
  const sourceStartMs = Number.isInteger(spec.sourceStartMs)
    ? Math.max(0, spec.sourceStartMs)
    : undefined;
  const renderStartMs = Number.isInteger(spec.renderStartMs)
    ? Math.max(0, spec.renderStartMs)
    : sourceStartMs === undefined
      ? undefined
      : coldOpenDurationMs + Math.max(0, sourceStartMs - mainStartMs);
  const startMs = renderStartMs === undefined ? timelineStartMs : renderStartMs;
  segments.push({
    event,
    file,
    path: audioPath,
    startMs,
    timelineStartMs,
    renderStartMs,
    sourceStartMs,
    shot: typeof spec.shot === "string" ? spec.shot : undefined,
    label: typeof spec.label === "string" ? spec.label : undefined,
    index: Number.isInteger(spec.index) ? spec.index : undefined,
  });
}

for (const segment of segments) {
  segment.durationSeconds = await probeDuration(segment.path);
}
for (const segment of segments) {
  if (segment.renderStartMs === undefined) {
    segment.startMs = Math.max(0, segment.timelineStartMs - mainStartMs);
  }
}
const audioOverlaps = findAudioOverlaps(segments);
if (audioOverlaps.length > 0) {
  const details = audioOverlaps
    .slice(0, 6)
    .map(({ first, second, overlapMs }) => `${first + 1}/${second + 1} (${overlapMs}ms)`)
    .join(", ");
  throw new Error(
    `Narration clips overlap; refusing to render double speech (${details}). ` +
    "Shorten or re-time the narration segments before rendering.",
  );
}
const timelineDurationSeconds = Math.max(0.1, durationSeconds - mainStartSeconds);
const timelineRenderDurationSeconds = Math.max(
  timelineDurationSeconds,
  ...segments.map((segment) => (segment.startMs / 1000) + segment.durationSeconds),
);
const coldOpenDurationSeconds = coldOpen?.durationSeconds ?? 0;
const renderDurationSeconds = coldOpenDurationSeconds + timelineRenderDurationSeconds;

const outputs = [];
const formats = [
  { name: "16x9", width: 1920, height: 1080 },
  { name: "9x16", width: 1080, height: 1920 },
].filter((format) => !formatArgument || format.name === formatArgument);
if (formats.length === 0) throw new Error(`Unknown format: ${formatArgument}`);

for (const format of formats) {
  const outputPath = path.join(kitDirectory, `tutorial-${format.name}.mp4`);
  await renderFormat({
    durationSeconds,
    mainStartSeconds,
    timelineRenderDurationSeconds,
    renderDurationSeconds,
    coldOpen,
    branding,
    format,
    outputPath,
    segments,
    framingPlan,
  });
  outputs.push(path.basename(outputPath));
}

await writeFile(
  path.join(kitDirectory, "sync-manifest.json"),
  JSON.stringify(
    {
      sourceVideo: path.basename(rawVideoPath),
      timeline: path.basename(timelinePath),
      segments: segments.map(({ event, file, startMs, timelineStartMs, renderStartMs, sourceStartMs, shot, label, index }) => ({
        event,
        file,
        startMs,
        ...(timelineStartMs === startMs ? {} : { timelineStartMs }),
        ...(renderStartMs === undefined ? {} : { renderStartMs }),
        ...(sourceStartMs === undefined ? {} : { sourceStartMs }),
        ...(shot ? { shot } : {}),
        ...(label ? { label } : {}),
        ...(index === undefined ? {} : { index }),
      })),
      ...(framingPlan ? { framingPlan: path.basename(framingPlanPath) } : {}),
      sourceDurationSeconds: durationSeconds,
      mainStartSeconds,
      timelineRenderedDurationSeconds: timelineRenderDurationSeconds,
      coldOpenDurationSeconds,
      renderedDurationSeconds: renderDurationSeconds,
      outputs,
    },
    null,
    2,
  ),
);

console.log(`Synchronized recordings written to ${kitDirectory}`);

async function renderFormat({
  durationSeconds,
  mainStartSeconds,
  timelineRenderDurationSeconds,
  renderDurationSeconds,
  coldOpen,
  branding,
  format,
  outputPath,
  segments,
  framingPlan,
}) {
  const args = ["-y", "-i", rawVideoPath];
  for (const segment of segments) args.push("-i", segment.path);
  const logoInputIndex = 1 + segments.length;
  if (branding) args.push("-loop", "1", "-i", branding.path);
  const musicInputIndex = logoInputIndex + (branding ? 1 : 0);
  const hasMusic = await fileExists(musicPath);
  if (hasMusic) args.push("-stream_loop", "-1", "-i", musicPath);

  const audioLabels = [];
  const coldOpenOffsetMs = Math.round((coldOpen?.durationSeconds ?? 0) * 1000);
  segments.forEach((segment, index) => {
    const label = `voice${index}`;
    const audioStartMs = segment.renderStartMs === undefined
      ? segment.startMs + coldOpenOffsetMs
      : segment.startMs;
    audioLabels.push(
      `[${index + 1}:a]adelay=delays=${audioStartMs}:all=1,volume=1.0[${label}]`,
    );
  });

  if (hasMusic) {
    audioLabels.push(
      `[${musicInputIndex}:a]volume=0.12,atrim=duration=${renderDurationSeconds}[music]`,
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

  const videoLabels = buildVideoGraph({
    format,
    framingPlan,
    durationSeconds,
    mainStartSeconds,
    timelineRenderDurationSeconds,
    coldOpen,
  });
  const videoMapLabel = branding
    ? addBrandOverlay(videoLabels, branding, logoInputIndex)
    : "[vout]";

  args.push(
    "-filter_complex",
    [...videoLabels, ...audioLabels].join(";"),
    "-map",
    videoMapLabel,
    "-map",
    "[aout]",
    "-t",
    String(renderDurationSeconds),
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

function addBrandOverlay(videoLabels, branding, logoInputIndex) {
  const logoLabel = "[brandlogo]";
  videoLabels.push(
    `[${logoInputIndex}:v]format=rgba,scale=w=${branding.width}:h=-1:force_original_aspect_ratio=decrease,colorchannelmixer=aa=${formatNumber(branding.opacity)}${logoLabel}`,
    `[vout]${logoLabel}overlay=x=${branding.x}:y=${branding.y}:eof_action=repeat[vbranded]`,
  );
  return "[vbranded]";
}

function buildVideoGraph({
  format,
  framingPlan,
  durationSeconds,
  mainStartSeconds,
  timelineRenderDurationSeconds,
  coldOpen,
}) {
  const mainVideoDuration = Math.max(0.1, durationSeconds - mainStartSeconds);
  const mainFreezeDuration = Math.max(0, timelineRenderDurationSeconds - mainVideoDuration);
  const mainFilter = buildVideoFilter({
    format,
    framingPlan,
    freezeDurationSeconds: mainFreezeDuration,
    keyframeTimeOffsetMs: Math.round(mainStartSeconds * 1000),
  });

  if (!coldOpen) return [`[0:v]${mainFilter}[vout]`];

  const sourceStartSeconds = Math.min(
    Math.max(0, Number(coldOpen.sourceStartSeconds)),
    Math.max(0, durationSeconds - 0.1),
  );
  const availableColdOpenSeconds = Math.max(0.1, durationSeconds - sourceStartSeconds);
  const coldOpenFreezeDuration = Math.max(0, coldOpen.durationSeconds - availableColdOpenSeconds);
  const coldFilter = buildVideoFilter({
    format,
    framingPlan: null,
    freezeDurationSeconds: coldOpenFreezeDuration,
    keyframeTimeOffsetMs: 0,
  });

  return [
    `[0:v]trim=start=${formatNumber(sourceStartSeconds)}:end=${formatNumber(durationSeconds)},setpts=PTS-STARTPTS,${coldFilter}[cold]`,
    `[0:v]trim=start=${formatNumber(mainStartSeconds)}:end=${formatNumber(durationSeconds)},setpts=PTS-STARTPTS,${mainFilter}[main]`,
    `[cold][main]concat=n=2:v=1:a=0[vout]`,
  ];
}

function normalizeColdOpen(framingPlan, sourceDurationSeconds) {
  const coldOpen = framingPlan?.coldOpen;
  if (!coldOpen) return null;
  if (!isRecord(coldOpen)) throw new Error("framing-plan.json coldOpen must be an object.");
  const durationSeconds = Number(coldOpen.durationSeconds);
  const sourceStartSeconds = Number(coldOpen.sourceStartSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 15) {
    throw new Error("framing-plan.json coldOpen.durationSeconds must be between 0 and 15.");
  }
  if (!Number.isFinite(sourceStartSeconds) || sourceStartSeconds < 0 || sourceStartSeconds >= sourceDurationSeconds) {
    throw new Error("framing-plan.json coldOpen.sourceStartSeconds must be inside the source video.");
  }
  return { durationSeconds, sourceStartSeconds };
}

function normalizeMainStart(framingPlan, sourceDurationSeconds) {
  const mainStartSeconds = Number(framingPlan?.mainStartSeconds ?? 0);
  if (!Number.isFinite(mainStartSeconds) || mainStartSeconds < 0 || mainStartSeconds >= sourceDurationSeconds) {
    throw new Error("framing-plan.json mainStartSeconds must be inside the source video.");
  }
  return mainStartSeconds;
}

async function normalizeBranding(framingPlan, kitDirectory) {
  const config = framingPlan?.branding;
  if (!config) return null;
  if (!isRecord(config) || typeof config.logoPath !== "string" || !config.logoPath.trim()) {
    throw new Error("framing-plan.json branding.logoPath is required when branding is enabled.");
  }
  const logoPath = path.resolve(kitDirectory, config.logoPath);
  await assertFile(logoPath);
  const width = Number(config.width ?? 220);
  const opacity = Number(config.opacity ?? 0.9);
  const x = Number(config.x ?? 48);
  const y = Number(config.y ?? 32);
  if (!Number.isFinite(width) || width < 80 || width > 600) {
    throw new Error("framing-plan.json branding.width must be between 80 and 600.");
  }
  if (!Number.isFinite(opacity) || opacity <= 0 || opacity > 1) {
    throw new Error("framing-plan.json branding.opacity must be between 0 and 1.");
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
    throw new Error("framing-plan.json branding.x and branding.y must be non-negative numbers.");
  }
  return { path: logoPath, width: Math.round(width), opacity, x: Math.round(x), y: Math.round(y) };
}

function buildVideoFilter({ format, framingPlan, freezeDurationSeconds, keyframeTimeOffsetMs = 0 }) {
  const formatPlan = framingPlan?.formats?.[format.name];
  if (formatPlan && Array.isArray(formatPlan.keyframes)) {
    const source = framingPlan.source ?? { width: 1440, height: 900 };
    const keyframes = normalizeKeyframes(formatPlan.keyframes, source, keyframeTimeOffsetMs);
    const scaleBase = Math.max(format.width / source.width, format.height / source.height);
    const zoomExpression = piecewiseExpression(keyframes, "zoom");
    const focusXExpression = piecewiseExpression(keyframes, "focusX");
    const focusYExpression = piecewiseExpression(keyframes, "focusY");
    const scaledZoom = `(${scaleBase}*(${zoomExpression}))`;
    const cropX = clampExpression(
      `(${focusXExpression})*${scaledZoom} - ${format.width / 2}`,
      `iw-${format.width}`,
    );
    const cropY = clampExpression(
      `(${focusYExpression})*${scaledZoom} - ${format.height / 2}`,
      `ih-${format.height}`,
    );

    const filters = [
      `scale=w='ceil(iw*${scaledZoom}/2)*2':h='ceil(ih*${scaledZoom}/2)*2':eval=frame`,
      `crop=${format.width}:${format.height}:x='${cropX}':y='${cropY}'`,
      "setsar=1",
    ];
    if (freezeDurationSeconds > 0.01) {
      filters.push(`tpad=stop_mode=clone:stop_duration=${formatNumber(freezeDurationSeconds)}`);
    }
    return filters.join(",");
  }

  const filters = [
    `scale=${format.width}:${format.height}:force_original_aspect_ratio=increase`,
    `crop=${format.width}:${format.height}`,
    "setsar=1",
  ];
  if (freezeDurationSeconds > 0.01) {
    filters.push(`tpad=stop_mode=clone:stop_duration=${formatNumber(freezeDurationSeconds)}`);
  }
  return filters.join(",");
}

function normalizeKeyframes(keyframes, source, timeOffsetMs = 0) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    throw new Error("framing-plan.json must contain at least one keyframe.");
  }

  const sorted = keyframes
    .map((keyframe, index) => {
      if (!isRecord(keyframe)) throw new Error(`Framing keyframe ${index + 1} must be an object.`);
      const atMs = Number(keyframe.atMs);
      const focus = keyframe.focus;
      const zoom = Number(keyframe.zoom ?? 1);
      if (!Number.isFinite(atMs) || atMs < 0) throw new Error(`Framing keyframe ${index + 1} has invalid atMs.`);
      if (!isRecord(focus)) throw new Error(`Framing keyframe ${index + 1} needs a focus object.`);
      const focusX = Number(focus.x);
      const focusY = Number(focus.y);
      if (!Number.isFinite(focusX) || !Number.isFinite(focusY) || focusX < 0 || focusX > 1 || focusY < 0 || focusY > 1) {
        throw new Error(`Framing keyframe ${index + 1} focus must use normalized x/y values from 0 to 1.`);
      }
      if (!Number.isFinite(zoom) || zoom < 1 || zoom > 1.5) {
        throw new Error(`Framing keyframe ${index + 1} zoom must be between 1 and 1.5.`);
      }
      return {
        atMs: Math.max(0, atMs - timeOffsetMs),
        focusX: focusX * source.width,
        focusY: focusY * source.height,
        zoom,
      };
    })
    .sort((left, right) => left.atMs - right.atMs);

  // A result can become ready only a few milliseconds after a generation-start
  // event. Treat those as one visual state so the crop never jumps between two
  // nearly identical frames.
  const coalesced = [];
  for (const keyframe of sorted) {
    const previous = coalesced.at(-1);
    if (previous && keyframe.atMs - previous.atMs < 500) {
      coalesced[coalesced.length - 1] = keyframe;
    } else {
      coalesced.push(keyframe);
    }
  }
  return coalesced;
}

function piecewiseExpression(keyframes, property) {
  const values = keyframes.map((keyframe) => Number(keyframe[property]));
  let expression = formatNumber(values.at(-1));

  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];
    const durationSeconds = Math.max(0.001, (next.atMs - current.atMs) / 1000);
    const rawProgress = `(t-${formatNumber(current.atMs / 1000)})/${formatNumber(durationSeconds)}`;
    const progress = `max(0\\,min(1\\,${rawProgress}))`;
    const easedProgress = `(0.5-0.5*cos(PI*${progress}))`;
    const interpolated = `${formatNumber(values[index])}+(${formatNumber(values[index + 1])}-${formatNumber(values[index])})*${easedProgress}`;
    expression = `if(lt(t\\,${formatNumber(next.atMs / 1000)})\\,${interpolated}\\,${expression})`;
  }

  return expression;
}

function clampExpression(valueExpression, maxExpression) {
  return `max(0\\,min(${maxExpression}\\,${valueExpression}))`;
}

function formatNumber(value) {
  return Number(value.toFixed(6)).toString();
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

async function readOptionalJson(filePath) {
  if (!(await fileExists(filePath))) return null;
  return readJson(filePath);
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

function findAudioOverlaps(segments, minimumAllowedGapMs = 80) {
  const overlaps = [];
  for (let first = 0; first < segments.length; first += 1) {
    const firstEndMs = segments[first].startMs + segments[first].durationSeconds * 1000;
    for (let second = first + 1; second < segments.length; second += 1) {
      const overlapMs = Math.min(firstEndMs, segments[second].startMs + segments[second].durationSeconds * 1000)
        - Math.max(segments[first].startMs, segments[second].startMs);
      if (overlapMs > minimumAllowedGapMs) overlaps.push({ first, second, overlapMs: Math.round(overlapMs) });
    }
  }
  return overlaps;
}
