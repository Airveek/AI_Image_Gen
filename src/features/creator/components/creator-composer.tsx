"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ImageIcon,
  ImagePlus,
  LampDesk,
  LayoutTemplate,
  LoaderCircle,
  Package,
  Palette,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { referenceRoleLabel } from "@/features/creator/components/creator-asset-picker";
import { getCreatorArena } from "@/features/creator/catalog";
import type {
  CreatorArenaId,
  CreatorAsset,
  GenerationReference,
  ImageAspectRatio,
  LightingOption,
  ProductCampaignGoal,
  ReferenceRole,
} from "@/features/creator/types";
import { cn } from "@/lib/utils";

type OutputType = "image" | "poster" | "illustration" | "social" | "thumbnail";
type ProductMode = "product-scene" | "on-model" | "influencer-lifestyle";
type ProductScene = "studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom";
type ArtStyle = "cartoon" | "watercolor" | "3d-storybook" | "custom";

type SelectedReference = GenerationReference & { asset: CreatorAsset };
type MenuId =
  | "add"
  | "output"
  | "style"
  | "lighting"
  | "ratio"
  | "mode"
  | "scene"
  | "goal"
  | "details"
  | `reference-${string}`;

const lightingOptions: Array<{ value: LightingOption; label: string }> = [
  { value: "auto", label: "Auto light" },
  { value: "soft-daylight", label: "Soft daylight" },
  { value: "studio-softbox", label: "Studio softbox" },
  { value: "golden-hour", label: "Golden hour" },
  { value: "dramatic", label: "Dramatic" },
];

const ratioOptions: Array<{ value: ImageAspectRatio; label: string }> = [
  { value: "1:1", label: "Square · 1:1" },
  { value: "4:5", label: "Portrait · 4:5" },
  { value: "9:16", label: "Story · 9:16" },
  { value: "16:9", label: "Landscape · 16:9" },
];

