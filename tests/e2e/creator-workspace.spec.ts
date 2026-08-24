import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");
const imagePath = "public/images/artistly/features/ai-product-photographer.png";

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
  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generation-result-image")).toBeVisible();

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
  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generation-result-image")).toBeVisible();

  expect(generationBody).toMatchObject({
    arenaId: "general-image",
    references: [{ assetId: styleId, role: "style" }],
  });
});

test("creates a fixed three-image photoshoot and retries only a failed shot", async ({ page }) => {
  const generationBodies: unknown[] = [];
  let generationCount = 0;

  await page.route("**/api/creator/generate", async (route) => {
    generationCount += 1;
    generationBodies.push(route.request().postDataJSON() as unknown);
    if (generationCount === 2) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "provider_unavailable", message: "Lifestyle is temporarily unavailable." }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: assetFixture({
          id: `bd9f30c8-2066-426d-8d82-9cf38f37fb7${generationCount}`,
          kind: "generation",
          name: `Photoshoot ${generationCount}`,
          arenaId: "product-fashion",
          providerKind: "gemini-compatible",
          providerModel: "gemini-3.1-flash-image",
        }),
      }),
    });
  });

  await page.goto("/create/product-fashion");
  await page.getByRole("button", { name: /^Use .* as Product$/ }).first().click();
  await expect(page.getByTestId("creator-composer").getByText("Product", { exact: true })).toBeVisible();
  await page.getByTestId("photoshoot-pack-button").click();

  await expect(page.getByTestId("photoshoot-shot-hero")).toContainText("Saved to your library");
  await expect(page.getByTestId("photoshoot-shot-lifestyle")).toContainText("temporarily unavailable");
  await expect(page.getByTestId("photoshoot-shot-on-model")).toContainText("Saved to your library");
  expect(generationBodies).toHaveLength(3);
  expect(generationBodies[0]).toMatchObject({
    mode: "product-scene",
    scene: "studio",
    campaignGoal: "store-listing",
    lighting: "studio-softbox",
    aspectRatio: "1:1",
    references: [{ role: "product" }],
  });
  expect(generationBodies[1]).toMatchObject({
    mode: "influencer-lifestyle",
    scene: "lifestyle",
    campaignGoal: "social-post",
    lighting: "soft-daylight",
    aspectRatio: "4:5",
  });
  const firstReferences = (generationBodies[0] as { references: unknown[] }).references;
  expect((generationBodies[1] as { references: unknown[] }).references).toEqual(firstReferences);
  expect((generationBodies[2] as { references: unknown[] }).references).toEqual(firstReferences);
  expect(generationBodies[2]).toMatchObject({
    mode: "on-model",
    scene: "lifestyle",
    campaignGoal: "lookbook",
    lighting: "soft-daylight",
    aspectRatio: "4:5",
  });

  await page.getByTestId("photoshoot-shot-lifestyle").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("photoshoot-shot-lifestyle")).toContainText("Saved to your library");
  expect(generationBodies).toHaveLength(4);
  expect(generationBodies[3]).toMatchObject({ mode: "influencer-lifestyle", campaignGoal: "social-post" });
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
  await expect(page.getByRole("button", { name: "Cartoon" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto light" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: /Create high-quality sketch/ })).toBeVisible();

  await page.getByTestId("asset-upload-input").setInputFiles(imagePath);
  await expect(page.getByText("Sketch image 1", { exact: true })).toBeVisible();

  await page.getByTestId("add-reference-button").click();
  await page.getByRole("menuitem", { name: "Add image" }).click();
  await page.locator("dialog[open]").locator('input[type="file"]').setInputFiles(imagePath);
  await expect(page.getByText("Sketch image 2", { exact: true })).toBeVisible();

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
    imageUrl: "/images/artistly/features/ai-product-photographer.png",
    providerKind,
    providerModel,
  };
}
