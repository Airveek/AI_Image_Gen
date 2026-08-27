import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { detectImageMimeType } from "@/features/creator/server/files";
import type { AllowedImageMimeType } from "@/features/creator/types";
import type {
  StoreImageMode,
  StoreProduct,
  StoreProductPage,
} from "@/features/store-images/types";

const MAX_STORE_IMAGE_BYTES = 10 * 1024 * 1024;

export async function listStoreProducts(input: {
  cursor?: string | null;
  limit?: number;
  status?: "active" | "draft" | "archived";
  search?: string;
} = {}): Promise<StoreProductPage> {
  const baseUrl = requiredEnvironment("APINDEX_STORE_API_URL");
  const url = new URL("/api/artistly/products", `${baseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("limit", String(Math.min(Math.max(input.limit ?? 40, 1), 100)));
  if (input.cursor) url.searchParams.set("cursor", input.cursor);
  if (input.status) url.searchParams.set("status", input.status);
  if (input.search?.trim()) url.searchParams.set("search", input.search.trim());

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${requiredEnvironment("APINDEX_STORE_API_TOKEN")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new StoreClientError(readError(body, "Products could not be loaded."), response.status);
  return parseProductPage(body);
}

export async function downloadStoreImage(imageUrl: string): Promise<{
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
}> {
  const url = new URL(imageUrl);
  await assertAllowedStoreHost(url);

  const apiUrl = new URL(requiredEnvironment("APINDEX_STORE_API_URL"));
  const headers = url.origin === apiUrl.origin && url.pathname.startsWith("/api/artistly/")
    ? { authorization: `Bearer ${requiredEnvironment("APINDEX_STORE_API_TOKEN")}` }
    : undefined;

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new StoreClientError("The store image could not be downloaded.", response.status);

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_STORE_IMAGE_BYTES) {
    throw new StoreClientError("The store image is larger than 10 MB.", 413);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_STORE_IMAGE_BYTES) {
    throw new StoreClientError("The store image is larger than 10 MB.", 413);
  }

  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) throw new StoreClientError("The store returned an unsupported image.", 422);

  return { bytes, mimeType };
}

export function getStoreSourceImageUrl(productId: string): string {
  const baseUrl = requiredEnvironment("APINDEX_STORE_API_URL");
  return new URL(
    `/api/artistly/products/${encodeURIComponent(productId)}/source-image`,
    `${baseUrl.replace(/\/$/, "")}/`,
  ).toString();
}

export async function publishStoreImage(input: {
  productId: string;
  image: Uint8Array;
  mimeType: AllowedImageMimeType;
  imageMode: StoreImageMode;
  imageVersion: string;
  idempotencyKey: string;
}): Promise<{ imageUrl: string; imageVersion: string }> {
  const baseUrl = requiredEnvironment("APINDEX_STORE_API_URL");
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/artistly/products/${encodeURIComponent(input.productId)}/image`;
  const formData = new FormData();
  formData.set("image", new Blob([Buffer.from(input.image)], { type: input.mimeType }), "generated-image");
  formData.set("mode", input.imageMode);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${requiredEnvironment("APINDEX_STORE_API_TOKEN")}`,
      "if-match": input.imageVersion,
      "x-idempotency-key": input.idempotencyKey,
    },
    body: formData,
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new StoreClientError(readError(body, "The image could not be published."), response.status);

  const record = readRecord(body);
  const imageUrl = readString(record, "imageUrl");
  const imageVersion = readString(record, "imageVersion");
  if (!imageUrl || !imageVersion) throw new StoreClientError("The store returned an invalid publish response.", 502);

  return { imageUrl, imageVersion };
}

async function assertAllowedStoreHost(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new StoreClientError("Store images must use HTTPS.", 400);

  const apiHost = new URL(requiredEnvironment("APINDEX_STORE_API_URL")).hostname;
  const configuredHosts = (process.env.APINDEX_STORE_MEDIA_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const allowedHosts = new Set([apiHost.toLowerCase(), ...configuredHosts]);
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new StoreClientError("The image host is not configured for this store.", 400);
  }

  if (isIP(url.hostname)) throw new StoreClientError("Private image hosts are not allowed.", 400);
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((address) => isPrivateAddress(address.address))) {
    throw new StoreClientError("Private image hosts are not allowed.", 400);
  }
}

function isPrivateAddress(address: string): boolean {
  return /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|fc|fd|fe80)/i.test(address);
}

function parseProductPage(value: unknown): StoreProductPage {
  const record = readRecord(value);
  const productsValue = record.products;
  if (!Array.isArray(productsValue)) throw new StoreClientError("The store returned invalid products.", 502);

  const products = productsValue.map(parseProduct);
  return {
    products,
    nextCursor: record.nextCursor === null ? null : readString(record, "nextCursor"),
    total: readNumber(record, "total") ?? products.length,
  };
}

function parseProduct(value: unknown): StoreProduct {
  const record = readRecord(value);
  const status = readString(record, "status");
  if (status !== "active" && status !== "draft" && status !== "archived") {
    throw new StoreClientError("The store returned an invalid product status.", 502);
  }

  return {
    id: readRequiredString(record, "id"),
    name: readRequiredString(record, "name"),
    handle: readRequiredString(record, "handle"),
    status,
    imageUrl: record.imageUrl === null ? null : readString(record, "imageUrl"),
    imageUrls: readStringArray(record, "imageUrls"),
    sourceImageUrl: readString(record, "sourceImageUrl") ?? readString(record, "imageUrl"),
    imageVersion: readRequiredString(record, "imageVersion"),
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StoreClientError("The store returned invalid data.", 502);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!value) throw new StoreClientError(`The store response is missing ${key}.`, 502);
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] as number : null;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  return Array.isArray(record[key]) ? record[key].filter((item): item is string => typeof item === "string") : [];
}

function readError(value: unknown, fallback: string): string {
  try {
    const record = readRecord(value);
    return readString(record, "error") ?? readString(record, "message") ?? fallback;
  } catch {
    return fallback;
  }
}

export function isPermanentStoreClientError(error: unknown): error is StoreClientError {
  return error instanceof StoreClientError
    && [400, 401, 403, 404, 409, 413, 415, 422, 428].includes(error.status);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new StoreClientError(`${name} is not configured.`, 503);
  return value;
}

export class StoreClientError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "StoreClientError";
  }
}
