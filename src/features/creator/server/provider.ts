import "server-only";

import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";

import { detectImageMimeType } from "@/features/creator/server/files";
import { removeGeminiVisibleWatermark } from "@/features/creator/server/watermark";

import type {
  AllowedImageMimeType,
  GeneratedImage,
  ImageAspectRatio,
  ImageProviderKind,
  ProviderTestResult,
} from "@/features/creator/types";

const PROVIDER_TIMEOUT_MS = 240_000;
const PROVIDER_MANAGEMENT_TIMEOUT_MS = 45_000;
const MAX_PROVIDER_IMAGE_BYTES = 20 * 1024 * 1024;

export type ProviderConfiguration = {
  id: string;
  name: string;
  kind: ImageProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string | null;
};

export type ProviderReference = {
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
  label?: string;
};

export async function listProviderModels(configuration: ProviderConfiguration): Promise<string[]> {
  const response = await providerFetch(`${configuration.baseUrl}/models`, configuration, {
    method: "GET",
  });
  const body: unknown = await response.json();
  const models = readArray(body, "models")
    .map((item) => readString(item, "name"))
    .filter((name): name is string => Boolean(name))
    .map((name) => name.replace(/^models\//, ""));

  return [...new Set(models)].sort();
}

export async function requestProviderManagement(
  configuration: ProviderConfiguration,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  if (configuration.kind !== "gemini-compatible") {
    throw new Error("Account rotation is available only for the Gemini-compatible bridge.");
  }
  if (!configuration.apiKey) {
    throw new Error("Save the bridge administrator token as this provider's API key first.");
  }
  const normalizedPath = path.replace(/^\/+/, "");
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const response = await providerFetch(`${configuration.baseUrl}/${normalizedPath}`, configuration, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(PROVIDER_MANAGEMENT_TIMEOUT_MS),
  });
  return response.json() as Promise<unknown>;
}

export async function generateProviderImage(
  configuration: ProviderConfiguration,
  prompt: string,
  aspectRatio: ImageAspectRatio,
  references: ProviderReference[],
  traceId = randomUUID(),
): Promise<GeneratedImage> {
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];

  for (const reference of references) {
    if (reference.label) {
      parts.push({ text: reference.label });
    }
    parts.push({
      inlineData: {
        mimeType: reference.mimeType,
        data: Buffer.from(reference.bytes).toString("base64"),
      },
    });
  }

  const response = await providerFetch(
    `${configuration.baseUrl}/models/${encodeURIComponent(configuration.model)}:generateContent`,
    configuration,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-airveek-trace-id": traceId,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio,
            imageSize: "1K",
          },
        },
      }),
    },
  );

  const body: unknown = await response.json();
  const blockedReason = readProviderBlockReason(body);

  if (blockedReason) {
    throw new ProviderRequestError("provider_blocked", `The provider blocked this request: ${blockedReason}`);
  }

  const imagePart = findImagePart(body);

  if (!imagePart) {
    throw new ProviderRequestError(
      "provider_incompatible",
      "The provider returned no portable image. Confirm that it returns inline image bytes or a downloadable HTTPS image URL.",
    );
  }

  const downloaded = imagePart.data
    ? decodeInlineImage(imagePart.data, imagePart.mimeType)
    : await downloadRemoteImage(imagePart.url ?? "", imagePart.mimeType);
  let processed: ProviderReference;

  try {
    processed = await removeGeminiVisibleWatermark(downloaded);
  } catch {
    throw new ProviderRequestError(
      "provider_incompatible",
      "The provider image could not be safely processed before saving.",
    );
  }

  if (processed.bytes.length === 0 || processed.bytes.length > MAX_PROVIDER_IMAGE_BYTES) {
    throw new ProviderRequestError("provider_incompatible", "The processed image has an invalid size.");
  }

  const processedMimeType = detectImageMimeType(processed.bytes);
  if (!processedMimeType || processedMimeType !== processed.mimeType) {
    throw new ProviderRequestError("provider_incompatible", "The processed image is not a supported image file.");
  }

  return {
    bytes: processed.bytes,
    mimeType: processed.mimeType,
    provider: configuration.kind,
    model: configuration.model,
  };
}

