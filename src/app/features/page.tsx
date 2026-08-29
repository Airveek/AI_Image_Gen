import type { Metadata } from "next";
import Link from "next/link";

import { InteriorHero, InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { listLiveSeoPages } from "@/features/seo/server/content";
import { canonicalMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Airveek Features",
  description: "Explore Airveek features through documented product workflows and examples.",
  ...canonicalMetadata("/features"),
};

export const revalidate = 300;

export default async function FeaturesIndex() {
  const pages = await listLiveSeoPages({ family: "feature" });
  return <InteriorPageShell><InteriorHero eyebrow="Airveek features" title="See how each part of Airveek fits into a real image workflow." description="Feature pages explain the job, the evidence, and the practical path from prompt to publish-ready creative." /><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pages.map((page) => <article className="rounded-3xl border border-white/10 bg-[#0b120b] p-6" key={page.id}><h2 className="font-display text-2xl font-bold text-white"><Link className="hover:text-[#83ff00]" href={page.path}>{page.title}</Link></h2><p className="mt-3 text-sm leading-7 text-[#a4b19e]">{page.meta_description}</p></article>)}</div>{!pages.length ? <div className="rounded-3xl border border-dashed border-white/15 bg-[#0b120b] p-8 text-center text-[#a4b19e]">Feature guides will appear here as their evidence and editorial review complete.</div> : null}</section></InteriorPageShell>;
}
