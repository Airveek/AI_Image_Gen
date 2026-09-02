"use client";

import Image from "next/image";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { CreatorAsset } from "@/features/creator/types";

type ViewerAsset = Pick<CreatorAsset, "name" | "imageUrl">;

export function CreatorImageViewer({
  asset,
  onClose,
}: {
  asset: ViewerAsset | null;
  onClose: () => void;
}) {
  const imageUrl = asset?.imageUrl;

  return (
    <Dialog
      open={Boolean(imageUrl)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={asset?.name ?? "Image"}
      className="w-[min(96vw,72rem)]"
    >
      {asset && imageUrl ? (
        <div>
          <div className="relative h-[min(70vh,42rem)] w-full overflow-hidden rounded-xl bg-media-stage">
            <Image
              src={imageUrl}
              alt={asset.name}
              fill
              unoptimized
              className="object-contain"
              sizes="(max-width: 1024px) 96vw, 72rem"
              priority
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <a
              href={`${imageUrl}?download=1`}
              download
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </a>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
