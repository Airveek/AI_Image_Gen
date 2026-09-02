"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowDownUp, Check, ChevronRight, CircleAlert, CloudUpload, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CreatorAsset, CreatorAssetKind, GenerationReference, ReferenceRole } from "@/features/creator/types";
import { cn } from "@/lib/utils";

type UploadKind = Exclude<CreatorAssetKind, "generation">;
type AssetGroupId = "products" | "models" | "characters" | "references" | "recent";
type SortMode = "recent" | "az";
type AssetGroup = { id: AssetGroupId; kind: CreatorAssetKind; label: string; role: ReferenceRole; newLabel: string | null };

export type CreatorUploadState =
  | {
      phase: "uploading";
      fileName: string;
      loadedBytes: number;
      totalBytes: number | null;
      percent: number | null;
    }
  | { phase: "saving"; fileName: string }
  | { phase: "error"; fileName: string; message: string };

const assetGroups: AssetGroup[] = [
  { id: "products", kind: "product", label: "Products", role: "product", newLabel: "New product" },
  { id: "models", kind: "person", label: "Models", role: "model", newLabel: "New model" },
  { id: "characters", kind: "character", label: "Characters", role: "character", newLabel: "New character" },
  { id: "references", kind: "reference", label: "References", role: "reference", newLabel: "New reference" },
  { id: "recent", kind: "generation", label: "Recent", role: "reference", newLabel: null },
];

