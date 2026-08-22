import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { AllowedImageMimeType } from "@/features/creator/types";

const HOT_STORAGE_MS = 24 * 60 * 60 * 1000;

export type R2Status = {
  configured: boolean;
  healthy: boolean;
  bucket: string | null;
  retentionHours: 24;
  message: string;
};

export async function getR2Status(): Promise<R2Status> {
  const configured = isR2Configured();
  if (!configured) {
    return { configured: false, healthy: false, bucket: process.env.R2_BUCKET ?? null, retentionHours: 24, message: "R2 environment variables are not configured." };
  }

  try {
    await createR2Client().send(new HeadBucketCommand({ Bucket: requiredEnvironment("R2_BUCKET") }));
    return { configured: true, healthy: true, bucket: process.env.R2_BUCKET ?? null, retentionHours: 24, message: "The private bucket is reachable." };
  } catch {
    return { configured: true, healthy: false, bucket: process.env.R2_BUCKET ?? null, retentionHours: 24, message: "R2 credentials are set, but the bucket health check failed." };
  }
}

export async function uploadHotAsset(input: {
  userId: string;
  assetId: string;
  bytes: Uint8Array;
  mimeType: AllowedImageMimeType;
}): Promise<{ key: string; expiresAt: string } | null> {
  if (!isR2Configured()) {
    return null;
  }

  const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType.split("/")[1];
  const key = `hot/${input.userId}/${input.assetId}.${extension}`;
  const client = createR2Client();
  await client.send(new PutObjectCommand({
    Bucket: requiredEnvironment("R2_BUCKET"),
    Key: key,
    Body: input.bytes,
    ContentType: input.mimeType,
    CacheControl: "private, max-age=300",
  }));

  return {
    key,
    expiresAt: new Date(Date.now() + HOT_STORAGE_MS).toISOString(),
  };
}

export async function createHotAssetUrl(key: string): Promise<string> {
  return getSignedUrl(
    createR2Client(),
    new GetObjectCommand({ Bucket: requiredEnvironment("R2_BUCKET"), Key: key }),
    { expiresIn: 300 },
  );
}

export async function deleteHotAsset(key: string): Promise<void> {
  if (!isR2Configured()) {
    throw new Error("R2 credentials are required to remove this asset's hot copy.");
  }

  await createR2Client().send(new DeleteObjectCommand({
    Bucket: requiredEnvironment("R2_BUCKET"),
    Key: key,
  }));
}

function createR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnvironment("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnvironment("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironment("R2_SECRET_ACCESS_KEY"),
    },
  });
}

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
