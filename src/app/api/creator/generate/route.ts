import { NextResponse } from "next/server";

import { parseGenerationRequest } from "@/features/creator/requests";
import { CreatorAuthorizationError, requireCreatorUser } from "@/features/creator/server/authorization";
import { generateCreatorImage } from "@/features/creator/server/generation";
import type { CreatorGenerationResult } from "@/features/creator/types";
import { readAnalyticsConsent, recordServerFunnelEvent } from "@/lib/analytics/meta-server";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireCreatorUser();
    const body: unknown = await request.json();
    const generationRequest = parseGenerationRequest(body);
    const result = await generateCreatorImage(generationRequest);
    if (result.ok) {
      const consentGranted = readAnalyticsConsent(request.headers.get("cookie"));
      const sourceUrl = request.headers.get("referer") ?? request.url;
      await recordServerFunnelEvent({
        eventName: "GenerationSucceeded",
        eventId: result.trackingEventId,
        sourceUrl,
        properties: {
          arena_id: generationRequest.arenaId,
          content_name: generationRequest.arenaId === "product-fashion" ? "AI Fashion Photoshoot" : "Airveek generation",
          content_category: "creator_output",
          remaining_credits: result.access.remaining,
        },
        userId: user.id,
        email: user.email,
        request,
        consentGranted,
      }).catch(() => undefined);
      if (!result.access.hasPaidAccess) {
        await recordServerFunnelEvent({
          eventName: "FreeGenerationUsed",
          eventId: crypto.randomUUID(),
          sourceUrl,
          properties: { arena_id: generationRequest.arenaId, remaining_credits: result.access.remaining },
          userId: user.id,
          email: user.email,
          request,
          consentGranted,
        }).catch(() => undefined);
      }
    }
    return NextResponse.json(result, { status: result.ok ? 200 : statusForCode(result.code) });
  } catch (error) {
    const result: CreatorGenerationResult = {
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
  if (code === "payment_required") return 402;
  if (code === "provider_rate_limited") return 429;
  if (code === "invalid_request" || code === "invalid_file") return 400;
  if (
    code === "provider_not_configured" ||
    code === "provider_unavailable" ||
    code === "storage_not_configured"
  ) {
    return 503;
  }
  return 502;
}
