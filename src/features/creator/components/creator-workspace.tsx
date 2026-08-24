"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  Images,
  LoaderCircle,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { creatorCatalog, getCategoryLabel, getCreatorArena } from "@/features/creator/catalog";
import type {
  CreatorArenaId,
  CreatorAsset,
  CreatorAssetKind,
  CreatorResult,
  GenerationRequest,
  ImageAspectRatio,
} from "@/features/creator/types";
import { cn } from "@/lib/utils";

type AssetResult = CreatorResult<CreatorAsset>;

export function CreatorWorkspace({
  arenaId,
  initialAssets,
  storageMessage,
}: {
  arenaId: CreatorArenaId;
  initialAssets: CreatorAsset[];
  storageMessage: string | null;
}) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const arena = getCreatorArena(arenaId);
  const [assets, setAssets] = useState(initialAssets);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => {
    const reusedAssetId = searchParams.get("asset");
    return reusedAssetId && initialAssets.some((asset) => asset.id === reusedAssetId && asset.status === "ready")
      ? [reusedAssetId]
      : [];
  });
  const [result, setResult] = useState<CreatorAsset | null>(null);
  const [message, setMessage] = useState(storageMessage ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [arenaDialogOpen, setArenaDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [arenaSearch, setArenaSearch] = useState("");
  useEffect(() => {
    workspaceRef.current?.setAttribute("data-ready", "true");
  }, []);

  const [outputType, setOutputType] = useState<"image" | "poster" | "illustration" | "social" | "thumbnail">("image");
  const [subject, setSubject] = useState("");
  const [exactText, setExactText] = useState("");
  const [style, setStyle] = useState("premium editorial photography");
  const [mode, setMode] = useState<"product-scene" | "on-model" | "influencer-lifestyle">("product-scene");
  const [scene, setScene] = useState<"studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom">("studio");
  const [backgroundMood, setBackgroundMood] = useState("");
  const [characterDescription, setCharacterDescription] = useState("");
  const [storyScene, setStoryScene] = useState("");
  const [artStyle, setArtStyle] = useState<"cartoon" | "watercolor" | "3d-storybook" | "custom">("cartoon");
  const [pageText, setPageText] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>(arenaId === "storybook-page" ? "4:5" : "1:1");
  const [extraDirection, setExtraDirection] = useState("");
  const selectedAssets = useMemo(
    () => selectedAssetIds.map((id) => assets.find((asset) => asset.id === id)).filter((asset): asset is CreatorAsset => Boolean(asset)),
    [assets, selectedAssetIds],
  );

  if (!arena) return null;

  async function handleGenerate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isGenerating) return;
    setIsGenerating(true);
    setMessage("Airveek is creating one polished 1K image…");

    try {
      const response = await fetch("/api/creator/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const payload: unknown = await response.json();
      const parsed = readAssetResult(payload);
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      setResult(parsed.data);
      setAssets((current) => [parsed.data, ...current.filter((asset) => asset.id !== parsed.data.id)]);
      setMessage("Your image is ready and saved privately to the library.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function buildRequest(): GenerationRequest {
    if (arenaId === "product-fashion") {
      return {
        arenaId,
        mode,
        scene,
        backgroundMood,
        aspectRatio,
        extraDirection,
        sourceAssetIds: selectedAssetIds,
      };
    }
    if (arenaId === "storybook-page") {
      return {
        arenaId,
        characterDescription,
        scene: storyScene,
        artStyle,
        pageText,
        aspectRatio,
        extraDirection,
        sourceAssetIds: selectedAssetIds,
      };
    }
    return {
      arenaId,
      outputType,
      subject,
      exactText,
      style,
      aspectRatio,
      extraDirection,
      sourceAssetIds: selectedAssetIds,
    };
  }

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) => {
      if (current.includes(assetId)) return current.filter((id) => id !== assetId);
      if (current.length >= 2) {
        setMessage("Choose no more than two references for one generation.");
        return current;
      }
      setMessage("");
      return [...current, assetId];
    });
  }

  async function handleUpload(file: File, kind: Exclude<CreatorAssetKind, "generation">) {
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
      setSelectedAssetIds((current) => [...current.filter((id) => id !== parsed.data.id), parsed.data.id].slice(-2));
      setMessage("Reference saved and selected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The reference could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div ref={workspaceRef} className="min-h-[calc(100vh-4rem)] bg-[#090b09] lg:h-[calc(100svh-4rem)] lg:overflow-hidden" data-testid="creator-workspace" data-ready="false">
      <div className="border-b border-white/10 px-4 py-3 sm:px-6 lg:h-20">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-neon">Create / {arena.title}</p>
            <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{arena.title}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setArenaDialogOpen(true)}>
              Switch use case <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button className="lg:hidden" variant="secondary" onClick={() => setAssetDialogOpen(true)} data-testid="open-assets-button">
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" /> Assets
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="lg:h-[calc(100%-5rem)] lg:overflow-hidden">
        <div className="mx-auto grid max-w-[1800px] lg:h-full lg:min-h-0 lg:grid-cols-[330px_minmax(0,1fr)_310px]">
          <aside className="border-b border-white/10 bg-[#0d100d] p-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Guided setup</p>
            <p className="mt-2 text-sm leading-6 text-muted">Answer simple questions. Airveek handles the prompt structure.</p>
            <div className="mt-6 space-y-5">
              {arenaId === "general-image" ? (
                <GeneralFields
                  outputType={outputType}
                  setOutputType={setOutputType}
                  subject={subject}
                  setSubject={setSubject}
                  exactText={exactText}
                  setExactText={setExactText}
                  style={style}
                  setStyle={setStyle}
                />
              ) : arenaId === "product-fashion" ? (
                <ProductFields
                  mode={mode}
                  setMode={setMode}
                  scene={scene}
                  setScene={setScene}
                  backgroundMood={backgroundMood}
                  setBackgroundMood={setBackgroundMood}
                  selectedCount={selectedAssetIds.length}
                  onOpenAssets={() => setAssetDialogOpen(true)}
                />
              ) : (
                <StorybookFields
                  characterDescription={characterDescription}
                  setCharacterDescription={setCharacterDescription}
                  scene={storyScene}
                  setScene={setStoryScene}
                  artStyle={artStyle}
                  setArtStyle={setArtStyle}
                  pageText={pageText}
                  setPageText={setPageText}
                  selectedCount={selectedAssetIds.length}
                  onOpenAssets={() => setAssetDialogOpen(true)}
                />
              )}

              <Field label="Aspect ratio" htmlFor="aspect-ratio">
                <select id="aspect-ratio" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)} className={selectClassName}>
                  <option value="1:1">Square · 1:1</option>
                  <option value="4:5">Portrait · 4:5</option>
                  <option value="9:16">Story · 9:16</option>
                  <option value="16:9">Landscape · 16:9</option>
                </select>
              </Field>

            </div>
          </aside>

          <section className="flex min-h-[520px] min-w-0 flex-col bg-[#080a08] p-4 sm:p-5 lg:min-h-0" aria-label="Generation result">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#111411] p-4 sm:p-8" data-testid="generation-result">
              <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(131,255,0,0.08),transparent_40%)]" aria-hidden="true" />
              {isGenerating ? (
                <div className="relative max-w-sm text-center" data-testid="generation-loading">
                  <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-brand-neon" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-2xl font-bold">Creating your image</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">This can take a minute. Keep this page open.</p>
                </div>
              ) : result?.imageUrl ? (
                <div className="relative flex h-full w-full items-center justify-center">
                  <Image src={result.imageUrl} alt={result.name} fill unoptimized className="object-contain" sizes="(max-width: 1024px) 100vw, 60vw" priority data-testid="generation-result-image" />
                  <a href={`${result.imageUrl}?download=1`} className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-4 text-sm font-bold text-white backdrop-blur hover:bg-black" download>
                    <Download className="h-4 w-4" aria-hidden="true" /> Download
                  </a>
                </div>
              ) : (
                <div className="relative max-w-md text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-neon/25 bg-brand-neon/10 text-brand-neon">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-display text-2xl font-bold">Your result appears here</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">Complete the setup, add references if needed, then create one polished image.</p>
                </div>
              )}
            </div>
            <div className="shrink-0 pt-3">
              {selectedAssets.length ? (
                <div className="mb-2 flex flex-wrap justify-center gap-2" aria-label="Selected reference images">
                  {selectedAssets.map((asset, index) => (
                    <button key={asset.id} type="button" onClick={() => toggleAsset(asset.id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-brand-neon/25 bg-brand-neon/[0.06] px-3 text-left text-xs" aria-label={`Remove Image ${index + 1}, ${asset.name}`}>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-neon font-bold text-black">{index + 1}</span>
                      <span><strong className="block text-white">Image {index + 1}</strong><span className="block max-w-36 truncate text-muted">{asset.name}</span></span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mx-auto max-w-4xl rounded-2xl border border-white/15 bg-[#121512] p-2 shadow-[0_16px_50px_rgba(0,0,0,0.35)] focus-within:border-brand-neon/45">
                <label className="sr-only" htmlFor="extra-direction">Final instruction</label>
                <textarea id="extra-direction" value={extraDirection} onChange={(event) => setExtraDirection(event.target.value)} rows={2} maxLength={500} className="max-h-28 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 text-white outline-none placeholder:text-brand-gray" placeholder="Add a final instruction, for example: leave clean space on the left (optional)" data-testid="final-instruction-input" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-1 pt-2">
                  <div className="flex min-h-11 items-center gap-2 px-2 text-xs text-muted">
                    <span className="font-bold uppercase tracking-[0.12em] text-brand-neon">{arena.shortTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedAssetIds.length} of 2 references</span>
                  </div>
                  <div className="flex gap-2">
                    <Button className="lg:hidden" type="button" variant="secondary" onClick={() => setAssetDialogOpen(true)}><Images className="h-4 w-4" aria-hidden="true" /> Add image</Button>
                    {result ? <Button type="submit" variant="secondary" disabled={isGenerating}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Variation</Button> : null}
                    <Button type="submit" variant="primary" disabled={isGenerating || Boolean(storageMessage)} data-testid="generate-button">
                      {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                      {isGenerating ? "Creating…" : "Generate"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-2 min-h-5 text-center text-sm text-muted" aria-live="polite">{message}</div>
            </div>
          </section>

          <aside className="hidden min-h-0 border-l border-white/10 bg-[#0d100d] lg:block">
            <AssetTray
              assets={assets}
              selectedAssetIds={selectedAssetIds}
              onToggle={toggleAsset}
            onUpload={handleUpload}
            isUploading={isUploading}
            suggestedKind={suggestedKind(arenaId)}
            uploadInputTestId="asset-upload-input"
          />
          </aside>
        </div>

      </form>

      <Dialog open={arenaDialogOpen} onOpenChange={setArenaDialogOpen} title="Switch creation use case" description="Your saved assets stay available in every arena.">
        <label className="sr-only" htmlFor="arena-search">Search creation use cases</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="arena-search" type="search" value={arenaSearch} onChange={(event) => setArenaSearch(event.target.value)} placeholder="Search all 21 tools" className="min-h-12 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-3 text-sm text-white placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none focus-visible:outline-none" />
        </div>
        <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {creatorCatalog.filter((item) => `${item.title} ${item.description} ${getCategoryLabel(item.categoryId)}`.toLowerCase().includes(arenaSearch.trim().toLowerCase())).map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-brand-neon"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted">{getCategoryLabel(item.categoryId)} · {item.availability === "available" ? "Available" : "Coming next"}</span></span>
                {item.arenaId === arenaId ? <Check className="h-4 w-4 text-brand-neon" aria-label="Current arena" /> : item.arenaId ? <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" /> : null}
              </>
            );
            return item.arenaId ? (
              <Link key={item.id} href={`/create/${item.id}`} onClick={() => setArenaDialogOpen(false)} className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 transition-colors", item.id === arenaId ? "border-brand-neon/40 bg-brand-neon/10" : "border-white/10 hover:bg-white/[0.05]")}> 
                {content}
              </Link>
            ) : (
              <div key={item.id} aria-disabled="true" className="flex min-h-16 items-center gap-3 rounded-xl border border-white/[0.07] p-3 opacity-55">
                {content}
              </div>
            );
          })}
        </div>
      </Dialog>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen} title="Your assets" description="Choose up to two references or upload a new one.">
        <div className="max-h-[65vh] overflow-y-auto">
          <AssetTray
            assets={assets}
            selectedAssetIds={selectedAssetIds}
            onToggle={toggleAsset}
            onUpload={handleUpload}
            isUploading={isUploading}
            suggestedKind={suggestedKind(arenaId)}
            compact
          />
        </div>
      </Dialog>
    </div>
  );
}

function GeneralFields(props: {
  outputType: "image" | "poster" | "illustration" | "social" | "thumbnail";
  setOutputType: (value: "image" | "poster" | "illustration" | "social" | "thumbnail") => void;
  subject: string;
  setSubject: (value: string) => void;
  exactText: string;
  setExactText: (value: string) => void;
  style: string;
  setStyle: (value: string) => void;
}) {
  return (
    <>
      <Field label="What are you making?" htmlFor="output-type">
        <select id="output-type" value={props.outputType} onChange={(event) => props.setOutputType(event.target.value as typeof props.outputType)} className={selectClassName}>
          <option value="image">General image</option><option value="poster">Poster</option><option value="illustration">Illustration</option><option value="social">Social graphic</option><option value="thumbnail">Thumbnail</option>
        </select>
      </Field>
      <Field label="What should the image show?" htmlFor="subject" hint="Plain English is enough.">
        <textarea id="subject" required value={props.subject} onChange={(event) => props.setSubject(event.target.value)} rows={5} maxLength={600} className={textareaClassName} placeholder="Example: A premium skincare bottle on wet stone after rain, soft morning light." />
      </Field>
      <Field label="Exact text" htmlFor="exact-text" hint="Optional. Airveek asks the model to keep it readable.">
        <input id="exact-text" value={props.exactText} onChange={(event) => props.setExactText(event.target.value)} maxLength={240} className={inputClassName} placeholder="Launch day · 24 August" />
      </Field>
      <Field label="Visual style" htmlFor="visual-style">
        <select id="visual-style" value={props.style} onChange={(event) => props.setStyle(event.target.value)} className={selectClassName}>
          <option value="premium editorial photography">Premium editorial</option><option value="clean commercial photography">Clean commercial</option><option value="bold graphic design">Bold graphic</option><option value="playful hand-drawn illustration">Playful illustration</option><option value="cinematic photorealism">Cinematic photorealism</option>
        </select>
      </Field>
    </>
  );
}

function ProductFields(props: {
  mode: "product-scene" | "on-model" | "influencer-lifestyle";
  setMode: (value: "product-scene" | "on-model" | "influencer-lifestyle") => void;
  scene: "studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom";
  setScene: (value: "studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom") => void;
  backgroundMood: string;
  setBackgroundMood: (value: string) => void;
  selectedCount: number;
  onOpenAssets: () => void;
}) {
  return (
    <>
      <Field label="Photoshoot mode" htmlFor="photoshoot-mode">
        <select id="photoshoot-mode" value={props.mode} onChange={(event) => props.setMode(event.target.value as typeof props.mode)} className={selectClassName}>
          <option value="product-scene">Product scene</option><option value="on-model">On-model fashion</option><option value="influencer-lifestyle">Influencer / lifestyle</option>
        </select>
      </Field>
      <ReferenceCallout count={props.selectedCount} required onOpen={props.onOpenAssets} label="product or garment" />
      <Field label="Scene" htmlFor="product-scene">
        <select id="product-scene" value={props.scene} onChange={(event) => props.setScene(event.target.value as typeof props.scene)} className={selectClassName}>
          <option value="studio">Studio</option><option value="lifestyle">Lifestyle</option><option value="flat-lay">Flat lay</option><option value="outdoor">Outdoor</option><option value="custom">Custom direction</option>
        </select>
      </Field>
      <Field label="Background and mood" htmlFor="background-mood">
        <textarea id="background-mood" value={props.backgroundMood} onChange={(event) => props.setBackgroundMood(event.target.value)} rows={4} maxLength={240} className={textareaClassName} placeholder="Warm stone, late afternoon light, quiet luxury." />
      </Field>
    </>
  );
}

function StorybookFields(props: {
  characterDescription: string;
  setCharacterDescription: (value: string) => void;
  scene: string;
  setScene: (value: string) => void;
  artStyle: "cartoon" | "watercolor" | "3d-storybook" | "custom";
  setArtStyle: (value: "cartoon" | "watercolor" | "3d-storybook" | "custom") => void;
  pageText: string;
  setPageText: (value: string) => void;
  selectedCount: number;
  onOpenAssets: () => void;
}) {
  return (
    <>
      <ReferenceCallout count={props.selectedCount} onOpen={props.onOpenAssets} label="character" />
      <Field label="Main character" htmlFor="character-description" hint="Describe them if you did not select a saved character.">
        <textarea id="character-description" value={props.characterDescription} onChange={(event) => props.setCharacterDescription(event.target.value)} rows={4} maxLength={600} className={textareaClassName} placeholder="Mina, age 8, short curly hair, yellow raincoat, red boots." />
      </Field>
      <Field label="What happens on this page?" htmlFor="story-scene">
        <textarea id="story-scene" required value={props.scene} onChange={(event) => props.setScene(event.target.value)} rows={5} maxLength={800} className={textareaClassName} placeholder="Mina finds a tiny glowing door beneath an old oak tree and kneels to listen." />
      </Field>
      <Field label="Art style" htmlFor="art-style">
        <select id="art-style" value={props.artStyle} onChange={(event) => props.setArtStyle(event.target.value as typeof props.artStyle)} className={selectClassName}>
          <option value="cartoon">Cartoon</option><option value="watercolor">Watercolor</option><option value="3d-storybook">3D storybook</option><option value="custom">Custom direction</option>
        </select>
      </Field>
      <Field label="Page text" htmlFor="page-text" hint="Optional exact wording.">
        <textarea id="page-text" value={props.pageText} onChange={(event) => props.setPageText(event.target.value)} rows={3} maxLength={500} className={textareaClassName} placeholder="“Hello?” Mina whispered." />
      </Field>
    </>
  );
}

function ReferenceCallout({ count, label, onOpen, required = false }: { count: number; label: string; onOpen: () => void; required?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", count ? "border-brand-neon/30 bg-brand-neon/[0.06]" : "border-white/10 bg-white/[0.025]")}> 
      <p className="text-sm font-semibold">{required ? "Required " : "Optional "}{label} reference</p>
      <p className="mt-1 text-xs leading-5 text-muted">{count ? `${count} reference${count === 1 ? "" : "s"} selected.` : "Choose a saved image or upload a new one."}</p>
      <Button className="mt-3 w-full lg:hidden" type="button" variant="secondary" onClick={onOpen}><Images className="h-4 w-4" aria-hidden="true" /> Choose assets</Button>
    </div>
  );
}

function AssetTray({ assets, selectedAssetIds, onToggle, onUpload, isUploading, suggestedKind, compact = false, uploadInputTestId }: {
  assets: CreatorAsset[];
  selectedAssetIds: string[];
  onToggle: (assetId: string) => void;
  onUpload: (file: File, kind: Exclude<CreatorAssetKind, "generation">) => Promise<void>;
  isUploading: boolean;
  suggestedKind: Exclude<CreatorAssetKind, "generation">;
  compact?: boolean;
  uploadInputTestId?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<Exclude<CreatorAssetKind, "generation">>(suggestedKind);
  const groups = useMemo(() => [
    { kind: "product" as const, label: "Products" },
    { kind: "person" as const, label: "People" },
    { kind: "character" as const, label: "Characters" },
    { kind: "reference" as const, label: "References" },
    { kind: "generation" as const, label: "Recent" },
  ], []);

  return (
    <div className={cn("p-4", !compact && "h-full overflow-y-auto overscroll-contain")}>
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-bold">Assets</h2><p className="text-xs text-muted">Choose up to two</p></div>
        <Button type="button" size="icon" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isUploading} aria-label={`Upload ${uploadKind} image`}>
          {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <input ref={fileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" data-testid={uploadInputTestId} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file, uploadKind);
          event.target.value = "";
        }} />
      </div>
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-semibold text-muted transition-colors hover:border-brand-neon/40 hover:text-white disabled:opacity-50">
        <Upload className="h-4 w-4" aria-hidden="true" /> Upload {uploadKind}
      </button>
      <select aria-label="Type for the next uploaded image" value={uploadKind} onChange={(event) => setUploadKind(event.target.value as Exclude<CreatorAssetKind, "generation">)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-white focus:border-brand-neon/50 focus:outline-none focus-visible:outline-none">
        <option value="product">Product or garment</option><option value="person">Person or model</option><option value="character">Character</option><option value="reference">Other reference</option>
      </select>
      <div className="mt-5 space-y-5">
        {groups.map((group) => {
          const groupAssets = assets.filter((asset) => asset.kind === group.kind && asset.status === "ready");
          if (groupAssets.length === 0) return null;
          return (
            <section key={group.kind} aria-label={group.label}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">{group.label}</h3>
              <div className="grid grid-cols-3 gap-2">
                {groupAssets.slice(0, group.kind === "generation" ? 9 : 12).map((asset) => {
                  const selectedIndex = selectedAssetIds.indexOf(asset.id);
                  return (
                    <button key={asset.id} type="button" onClick={() => onToggle(asset.id)} aria-pressed={selectedIndex >= 0} className={cn("group relative aspect-square overflow-hidden rounded-lg border bg-brand-panel", selectedIndex >= 0 ? "border-brand-neon ring-2 ring-brand-neon/20" : "border-white/10 hover:border-white/30")} title={asset.name}>
                      {asset.imageUrl ? <Image src={asset.imageUrl} alt="" fill unoptimized className="object-cover" sizes="100px" /> : null}
                      {selectedIndex >= 0 ? <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-neon text-xs font-bold text-black">{selectedIndex + 1}</span> : null}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-5 text-left text-[10px] text-white">{asset.name}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {assets.filter((asset) => asset.status === "ready").length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/12 p-5 text-center text-xs leading-5 text-muted">No saved assets yet. Upload the first reference above.</div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-white">{label}</label>
      {hint ? <p className="mt-1 text-xs leading-5 text-muted">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function suggestedKind(arenaId: CreatorArenaId): Exclude<CreatorAssetKind, "generation"> {
  if (arenaId === "product-fashion") return "product";
  if (arenaId === "storybook-page") return "character";
  return "reference";
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

const inputClassName = "min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-brand-gray focus:border-brand-neon/60 focus:outline-none focus-visible:outline-none";
const selectClassName = `${inputClassName} appearance-none pr-8`;
const textareaClassName = `${inputClassName} resize-y py-3 leading-6`;
