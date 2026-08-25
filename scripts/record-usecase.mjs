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
const additionalInputPaths = config.additionalInputs.map((input) => path.resolve(projectRoot, input));
const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");
if (!existsSync(inputPath)) throw new Error(`Input image not found: ${inputPath}`);
for (const additionalInputPath of additionalInputPaths) {
  if (!existsSync(additionalInputPath)) throw new Error(`Additional input image not found: ${additionalInputPath}`);
}
if (!existsSync(authPath)) throw new Error("Recording login state is missing. Run pnpm recording:auth first.");

const baseUrl = process.env.RECORDING_BASE_URL ?? "http://127.0.0.1:3001";
const fieldPauseMs = positiveInteger(process.env.RECORDING_FIELD_PAUSE_MS, 1_800);
const menuPauseMs = positiveInteger(process.env.RECORDING_MENU_PAUSE_MS, 700);
const resultPauseMs = positiveInteger(process.env.RECORDING_RESULT_PAUSE_MS, 2_500);
const runId = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const outputDirectory = path.join(projectRoot, "content-kits", config.id, runId);
await mkdir(outputDirectory, { recursive: true });
const timelineStartedAt = new Date().toISOString();
const timelineStart = performance.now();
const timelineEvents = [];

function markTimelineEvent(name, details = {}) {
  timelineEvents.push({
    name,
    atMs: Math.round(performance.now() - timelineStart),
    ...details,
  });
}

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
  markTimelineEvent("browser_started");
  await page.goto(new URL(config.route, baseUrl).toString(), { waitUntil: "networkidle" });
  markTimelineEvent("page_loaded", { route: config.route });
  await page.getByTestId("creator-workspace").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector('[data-testid="creator-workspace"]')?.getAttribute("data-ready") === "true");
  markTimelineEvent("workspace_ready");
  await page.waitForTimeout(fieldPauseMs);
  markTimelineEvent("reference_upload_started", { index: 1 });
  await page.getByTestId("asset-upload-input").setInputFiles(inputPath);
  await page.getByText(/saved and selected as/i).waitFor({ timeout: 60_000 });
  markTimelineEvent("reference_selected", { index: 1 });
  await page.waitForTimeout(fieldPauseMs);

  for (const [index, additionalInputPath] of additionalInputPaths.entries()) {
    markTimelineEvent("reference_upload_started", { index: index + 2 });
    await page.getByTestId("add-reference-button").click();
    await page.getByRole("menuitem", { name: "Add image", exact: true }).click();
    await page.locator("dialog[open]").locator('input[type="file"]').setInputFiles(additionalInputPath);
    await page.getByText(/saved and selected as/i).waitFor({ timeout: 60_000 });
    markTimelineEvent("reference_selected", { index: index + 2 });
    await page.waitForTimeout(fieldPauseMs);
  }

  for (const field of config.fields) {
    markTimelineEvent("field_started", { label: field.label, action: field.action });
    const locator = page.getByLabel(field.label, { exact: true });
    if (field.action === "select") {
      const tagName = await locator.evaluate((element) => element.tagName);
      if (tagName === "SELECT") {
        await locator.selectOption(field.value);
      } else {
        await locator.click();
        await page.waitForTimeout(menuPauseMs);
        const radioOption = page.getByRole("menuitemradio", { name: field.value, exact: true });
        if (await radioOption.count() > 0) await radioOption.click();
        else await page.getByRole("menuitem", { name: field.value, exact: true }).click();
      }
    } else {
      await locator.fill(field.value);
    }
    markTimelineEvent("field_completed", { label: field.label, action: field.action });
    await page.waitForTimeout(fieldPauseMs);
  }

  await page.waitForTimeout(fieldPauseMs);
  await recordGenerations(page, context, baseUrl, config.variations, outputDirectory, resultFiles);

  await copyFile(inputPath, path.join(outputDirectory, `input${path.extname(inputPath).toLowerCase()}`));
  for (const [index, additionalInputPath] of additionalInputPaths.entries()) {
    await copyFile(additionalInputPath, path.join(outputDirectory, `input-${index + 2}${path.extname(additionalInputPath).toLowerCase()}`));
  }
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    JSON.stringify(
      {
        ...config,
        baseUrl,
        recordedAt: new Date().toISOString(),
        timelineFile: "timeline.json",
        results: resultFiles,
      },
      null,
      2,
    ),
  );
} finally {
  markTimelineEvent("browser_closing");
  await context.close();
  if (video) {
    await video.saveAs(path.join(outputDirectory, "raw-demo.webm"));
    await video.delete();
  }
  await browser.close();
  await writeFile(
    path.join(outputDirectory, "timeline.json"),
    JSON.stringify(
      {
        startedAt: timelineStartedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - timelineStart),
        events: timelineEvents,
      },
      null,
      2,
    ),
  );
}

