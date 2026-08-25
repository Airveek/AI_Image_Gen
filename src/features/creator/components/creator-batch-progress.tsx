"use client";

import Image from "next/image";
import { CircleAlert, Download, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CreatorAsset, CreatorBatchItem } from "@/features/creator/types";

export function CreatorBatchProgress({
  items,
  isGenerating,
  onRetry,
  retryDisabled,
  onOpenImage,
}: {
  items: CreatorBatchItem[];
  isGenerating: boolean;
  onRetry: (index: number) => void;
  retryDisabled: boolean;
  onOpenImage: (asset: CreatorAsset) => void;
}) {
  const readyCount = items.filter((item) => item.status === "ready" && item.asset?.imageUrl).length;
  const progress = items.length === 0 ? 0 : Math.round((readyCount / items.length) * 100);

  return (
    <section className="relative w-full max-w-5xl" data-testid="generation-batch-results" aria-busy={isGenerating}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-brand-neon"><Sparkles className="h-4 w-4" aria-hidden="true" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Image results</span></div>
          <h2 className="mt-2 font-display text-2xl font-bold text-white">{isGenerating ? `Creating ${items.length} images` : "Your images"}</h2>
          <p className="mt-1 text-sm text-muted">Each image uses the same prompt, references, and settings.</p>
        </div>
        <span className="text-sm font-semibold text-brand-soft" data-testid="generation-progress-status" role="status" aria-live="polite">{readyCount} of {items.length} images ready</span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Image generation progress" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={readyCount}>
        <div className="h-full rounded-full bg-brand-neon transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <BatchResultCard key={item.index} item={item} onRetry={onRetry} retryDisabled={retryDisabled} onOpenImage={onOpenImage} />)}
      </div>
    </section>
  );
}

function BatchResultCard({ item, onRetry, retryDisabled, onOpenImage }: {
  item: CreatorBatchItem;
  onRetry: (index: number) => void;
  retryDisabled: boolean;
  onOpenImage: (asset: CreatorAsset) => void;
}) {
  const readyImage = item.status === "ready" && item.asset?.imageUrl ? { asset: item.asset, imageUrl: item.asset.imageUrl } : null;
  const isCreating = item.status === "generating";

  return (
    <article className="overflow-hidden rounded-xl border border-white/12 bg-[#1a1c1a]" data-testid={`generation-item-${item.index}`}>
      <div className="relative aspect-square bg-black/20">
        {readyImage ? (
          <>
            <button type="button" className="group absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-neon" onClick={() => onOpenImage(readyImage.asset)} aria-label={`Open Image ${item.index}`}>
              <Image src={readyImage.imageUrl} alt={`Generated image ${item.index}`} fill unoptimized className="object-contain transition-transform duration-300 group-hover:scale-[1.01] motion-reduce:transition-none" sizes="(max-width: 640px) 100vw, 33vw" />
            </button>
            <a href={`${readyImage.imageUrl}?download=1`} download onClick={(event) => event.stopPropagation()} className="absolute right-2 top-2 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon group-hover:opacity-100 motion-reduce:transition-none" aria-label={`Download Image ${item.index}`}>
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
          </>
        ) : isCreating ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted"><LoaderCircle className="h-7 w-7 animate-spin text-brand-neon motion-reduce:animate-none" aria-hidden="true" /><span>Creating image {item.index}…</span></div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-red-100"><CircleAlert className="h-7 w-7 text-red-300" aria-hidden="true" /><span>Image {item.index} could not be created.</span></div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0"><h3 className="text-sm font-semibold text-white">Image {item.index}</h3>{readyImage ? <p className="mt-1 text-xs text-brand-soft">Saved to your library</p> : item.error ? <p className="mt-1 line-clamp-2 text-xs text-red-200">{item.error}</p> : null}</div>
        {item.status === "failed" ? <Button type="button" variant="secondary" onClick={() => onRetry(item.index)} disabled={retryDisabled}>Retry</Button> : null}
      </div>
    </article>
  );
}
