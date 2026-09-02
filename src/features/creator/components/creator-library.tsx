"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Download,
  ExternalLink,
  ImageIcon,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type {
  CreatorArenaId,
  CreatorAsset,
  CreatorAssetKind,
  CreatorResult,
} from "@/features/creator/types";
import { cn } from "@/lib/utils";

type LibraryFilter = "all" | CreatorAssetKind;

const filters: Array<{ id: LibraryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "generation", label: "Generated" },
  { id: "product", label: "Products" },
  { id: "person", label: "People" },
  { id: "character", label: "Characters" },
  { id: "reference", label: "References" },
];

export function CreatorLibrary({
  initialAssets,
  storageMessage,
}: {
  initialAssets: CreatorAsset[];
  storageMessage: string | null;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CreatorAsset | null>(null);
  const [renameTarget, setRenameTarget] = useState<CreatorAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreatorAsset | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState(storageMessage ?? "");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleAssets = assets.filter((asset) =>
    (filter === "all" || asset.kind === filter) &&
    (!normalizedSearch || asset.name.toLowerCase().includes(normalizedSearch)),
  );

  async function renameAsset() {
    if (!renameTarget || !renameValue.trim()) return;
    setPendingId(renameTarget.id);
    try {
      const response = await fetch(`/api/creator/assets/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: renameValue }),
      });
      const parsed = readAssetResult(await response.json());
      if (!parsed.ok) {
        setMessage(parsed.message);
        return;
      }
      setAssets((current) => current.map((asset) => asset.id === parsed.data.id ? parsed.data : asset));
      setMessage("Image renamed.");
      setRenameTarget(null);
    } catch {
      setMessage("The image could not be renamed. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function deleteAsset() {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    try {
      const response = await fetch(`/api/creator/assets/${deleteTarget.id}`, { method: "DELETE" });
      const body: unknown = await response.json();
      if (!isSuccessResponse(body)) {
        setMessage(readErrorMessage(body, "The image could not be deleted."));
        return;
      }
      setAssets((current) => current.filter((asset) => asset.id !== deleteTarget.id));
      setMessage("Image deleted from Airveek, Drive, and the hot cache.");
      setDeleteTarget(null);
      setSelected((current) => current?.id === deleteTarget.id ? null : current);
    } catch {
      setMessage("The image could not be deleted. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-neon">Private workspace</p>
          <h1 className="mt-3 font-display text-4xl font-bold">Your library</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Products, people, characters, references, and every successful creation in one place.</p>
        </div>
        <Link href="/create/general-image" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-neon px-5 text-sm font-bold text-primary-foreground hover:bg-brand-soft">
          Create image <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-4 border-y border-border py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Asset type filters">
          {filters.map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={cn("min-h-11 rounded-xl border px-4 text-sm font-semibold", filter === item.id ? "border-brand-neon/40 bg-brand-neon/10 text-brand-soft" : "border-border text-muted hover:text-foreground")}>{item.label}</button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <label className="sr-only" htmlFor="library-search">Search library</label>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input id="library-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name" className="min-h-11 w-full rounded-xl border border-border bg-surface-muted pl-10 pr-10 text-sm text-foreground placeholder:text-brand-gray focus:border-brand-neon/50 focus:outline-none focus-visible:outline-none" />
          {search ? <button type="button" onClick={() => setSearch("")} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-foreground" aria-label="Clear search"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
        </div>
      </div>

      <p className="mt-4 min-h-6 text-sm text-muted" aria-live="polite">{message}</p>

      {visibleAssets.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleAssets.map((asset) => (
            <article key={asset.id} className="group relative overflow-hidden rounded-2xl border border-border bg-surface-muted">
              <button type="button" onClick={() => setSelected(asset)} className="group relative block aspect-square w-full overflow-hidden bg-brand-panel text-left" aria-label={`View ${asset.name}`}>
                {asset.imageUrl ? <Image src={asset.imageUrl} alt={asset.name} fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" sizes="(max-width: 640px) 50vw, 20vw" /> : <ImageIcon className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />}
                {asset.status !== "ready" ? <Badge className="absolute left-2 top-2" variant={asset.status === "failed" ? "danger" : "warning"}>{asset.status}</Badge> : null}
              </button>
              {asset.kind === "generation" && asset.imageUrl ? (
                <a
                  href={`${asset.imageUrl}?download=1`}
                  download
                  onClick={(event) => event.stopPropagation()}
                  className="absolute right-3 top-3 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white opacity-0 shadow-lg backdrop-blur transition-opacity hover:bg-black focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus group-hover:opacity-100"
                  aria-label={`Download ${asset.name}`}
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                </a>
              ) : null}
              <div className="p-3">
                <p className="truncate text-sm font-semibold">{asset.name}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs capitalize text-muted">{asset.kind}</span>
                  <div className="flex">
                    <button type="button" onClick={() => { setRenameTarget(asset); setRenameValue(asset.name); }} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground" aria-label={`Rename ${asset.name}`}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => setDeleteTarget(asset)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-danger" aria-label={`Delete ${asset.name}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface-muted px-6 py-20 text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-brand-neon" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold">Nothing here yet</h2>
          <p className="mt-2 text-sm text-muted">{assets.length ? "Try another filter or search." : "Upload a reference or create your first image."}</p>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} title={selected?.name ?? "Image"} description={selected ? `${capitalize(selected.kind)} · ${new Date(selected.createdAt).toLocaleDateString()}` : undefined}>
        {selected ? (
          <div>
            <div className="relative aspect-square overflow-hidden rounded-xl bg-media-stage">
              {selected.imageUrl ? <Image src={selected.imageUrl} alt={selected.name} fill unoptimized className="object-contain" sizes="500px" /> : null}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {selected.imageUrl ? <a href={`${selected.imageUrl}?download=1`} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-4 text-sm font-semibold hover:border-brand-neon/40"><Download className="h-4 w-4" aria-hidden="true" /> Download</a> : null}
              <Link href={`/create/${reuseArena(selected)}?asset=${selected.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-neon px-4 text-sm font-bold text-primary-foreground hover:bg-brand-soft"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reuse</Link>
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => { if (!open) setRenameTarget(null); }} title="Rename image" description="Use a short name that will be easy to find later.">
        <label htmlFor="rename-value" className="text-sm font-semibold">Name</label>
        <input id="rename-value" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={100} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-surface-muted px-3 text-sm focus:border-brand-neon/50 focus:outline-none focus-visible:outline-none" />
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button><Button type="button" variant="primary" onClick={() => void renameAsset()} disabled={!renameValue.trim() || pendingId === renameTarget?.id}>{pendingId === renameTarget?.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Save</Button></div>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="Permanently delete image?" description="This removes the Drive archive, R2 hot copy, and Airveek record. This cannot be undone.">
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button type="button" variant="danger" onClick={() => void deleteAsset()} disabled={pendingId === deleteTarget?.id}>{pendingId === deleteTarget?.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />} Delete permanently</Button></div>
      </Dialog>
    </div>
  );
}

function reuseArena(asset: CreatorAsset): CreatorArenaId {
  if (asset.arenaId) return asset.arenaId;
  if (asset.kind === "product" || asset.kind === "person") return "product-fashion";
  if (asset.kind === "character") return "storybook-page";
  return "general-image";
}

function readAssetResult(value: unknown): CreatorResult<CreatorAsset> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, message: "Invalid server response.", code: "unknown" };
  const record = value as Record<string, unknown>;
  if (record.ok === false && typeof record.message === "string") return { ok: false, message: record.message, code: "unknown" };
  if (record.ok === true && typeof record.data === "object" && record.data !== null) return { ok: true, data: record.data as CreatorAsset };
  return { ok: false, message: "Invalid server response.", code: "unknown" };
}

function isSuccessResponse(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && (value as Record<string, unknown>).ok === true;
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
  const message = (value as Record<string, unknown>).message;
  return typeof message === "string" ? message : fallback;
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