console.log(`Content kit saved to ${outputDirectory}`);

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function recordGenerations(page, context, baseUrl, variations, outputDirectory, resultFiles) {
  await page.getByTestId("generation-count-button").click();
  await page.getByRole("menuitemradio", { name: `${variations}x`, exact: true }).click();
  await page.getByTestId("generate-button").click();

  if (variations === 1) {
    markTimelineEvent("generation_started", { index: 1 });
    await page.getByTestId("generation-loading").waitFor({ state: "visible", timeout: 15_000 });
    const resultImage = page.getByTestId("generation-result-image");
    await resultImage.waitFor({ state: "visible", timeout: 300_000 });
    await waitForImage(resultImage);
    markTimelineEvent("generation_ready", { index: 1 });
    await page.waitForTimeout(resultPauseMs);
    await saveResultImage(resultImage, context, baseUrl, outputDirectory, resultFiles, 1);
    markTimelineEvent("result_saved", { index: 1 });
    return;
  }

  await page.getByTestId("generation-batch-results").waitFor({ state: "visible", timeout: 15_000 });
  for (let index = 1; index <= variations; index += 1) {
    markTimelineEvent("generation_started", { index });
    const card = page.getByTestId(`generation-item-${index}`);
    await card.waitFor({ state: "visible", timeout: 15_000 });
    await card.getByText("Saved to your library", { exact: true }).waitFor({ state: "visible", timeout: 300_000 });
    const resultImage = card.locator("img").first();
    await resultImage.waitFor({ state: "visible", timeout: 15_000 });
    await waitForImage(resultImage);
    markTimelineEvent("generation_ready", { index });
    await page.waitForTimeout(resultPauseMs);
    await saveResultImage(resultImage, context, baseUrl, outputDirectory, resultFiles, index);
    markTimelineEvent("result_saved", { index });
  }
}

async function waitForImage(locator) {
  await locator.evaluate((image) => new Promise((resolve, reject) => {
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
}

async function saveResultImage(resultImage, context, baseUrl, outputDirectory, resultFiles, index) {
  const source = await resultImage.getAttribute("src");
  if (!source) throw new Error("Generated image URL is missing.");
  const response = await context.request.get(new URL(source, baseUrl).toString());
  if (!response.ok()) throw new Error(`Could not save result image (${response.status()}).`);
  const extension = extensionForMime(response.headers()["content-type"] ?? "");
  const resultName = `result-${index}.${extension}`;
  await writeFile(path.join(outputDirectory, resultName), await response.body());
  resultFiles.push(resultName);
}

function readConfig(value) {
  if (!isRecord(value)) throw new Error("Use-case config must be an object.");
  const id = requiredString(value.id, "id");
  const route = requiredString(value.route, "route");
  const input = requiredString(value.input, "input");
  const additionalInputs = value.additionalInputs === undefined ? [] : value.additionalInputs;
  if (!Array.isArray(additionalInputs) || additionalInputs.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Use-case additionalInputs must contain image paths.");
  }
  const variations = Number.isInteger(value.variations) && value.variations >= 1 && value.variations <= 3 ? value.variations : 1;
  if (!Array.isArray(value.fields)) throw new Error("Use-case fields must be an array.");
  const fields = value.fields.map((item) => {
    if (!isRecord(item)) throw new Error("Each use-case field must be an object.");
    const action = item.action === "fill" || item.action === "select" ? item.action : null;
    if (!action) throw new Error("Field action must be fill or select.");
    return { label: requiredString(item.label, "field label"), value: requiredString(item.value, "field value"), action };
  });
  return { id, route, input, additionalInputs: additionalInputs.map((item) => item.trim()), variations, fields };
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