export async function testProviderConfiguration(
  configuration: ProviderConfiguration,
): Promise<ProviderTestResult> {
  const models = await listProviderModels(configuration);

  if (!models.includes(configuration.model)) {
    return {
      models,
      supportsTextToImage: false,
      supportsReferenceImages: false,
      message: "The configured model was not returned by this provider.",
    };
  }

  try {
    const referenceBytes = Uint8Array.from(
      await sharp({
        create: {
          width: 128,
          height: 128,
          channels: 3,
          background: { r: 116, g: 204, b: 137 },
        },
      })
        .png()
        .toBuffer(),
    );
    await generateProviderImage(
      configuration,
      "Create one simple square product test image: a matte white ceramic cup on a neutral gray background with one soft green accent matching Image 1. Return only the image.",
      "1:1",
      [{ bytes: referenceBytes, mimeType: "image/png", label: "Image 1 — soft green color reference." }],
    );

    return {
      models,
      supportsTextToImage: true,
      supportsReferenceImages: true,
      message: "Reference-guided image generation passed.",
    };
  } catch (error) {
    return {
      models,
      supportsTextToImage: false,
      supportsReferenceImages: false,
      message: error instanceof Error ? error.message : "Reference image generation failed.",
    };
  }
}

export class ProviderRequestError extends Error {
  constructor(
    public readonly code:
      | "provider_incompatible"
      | "provider_blocked"
      | "provider_unavailable"
      | "provider_rate_limited"
      | "provider_timeout"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

async function providerFetch(
  url: string,
  configuration: ProviderConfiguration,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const traceId = headers.get("x-airveek-trace-id");
  const startedAt = traceId ? performance.now() : null;

  if (configuration.apiKey) {
    headers.set("x-goog-api-key", configuration.apiKey);
    if (configuration.kind === "gemini-compatible") {
      headers.set("authorization", `Bearer ${configuration.apiKey}`);
    }
  }

  try {
    await assertPublicHostname(new URL(url).hostname);
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers,
      signal: init.signal ?? AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    if (traceId && startedAt !== null) {
      console.info(
        `[creator-provider] trace=${traceId} status=${response.status} duration_ms=${Math.round(performance.now() - startedAt)}`,
      );
    }

    if (!response.ok) {
      const providerMessage = await readProviderErrorMessage(response);
      const message = providerMessage ?? `Provider request failed (${response.status}).`;

      throw new ProviderRequestError(
        response.status === 429
          ? "provider_rate_limited"
          : response.status === 503
            ? "provider_unavailable"
            : response.status === 408 || response.status === 504
              ? "provider_timeout"
              : "unknown",
        response.status === 429
          ? `Gemini quota or rate limit reached: ${message} Wait and try again, or check the project quota and billing.`
          : response.status === 503
            ? `The image provider is unavailable: ${message} Check the provider session or try again shortly.`
            : `${message} Check the active provider and try again.`,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ProviderRequestError("provider_timeout", "The image provider took too long to respond. Please try again.");
    }

    throw new ProviderRequestError("unknown", error instanceof Error ? error.message : "The provider request failed.");
  }
}

async function readProviderErrorMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = JSON.parse(await response.text());
    const error = readRecord(body, "error");
    const message = readString(error, "message");
    const status = readString(error, "status");
    const topLevelMessage = readString(body, "message");
    const topLevelStatus = readString(body, "status");

    if (!message && topLevelMessage && topLevelStatus && topLevelStatus !== "error") {
      return topLevelMessage;
    }

    if (!message && topLevelMessage) {
      return topLevelMessage;
    }

    if (message && status && !message.toLowerCase().includes(status.toLowerCase())) {
      return `${status}: ${message}`;
    }

    return message ?? status;
  } catch {
    return null;
  }
}

function findImagePart(body: unknown): { data?: string; url?: string; mimeType: AllowedImageMimeType } | null {
  const candidates = readArray(body, "candidates");

  for (const candidate of candidates) {
    const content = readRecord(candidate, "content");
    const parts = readArray(content, "parts");

    for (const part of parts) {
      const inlineData = readRecord(part, "inlineData") ?? readRecord(part, "inline_data");
      const data = readString(inlineData, "data");
      const inlineMime = readAllowedMimeType(
        readString(inlineData, "mimeType") ?? readString(inlineData, "mime_type"),
      );

      if (data && inlineMime) {
        return { data, mimeType: inlineMime };
      }

      const fileData = readRecord(part, "fileData") ?? readRecord(part, "file_data");
      const url = readString(fileData, "fileUri") ?? readString(fileData, "file_uri");
      const fileMime = readAllowedMimeType(
        readString(fileData, "mimeType") ?? readString(fileData, "mime_type"),
      );

      if (url && fileMime) {
        return { url, mimeType: fileMime };
      }
    }
  }

  return null;
}

function readProviderBlockReason(body: unknown): string | null {
  const promptFeedback = readRecord(body, "promptFeedback") ?? readRecord(body, "prompt_feedback");
  const promptReason = readString(promptFeedback, "blockReason") ?? readString(promptFeedback, "block_reason");

  if (promptReason) {
    return promptReason;
  }

  const candidates = readArray(body, "candidates");
  for (const candidate of candidates) {
    const finishReason = readString(candidate, "finishReason") ?? readString(candidate, "finish_reason");
    if (finishReason === "SAFETY" || finishReason === "IMAGE_SAFETY") {
      return finishReason;
    }
  }

  return null;
}

function decodeInlineImage(data: string, mimeType: AllowedImageMimeType): ProviderReference {
  const bytes = Uint8Array.from(Buffer.from(data, "base64"));

  if (bytes.length === 0 || bytes.length > MAX_PROVIDER_IMAGE_BYTES) {
    throw new ProviderRequestError("provider_incompatible", "The provider returned an invalid image size.");
  }

  const detectedMimeType = detectImageMimeType(bytes);
  if (!detectedMimeType) {
    throw new ProviderRequestError("provider_incompatible", "The provider returned bytes that are not a supported image.");
  }

  return { bytes, mimeType: detectedMimeType ?? mimeType };
}

async function downloadRemoteImage(url: string, expectedMimeType: AllowedImageMimeType): Promise<ProviderReference> {
  let currentUrl = validateProviderBaseUrl(url, false);
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    const parsed = new URL(currentUrl);
    await assertPublicHostname(parsed.hostname);
    response = await fetch(currentUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location || redirectCount === 4) {
      throw new ProviderRequestError("provider_incompatible", "The provider image URL redirected too many times.");
    }
    currentUrl = validateProviderBaseUrl(new URL(location, currentUrl).toString(), false);
  }

