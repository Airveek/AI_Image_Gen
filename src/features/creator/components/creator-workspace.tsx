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
import {
  creatorCatalog,
  getCategoryLabel,
  getCreatorArena,
  productPhotoshootRecipes,
  referenceRolesForArena,
} from "@/features/creator/catalog";
import type {
  CreatorArenaId,
  CreatorAsset,
  CreatorAssetKind,
  CreatorPackShotState,
  CreatorPackStatus,
  CreatorResult,
  GenerationReference,
  GenerationRequest,
  ImageAspectRatio,
  LightingOption,
  ProductCampaignGoal,
  ProductPhotoshootRecipe,
  ProductPhotoshootShot,
  ReferenceRole,
} from "@/features/creator/types";
import { cn } from "@/lib/utils";

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
  const [result, setResult] = useState<CreatorAsset | null>(null);
  const [message, setMessage] = useState(storageMessage ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [packStatus, setPackStatus] = useState<CreatorPackStatus>("idle");
  const [packShots, setPackShots] = useState<CreatorPackShotState[]>(createInitialPackShots);
  const [isUploading, setIsUploading] = useState(false);
  const [arenaDialogOpen, setArenaDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [preferredRole, setPreferredRole] = useState<ReferenceRole | null>(null);
  const [arenaSearch, setArenaSearch] = useState("");

  const [outputType, setOutputType] = useState<"image" | "poster" | "illustration" | "social" | "thumbnail">("image");
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

  useEffect(() => {
    workspaceRef.current?.setAttribute("data-ready", "true");
  }, []);

  const selectedReferences = useMemo(() => references.flatMap((reference) => {
    const asset = assets.find((item) => item.id === reference.assetId);
    return asset ? [{ ...reference, asset }] : [];
  }), [assets, references]);

  if (!arena) return null;

  const mainText = arenaId === "general-image" ? subject : arenaId === "product-fashion" ? extraDirection : storyScene;
  const isPackGenerating = packStatus === "generating";
  const isBusy = isGenerating || isPackGenerating;
  const hasPackResults = packShots.some((shot) => shot.asset !== null);

  function setMainText(value: string) {
    if (arenaId === "general-image") setSubject(value);
    else if (arenaId === "product-fashion") setExtraDirection(value);
    else setStoryScene(value);
  }

  async function handleGenerate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isBusy || !validateForGeneration()) return;
    setIsGenerating(true);
    setMessage("Airveek is creating one polished 1K image…");

    try {
      const parsed = await requestGeneration(buildRequest());
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      addGeneratedAsset(parsed.data);
      setMessage("Your image is ready and saved privately to the library.");
      router.refresh();
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGeneratePack() {
    if (arenaId !== "product-fashion" || isBusy || !validateForGeneration()) return;
    setPackStatus("generating");
    setPackShots(createInitialPackShots());
    setMessage("Keep this page open while Airveek creates your three images.");

    let hasFailure = false;
    for (const recipe of productPhotoshootRecipes) {
      updatePackShot(recipe.shot, { status: "generating", error: null });
      const parsed = await requestGeneration(buildPackRequest(recipe));
      if (!parsed.ok) {
        hasFailure = true;
        updatePackShot(recipe.shot, { status: "failed", error: parsed.message });
        continue;
      }
      addGeneratedAsset(parsed.data);
      updatePackShot(recipe.shot, { status: "ready", asset: parsed.data, error: null });
      setMessage(`${recipe.label} image is ready. Creating the next image…`);
    }

    setPackStatus(hasFailure ? "completed-with-errors" : "completed");
    setMessage(hasFailure ? "Some images are ready. Retry any failed shot below." : "Your three-image photoshoot is ready and saved to the library.");
    router.refresh();
  }

  async function handleRetryPackShot(shot: ProductPhotoshootShot) {
    if (arenaId !== "product-fashion" || isBusy) return;
    const recipe = productPhotoshootRecipes.find((item) => item.shot === shot);
    if (!recipe) return;
    const hasOtherFailures = packShots.some((item) => item.recipe.shot !== shot && item.status === "failed");
    setPackStatus("generating");
    updatePackShot(shot, { status: "generating", error: null });
    setMessage(`Retrying the ${recipe.label.toLowerCase()} image…`);
    const parsed = await requestGeneration(buildPackRequest(recipe));
    if (!parsed.ok) {
      updatePackShot(shot, { status: "failed", error: parsed.message });
      setPackStatus("completed-with-errors");
      setMessage(`${recipe.label} still needs attention. You can retry it again.`);
      return;
    }
    addGeneratedAsset(parsed.data);
    updatePackShot(shot, { status: "ready", asset: parsed.data, error: null });
    setPackStatus(hasOtherFailures ? "completed-with-errors" : "completed");
    setMessage(hasOtherFailures ? `${recipe.label} is ready. Another shot still needs attention.` : "Your three-image photoshoot is ready and saved to the library.");
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
    setResult(asset);
    setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
  }

  function updatePackShot(shot: ProductPhotoshootShot, update: Partial<CreatorPackShotState>) {
    setPackShots((current) => current.map((item) => item.recipe.shot === shot ? { ...item, ...update } : item));
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
    return true;
  }

  function buildRequest(): GenerationRequest {
    if (arenaId === "product-fashion") {
      return { arenaId, mode, scene, campaignGoal, backgroundMood, lighting, aspectRatio, extraDirection, references };
    }
    if (arenaId === "storybook-page") {
      return { arenaId, characterDescription, scene: storyScene, artStyle, pageText, lighting, aspectRatio, extraDirection: "", references };
    }
    return { arenaId, outputType, subject, exactText, style, lighting, aspectRatio, extraDirection: "", references };
  }

  function buildPackRequest(recipe: ProductPhotoshootRecipe): GenerationRequest {
    return {
      arenaId: "product-fashion",
      mode: recipe.mode,
      scene: recipe.scene,
      campaignGoal: recipe.campaignGoal,
      backgroundMood,
      lighting: recipe.lighting,
      aspectRatio: recipe.aspectRatio,
      extraDirection,
      references,
    };
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
    <div ref={workspaceRef} className="min-h-[calc(100dvh-4rem)] bg-[#101210] lg:h-[calc(100dvh-4rem)] lg:overflow-hidden" data-testid="creator-workspace" data-ready="false">
      <h1 className="sr-only">Create {arena.title}</h1>
      <form onSubmit={handleGenerate} className="lg:h-full lg:overflow-hidden">
        <div className="grid min-h-[calc(100dvh-4rem)] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_288px]">
          <section className="flex min-h-[680px] min-w-0 flex-col bg-[#121412] lg:min-h-0" aria-label="Create image workspace">
            <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-8 lg:min-h-0" data-testid="generation-result">
              <Button className="absolute right-4 top-4 z-10 lg:hidden" type="button" variant="secondary" onClick={() => { setPreferredRole(null); setAssetDialogOpen(true); }} data-testid="open-assets-button">
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" /> Assets
              </Button>
              <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(131,255,0,0.08),transparent_38%)]" aria-hidden="true" />
              {hasPackResults || isPackGenerating ? (
                <div className="relative w-full max-w-5xl" data-testid="photoshoot-results">
                  <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-white">{isPackGenerating ? "Creating your photoshoot" : "Your photoshoot"}</span>
                    <span className="text-muted">{packShots.filter((shot) => shot.status === "ready").length} of {packShots.length} ready</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {packShots.map((shot) => (
                      <PhotoshootResultCard key={shot.recipe.shot} shot={shot} onRetry={() => void handleRetryPackShot(shot.recipe.shot)} disabled={isBusy} />
                    ))}
                  </div>
                </div>
              ) : isGenerating ? (
                <div className="relative max-w-sm text-center" data-testid="generation-loading">
                  <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-brand-neon" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-2xl font-bold">Creating your image</h2>
                  <p className="mt-2 text-base leading-6 text-muted">This can take a minute. Keep this page open.</p>
                </div>
              ) : result?.imageUrl ? (
                <div className="relative h-full min-h-[420px] w-full">
                  <Image src={result.imageUrl} alt={result.name} fill unoptimized className="object-contain" sizes="(max-width: 1024px) 100vw, calc(100vw - 288px)" priority data-testid="generation-result-image" />
                  <a href={`${result.imageUrl}?download=1`} className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/75 px-4 text-sm font-bold text-white backdrop-blur hover:bg-black" download>
                    <Download className="h-4 w-4" aria-hidden="true" /> Download
                  </a>
                </div>
              ) : (
                <div className="relative max-w-md text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-brand-neon"><ImagePlus className="h-8 w-8" aria-hidden="true" /></span>
                  <h2 className="mt-4 font-display text-2xl font-bold">Make your first generation</h2>
                  <p className="mt-2 text-base leading-6 text-muted">Describe your idea, choose simple options, and Airveek handles the detailed prompt.</p>
                </div>
              )}
            </div>

            <div className="shrink-0 px-3 pb-3 sm:px-5 sm:pb-4">
              <CreatorComposer
                arenaId={arenaId}
                selectedReferences={selectedReferences}
                mainText={mainText}
                onMainTextChange={setMainText}
                outputType={outputType}
                onOutputTypeChange={setOutputType}
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
                hasResult={Boolean(result)}
                isGenerating={isGenerating}
                packGenerating={isPackGenerating}
                onGeneratePack={handleGeneratePack}
                generationDisabled={Boolean(storageMessage)}
              />
              <div className="mx-auto mt-2 min-h-5 max-w-[900px] text-center text-sm text-muted" aria-live="polite" aria-atomic="true">{message}</div>
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-white/10 bg-[#151715] lg:block">
            <CreatorAssetPicker assets={assets} references={references} onToggle={toggleReference} onUpload={handleUpload} isUploading={isUploading} allowedReferenceRoles={referenceRolesForArena(arenaId)} defaultUploadRole={defaultUploadRole(arenaId)} uploadInputTestId="asset-upload-input" />
          </aside>
        </div>
      </form>

      <Dialog open={arenaDialogOpen} onOpenChange={setArenaDialogOpen} title="Choose what to create" description="Your saved assets remain available in every tool.">
        <label className="sr-only" htmlFor="arena-search">Search creation tools</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="arena-search" type="search" value={arenaSearch} onChange={(event) => setArenaSearch(event.target.value)} placeholder="Search all 21 tools" className="min-h-12 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-3 text-base text-white placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none" />
        </div>
        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {creatorCatalog.filter((item) => `${item.title} ${item.description} ${getCategoryLabel(item.categoryId)}`.toLowerCase().includes(arenaSearch.trim().toLowerCase())).map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand-neon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted">{getCategoryLabel(item.categoryId)} · {item.availability === "available" ? "Available" : "Coming next"}</span></span>
                {item.arenaId === arenaId ? <Check className="h-4 w-4 text-brand-neon" aria-label="Current tool" /> : item.arenaId ? <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" /> : null}
              </>
            );
            return item.arenaId ? (
              <Link key={item.id} href={`/create/${item.id}`} onClick={() => setArenaDialogOpen(false)} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 transition-colors", item.id === arenaId ? "border-brand-neon/40 bg-brand-neon/10" : "border-white/10 hover:bg-white/[0.05]")}>{content}</Link>
            ) : (
              <div key={item.id} aria-disabled="true" className="flex min-h-16 items-center gap-3 rounded-xl border border-white/[0.07] p-3 opacity-55">{content}</div>
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
        title={preferredRole ? `Choose a ${referenceRoleLabel(preferredRole)}` : "Your assets"}
        description={preferredRole ? `Select a saved image or upload a new ${referenceRoleLabel(preferredRole).toLowerCase()} image.` : "Choose up to two reference images."}
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
            compact
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

function createInitialPackShots(): CreatorPackShotState[] {
  return productPhotoshootRecipes.map((recipe) => ({
    recipe,
    status: "pending",
    asset: null,
    error: null,
  }));
}

function PhotoshootResultCard({ shot, onRetry, disabled }: {
  shot: CreatorPackShotState;
  onRetry: () => void;
  disabled: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/12 bg-[#1a1c1a]" data-testid={`photoshoot-shot-${shot.recipe.shot}`}>
      <div className="relative aspect-square bg-black/20">
        {shot.asset?.imageUrl ? <Image src={shot.asset.imageUrl} alt={shot.recipe.label} fill unoptimized className="object-contain" sizes="(max-width: 640px) 100vw, 30vw" /> : (
          <div className="flex h-full items-center justify-center text-center text-xs text-muted">
            {shot.status === "generating" ? <LoaderCircle className="h-6 w-6 animate-spin text-brand-neon" aria-label="Creating" /> : shot.status === "failed" ? "Could not create this shot" : "Waiting to start"}
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{shot.recipe.label}</h3>
          <span className="text-xs text-muted">{shot.recipe.purpose}</span>
        </div>
        {shot.status === "ready" && shot.asset?.imageUrl ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Saved to your library</span>
            <a href={`${shot.asset.imageUrl}?download=1`} download className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-white/[0.06] hover:text-white">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download
            </a>
          </div>
        ) : shot.status === "failed" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-2 text-xs text-red-200">{shot.error}</p>
            <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs" onClick={onRetry} disabled={disabled}>Retry</Button>
          </div>
        ) : <p className="text-xs text-muted">{shot.status === "ready" ? "Saved to your library" : shot.status === "generating" ? "Creating now…" : "Waiting"}</p>}
      </div>
    </article>
  );
}

function defaultUploadRole(arenaId: CreatorArenaId): ReferenceRole {
  if (arenaId === "product-fashion") return "product";
  if (arenaId === "storybook-page") return "character";
  return "reference";
}
