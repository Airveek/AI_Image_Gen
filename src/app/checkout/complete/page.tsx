import type { Metadata } from "next";

import { CheckoutComplete } from "@/components/checkout/checkout-complete";
import { noIndexMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Checkout complete",
  description: "Your Airveek checkout status.",
  ...noIndexMetadata,
};

type CheckoutCompletePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutCompletePage({ searchParams }: CheckoutCompletePageProps) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : null;

  return <CheckoutComplete status={status} />;
}
