import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const kitDirectory = path.resolve(process.argv[2] ?? "");
if (!kitDirectory) throw new Error("Run: node scripts/qa-ecommerce-image.mjs <content-kit-directory>");

const manifest = JSON.parse(await readFile(path.join(kitDirectory, "manifest.json"), "utf8"));
const reviewPath = path.join(kitDirectory, "image-review.json");
const review = await readOptionalJson(reviewPath);
const expectedVariations = Number(manifest.variations ?? 0);
const resultFiles = await listResultFiles(kitDirectory);
const resultPath = path.join(kitDirectory, "result-1.jpg");
const resultProbe = await probeImage(resultPath);
const checks = {
  oneImage: { pass: expectedVariations === 1 && resultFiles.length === 1, expectedVariations, resultFiles },
  resultFile: resultProbe,
  humanReview: {
    pass: review?.status === "pass"
      && review?.productIdentity === "pass"
      && review?.buyerDetail === "pass"
      && review?.realWorldScene === "pass"
      && review?.thumbnailReadability === "pass"
      && review?.plainBackgroundOnly === "pass",
    file: review ? "image-review.json" : null,
    status: review?.status ?? "missing",
  },
};
const report = {
  version: 1,
  kitDirectory,
  opportunityId: manifest.id,
  status: Object.values(checks).every((check) => check.pass) ? "pass" : "fail",
  checks,
  nextStage: "narration-and-rendering",
  rule: "Do not generate narration or render a video until one category-specific lifestyle image passes human review.",
};
await writeFile(path.join(kitDirectory, "image-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, id: manifest.id, checks }, null, 2));

async function listResultFiles(directory) {
  const files = [];
  for (let index = 1; index <= 20; index += 1) {
    try {
      const candidate = path.join(directory, `result-${index}.jpg`);
      const value = await stat(candidate);
      if (value.size > 1000) files.push(`result-${index}.jpg`);
    } catch {
      // Stop at the first missing sequential result.
      break;
    }
  }
  return files;
}

async function probeImage(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=size:stream=codec_name,width,height", "-of", "json", filePath]);
    const value = JSON.parse(stdout);
    const stream = (value.streams ?? []).find((item) => item.width && item.height);
    const width = Number(stream?.width ?? 0);
    const height = Number(stream?.height ?? 0);
    return {
      pass: Boolean(stream) && width >= 600 && height >= 600 && width <= 16384 && height <= 16384,
      file: "result-1.jpg",
      bytes: Number(value.format?.size ?? 0),
      width,
      height,
      codec: stream?.codec_name ?? null,
    };
  } catch (error) {
    return { pass: false, file: "result-1.jpg", error: error instanceof Error ? error.message : String(error) };
  }
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
