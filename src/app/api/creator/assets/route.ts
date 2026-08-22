import { NextResponse } from "next/server";

import { parseAssetKind, parseAssetName } from "@/features/creator/requests";
import { CreatorAuthorizationError, requireCreatorUser } from "@/features/creator/server/authorization";
import {
  CreatorServiceError,
  uploadCreatorAsset,
} from "@/features/creator/server/assets";
import type { CreatorAsset, CreatorResult } from "@/features/creator/types";

export async function POST(request: Request) {
  try {
    await requireCreatorUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Choose a JPEG, PNG, or WebP image.");
    }

    const asset = await uploadCreatorAsset({
      file,
      kind: parseAssetKind(formData.get("kind")),
      name: parseAssetName(formData.get("name") ?? file.name),
    });
    const result: CreatorResult<CreatorAsset> = { ok: true, data: asset };
    return NextResponse.json(result);
  } catch (error) {
    const result: CreatorResult<CreatorAsset> = {
      ok: false,
      message: error instanceof Error ? error.message : "The image could not be uploaded.",
      code: error instanceof CreatorAuthorizationError
        ? "unauthorized"
        : error instanceof CreatorServiceError
          ? error.code
          : "invalid_file",
    };
    return NextResponse.json(result, { status: result.code === "unauthorized" ? 401 : 400 });
  }
}
