"use client";

import { useActionState } from "react";

import { setBillingConfigurationAction } from "@/app/(admin)/admin/integrations/actions";
import type { AdminBillingSettings } from "@/features/billing/server/settings";

const initialState = { status: "idle" as const, message: "" };

export function BillingSettings({ settings }: { settings: AdminBillingSettings }) {
  const [state, action, pending] = useActionState(setBillingConfigurationAction, initialState);
  return (
    <section className="rounded-2xl border border-border bg-brand-panel p-5 sm:p-6" aria-labelledby="billing-settings-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-neon">Checkout routing</p>
        <h2 id="billing-settings-title" className="mt-2 font-display text-2xl font-bold text-brand-white">Billing provider</h2>
        <p className="mt-2 text-sm leading-6 text-muted">This switch affects new checkouts only. Existing Whop and Stripe access remains valid.</p>
      </div>
      <form action={action} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-semibold text-brand-white">Provider
          <select name="provider" defaultValue={settings.provider} className="min-h-11 rounded-xl border border-border bg-brand-black px-3 text-sm">
            <option value="whop">Whop</option><option value="stripe">Stripe</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-white">Billing mode
          <select name="mode" defaultValue={settings.mode} className="min-h-11 rounded-xl border border-border bg-brand-black px-3 text-sm">
            <option value="subscription">Monthly subscription</option><option value="one_time">One-time payment</option>
          </select>
        </label>
        <button disabled={pending} className="min-h-11 rounded-xl bg-brand-neon px-5 text-sm font-bold text-brand-black disabled:opacity-60" type="submit">
          {pending ? "Validating…" : "Save and activate"}
        </button>
      </form>
      {state.message ? <p className={`mt-4 text-sm ${state.status === "error" ? "text-red-300" : "text-brand-neon"}`}>{state.message}</p> : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {settings.readiness.map((item) => (
          <div key={`${item.provider}-${item.mode}`} className="rounded-xl border border-border bg-brand-black/40 p-3 text-xs">
            <p className="font-bold capitalize text-brand-white">{item.provider} · {item.mode === "subscription" ? "monthly" : "one-time"}</p>
            <p className={item.ready ? "mt-1 text-brand-neon" : "mt-1 text-muted"}>{item.ready ? "Environment configured" : item.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

