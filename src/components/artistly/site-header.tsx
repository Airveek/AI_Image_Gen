import Image from "next/image";
import Link from "next/link";
import { CtaButton } from "./cta-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#83ff00]/15 bg-[#040404]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link className="shrink-0 rounded-lg" href="#top" aria-label="Artistly home">
          <Image src="/images/artistly/logo.png" alt="Artistly 6.0" width={236} height={52} className="brand-logo h-auto w-[154px] sm:w-[190px]" priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#a4b19e] lg:flex" aria-label="Main navigation">
          <Link className="transition hover:text-[#83ff00]" href="#how-it-works">How it works</Link>
          <Link className="transition hover:text-[#83ff00]" href="#features">Features</Link>
          <Link className="transition hover:text-[#83ff00]" href="#pricing">Pricing</Link>
          <Link className="transition hover:text-[#83ff00]" href="#faq">FAQ</Link>
        </nav>
        <CtaButton className="px-4 py-2 text-xs sm:px-5 sm:text-sm" href="#pricing">Get lifetime access</CtaButton>
      </div>
    </header>
  );
}
