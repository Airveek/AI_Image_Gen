import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const kitDirectory = path.resolve(process.argv[2] ?? "");
if (!kitDirectory) throw new Error("Run: node scripts/qa-recording-capture.mjs <content-kit-directory>");

const manifest = JSON.parse(await readFile(path.join(kitDirectory, "manifest.json"), "utf8"));
const timeline = JSON.parse(await readFile(path.join(kitDirectory, "timeline.json"), "utf8"));
const expectedVariations = Number.isInteger(manifest.variations) && manifest.variations >= 1 ? manifest.variations : 1;
const rawPath = path.join(kitDirectory, "raw-demo.webm");
const rawProbe = await probe(rawPath);
const resultChecks = await Promise.all(Array.from({ length: expectedVariations }, (_, offset) => offset + 1).map(async (index) => {
  const filePath = path.join(kitDirectory, `result-${index}.jpg`);
  try {
    const file = await stat(filePath);
    return { index, pass: file.size > 1000, file: `result-${index}.jpg`, bytes: file.size };
  } catch {
    return { index, pass: false, file: `result-${index}.jpg`, bytes: 0 };
  }
}));
const events = timeline.events ?? [];
const eventCounts = {
  generationStarted: events.filter((event) => event.name === "generation_started").length,
  generationReady: events.filter((event) => event.name === "generation_ready").length,
  resultSaved: events.filter((event) => event.name === "result_saved").length,
};
const checks = {
  rawDecode: rawProbe,
  allResults: { pass: resultChecks.every((result) => result.pass), results: resultChecks },
  timeline: { pass: eventCounts.generationStarted === expectedVariations && eventCounts.generationReady === expectedVariations && eventCounts.resultSaved === expectedVariations, expectedVariations, eventCounts },
  manifest: { pass: Boolean(manifest.id && manifest.route && manifest.input), id: manifest.id, route: manifest.route },
};
const report = {
  version: 1,
  kitDirectory,
  status: checks.rawDecode.pass && checks.allResults.pass && checks.timeline.pass && checks.manifest.pass ? "pass" : "fail",
  checks,
  nextStage: "narration",
};
await writeFile(path.join(kitDirectory, "capture-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, id: manifest.id, raw: rawProbe, eventCounts }, null, 2));

async function probe(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", filePath]);
    const value = JSON.parse(stdout);
    const video = (value.streams ?? []).find((stream) => stream.width && stream.height);
    await execFileAsync("ffmpeg", ["-v", "error", "-i", filePath, "-map", "0:v:0", "-f", "null", "-"]);
    return { pass: true, duration: Number(value.format?.duration ?? 0), codec: video?.codec_name ?? null, width: video?.width ?? null, height: video?.height ?? null };
  } catch (error) {
    return { pass: false, error: error instanceof Error ? error.message : String(error) };
  }
}
