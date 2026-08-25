import { expect, test } from "@playwright/test";

import { buildGenerationPrompt } from "@/features/creator/prompts";
import { parseProductProfileSnapshot, studioRecipes } from "@/features/creator/quality";
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

test("Product & Fashion accepts an optional Studio recipe and preserves legacy defaults", () => {
  const legacyRequest = parseGenerationRequest({
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    lighting: "auto",
    aspectRatio: "1:1",
    sourceAssetIds: ["9a2c745c-08f3-4ca7-b01a-3cb6f024bde8"],
  });
  const recipeRequest = parseGenerationRequest({
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    studioRecipeId: "clean-studio",
    lighting: "auto",
    aspectRatio: "1:1",
    sourceAssetIds: ["9a2c745c-08f3-4ca7-b01a-3cb6f024bde8"],
  });

  expect(legacyRequest).not.toHaveProperty("studioRecipeId");
  expect(recipeRequest).toMatchObject({ studioRecipeId: "clean-studio" });
});

test("Product profile parsing is strict and safely falls back for old or malformed settings", () => {
  expect(parseProductProfileSnapshot({})).toBeUndefined();
  expect(parseProductProfileSnapshot({ productProfile: { name: "Bottle" } })).toBeUndefined();
  expect(parseProductProfileSnapshot({
    productProfile: {
      name: "Bottle",
      category: "Cosmetics",
      material: "Glass",
      colors: "Cobalt blue",
      identityNotes: "White cap and centered label",
      prohibitedChanges: "Do not change the cap or label",
    },
  })).toEqual({
    name: "Bottle",
    category: "Cosmetics",
    material: "Glass",
    colors: "Cobalt blue",
    identityNotes: "White cap and centered label",
    prohibitedChanges: "Do not change the cap or label",
  });
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

test("Product prompt context compiles identity and Studio instructions without affecting other arenas", () => {
  const prompt = buildGenerationPrompt({
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    campaignGoal: "store-listing",
    studioRecipeId: "clean-studio",
    backgroundMood: "neutral",
    lighting: "studio-softbox",
    aspectRatio: "1:1",
    extraDirection: "Keep the label readable.",
    references: [],
  }, {
    productProfile: {
      name: "Cobalt bottle",
      category: "Skincare",
      material: "Glass",
      colors: "Cobalt blue",
      identityNotes: "White cap and centered label",
      prohibitedChanges: "Do not change the cap or label",
    },
    studioRecipe: studioRecipes["clean-studio"],
  });

  expect(prompt).toContain("Product identity: use the supplied product reference as the source of truth for “Cobalt bottle”.");
  expect(prompt).toContain("Visual recipe: Clean studio.");
  expect(prompt).toContain("Product material: Glass.");
  expect(prompt).toContain("Keep the product complete, sharp, correctly scaled, and clearly readable.");

  const generalPrompt = buildGenerationPrompt({
    arenaId: "general-image",
    outputType: "image",
    subject: "A product on a table",
    exactText: "",
    style: "Editorial",
    lighting: "auto",
    aspectRatio: "1:1",
    extraDirection: "",
    references: [],
  });
  expect(generalPrompt).not.toContain("Visual recipe:");
});

test("Image to Sketch accepts an optional direction with one or two ordered references", () => {
  const request = parseGenerationRequest({
    arenaId: "image-to-sketch",
    aspectRatio: "1:1",
    prompt: "Keep the neckline and seam details exact.",
    references: [
      { assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
      { assetId: "aa3c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
    ],
  });

  expect(request).toEqual({
    arenaId: "image-to-sketch",
    aspectRatio: "1:1",
    prompt: "Keep the neckline and seam details exact.",
    references: [
      { assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
      { assetId: "aa3c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
    ],
  });
});

test("Image to Sketch requires at least one reference and keeps the two-image limit", () => {
  expect(() => parseGenerationRequest({ arenaId: "image-to-sketch", aspectRatio: "1:1", references: [] })).toThrow("Upload one sketch or garment image before generating.");
  expect(() => parseGenerationRequest({
    arenaId: "image-to-sketch",
    aspectRatio: "1:1",
    references: [
      { assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
      { assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" },
    ],
  })).toThrow("Choose no more than two valid reference images.");
  expect(() => parseGenerationRequest({
    arenaId: "image-to-sketch",
    aspectRatio: "1:1",
    sourceAssetIds: [
      "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8",
      "aa3c745c-08f3-4ca7-b01a-3cb6f024bde8",
      "ba3c745c-08f3-4ca7-b01a-3cb6f024bde8",
    ],
  })).toThrow("Choose no more than two valid reference images.");
});

test("Image to Sketch prompt protects the original design and canvas", () => {
  const prompt = buildGenerationPrompt({
    arenaId: "image-to-sketch",
    aspectRatio: "1:1",
    prompt: "Keep the neckline and seam details exact.",
    references: [{ assetId: "9a2c745c-08f3-4ca7-b01a-3cb6f024bde8", role: "reference" }],
  });

  expect(prompt).toContain("Image 1 is the primary source");
  expect(prompt).toContain("solid black linework on a pure white canvas");
  expect(prompt).toContain("Do not add color");
  expect(prompt).toContain("Optional user direction: Keep the neckline and seam details exact.");
  expect(prompt).toContain("Return one finished sketch image only");
});
