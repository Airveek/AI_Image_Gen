"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";

import { AirveekLogo } from "@/components/airveek/airveek-logo";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FashionAuthModal } from "@/features/fashion-playground/auth-modal";
import { clearFashionDraft, getOrCreateFashionDraftId, loadFashionDraft, saveFashionDraft, type FashionDraft } from "@/features/fashion-playground/draft-storage";
import type { CreatorAsset, CreatorGenerationResult, GenerationAccessSummary, ProductFashionRequest } from "@/features/creator/types";
import { hasAnalyticsConsent, trackFunnelEvent, trackPixelEvent, trackServerMirroredPixelEvent } from "@/lib/analytics/meta-browser";

type Scene = FashionDraft["scene"];
type Lighting = FashionDraft["lighting"];
type Ratio = FashionDraft["aspectRatio"];

export function FashionPlayground({ authenticated, initialAccess, billingMode }: {
  authenticated: boolean;
  initialAccess: GenerationAccessSummary;
  billingMode: "one_time" | "subscription";
}) {
  const [productFile, setProductFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [productAssetId, setProductAssetId] = useState<string | null>(null);
  const [modelAssetId, setModelAssetId] = useState<string | null>(null);
  const [scene, setScene] = useState<Scene>("studio");
  const [lighting, setLighting] = useState<Lighting>("soft-daylight");
  const [aspectRatio, setAspectRatio] = useState<Ratio>("4:5");
  const [access, setAccess] = useState(initialAccess);
  const [hasSession, setHasSession] = useState(authenticated);
  const [authOpen, setAuthOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Add a product and model reference to begin.");
  const [results, setResults] = useState<CreatorAsset[]>([]);
  const [restored, setRestored] = useState(false);
  const [autoResume, setAutoResume] = useState(false);
  const resumeStarted = useRef(false);
  const paywallTracked = useRef(false);
  const playgroundTracked = useRef(false);
  const draftId = useRef<string | null>(null);
  const productPreview = useObjectUrl(productFile);
  const modelPreview = useObjectUrl(modelFile);
  const outputCount = access.hasPaidAccess ? 2 : Math.min(2, access.remaining);

  useEffect(() => {
    const trackPlayground = () => {
      if (playgroundTracked.current || !hasAnalyticsConsent()) return;
      playgroundTracked.current = true;
      trackFunnelEvent("PlaygroundView", { arena_id: "product-fashion", content_name: "AI Fashion Photoshoot", content_category: "playground" });
    };
    trackPlayground();
    window.addEventListener("airveek:analytics-consent", trackPlayground);
    void loadFashionDraft().then((draft) => {
      draftId.current = draft?.id ?? getOrCreateFashionDraftId();
      if (draft) {
        setProductFile(draft.productFile);
        setModelFile(draft.modelFile);
        setProductAssetId(draft.productAssetId);
        setModelAssetId(draft.modelAssetId);
        setScene(draft.scene);
        setLighting(draft.lighting);
        setAspectRatio(draft.aspectRatio);
        setAutoResume(draft.autoResume);
        setMessage("Your saved photoshoot draft is ready.");
      }
      setRestored(true);
    });
    return () => window.removeEventListener("airveek:analytics-consent", trackPlayground);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const pendingRegistrationEvent = sessionStorage.getItem("airveek:pending-registration-event");
    if (!pendingRegistrationEvent) return;
    trackServerMirroredPixelEvent("CompleteRegistration", pendingRegistrationEvent, { content_name: "AI Fashion Photoshoot registration", content_category: "account" });
    sessionStorage.removeItem("airveek:pending-registration-event");
  }, [authenticated]);

  useEffect(() => {
    if (!restored) return;
    if (draftId.current) void saveFashionDraft({ id: draftId.current, createdAt: Date.now(), productFile, modelFile, productAssetId, modelAssetId, scene, lighting, aspectRatio, autoResume });
  }, [restored, productFile, modelFile, productAssetId, modelAssetId, scene, lighting, aspectRatio, autoResume]);

  const generate = useCallback(async (forceAuthenticated = false) => {
    if (busy) return;
    if (!productFile || !modelFile) {
      setMessage("Choose both a product image and a model reference.");
      return;
    }
    if (!hasSession && !forceAuthenticated) {
      setAutoResume(true);
      setAuthOpen(true);
      setMessage("Create or log in to your account. Your images are saved on this device.");
      return;
    }
    if (!access.hasPaidAccess && access.remaining <= 0) {
      setPaywallOpen(true);
      return;
    }
    setBusy(true);
    setAuthOpen(false);
    setMessage("Securely saving your references…");
    trackFunnelEvent("GenerationIntent", { arena_id: "product-fashion", generation_count: 2, placement: "fashion_playground" });
    try {
      const productId = productAssetId ?? (await uploadReference(productFile, "product")).id;
      if (!productAssetId) {
        setProductAssetId(productId);
        trackFunnelEvent("ProductImageUploaded", { arena_id: "product-fashion", placement: "fashion_playground" });
      }
      const modelId = modelAssetId ?? (await uploadReference(modelFile, "person")).id;
      if (!modelAssetId) {
        setModelAssetId(modelId);
        trackFunnelEvent("ModelReferenceUploaded", { arena_id: "product-fashion", placement: "fashion_playground" });
      }
      trackFunnelEvent("FashionShootConfigured", { arena_id: "product-fashion", generation_count: 2, placement: "fashion_playground" });
      const count = outputCount;
      setMessage(`Creating ${count} ecommerce image${count === 1 ? "" : "s"}…`);
      trackFunnelEvent("GenerationStarted", { arena_id: "product-fashion", generation_count: count as 1 | 2, placement: "fashion_playground" });
      const requests = Array.from({ length: count }, () => generationRequest(productId, modelId, scene, lighting, aspectRatio));
      const responses = await Promise.all(requests.map(requestGeneration));
      const successful = responses.filter((result): result is Extract<CreatorGenerationResult, { ok: true }> => result.ok);
      const failure = responses.find((result) => !result.ok);
      for (const result of successful) {
        trackServerMirroredPixelEvent("GenerationSucceeded", result.trackingEventId, { arena_id: "product-fashion", content_name: "AI Fashion Photoshoot", content_category: "creator_output", remaining_credits: result.access.remaining });
        if (!result.access.hasPaidAccess) trackPixelEvent("FreeGenerationUsed", crypto.randomUUID(), { arena_id: "product-fashion", remaining_credits: result.access.remaining });
      }
      setResults(successful.map((result) => result.data));
      const accessResults = [
        ...successful.map((result) => result.access),
        ...(failure && !failure.ok && failure.access ? [failure.access] : []),
      ];
      const newestAccess = accessResults.find((summary) => summary.hasPaidAccess)
        ?? accessResults.sort((left, right) => right.remaining - left.remaining)[0];
      if (newestAccess) setAccess(newestAccess);
      if (failure && !failure.ok && failure.code === "payment_required") setPaywallOpen(true);
      if (!successful.length) throw new Error(failure && !failure.ok ? failure.message : "The photoshoot could not be created.");
      setRestored(false);
      setAutoResume(false);
      await clearFashionDraft();
      setMessage(`${successful.length} image${successful.length === 1 ? " is" : "s are"} ready and saved to your private library.`);
      if (newestAccess && !newestAccess.hasPaidAccess && newestAccess.remaining === 0) setPaywallOpen(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The photoshoot could not be created. Please try again.");
    } finally { setBusy(false); }
  }, [busy, productFile, modelFile, hasSession, access, productAssetId, modelAssetId, scene, lighting, aspectRatio, outputCount]);

  useEffect(() => {
    if (!restored || !hasSession || !autoResume || resumeStarted.current || !productFile || !modelFile) return;
    resumeStarted.current = true;
    void generate(true);
  }, [restored, hasSession, autoResume, productFile, modelFile, generate]);

  useEffect(() => {
    const trackPaywall = () => {
      if (!paywallOpen || paywallTracked.current || !hasAnalyticsConsent()) return;
      paywallTracked.current = true;
      trackFunnelEvent("PaywallView", { placement: "fashion_playground", plan_key: "commercial", billing_mode: billingMode, value: 49, currency: "USD" });
    };
    trackPaywall();
    window.addEventListener("airveek:analytics-consent", trackPaywall);
    return () => window.removeEventListener("airveek:analytics-consent", trackPaywall);
  }, [paywallOpen, billingMode]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link className="flex min-h-11 items-center" href="/ai-fashion-photoshoot" aria-label="Back to AI Fashion Photoshoot"><AirveekLogo className="w-36 sm:w-44" /></Link>
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground" href="/ai-fashion-photoshoot"><ArrowLeft className="size-4" aria-hidden="true" /> About this tool</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-12">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">AI Fashion Photoshoot</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Turn two references into campaign-ready fashion images</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Upload your product and a model reference. Airveek keeps both roles separate and creates two polished outputs.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <UploadCard label="1. Product or garment" helper="JPG, PNG, or WebP" preview={productPreview} inputId="fashion-product" onFile={(file) => { setProductFile(file); setProductAssetId(null); setResults([]); }} />
            <UploadCard label="2. Model reference" helper="Use an image you have rights to" preview={modelPreview} inputId="fashion-model" onFile={(file) => { setModelFile(file); setModelAssetId(null); setResults([]); }} />
          </div>

          {results.length ? <section className="mt-8" aria-labelledby="fashion-results-title"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Your results</p><h2 id="fashion-results-title" className="mt-2 font-display text-3xl font-bold">Ready for your store</h2></div><span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">Saved privately</span></div><div className="mt-4 grid gap-4 sm:grid-cols-2">{results.map((asset) => asset.imageUrl ? <article className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-media-stage" key={asset.id}><Image src={asset.imageUrl} alt="Generated ecommerce fashion result" fill unoptimized className="object-contain" sizes="(max-width: 640px) 100vw, 50vw" /></article> : null)}</div></section> : null}
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(var(--theme-shadow))] lg:sticky lg:top-6">
          <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" aria-hidden="true" /></span><div><h2 className="font-display text-xl font-bold">Photoshoot settings</h2><p className="text-xs text-muted-foreground">Preconfigured for ecommerce</p></div></div>
          <div className="mt-6 space-y-5">
            <Select label="Scene" value={scene} onChange={(value) => setScene(value as Scene)} options={["studio", "lifestyle", "outdoor"]} />
            <Select label="Lighting" value={lighting} onChange={(value) => setLighting(value as Lighting)} options={["soft-daylight", "studio-softbox", "golden-hour"]} />
            <Select label="Format" value={aspectRatio} onChange={(value) => setAspectRatio(value as Ratio)} options={["4:5", "1:1", "9:16"]} />
          </div>
          <div className="mt-6 rounded-2xl bg-surface-muted p-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-semibold">Outputs</span><span className="font-display text-xl font-bold">{outputCount > 0 ? `${outputCount} image${outputCount === 1 ? "" : "s"}` : "Free images used"}</span></div>{!access.hasPaidAccess ? <p className="mt-2 text-xs text-muted-foreground">{access.remaining} of {access.granted} free images remaining</p> : <p className="mt-2 text-xs text-success">Paid access active</p>}</div>
          <Button className="mt-5 min-h-12 w-full" disabled={busy} onClick={() => outputCount > 0 ? void generate() : setPaywallOpen(true)} type="button" variant="primary">{busy ? <><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Creating photoshoot…</> : outputCount > 0 ? `Generate ${outputCount}${access.hasPaidAccess ? "" : " Free"} Image${outputCount === 1 ? "" : "s"}` : "Unlock more images"}</Button>
          <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><LockKeyhole className="size-3.5" aria-hidden="true" /> Private account library · No credit card</p>
          <p className="mt-4 min-h-10 text-center text-sm leading-5 text-muted-foreground" aria-live="polite">{message}</p>
        </aside>
      </div>

      <FashionAuthModal open={authOpen} onOpenChange={setAuthOpen} onAuthenticated={() => {
        resumeStarted.current = true;
        setHasSession(true);
        void generate(true);
      }} />
      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen} title="Your free photoshoot is complete" description="Both images are saved. Unlock Commercial access to keep creating across every Airveek tool.">
        <div className="rounded-2xl bg-surface-muted p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Commercial</p><p className="mt-3 font-display text-4xl font-extrabold">$49 <span className="text-base font-semibold text-muted-foreground">{billingMode === "one_time" ? "one time" : "/ month"}</span></p><ul className="mt-4 space-y-2 text-sm"><li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" aria-hidden="true" /> HD downloads and commercial license</li><li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" aria-hidden="true" /> No watermarks</li><li className="flex gap-2"><Check className="mt-0.5 size-4 text-primary" aria-hidden="true" /> 30-day money-back guarantee</li></ul></div>
        <Link onClick={() => billingMode === "one_time" && trackFunnelEvent("LifetimeOfferClick", { placement: "fashion_paywall", plan_key: "commercial", billing_mode: billingMode, value: 49, currency: "USD" })} href="/checkout?plan=commercial" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover">Unlock Commercial access</Link>
      </Dialog>
    </main>
  );
}

