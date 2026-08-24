import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const useCaseId = process.argv[2]?.trim();
if (!useCaseId || !/^[A-Z0-9_-]+$/.test(useCaseId)) {
  throw new Error("Run: pnpm record:usecase PRODUCT01");
}

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "recording", "use-cases", `${useCaseId}.json`);
const config = readConfig(JSON.parse(await readFile(configPath, "utf8")));
const inputPath = path.resolve(projectRoot, config.input);
const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");
if (!existsSync(inputPath)) throw new Error(`Input image not found: ${inputPath}`);
if (!existsSync(authPath)) throw new Error("Recording login state is missing. Run pnpm recording:auth first.");

const baseUrl = process.env.RECORDING_BASE_URL ?? "http://127.0.0.1:3001";
const runId = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const outputDirectory = path.join(projectRoot, "content-kits", config.id, runId);
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: process.env.RECORDING_HEADED !== "1" });
const context = await browser.newContext({
  storageState: authPath,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: outputDirectory, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const video = page.video();
const resultFiles = [];

try {
  await page.goto(new URL(config.route, baseUrl).toString(), { waitUntil: "networkidle" });
  await page.getByTestId("creator-workspace").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('[data-testid="creator-workspace"]')?.getAttribute("data-ready") === "true");
  await page.getByTestId("asset-upload-input").setInputFiles(inputPath);
  await page.getByText("Reference saved and selected.").waitFor({ timeout: 60_000 });

  for (const field of config.fields) {
    const locator = page.getByLabel(field.label, { exact: true });
    if (field.action === "select") await locator.selectOption(field.value);
    else await locator.fill(field.value);
    await page.waitForTimeout(350);
  }

  for (let index = 1; index <= config.variations; index += 1) {
    await page.getByTestId("generate-button").click();
    await page.getByTestId("generation-loading").waitFor({ state: "visible", timeout: 15_000 });
    const resultImage = page.getByTestId("generation-result-image");
    await resultImage.waitFor({ state: "visible", timeout: 300_000 });
    await resultImage.evaluate((image) => new Promise((resolve, reject) => {
      if (!(image instanceof HTMLImageElement)) {
        reject(new Error("Generated result is not an image."));
        return;
      }
      if (image.complete && image.naturalWidth > 0) {
        resolve(true);
        return;
      }
      image.addEventListener("load", () => resolve(true), { once: true });
      image.addEventListener("error", () => reject(new Error("Generated image did not load.")), { once: true });
    }));
    await page.waitForTimeout(1_200);
    const source = await resultImage.getAttribute("src");
    if (!source) throw new Error("Generated image URL is missing.");
    const response = await context.request.get(new URL(source, baseUrl).toString());
    if (!response.ok()) throw new Error(`Could not save result image (${response.status()}).`);
    const extension = extensionForMime(response.headers()["content-type"] ?? "");
    const resultName = `result-${index}.${extension}`;
    await writeFile(path.join(outputDirectory, resultName), await response.body());
    resultFiles.push(resultName);
  }

  await copyFile(inputPath, path.join(outputDirectory, `input${path.extname(inputPath).toLowerCase()}`));
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    JSON.stringify({ ...config, baseUrl, recordedAt: new Date().toISOString(), results: resultFiles }, null, 2),
  );
} finally {
  await context.close();
  if (video) {
    await video.saveAs(path.join(outputDirectory, "raw-demo.webm"));
    await video.delete();
  }
  await browser.close();
}

console.log(`Content kit saved to ${outputDirectory}`);

function readConfig(value) {
  if (!isRecord(value)) throw new Error("Use-case config must be an object.");
  const id = requiredString(value.id, "id");
  const route = requiredString(value.route, "route");
  const input = requiredString(value.input, "input");
  const variations = Number.isInteger(value.variations) && value.variations >= 1 && value.variations <= 3 ? value.variations : 1;
  if (!Array.isArray(value.fields)) throw new Error("Use-case fields must be an array.");
  const fields = value.fields.map((item) => {
    if (!isRecord(item)) throw new Error("Each use-case field must be an object.");
    const action = item.action === "fill" || item.action === "select" ? item.action : null;
    if (!action) throw new Error("Field action must be fill or select.");
    return { label: requiredString(item.label, "field label"), value: requiredString(item.value, "field value"), action };
  });
  return { id, route, input, variations, fields };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Use-case ${label} is required.`);
  return value.trim();
}

function extensionForMime(mime) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}
