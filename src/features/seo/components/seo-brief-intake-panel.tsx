"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { createSeoBriefAction, type SeoOperationActionState } from "@/app/(admin)/admin/seo/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const initialState: SeoOperationActionState = { status: "idle", message: "" };
const inputClassName = "min-h-11 w-full rounded-xl border border-border bg-brand-black px-3 text-sm text-brand-white placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus";

export function SeoBriefIntakePanel() {
  const [state, action, pending] = useActionState(createSeoBriefAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="border-b border-border p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-neon">Research intake</p>
        <h3 className="mt-2 font-display text-xl font-bold text-brand-white">Create a research-backed brief</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">This creates a queue brief and draft evidence packets only. Three independent HTTPS sources are required; no page, media approval, or publishing state is created.</p>
      </div>

      {state.message ? <p aria-live="polite" className={`mx-5 mt-5 rounded-xl border px-4 py-3 text-sm sm:mx-6 ${state.status === "error" ? "border-red-300/20 bg-red-300/5 text-danger" : "border-brand-neon/20 bg-brand-neon/5 text-brand-soft"}`} role="status">{state.message}</p> : null}

      <form action={action} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Product or category"><input className={inputClassName} maxLength={180} name="productEntity" placeholder="e.g. ceramic coffee mug" required /></Field>
        <Field label="Page family"><select className={inputClassName} defaultValue="listing" name="pageFamily"><option value="listing">Clean listing image</option><option value="lifestyle">Lifestyle image</option><option value="detail">Detail and scale</option><option value="prompt">Product photo prompt</option><option value="product-hub">Product hub</option><option value="category-hub">Category hub</option><option value="tutorial">Tutorial</option><option value="feature">Feature</option></select></Field>
        <Field label="Primary search query"><input className={inputClassName} maxLength={240} name="primaryQuery" placeholder="how to photograph a ceramic mug for ecommerce" required /></Field>
        <Field label="Normalized intent key"><input className={inputClassName} maxLength={160} name="intentKey" placeholder="ceramic-mug-ecommerce-listing" required /></Field>
        <div className="sm:col-span-2"><Field label="Buyer question"><textarea className={`${inputClassName} py-3`} maxLength={500} name="buyerQuestion" placeholder="How can a small shop create a clean mug listing image?" required rows={2} /></Field></div>
        <Field label="Brief key (optional)"><input className={inputClassName} maxLength={160} name="briefKey" placeholder="auto-generated from product and intent" /></Field>
        <Field label="Template version"><input className={inputClassName} defaultValue="seo-v1" maxLength={40} name="templateVersion" /></Field>
        <Field label="Opportunity score (optional)"><input className={inputClassName} max={100} min={0} name="opportunityScore" type="number" /></Field>
        <Field label="Priority (0–100)"><input className={inputClassName} defaultValue="50" max={100} min={0} name="priority" type="number" /></Field>

        <div className="sm:col-span-2"><p className="text-sm font-semibold text-brand-white">Evidence sources (three required)</p><p className="mt-1 text-xs leading-5 text-muted">Use the exact public source pages reviewed for demand or audience evidence. The source URLs are stored for later research review and do not approve product-media rights.</p></div>
        {[1, 2, 3].map((index) => <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted p-4 sm:grid-cols-2" key={index}><Field label={`Source ${index} URL`}><input className={inputClassName} name={`evidenceUrl${index}`} placeholder="https://…" required type="url" /></Field><Field label="Short source label"><input className={inputClassName} maxLength={300} name={`evidenceTitle${index}`} placeholder="Source title or community question" required /></Field><Field label="Accessed on"><input className={inputClassName} name={`evidenceAccessedAt${index}`} required type="date" /></Field><div className="sm:col-span-2"><Field label="Claim supported"><textarea className={`${inputClassName} py-3`} maxLength={1000} name={`evidenceClaim${index}`} placeholder="What claim or signal does this source support?" required rows={2} /></Field></div></div>)}

        <div className="sm:col-span-2"><Button disabled={pending} type="submit" variant="primary">{pending ? "Creating brief…" : "Create research brief"}</Button></div>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2 text-sm font-semibold text-brand-white"><span>{label}</span>{children}</label>;
}
