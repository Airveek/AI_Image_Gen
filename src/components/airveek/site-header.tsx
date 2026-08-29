import Image from "next/image";
import Link from "next/link";
import { CtaButton } from "./cta-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#83ff00]/15 bg-[#040404]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link className="shrink-0 rounded-lg" href="/#top" aria-label="Airveek home">
          <Image src="/images/airveek/logo.png" alt="Airveek" width={1881} height={358} className="h-auto w-[200px] sm:w-[247px]" priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#a4b19e] lg:flex" aria-label="Main navigation">
          <Link className="transition hover:text-[#83ff00]" href="/#how-it-works">How it works</Link>
          <Link className="transition hover:text-[#83ff00]" href="/#features">Features</Link>
          <Link className="transition hover:text-[#83ff00]" href="/#pricing">Pricing</Link>
          <Link className="transition hover:text-[#83ff00]" href="/#faq">FAQ</Link>
          <Link className="transition hover:text-[#83ff00]" href="/tutorials">Tutorials</Link>
        </nav>
        <div className="flex items-center gap-2 text-xs font-bold sm:gap-3 sm:text-sm">
          <Link className="rounded-full px-2 py-2 text-[#a4b19e] transition hover:text-[#83ff00]" href="/login">
            Log in
          </Link>
          <Link className="rounded-full border border-[#83ff00]/40 bg-[#83ff00]/10 px-3 py-2 text-[#fdfdfd] transition hover:border-[#83ff00] hover:bg-[#83ff00]/20 sm:px-4" href="/register">
            Register
          </Link>
          <CtaButton className="hidden px-4 py-2 text-xs sm:px-5 sm:text-sm md:inline-flex" href="/#pricing">Get lifetime access</CtaButton>
        </div>
      </div>
    </header>
  );
}
