import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, ImagePlus, LockKeyhole, Shirt, ShoppingBag, Sparkles, Upload, UsersRound } from "lucide-react";

import { AirveekLogo } from "@/components/airveek/airveek-logo";
import { FashionCta, FashionViewTracker, PricingTracker } from "@/features/fashion-landing/fashion-tracking";
import { getActiveBillingConfiguration } from "@/features/billing/server/settings";
import { absoluteUrl } from "@/lib/seo/site";

const TITLE = "AI Fashion Photoshoot for Ecommerce Brands";
const DESCRIPTION = "Upload a product photo and model reference, then create two polished ecommerce fashion images free with Airveek.";

// Pricing follows the admin-selected billing mode on every visit. Checkout
// attempts snapshot that mode separately so an in-flight offer never changes.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/ai-fashion-photoshoot") },
  openGraph: { type: "website", url: absoluteUrl("/ai-fashion-photoshoot"), title: TITLE, description: DESCRIPTION, images: [{ url: absoluteUrl("/images/airveek/features/ai-fashion-designer-v2.png"), width: 1114, height: 1400, alt: "AI-generated editorial fashion campaign image made with Airveek" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [absoluteUrl("/images/airveek/features/ai-fashion-designer-v2.png")] },
};

const ctaClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-extrabold text-primary-foreground shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-primary-hover motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export default async function AiFashionPhotoshootPage() {
  const billing = await getActiveBillingConfiguration();
  const oneTime = billing.mode === "one_time";
  return (
    <main className="bg-background text-foreground">
      <FashionViewTracker />
      <header className="absolute inset-x-0 top-0 z-20 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link className="flex min-h-11 items-center rounded-lg" href="/" aria-label="Airveek home"><AirveekLogo className="w-36 sm:w-44" /></Link>
          <FashionCta placement="header" className="hidden min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/95 px-4 text-sm font-extrabold text-[#0d120d] shadow-sm transition hover:bg-white sm:inline-flex">Create 2 Images Free</FashionCta>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#eaf2e7] pt-24 dark:bg-[#071008]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(42,196,20,0.2),transparent_32%),radial-gradient(circle_at_86%_10%,rgba(8,122,67,0.16),transparent_32%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-24 lg:pt-14">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface/80 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-primary"><Sparkles className="size-3.5" aria-hidden="true" /> Built for ecommerce fashion</p>
            <h1 className="mt-6 text-balance font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-6xl lg:text-7xl">Your next fashion photoshoot starts with two photos.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Upload your product and a model reference. Airveek creates two polished store and campaign images while keeping each reference in its assigned role.</p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <FashionCta placement="hero" className={ctaClass}>Create 2 Images Free <ArrowRight className="size-5" aria-hidden="true" /></FashionCta>
              <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Check className="size-4 text-primary" aria-hidden="true" /> No credit card required</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><LockKeyhole className="size-4 text-primary" aria-hidden="true" /> Private account library</span><span className="flex items-center gap-2"><ShoppingBag className="size-4 text-primary" aria-hidden="true" /> Commercial-use downloads on paid access</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl" aria-label="Two references become a fashion campaign image">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/50 bg-media-stage shadow-[0_36px_100px_rgba(6,78,59,0.25)]">
              <Image src="/images/airveek/features/ai-fashion-designer-v2.png" alt="Editorial fashion image generated in Airveek" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 55vw" />
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-black/70 p-4 text-white backdrop-blur sm:inset-x-6 sm:bottom-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b9ff88]">Airveek output</p><p className="mt-1 font-display text-xl font-bold">A complete ecommerce fashion scene</p></div>
            </div>
            <div className="absolute -left-2 top-8 grid gap-3 sm:-left-8 sm:top-12">
              <SourceCard icon={<Shirt className="size-5" aria-hidden="true" />} label="Your product" />
              <SourceCard icon={<UsersRound className="size-5" aria-hidden="true" />} label="Your model" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-5"><div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-10 gap-y-3 px-4 text-sm font-bold text-muted-foreground sm:px-6"><span>2 free outputs</span><span>Product + model references</span><span>Private saved assets</span><span>No watermarks on paid access</span></div></section>

      <Section eyebrow="How it works" title="A photoshoot workflow without the studio logistics" intro="The guided playground opens with the right settings, so you can move from references to usable variations in one focused flow.">
        <div className="grid gap-5 md:grid-cols-3">{[
          [Upload, "Upload two references", "Choose the exact product or garment and a model image you have permission to use."],
          [Sparkles, "Set the scene", "Pick studio, lifestyle, or outdoor styling, then choose lighting and output format."],
          [ShoppingBag, "Generate and download", "Create two variations, review them side by side, and keep successful outputs in your private library."],
        ].map(([Icon, title, copy], index) => { const StepIcon = Icon as typeof Upload; return <article className="rounded-3xl border border-border bg-surface p-6 shadow-sm" key={String(title)}><div className="flex items-center justify-between"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><StepIcon className="size-6" aria-hidden="true" /></span><span className="font-display text-4xl font-extrabold text-primary/20">0{index + 1}</span></div><h3 className="mt-6 font-display text-2xl font-bold">{String(title)}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{String(copy)}</p></article>; })}</div>
      </Section>

      <Section muted eyebrow="Made for selling" title="One product, more places to show it" intro="Create formats for the ecommerce moments your team already needs—without changing tools.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["Product detail pages", "Paid social creative", "Seasonal lookbooks", "Marketplace listings"].map((item) => <article className="rounded-2xl border border-border bg-surface p-5" key={item}><Check className="size-5 text-primary" aria-hidden="true" /><h3 className="mt-4 font-display text-xl font-bold">{item}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Create a consistent visual direction for this channel from the same source references.</p></article>)}</div>
      </Section>

      <Section eyebrow="Real Airveek visuals" title="From clean catalog looks to editorial campaigns" intro="These are existing Airveek product visuals—not stock testimonials or invented customer work.">
        <div className="grid gap-5 md:grid-cols-3">
          <GalleryImage src="/images/airveek/features/virtual-model-creator-v2.png" alt="Three virtual fashion models wearing a blue jacket" label="Model variations" wide />
          <GalleryImage src="/images/airveek/features/ai-fashion-designer-v2.png" alt="Editorial model wearing a sculptural multicolor dress" label="Editorial direction" />
          <GalleryImage src="/images/airveek/features/ai-product-photographer-v3.png" alt="AI product photography example created in Airveek" label="Product campaigns" />
        </div>
      </Section>

      <Section muted eyebrow="See the product" title="A short look inside Airveek" intro="Play the 11-second product walkthrough, then open the guided Fashion Photoshoot workflow with your own references.">
        <div className="overflow-hidden rounded-3xl border border-border bg-[#081109] p-2 shadow-xl"><video className="aspect-video w-full rounded-[1.25rem] bg-black object-cover" controls muted playsInline preload="metadata" poster="/images/airveek/hero-premium-generated.png"><source src="/videos/airveek-walkthrough-v3.mp4" type="video/mp4" />Your browser does not support embedded video. The guided playground remains available below.</video></div>
      </Section>

      <Section eyebrow="Your references stay yours" title="Private by design, clear about storage" intro="We do not send your image files, filenames, prompts, or facial details to advertising analytics.">
        <div className="grid gap-5 md:grid-cols-3">{[
          [LockKeyhole, "Local before sign-in", "References selected before authentication stay in this browser until you create or access your account."],
          [ImagePlus, "Saved privately after sign-in", "Uploaded references and generated results are stored in your private account library until you delete them."],
          [UsersRound, "Use images responsibly", "Only upload product and model references you own or have permission to use."],
        ].map(([Icon, title, copy]) => { const ItemIcon = Icon as typeof LockKeyhole; return <article className="rounded-3xl border border-border bg-surface p-6" key={String(title)}><ItemIcon className="size-6 text-primary" aria-hidden="true" /><h3 className="mt-5 font-display text-xl font-bold">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{String(copy)}</p></article>; })}</div>
      </Section>

      <section className="px-4 py-20 sm:px-6 lg:px-8" id="pricing">
        <div className="mx-auto max-w-5xl">
          <PricingTracker mode={billing.mode} />
          <div className="grid overflow-hidden rounded-[2rem] border border-primary/25 bg-surface shadow-[0_30px_90px_rgba(6,78,59,0.12)] lg:grid-cols-[1fr_0.85fr]">
            <div className="p-7 sm:p-10">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Commercial access</p>
              <h2 className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">Keep every campaign moving.</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">Your two free images let you test the workflow first. Upgrade only when you want to keep creating.</p>
              <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-2">{["Unlimited designs subject to fair use", "HD image downloads", "Commercial license", "No watermarks", "All creator tools", "30-day money-back guarantee"].map((feature) => <li className="flex gap-2" key={feature}><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> {feature}</li>)}</ul>
            </div>
            <div className="signature-gradient flex flex-col justify-center p-7 text-white sm:p-10">
              <p className="text-sm font-bold text-white/75">Commercial</p>
              <p className="mt-3 font-display text-5xl font-extrabold sm:text-6xl">{oneTime ? "$49 lifetime" : "$49/month"}</p>
              <p className="mt-1 font-semibold text-white/80">{oneTime ? "one-time payment · ongoing access" : "monthly subscription · cancel anytime"}</p>
              <FashionCta placement="pricing" offerMode={billing.mode} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-extrabold text-[#0d120d] transition hover:bg-[#efffe5]">Create 2 Images Free <ArrowRight className="size-5" aria-hidden="true" /></FashionCta>
              <p className="mt-3 text-center text-xs text-white/70">No credit card for your first two images</p>
            </div>
          </div>
        </div>
      </section>

      <Section muted eyebrow="Questions" title="What ecommerce teams ask before trying it">
        <div className="mx-auto max-w-3xl divide-y divide-border rounded-3xl border border-border bg-surface px-5 sm:px-7">{[
          ["Do I need a credit card?", "No. Create an account and generate two free outputs before choosing a paid plan."],
          ["What happens to my source images?", "Before sign-in they stay in your browser. After sign-in they are saved in your private Airveek library until you delete them."],
          ["Can I use the results commercially?", "Commercial-use downloads are included with paid Commercial access, subject to Airveek’s Terms and your rights to the source material."],
          ["Will Airveek keep my product and model separate?", "The Fashion Photoshoot workflow assigns explicit product and model roles so the generation prompt preserves each reference for its intended purpose."],
          ["How does the free offer work?", "The first two outputs are free. The current paid offer is shown above and again at checkout."],
        ].map(([question, answer]) => <details className="group py-5" key={question}><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold"><span>{question}</span><ChevronRight className="size-5 shrink-0 text-primary transition group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" /></summary><p className="pb-2 pr-8 text-sm leading-6 text-muted-foreground">{answer}</p></details>)}</div>
      </Section>

      <section className="signature-gradient px-4 py-20 text-center text-white sm:px-6"><div className="mx-auto max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#c8ff9e]">Your references are ready when you are</p><h2 className="mt-4 text-balance font-display text-4xl font-extrabold sm:text-6xl">Create the fashion images your store needs next.</h2><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/80">Two outputs are included with every account. No credit card required.</p><FashionCta placement="final" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-base font-extrabold text-[#0d120d] transition hover:bg-[#efffe5]">Create 2 Images Free <ArrowRight className="size-5" aria-hidden="true" /></FashionCta></div></section>

      <footer className="border-t border-border bg-surface px-4 py-8 sm:px-6"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row"><AirveekLogo className="w-32" /><div className="flex gap-5"><Link className="hover:text-foreground" href="/privacy">Privacy</Link><Link className="hover:text-foreground" href="/terms">Terms</Link><Link className="hover:text-foreground" href="/support">Support</Link></div></div></footer>
    </main>
  );
}

function Section({ eyebrow, title, intro, muted = false, children }: { eyebrow: string; title: string; intro?: string; muted?: boolean; children: React.ReactNode }) {
  return <section className={`${muted ? "bg-surface-muted" : "bg-background"} px-4 py-20 sm:px-6 lg:px-8`}><div className="mx-auto max-w-7xl"><div className="mb-10 max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h2 className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h2>{intro ? <p className="mt-4 text-base leading-7 text-muted-foreground">{intro}</p> : null}</div>{children}</div></section>;
}

function SourceCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex w-36 items-center gap-2 rounded-2xl border border-white/70 bg-white/95 p-3 text-[#0d120d] shadow-xl backdrop-blur sm:w-44"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e6ffd0] text-[#087a43]">{icon}</span><span className="text-xs font-extrabold sm:text-sm">{label}</span></div>;
}

function GalleryImage({ src, alt, label, wide = false }: { src: string; alt: string; label: string; wide?: boolean }) {
  return <figure className={`group relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-media-stage ${wide ? "md:col-span-2 md:aspect-[16/10]" : ""}`}><Image src={src} alt={alt} fill className="object-cover transition duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" sizes={wide ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 100vw, 33vw"} /><figcaption className="absolute inset-x-4 bottom-4 rounded-xl bg-black/70 px-3 py-2 text-sm font-bold text-white backdrop-blur">{label}</figcaption></figure>;
}
