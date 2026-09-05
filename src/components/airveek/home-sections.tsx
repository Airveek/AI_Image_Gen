import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  BadgeCheck,
  Check,
  Clock3,
  Heart,
  ShieldCheck,
} from "lucide-react";
import { AirveekLogo } from "./airveek-logo";
import { CtaButton } from "./cta-button";
import { HomeFeatureSlider } from "./home-feature-slider";
import { HomeOutcomeShowcase } from "./home-outcome-showcase";
import { SectionHeading } from "./section-heading";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import type { BillingMode, PlanKey } from "@/lib/billing/types";

const heroIcons = [
  { src: "/images/airveek/home/icons/ai-generator.png", className: "-left-5 top-[13%] size-24 sm:left-[27%] sm:top-[59%] sm:size-28 lg:size-32" },
  { src: "/images/airveek/home/icons/perfect-text.png", className: "-right-8 top-[28%] size-24 sm:left-[40%] sm:right-auto sm:top-[63%] sm:size-28 lg:size-32" },
  { src: "/images/airveek/home/icons/product-studio.png", className: "left-[50%] top-[3%] size-24 sm:left-[53%] sm:top-[59%] sm:size-28 lg:size-32" },
  { src: "/images/airveek/home/icons/magic-editor.png", className: "-right-7 top-[59%] size-24 sm:right-[27%] sm:top-[63%] sm:size-28 lg:size-32" },
  { src: "/images/airveek/home/icons/character-studio.png", className: "-left-16 top-[43%] size-24 sm:left-[22%] sm:top-[82%] sm:size-28 lg:size-32" },
  { src: "/images/airveek/home/icons/storybook-voice.png", className: "left-[18%] top-[70%] size-24 sm:left-auto sm:right-[22%] sm:top-[82%] sm:size-28 lg:size-32" },
];

