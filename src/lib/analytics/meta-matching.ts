import { createHash } from "node:crypto";

export function normalizeAndHashMetaIdentifier(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? createHash("sha256").update(normalized).digest("hex") : null;
}
