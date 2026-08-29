import type { Metadata } from "next";
import Link from "next/link";

import { InteriorPageShell, InteriorHero } from "@/components/airveek/interior-page-shell";
import { canonicalMetadata } from "@/lib/seo/site";
import { listLiveSeoPages } from "@/features/seo/server/content";

export const metadata: Metadata = {
  title: "AI Product Photography Guides",
  description: "Evidence-backed Airveek workflows for product listing, lifestyle, and detail photography.",
  ...canonicalMetadata("/product-photography"),
};

export const revalidate = 300;

export default async function ProductPhotographyIndex() {
  const pages = await listLiveSeoPages({ family: "product-hub" });
  const products = pages.filter((page) => page.path.split("/").filter(Boolean).length === 2);
  return <InteriorPageShell><InteriorHero eyebrow="Airveek product photography" title="Create product images that answer the buyer’s real questions." description="Explore documented Airveek workflows for clean listings, believable lifestyle scenes, and product-detail images. Every guide is tied to a verified generation run." /><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{products.map((page) => <article className="rounded-3xl border border-white/10 bg-[#0b120b] p-6" key={page.id}><p className="text-xs font-black uppercase tracking-[0.18em] text-[#83ff00]">Product workflow</p><h2 className="mt-3 font-display text-2xl font-bold text-white"><Link className="hover:text-[#83ff00]" href={page.path}>{page.title}</Link></h2><p className="mt-3 text-sm leading-7 text-[#a4b19e]">{page.meta_description}</p><Link className="mt-5 inline-flex text-sm font-bold text-[#b8ff6b]" href={page.path}>View the workflow →</Link></article>)}</div>{!products.length ? <div className="rounded-3xl border border-dashed border-white/15 bg-[#0b120b] p-8 text-center text-[#a4b19e]">The first verified product guides are being prepared. Once a page passes the evidence and editorial gates, it will appear here automatically.</div> : null}</section></InteriorPageShell>;
}