  if (!response) {
    throw new ProviderRequestError("provider_incompatible", "The provider image URL could not be downloaded.");
  }

  if (!response.ok) {
    throw new ProviderRequestError(
      "provider_incompatible",
      `The provider returned an image URL that Airveek could not download (${response.status}).`,
    );
  }

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_PROVIDER_IMAGE_BYTES) {
    throw new ProviderRequestError("provider_incompatible", "The provider image is larger than 20 MB.");
  }

  const responseMimeType = readAllowedMimeType(response.headers.get("content-type")?.split(";")[0]) ?? expectedMimeType;
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length === 0 || bytes.length > MAX_PROVIDER_IMAGE_BYTES) {
    throw new ProviderRequestError("provider_incompatible", "The provider returned an invalid image file.");
  }

  const detectedMimeType = detectImageMimeType(bytes);
  if (!detectedMimeType) {
    throw new ProviderRequestError("provider_incompatible", "The provider URL did not return a supported image file.");
  }

  return { bytes, mimeType: detectedMimeType ?? responseMimeType };
}

export function validateProviderBaseUrl(value: string, requireApiBase = true): string {
  const parsed = new URL(value.trim());

  if (parsed.username || parsed.password) {
    throw new Error("Provider URLs cannot contain embedded usernames or passwords.");
  }

  if (parsed.protocol !== "https:") {
    if (!(process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && isLoopbackHost(parsed.hostname))) {
      throw new Error("Provider URLs must use HTTPS.");
    }
  }

  if (process.env.NODE_ENV === "production" && isPrivateHost(parsed.hostname)) {
    throw new Error("Private or local provider hosts are not allowed in production.");
  }

  if (requireApiBase) {
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    parsed.search = "";
    parsed.hash = "";
  }

  return parsed.toString().replace(/\/$/, "");
}

function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (isLoopbackHost(normalized) || normalized.endsWith(".local")) {
    return true;
  }

  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && (parts[1] === 0 || parts[1] === 168)) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
    parts[0] >= 224
  );
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function assertPublicHostname(hostname: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  if (isPrivateHost(hostname)) {
    throw new Error("Private or local provider hosts are not allowed in production.");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The provider host resolves to a private or unavailable network address.");
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateHost(address);
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPrivateHost(normalized.slice(7));
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

function readAllowedMimeType(value: string | null | undefined): AllowedImageMimeType | null {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp" ? value : null;
}

function readRecord(value: unknown, key: string): Record<string, unknown> | null {
  const record = toRecord(value);
  return record ? toRecord(record[key]) : null;
}

function readArray(value: unknown, key: string): unknown[] {
  const record = toRecord(value);
  return record && Array.isArray(record[key]) ? record[key] : [];
}

function readString(value: unknown, key: string): string | null {
  const record = toRecord(value);
  return record && typeof record[key] === "string" ? record[key] : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
