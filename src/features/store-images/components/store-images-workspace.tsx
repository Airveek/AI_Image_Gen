"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Download, Eye, ImageIcon, LoaderCircle, RefreshCw, Search, Sparkles, UploadCloud, X } from "lucide-react";

import { CreatorImageViewer } from "@/features/creator/components/creator-image-viewer";
import { CreatorAssetPicker } from "@/features/creator/components/creator-asset-picker";
import {
  getLatestStoreRunAction,
  publishStoreItemAction,
  publishStoreRunAction,
  retryStoreItemAction,
  startStoreImagesAction,
} from "@/features/store-images/actions";
import type {
  StoreBulkItem,
  StoreBulkRun,
  StoreImageMode,
  StoreProduct,
  StoreProductPage,
} from "@/features/store-images/types";
import type { CreatorAsset } from "@/features/creator/types";
import { cn } from "@/lib/utils";

type Props = {
  initialProducts: StoreProductPage;
  initialRun: StoreBulkRun | null;
  initialLogoAssets: CreatorAsset[];
  connectionError: string | null;
};

const imageModes: Array<{ value: StoreImageMode; label: string; description: string }> = [
  { value: "replace-primary", label: "Replace primary", description: "Replace the main image and keep the rest." },
  { value: "keep-both", label: "Keep both", description: "Add the new image and keep the old gallery." },
  { value: "replace-all", label: "Replace gallery", description: "Use the generated image as the only image." },
];

