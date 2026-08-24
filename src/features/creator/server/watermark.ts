import "server-only";

import {
  createWatermarkEngine,
  removeWatermarkFromImageDataSync,
} from "@pilio/gemini-watermark-remover/image-data";
import sharp from "sharp";

import type { AllowedImageMimeType } from "@/features/creator/types";
import type {
  ImageDataRemovalResult,
  WatermarkPosition,
} from "@pilio/gemini-watermark-remover/image-data";

type ImageBytes = {
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
};

type ImageDataLike = ImageDataRemovalResult["imageData"];
type AlphaMapKey = number | "36-v2";
type AlphaMapReader = {
  getAlphaMap(size: AlphaMapKey): Promise<Float32Array>;
};

const EDGE_RADIUS = 2;
const EDGE_BLUR_SIGMA = 2;

let watermarkEnginePromise: ReturnType<typeof createWatermarkEngine> | null = null;

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

  const processedImageData = result.meta.detection.residualVisibility?.visible
    ? await softenVisibleResidual(
        result.imageData,
        result.meta.position,
        result.meta.size,
        result.meta.config?.alphaVariant,
      )
    : result.imageData;

  return {
    bytes: Uint8Array.from(await encodeImage(processedImageData, image.mimeType)),
    mimeType: image.mimeType,
  };
}

async function softenVisibleResidual(
  imageData: ImageDataLike,
  position: WatermarkPosition | null,
  size: number | null,
  alphaVariant: string | undefined,
): Promise<ImageDataLike> {
  if (
    !position ||
    !size ||
    position.x < 0 ||
    position.y < 0 ||
    position.x + size > imageData.width ||
    position.y + size > imageData.height
  ) {
    return imageData;
  }

  watermarkEnginePromise ??= createWatermarkEngine();
  const watermarkEngine = (await watermarkEnginePromise) as AlphaMapReader;
  const alphaMapKey: AlphaMapKey = alphaVariant === "v2" && size === 36 ? "36-v2" : size;
  const alphaMap = await watermarkEngine.getAlphaMap(alphaMapKey);

  if (alphaMap.length !== size * size) {
    return imageData;
  }

  const edgeMask = buildResidualEdgeMask(alphaMap, size);

  if (!edgeMask) {
    return imageData;
  }

  const featheredMask = await sharp(edgeMask, {
    raw: { width: size, height: size, channels: 1 },
  })
    .blur(EDGE_BLUR_SIGMA)
    .raw()
    .toBuffer();
  const rawImage = Buffer.from(imageData.data);
  const blurredRegion = await sharp(rawImage, {
    raw: {
      width: imageData.width,
      height: imageData.height,
      channels: 4,
    },
  })
    .extract({ left: position.x, top: position.y, width: size, height: size })
    .blur(EDGE_BLUR_SIGMA)
    .raw()
    .toBuffer();
  const overlay = Buffer.alloc(size * size * 4);

  for (let pixel = 0; pixel < edgeMask.length; pixel += 1) {
    const offset = pixel * 4;
    overlay[offset] = blurredRegion[offset];
    overlay[offset + 1] = blurredRegion[offset + 1];
    overlay[offset + 2] = blurredRegion[offset + 2];
    overlay[offset + 3] = featheredMask[pixel];
  }

  const repaired = await sharp(rawImage, {
    raw: {
      width: imageData.width,
      height: imageData.height,
      channels: 4,
    },
  })
    .composite([
      {
        input: overlay,
        raw: { width: size, height: size, channels: 4 },
        left: position.x,
        top: position.y,
      },
    ])
    .raw()
    .toBuffer();

  return {
    width: imageData.width,
    height: imageData.height,
    data: Uint8ClampedArray.from(repaired),
  };
}

function buildResidualEdgeMask(alphaMap: Float32Array, size: number): Buffer | null {
  const gradient = new Float32Array(alphaMap.length);
  let maximum = 0;

  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const top = (y - 1) * size + x;
      const middle = y * size + x;
      const bottom = (y + 1) * size + x;
      const gradientX =
        -alphaMap[top - 1] +
        alphaMap[top + 1] -
        2 * alphaMap[middle - 1] +
        2 * alphaMap[middle + 1] -
        alphaMap[bottom - 1] +
        alphaMap[bottom + 1];
      const gradientY =
        -alphaMap[top - 1] -
        2 * alphaMap[top] -
        alphaMap[top + 1] +
        alphaMap[bottom - 1] +
        2 * alphaMap[bottom] +
        alphaMap[bottom + 1];
      const magnitude = Math.hypot(gradientX, gradientY);

      gradient[middle] = magnitude;
      maximum = Math.max(maximum, magnitude);
    }
  }

  if (maximum === 0) {
    return null;
  }

  for (let pixel = 0; pixel < gradient.length; pixel += 1) {
    gradient[pixel] = Math.sqrt(gradient[pixel] / maximum);
  }

  const mask = Buffer.alloc(alphaMap.length);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let strongestEdge = 0;

      for (let deltaY = -EDGE_RADIUS; deltaY <= EDGE_RADIUS; deltaY += 1) {
        for (let deltaX = -EDGE_RADIUS; deltaX <= EDGE_RADIUS; deltaX += 1) {
          if (deltaX * deltaX + deltaY * deltaY > EDGE_RADIUS * EDGE_RADIUS + 1) {
            continue;
          }

          const sampleX = x + deltaX;
          const sampleY = y + deltaY;

          if (sampleX < 0 || sampleY < 0 || sampleX >= size || sampleY >= size) {
            continue;
          }

          strongestEdge = Math.max(strongestEdge, gradient[sampleY * size + sampleX]);
        }
      }

      mask[y * size + x] = Math.round(strongestEdge * 255);
    }
  }

  return mask;
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
    return input.jpeg({ quality: 100, chromaSubsampling: "4:4:4" }).toBuffer();
  }

  if (mimeType === "image/webp") {
    return input.webp({ quality: 95 }).toBuffer();
  }

  return input.png().toBuffer();
}
