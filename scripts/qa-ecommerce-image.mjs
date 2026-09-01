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
const manifestResults = Array.isArray(manifest.results) ? manifest.results.filter((file) => typeof file === "string" && file.trim() && isSafeKitFile(file)) : [];
const resultFiles = await listResultFiles(kitDirectory, manifestResults);
const resultFile = resultFiles[0] ?? manifestResults[0] ?? "result-1.jpg";
const resultPath = path.join(kitDirectory, resultFile);
const resultProbe = await probeImage(resultPath, resultFile);
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
// A failed report must fail the process as well. Callers such as CI, the
// production runner, and shell pipelines must not be able to continue merely
// because the report file was written successfully.
process.exitCode = report.status === "pass" ? 0 : 1;

async function listResultFiles(directory, declaredFiles) {
  if (declaredFiles.length > 0) {
    const files = [];
    for (const file of declaredFiles) {
      try {
        const value = await stat(path.join(directory, file));
        if (value.size > 1000) files.push(file);
      } catch {
        return files;
      }
    }
    return files;
  }
  const files = [];
  for (let index = 1; index <= 20; index += 1) {
    try {
      const file = `result-${index}.jpg`;
      const candidate = path.join(directory, file);
      const value = await stat(candidate);
      if (value.size > 1000) files.push(file);
    } catch {
      // Stop at the first missing sequential result.
      break;
    }
  }
  return files;
}

async function probeImage(filePath, fileName) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=size:stream=codec_name,width,height", "-of", "json", filePath]);
    const value = JSON.parse(stdout);
    const stream = (value.streams ?? []).find((item) => item.width && item.height);
    const width = Number(stream?.width ?? 0);
    const height = Number(stream?.height ?? 0);
    return {
      pass: Boolean(stream) && width >= 600 && height >= 600 && width <= 16384 && height <= 16384,
      file: fileName,
      bytes: Number(value.format?.size ?? 0),
      width,
      height,
      codec: stream?.codec_name ?? null,
    };
  } catch (error) {
    return { pass: false, file: fileName, error: error instanceof Error ? error.message : String(error) };
  }
}

function isSafeKitFile(file) {
  return !path.isAbsolute(file) && !file.includes("..") && !file.includes("/") && !file.includes("\\");
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