export function CreatorComposer({
  arenaId,
  selectedReferences,
  mainText,
  onMainTextChange,
  outputType,
  onOutputTypeChange,
  exactText,
  onExactTextChange,
  style,
  onStyleChange,
  mode,
  onModeChange,
  scene,
  onSceneChange,
  campaignGoal,
  onCampaignGoalChange,
  backgroundMood,
  onBackgroundMoodChange,
  characterDescription,
  onCharacterDescriptionChange,
  artStyle,
  onArtStyleChange,
  pageText,
  onPageTextChange,
  lighting,
  onLightingChange,
  aspectRatio,
  onAspectRatioChange,
  onOpenArena,
  onOpenAssets,
  onRemoveReference,
  onChangeReferenceRole,
  hasResult,
  isGenerating,
  packGenerating,
  onGeneratePack,
  generationDisabled,
}: {
  arenaId: CreatorArenaId;
  selectedReferences: SelectedReference[];
  mainText: string;
  onMainTextChange: (value: string) => void;
  outputType: OutputType;
  onOutputTypeChange: (value: OutputType) => void;
  exactText: string;
  onExactTextChange: (value: string) => void;
  style: string;
  onStyleChange: (value: string) => void;
  mode: ProductMode;
  onModeChange: (value: ProductMode) => void;
  scene: ProductScene;
  onSceneChange: (value: ProductScene) => void;
  campaignGoal: ProductCampaignGoal;
  onCampaignGoalChange: (value: ProductCampaignGoal) => void;
  backgroundMood: string;
  onBackgroundMoodChange: (value: string) => void;
  characterDescription: string;
  onCharacterDescriptionChange: (value: string) => void;
  artStyle: ArtStyle;
  onArtStyleChange: (value: ArtStyle) => void;
  pageText: string;
  onPageTextChange: (value: string) => void;
  lighting: LightingOption;
  onLightingChange: (value: LightingOption) => void;
  aspectRatio: ImageAspectRatio;
  onAspectRatioChange: (value: ImageAspectRatio) => void;
  onOpenArena: () => void;
  onOpenAssets: (role: ReferenceRole) => void;
  onRemoveReference: (assetId: string) => void;
  onChangeReferenceRole: (assetId: string, role: ReferenceRole) => void;
  hasResult: boolean;
  isGenerating: boolean;
  packGenerating: boolean;
  onGeneratePack: () => void;
  generationDisabled: boolean;
}) {
  const composerRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const arena = getCreatorArena(arenaId);

  useEffect(() => {
    if (!openMenu) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !composerRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  if (!arena) return null;

  const placeholder = {
    "general-image": "Describe the image you want. Example: A premium skincare bottle on wet stone after rain, soft morning light.",
    "product-fashion": "Describe the final product photo. Example: Place the bottle on warm stone with clean space on the left for an ad.",
    "storybook-page": "Describe what happens on this page. Example: Mina finds a tiny glowing door beneath an old oak tree.",
    "image-to-sketch": "Optional: say what to preserve, such as “keep the neckline and seam details exact.”",
  }[arenaId];
  const isImageToSketch = arenaId === "image-to-sketch";
  const availableAddOptions = arenaId === "product-fashion" ? productAddOptions : isImageToSketch ? sketchAddOptions : addOptions;
  const availableReferenceRoleOptions = arenaId === "product-fashion" ? productReferenceRoleOptions : isImageToSketch ? sketchReferenceRoleOptions : referenceRoleOptions;

  return (
    <div ref={composerRef} className="relative mx-auto w-full max-w-[900px]" data-testid="creator-composer">
      {selectedReferences.length > 0 ? (
        <div className="mb-2 flex flex-wrap justify-center gap-2" aria-label="Selected reference images">
          {selectedReferences.map((reference, index) => {
            const menuId: MenuId = `reference-${reference.assetId}`;
            return (
              <div key={reference.assetId} className="relative flex min-h-14 min-w-0 max-w-56 items-center gap-2 rounded-xl border border-white/15 bg-[#1a1d1a] p-1.5 pr-2 shadow-lg">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-brand-panel">
                  {reference.asset.imageUrl ? <Image src={reference.asset.imageUrl} alt="" fill unoptimized className="object-cover" sizes="44px" /> : null}
                  <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-neon text-[10px] font-bold text-black">{index + 1}</span>
                </span>
                {isImageToSketch ? (
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-white">{reference.asset.name}</span>
                    <span className="block text-xs text-muted">Sketch image {index + 1}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === menuId ? null : menuId)}
                    className="min-w-0 flex-1 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === menuId}
                  >
                    <span className="block truncate text-sm font-semibold text-white">{reference.asset.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">{referenceRoleLabel(reference.role)} <ChevronDown className="h-3 w-3" aria-hidden="true" /></span>
                  </button>
                )}
                <button type="button" onClick={() => onRemoveReference(reference.assetId)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/[0.07] hover:text-white" aria-label={`Remove ${reference.asset.name}`}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
                {openMenu === menuId ? (
                  <OptionPanel align="left">
                    {availableReferenceRoleOptions.map((option) => (
                      <MenuItem key={option.value} selected={reference.role === option.value} onSelect={() => {
                        onChangeReferenceRole(reference.assetId, option.value);
                        setOpenMenu(null);
                      }}>{option.label}</MenuItem>
                    ))}
                  </OptionPanel>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/15 bg-[#1a1c1a] p-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] transition-colors focus-within:border-brand-neon/45">
        {isImageToSketch ? (
          <>
            <label className="sr-only" htmlFor="creation-prompt">Optional sketch direction</label>
            <p className="px-3 pt-1 text-xs text-muted">Upload a clear sketch or garment image. Add a second zoomed detail when useful.</p>
            <textarea
              id="creation-prompt"
              value={mainText}
              onChange={(event) => onMainTextChange(event.target.value)}
              rows={2}
              maxLength={600}
              className="max-h-32 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 text-white outline-none placeholder:text-[#8a8f8a]"
              placeholder={placeholder}
              data-testid="creation-prompt"
            />
          </>
        ) : (
          <>
            <label className="sr-only" htmlFor="creation-prompt">Describe the image you want</label>
            {arenaId === "product-fashion" ? <p className="px-3 pt-1 text-xs text-muted">Use a clear photo with the whole product visible. Keep this page open while the three images are created.</p> : null}
            <textarea
              id="creation-prompt"
              value={mainText}
              onChange={(event) => onMainTextChange(event.target.value)}
              rows={3}
              maxLength={arenaId === "storybook-page" ? 800 : 600}
              required={arenaId !== "product-fashion"}
              className="max-h-40 min-h-20 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 text-white outline-none placeholder:text-[#8a8f8a]"
              placeholder={placeholder}
              data-testid="creation-prompt"
            />
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-1 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onOpenArena} aria-label={`Change use case from ${arena.title}`}>
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              <span className="max-w-36 truncate">{arena.shortTitle}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>

            <div className="relative">
              <Button type="button" size="icon" variant="secondary" onClick={() => setOpenMenu(openMenu === "add" ? null : "add")} aria-label={isImageToSketch ? "Add image" : "Add a reference image"} aria-haspopup="menu" aria-expanded={openMenu === "add"} data-testid="add-reference-button">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              {openMenu === "add" ? (
                <OptionPanel align="left">
                  {availableAddOptions.map((option) => {
                    const Icon = option.icon;
                    return <MenuItem key={option.role} onSelect={() => { setOpenMenu(null); onOpenAssets(option.role); }}><Icon className="h-4 w-4 text-muted" aria-hidden="true" />{option.label}</MenuItem>;
                  })}
                </OptionPanel>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isImageToSketch && arenaId === "general-image" ? (
              <>
                <OptionMenu id="output" label={labelFor(outputType, outputOptions)} icon={<LayoutTemplate className="h-4 w-4" aria-hidden="true" />} options={outputOptions} value={outputType} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onOutputTypeChange} />
                <OptionMenu id="style" label={labelFor(style, generalStyleOptions)} icon={<Palette className="h-4 w-4" aria-hidden="true" />} options={generalStyleOptions} value={style} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onStyleChange} />
              </>
            ) : !isImageToSketch && arenaId === "product-fashion" ? (
              <>
                <OptionMenu id="mode" label={labelFor(mode, productModeOptions)} icon={<Package className="h-4 w-4" aria-hidden="true" />} options={productModeOptions} value={mode} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onModeChange} />
                <OptionMenu id="scene" label={labelFor(scene, productSceneOptions)} icon={<LayoutTemplate className="h-4 w-4" aria-hidden="true" />} options={productSceneOptions} value={scene} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onSceneChange} />
                <OptionMenu id="goal" label={labelFor(campaignGoal, campaignGoalOptions)} icon={<WandSparkles className="h-4 w-4" aria-hidden="true" />} options={campaignGoalOptions} value={campaignGoal} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onCampaignGoalChange} />
              </>
            ) : !isImageToSketch ? (
              <OptionMenu id="style" label={labelFor(artStyle, artStyleOptions)} icon={<Palette className="h-4 w-4" aria-hidden="true" />} options={artStyleOptions} value={artStyle} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onArtStyleChange} />
            ) : null}

            {!isImageToSketch ? <>
              <OptionMenu id="lighting" label={labelFor(lighting, lightingOptions)} icon={<LampDesk className="h-4 w-4" aria-hidden="true" />} options={lightingOptions} value={lighting} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onLightingChange} />
              <OptionMenu id="ratio" label={aspectRatio} icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />} options={ratioOptions} value={aspectRatio} openMenu={openMenu} setOpenMenu={setOpenMenu} onChange={onAspectRatioChange} />
            </> : null}

            {!isImageToSketch ? <div className="relative">
              <Button type="button" size="icon" variant="secondary" onClick={() => setOpenMenu(openMenu === "details" ? null : "details")} aria-label="Open optional image details" aria-haspopup="dialog" aria-expanded={openMenu === "details"}>
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              {openMenu === "details" ? (
                <DetailsPanel title="Optional details" onDone={() => setOpenMenu(null)}>
                  {arenaId === "general-image" ? (
                    <DetailField label="Exact text" hint="Airveek will ask Gemini to keep this wording readable.">
                      <input value={exactText} onChange={(event) => onExactTextChange(event.target.value)} maxLength={240} className={detailInputClassName} placeholder="Launch day · 24 August" />
                    </DetailField>
                  ) : arenaId === "product-fashion" ? (
                    <DetailField label="Background and mood" hint="Optional. Plain English is enough.">
                      <textarea value={backgroundMood} onChange={(event) => onBackgroundMoodChange(event.target.value)} rows={3} maxLength={240} className={detailTextareaClassName} placeholder="Warm stone, quiet luxury, clean background." />
                    </DetailField>
                  ) : (
                    <>
                      <DetailField label="Main character" hint="Only needed when you do not add a Character image.">
                        <textarea value={characterDescription} onChange={(event) => onCharacterDescriptionChange(event.target.value)} rows={3} maxLength={600} className={detailTextareaClassName} placeholder="Mina, age 8, curly hair, yellow raincoat." />
                      </DetailField>
                      <DetailField label="Page text" hint="Optional exact wording.">
                        <textarea value={pageText} onChange={(event) => onPageTextChange(event.target.value)} rows={2} maxLength={500} className={detailTextareaClassName} placeholder="“Hello?” Mina whispered." />
                      </DetailField>
                    </>
                  )}
                </DetailsPanel>
              ) : null}
            </div> : null}

            {arenaId === "product-fashion" ? (
              <Button type="button" variant="primary" disabled={isGenerating || packGenerating || generationDisabled} onClick={onGeneratePack} data-testid="photoshoot-pack-button">
                {packGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WandSparkles className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">{packGenerating ? "Creating 3 images…" : "Create 3 images"}</span>
              </Button>
            ) : null}
            {hasResult ? (
              <Button type="submit" variant="secondary" disabled={isGenerating} aria-label="Create a variation">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Variation</span>
              </Button>
            ) : null}
            <Button type="submit" variant={isImageToSketch || arenaId !== "product-fashion" ? "primary" : "secondary"} size={isImageToSketch ? "default" : "icon"} disabled={isGenerating || packGenerating || generationDisabled} aria-label={isGenerating ? "Creating image" : isImageToSketch ? "Create high-quality sketch" : "Create one image"} data-testid="generate-button">
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {isImageToSketch ? <span>{isGenerating ? "Creating sketch…" : "Create high-quality sketch"}</span> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionMenu<T extends string>({ id, label, icon, options, value, openMenu, setOpenMenu, onChange }: {
  id: Exclude<MenuId, "add" | "details" | `reference-${string}`>;
  label: string;
  icon: ReactNode;
  options: Array<{ value: T; label: string }>;
  value: T;
  openMenu: MenuId | null;
  setOpenMenu: (value: MenuId | null) => void;
  onChange: (value: T) => void;
}) {
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpenMenu(openMenu === id ? null : id)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon" aria-label={label} aria-haspopup="menu" aria-expanded={openMenu === id}>
        {icon}<span>{label}</span><ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {openMenu === id ? (
        <OptionPanel>
          {options.map((option) => <MenuItem key={option.value} selected={option.value === value} onSelect={() => { onChange(option.value); setOpenMenu(null); }}>{option.label}</MenuItem>)}
        </OptionPanel>
      ) : null}
    </div>
  );
}

function OptionPanel({ children, align = "right" }: { children: ReactNode; align?: "left" | "right" }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(["ArrowDown", "ArrowUp", "Home", "End"] as string[]).includes(event.key)) return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    if (buttons.length === 0) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Home") buttons[0]?.focus();
    else if (event.key === "End") buttons.at(-1)?.focus();
    else if (event.key === "ArrowDown") buttons[(currentIndex + 1 + buttons.length) % buttons.length]?.focus();
    else buttons[(currentIndex - 1 + buttons.length) % buttons.length]?.focus();
  }

  return (
    <div role="menu" onKeyDown={handleKeyDown} className={cn("absolute bottom-[calc(100%+0.5rem)] z-30 min-w-52 rounded-xl border border-white/12 bg-[#202220] p-1.5 text-sm text-white shadow-2xl", align === "left" ? "left-0" : "right-0")}>
      {children}
    </div>
  );
}

function MenuItem({ children, selected, onSelect }: { children: ReactNode; selected?: boolean; onSelect: () => void }) {
  return <button type="button" role={selected === undefined ? "menuitem" : "menuitemradio"} aria-checked={selected} onClick={onSelect} className={cn("flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon", selected && "bg-brand-neon/10 text-brand-soft")}>{children}</button>;
}

function DetailsPanel({ title, children, onDone }: { title: string; children: ReactNode; onDone: () => void }) {
  return (
    <div role="dialog" aria-label={title} className="absolute bottom-[calc(100%+0.5rem)] right-0 z-30 w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-xl border border-white/12 bg-[#202220] p-4 text-sm text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><Button type="button" variant="ghost" onClick={onDone}>Done</Button></div>
      {children}
    </div>
  );
}

function DetailField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <label className="block"><span className="font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted">{hint}</span><span className="mt-2 block">{children}</span></label>;
}

function labelFor<T extends string>(value: T, options: Array<{ value: T; label: string }>): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

const addOptions: Array<{ role: ReferenceRole; label: string; icon: typeof Package }> = [
  { role: "product", label: "Product", icon: Package },
  { role: "model", label: "Model", icon: UserRound },
  { role: "character", label: "Character", icon: WandSparkles },
  { role: "style", label: "Style", icon: Palette },
  { role: "reference", label: "Other image", icon: ImagePlus },
];

const productAddOptions = addOptions.filter((option) => option.role !== "character");
const sketchAddOptions: Array<{ role: ReferenceRole; label: string; icon: typeof Package }> = [
  { role: "reference", label: "Add image", icon: ImagePlus },
];

const referenceRoleOptions = addOptions.map(({ role: value, label }) => ({ value, label }));
const productReferenceRoleOptions = productAddOptions.map(({ role: value, label }) => ({ value, label }));
const sketchReferenceRoleOptions = [{ value: "reference" as const, label: "Sketch image" }];
const outputOptions: Array<{ value: OutputType; label: string }> = [
  { value: "image", label: "Image" }, { value: "poster", label: "Poster" }, { value: "illustration", label: "Illustration" }, { value: "social", label: "Social graphic" }, { value: "thumbnail", label: "Thumbnail" },
];
const generalStyleOptions = [
  { value: "premium editorial photography", label: "Premium editorial" }, { value: "clean commercial photography", label: "Clean commercial" }, { value: "bold graphic design", label: "Bold graphic" }, { value: "playful hand-drawn illustration", label: "Playful illustration" }, { value: "cinematic photorealism", label: "Cinematic" },
];
const productModeOptions: Array<{ value: ProductMode; label: string }> = [
  { value: "product-scene", label: "Product only" }, { value: "on-model", label: "On a person" }, { value: "influencer-lifestyle", label: "Lifestyle" },
];
const productSceneOptions: Array<{ value: ProductScene; label: string }> = [
  { value: "studio", label: "Studio" }, { value: "lifestyle", label: "Lifestyle" }, { value: "flat-lay", label: "Flat lay" }, { value: "outdoor", label: "Outdoor" }, { value: "custom", label: "Custom" },
];
const campaignGoalOptions: Array<{ value: ProductCampaignGoal; label: string }> = [
  { value: "store-listing", label: "Shop listing" },
  { value: "social-post", label: "Social post" },
  { value: "ad-banner", label: "Ad banner" },
  { value: "lookbook", label: "Lookbook" },
];
const artStyleOptions: Array<{ value: ArtStyle; label: string }> = [
  { value: "cartoon", label: "Cartoon" }, { value: "watercolor", label: "Watercolor" }, { value: "3d-storybook", label: "3D storybook" }, { value: "custom", label: "Custom style" },
];

const detailInputClassName = "min-h-11 w-full rounded-xl border border-white/12 bg-black/25 px-3 text-base text-white placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none";
const detailTextareaClassName = `${detailInputClassName} resize-none py-3 leading-6`;
