import type { Metadata } from "next";
import Link from "next/link";

import { InteriorHero, InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { listLiveSeoPages } from "@/features/seo/server/content";
import { canonicalMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Airveek AI Image Use Cases",
  description: "Browse documented Airveek workflows by ecommerce image use case.",
  ...canonicalMetadata("/use-cases"),
};

export const revalidate = 300;

export default async function UseCasesIndex() {
  const pages = await listLiveSeoPages();
  return <InteriorPageShell><InteriorHero eyebrow="Airveek use cases" title="Find the image workflow for the job in front of you." description="Every use case is tied to a real Airveek run, explicit settings, and a practical publish checklist." /><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pages.map((page) => <article className="rounded-3xl border border-white/10 bg-[#0b120b] p-6" key={page.id}><p className="text-xs font-black uppercase tracking-[0.18em] text-[#83ff00]">{page.page_family}</p><h2 className="mt-3 font-display text-2xl font-bold text-white"><Link className="hover:text-[#83ff00]" href={page.path}>{page.title}</Link></h2><p className="mt-3 text-sm leading-7 text-[#a4b19e]">{page.meta_description}</p></article>)}</div>{!pages.length ? <div className="rounded-3xl border border-dashed border-white/15 bg-[#0b120b] p-8 text-center text-[#a4b19e]">Approved use cases will appear here automatically after evidence and editorial review.</div> : null}</section></InteriorPageShell>;
}
