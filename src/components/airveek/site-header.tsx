import Link from "next/link";
import { Menu } from "lucide-react";
import { AirveekLogo } from "./airveek-logo";
import { CtaButton } from "./cta-button";

type SiteHeaderProps = {
  variant?: "default" | "home";
};

const navigation = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Tutorials", href: "/tutorials" },
  { label: "Help", href: "/support" },
];

export function SiteHeader({ variant = "default" }: SiteHeaderProps) {
  if (variant === "home") {
    return (
      <header className="sticky top-0 z-40 h-20 px-4 text-white sm:px-8">
        <div className="relative mx-auto flex h-full max-w-[1800px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <details className="group relative xl:hidden">
              <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl text-white transition hover:bg-white/12 [&::-webkit-details-marker]:hidden" aria-label="Open navigation">
                <Menu className="size-5" aria-hidden="true" />
              </summary>
              <nav className="absolute left-0 top-12 w-60 rounded-2xl border border-border bg-surface p-2 text-sm font-semibold text-foreground shadow-xl" aria-label="Mobile navigation">
                {navigation.map((item) => (
                  <Link className="block rounded-xl px-4 py-3 transition hover:bg-surface-muted hover:text-primary" href={item.href} key={item.label}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </details>
            <Link className="shrink-0 rounded-lg" href="/#top" aria-label="Airveek home">
              <AirveekLogo tone="light" className="h-auto w-[118px] sm:w-[158px]" priority />
            </Link>
          </div>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 text-sm font-semibold text-white/78 xl:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link className="whitespace-nowrap transition hover:text-white" href={item.href} key={item.label}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm font-bold">
            <Link className="hidden min-h-10 items-center rounded-xl border border-white/20 px-4 text-white transition hover:border-white/50 hover:bg-white/10 sm:inline-flex" href="/register">
              Sign up
            </Link>
            <Link className="inline-flex min-h-10 items-center rounded-xl bg-white/90 px-4 text-[#0d120d] shadow-sm transition hover:bg-white" href="/login">
              Log in
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/88 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4">
        <Link className="shrink-0 rounded-lg" href="/#top" aria-label="Airveek home">
          <AirveekLogo className="h-auto w-[132px] min-[400px]:w-[154px] sm:w-[210px] lg:w-[230px]" priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground xl:flex" aria-label="Main navigation">
          {navigation.slice(0, 5).map((item) => (
            <Link className="transition hover:text-primary" href={item.href} key={item.label}>{item.label}</Link>
          ))}
        </nav>
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-sm">
          <Link className="hidden rounded-full px-2 py-2 text-muted-foreground transition hover:text-primary min-[430px]:inline-flex" href="/login">
            Log in
          </Link>
          <Link className="rounded-full border border-primary/30 bg-primary/8 px-3 py-2 text-foreground transition hover:border-primary hover:bg-primary/12 sm:px-4" href="/register">
            Register
          </Link>
          <div className="hidden md:block">
            <CtaButton className="px-4 py-2 text-xs sm:px-5 sm:text-sm" href="/#pricing">Get lifetime access</CtaButton>
          </div>
        </div>
      </div>
    </header>
  );
}
