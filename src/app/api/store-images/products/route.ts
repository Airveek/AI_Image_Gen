import { NextResponse } from "next/server";

import { requireCreatorUser } from "@/features/creator/server/authorization";
import { listStoreProducts, StoreClientError } from "@/features/store-images/server/store-client";

export async function GET(request: Request) {
  try {
    await requireCreatorUser();
    const url = new URL(request.url);
    const statusValue = url.searchParams.get("status");
    const status = statusValue === "active" || statusValue === "draft" || statusValue === "archived" ? statusValue : undefined;
    const result = await listStoreProducts({
      cursor: url.searchParams.get("cursor"),
      limit: Number.parseInt(url.searchParams.get("limit") ?? "40", 10),
      search: url.searchParams.get("search") ?? "",
      status,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof StoreClientError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Products could not be loaded." }, { status });
  }
}
