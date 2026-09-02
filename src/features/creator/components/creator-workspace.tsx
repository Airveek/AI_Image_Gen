"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Download, ImagePlus, LoaderCircle, PanelRightOpen, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  CreatorAssetPicker,
  defaultRoleForAsset,
  referenceRoleLabel,
} from "@/features/creator/components/creator-asset-picker";
import { CreatorComposer } from "@/features/creator/components/creator-composer";
import { CreatorBatchProgress } from "@/features/creator/components/creator-batch-progress";
import { CreatorImageViewer } from "@/features/creator/components/creator-image-viewer";
import {
  creatorCatalog,
  getCategoryLabel,
  getCreatorArena,
  referenceRolesForArena,
} from "@/features/creator/catalog";
import type {
  CreatorArenaId,
  CreatorAsset,
  CreatorAssetKind,
  CreatorBatchItem,
  CreatorBatchStatus,
  CreatorResult,
  GenerationReference,
  GenerationCount,
  GenerationRequest,
  ImageAspectRatio,
  LightingOption,
  ProductCampaignGoal,
  ReferenceRole,
} from "@/features/creator/types";
import { studioRecipeIdForScene } from "@/features/creator/quality";
import { cn } from "@/lib/utils";
import { trackGa4Event } from "@/lib/analytics/browser";

type AssetResult = CreatorResult<CreatorAsset>;
type UploadKind = Exclude<CreatorAssetKind, "generation">;