function UploadCard({ label, helper, preview, inputId, onFile }: { label: string; helper: string; preview: string | null; inputId: string; onFile: (file: File) => void }) {
  return <label className="group relative flex min-h-64 cursor-pointer flex-col overflow-hidden rounded-3xl border border-dashed border-input bg-surface-muted transition hover:border-primary focus-within:border-primary" htmlFor={inputId}>{preview ? <Image src={preview} alt="Selected reference preview" fill unoptimized className="object-cover" sizes="(max-width: 640px) 100vw, 50vw" /> : <span className="flex flex-1 flex-col items-center justify-center p-6 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ImagePlus className="size-7" aria-hidden="true" /></span><span className="mt-4 font-display text-xl font-bold">{label}</span><span className="mt-2 text-sm text-muted-foreground">{helper}</span></span>}<span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-sm font-bold text-white backdrop-blur">{preview ? `Replace ${label.replace(/^\d\. /, "").toLowerCase()}` : "Choose image"}</span><input id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <div><label className="mb-2 block text-sm font-semibold" htmlFor={`fashion-${label.toLowerCase()}`}>{label}</label><select id={`fashion-${label.toLowerCase()}`} className="min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-base" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{option.replaceAll("-", " ")}</option>)}</select></div>;
}

function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

async function uploadReference(file: File, kind: "product" | "person"): Promise<CreatorAsset> {
  const form = new FormData();
  form.set("file", file); form.set("kind", kind); form.set("name", kind === "product" ? "Fashion product reference" : "Fashion model reference");
  const response = await fetch("/api/creator/assets", { method: "POST", body: form });
  const payload = await response.json() as { ok?: boolean; data?: CreatorAsset; message?: string };
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.message ?? "Reference upload failed.");
  return payload.data;
}

function generationRequest(productId: string, modelId: string, scene: Scene, lighting: Lighting, aspectRatio: Ratio): ProductFashionRequest {
  return { generationAttemptId: crypto.randomUUID(), arenaId: "product-fashion", mode: "on-model", scene, campaignGoal: "store-listing", backgroundMood: scene === "studio" ? "clean premium ecommerce studio" : `${scene} ecommerce campaign`, lighting, aspectRatio, extraDirection: "Create a polished ecommerce fashion photoshoot. Preserve the exact product and recognizable model identity from their assigned references.", references: [{ assetId: productId, role: "product" }, { assetId: modelId, role: "model" }] };
}

async function requestGeneration(request: ProductFashionRequest): Promise<CreatorGenerationResult> {
  try {
    const response = await fetch("/api/creator/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
    const payload = await response.json() as CreatorGenerationResult;
    if (payload && typeof payload === "object" && typeof payload.ok === "boolean") return payload;
    return { ok: false, message: "The server returned an invalid response.", code: "unknown" };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Generation failed.", code: "unknown" }; }
}
