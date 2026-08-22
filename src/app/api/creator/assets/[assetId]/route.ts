import { NextResponse } from "next/server";

import { CreatorAuthorizationError, requireCreatorUser } from "@/features/creator/server/authorization";
import {
  CreatorServiceError,
  deleteCreatorAsset,
  renameCreatorAsset,
} from "@/features/creator/server/assets";
import type { CreatorAsset, CreatorResult } from "@/features/creator/types";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireCreatorUser();
    const { assetId } = await context.params;
    const body: unknown = await request.json();
    const name = readName(body);
    const asset = await renameCreatorAsset(assetId, name);
    const result: CreatorResult<CreatorAsset> = { ok: true, data: asset };
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse<CreatorAsset>(error, "The image could not be renamed.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireCreatorUser();
    const { assetId } = await context.params;
    await deleteCreatorAsset(assetId);
    const result: CreatorResult<{ id: string }> = { ok: true, data: { id: assetId } };
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse<{ id: string }>(error, "The image could not be deleted.");
  }
}

function readName(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Enter a valid name.");
  }
  const name = (value as Record<string, unknown>).name;
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Enter a valid name.");
  }
  return name;
}

function errorResponse<T>(error: unknown, fallback: string) {
  const code = error instanceof CreatorAuthorizationError
    ? "unauthorized"
    : error instanceof CreatorServiceError
      ? error.code
      : "unknown";
  const result: CreatorResult<T> = {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
    code,
  };
  return NextResponse.json(result, { status: code === "unauthorized" ? 401 : code === "not_found" ? 404 : 400 });
}
