"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  ImageIcon,
  Info,
  LoaderCircle,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorAssetPicker } from "@/features/creator/components/creator-asset-picker";
import { CreatorImageViewer } from "@/features/creator/components/creator-image-viewer";
import type { CreatorAsset } from "@/features/creator/types";
import {
  cancelActiveStoreRunsAction,
  executeSmallStoreRunAction,
  getLatestStoreRunAction,
  publishStoreItemAction,
  publishStoreRunAction,
  retryStoreItemAction,
  startStoreImagesAction,
} from "@/features/store-images/actions";
import type {
  StoreBulkItem,
  StoreBulkItemStatus,
  StoreBulkRun,
  StoreImageMode,
  StoreProduct,
  StoreProductPage,
} from "@/features/store-images/types";
import { cn } from "@/lib/utils";

type Props = {
  initialProducts: StoreProductPage;
  initialRun: StoreBulkRun | null;
  initialLogoAssets: CreatorAsset[];
  connectionError: string | null;
};

type StoreNotice = {
  tone: "info" | "success" | "error";
  text: string;
};

type DirectExecution = {
  runId: string;
  requestId: number;
};

const imageModes: Array<{ value: StoreImageMode; label: string; description: string }> = [
  { value: "replace-primary", label: "Replace primary", description: "Replace the main image and keep the rest." },
  { value: "keep-both", label: "Keep both", description: "Add the new image and keep the old gallery." },
  { value: "replace-all", label: "Replace gallery", description: "Use the generated image as the only image." },
];

