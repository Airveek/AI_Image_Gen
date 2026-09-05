import type { Metadata } from "next";
import Link from "next/link";
import { Check, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAccountBilling } from "@/features/creator/server/entitlements";
import { getActiveBillingConfiguration } from "@/features/billing/server/settings";
import { openStripeBillingPortal } from "@/features/account/server/billing-actions";
import { billingModeForBillingKind, PLAN_DEFINITIONS, type PlanDefinition } from "@/lib/billing/plans";
import type { AccountBillingSummary, BillingMode } from "@/lib/billing/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans and Pricing" };

export default async function PlansPage() {
  const [billing, configuration] = await Promise.all([getCurrentAccountBilling(), getActiveBillingConfiguration()]);
  const displayMode = billing.hasActiveAccess ? billingModeForBillingKind(billing.billingKind) ?? configuration.mode : configuration.mode;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Plans and pricing</p>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Choose the plan that fits your work</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{displayMode === "subscription" ? "Simple monthly billing with secure subscription management." : "One secure payment for ongoing access—no monthly renewal."}</p>

      <Card className="mt-8 border-primary/25 bg-primary/6">
        <CardHeader>
          <CardTitle>Current access</CardTitle>
          <CardDescription>{billingDescription(billing)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl font-bold text-foreground">{billing.planName}</p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{billingLabel(billing)}</p>
            {billing.renewalAt ? <p className="mt-1 text-sm text-muted-foreground">{billing.cancelAtPeriodEnd ? "Access through" : "Renews"} {formatDate(billing.renewalAt)}</p> : null}
          </div>
          {billing.manageUrl ? (
            <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={billing.manageUrl} target="_blank" rel="noreferrer">
              Manage billing <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          ) : billing.provider === "stripe" && billing.canManageBilling ? (
            <form action={openStripeBillingPortal}><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover" type="submit">Manage billing <ExternalLink className="size-4" aria-hidden="true" /></button></form>
          ) : billing.hasActiveAccess ? (
            <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 text-sm font-bold text-foreground transition hover:border-primary/50 hover:bg-surface-muted" href="/support">Get billing help</Link>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {Object.values(PLAN_DEFINITIONS).map((plan) => <PlanCard key={plan.key} plan={plan} billing={billing} mode={displayMode} />)}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-surface-muted p-5 text-sm leading-6 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p>Existing lifetime purchases remain active under their original terms. Airveek does not automatically replace legacy access with a monthly subscription.</p>
      </div>
    </div>
  );
}

function PlanCard({ plan, billing, mode }: { plan: PlanDefinition; billing: AccountBillingSummary; mode: BillingMode }) {
  const isCurrent = billing.planKey === plan.key && billing.hasActiveAccess;
  const upgradeLabel = `Upgrade to ${plan.name} Plan`;

  return (
    <article className={cn("rounded-3xl border bg-surface p-6 shadow-sm sm:p-8", plan.key === "commercial" ? "border-primary/50" : "border-border")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{plan.name}</p>
          <p className="mt-4 font-display text-5xl font-extrabold text-foreground">${plan.priceUsdCents / 100}<span className="ml-2 text-base font-semibold text-muted-foreground">{mode === "subscription" ? "/ month" : "one time"}</span></p>
        </div>
        {isCurrent ? <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">Current plan</span> : null}
      </div>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">{plan.description}</p>
      <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm leading-6"><span className="font-bold">Choose this if:</span> {plan.bestFor}</p>

      {isCurrent ? (
        <button className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-surface-muted px-5 text-sm font-bold text-muted-foreground" type="button" disabled>
          {"Your Current Plan"}
        </button>
      ) : !billing.hasActiveAccess ? (
        <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/checkout?plan=${plan.key}`}>
          <CreditCard className="size-4" aria-hidden="true" /> Start {plan.name}
        </Link>
      ) : (
        <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/checkout?plan=${plan.key}`}>
          {upgradeLabel}
        </Link>
      )}

      <ul className="mt-7 space-y-3 border-t border-border pt-6">
        {plan.features.map((feature) => (
          <li className="flex items-start gap-3 text-sm text-foreground" key={feature}>
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

function billingLabel(billing: AccountBillingSummary): string {
  if (billing.billingKind === "legacy-lifetime") return "Legacy lifetime access";
  if (billing.billingKind === "one-time") return "One-time purchase";
  if (billing.billingKind === "monthly") return billing.cancelAtPeriodEnd ? "Cancels at the end of this billing period" : "Monthly subscription";
  return billing.status ? `Status: ${billing.status.replaceAll("_", " ")}` : "No paid plan connected";
}

function billingDescription(billing: AccountBillingSummary): string {
  if (billing.billingKind === "legacy-lifetime" && billing.hasActiveAccess) return "Your original lifetime billing mode remains active and will also be kept for upgrades.";
  if (billing.hasActiveAccess) return "Manage billing for payment details, receipts, or cancellation. Choose another plan below to upgrade.";
  return "Choose a plan when you are ready.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
