import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");
const imagePath = "public/images/airveek/features/ai-product-photographer.png";

test.beforeEach(() => {
  test.skip(!existsSync(authPath), "Run pnpm recording:auth to create the local test login state.");
});

test("sends Product then Model in the selected order from the compact composer", async ({ page }) => {
  const productId = "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8";
  const modelId = "aa3c745c-08f3-4ca7-b01a-3cb6f024bde8";
  let uploadCount = 0;
  let generationBody: unknown = null;

  await page.route("**/api/creator/assets", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    uploadCount += 1;
    const isProduct = uploadCount === 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: assetFixture({
          id: isProduct ? productId : modelId,
          kind: isProduct ? "product" : "person",
          name: isProduct ? "Blue bottle" : "Maya model",
        }),
      }),
    });
  });
  await mockGeneration(page, (body) => { generationBody = body; });

  await page.goto("/create/product-fashion");
  await expect(page.getByTestId("creator-workspace")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("creator-composer")).toBeVisible();
  await expect(page.getByText("Guided setup", { exact: true })).toHaveCount(0);

  await page.getByTestId("asset-upload-input").setInputFiles(imagePath);
  await expect(page.getByText("Product", { exact: true }).first()).toBeVisible();

  await page.getByTestId("add-reference-button").click();
  await page.getByRole("menuitem", { name: "Model" }).click();
  const assetDialog = page.locator("dialog[open]");
  await assetDialog.locator('input[type="file"]').setInputFiles(imagePath);
  await expect(page.getByText("Model", { exact: true }).first()).toBeVisible();

  await page.getByTestId("creation-prompt").fill("Place both in a premium studio campaign with clean space on the left.");
  await selectGenerationCount(page, 1);
  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generation-result-image")).toBeVisible();

  await page.getByTestId("generation-result-image").click();
  const imageViewer = page.locator("dialog[open]");
  await expect(imageViewer.getByRole("link", { name: "Download" })).toBeVisible();
  await expect(imageViewer.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await imageViewer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  expect(generationBody).toMatchObject({
    arenaId: "product-fashion",
    lighting: "auto",
    extraDirection: "Place both in a premium studio campaign with clean space on the left.",
    references: [
      { assetId: productId, role: "product" },
      { assetId: modelId, role: "model" },
    ],
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
});

test("keeps a Style image distinct in the generation request", async ({ page }) => {
  const styleId = "ba3c745c-08f3-4ca7-b01a-3cb6f024bde8";
  let generationBody: unknown = null;

  await page.route("**/api/creator/assets", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: assetFixture({ id: styleId, kind: "reference", name: "Soft editorial style" }) }),
    });
  });
  await mockGeneration(page, (body) => { generationBody = body; });

  await page.goto("/create/general-image");
  await page.getByTestId("creation-prompt").fill("Create a calm editorial still life.");
  await page.getByTestId("add-reference-button").click();
  await page.getByRole("menuitem", { name: "Style" }).click();
  await page.locator("dialog[open]").locator('input[type="file"]').setInputFiles(imagePath);
  await selectGenerationCount(page, 1);
  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generation-result-image")).toBeVisible();

  expect(generationBody).toMatchObject({
    arenaId: "general-image",
    references: [{ assetId: styleId, role: "style" }],
  });
});

