import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CreatorIdentity } from "@/features/creator/types";

type Metadata = Record<string, unknown>;

export class CreatorAuthorizationError extends Error {
  constructor(message = "Please sign in to continue creating.") {
    super(message);
    this.name = "CreatorAuthorizationError";
  }
}

export async function requireCreatorUser(): Promise<CreatorIdentity> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new CreatorAuthorizationError();
  }

  const metadata = toMetadata(data.user.user_metadata);
  const displayName =
    readString(metadata, "name") ??
    readString(metadata, "display_name") ??
    data.user.email?.split("@")[0] ??
    "Creator";

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    displayName,
  };
}

function toMetadata(value: unknown): Metadata {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Metadata)
    : {};
}

function readString(metadata: Metadata, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

