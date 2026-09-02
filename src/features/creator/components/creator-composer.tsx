"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ChevronDown,
  ImageIcon,
  ImagePlus,
  LoaderCircle,
  Package,
  Palette,
  Plus,
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
  GenerationCount,
  GenerationReference,
  ImageAspectRatio,
  LightingOption,
  ProductCampaignGoal,
  ReferenceRole,
} from "@/features/creator/types";
import { cn } from "@/lib/utils";

type ProductMode = "product-scene" | "on-model" | "influencer-lifestyle";
type ProductScene = "studio" | "lifestyle" | "flat-lay" | "outdoor" | "custom";
type ArtStyle = "cartoon" | "watercolor" | "3d-storybook" | "custom";

type SelectedReference = GenerationReference & { asset: CreatorAsset };
type MenuId =
  | "add"
  | "style"
  | "lighting"
  | "ratio"
  | "mode"
  | "scene"
  | "goal"
  | "details"
  | "generation-count"
  | `reference-${string}`;
type MenuDismissReason = "dialog-launch" | "escape" | "pointer" | "selection";

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

const generationCountOptions: Array<{ value: GenerationCount; label: string }> = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
];

export function CreatorComposer({
  arenaId,
  selectedReferences,
  mainText,
  onMainTextChange,
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
  isGenerating,
  generationCount,
  onGenerationCountChange,
  generationDisabled,
}: {
  arenaId: CreatorArenaId;
  selectedReferences: SelectedReference[];
  mainText: string;
  onMainTextChange: (value: string) => void;
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
  isGenerating: boolean;
  generationCount: GenerationCount;
  onGenerationCountChange: (value: GenerationCount) => void;
  generationDisabled: boolean;
}) {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreMenuFocusRef = useRef(false);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const arena = getCreatorArena(arenaId);

  const dismissMenu = useCallback((reason: MenuDismissReason) => {
    restoreMenuFocusRef.current = reason === "escape" || reason === "selection";
    if (!restoreMenuFocusRef.current) menuTriggerRef.current = null;
    setOpenMenu(null);
  }, []);

  function toggleMenu(menuId: MenuId, trigger: HTMLButtonElement) {
    if (openMenu === menuId) {
      dismissMenu("pointer");
      return;
    }

    menuTriggerRef.current = trigger;
    restoreMenuFocusRef.current = false;
    setOpenMenu(menuId);
  }

  useEffect(() => {
    if (!openMenu) return;

    function closeOutsideActiveOverlay(event: PointerEvent) {
      if (event.target instanceof Node && menuTriggerRef.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest("[data-composer-overlay]")) return;
      dismissMenu("pointer");
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      dismissMenu("escape");
    }

    document.addEventListener("pointerdown", closeOutsideActiveOverlay);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutsideActiveOverlay);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [dismissMenu, openMenu]);

  useEffect(() => {
    if (openMenu || !restoreMenuFocusRef.current) return;
    restoreMenuFocusRef.current = false;
    menuTriggerRef.current?.focus();
    menuTriggerRef.current = null;
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
    <div className="relative mx-auto w-full max-w-[900px]" data-testid="creator-composer">
      <div className="rounded-2xl border border-border bg-surface-raised p-2 shadow-[0_18px_60px_rgba(0,0,0,0.48)] transition-colors focus-within:border-brand-neon/45">
        {selectedReferences.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-1 pb-1.5" aria-label="Selected reference images">
          {selectedReferences.map((reference, index) => {
            const menuId: MenuId = `reference-${reference.assetId}`;
            return (
              <div key={reference.assetId} className="relative flex h-9 min-w-0 max-w-52 items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-1.5">
                <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-brand-panel">
                  {reference.asset.imageUrl ? <Image src={reference.asset.imageUrl} alt="" fill unoptimized className="object-cover" sizes="24px" /> : null}
                </span>
                {isImageToSketch ? (
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs font-semibold text-foreground">{reference.asset.name}</span>
                    <span className="block text-[10px] text-muted">Sketch image {index + 1}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => toggleMenu(menuId, event.currentTarget)}
                    className="min-w-0 flex-1 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === menuId}
                  >
                    <span className="block truncate text-xs font-semibold text-foreground">{reference.asset.name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted">{referenceRoleLabel(reference.role)} <ChevronDown className="h-2.5 w-2.5" aria-hidden="true" /></span>
                  </button>
                )}
                <button type="button" onClick={() => onRemoveReference(reference.assetId)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-raised hover:text-foreground" aria-label={`Remove ${reference.asset.name}`}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {openMenu === menuId ? (
                  <OptionPanel align="left">
                    {availableReferenceRoleOptions.map((option) => (
                      <MenuItem key={option.value} selected={reference.role === option.value} onSelect={() => {
                        onChangeReferenceRole(reference.assetId, option.value);
                        dismissMenu("selection");
                      }}>{option.label}</MenuItem>
                    ))}
                  </OptionPanel>
                ) : null}
              </div>
            );
          })}
        </div>
        ) : null}
        {isImageToSketch ? (
          <>
            <label className="sr-only" htmlFor="creation-prompt">Optional sketch direction</label>
            <textarea
              id="creation-prompt"
              value={mainText}
              onChange={(event) => onMainTextChange(event.target.value)}
              rows={2}
              maxLength={600}
              className="max-h-32 min-h-16 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              data-testid="creation-prompt"
            />
          </>
        ) : (
          <>
            {arenaId === "product-fashion" ? <p className="px-3 pt-1 text-xs leading-5 text-muted">Use a sharp, well-lit product photo with the full product visible and labels readable.</p> : null}
            <label className="sr-only" htmlFor="creation-prompt">Describe the image you want</label>
            <textarea
              id="creation-prompt"
              value={mainText}
              onChange={(event) => onMainTextChange(event.target.value)}
              rows={3}
              maxLength={arenaId === "storybook-page" ? 800 : 600}
              required={arenaId !== "product-fashion"}
              className="max-h-40 min-h-20 w-full resize-none bg-transparent px-3 py-2 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              data-testid="creation-prompt"
            />
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={onOpenArena} aria-label={`Change use case from ${arena.title}`} className="max-w-52 px-3">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{arena.shortTitle}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>

            <div className="relative">
              <Button type="button" size="icon" variant="secondary" onClick={(event) => toggleMenu("add", event.currentTarget)} aria-label={isImageToSketch ? "Add image" : "Add a reference image"} aria-haspopup="menu" aria-expanded={openMenu === "add"} data-testid="add-reference-button">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              {openMenu === "add" ? (
                <OptionPanel align="left">
                  {availableAddOptions.map((option) => {
                    const Icon = option.icon;
                    return <MenuItem key={option.role} onSelect={() => { dismissMenu("dialog-launch"); onOpenAssets(option.role); }}><Icon className="h-4 w-4 text-muted" aria-hidden="true" />{option.label}</MenuItem>;
                  })}
                </OptionPanel>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isImageToSketch ? <OptionMenu id="ratio" label={aspectRatio} icon={<ImageIcon className="h-4 w-4" aria-hidden="true" />} options={ratioOptions} value={aspectRatio} openMenu={openMenu} onToggle={toggleMenu} onDismiss={dismissMenu} onChange={onAspectRatioChange} /> : null}

            {!isImageToSketch ? <div className="relative">
              <Button type="button" size="icon" variant="secondary" onClick={(event) => toggleMenu("details", event.currentTarget)} aria-label="Open image settings" aria-haspopup="dialog" aria-expanded={openMenu === "details"} data-testid="image-settings-button">
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              {openMenu === "details" ? (
                <ComposerSettingsPanel
                  arenaId={arenaId}
                  style={style}
                  onStyleChange={onStyleChange}
                  mode={mode}
                  onModeChange={onModeChange}
                  scene={scene}
                  onSceneChange={onSceneChange}
                  campaignGoal={campaignGoal}
                  onCampaignGoalChange={onCampaignGoalChange}
                  artStyle={artStyle}
                  onArtStyleChange={onArtStyleChange}
                  lighting={lighting}
                  onLightingChange={onLightingChange}
                  exactText={exactText}
                  onExactTextChange={onExactTextChange}
                  backgroundMood={backgroundMood}
                  onBackgroundMoodChange={onBackgroundMoodChange}
                  characterDescription={characterDescription}
                  onCharacterDescriptionChange={onCharacterDescriptionChange}
                  pageText={pageText}
                  onPageTextChange={onPageTextChange}
                  onDone={() => dismissMenu("selection")}
                />
              ) : null}
            </div> : null}

            <OptionMenu
              id="generation-count"
              label={`${generationCount}x`}
              options={generationCountOptions}
              value={generationCount}
              openMenu={openMenu}
              onToggle={toggleMenu}
              onDismiss={dismissMenu}
              onChange={onGenerationCountChange}
              disabled={isGenerating || generationDisabled}
              ariaLabel={`Select image count, currently ${generationCount}x`}
              testId="generation-count-button"
            />
            <Button type="submit" variant="primary" size="icon" disabled={isGenerating || generationDisabled} aria-label={isGenerating ? "Creating images" : `Create ${generationCount} ${generationCount === 1 ? "image" : "images"}`} data-testid="generate-button">
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionMenu<T extends string | number>({ id, label, icon, options, value, openMenu, onToggle, onDismiss, onChange, disabled = false, ariaLabel, testId }: {
  id: Exclude<MenuId, "add" | "details" | `reference-${string}`>;
  label: string;
  icon?: ReactNode;
  options: Array<{ value: T; label: string }>;
  value: T;
  openMenu: MenuId | null;
  onToggle: (id: MenuId, trigger: HTMLButtonElement) => void;
  onDismiss: (reason: MenuDismissReason) => void;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel?: string;
  testId?: string;
}) {
  return (
    <div className="relative">
      <button type="button" disabled={disabled} onClick={(event) => onToggle(id, event.currentTarget)} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50" aria-label={ariaLabel ?? label} aria-haspopup="menu" aria-expanded={openMenu === id} data-testid={testId}>
        {icon}<span>{label}</span><ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {openMenu === id ? (
        <OptionPanel>
          {options.map((option) => <MenuItem key={option.value} selected={option.value === value} onSelect={() => { onChange(option.value); onDismiss("selection"); }}>{option.label}</MenuItem>)}
        </OptionPanel>
      ) : null}
    </div>
  );
}

function OptionPanel({ children, align = "right" }: { children: ReactNode; align?: "left" | "right" }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, []);

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
    <div ref={panelRef} role="menu" data-composer-overlay onKeyDown={handleKeyDown} className={cn("absolute bottom-[calc(100%+0.5rem)] z-30 min-w-52 rounded-xl border border-border bg-popover p-1.5 text-sm text-foreground shadow-2xl", align === "left" ? "left-0" : "right-0")}>
      {children}
    </div>
  );
}

function MenuItem({ children, selected, onSelect }: { children: ReactNode; selected?: boolean; onSelect: () => void }) {
  return <button type="button" role={selected === undefined ? "menuitem" : "menuitemradio"} aria-checked={selected} onClick={onSelect} className={cn("flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus", selected && "bg-brand-neon/10 text-brand-soft")}>{children}</button>;
}

function ComposerSettingsPanel({
  arenaId,
  style,
  onStyleChange,
  mode,
  onModeChange,
  scene,
  onSceneChange,
  campaignGoal,
  onCampaignGoalChange,
  artStyle,
  onArtStyleChange,
  lighting,
  onLightingChange,
  exactText,
  onExactTextChange,
  backgroundMood,
  onBackgroundMoodChange,
  characterDescription,
  onCharacterDescriptionChange,
  pageText,
  onPageTextChange,
  onDone,
}: {
  arenaId: CreatorArenaId;
  style: string;
  onStyleChange: (value: string) => void;
  mode: ProductMode;
  onModeChange: (value: ProductMode) => void;
  scene: ProductScene;
  onSceneChange: (value: ProductScene) => void;
  campaignGoal: ProductCampaignGoal;
  onCampaignGoalChange: (value: ProductCampaignGoal) => void;
  artStyle: ArtStyle;
  onArtStyleChange: (value: ArtStyle) => void;
  lighting: LightingOption;
  onLightingChange: (value: LightingOption) => void;
  exactText: string;
  onExactTextChange: (value: string) => void;
  backgroundMood: string;
  onBackgroundMoodChange: (value: string) => void;
  characterDescription: string;
  onCharacterDescriptionChange: (value: string) => void;
  pageText: string;
  onPageTextChange: (value: string) => void;
  onDone: () => void;
}) {
  return (
    <div role="dialog" aria-label="Image settings" data-composer-overlay className="absolute bottom-[calc(100%+0.5rem)] right-0 z-30 max-h-[min(70vh,34rem)] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-popover p-4 text-sm text-foreground shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="font-semibold">Image settings</h3>
          <p className="mt-1 text-xs text-muted">Keep the composer simple. Change details only when you need them.</p>
        </div>
        <Button type="button" variant="ghost" onClick={onDone}>Done</Button>
      </div>

      <div className="mt-4 space-y-4">
        {arenaId === "general-image" ? (
          <>
            <SettingsSelect label="Style" value={style} options={generalStyleOptions} onChange={onStyleChange} />
            <SettingsField label="Exact text" hint="Optional wording to preserve in the image.">
              <input value={exactText} onChange={(event) => onExactTextChange(event.target.value)} maxLength={240} className={detailInputClassName} placeholder="Launch day · 24 August" />
            </SettingsField>
          </>
        ) : null}

        {arenaId === "product-fashion" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SettingsSelect label="Mode" value={mode} options={productModeOptions} onChange={onModeChange} />
              <SettingsSelect label="Scene" value={scene} options={productSceneOptions} onChange={onSceneChange} />
            </div>
            <SettingsSelect label="Goal" value={campaignGoal} options={campaignGoalOptions} onChange={onCampaignGoalChange} />
            <SettingsField label="Background and mood" hint="Optional. Plain English is enough.">
              <textarea value={backgroundMood} onChange={(event) => onBackgroundMoodChange(event.target.value)} rows={3} maxLength={240} className={detailTextareaClassName} placeholder="Warm stone, quiet luxury, clean background." />
            </SettingsField>
          </>
        ) : null}

        {arenaId === "storybook-page" ? (
          <>
            <SettingsSelect label="Art style" value={artStyle} options={artStyleOptions} onChange={onArtStyleChange} />
            <SettingsField label="Main character" hint="Only needed when you do not add a Character image.">
              <textarea value={characterDescription} onChange={(event) => onCharacterDescriptionChange(event.target.value)} rows={3} maxLength={600} className={detailTextareaClassName} placeholder="Mina, age 8, curly hair, yellow raincoat." />
            </SettingsField>
            <SettingsField label="Page text" hint="Optional exact wording.">
              <textarea value={pageText} onChange={(event) => onPageTextChange(event.target.value)} rows={2} maxLength={500} className={detailTextareaClassName} placeholder="“Hello?” Mina whispered." />
            </SettingsField>
          </>
        ) : null}

        {arenaId !== "image-to-sketch" ? <SettingsSelect label="Lighting" value={lighting} options={lightingOptions} onChange={onLightingChange} /> : null}
      </div>
    </div>
  );
}

function SettingsField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <label className="block"><span className="font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted">{hint}</span><span className="mt-2 block">{children}</span></label>;
}

function SettingsSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-semibold">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="min-h-11 w-full rounded-xl border border-border bg-surface-muted px-3 text-sm text-foreground focus:border-brand-neon/50 focus:outline-none">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

const addOptions: Array<{ role: ReferenceRole; label: string; icon: typeof Package }> = [
  { role: "product", label: "Product", icon: Package },
  { role: "model", label: "Model", icon: UserRound },
  { role: "character", label: "Character", icon: WandSparkles },
  { role: "style", label: "Style", icon: Palette },
  { role: "reference", label: "Image", icon: ImagePlus },
];

const productAddOptions = addOptions.filter((option) => option.role !== "character");
const sketchAddOptions: Array<{ role: ReferenceRole; label: string; icon: typeof Package }> = [
  { role: "reference", label: "Add image", icon: ImagePlus },
];

const referenceRoleOptions = addOptions.map(({ role: value, label }) => ({ value, label }));
const productReferenceRoleOptions = productAddOptions.map(({ role: value, label }) => ({ value, label }));
const sketchReferenceRoleOptions = [{ value: "reference" as const, label: "Sketch image" }];
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

const detailInputClassName = "min-h-11 w-full rounded-xl border border-border bg-surface-muted px-3 text-base text-foreground placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none";
const detailTextareaClassName = `${detailInputClassName} resize-none py-3 leading-6`;
