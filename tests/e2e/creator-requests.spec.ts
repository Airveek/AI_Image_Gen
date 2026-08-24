import { expect, test } from "@playwright/test";

import { buildGenerationPrompt } from "@/features/creator/prompts";
import { parseGenerationRequest } from "@/features/creator/requests";

test("legacy Product & Fashion requests default to a store listing goal", () => {
  const request = parseGenerationRequest({
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    lighting: "auto",
    aspectRatio: "1:1",
    extraDirection: "",
    sourceAssetIds: ["9a2c745c-08f3-4ca7-b01a-3cb6f024bde8"],
  });

  expect(request).toMatchObject({ arenaId: "product-fashion", campaignGoal: "store-listing" });
  expect(request.references).toEqual([{ assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "product" }]);
});

test("Product & Fashion rejects invalid campaign goals", () => {
  expect(() => parseGenerationRequest({
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    campaignGoal: "unknown",
    lighting: "auto",
    aspectRatio: "1:1",
    sourceAssetIds: ["9a2c745c-08f3-4ca7-b01a-3cb6f024bde8"],
})).toThrow("Choose a valid campaign goal.");
});

test("Product & Fashion prompt keeps product truth and campaign direction", () => {
  const prompt = buildGenerationPrompt({
    arenaId: "product-fashion",
    mode: "influencer-lifestyle",
    scene: "lifestyle",
    campaignGoal: "ad-banner",
    backgroundMood: "Warm stone",
    lighting: "soft-daylight",
    aspectRatio: "4:5",
    extraDirection: "Keep space on the left.",
    references: [],
  });

  expect(prompt).toContain("leave intentional clean space on one side");
  expect(prompt).toContain("Preserve the exact product shape");
  expect(prompt).toContain("Do not invent extra logos");
});
