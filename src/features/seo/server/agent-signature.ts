import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_CALLBACK_SKEW_SECONDS = 5 * 60;

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function signAgentPayload(rawBody: string, timestamp: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
}

export function verifyAgentCallbackSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowSeconds?: number;
}): boolean {
  if (!input.timestamp || !input.signature || !input.secret) return false;
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_CALLBACK_SKEW_SECONDS) return false;

  const expected = signAgentPayload(input.rawBody, input.timestamp, input.secret);
  const provided = input.signature.trim();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