export function CreatorAssetPicker({
  assets,
  references,
  onToggle,
  onUpload,
  isUploading,
  preferredRole,
  allowedReferenceRoles,
  defaultUploadRole = "reference",
  helperText,
  compact = false,
  uploadInputTestId,
  presentation = "classic",
  uploadState,
  onRequestDelete,
  deletingAssetId,
}: {
  assets: CreatorAsset[];
  references: GenerationReference[];
  onToggle: (asset: CreatorAsset, role: ReferenceRole) => void;
  onUpload: (file: File, kind: UploadKind, role: ReferenceRole) => Promise<void>;
  isUploading: boolean;
  preferredRole?: ReferenceRole | null;
  allowedReferenceRoles?: readonly ReferenceRole[];
  defaultUploadRole?: ReferenceRole;
  helperText?: string;
  compact?: boolean;
  uploadInputTestId?: string;
  presentation?: "classic" | "kive";
  uploadState?: CreatorUploadState | null;
  onRequestDelete?: (asset: CreatorAsset) => void;
  deletingAssetId?: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchId = useId();
  const uploadRole = preferredRole ?? defaultUploadRole;
  const [search, setSearch] = useState("");
  const [openGroup, setOpenGroup] = useState<AssetGroupId>(() => assetGroupIdForRole(uploadRole));
  const [sortGroup, setSortGroup] = useState<AssetGroupId | null>(null);
  const [sortModes, setSortModes] = useState<Record<AssetGroupId, SortMode>>({ products: "recent", models: "recent", characters: "recent", references: "recent", recent: "recent" });
  const [pendingUploadRole, setPendingUploadRole] = useState<ReferenceRole>(uploadRole);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleOpenGroup = preferredRole ? assetGroupIdForRole(preferredRole) : openGroup;

  useEffect(() => {
    if (!sortGroup) return;
    function closeSortMenu(event: PointerEvent) {
      if (event.target instanceof Node && !pickerRef.current?.contains(event.target)) setSortGroup(null);
    }
    function closeSortOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setSortGroup(null);
    }
    document.addEventListener("pointerdown", closeSortMenu);
    document.addEventListener("keydown", closeSortOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeSortMenu);
      document.removeEventListener("keydown", closeSortOnEscape);
    };
  }, [sortGroup]);

  const groups = useMemo(() => assetGroups
    .filter((group) => groupAllowed(group, preferredRole, allowedReferenceRoles))
    .map((group) => {
      const groupAssets = assets.filter((asset) => asset.kind === group.kind && asset.status === "ready").filter((asset) => !normalizedSearch || asset.name.toLowerCase().includes(normalizedSearch));
      const sortedAssets = [...groupAssets].sort((left, right) => sortModes[group.id] === "az" ? left.name.localeCompare(right.name) : right.createdAt.localeCompare(left.createdAt));
      return { ...group, assets: sortedAssets };
    }), [allowedReferenceRoles, assets, normalizedSearch, preferredRole, sortModes]);

  function openUpload(role: ReferenceRole) {
    setPendingUploadRole(role);
    fileInputRef.current?.click();
  }

  function selectSort(groupId: AssetGroupId, mode: SortMode) {
    setSortModes((current) => ({ ...current, [groupId]: mode }));
    setSortGroup(null);
  }

  if (presentation === "kive") {
    return (
      <div ref={pickerRef} className={cn("h-full min-h-0 overflow-y-auto overscroll-contain", compact ? "p-3" : "px-3 pb-4 pt-3")}>
        <label className="relative block" htmlFor={searchId}>
          <span className="sr-only">Search assets</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id={searchId} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" className="min-h-10 w-full rounded-xl border border-border bg-surface-muted pl-10 pr-9 text-sm text-foreground placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none" />
          {search ? <button type="button" onClick={() => setSearch("")} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground" aria-label="Clear search"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
        </label>
        <input ref={fileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" data-testid={uploadInputTestId} onChange={(event) => { const file = event.target.files?.[0]; const role = preferredRole ?? pendingUploadRole; if (file) void onUpload(file, assetKindForRole(role), role); event.target.value = ""; }} />
        {uploadState ? <UploadStatusCard state={uploadState} /> : null}

        <div className="mt-4 space-y-1">
          {groups.map((group) => {
            const expanded = visibleOpenGroup === group.id;
            const sortOpen = sortGroup === group.id;
            return (
              <section key={group.id} aria-label={group.label} className="border-b border-white/[0.06] pb-1 last:border-0">
                <div className="flex min-h-10 items-center gap-1">
                  <button type="button" onClick={() => { setOpenGroup(expanded ? "products" : group.id); setSortGroup(null); }} aria-expanded={expanded} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", expanded && "rotate-90")} aria-hidden="true" /><span className="truncate">{group.label}</span></button>
                  <div className="relative flex shrink-0 items-center">
                    <button type="button" onClick={() => setSortGroup(sortOpen ? null : group.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" aria-label={`Sort ${group.label}`} aria-haspopup="menu" aria-expanded={sortOpen}><ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    {group.newLabel ? <button type="button" onClick={() => openUpload(group.role)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus" aria-label={group.newLabel} title={group.newLabel} disabled={isUploading}><Plus className="h-4 w-4" aria-hidden="true" /></button> : null}
                    {sortOpen ? <div role="menu" aria-label={`Sort ${group.label}`} className="absolute right-0 top-10 z-30 min-w-44 rounded-xl border border-border bg-popover p-1.5 shadow-2xl"><button type="button" role="menuitemradio" aria-checked={sortModes[group.id] === "recent"} onClick={() => selectSort(group.id, "recent")} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><span>Recently added</span>{sortModes[group.id] === "recent" ? <Check className="h-4 w-4 text-brand-neon" aria-hidden="true" /> : null}</button><button type="button" role="menuitemradio" aria-checked={sortModes[group.id] === "az"} onClick={() => selectSort(group.id, "az")} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"><span>A–Z</span>{sortModes[group.id] === "az" ? <ArrowDownAZ className="h-4 w-4 text-brand-neon" aria-hidden="true" /> : null}</button></div> : null}
                  </div>
                </div>
                {expanded ? <div className="grid grid-cols-2 gap-2 px-1 pb-2 pt-1">{group.assets.slice(0, compact ? 12 : 40).map((asset) => <AssetCard key={asset.id} asset={asset} role={group.role} references={references} onToggle={onToggle} onRequestDelete={onRequestDelete} deletingAssetId={deletingAssetId} expanded />)}{group.assets.length === 0 ? <p className="col-span-2 px-2 py-4 text-xs leading-5 text-muted">{normalizedSearch ? "No matching assets." : "No saved assets yet."}</p> : null}</div> : <div className="flex gap-2 overflow-hidden px-1 pb-2 pt-1">{group.assets.slice(0, 4).map((asset) => <AssetCard key={asset.id} asset={asset} role={group.role} references={references} onToggle={onToggle} />)}{group.assets.length === 0 ? <p className="px-2 py-2 text-xs text-muted">No assets</p> : null}</div>}
              </section>
            );
          })}
        </div>
        {groups.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-muted">No matching assets. Try another search.</div> : null}
        {helperText ? <p className="mt-4 px-1 text-xs leading-5 text-muted">{helperText}</p> : null}
      </div>
    );
  }

  const classicGroups = groups.filter((group) => group.assets.length > 0);
  const readyCount = assets.filter((asset) => asset.status === "ready").length;
  return (
    <div className={cn(compact ? "p-3" : "p-4", !compact && "h-full overflow-y-auto overscroll-contain")}>
      <div className="flex items-center justify-between gap-3"><div><h2 className={cn("font-display font-bold", compact ? "text-sm" : "text-lg")}>Assets</h2><p className="line-clamp-1 text-xs text-muted">{helperText ?? (preferredRole ? `Choose a ${referenceRoleLabel(preferredRole).toLowerCase()}` : "Choose up to two")}</p></div><Button type="button" size="icon" variant="secondary" onClick={() => openUpload(uploadRole)} disabled={isUploading} aria-label={`Upload ${referenceRoleLabel(uploadRole)} image`} title={`Upload ${referenceRoleLabel(uploadRole)} image`}>{isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}</Button></div>
      <label className={cn("relative block", compact ? "mt-3" : "mt-4")} htmlFor={searchId}><span className="sr-only">Search assets</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" /><input id={searchId} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" className={cn("w-full rounded-xl border border-border bg-surface-muted pl-10 pr-3 text-sm text-foreground placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none", compact ? "min-h-10" : "min-h-11")} /></label>
      <input ref={fileInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" data-testid={uploadInputTestId} onChange={(event) => { const file = event.target.files?.[0]; const role = preferredRole ?? pendingUploadRole; if (file) void onUpload(file, assetKindForRole(role), role); event.target.value = ""; }} />
      {uploadState ? <UploadStatusCard state={uploadState} /> : null}
      <div className={cn("space-y-5", compact ? "mt-3 space-y-3" : "mt-5")}>{classicGroups.map((group) => <section key={group.id} aria-label={group.label}><h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{group.label}</h3><div className="grid grid-cols-4 gap-2">{group.assets.slice(0, group.kind === "generation" ? 12 : 16).map((asset) => <AssetCard key={asset.id} asset={asset} role={group.role} references={references} onToggle={onToggle} />)}</div></section>)}{readyCount === 0 ? <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-muted">No saved assets yet. Upload the first image above.</div> : groups.length === 0 ? <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs leading-5 text-muted">No matching assets. Try another search or upload a new image.</div> : null}</div>
    </div>
  );
}

function AssetCard({ asset, role, references, onToggle, onRequestDelete, deletingAssetId, expanded = false }: { asset: CreatorAsset; role: ReferenceRole; references: GenerationReference[]; onToggle: (asset: CreatorAsset, role: ReferenceRole) => void; onRequestDelete?: (asset: CreatorAsset) => void; deletingAssetId?: string | null; expanded?: boolean }) {
  const selectedIndex = references.findIndex((reference) => reference.assetId === asset.id);
  const selected = selectedIndex >= 0;
  const canDelete = expanded && asset.kind !== "generation" && Boolean(onRequestDelete);
  const isDeleting = deletingAssetId === asset.id;
  return (
    <div className={cn("group relative min-w-0 overflow-hidden rounded-lg border bg-brand-panel transition-colors", expanded ? "aspect-[1/1.05]" : "h-16 w-16 shrink-0", selected ? "border-brand-neon ring-2 ring-brand-neon/20" : "border-border hover:border-primary/30")}>
      <button type="button" onClick={() => onToggle(asset, role)} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Use"} ${asset.name} as ${referenceRoleLabel(role)}`} title={asset.name} className="absolute inset-0 block h-full w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-focus">
        {asset.imageUrl ? <Image src={asset.imageUrl} alt="" fill unoptimized className="object-cover" sizes={expanded ? "120px" : "64px"} /> : null}
        {expanded ? <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/95 to-transparent px-2 pb-1.5 pt-5 text-[11px] text-white">{asset.name}</span> : null}
      </button>
      {selected && expanded ? <span className="pointer-events-none absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-brand-neon text-xs font-bold text-primary-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" /></span> : null}
      {canDelete ? (
        <button type="button" onClick={() => onRequestDelete?.(asset)} disabled={isDeleting} className="absolute right-1 top-1 z-10 flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-black/75 text-white shadow-md transition hover:bg-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Delete ${asset.name}`} title={`Delete ${asset.name}`}>
          {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  );
}

function UploadStatusCard({ state }: { state: CreatorUploadState }) {
  const isError = state.phase === "error";
  const percent = state.phase === "uploading" ? state.percent : null;
  const status = state.phase === "uploading"
    ? percent === null ? "Uploading image…" : `Uploading image… ${percent}%`
    : state.phase === "saving"
      ? "Finishing secure save…"
      : state.message;

  return (
    <section className={cn("mt-3 rounded-xl border p-3", isError ? "border-danger/35 bg-danger-soft" : "border-brand-neon/25 bg-brand-neon/5")} aria-busy={!isError} data-testid="asset-upload-progress">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", isError ? "bg-danger/10 text-danger" : "bg-brand-neon/10 text-brand-neon")}>
          {isError ? <CircleAlert className="h-5 w-5" aria-hidden="true" /> : state.phase === "saving" ? <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CloudUpload className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground" title={state.fileName}>{state.fileName}</p>
          <p className={cn("mt-0.5 text-xs leading-5", isError ? "text-danger" : "text-muted")}>{status}</p>
        </div>
      </div>
      {!isError ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-label={`Upload progress for ${state.fileName}`} aria-valuemin={0} aria-valuemax={100} {...(percent === null ? {} : { "aria-valuenow": percent })}>
          <div className={cn("h-full rounded-full bg-brand-neon motion-reduce:transition-none", percent === null && "w-1/2 animate-pulse motion-reduce:animate-none", percent !== null && "transition-[width] duration-200")} style={percent === null ? undefined : { width: `${percent}%` }} />
        </div>
      ) : null}
      <span className="sr-only" role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"}>{state.phase === "uploading" ? `Uploading ${state.fileName}.` : state.phase === "saving" ? `Upload complete. Saving ${state.fileName}.` : `Upload failed. ${state.message}`}</span>
    </section>
  );
}

function groupAllowed(group: AssetGroup, preferredRole: ReferenceRole | null | undefined, allowedRoles: readonly ReferenceRole[] | undefined): boolean {
  if (allowedRoles && !allowedRoles.some((role) => role === group.role || (group.kind === "reference" && role === "style"))) return false;
  if (!preferredRole) return true;
  return preferredRole === group.role || (group.kind === "reference" && (preferredRole === "style" || preferredRole === "reference"));
}

function assetKindForRole(role: ReferenceRole): UploadKind {
  if (role === "product") return "product";
  if (role === "model") return "person";
  if (role === "character") return "character";
  return "reference";
}

function assetGroupIdForRole(role: ReferenceRole): AssetGroupId {
  if (role === "product") return "products";
  if (role === "model") return "models";
  if (role === "character") return "characters";
  return "references";
}

export function referenceRoleLabel(role: ReferenceRole): string {
  return { product: "Product", model: "Model", character: "Character", style: "Style", logo: "Logo", reference: "Reference" }[role];
}

export function defaultRoleForAsset(asset: CreatorAsset): ReferenceRole {
  if (asset.kind === "product") return "product";
  if (asset.kind === "person") return "model";
  if (asset.kind === "character") return "character";
  return "reference";
}
