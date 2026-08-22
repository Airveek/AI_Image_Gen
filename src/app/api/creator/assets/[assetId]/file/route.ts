import { NextResponse } from "next/server";

import { getOwnedAssetDelivery } from "@/features/creator/server/assets";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const delivery = await getOwnedAssetDelivery(assetId);
    const download = new URL(request.url).searchParams.get("download") === "1";

    if (delivery.kind === "redirect" && !download) {
      const response = NextResponse.redirect(delivery.url, 307);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const bytes = delivery.kind === "bytes"
      ? delivery.bytes
      : await fetch(delivery.url, { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("The temporary image copy is unavailable.");
          return new Uint8Array(await response.arrayBuffer());
        });
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": delivery.mimeType,
        "Content-Disposition": download ? `attachment; filename="airveek-${assetId}"` : "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ message: "Image not found." }, { status: 404 });
  }
}
