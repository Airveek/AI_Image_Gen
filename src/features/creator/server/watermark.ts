import "server-only";

import { removeWatermarkFromImageDataSync } from "@pilio/gemini-watermark-remover/image-data";
import sharp from "sharp";

import type { AllowedImageMimeType } from "@/features/creator/types";

type ImageBytes = {
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
};

export async function removeGeminiVisibleWatermark(image: ImageBytes): Promise<ImageBytes> {
  const { data, info } = await sharp(Buffer.from(image.bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = removeWatermarkFromImageDataSync(
    {
      width: info.width,
      height: info.height,
      data: Uint8ClampedArray.from(data),
    },
    { adaptiveMode: "auto" },
  );

  if (!result.meta.applied) {
    return image;
  }

  return {
    bytes: Uint8Array.from(await encodeImage(result.imageData, image.mimeType)),
    mimeType: image.mimeType,
  };
}

async function encodeImage(
  imageData: { width: number; height: number; data: Uint8ClampedArray },
  mimeType: AllowedImageMimeType,
): Promise<Buffer> {
  const input = sharp(Buffer.from(imageData.data), {
    raw: {
      width: imageData.width,
      height: imageData.height,
      channels: 4,
    },
  });

  if (mimeType === "image/jpeg") {
    return input.jpeg({ quality: 95 }).toBuffer();
  }

  if (mimeType === "image/webp") {
    return input.webp({ quality: 95 }).toBuffer();
  }

  return input.png().toBuffer();
}
