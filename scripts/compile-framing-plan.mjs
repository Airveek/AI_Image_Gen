import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const kitDirectory = path.resolve(process.argv[2] ?? "");
if (!kitDirectory) throw new Error("Run: node scripts/compile-framing-plan.mjs <kit-directory>");

const timeline = JSON.parse(await readFile(path.join(kitDirectory, "timeline.json"), "utf8"));
const events = timeline.events ?? [];
const configuredVariations = await getConfiguredVariations(1);
const oneImageMode = configuredVariations === 1 || events.filter((event) => event.name === "generation_started").length === 1;
const find = (name, predicate = () => true) => {
  const match = events.find((event) => event.name === name && predicate(event));
  if (!match) throw new Error(`Missing timeline event: ${name}`);
  return Number(match.atMs);
};
const findLast = (name, predicate = () => true) => {
  const match = [...events].reverse().find((event) => event.name === name && predicate(event));
  if (!match) throw new Error(`Missing timeline event: ${name}`);
  return Number(match.atMs);
};
const ready = (index) => findLast("generation_ready", (event) => event.index === index);
const started = (index) => findLast("generation_started", (event) => event.index === index);
const generationMs = started(1);
const workspaceMs = find("workspace_ready");
const modeMs = find("field_completed", (event) => event.label === "Mode");
const promptMs = find("field_completed", (event) => event.label === "Describe the image you want");

const finalReadyMs = oneImageMode ? ready(1) : ready(3);
const keyframes = oneImageMode
  ? [
      frame(0, 0.43, 0.50, 1.22),
      frame(workspaceMs, 0.43, 0.50, 1.28),
      frame(modeMs, 0.43, 0.58, 1.36),
      frame(promptMs, 0.43, 0.62, 1.22),
      frame(generationMs, 0.43, 0.50, 1.22),
      frame(finalReadyMs, 0.43, 0.50, 1.42),
    ]
  : [
      frame(0, 0.50, 0.50, 1.00),
      frame(workspaceMs, 0.50, 0.50, 1.02),
      frame(modeMs, 0.50, 0.60, 1.06),
      frame(promptMs, 0.50, 0.58, 1.04),
      frame(generationMs, 0.50, 0.52, 1.02),
      frame(ready(1), 0.34, 0.45, 1.06),
      frame(started(2), 0.50, 0.45, 1.03),
      frame(ready(2), 0.50, 0.45, 1.06),
      frame(started(3), 0.66, 0.45, 1.03),
      frame(finalReadyMs, 0.50, 0.50, 1.00),
    ];

const plan = {
  version: 1,
  source: { width: 1440, height: 900 },
  coldOpen: { durationSeconds: 3.5, sourceStartSeconds: Math.max(0, finalReadyMs / 1000 - 0.5) },
  mainStartSeconds: 2.5,
  branding: {
    logoPath: "../../../public/images/airveek/logo.png",
    width: 180,
    opacity: 0.88,
    x: 1690,
    y: 32,
  },
  motion: {
    easing: "cosine",
    maxZoom: 1.42,
    minimumKeyframeSpacingMs: 500,
  },
  formats: {
    "16x9": {
      method: "safe-center-keyframes",
      safeZone: { top: 0.08, right: 0.05, bottom: 0.10, left: 0.05 },
      keyframes,
    },
  },
};

await writeFile(path.join(kitDirectory, "framing-plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
console.log(`Compiled horizontal framing plan with ${keyframes.length} keyframes.`);

function frame(atMs, x, y, zoom) {
  return { atMs: Math.max(0, Math.round(atMs)), focus: { x, y }, zoom };
}

async function getConfiguredVariations(fallback) {
  try {
    const manifest = JSON.parse(await readFile(path.join(kitDirectory, "manifest.json"), "utf8"));
    return Number.isInteger(manifest.variations) && manifest.variations >= 1 ? manifest.variations : fallback;
  } catch {
    return fallback;
  }
}
