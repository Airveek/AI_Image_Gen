import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const authPath = path.resolve(process.env.RECORDING_STORAGE_STATE ?? ".recording-auth/user.json");

test("keeps the creator fixed and sends the selected image in numbered order", async ({ page }) => {
  test.skip(!existsSync(authPath), "Run pnpm recording:auth to create the local test login state.");
  const referenceId = "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8";
  const resultId = "bd9f30c8-2066-426d-8d82-9cf38f37fb72";
  let generationBody: unknown = null;

  await page.route("**/api/creator/assets", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: referenceId,
          userId: "test-user",
          kind: "product",
          name: "test-product",
          arenaId: null,
          prompt: null,
          sourceAssetIds: [],
          status: "ready",
          mimeType: "image/png",
          createdAt: new Date().toISOString(),
          imageUrl: "/images/artistly/features/ai-product-photographer.png",
          providerKind: null,
          providerModel: null,
        },
      }),
    });
  });
  await page.route("**/api/creator/generate", async (route) => {
    generationBody = route.request().postDataJSON() as unknown;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          id: resultId,
          userId: "test-user",
          kind: "generation",
          name: "Product creation",
          arenaId: "product-fashion",
          prompt: "test",
          sourceAssetIds: [referenceId],
          status: "ready",
          mimeType: "image/png",
          createdAt: new Date().toISOString(),
          imageUrl: "/images/artistly/features/ai-product-photographer.png",
          providerKind: "gemini-compatible",
          providerModel: "gemini-3.1-flash-image",
        },
      }),
    });
  });

  await page.goto("/create/product-fashion");
  await expect(page.getByTestId("creator-workspace")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("asset-upload-input").setInputFiles("public/images/artistly/features/ai-product-photographer.png");
  await expect(page.getByText("Image 1", { exact: true })).toBeVisible();
  await page.getByLabel("Background and mood").fill("Warm premium studio");
  await page.getByLabel("Final instruction").fill("Keep the exact product shape.");
  await page.getByTestId("generate-button").click();
  await expect(page.getByTestId("generation-result-image")).toBeVisible();

  expect(generationBody).toMatchObject({
    arenaId: "product-fashion",
    backgroundMood: "Warm premium studio",
    extraDirection: "Keep the exact product shape.",
    sourceAssetIds: [referenceId],
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
});