export function StoreImagesWorkspace({ initialProducts, initialRun, initialLogoAssets, connectionError }: Props) {
  const [products, setProducts] = useState(initialProducts.products);
  const [nextCursor, setNextCursor] = useState(initialProducts.nextCursor);
  const [total, setTotal] = useState(initialProducts.total);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState<"active" | "draft" | "archived">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allMatches, setAllMatches] = useState(false);
  const [prompt, setPrompt] = useState("Create a clean, premium product listing image with a soft neutral studio background.");
  const [logoAssets, setLogoAssets] = useState(initialLogoAssets);
  const [logoAsset, setLogoAsset] = useState<CreatorAsset | null>(() => initialLogoAssets.find((asset) => asset.id === initialRun?.referenceAssetId) ?? null);
  const [imageMode, setImageMode] = useState<StoreImageMode>("replace-primary");
  const [run, setRun] = useState<StoreBulkRun | null>(initialRun);
  const [message, setMessage] = useState(connectionError ?? "");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [viewingItem, setViewingItem] = useState<StoreBulkItem | null>(null);

  const activeRun = run?.status === "queued" || run?.status === "running";
  const readyItems = run?.items.filter((item) => item.status === "ready") ?? [];
  const selectedCount = allMatches ? total : selectedIds.size;

  const loadRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/store-images/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
    if (!response.ok) return;
    const nextRun = await response.json() as StoreBulkRun;
    setRun(nextRun);
  }, []);

  useEffect(() => {
    if (!run || !activeRun) return;
    const timer = window.setInterval(() => {
      void loadRun(run.id);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeRun, loadRun, run]);

  async function loadProducts(options: { reset: boolean; query?: string; productStatus?: typeof status }) {
    setIsLoadingProducts(true);
    setMessage("");
    try {
      const cursor = options.reset ? "" : nextCursor ?? "";
      const params = new URLSearchParams({ limit: "40", status: options.productStatus ?? status });
      if (cursor) params.set("cursor", cursor);
      const query = options.query ?? appliedSearch;
      if (query) params.set("search", query);
      const response = await fetch(`/api/store-images/products?${params.toString()}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(readError(body, "Products could not be loaded."));
      const page = body as StoreProductPage;
      setProducts((current) => options.reset ? page.products : [...current, ...page.products]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      if (options.reset) {
        setSelectedIds(new Set());
        setAllMatches(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Products could not be loaded.");
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function handleStart() {
    if (isStarting || activeRun || isUploadingLogo || selectedCount === 0 || !prompt.trim()) return;
    setIsStarting(true);
    setMessage("");
    try {
      const runId = await startStoreImagesAction({
        prompt,
        referenceAssetId: logoAsset?.id ?? null,
        imageMode,
        selectionMode: allMatches ? "all" : "selected",
        productIds: Array.from(selectedIds),
        search: appliedSearch,
        status,
      });
      const nextRun = await getLatestStoreRunAction();
      setRun(nextRun ?? { id: runId, prompt, referenceAssetId: logoAsset?.id ?? null, imageMode, selectionMode: allMatches ? "all" : "selected", status: "queued", totalCount: 0, completedCount: 0, failedCount: 0, publishedCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [] });
      setMessage("Generation queued. You can leave this page open or come back later.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The bulk run could not be started.");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true);
    setMessage("Saving your logo reference privately…");
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "reference");
      formData.set("name", `Logo — ${file.name.replace(/\.[^.]+$/, "")}`.slice(0, 100));
      const response = await fetch("/api/creator/assets", { method: "POST", body: formData });
      const payload: unknown = await response.json();
      const parsed = readAssetUploadResult(payload);
      if (!parsed.ok) throw new Error(parsed.message);
      setLogoAssets((current) => [parsed.data, ...current.filter((asset) => asset.id !== parsed.data.id)]);
      setLogoAsset(parsed.data);
      setMessage("Logo uploaded. It will be attached as the brand reference for this run.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The logo could not be uploaded.");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  function toggleLogoAsset(asset: CreatorAsset) {
    if (activeRun) return;
    setLogoAsset((current) => current?.id === asset.id ? null : asset);
    setMessage(logoAsset?.id === asset.id ? "Logo reference removed from the next run." : `${asset.name} selected as the logo reference.`);
  }

  async function handlePublishAll() {
    if (!run || readyItems.length === 0 || isPublishing) return;
    setIsPublishing(true);
    try {
      await publishStoreRunAction(run.id);
      setMessage("Completed images are being published to the store.");
      await loadRun(run.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing could not be started.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handlePublishItem(item: StoreBulkItem) {
    setIsPublishing(true);
    try {
      await publishStoreItemAction(item.id);
      setMessage(`${item.productName} is being published.`);
      if (run) await loadRun(run.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This image could not be published.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRetry(item: StoreBulkItem) {
    try {
      await retryStoreItemAction(item.id);
      setMessage(`${item.productName} was added back to the queue.`);
      if (run) await loadRun(run.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "This item could not be retried.");
    }
  }

  function toggleProduct(productId: string) {
    setAllMatches(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(products.map((product) => product.id)));
    setAllMatches(false);
  }

  const viewerAsset = viewingItem?.generatedAssetId
    ? { name: viewingItem.productName, imageUrl: `/api/creator/assets/${viewingItem.generatedAssetId}/file` }
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">Store image studio</p>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Create product images in bulk</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Choose products from your Apindex store, describe the new look once, and review generated images before publishing.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted">
          <span className="font-bold text-white">{selectedCount}</span> products selected
        </div>
      </div>

      {message ? (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-brand-neon/25 bg-brand-neon/10 px-4 py-3 text-sm text-brand-soft" role="status">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} className="rounded-lg p-1 text-brand-soft hover:bg-white/10" aria-label="Dismiss message"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      ) : null}

      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5" aria-label="Store image controls">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_288px]">
          <div>
            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-neon/10 text-brand-neon"><Sparkles className="h-5 w-5" aria-hidden="true" /></span><div><h2 className="font-display text-lg font-bold">Image direction</h2><p className="text-xs text-muted">One instruction will be used for every selected product.</p></div></div>
            <label className="mt-5 block text-sm font-semibold" htmlFor="store-image-prompt">What should the new images look like?</label>
            <textarea id="store-image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 600))} rows={3} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-brand-neon/50 focus:ring-2 focus:ring-brand-neon/20" placeholder="Describe the background, lighting, and mood." />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {imageModes.map((mode) => (
                <label key={mode.value} className={cn("cursor-pointer rounded-xl border p-3 transition-colors", imageMode === mode.value ? "border-brand-neon/60 bg-brand-neon/10" : "border-white/10 hover:border-white/25")}>
                  <input type="radio" name="image-mode" value={mode.value} checked={imageMode === mode.value} onChange={() => setImageMode(mode.value)} className="sr-only" />
                  <span className="flex items-center gap-2 text-sm font-bold">{imageMode === mode.value ? <Check className="h-4 w-4 text-brand-neon" aria-hidden="true" /> : <span className="h-4 w-4 rounded-full border border-white/30" aria-hidden="true" />}{mode.label}</span>
                  <span className="mt-2 block text-xs leading-5 text-muted">{mode.description}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={handleStart} disabled={isStarting || activeRun || isUploadingLogo || selectedCount === 0 || !prompt.trim()} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-neon px-5 text-sm font-bold text-black transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              {isStarting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {isStarting ? "Starting…" : "Generate selected images"}
            </button>
          </div>

          <aside className="rounded-xl border border-white/10 bg-black/15" aria-label="Saved logo assets">
            <CreatorAssetPicker
              assets={logoAssets}
              references={logoAsset ? [{ assetId: logoAsset.id, role: "logo" }] : []}
              onToggle={toggleLogoAsset}
              onUpload={handleLogoUpload}
              isUploading={isUploadingLogo || activeRun}
              preferredRole="logo"
              allowedReferenceRoles={["logo"]}
              defaultUploadRole="logo"
              helperText="Reuse a saved logo in future runs."
              compact
            />
          </aside>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs" aria-label="Run status">
        <span className="font-semibold uppercase tracking-[0.14em] text-muted">Run status</span>
        {run ? <>
          <span className={cn("rounded-full border px-2 py-0.5 font-semibold capitalize", run.status === "completed" ? "border-brand-neon/30 bg-brand-neon/10 text-brand-neon" : run.status === "failed" ? "border-red-300/30 bg-red-300/10 text-red-200" : "border-white/10 bg-white/[0.04] text-white")}>{run.status.replaceAll("-", " ")}</span>
          <span className="text-muted">{run.completedCount}/{run.totalCount || "—"} ready</span>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10" aria-label={`${run.completedCount} of ${run.totalCount || 0} completed`} role="progressbar" aria-valuemax={run.totalCount} aria-valuemin={0} aria-valuenow={run.completedCount}><div className="h-full rounded-full bg-brand-neon transition-all" style={{ width: `${run.totalCount ? Math.min((run.completedCount / run.totalCount) * 100, 100) : 0}%` }} /></div>
          <span className="text-muted">{run.failedCount} failed · {run.publishedCount} published</span>
          {readyItems.length > 0 ? <button type="button" onClick={handlePublishAll} disabled={isPublishing} className="ml-auto inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-brand-neon/40 px-3 font-bold text-brand-neon hover:bg-brand-neon/10 disabled:opacity-50"><UploadCloud className="h-3.5 w-3.5" aria-hidden="true" /> Publish {readyItems.length}</button> : null}
        </> : <span className="text-muted">No run yet. Generated images will stay here until you publish them.</span>}
      </section>

      {run?.items.length ? <section className="mt-8" aria-labelledby="results-heading"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-neon">Results</p><h2 id="results-heading" className="mt-1 font-display text-2xl font-bold">Generated images</h2><p className="mt-1 text-sm text-muted">Review each image before it reaches your store.</p></div><button type="button" onClick={() => run && void loadRun(run.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-white/[0.05] hover:text-white"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button></div><div className={cn("mt-5 grid gap-4", run.items.length === 1 ? "max-w-5xl" : "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4")}>{run.items.map((item) => <ResultCard key={item.id} item={item} featured={run.items.length === 1} onView={() => setViewingItem(item)} onPublish={() => void handlePublishItem(item)} onRetry={() => void handleRetry(item)} disabled={isPublishing} />)}</div></section> : null}

      <section className="mt-7" aria-labelledby="products-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 id="products-heading" className="font-display text-2xl font-bold">Store products</h2><p className="mt-1 text-sm text-muted">Showing {products.length} of {total} products</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { const query = search.trim(); setAppliedSearch(query); void loadProducts({ reset: true, query }); } }} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none focus:border-brand-neon/50 sm:w-64" placeholder="Search products" aria-label="Search products" /></div>
            <select value={status} onChange={(event) => { const nextStatus = event.target.value as typeof status; const query = search.trim(); setStatus(nextStatus); setAppliedSearch(query); void loadProducts({ reset: true, query, productStatus: nextStatus }); }} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-brand-neon/50" aria-label="Product status"><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><button type="button" onClick={selectAllVisible} className="min-h-10 rounded-lg border border-white/10 px-3 font-semibold text-muted hover:border-white/25 hover:text-white">Select visible</button><button type="button" onClick={() => { setAllMatches(true); setSelectedIds(new Set()); }} className={cn("min-h-10 rounded-lg border px-3 font-semibold", allMatches ? "border-brand-neon/50 bg-brand-neon/10 text-brand-neon" : "border-white/10 text-muted hover:border-white/25 hover:text-white")}>Select all matching ({total})</button>{selectedIds.size > 0 || allMatches ? <button type="button" onClick={() => { setSelectedIds(new Set()); setAllMatches(false); }} className="min-h-10 rounded-lg px-3 font-semibold text-muted hover:text-white">Clear selection</button> : null}</div>

        {products.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} selected={allMatches || selectedIds.has(product.id)} onToggle={() => toggleProduct(product.id)} />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-sm text-muted">{isLoadingProducts ? "Loading products…" : "No products matched this search."}</div>}
        {nextCursor ? <button type="button" onClick={() => void loadProducts({ reset: false })} disabled={isLoadingProducts} className="mx-auto mt-6 flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-bold text-white hover:border-white/25 disabled:opacity-50">{isLoadingProducts ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />} Load more</button> : null}
      </section>

      <CreatorImageViewer asset={viewerAsset} onClose={() => setViewingItem(null)} />
    </div>
  );
}

function ProductCard({ product, selected, onToggle }: { product: StoreProduct; selected: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} className={cn("group relative overflow-hidden rounded-2xl border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon", selected ? "border-brand-neon/60 bg-brand-neon/10" : "border-white/10 bg-white/[0.035] hover:border-white/25")} aria-pressed={selected}><div className="relative aspect-square bg-black/20">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]" sizes="(max-width: 640px) 50vw, (max-width: 1536px) 33vw, 25vw" /> : <div className="flex h-full items-center justify-center text-muted"><ImageIcon className="h-8 w-8" aria-hidden="true" /></div>}<span className={cn("absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border", selected ? "border-brand-neon bg-brand-neon text-black" : "border-white/30 bg-black/40 text-transparent")}><Check className="h-4 w-4" aria-hidden="true" /></span></div><div className="p-4"><p className="truncate text-sm font-bold text-white">{product.name}</p><p className="mt-1 truncate text-xs text-muted">{product.handle}</p></div></button>;
}

function ResultCard({ item, featured, onView, onPublish, onRetry, disabled }: { item: StoreBulkItem; featured: boolean; onView: () => void; onPublish: () => void; onRetry: () => void; disabled: boolean }) {
  const imageUrl = item.generatedAssetId ? `/api/creator/assets/${item.generatedAssetId}/file` : item.publishedImageUrl;
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]"><button type="button" onClick={onView} disabled={!imageUrl} className={cn("group relative block w-full overflow-hidden bg-[#121412] disabled:cursor-default", featured ? "aspect-[4/3] min-h-[420px] sm:aspect-[16/10]" : "aspect-square")}><div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_center,rgba(131,255,0,0.08),transparent_38%)]" aria-hidden="true" />{imageUrl ? <Image src={imageUrl} alt={`Generated image for ${item.productName}`} fill unoptimized priority={featured} className="object-contain p-6 transition-transform duration-300 group-hover:scale-[1.01] sm:p-10" sizes={featured ? "(max-width: 1024px) 100vw, 960px" : "(max-width: 640px) 100vw, (max-width: 1536px) 33vw, 25vw"} /> : <div className="relative flex h-full flex-col items-center justify-center gap-2 text-muted">{item.status === "generating" ? <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-7 w-7" aria-hidden="true" />}<span className="text-xs capitalize">{item.status.replaceAll("-", " ")}</span></div>}{imageUrl ? <span className="absolute right-3 top-3 flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Eye className="h-4 w-4" aria-hidden="true" /><span className="sr-only">View generated image</span></span> : null}</button><div className="p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm font-bold">{item.productName}</p><span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", item.status === "failed" ? "border-red-300/30 bg-red-300/10 text-red-200" : item.status === "published" ? "border-brand-neon/30 bg-brand-neon/10 text-brand-neon" : "border-white/10 text-muted")}>{item.status.replaceAll("-", " ")}</span></div>{item.errorMessage ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-red-200">{item.errorMessage}</p> : null}<div className="mt-3 flex gap-2">{item.status === "ready" ? <button type="button" onClick={onPublish} disabled={disabled} className="min-h-10 flex-1 rounded-lg bg-brand-neon px-3 text-xs font-bold text-black hover:bg-brand-soft disabled:opacity-50">Publish</button> : null}{item.status === "failed" ? <button type="button" onClick={onRetry} className="min-h-10 flex-1 rounded-lg border border-white/10 px-3 text-xs font-bold hover:border-white/25">Retry</button> : null}{imageUrl ? <button type="button" onClick={onView} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-bold text-muted hover:border-white/25 hover:text-white">View</button> : null}{imageUrl ? <a href={`${imageUrl}?download=1`} download onClick={(event) => event.stopPropagation()} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/10 text-muted hover:border-white/25 hover:text-white" aria-label={`Download ${item.productName}`}><Download className="h-4 w-4" aria-hidden="true" /></a> : null}</div></div></article>;
}

function readError(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as Record<string, unknown>).error === "string") return (value as Record<string, unknown>).error as string;
  return fallback;
}

function readAssetUploadResult(value: unknown): { ok: true; data: CreatorAsset } | { ok: false; message: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, message: "The logo upload returned an invalid response." };
  const record = value as Record<string, unknown>;
  if (record.ok === true && typeof record.data === "object" && record.data !== null && !Array.isArray(record.data)) {
    const asset = record.data as Record<string, unknown>;
    if (typeof asset.id === "string" && typeof asset.name === "string" && asset.kind === "reference") {
      return { ok: true, data: asset as unknown as CreatorAsset };
    }
  }
  return { ok: false, message: typeof record.message === "string" ? record.message : "The logo could not be uploaded." };
}
