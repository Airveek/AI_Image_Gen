"use client";

import Image from "next/image";
import { useId, useMemo, useRef, useState } from "react";
import { LoaderCircle, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CreatorAsset,
  CreatorAssetKind,
  GenerationReference,
  ReferenceRole,
} from "@/features/creator/types";
import { cn } from "@/lib/utils";

type UploadKind = Exclude<CreatorAssetKind, "generation">;

const assetGroups: Array<{
  kind: CreatorAssetKind;
  label: string;
  role: ReferenceRole;
}> = [
  { kind: "product", label: "Products", role: "product" },
  { kind: "person", label: "Models", role: "model" },
  { kind: "character", label: "Characters", role: "character" },
  { kind: "reference", label: "References", role: "reference" },
  { kind: "generation", label: "Recent", role: "reference" },
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
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const [search, setSearch] = useState("");
  const uploadRole = preferredRole ?? defaultUploadRole;
  const uploadKind = assetKindForRole(uploadRole);
  const normalizedSearch = search.trim().toLowerCase();

  const groups = useMemo(() => {
    return assetGroups
      .filter((group) => {
        const role = preferredRole ?? group.role;
        return (!allowedReferenceRoles || allowedReferenceRoles.includes(role)) && (!preferredRole || roleAllowsKind(preferredRole, group.kind));
      })
      .map((group) => ({
        ...group,
        role: preferredRole ?? group.role,
        assets: assets.filter((asset) => {
          if (asset.kind !== group.kind || asset.status !== "ready") return false;
          return !normalizedSearch || asset.name.toLowerCase().includes(normalizedSearch);
        }),
      }))
      .filter((group) => group.assets.length > 0);
  }, [assets, allowedReferenceRoles, normalizedSearch, preferredRole]);

  const readyCount = assets.filter((asset) => asset.status === "ready").length;

  return (
    <div className={cn("p-4", !compact && "h-full overflow-y-auto overscroll-contain")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Assets</h2>
          <p className="text-xs text-muted">
            {helperText ?? (preferredRole ? `Choose a ${referenceRoleLabel(preferredRole).toLowerCase()}` : "Choose up to two")}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label={`Upload ${referenceRoleLabel(uploadRole)} image`}
          title={`Upload ${referenceRoleLabel(uploadRole)} image`}
        >
          {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          data-testid={uploadInputTestId}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(file, uploadKind, uploadRole);
            event.target.value = "";
          }}
        />
      </div>

      <label className="relative mt-4 block" htmlFor={searchId}>
        <span className="sr-only">Search assets</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search assets"
          className="min-h-11 w-full rounded-xl border border-white/12 bg-white/[0.045] pl-10 pr-3 text-sm text-white placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none"
        />
      </label>

      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <section key={group.kind} aria-label={group.label}>
            <h3 className="mb-2 text-xs font-semibold text-muted">{group.label}</h3>
            <div className="grid grid-cols-4 gap-2">
              {group.assets.slice(0, group.kind === "generation" ? 12 : 16).map((asset) => {
                const selectedIndex = references.findIndex((reference) => reference.assetId === asset.id);
                const selectedRole = selectedIndex >= 0 ? references[selectedIndex]?.role : null;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => onToggle(asset, group.role)}
                    aria-pressed={selectedIndex >= 0}
                    aria-label={`${selectedIndex >= 0 ? "Remove" : "Use"} ${asset.name} as ${referenceRoleLabel(group.role)}`}
                    className={cn(
                      "group relative aspect-square min-w-0 overflow-hidden rounded-lg border bg-brand-panel transition-colors",
                      selectedIndex >= 0
                        ? "border-brand-neon ring-2 ring-brand-neon/20"
                        : "border-white/10 hover:border-white/30",
                    )}
                    title={asset.name}
                  >
                    {asset.imageUrl ? <Image src={asset.imageUrl} alt="" fill unoptimized className="object-cover" sizes="72px" /> : null}
                    {selectedIndex >= 0 ? (
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-neon text-xs font-bold text-black">
                        {selectedIndex + 1}
                      </span>
                    ) : null}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/95 to-transparent px-1.5 pb-1 pt-5 text-left text-[10px] text-white">
                      {selectedRole ? referenceRoleLabel(selectedRole) : asset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {readyCount === 0 ? (
          <div className="rounded-xl border border-dashed border-white/12 p-5 text-center text-xs leading-5 text-muted">
            No saved assets yet. Upload the first image above.
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/12 p-5 text-center text-xs leading-5 text-muted">
            No matching assets. Try another search or upload a new image.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function referenceRoleLabel(role: ReferenceRole): string {
  return {
    product: "Product",
    model: "Model",
    character: "Character",
    style: "Style",
    reference: "Reference",
  }[role];
}

export function defaultRoleForAsset(asset: CreatorAsset): ReferenceRole {
  if (asset.kind === "product") return "product";
  if (asset.kind === "person") return "model";
  if (asset.kind === "character") return "character";
  return "reference";
}

function assetKindForRole(role: ReferenceRole): UploadKind {
  if (role === "product") return "product";
  if (role === "model") return "person";
  if (role === "character") return "character";
  return "reference";
}

function roleAllowsKind(role: ReferenceRole, kind: CreatorAssetKind): boolean {
  if (role === "product") return kind === "product";
  if (role === "model") return kind === "person";
  if (role === "character") return kind === "character";
  return kind === "reference" || kind === "generation";
}
