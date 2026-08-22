import "server-only";

import { buildGenerationPrompt } from "@/features/creator/prompts";
import { requireCreatorUser } from "@/features/creator/server/authorization";
import {
  completeGenerationAsset,
  createGenerationAsset,
  CreatorServiceError,
  failGenerationAsset,
  getOwnedAssetBytes,
} from "@/features/creator/server/assets";
import { getActiveProviderConfiguration } from "@/features/creator/server/integrations";
import {
  generateProviderImage,
  ProviderRequestError,
} from "@/features/creator/server/provider";
import type {
  CreatorAsset,
  CreatorErrorCode,
  CreatorResult,
  GenerationRequest,
} from "@/features/creator/types";

type CreatorFailure = Extract<CreatorResult<never>, { ok: false }>;

export async function generateCreatorImage(
  request: GenerationRequest,
): Promise<CreatorResult<CreatorAsset>> {
  let asset: { id: string; userId: string } | null = null;

  try {
    await requireCreatorUser();
    const configuration = await getActiveProviderConfiguration();
    const prompt = buildGenerationPrompt(request);
    asset = await createGenerationAsset({
      request,
      prompt,
      providerKind: configuration.kind,
      providerModel: configuration.model,
    });
    const loadedReferences = await Promise.all(
      request.sourceAssetIds.map((assetId) => getOwnedAssetBytes(assetId)),
    );
    const references = loadedReferences.map((reference, index) => ({
      bytes: reference.bytes,
      mimeType: reference.mimeType,
      label: `Reference image ${index + 1}: saved as “${reference.name}”; Airveek asset type “${reference.kind}”.`,
    }));
    const image = await generateProviderImage(
      configuration,
      prompt,
      request.aspectRatio,
      references,
    );
    const savedAsset = await completeGenerationAsset({
      assetId: asset.id,
      userId: asset.userId,
      image,
    });

    return { ok: true, data: savedAsset };
  } catch (error) {
    const result = resultFromError(error);
    if (asset) {
      await failGenerationAsset(asset.id, asset.userId, result.code).catch(() => undefined);
    }
    return result;
  }
}

function resultFromError(error: unknown): CreatorFailure {
  if (error instanceof CreatorServiceError) {
    return { ok: false, message: error.message, code: error.code };
  }

  if (error instanceof ProviderRequestError) {
    return { ok: false, message: error.message, code: error.code };
  }

  const message = error instanceof Error ? error.message : "The image could not be created.";
  return {
    ok: false,
    message,
    code: inferErrorCode(message),
  };
}

function inferErrorCode(message: string): CreatorErrorCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("active image provider") || normalized.includes("provider is configured")) {
    return "provider_not_configured";
  }
  if (normalized.includes("google drive") || normalized.includes("storage")) {
    return "storage_not_configured";
  }
  return "unknown";
}
