import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Footer } from "./landing-sections";
import { SiteHeader } from "./site-header";

type InteriorPageShellProps = {
  children: ReactNode;
};

type InteriorHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function InteriorPageShell({ children }: InteriorPageShellProps) {
  return (
    <div id="top" className="min-h-screen bg-[#040404]">
      <SiteHeader />
      <main className="brand-glow min-h-[70vh]">{children}</main>
      <Footer />
    </div>
  );
}

export function InteriorHero({ eyebrow, title, description }: InteriorHeroProps) {
  return (
    <section className="border-b border-white/10 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <Link className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#83ff00]/20 bg-[#83ff00]/5 px-4 text-sm font-bold text-[#d9ffb8] transition hover:border-[#83ff00]/60 hover:bg-[#83ff00]/10" href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Airveek
        </Link>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#83ff00]">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl font-display text-4xl font-extrabold leading-[1.06] text-[#fdfdfd] sm:text-5xl lg:text-7xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-base leading-7 text-[#a4b19e] sm:text-lg sm:leading-8">{description}</p>
      </div>
    </section>
  );
}
