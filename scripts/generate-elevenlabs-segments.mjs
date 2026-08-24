import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile?.(".env");
} catch {
  // The caller may already have supplied the environment variables.
}

const kitArgument = process.argv[2]?.trim();
if (!kitArgument) {
  throw new Error("Run: pnpm generate:narration <content-kit-directory> [voice-id]");
}

const kitDirectory = path.resolve(kitArgument);
const scriptPath = path.join(kitDirectory, "narration-script.json");
const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_flash_v2_5";
const voiceId = process.argv[3]?.trim() || process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";

if (!apiKey) throw new Error("ELEVENLABS_API_KEY is missing from the environment.");
if (!voiceId) throw new Error("An ElevenLabs voice ID is required.");

const script = await readJson(scriptPath);
if (!Array.isArray(script) || script.length === 0) {
  throw new Error("narration-script.json must contain at least one segment.");
}

const audioDirectory = path.join(kitDirectory, "audio");
await mkdir(audioDirectory, { recursive: true });
const generatedSegments = [];
const alignments = [];

for (const [index, segment] of script.entries()) {
  if (!isRecord(segment)) throw new Error(`Narration segment ${index + 1} must be an object.`);
  const event = requiredString(segment.event, `segment ${index + 1} event`);
  const text = requiredString(segment.text, `segment ${index + 1} text`);
  const file = requiredFile(segment.file ?? `audio/${String(index + 1).padStart(2, "0")}-${event}.mp3`);
  const outputPath = path.resolve(kitDirectory, file);
  if (!outputPath.startsWith(`${kitDirectory}${path.sep}`)) {
    throw new Error(`Segment ${index + 1} file must stay inside the content kit.`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });

  const body = {
    text,
    model_id: modelId,
    language_code: "en",
    output_format: "mp3_44100_128",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.2,
      use_speaker_boost: true,
    },
    ...(index > 0 && isRecord(script[index - 1])
      ? { previous_text: String(script[index - 1].text ?? "") }
      : {}),
    ...(index + 1 < script.length && isRecord(script[index + 1])
      ? { next_text: String(script[index + 1].text ?? "") }
      : {}),
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs segment ${index + 1} failed with HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (!isRecord(result) || typeof result.audio_base64 !== "string") {
    throw new Error(`ElevenLabs segment ${index + 1} returned no audio.`);
  }

  await writeFile(outputPath, Buffer.from(result.audio_base64, "base64"));
  generatedSegments.push({
    ...segment,
    file,
    voiceId,
    modelId,
  });
  alignments.push({
    event,
    file,
    alignment: isRecord(result.alignment) ? result.alignment : null,
  });
  console.log(`Generated narration ${index + 1}/${script.length}: ${event}`);
}

await writeFile(
  path.join(kitDirectory, "narration-segments.json"),
  `${JSON.stringify(generatedSegments, null, 2)}\n`,
);
await writeFile(
  path.join(kitDirectory, "narration-alignment.json"),
  `${JSON.stringify({ voiceId, modelId, segments: alignments }, null, 2)}\n`,
);

console.log(`Generated ${generatedSegments.length} ElevenLabs narration segments.`);

async function readJson(filePath) {
  await access(filePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function requiredFile(value) {
  const file = requiredString(value, "segment file");
  if (path.isAbsolute(file)) throw new Error("Segment files must use kit-relative paths.");
  return file;
}
