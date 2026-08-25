import "server-only";

import type { AllowedImageMimeType } from "@/features/creator/types";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function validateImageFile(file: File): Promise<{
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
}> {
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Images must be between 1 byte and 10 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageMimeType(bytes);

  if (!detected) {
    throw new Error("Upload a valid PNG, JPEG, or WebP image.");
  }

  // Trust the validated file signature rather than the browser's filename MIME.
  // Some valid images, especially exported logos, are PNG bytes with a .jpg name.
  return { bytes, mimeType: detected };
}

export function detectImageMimeType(bytes: Uint8Array): AllowedImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}
