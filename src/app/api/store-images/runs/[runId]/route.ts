import { NextResponse } from "next/server";

import { getStoreBulkRun } from "@/features/store-images/server/runs";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { runId } = await context.params;
    const run = await getStoreBulkRun(runId);
    if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
    return NextResponse.json(run);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Run could not be loaded." }, { status: 500 });
  }
}
