import Image from "next/image";
import Link from "next/link";
import { CtaButton } from "./cta-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[#83ff00]/15 bg-[#040404]/85 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link className="shrink-0 rounded-lg" href="/" aria-label="Airveek home">
          <Image src="/images/airveek/logo.png" alt="Airveek" width={1881} height={358} className="h-auto w-[160px] sm:w-[247px]" priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#a4b19e] lg:flex" aria-label="Main navigation">
          <Link className="transition hover:text-[#83ff00]" href="/#how-it-works">How it works</Link>
          <Link className="transition hover:text-[#83ff00]" href="/#features">Features</Link>
          <Link className="transition hover:text-[#83ff00]" href="/#pricing">Pricing</Link>
          <Link className="transition hover:text-[#83ff00]" href="/#faq">FAQ</Link>
        </nav>
<<<<<<< HEAD
        <div className="flex items-center gap-2 sm:gap-3">
          <Link className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#a4b19e] transition hover:text-[#83ff00] sm:inline-flex" href="/login">Log in</Link>
          <Link className="hidden rounded-full border border-[#83ff00]/35 px-3 py-2 text-sm font-semibold text-[#fdfdfd] transition hover:border-[#83ff00] hover:bg-[#83ff00]/10 sm:inline-flex" href="/register">Create account</Link>
          <CtaButton className="px-4 py-2 text-xs sm:px-5 sm:text-sm" href="#pricing">Get lifetime access</CtaButton>
        </div>
=======
        <CtaButton className="shrink-0 whitespace-nowrap px-3 py-2 text-[11px] sm:px-5 sm:text-sm" href="/#pricing">Get lifetime access</CtaButton>
>>>>>>> 1327e820e23757c2df1139d55e76adadbc45c8a5
      </div>
    </header>
  );
}
