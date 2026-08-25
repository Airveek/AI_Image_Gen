"use client";

import Image from "next/image";
import { useState } from "react";
import { CircleAlert, Download, LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreatorImageViewer } from "@/features/creator/components/creator-image-viewer";
import type { CreatorAsset, CreatorPackShotState } from "@/features/creator/types";

export function CreatorPackProgress({
  shots,
  isGenerating,
  onRetry,
  retryDisabled,
}: {
  shots: CreatorPackShotState[];
  isGenerating: boolean;
  onRetry: (shot: CreatorPackShotState["recipe"]["shot"]) => void;
  retryDisabled: boolean;
}) {
  const [viewingAsset, setViewingAsset] = useState<CreatorAsset | null>(null);
  const readyCount = shots.filter((shot) => shot.status === "ready").length;
  const progressPercent = shots.length === 0 ? 0 : Math.round((readyCount / shots.length) * 100);

  return (
    <section className="relative w-full max-w-5xl" data-testid="photoshoot-results" aria-busy={isGenerating}>
      <div className="mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-brand-neon" aria-hidden="true" />
              <span>{isGenerating ? "Creating your 3-image photoshoot" : "Your photoshoot"}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {isGenerating ? "All three images are being created together." : "Each image is saved privately to your library."}
            </p>
          </div>
          <span
            className="shrink-0 text-sm font-semibold text-brand-soft"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="photoshoot-progress-status"
          >
            {readyCount} of {shots.length} ready
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Photoshoot progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-valuetext={`${readyCount} of ${shots.length} images ready`}
        >
          <div
            className="h-full rounded-full bg-brand-neon transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {shots.map((shot) => (
          <PhotoshootResultCard
            key={shot.recipe.shot}
            shot={shot}
            onRetry={() => onRetry(shot.recipe.shot)}
            onOpenImage={setViewingAsset}
            disabled={retryDisabled}
          />
        ))}
      </div>

      <CreatorImageViewer asset={viewingAsset} onClose={() => setViewingAsset(null)} />
    </section>
  );
}

function PhotoshootResultCard({ shot, onRetry, onOpenImage, disabled }: {
  shot: CreatorPackShotState;
  onRetry: () => void;
  onOpenImage: (asset: CreatorAsset) => void;
  disabled: boolean;
}) {
  const isCreating = shot.status === "pending" || shot.status === "generating";
  const readyImage = shot.status === "ready" && shot.asset?.imageUrl
    ? { asset: shot.asset, imageUrl: shot.asset.imageUrl }
    : null;

  return (
    <article className="overflow-hidden rounded-xl border border-white/12 bg-[#1a1c1a]" data-testid={`photoshoot-shot-${shot.recipe.shot}`}>
      {readyImage ? (
        <div className="group relative aspect-square bg-black/20">
          <button
            type="button"
            className="absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-neon"
            onClick={() => onOpenImage(readyImage.asset)}
            aria-label={`Open ${shot.recipe.label} image`}
          >
            <Image src={readyImage.imageUrl} alt={shot.recipe.label} fill unoptimized className="object-contain transition-transform duration-300 group-hover:scale-[1.01]" sizes="(max-width: 640px) 100vw, 30vw" />
          </button>
          <a
            href={`${readyImage.imageUrl}?download=1`}
            download
            onClick={(event) => event.stopPropagation()}
            className="absolute right-3 top-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-neon group-hover:opacity-100"
            aria-label={`Download ${shot.recipe.label} image`}
          >
            <Download className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <>
          <div className="relative aspect-square bg-black/20">
            {isCreating ? (
              <div className="relative flex h-full flex-col items-center justify-center gap-3 overflow-hidden px-4 text-center text-sm text-muted">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-neon/[0.08] via-transparent to-white/[0.04] motion-safe:animate-pulse" aria-hidden="true" />
                <LoaderCircle className="relative h-7 w-7 text-brand-neon motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" />
                <span className="relative">Creating {shot.recipe.label.toLowerCase()}…</span>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-red-200">
                <CircleAlert className="h-6 w-6" aria-hidden="true" />
                <span>Could not create this shot</span>
              </div>
            )}
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">{shot.recipe.label}</h3>
              <span className="text-right text-xs text-muted">{shot.recipe.purpose}</span>
            </div>
            {shot.status === "failed" ? (
              <div className="space-y-2">
                <p className="line-clamp-2 text-xs text-red-200">{shot.error ?? "This shot could not be created."}</p>
                <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={onRetry} disabled={disabled}>Retry</Button>
              </div>
            ) : (
              <p className="text-xs text-muted">{isCreating ? "Working on this image now…" : "Waiting"}</p>
            )}
          </div>
        </>
      )}
    </article>
  );
}
