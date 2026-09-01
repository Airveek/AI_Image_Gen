import type { Metadata } from "next";
import Link from "next/link";

import { InteriorHero, InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { listLiveSeoPages } from "@/features/seo/server/content";
import { buildSeoMetadata } from "@/lib/seo/site";

export const metadata: Metadata = buildSeoMetadata({ title: "Airveek Authors", description: "Meet the writers and reviewers behind Airveek’s evidence-backed image workflows.", pathname: "/authors" });

export const revalidate = 300;

export default async function AuthorsIndex() {
  const pages = await listLiveSeoPages({ family: "tutorial" });
  return <InteriorPageShell><InteriorHero eyebrow="Airveek editorial team" title="Practical image guidance, reviewed by people who use the workflow." description="Author pages are published only when a contributor has a documented, reviewed Airveek workflow to share." /><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20"><div className="rounded-3xl border border-dashed border-white/15 bg-[#0b120b] p-8 text-center text-[#a4b19e]">Author profiles will appear here as reviewed contributors publish their first field guides.{pages.length ? <span className="mt-3 block"><Link className="text-[#b8ff6b] underline" href="/tutorials">Browse the current tutorials →</Link></span> : null}</div></section></InteriorPageShell>;
}