export function CreatorWorkspace({ arenaId, initialAssets, storageMessage }: {
  arenaId: CreatorArenaId;
  initialAssets: CreatorAsset[];
  storageMessage: string | null;
}) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const arena = getCreatorArena(arenaId);
  const [assets, setAssets] = useState(initialAssets);
  const [references, setReferences] = useState<GenerationReference[]>(() => {
    const reusedAssetId = searchParams.get("asset");
    const reusedAsset = initialAssets.find((asset) => asset.id === reusedAssetId && asset.status === "ready");
    return reusedAsset ? [{ assetId: reusedAsset.id, role: defaultRoleForAsset(reusedAsset) }] : [];
  });
  const [viewingAsset, setViewingAsset] = useState<CreatorAsset | null>(null);
  const [message, setMessage] = useState(storageMessage ?? "");
  const [generationCount, setGenerationCount] = useState<GenerationCount>(2);
  const [batchStatus, setBatchStatus] = useState<CreatorBatchStatus>("idle");
  const [batchItems, setBatchItems] = useState<CreatorBatchItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [arenaDialogOpen, setArenaDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [preferredRole, setPreferredRole] = useState<ReferenceRole | null>(null);
  const [arenaSearch, setArenaSearch] = useState("");

  const [subject, setSubject] = useState("");
  const [exactText, setExactText] = useState("");
  const [style, setStyle] = useState("premium editorial photography");
  const [mode, setMode] = useState<"product-scene" | "on-model" | "influencer-lifestyle">("product-scene");
  const [scene, setScene] = useState<"studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom">("studio");
  const [campaignGoal, setCampaignGoal] = useState<ProductCampaignGoal>("store-listing");
  const [backgroundMood, setBackgroundMood] = useState("");
  const [characterDescription, setCharacterDescription] = useState("");
  const [storyScene, setStoryScene] = useState("");
  const [artStyle, setArtStyle] = useState<"cartoon" | "watercolor" | "3d-storybook" | "custom">("cartoon");
  const [pageText, setPageText] = useState("");
  const [lighting, setLighting] = useState<LightingOption>("auto");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(arenaId === "storybook-page" ? "4:5" : "1:1");
  const [extraDirection, setExtraDirection] = useState("");
  const [sketchPrompt, setSketchPrompt] = useState("");

  useEffect(() => {
    workspaceRef.current?.setAttribute("data-ready", "true");
  }, []);

  const selectedReferences = useMemo(() => references.flatMap((reference) => {
    const asset = assets.find((item) => item.id === reference.assetId);
    return asset ? [{ ...reference, asset }] : [];
  }), [assets, references]);

  if (!arena) return null;

  const mainText = arenaId === "general-image" ? subject : arenaId === "product-fashion" ? extraDirection : arenaId === "storybook-page" ? storyScene : sketchPrompt;
  const isGenerating = batchStatus === "generating";
  const isBusy = isGenerating;
  const singleReadyResult = batchItems.length === 1 && batchItems[0]?.status === "ready" && batchItems[0].asset?.imageUrl
    ? { asset: batchItems[0].asset, imageUrl: batchItems[0].asset.imageUrl }
    : null;

  function setMainText(value: string) {
    if (arenaId === "general-image") setSubject(value);
    else if (arenaId === "product-fashion") setExtraDirection(value);
    else if (arenaId === "storybook-page") setStoryScene(value);
    else if (arenaId === "image-to-sketch") setSketchPrompt(value);
  }

  async function handleGenerate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isBusy || !validateForGeneration()) return;
    const request = buildRequest();
    trackGa4Event("generation_requested", { arena_id: arenaId, reference_count: request.references.length, generation_count: generationCount });
    const items = createBatchItems(request, generationCount);
    setBatchItems(items);
    setBatchStatus("generating");
    setMessage(arenaId === "image-to-sketch" ? `Airveek is cleaning ${generationCount === 1 ? "your sketch" : `${generationCount} versions of your sketch`}…` : `Airveek is creating ${generationCount} image${generationCount === 1 ? "" : "s"}…`);

    const jobs = items.map(async (item): Promise<AssetResult> => {
      const parsed = await requestGeneration(item.request);
      if (!parsed.ok) {
        updateBatchItem(item.index, { status: "failed", error: parsed.message });
        return parsed;
      }
      addGeneratedAsset(parsed.data);
      updateBatchItem(item.index, { status: "ready", asset: parsed.data, error: null });
      return parsed;
    });
    const settled = await Promise.allSettled(jobs);
    settled.forEach((outcome, index) => {
      if (outcome.status === "rejected") {
        const reason = outcome.reason instanceof Error ? outcome.reason.message : "The image request failed. Please try again.";
        updateBatchItem(items[index].index, { status: "failed", error: reason });
      }
    });
    const hasFailure = settled.some((outcome) => outcome.status === "rejected" || (outcome.status === "fulfilled" && !outcome.value.ok));
    const hasSuccess = settled.some((outcome) => outcome.status === "fulfilled" && outcome.value.ok);
    if (hasSuccess && typeof window !== "undefined" && !window.sessionStorage.getItem("airveek_first_generation_tracked")) {
      window.sessionStorage.setItem("airveek_first_generation_tracked", "1");
      trackGa4Event("first_generation", { arena_id: arenaId, reference_count: request.references.length });
    }
    setBatchStatus(hasFailure ? "completed-with-errors" : "completed");
    setMessage(hasFailure ? "Some images are ready. Retry any failed image below." : `${generationCount === 1 ? "Your image is" : "Your images are"} ready and saved to the library.`);
    router.refresh();
  }

  async function handleRetryBatchItem(index: number) {
    if (isBusy) return;
    const item = batchItems.find((candidate) => candidate.index === index);
    if (!item) return;
    updateBatchItem(index, { status: "generating", error: null });
    setBatchStatus("generating");
    setMessage(`Retrying image ${index}…`);
    const parsed = await requestGeneration(item.request);
    if (!parsed.ok) {
      updateBatchItem(index, { status: "failed", error: parsed.message });
      setBatchStatus("completed-with-errors");
      setMessage(`Image ${index} still needs attention. You can retry it again.`);
      return;
    }
    addGeneratedAsset(parsed.data);
    updateBatchItem(index, { status: "ready", asset: parsed.data, error: null });
    const hasOtherFailures = batchItems.some((candidate) => candidate.index !== index && candidate.status === "failed");
    setBatchStatus(hasOtherFailures ? "completed-with-errors" : "completed");
    setMessage(hasOtherFailures ? `Image ${index} is ready. Another image still needs attention.` : "All images are ready and saved to the library.");
    router.refresh();
  }

  async function requestGeneration(request: GenerationRequest): Promise<AssetResult> {
    try {
      const response = await fetch("/api/creator/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload: unknown = await response.json();
      return readAssetResult(payload);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "The request failed. Please try again.", code: "unknown" };
    }
  }

  function addGeneratedAsset(asset: CreatorAsset) {
    setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
  }

  function updateBatchItem(index: number, update: Partial<CreatorBatchItem>) {
    setBatchItems((current) => current.map((item) => item.index === index ? { ...item, ...update } : item));
  }

  function validateForGeneration(): boolean {
    if (arenaId === "general-image" && !subject.trim()) {
      setMessage("Describe the image you want to create.");
      return false;
    }
    if (arenaId === "product-fashion" && !references.some((reference) => reference.role === "product")) {
      setMessage("Add one Product image before generating.");
      return false;
    }
    if (arenaId === "storybook-page" && !storyScene.trim()) {
      setMessage("Describe what happens on this storybook page.");
      return false;
    }
    if (arenaId === "storybook-page" && !characterDescription.trim() && !references.some((reference) => reference.role === "character")) {
      setMessage("Add a Character image or describe the main character in Optional details.");
      return false;
    }
    if (arenaId === "image-to-sketch" && references.length === 0) {
      setMessage("Upload one sketch or garment image before generating.");
      return false;
    }
    return true;
  }

  function buildRequest(): GenerationRequest {
    if (arenaId === "product-fashion") {
      return { arenaId, mode, scene, campaignGoal, studioRecipeId: studioRecipeIdForScene(scene), backgroundMood, lighting, aspectRatio, extraDirection, references };
    }
    if (arenaId === "image-to-sketch") {
      return { arenaId, aspectRatio: "1:1", prompt: sketchPrompt, references };
    }
    if (arenaId === "storybook-page") {
      return { arenaId, characterDescription, scene: storyScene, artStyle, pageText, lighting, aspectRatio, extraDirection: "", references };
    }
    return { arenaId, outputType: "image", subject, exactText, style, lighting, aspectRatio, extraDirection: "", references };
  }

  function toggleReference(asset: CreatorAsset, role: ReferenceRole) {
    setReferences((current) => {
      const existing = current.find((reference) => reference.assetId === asset.id);
      if (existing?.role === role) {
        setMessage("");
        return current.filter((reference) => reference.assetId !== asset.id);
      }
      if (existing) {
        setMessage(`${asset.name} is now used as ${referenceRoleLabel(role)}.`);
        return current.map((reference) => reference.assetId === asset.id ? { ...reference, role } : reference);
      }
      if (current.length >= 2) {
        setMessage("Choose no more than two references for one generation.");
        return current;
      }
      setMessage(`${asset.name} added as ${referenceRoleLabel(role)}.`);
      return [...current, { assetId: asset.id, role }];
    });
  }

  function removeReference(assetId: string) {
    setReferences((current) => current.filter((reference) => reference.assetId !== assetId));
    setMessage("");
  }

  function changeReferenceRole(assetId: string, role: ReferenceRole) {
    setReferences((current) => current.map((reference) => reference.assetId === assetId ? { ...reference, role } : reference));
    setMessage(`Image role changed to ${referenceRoleLabel(role)}.`);
  }

  function openAssets(role: ReferenceRole) {
    setPreferredRole(role);
    setAssetDialogOpen(true);
  }

  async function handleUpload(file: File, kind: UploadKind, role: ReferenceRole) {
    if (references.length >= 2) {
      setMessage("Remove one selected reference before uploading another.");
      return;
    }
    setIsUploading(true);
    setMessage("Saving your reference privately…");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      formData.set("name", file.name.replace(/\.[^.]+$/, ""));
      const response = await fetch("/api/creator/assets", { method: "POST", body: formData });
      const payload: unknown = await response.json();
      const parsed = readAssetResult(payload);
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      setAssets((current) => [parsed.data, ...current]);
      setReferences((current) => [...current, { assetId: parsed.data.id, role }]);
      setMessage(`${parsed.data.name} saved and selected as ${referenceRoleLabel(role)}.`);
      setAssetDialogOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The reference could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div ref={workspaceRef} className="min-h-[calc(100dvh-4rem)] bg-media-stage lg:h-[calc(100dvh-4rem)] lg:overflow-hidden" data-testid="creator-workspace" data-ready="false">
      <h1 className="sr-only">Create {arena.title}</h1>
      <form onSubmit={handleGenerate} className="lg:h-full lg:overflow-hidden">
        <div className="grid min-h-[calc(100dvh-4rem)] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex min-h-[680px] min-w-0 flex-col bg-media-stage lg:min-h-0" aria-label="Create image workspace">
            <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-8 lg:min-h-0" data-testid="generation-result">
              <Button className="absolute right-4 top-4 z-10 lg:hidden" type="button" variant="secondary" onClick={() => { setPreferredRole(null); setAssetDialogOpen(true); }} data-testid="open-assets-button">
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" /> Assets
              </Button>
              <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(131,255,0,0.08),transparent_38%)]" aria-hidden="true" />
              {batchItems.length > 1 || (batchItems.length === 1 && batchItems[0]?.status === "failed") ? (
                <CreatorBatchProgress items={batchItems} isGenerating={isGenerating} onRetry={(index) => void handleRetryBatchItem(index)} retryDisabled={isBusy} onOpenImage={setViewingAsset} />
              ) : isGenerating ? (
                <div className="relative max-w-sm text-center" data-testid="generation-loading">
                  <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-brand-neon" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-2xl font-bold">Creating your image</h2>
                  <p className="mt-2 text-base leading-6 text-muted">This can take a minute. Keep this page open.</p>
                </div>
              ) : singleReadyResult ? (
                <div className="group relative h-full min-h-[420px] w-full">
                  <button
                    type="button"
                    className="absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus"
                    onClick={() => setViewingAsset(singleReadyResult.asset)}
                    aria-label={`Open ${singleReadyResult.asset.name}`}
                    data-testid="generation-result-image"
                  >
                    <Image src={singleReadyResult.imageUrl} alt={singleReadyResult.asset.name} fill unoptimized className="object-contain transition-transform duration-300 group-hover:scale-[1.01]" sizes="(max-width: 1024px) 100vw, calc(100vw - 280px)" priority />
                  </button>
                  <a
                    href={`${singleReadyResult.imageUrl}?download=1`}
                    download
                    onClick={(event) => event.stopPropagation()}
                    className="absolute right-3 top-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus group-hover:opacity-100"
                    aria-label="Download generated image"
                  >
                    <Download className="h-5 w-5" aria-hidden="true" />
                  </a>
                </div>
              ) : (
                <div className="relative max-w-md text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-brand-neon"><ImagePlus className="h-8 w-8" aria-hidden="true" /></span>
                  <h2 className="mt-4 font-display text-2xl font-bold">{arenaId === "image-to-sketch" ? "Your clean sketch appears here" : "Make your first generation"}</h2>
                  <p className="mt-2 text-base leading-6 text-muted">{arenaId === "image-to-sketch" ? "Upload a sketch or garment image. Airveek will clean the lines and keep the design details." : "Describe your idea, choose simple options, and Airveek handles the detailed prompt."}</p>
                </div>
              )}
            </div>

            <div className="shrink-0 px-3 pb-3 sm:px-5 sm:pb-4">
              <CreatorComposer
                arenaId={arenaId}
                selectedReferences={selectedReferences}
                mainText={mainText}
                onMainTextChange={setMainText}
                exactText={exactText}
                onExactTextChange={setExactText}
                style={style}
                onStyleChange={setStyle}
                mode={mode}
                onModeChange={setMode}
                scene={scene}
                onSceneChange={setScene}
                campaignGoal={campaignGoal}
                onCampaignGoalChange={setCampaignGoal}
                backgroundMood={backgroundMood}
                onBackgroundMoodChange={setBackgroundMood}
                characterDescription={characterDescription}
                onCharacterDescriptionChange={setCharacterDescription}
                artStyle={artStyle}
                onArtStyleChange={setArtStyle}
                pageText={pageText}
                onPageTextChange={setPageText}
                lighting={lighting}
                onLightingChange={setLighting}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                onOpenArena={() => setArenaDialogOpen(true)}
                onOpenAssets={openAssets}
                onRemoveReference={removeReference}
                onChangeReferenceRole={changeReferenceRole}
                isGenerating={isGenerating}
                generationCount={generationCount}
                onGenerationCountChange={setGenerationCount}
                generationDisabled={Boolean(storageMessage)}
              />
              <div className="mx-auto mt-2 min-h-5 max-w-[900px] text-center text-sm text-muted" aria-live="polite" aria-atomic="true">{message}</div>
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-border bg-surface-raised lg:block">
            <CreatorAssetPicker assets={assets} references={references} onToggle={toggleReference} onUpload={handleUpload} isUploading={isUploading} allowedReferenceRoles={referenceRolesForArena(arenaId)} defaultUploadRole={defaultUploadRole(arenaId)} helperText={arenaId === "image-to-sketch" ? "One image is enough. Add a second zoomed detail when useful." : undefined} uploadInputTestId="asset-upload-input" presentation="kive" />
          </aside>
        </div>
      </form>

      <CreatorImageViewer asset={viewingAsset} onClose={() => setViewingAsset(null)} />

      <Dialog open={arenaDialogOpen} onOpenChange={setArenaDialogOpen} title="Choose what to create" description="Your saved assets remain available in every tool.">
        <label className="sr-only" htmlFor="arena-search">Search creation tools</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="arena-search" type="search" value={arenaSearch} onChange={(event) => setArenaSearch(event.target.value)} placeholder="Search all 21 tools" className="min-h-12 w-full rounded-xl border border-border bg-surface-muted pl-10 pr-3 text-base text-foreground placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none" />
        </div>
        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {creatorCatalog.filter((item) => `${item.title} ${item.description} ${getCategoryLabel(item.categoryId)}`.toLowerCase().includes(arenaSearch.trim().toLowerCase())).map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-brand-neon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted">{getCategoryLabel(item.categoryId)} · {item.availability === "available" ? "Available" : "Coming next"}</span></span>
                {item.arenaId === arenaId ? <Check className="h-4 w-4 text-brand-neon" aria-label="Current tool" /> : item.arenaId ? <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" /> : null}
              </>
            );
            return item.arenaId ? (
              <Link key={item.id} href={`/create/${item.id}`} onClick={() => setArenaDialogOpen(false)} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 transition-colors", item.id === arenaId ? "border-brand-neon/40 bg-brand-neon/10" : "border-border hover:bg-surface-muted")}>{content}</Link>
            ) : (
              <div key={item.id} aria-disabled="true" className="flex min-h-16 items-center gap-3 rounded-xl border border-border p-3 opacity-55">{content}</div>
            );
          })}
        </div>
      </Dialog>

      <Dialog
        open={assetDialogOpen}
        onOpenChange={(open) => {
          setAssetDialogOpen(open);
          if (!open) setPreferredRole(null);
        }}
        title={arenaId === "image-to-sketch" ? "Add sketch image" : preferredRole ? `Choose a ${referenceRoleLabel(preferredRole)}` : "Your assets"}
        description={arenaId === "image-to-sketch" ? "One image is enough. Add a second zoomed detail when useful." : preferredRole ? `Select a saved image or upload a new ${referenceRoleLabel(preferredRole).toLowerCase()} image.` : "Choose up to two reference images."}
      >
        <div className="max-h-[65vh] overflow-y-auto">
          <CreatorAssetPicker
            assets={assets}
            references={references}
            onToggle={(asset, role) => {
              toggleReference(asset, role);
              setAssetDialogOpen(false);
            }}
            onUpload={handleUpload}
            isUploading={isUploading}
            preferredRole={preferredRole}
            allowedReferenceRoles={referenceRolesForArena(arenaId)}
            helperText={arenaId === "image-to-sketch" ? "One image is enough. Add a second zoomed detail when useful." : undefined}
            compact
            presentation="kive"
          />
        </div>
      </Dialog>
    </div>
  );
}

function readAssetResult(value: unknown): AssetResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, message: "The server returned an invalid response.", code: "unknown" };
  }
  const record = value as Record<string, unknown>;
  if (record.ok === false && typeof record.message === "string" && typeof record.code === "string") {
    return record as Extract<AssetResult, { ok: false }>;
  }
  if (record.ok === true && typeof record.data === "object" && record.data !== null) {
    const data = record.data as Record<string, unknown>;
    if (typeof data.id === "string" && typeof data.name === "string" && typeof data.status === "string") {
      return { ok: true, data: data as CreatorAsset };
    }
  }
  return { ok: false, message: "The server returned an invalid response.", code: "unknown" };
}

function createBatchItems(request: GenerationRequest, count: GenerationCount): CreatorBatchItem[] {
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    request,
    status: "generating" as const,
    asset: null,
    error: null,
  }));
}

function defaultUploadRole(arenaId: CreatorArenaId): ReferenceRole {
  if (arenaId === "product-fashion") return "product";
  if (arenaId === "storybook-page") return "character";
  return "reference";
}
