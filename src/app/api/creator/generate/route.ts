import { NextResponse } from "next/server";

import { parseGenerationRequest } from "@/features/creator/requests";
import { CreatorAuthorizationError, requireCreatorUser } from "@/features/creator/server/authorization";
import { generateCreatorImage } from "@/features/creator/server/generation";
import type { CreatorResult, CreatorAsset } from "@/features/creator/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireCreatorUser();
    const body: unknown = await request.json();
    const generationRequest = parseGenerationRequest(body);
    const result = await generateCreatorImage(generationRequest);
    return NextResponse.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
  } catch (error) {
    const result: CreatorResult<CreatorAsset> = {
      ok: false,
      message: error instanceof Error ? error.message : "Check the creation details and try again.",
      code: error instanceof CreatorAuthorizationError ? "unauthorized" : "invalid_request",
    };
    return NextResponse.json(result, { status: result.code === "unauthorized" ? 401 : 400 });
  }
}

function statusForCode(code: string): number {
  if (code === "unauthorized") return 401;
  if (code === "daily_limit" || code === "generation_in_progress") return 429;
  if (code === "provider_rate_limited") return 429;
  if (code === "invalid_request" || code === "invalid_file") return 400;
  if (code === "provider_not_configured" || code === "storage_not_configured") return 503;
  return 502;
}