const activeItemStatuses: StoreBulkItemStatus[] = ["queued", "generating", "publishing"];

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
  const [logoAsset, setLogoAsset] = useState<CreatorAsset | null>(
    () => initialLogoAssets.find((asset) => asset.id === initialRun?.referenceAssetId) ?? null,
  );
  const [imageMode, setImageMode] = useState<StoreImageMode>("replace-primary");
  const [run, setRun] = useState<StoreBulkRun | null>(initialRun);
  const [notice, setNotice] = useState<StoreNotice | null>(
    connectionError ? { tone: "error", text: connectionError } : null,
  );
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [viewingItem, setViewingItem] = useState<StoreBulkItem | null>(null);
  const [directExecution, setDirectExecution] = useState<DirectExecution | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const directRequestSequence = useRef(0);
  const executedDirectRequests = useRef<Set<number>>(new Set());
  const publishedCountRef = useRef(initialRun?.publishedCount ?? 0);

  const generationActive = isGenerationActive(run);
  const hasActiveItems = run?.items.some((item) => activeItemStatuses.includes(item.status)) ?? false;
  const runBusy = generationActive || (run?.items.some((item) => item.status === "publishing") ?? false);
  const shouldPoll = Boolean(run && (run.status === "queued" || hasActiveItems));
  const runId = run?.id ?? null;
  const readyItems = run?.items.filter((item) => item.status === "ready") ?? [];
  const selectedCount = allMatches ? total : selectedIds.size;

  const loadRun = useCallback(async (runId: string): Promise<StoreBulkRun> => {
    const response = await fetch(`/api/store-images/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(readError(body, "Run progress could not be loaded."));
    const nextRun = readStoreBulkRun(body);
    if (!nextRun) throw new Error("Run progress returned an invalid response.");

    if (nextRun.publishedCount > publishedCountRef.current) {
      const addedCount = nextRun.publishedCount - publishedCountRef.current;
      setNotice({
        tone: "success",
        text: `${addedCount} image${addedCount === 1 ? " was" : "s were"} published to Apindex successfully.`,
      });
    }
    publishedCountRef.current = nextRun.publishedCount;
    setRun(nextRun);
    return nextRun;
  }, []);

  function queueDirectExecution(runId: string) {
    directRequestSequence.current += 1;
    setDirectExecution({ runId, requestId: directRequestSequence.current });
  }

  useEffect(() => {
    if (!directExecution || executedDirectRequests.current.has(directExecution.requestId)) return;
    executedDirectRequests.current.add(directExecution.requestId);
    const request = directExecution;

    void executeSmallStoreRunAction(request.runId)
      .then(async () => {
        const nextRun = await loadRun(request.runId);
        if (nextRun.failedCount > 0) {
          setNotice({ tone: "error", text: "Some images could not be generated. Review the item errors below." });
        } else {
          setNotice({ tone: "success", text: "Images generated. Review them below before publishing." });
        }
      })
      .catch((error: unknown) => {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Direct generation could not be completed." });
      })
      .finally(() => {
        setDirectExecution((current) => current?.requestId === request.requestId ? null : current);
      });
  }, [directExecution, loadRun]);

  useEffect(() => {
    if (!runId || !shouldPoll) return;
    const timer = window.setInterval(() => {
      void loadRun(runId).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loadRun, runId, shouldPoll]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [shouldPoll]);

  async function loadProducts(options: { reset: boolean; query?: string; productStatus?: typeof status }) {
    setIsLoadingProducts(true);
    setNotice(null);
    try {
      const cursor = options.reset ? "" : nextCursor ?? "";
      const params = new URLSearchParams({ limit: "40", status: options.productStatus ?? status });
      if (cursor) params.set("cursor", cursor);
      const query = options.query ?? appliedSearch;
      if (query) params.set("search", query);
      const response = await fetch(`/api/store-images/products?${params.toString()}`, { cache: "no-store" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(readError(body, "Products could not be loaded."));
      const page = readStoreProductPage(body);
      if (!page) throw new Error("Products returned an invalid response.");
      setProducts((current) => options.reset ? page.products : [...current, ...page.products]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      if (options.reset) {
        setSelectedIds(new Set());
        setAllMatches(false);
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Products could not be loaded." });
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function handleStart() {
    if (isStarting || runBusy || isUploadingLogo || selectedCount === 0 || !prompt.trim()) return;
    setIsStarting(true);
    setNotice(null);
    try {
      const result = await startStoreImagesAction({
        prompt,
        referenceAssetId: logoAsset?.id ?? null,
        imageMode,
        selectionMode: allMatches ? "all" : "selected",
        productIds: Array.from(selectedIds),
        search: appliedSearch,
        status,
      });
      const timestamp = new Date().toISOString();
      setNow(Date.parse(timestamp));
      publishedCountRef.current = 0;
      setRun({
        id: result.runId,
        prompt,
        referenceAssetId: logoAsset?.id ?? null,
        imageMode,
        selectionMode: allMatches ? "all" : "selected",
        status: result.executionMode === "direct" ? "running" : "queued",
        totalCount: selectedCount,
        completedCount: 0,
        failedCount: 0,
        publishedCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        items: [],
      });
      setNotice({
        tone: "info",
        text: result.executionMode === "direct"
          ? "Generation started. Live progress will appear below."
          : "Generation queued. You can leave this page and return later.",
      });
      if (result.executionMode === "direct") queueDirectExecution(result.runId);
      await loadRun(result.runId).catch(() => undefined);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The bulk run could not be started." });
    } finally {
      setIsStarting(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setIsUploadingLogo(true);
    setNotice({ tone: "info", text: "Saving your logo reference privately…" });
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
      setNotice({ tone: "success", text: "Logo uploaded and selected as the brand reference." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The logo could not be uploaded." });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  function toggleLogoAsset(asset: CreatorAsset) {
    const isRemoving = logoAsset?.id === asset.id;
    setLogoAsset((current) => current?.id === asset.id ? null : asset);
    setNotice({
      tone: "info",
      text: isRemoving ? "Logo reference removed from the next run." : `${asset.name} selected as the logo reference.`,
    });
  }

  async function handleCancelActiveRuns() {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const count = await cancelActiveStoreRunsAction();
      const nextRun = await getLatestStoreRunAction();
      setRun(nextRun);
      setNotice({
        tone: "info",
        text: count > 0
          ? `${count} active run${count === 1 ? "" : "s"} cancelled. You can start a new generation.`
          : "There are no active runs to cancel.",
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The active runs could not be cancelled." });
    } finally {
      setIsCancelling(false);
    }
  }

  async function handlePublishAll() {
    if (!run || readyItems.length === 0 || isPublishingAll) return;
    const itemIds = readyItems.map((item) => item.id);
    setIsPublishingAll(true);
    setRunItemsStatus(itemIds, "publishing");
    setNotice({ tone: "info", text: `Publishing ${itemIds.length} image${itemIds.length === 1 ? "" : "s"} to Apindex…` });
    try {
      const result = await publishStoreRunAction(run.id);
      await loadRun(run.id);
      if (result.executionMode === "direct") {
        setNotice(result.failedCount > 0
          ? { tone: "error", text: `${result.failedCount} image${result.failedCount === 1 ? "" : "s"} could not be published. Review the item error and retry.` }
          : { tone: "success", text: `${result.requestedCount} image${result.requestedCount === 1 ? "" : "s"} published to Apindex.` });
      } else {
        setNotice({ tone: "info", text: `${result.requestedCount} images are publishing to Apindex in the background.` });
      }
    } catch (error) {
      setRunItemsStatus(itemIds, "ready");
      await loadRun(run.id).catch(() => undefined);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Publishing could not be started." });
    } finally {
      setIsPublishingAll(false);
    }
  }

  async function handlePublishItem(item: StoreBulkItem) {
    if (pendingItemIds.has(item.id)) return;
    setItemPending(item.id, true);
    setRunItemsStatus([item.id], "publishing");
    setNotice({ tone: "info", text: `${item.productName} is publishing to Apindex…` });
    try {
      const result = await publishStoreItemAction(item.id);
      if (run) await loadRun(run.id);
      setNotice(result.failedCount > 0
        ? { tone: "error", text: `${item.productName} could not be published. Review the item error and retry.` }
        : result.executionMode === "direct"
          ? { tone: "success", text: `${item.productName} was published to Apindex.` }
          : { tone: "info", text: `${item.productName} is publishing to Apindex in the background.` });
    } catch (error) {
      setRunItemsStatus([item.id], "ready");
      if (run) await loadRun(run.id).catch(() => undefined);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "This image could not be published." });
    } finally {
      setItemPending(item.id, false);
    }
  }

  async function handleRetry(item: StoreBulkItem) {
    if (pendingItemIds.has(item.id)) return;
    const retryingPublish = Boolean(item.generatedAssetId);
    setItemPending(item.id, true);
    setRunItemsStatus([item.id], retryingPublish ? "publishing" : "queued");
    setNotice({
      tone: "info",
      text: retryingPublish ? `${item.productName} is retrying publication…` : `${item.productName} is retrying generation…`,
    });
    try {
      const result = await retryStoreItemAction(item.id);
      if (result.operation === "generation" && result.executionMode === "direct" && run) {
        queueDirectExecution(run.id);
      }
      if (run) await loadRun(run.id);
      if (result.operation === "publishing") {
        setNotice(result.failedCount > 0
          ? { tone: "error", text: `${item.productName} still could not be published. Review the updated error below.` }
          : result.executionMode === "direct"
            ? { tone: "success", text: `${item.productName} was published to Apindex.` }
            : { tone: "info", text: `${item.productName} is retrying publication in the background.` });
      }
    } catch (error) {
      setRunItemsStatus([item.id], "failed");
      if (run) await loadRun(run.id).catch(() => undefined);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "This item could not be retried." });
    } finally {
      setItemPending(item.id, false);
    }
  }

  function setItemPending(itemId: string, pending: boolean) {
    setPendingItemIds((current) => {
      const next = new Set(current);
      if (pending) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function setRunItemsStatus(itemIds: string[], nextStatus: StoreBulkItemStatus) {
    const ids = new Set(itemIds);
    setRun((current) => current
      ? { ...current, items: current.items.map((item) => ids.has(item.id) ? { ...item, status: nextStatus } : item) }
      : current);
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

  const viewerImageUrl = viewingItem?.generatedAssetId
    ? `/api/creator/assets/${viewingItem.generatedAssetId}/file`
    : viewingItem?.publishedImageUrl ?? null;
  const viewerAsset = viewingItem && viewerImageUrl
    ? { name: viewingItem.productName, imageUrl: viewerImageUrl }
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

      <StoreNoticeBanner notice={notice} onDismiss={() => setNotice(null)} />

      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5" aria-label="Store image controls">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_288px]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-neon/10 text-brand-neon"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="font-display text-lg font-bold">Image direction</h2><p className="text-xs text-muted">One instruction will be used for every selected product.</p></div>
            </div>
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
            <Button type="button" variant="primary" onClick={() => void handleStart()} disabled={isStarting || runBusy || isUploadingLogo || selectedCount === 0 || !prompt.trim()} className="mt-5 min-h-12 w-full sm:w-auto">
              {isStarting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {isStarting ? "Starting…" : "Generate selected images"}
            </Button>
          </div>

          <aside className="rounded-xl border border-white/10 bg-black/15" aria-label="Saved logo assets">
            <CreatorAssetPicker
              assets={logoAssets}
              references={logoAsset ? [{ assetId: logoAsset.id, role: "logo" }] : []}
              onToggle={toggleLogoAsset}
              onUpload={handleLogoUpload}
              isUploading={isUploadingLogo || generationActive}
              preferredRole="logo"
              allowedReferenceRoles={["logo"]}
              defaultUploadRole="logo"
              helperText="Reuse a saved logo in future runs."
              compact
            />
          </aside>
        </div>
      </section>

      <RunActivityPanel run={run} now={now} isCancelling={isCancelling} onCancel={() => void handleCancelActiveRuns()} />

      {run?.items.length ? (
        <section className="mt-8" aria-labelledby="results-heading" aria-busy={shouldPoll}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-neon">Results</p>
              <h2 id="results-heading" className="mt-1 font-display text-2xl font-bold">Generated images</h2>
              <p className="mt-1 text-sm text-muted">Small previews stay here. Select one to inspect the full image.</p>
            </div>
            <div className="flex items-center gap-2">
              {readyItems.length > 0 ? (
                <Button type="button" variant="primary" onClick={() => void handlePublishAll()} disabled={isPublishingAll}>
                  {isPublishingAll ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
                  {isPublishingAll ? "Starting…" : `Publish ${readyItems.length}`}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="icon" onClick={() => run && void loadRun(run.id).catch((error: unknown) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "Progress could not be refreshed." }))} aria-label="Refresh run progress">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {run.items.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                onView={() => setViewingItem(item)}
                onPublish={() => void handlePublishItem(item)}
                onRetry={() => void handleRetry(item)}
                disabled={pendingItemIds.has(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7" aria-labelledby="products-heading">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 id="products-heading" className="font-display text-2xl font-bold">Store products</h2><p className="mt-1 text-sm text-muted">Showing {products.length} of {total} products</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { const query = search.trim(); setAppliedSearch(query); void loadProducts({ reset: true, query }); } }} className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none focus:border-brand-neon/50 sm:w-64" placeholder="Search products" aria-label="Search products" /></div>
            <select value={status} onChange={(event) => { const nextStatus = event.target.value as typeof status; const query = search.trim(); setStatus(nextStatus); setAppliedSearch(query); void loadProducts({ reset: true, query, productStatus: nextStatus }); }} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-brand-neon/50" aria-label="Product status"><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <Button type="button" onClick={selectAllVisible}>Select visible</Button>
          <Button type="button" onClick={() => { setAllMatches(true); setSelectedIds(new Set()); }} className={allMatches ? "border-brand-neon/50 bg-brand-neon/10 text-brand-neon" : undefined}>Select all matching ({total})</Button>
          {selectedIds.size > 0 || allMatches ? <Button type="button" variant="ghost" onClick={() => { setSelectedIds(new Set()); setAllMatches(false); }}>Clear selection</Button> : null}
        </div>

        {products.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} selected={allMatches || selectedIds.has(product.id)} onToggle={() => toggleProduct(product.id)} />)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-sm text-muted">{isLoadingProducts ? "Loading products…" : "No products matched this search."}</div>}
        {nextCursor ? <Button type="button" onClick={() => void loadProducts({ reset: false })} disabled={isLoadingProducts} className="mx-auto mt-6 flex">{isLoadingProducts ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />} Load more</Button> : null}
      </section>

      <CreatorImageViewer asset={viewerAsset} onClose={() => setViewingItem(null)} />
    </div>
  );
}

function StoreNoticeBanner({ notice, onDismiss }: { notice: StoreNotice | null; onDismiss: () => void }) {
  if (!notice) return null;
  const Icon = notice.tone === "success" ? CircleCheck : notice.tone === "error" ? CircleAlert : Info;
  return (
    <div
      className={cn(
        "mt-5 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        notice.tone === "success" && "border-brand-neon/25 bg-brand-neon/10 text-brand-soft",
        notice.tone === "error" && "border-red-400/30 bg-red-500/10 text-red-200",
        notice.tone === "info" && "border-white/15 bg-white/[0.05] text-white",
      )}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
    >
      <span className="flex items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{notice.text}</span>
      <button type="button" onClick={onDismiss} className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-current hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon" aria-label="Dismiss message"><X className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  );
}

function RunActivityPanel({ run, now, isCancelling, onCancel }: { run: StoreBulkRun | null; now: number; isCancelling: boolean; onCancel: () => void }) {
  if (!run) {
    return <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-muted" aria-label="Run progress">No run yet. Generated images will stay here until you publish them.</section>;
  }

  const activity = getRunActivity(run);
  const indeterminate = activity.phase === "generating" && activity.total === 1 && activity.current === 0;
  const progressPercent = activity.total > 0 ? Math.min(Math.round((activity.current / activity.total) * 100), 100) : 0;
  const generationActive = isGenerationActive(run);

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5" aria-label="Run progress" aria-busy={activity.phase === "generating" || activity.phase === "publishing"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", activity.phase === "finished" ? "bg-brand-neon/10 text-brand-neon" : activity.phase === "issues" ? "bg-red-500/10 text-red-200" : "bg-white/[0.06] text-white")}>
            {activity.phase === "finished" ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : activity.phase === "issues" ? <CircleAlert className="h-4 w-4" aria-hidden="true" /> : activity.phase === "generating" || activity.phase === "publishing" ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-white" role="status" aria-live="polite" aria-atomic="true">{activity.title}</p>
              <span className="inline-flex items-center gap-1 text-xs text-muted"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatElapsed(run.createdAt, now)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">{activity.detail}</p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label={activity.title}
              aria-valuemin={0}
              aria-valuemax={Math.max(activity.total, 1)}
              aria-valuenow={indeterminate ? undefined : activity.current}
              aria-valuetext={indeterminate ? activity.detail : `${activity.current} of ${activity.total}`}
            >
              <div
                className={cn("h-full rounded-full bg-brand-neon transition-[width] duration-500 motion-reduce:transition-none", indeterminate && "w-1/3 motion-safe:animate-pulse")}
                style={indeterminate ? undefined : { width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <Badge>{run.failedCount} failed</Badge>
          <Badge variant="success">{run.publishedCount} published</Badge>
          {generationActive ? <Button type="button" variant="danger" onClick={onCancel} disabled={isCancelling} className="min-h-10 px-3 text-xs"><X className="h-3.5 w-3.5" aria-hidden="true" />{isCancelling ? "Cancelling…" : "Cancel"}</Button> : null}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product, selected, onToggle }: { product: StoreProduct; selected: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} className={cn("group relative overflow-hidden rounded-2xl border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon", selected ? "border-brand-neon/60 bg-brand-neon/10" : "border-white/10 bg-white/[0.035] hover:border-white/25")} aria-pressed={selected}><div className="relative aspect-square bg-black/20">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]" sizes="(max-width: 640px) 50vw, (max-width: 1536px) 33vw, 25vw" /> : <div className="flex h-full items-center justify-center text-muted"><ImageIcon className="h-8 w-8" aria-hidden="true" /></div>}<span className={cn("absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border", selected ? "border-brand-neon bg-brand-neon text-black" : "border-white/30 bg-black/40 text-transparent")}><Check className="h-4 w-4" aria-hidden="true" /></span></div><div className="p-4"><p className="truncate text-sm font-bold text-white">{product.name}</p><p className="mt-1 truncate text-xs text-muted">{product.handle}</p></div></button>;
}

function ResultCard({ item, onView, onPublish, onRetry, disabled }: { item: StoreBulkItem; onView: () => void; onPublish: () => void; onRetry: () => void; disabled: boolean }) {
  const imageUrl = item.generatedAssetId ? `/api/creator/assets/${item.generatedAssetId}/file` : item.publishedImageUrl;
  const isWorking = item.status === "queued" || item.status === "generating" || item.status === "publishing";
  const publishFailed = item.status === "failed" && Boolean(item.generatedAssetId);
  const statusLabel = getItemStatusLabel(item);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
      <button type="button" onClick={onView} disabled={!imageUrl} className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-[#121412] disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand-neon" aria-label={imageUrl ? `Open full image for ${item.productName}` : statusLabel}>
        {imageUrl ? <Image src={imageUrl} alt={`Generated image for ${item.productName}`} fill unoptimized className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" /> : <Skeleton className="absolute inset-3 motion-reduce:animate-none" />}
        {!imageUrl ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center text-xs text-muted">{isWorking ? <LoaderCircle className="h-6 w-6 text-brand-neon motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImageIcon className="h-6 w-6" aria-hidden="true" />}<span>{statusLabel}</span></div> : null}
        {imageUrl ? <span className="absolute right-2 top-2 flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Eye className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Open full image</span></span> : null}
      </button>
      <div className="p-3">
        <p className="truncate text-sm font-bold text-white" title={item.productName}>{item.productName}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <StatusBadge item={item} />
          {imageUrl ? <a href={`${imageUrl}?download=1`} download className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon" aria-label={`Download ${item.productName}`}><Download className="h-4 w-4" aria-hidden="true" /></a> : null}
        </div>
        {item.errorMessage ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-red-200">{item.errorMessage}</p> : null}
        {item.status === "published" ? (
          <div className="mt-3 rounded-lg border border-brand-neon/20 bg-brand-neon/[0.07] p-2.5 text-xs text-brand-soft">
            <span className="flex items-center gap-1.5 font-semibold"><CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />Published to Apindex</span>
            {item.publishedImageUrl ? <a href={item.publishedImageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-1 font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-neon">Open store image <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a> : null}
          </div>
        ) : null}
        {item.status === "ready" ? <Button type="button" variant="primary" onClick={onPublish} disabled={disabled} className="mt-3 w-full px-3 text-xs"><UploadCloud className="h-4 w-4" aria-hidden="true" />Publish</Button> : null}
        {item.status === "failed" ? <Button type="button" onClick={onRetry} disabled={disabled} className="mt-3 w-full px-3 text-xs">{disabled ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}{publishFailed ? "Retry publish" : "Retry generation"}</Button> : null}
        {item.status === "publishing" ? <div className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-neon/20 bg-brand-neon/[0.07] px-3 text-xs font-semibold text-brand-soft"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" />Publishing to Apindex…</div> : null}
      </div>
    </article>
  );
}

function StatusBadge({ item }: { item: StoreBulkItem }) {
  const label = getItemStatusLabel(item);
  if (item.status === "published") return <Badge variant="success"><CircleCheck className="mr-1 h-3 w-3" aria-hidden="true" />{label}</Badge>;
  if (item.status === "failed") return <Badge variant="danger"><CircleAlert className="mr-1 h-3 w-3" aria-hidden="true" />{label}</Badge>;
  if (item.status === "generating" || item.status === "publishing") return <Badge variant="warning"><LoaderCircle className="mr-1 h-3 w-3 motion-safe:animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}</Badge>;
  return <Badge>{label}</Badge>;
}

function getItemStatusLabel(item: StoreBulkItem): string {
  if (item.status === "queued") return "Waiting";
  if (item.status === "generating") return "Generating";
  if (item.status === "ready") return "Ready";
  if (item.status === "publishing") return "Publishing";
  if (item.status === "published") return "Published";
  if (item.status === "cancelled") return "Cancelled";
  return item.generatedAssetId ? "Publish failed" : "Generation failed";
}

function isGenerationActive(run: StoreBulkRun | null): boolean {
  if (!run) return false;
  if (run.status === "queued") return true;
  if (run.items.some((item) => item.status === "queued" || item.status === "generating")) return true;
  return run.status === "running" && run.items.length === 0;
}

function getRunActivity(run: StoreBulkRun): { phase: "generating" | "review" | "publishing" | "finished" | "issues"; title: string; detail: string; current: number; total: number } {
  const queuedCount = run.items.filter((item) => item.status === "queued").length;
  const generatingCount = run.items.filter((item) => item.status === "generating").length;
  const readyCount = run.items.filter((item) => item.status === "ready").length;
  const publishingCount = run.items.filter((item) => item.status === "publishing").length;
  const publishedCount = run.items.filter((item) => item.status === "published").length;
  const failedItems = run.items.filter((item) => item.status === "failed");
  const cancelledCount = run.items.filter((item) => item.status === "cancelled").length;
  const generatedCount = readyCount + publishingCount + publishedCount + failedItems.length + cancelledCount;
  const total = Math.max(run.totalCount, run.items.length);

  if (run.status === "queued" || queuedCount > 0 || generatingCount > 0 || (run.status === "running" && run.items.length === 0)) {
    return {
      phase: "generating",
      title: run.items.length === 0 ? "Preparing products" : `${generatedCount} of ${total} images generated`,
      detail: generatingCount > 0 ? `${generatingCount} generating now · ${queuedCount} waiting` : "Generation will begin shortly.",
      current: generatedCount,
      total,
    };
  }

  if (publishingCount > 0) {
    const publishableCount = readyCount + publishingCount + publishedCount + failedItems.filter((item) => item.generatedAssetId !== null).length;
    return {
      phase: "publishing",
      title: `${publishedCount} of ${publishableCount} published`,
      detail: `${publishingCount} publishing to Apindex now.`,
      current: publishedCount,
      total: publishableCount,
    };
  }

  if (readyCount > 0) {
    return {
      phase: "review",
      title: `${readyCount} image${readyCount === 1 ? " is" : "s are"} ready to review`,
      detail: "Open a preview, then publish the images you want to use.",
      current: generatedCount,
      total,
    };
  }

  if (failedItems.length > 0 || cancelledCount > 0) {
    return {
      phase: "issues",
      title: `${failedItems.length + cancelledCount} item${failedItems.length + cancelledCount === 1 ? " needs" : "s need"} attention`,
      detail: "Review the item message below and retry when ready.",
      current: generatedCount,
      total,
    };
  }

  return {
    phase: "finished",
    title: publishedCount > 0 ? `${publishedCount} image${publishedCount === 1 ? "" : "s"} published to Apindex` : "Run finished",
    detail: publishedCount > 0 ? "Your store images were updated successfully." : "This run has no remaining work.",
    current: total,
    total,
  };
}

function formatElapsed(createdAt: string, now: number): string {
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return "Started recently";
  const elapsedMinutes = Math.max(0, Math.floor((now - createdAtMs) / 60_000));
  if (elapsedMinutes < 1) return "Less than 1 min";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min elapsed`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return `${hours}h ${minutes}m elapsed`;
}

function readError(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as Record<string, unknown>).error === "string") return (value as Record<string, unknown>).error as string;
  return fallback;
}

function readStoreBulkRun(value: unknown): StoreBulkRun | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.status !== "string" || !Array.isArray(record.items)) return null;
  return value as StoreBulkRun;
}

function readStoreProductPage(value: unknown): StoreProductPage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.products) || typeof record.total !== "number") return null;
  if (record.nextCursor !== null && typeof record.nextCursor !== "string") return null;
  return value as StoreProductPage;
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