test("selects a generation count, sends identical requests in parallel, and retries one failed image", async ({ page }) => {
  const generationBodies: unknown[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let releaseAllRequests: () => void = () => undefined;
  const allRequestsSeen = new Promise<void>((resolve) => { releaseAllRequests = resolve; });
  let releaseResponses: () => void = () => undefined;
  const responseGate = new Promise<void>((resolve) => { releaseResponses = resolve; });

  await page.route("**/api/creator/generate", async (route) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const requestNumber = generationBodies.length + 1;
    const body = route.request().postDataJSON() as unknown;
    generationBodies.push(body);
    if (generationBodies.length === 3) releaseAllRequests();
    if (requestNumber <= 3) {
      await allRequestsSeen;
      await responseGate;
    }
    inFlight -= 1;

    if (requestNumber === 2) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "provider_unavailable", message: "This image is temporarily unavailable." }) });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: assetFixture({ id: `bd9f30c8-2066-426d-8d82-9cf38f37fb${requestNumber}`, kind: "generation", name: `Image ${requestNumber}`, arenaId: "product-fashion", providerKind: "gemini-compatible", providerModel: "gemini-3.1-flash-image" }) }),
    });
  });

  await page.goto("/create/product-fashion");
  await page.getByRole("button", { name: /^Use .* as Product$/ }).first().click();
  await expect(page.getByTestId("creator-composer").getByText("Product", { exact: true })).toBeVisible();
  await expect(page.getByTestId("generation-count-button")).toHaveText("2x");
  await page.getByTestId("generation-count-button").click();
  await expect(page.getByRole("menuitemradio", { name: "1x", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemradio", { name: "1x", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("generation-count-button")).toBeFocused();
  await page.getByTestId("generation-count-button").click();
  await expect(page.getByRole("menuitemradio", { name: "3x", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("generation-count-button")).toHaveText("3x");
  await expect(page.getByRole("menuitemradio", { name: "3x", exact: true })).toHaveCount(0);

  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generate-button")).toBeDisabled();
  await expect(page.getByTestId("generation-count-button")).toBeDisabled();
  await expect.poll(() => generationBodies.length).toBe(3);
  releaseResponses();
  expect(maxInFlight).toBe(3);
  expect(generationBodies[1]).toEqual(generationBodies[0]);
  expect(generationBodies[2]).toEqual(generationBodies[0]);
  await expect(page.getByTestId("generation-item-1").getByRole("button", { name: "Open Image 1" })).toBeVisible();
  await expect(page.getByTestId("generation-item-3").getByRole("button", { name: "Open Image 3" })).toBeVisible();
  await expect(page.getByTestId("generation-item-2")).toContainText("temporarily unavailable");
  await expect(page.getByTestId("generation-progress-status")).toContainText("2 of 3 images ready");

  await page.getByTestId("generation-item-2").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("generation-item-2").getByRole("button", { name: "Open Image 2" })).toBeVisible();
  expect(generationBodies).toHaveLength(4);
  expect(generationBodies[3]).toEqual(generationBodies[0]);
});

test("does not offer Character for Product & Fashion", async ({ page }) => {
  await page.goto("/create/product-fashion");
  await page.getByTestId("add-reference-button").click();
  await expect(page.getByRole("menuitem", { name: "Character" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Product" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Model" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Style" })).toBeVisible();
});

test("blocks Product generation until a Product image is selected", async ({ page }) => {
  let generationBody: unknown = null;
  await mockGeneration(page, (body) => { generationBody = body; });

  await page.goto("/create/product-fashion");
  await page.getByTestId("creation-prompt").fill("Create a clean campaign image.");
  await page.getByTestId("generate-button").click();
  await expect(page.getByText("Add one Product image before generating.")).toBeVisible();
  expect(generationBody).toBeNull();
});

test("shows contextual controls and keeps the mobile composer inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/create/storybook-page");

  await expect(page.getByTestId("creator-composer")).toBeVisible();
  await expect(page.getByRole("button", { name: "IMAGE", exact: true })).toHaveCount(0);
  await page.getByTestId("image-settings-button").click();
  await expect(page.getByLabel("Art style")).toBeVisible();
  await expect(page.getByLabel("Lighting")).toBeVisible();
  await expect(page.getByRole("button", { name: "4:5" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByTestId("creation-prompt").fill("Mina discovers a glowing door beneath the old oak tree.");
  await page.getByTestId("generate-button").click();
  await expect(page.getByText("Add a Character image or describe the main character in Optional details.")).toBeVisible();
});

test("creates Image to Sketch from one primary image and one optional detail image", async ({ page }) => {
  const generationBodies: unknown[] = [];
  let uploadCount = 0;

  await page.route("**/api/creator/assets", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    uploadCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: assetFixture({
          id: uploadCount === 1 ? "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8" : "aa3c745c-08f3-4ca7-b01a-3cb6f024bde8",
          kind: "reference",
          name: uploadCount === 1 ? "Sketch source" : "Neck detail",
        }),
      }),
    });
  });
  await mockGeneration(page, (body) => { generationBodies.push(body); });

  await page.goto("/create/image-to-sketch");
  await expect(page.getByTestId("creator-workspace")).toHaveAttribute("data-ready", "true");
  await expect(page.getByTestId("creation-prompt")).toBeVisible();
  await page.getByTestId("creation-prompt").fill("Keep the neckline and seam details exact.");
  await expect(page.getByRole("button", { name: "Auto light" })).toHaveCount(0);
  await expect(page.getByTestId("generation-count-button")).toHaveText("2x");

  await page.getByTestId("asset-upload-input").setInputFiles(imagePath);
  await expect(page.getByText("Sketch image 1", { exact: true })).toBeVisible();

  await page.getByTestId("add-reference-button").click();
  await page.getByRole("menuitem", { name: "Add image" }).click();
  await page.locator("dialog[open]").locator('input[type="file"]').setInputFiles(imagePath);
  await expect(page.getByText("Sketch image 2", { exact: true })).toBeVisible();

  await selectGenerationCount(page, 1);
  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generation-result-image")).toBeVisible();

  expect(generationBodies).toHaveLength(1);
  expect(generationBodies[0]).toMatchObject({
    arenaId: "image-to-sketch",
    aspectRatio: "1:1",
    prompt: "Keep the neckline and seam details exact.",
    references: [
      { assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
      { assetId: "aa3c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
    ],
  });
  expect(generationBodies[0]).not.toHaveProperty("lighting");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("matches the fixed-image Kive composer and progressive asset rail", async ({ page }) => {
  await page.goto("/create/product-fashion");

  await expect(page.getByRole("button", { name: "IMAGE", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Video", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("generation-count-button")).toHaveText("2x");
  await expect(page.getByRole("button", { name: "Products", exact: true })).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("button", { name: "Sort Products", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { name: "Recently added", exact: true })).toBeVisible();
  await page.getByRole("menuitemradio", { name: "A–Z", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sort Products", exact: true })).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page.getByRole("button", { name: "Models", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Products", exact: true })).toHaveAttribute("aria-expanded", "false");

  await page.getByPlaceholder("Search assets").first().fill("does-not-exist");
  await expect(page.getByText("No assets", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();

  await page.getByTestId("add-reference-button").click();
  await expect(page.getByRole("menuitem", { name: "Product", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Image", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Video", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByTestId("image-settings-button").click();
  const imageSettings = page.getByRole("dialog", { name: "Image settings" });
  await expect(imageSettings).toBeVisible();
  await expect(imageSettings.getByLabel("Mode")).toBeVisible();
  await expect(imageSettings.getByLabel("Scene")).toBeVisible();
  await expect(imageSettings.getByLabel("Lighting")).toBeVisible();
});

async function mockGeneration(page: Page, onBody: (body: unknown) => void) {
  await page.route("**/api/creator/generate", async (route) => {
    onBody(route.request().postDataJSON() as unknown);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: assetFixture({
          id: "bd9f30c8-2066-426d-8d82-9cf38f37fb72",
          kind: "generation",
          name: "Product creation",
          arenaId: "product-fashion",
          providerKind: "gemini-compatible",
          providerModel: "gemini-3.1-flash-image",
        }),
      }),
    });
  });
}

async function selectGenerationCount(page: Page, count: 1 | 2 | 3) {
  await page.getByTestId("generation-count-button").click();
  await page.getByRole("menuitemradio", { name: `${count}x`, exact: true }).click();
}

function assetFixture({
  id,
  kind,
  name,
  arenaId = null,
  providerKind = null,
  providerModel = null,
}: {
  id: string;
  kind: "product" | "person" | "character" | "reference" | "generation";
  name: string;
  arenaId?: "general-image" | "product-fashion" | "storybook-page" | "image-to-sketch" | null;
  providerKind?: "gemini-official" | "gemini-compatible" | null;
  providerModel?: string | null;
}) {
  return {
    id,
    userId: "test-user",
    kind,
    name,
    arenaId,
    prompt: null,
    sourceAssetIds: [],
    status: "ready",
    mimeType: "image/png",
    createdAt: new Date().toISOString(),
    imageUrl: "/images/airveek/features/ai-product-photographer.png",
    providerKind,
    providerModel,
  };
}