export function HomeHero() {
  return (
    <section className="relative isolate min-h-[calc(100svh-5rem)] overflow-hidden px-4 text-white sm:min-h-[760px] sm:px-6 lg:min-h-[816px]" aria-labelledby="home-hero-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.14),transparent_34%)]" aria-hidden="true" />
      {heroIcons.map((icon) => (
        <Image
          key={icon.src}
          src={icon.src}
          alt=""
          width={768}
          height={768}
          className={`pointer-events-none absolute z-0 object-contain drop-shadow-[0_20px_26px_rgba(0,0,0,0.16)] ${icon.className}`}
          aria-hidden="true"
        />
      ))}
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center pt-[180px] text-center sm:pt-5">
        <h1 id="home-hero-title" className="max-w-[235px] text-balance font-display text-[clamp(2.7rem,6vw,7rem)] font-medium leading-[1.1] tracking-[-0.025em] text-white sm:max-w-5xl sm:leading-[1.08]">
          What will you create today?
        </h1>
        <p className="mt-4 max-w-[300px] text-base leading-5 text-white/86 sm:mt-6 sm:max-w-3xl sm:text-xl sm:leading-8 lg:text-2xl">
          Make AI-powered images, product visuals, logos, characters, storybooks, and more with Airveek.
        </p>
        <CtaButton className="mt-5 w-48 rounded-xl sm:mt-10 sm:rounded-[20px]" href="#pricing" variant="inverse" showArrow={false} size="hero">Start creating</CtaButton>
      </div>
      <Link className="absolute bottom-0 left-1/2 z-10 inline-flex min-h-12 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-t-2xl bg-white/88 px-5 text-sm font-semibold text-[#0d120d] shadow-sm backdrop-blur-sm transition hover:bg-white" href="#features">
        Scroll to explore
        <ArrowDown className="size-5" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function HomeTrustRow({ billingMode }: { billingMode: BillingMode }) {
  const items = [billingMode === "subscription" ? "Simple monthly plans" : "Simple one-time plans", "Commercial-use plans", "HD downloads", "30-day guarantee"];

  return (
    <section className="border-b border-border bg-surface px-4 py-6 sm:px-6" aria-label="Airveek purchase facts">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-4 text-sm font-semibold text-muted-foreground lg:grid-cols-4">
        {items.map((item) => (
          <span className="inline-flex items-center justify-center gap-2 text-center" key={item}>
            <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden="true" />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

export function HomeFeatures() {
  return (
    <section id="business-outcomes" className="overflow-hidden px-4 py-20 sm:px-6 lg:py-32" aria-labelledby="outcomes-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          titleId="outcomes-title"
          title="Make the business visual you need, without learning prompt engineering."
          description="Choose what you are trying to achieve. Airveek helps shape the creative direction so a short, ordinary description can produce a professional result."
          size="display"
        />
        <HomeOutcomeShowcase />
      </div>
    </section>
  );
}

export function HomeHowItWorks() {
  const steps = [
    { number: "1", title: "Choose your business goal", description: "Tell Airveek whether you need a product image, campaign, logo, story, character, or another visual." },
    { number: "2", title: "Answer a few plain-English questions", description: "Pick the style and direction. You do not need technical AI language or a long prompt formula." },
    { number: "3", title: "Review and download your options", description: "Generate polished directions, refine the one you like, and export it for your business." },
  ];

  return (
    <section id="how-it-works" className="border-y border-border bg-surface-muted px-4 py-20 sm:px-6 lg:py-32" aria-labelledby="steps-title">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <SectionHeading
            titleId="steps-title"
            title="You bring the goal. Airveek handles the prompt."
            description="Built for busy business owners who want the result without becoming AI experts first."
            align="left"
            size="display"
          />
          <div className="divide-y divide-border border-y border-border">
          {steps.map((step) => (
            <article className="grid gap-4 py-6 sm:grid-cols-[3rem_1fr] sm:py-7" key={step.number}>
              <span className="grid size-11 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">{step.number}</span>
              <div>
                <h3 className="font-display text-xl font-bold text-foreground sm:text-2xl">{step.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{step.description}</p>
              </div>
            </article>
          ))}
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-6xl overflow-hidden rounded-[2rem] border border-border bg-surface p-2 shadow-[0_24px_80px_rgba(var(--theme-shadow))] sm:p-4 lg:mt-16">
          <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1 text-xs text-muted-foreground sm:text-sm">
            <span className="font-bold text-foreground">See the guided workflow</span>
            <span>2-minute walkthrough</span>
          </div>
          <video className="aspect-video w-full rounded-2xl bg-media-stage object-cover" controls muted playsInline preload="metadata" poster="/videos/airveek-walkthrough-poster-v3.png" aria-label="Airveek creative workflow walkthrough">
            <source src="/videos/airveek-walkthrough-v3.mp4" type="video/mp4" />
            Your browser does not support the Airveek walkthrough video.
          </video>
        </div>
      </div>
    </section>
  );
}

export function HomeCreativeSuite() {
  return (
    <section id="features" className="overflow-hidden px-4 py-20 sm:px-6 lg:py-32" aria-labelledby="features-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          titleId="features-title"
          title="All your visual work. One place."
          description="Move from everyday marketing to advanced product images, readable AI text, consistent characters, and narrated stories without stitching together multiple subscriptions."
          size="display"
        />
        <HomeFeatureSlider />
      </div>
    </section>
  );
}

type PricingCardProps = {
  title: string;
  price: string;
  description: string;
  bestFor: string;
  features: readonly string[];
  planKey: PlanKey;
  featured?: boolean;
  billingMode: BillingMode;
};

function PricingCard({ title, price, description, bestFor, features, planKey, billingMode, featured = false }: PricingCardProps) {
  return (
    <article className={`relative rounded-[2rem] border p-6 shadow-sm sm:p-8 ${featured ? "border-primary/60 bg-primary/6" : "border-border bg-surface"}`}>
      {featured ? <span className="absolute right-6 top-6 rounded-full bg-primary px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-primary-foreground">Best value</span> : null}
      <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{title}</p>
      <div className="mt-5 flex items-end gap-2">
        <span className="font-display text-6xl font-extrabold leading-none text-foreground">{price}</span>
        <span className="pb-1 text-sm font-semibold text-muted-foreground">{billingMode === "subscription" ? "per month" : "one time"}</span>
      </div>
      <p className="mt-5 min-h-14 text-sm leading-6 text-muted-foreground">{description}</p>
      <p className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-sm leading-6 text-foreground"><span className="font-bold">Choose this if:</span> {bestFor}</p>
      <CtaButton className="mt-6 w-full" href={`/checkout?plan=${planKey}`}>Get instant access</CtaButton>
      <ul className="mt-7 space-y-3 border-t border-border pt-6">
        {features.map((feature) => (
          <li className="flex items-start gap-3 text-sm text-foreground" key={feature}>
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function HomePricingAndGuarantee({ billingMode }: { billingMode: BillingMode }) {
  const commercial = PLAN_DEFINITIONS.commercial;
  const premium = PLAN_DEFINITIONS.premium;

  return (
    <section id="pricing" className="border-t border-border bg-surface-muted px-4 py-20 sm:px-6 lg:py-32" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="pricing-title" eyebrow={billingMode === "subscription" ? "Monthly pricing" : "One-time pricing"} title="Choose a plan that grows with your creative work." description="Start with the capability level your business needs and manage billing securely from your account." size="display" />
        <div className="mx-auto mt-10 grid max-w-5xl gap-5 lg:grid-cols-2">
          <PricingCard title={commercial.name} price={`$${commercial.priceUsdCents / 100}`} description={commercial.description} bestFor={commercial.bestFor} features={commercial.features} planKey={commercial.key} billingMode={billingMode} featured />
          <PricingCard title={premium.name} price={`$${premium.priceUsdCents / 100}`} description={premium.description} bestFor={premium.bestFor} features={premium.features} planKey={premium.key} billingMode={billingMode} />
        </div>
        <p className="mt-7 text-center text-xs font-semibold text-muted-foreground">Use coupon <span className="font-bold text-primary">SECRET10</span> for 10% off{billingMode === "subscription" ? " · Cancel from your billing portal" : ""}</p>
        <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center gap-5 rounded-[2rem] border border-primary/25 bg-primary/6 p-7 text-center sm:flex-row sm:p-9 sm:text-left">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"><ShieldCheck className="size-8" aria-hidden="true" /></div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Try it without the pressure</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-foreground sm:text-3xl">30-day money-back guarantee</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Create, test, and decide whether Airveek fits your workflow with a clear refund window.</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 text-xs font-bold text-foreground">
            <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-primary" aria-hidden="true" /> {billingMode === "subscription" ? "Monthly billing" : "One-time billing"}</span>
            <span className="inline-flex items-center gap-2"><BadgeCheck className="size-4 text-primary" aria-hidden="true" /> Commercial-ready plans</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeFinalCta({ billingMode }: { billingMode: BillingMode }) {
  return (
    <section className="signature-gradient relative isolate flex min-h-[520px] items-center justify-center overflow-hidden px-4 py-20 text-white sm:px-6 lg:min-h-[620px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.13),transparent_42%)]" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <h2 className="text-balance font-display text-[2.7rem] font-medium leading-[1.05] tracking-[-0.035em] sm:text-6xl lg:text-7xl">Start creating with Airveek.</h2>
        <p className="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">Turn a straightforward business idea into polished visual options. Guidance is built in, with no prompt-engineering course required.</p>
        <CtaButton className="mt-8 min-w-56" href="#pricing" variant="inverse" showArrow={false}>{billingMode === "subscription" ? "Start from $49/month" : "Start from $49 one time"}</CtaButton>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-muted px-4 pb-10 pt-14 sm:px-6" id="footer">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-8 border-b border-border pb-9 md:flex-row md:items-end">
          <div>
            <AirveekLogo className="h-auto w-[220px]" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Create more, spend less, and turn your ideas into finished visuals with Airveek.</p>
            <p className="mt-3 text-xs text-muted-foreground">980 Fraser Drive, Suite 209, Burlington ON L7L 5P5, Canada</p>
          </div>
          <nav className="flex max-w-xl flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-muted-foreground" aria-label="Footer navigation">
            <Link className="transition hover:text-primary" href="/#features">Features</Link>
            <Link className="transition hover:text-primary" href="/#pricing">Pricing</Link>
            <Link className="transition hover:text-primary" href="/#faq">FAQ</Link>
            <Link className="transition hover:text-primary" href="/support">Support</Link>
            <Link className="transition hover:text-primary" href="/terms">Terms</Link>
            <Link className="transition hover:text-primary" href="/privacy">Privacy</Link>
            <Link className="transition hover:text-primary" href="/disclaimer">Disclaimer</Link>
            <Link className="transition hover:text-primary" href="/tutorials">Tutorials</Link>
          </nav>
        </div>
        <div className="flex flex-col justify-between gap-4 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© Airveek. All rights reserved.</span>
          <span className="inline-flex items-center gap-1">Made with <Heart className="size-3.5 fill-primary text-primary" aria-hidden="true" /> in Canada</span>
        </div>
      </div>
    </footer>
  );
}
