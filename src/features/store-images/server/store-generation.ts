import "server-only";

import { buildGenerationPrompt } from "@/features/creator/prompts";
import { generateCreatorImageForUser } from "@/features/creator/server/generation";
import type { CreatorAsset, ProductFashionRequest } from "@/features/creator/types";
import { downloadStoreImage } from "@/features/store-images/server/store-client";

export async function generateStoreProductImage(input: {
  userId: string;
  productName: string;
  sourceImageUrl: string;
  prompt: string;
}): Promise<CreatorAsset> {
  const source = await downloadStoreImage(input.sourceImageUrl);
  const request: ProductFashionRequest = {
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    campaignGoal: "store-listing",
    backgroundMood: input.prompt,
    lighting: "studio-softbox",
    aspectRatio: "1:1",
    extraDirection: `Create a commercial product listing image for ${input.productName}. ${input.prompt}`,
    references: [],
  };

  const result = await generateCreatorImageForUser(inputRequest(request), input.userId, [
    {
      bytes: source.bytes,
      mimeType: source.mimeType,
      label: `Image 1 — the exact existing product image for ${input.productName}. Preserve the product identity, packaging, label, shape, colors, and visible details.`,
    },
  ]);

  if (!result.ok) throw new StoreGenerationError(result.message, result.code);
  return result.data;
}

function inputRequest(request: ProductFashionRequest): ProductFashionRequest {
  return {
    ...request,
    backgroundMood: request.backgroundMood.trim() || "clean, premium, commercially useful",
  };
}

export class StoreGenerationError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "StoreGenerationError";
  }
}

export function buildStorePromptPreview(prompt: string): string {
  return buildGenerationPrompt({
    arenaId: "product-fashion",
    mode: "product-scene",
    scene: "studio",
    campaignGoal: "store-listing",
    backgroundMood: prompt,
    lighting: "studio-softbox",
    aspectRatio: "1:1",
    extraDirection: prompt,
    references: [],
  });
}
