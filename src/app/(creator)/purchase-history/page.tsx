import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ReceiptText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPurchaseHistory } from "@/features/account/server/billing";
import { getCurrentAccountBilling } from "@/features/creator/server/entitlements";
import type { PurchaseHistoryItem } from "@/lib/whop/types";
import { openStripeBillingPortal } from "@/features/account/server/billing-actions";

export const metadata: Metadata = { title: "Purchase History" };

export default async function PurchaseHistoryPage() {
  const [history, billing] = await Promise.all([
    getCurrentPurchaseHistory(),
    getCurrentAccountBilling(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Purchase history</p>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-5xl">Payments and refunds</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">Review the Airveek transactions connected to this account.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>Amounts are shown in the currency recorded by the payment provider.</CardDescription>
        </CardHeader>
        <CardContent>
          {!history.available ? (
            <EmptyHistory title="Purchase history is temporarily unavailable" description="Your access is not affected. Try again later or use billing support." />
          ) : history.items.length === 0 ? (
            <EmptyHistory title="No recorded transactions yet" description="Older legacy purchases may not appear in Airveek's local history." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr><th className="px-4 py-3 font-bold">Date</th><th className="px-4 py-3 font-bold">Plan</th><th className="px-4 py-3 font-bold">Type</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.items.map((item) => <HistoryRow key={item.id} item={item} />)}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {billing.manageUrl ? (
              <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover" href={billing.manageUrl} target="_blank" rel="noreferrer">Open billing history <ExternalLink className="size-4" aria-hidden="true" /></a>
            ) : billing.provider === "stripe" && billing.canManageBilling ? (
              <form action={openStripeBillingPortal}><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover" type="submit">Open billing history <ExternalLink className="size-4" aria-hidden="true" /></button></form>
            ) : null}
            <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-5 text-sm font-bold text-foreground transition hover:border-primary/50 hover:bg-surface-muted" href="/support">Billing support</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryRow({ item }: { item: PurchaseHistoryItem }) {
  return (
    <tr className="bg-surface">
      <td className="px-4 py-4 text-muted-foreground">{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.occurredAt))}</td>
      <td className="px-4 py-4 font-semibold text-foreground">{item.planName}</td>
      <td className="px-4 py-4 capitalize text-foreground">{item.kind}</td>
      <td className="px-4 py-4 capitalize text-muted-foreground">{item.status.replaceAll("_", " ")}</td>
      <td className="px-4 py-4 text-right font-semibold text-foreground">{formatAmount(item)}</td>
    </tr>
  );
}

function EmptyHistory({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
      <ReceiptText className="mx-auto size-7 text-primary" aria-hidden="true" />
      <p className="mt-4 font-display text-lg font-bold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function formatAmount(item: PurchaseHistoryItem): string {
  if (item.amount === null || !item.currency) return "—";
  try {
    const amount = new Intl.NumberFormat("en", { style: "currency", currency: item.currency }).format(item.amount);
    return item.kind === "refund" ? `−${amount}` : amount;
  } catch {
    return `${item.amount.toFixed(2)} ${item.currency}`;
  }
}
