import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  CirclePlay,
  Clock3,
  Heart,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { CtaButton } from "./cta-button";
import { FeatureCard } from "./feature-card";
import { audiences, artworks, features, galleryArtworks, recapFeatures, useCases } from "./landing-data";
import { SectionHeading } from "./section-heading";

const trustItems = ["Commercial use", "No monthly fee", "HD downloads", "30-day guarantee"];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:pb-28 lg:pt-28" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(131,255,0,0.2),transparent_32%),radial-gradient(circle_at_15%_30%,rgba(42,196,20,0.16),transparent_28%)]" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#83ff00]/30 bg-[#83ff00]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#b8ff6b] sm:text-sm">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI images with perfect text
          </p>
          <h1 id="hero-title" className="font-display text-[clamp(2.65rem,7vw,5.4rem)] font-extrabold leading-[0.98] tracking-[-0.05em] text-[#fdfdfd]">
            Create visuals that make your business look <span className="bg-gradient-to-r from-[#2ac414] via-[#83ff00] to-[#b8ff6b] bg-clip-text text-transparent">bigger.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#a4b19e] sm:text-lg lg:mx-0">
            Generate AI images, product designs, logos, mockups, and marketing graphics without a design team or another monthly subscription.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <CtaButton href="#pricing">Get lifetime access — $49</CtaButton>
            <Link className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-[#fdfdfd]/80 transition hover:text-[#83ff00]" href="#how-it-works">
              <CirclePlay className="h-5 w-5 text-[#83ff00]" aria-hidden="true" />
              See how it works
            </Link>
          </div>
          <p className="mt-5 text-xs font-semibold text-[#81927c]">One payment · Commercial use · No monthly fee · 30-day guarantee</p>
          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs font-semibold text-[#a4b19e] lg:justify-start">
            {trustItems.map((item) => (
              <span className="inline-flex items-center gap-2" key={item}>
                <Check className="h-4 w-4 text-[#83ff00]" strokeWidth={2.5} aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[620px]">
          <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-[#83ff00]/20 via-[#2ac414]/10 to-transparent blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[2rem] border border-[#83ff00]/20 bg-[#0b120b]/90 p-3 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-5">
            <div className="flex items-center justify-between border-b border-white/10 px-2 pb-4 text-xs text-[#81927c]">
              <span className="inline-flex items-center gap-2 font-bold text-[#fdfdfd]"><span className="h-2 w-2 rounded-full bg-[#83ff00]" /> Airveek Studio</span>
              <span>Prompt → result</span>
            </div>
            <div className="grid gap-4 pt-4 sm:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-2xl border border-white/10 bg-[#040404] p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#83ff00]">Your prompt</p>
                <p className="m-0 text-sm leading-6 text-[#fdfdfd]">A premium coffee poster saying “Summer Coffee Sale”, warm light, clean layout.</p>
                <div className="mt-6 space-y-3 text-xs text-[#81927c]">
                  <div><span className="mb-1 block text-[#6f6f6f]">Style</span><span className="rounded-lg bg-white/10 px-2 py-1 text-[#d9ffb8]">Commercial poster</span></div>
                  <div><span className="mb-1 block text-[#6f6f6f]">Format</span><span className="rounded-lg bg-white/10 px-2 py-1 text-[#d9ffb8]">Square · HD</span></div>
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#83ff00]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#83ff00]/15"><Check className="h-3 w-3" aria-hidden="true" /></span> Ready in seconds</div>
              </div>
              <div className="relative min-h-[290px] overflow-hidden rounded-2xl border border-[#83ff00]/30 bg-gradient-to-br from-[#2ac414]/20 to-[#83ff00]/10">
                <Image
                  className="absolute inset-0 h-full w-full object-cover"
                  src="/images/artistly/hero-coffee-campaign-v3.png"
                  alt="AI-generated Summer Coffee Sale campaign with a giant iced coffee racing along a coastal road"
                  width={1254}
                  height={1254}
                  preload
                  quality={90}
                  sizes="(max-width: 767px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#040404]/90 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                  <div><p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-[#b8ff6b]">Generated result</p><p className="mt-1 text-sm font-bold text-[#fdfdfd]">Readable text. Ready to use.</p></div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-white backdrop-blur"><ArrowRight className="h-5 w-5" aria-hidden="true" /></span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-[#a4b19e]"><span>1 idea</span><span className="h-px flex-1 bg-gradient-to-r from-[#83ff00]/70 to-[#2ac414]/70" /><span>1 finished visual</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  return (
    <section className="border-y border-[#83ff00]/10 bg-[#080d08] px-4 py-8 sm:px-6" aria-label="Airveek trust signals">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-5 text-center sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Easy to use", value: "4.8 / 5" },
          { label: "Customer support", value: "4.8 / 5" },
          { label: "Value for money", value: "4.8 / 5" },
          { label: "Functionality", value: "4.8 / 5" },
        ].map((rating) => (
          <div className="rounded-2xl border border-white/10 bg-[#0b120b] px-5 py-4" key={rating.label}>
            <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#81927c]">{rating.label}</p>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm font-bold text-[#fdfdfd]"><span className="flex text-[#83ff00]" aria-label="5 out of 5 stars">{Array.from({ length: 5 }, (_, index) => <Star className="h-4 w-4 fill-current" key={index} aria-hidden="true" />)}</span>{rating.value}</div>
          </div>
        ))}
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-5 border-t border-white/10 pt-6 sm:flex-row">
          <Image className="h-auto w-[min(100%,410px)]" src="/images/airveek/payments.png" alt="PayPal, American Express, Mastercard, Visa, and 30-day money-back guarantee" width={410} height={50} />
          <Image className="h-auto w-[min(100%,458px)] sm:w-[360px]" src="/images/airveek/guarantee-apps.png" alt="Airveek works with Mac OS, Windows, and ChromeOS" width={458} height={46} />
        </div>
      </div>
    </section>
  );
}

export function GallerySection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="gallery-title">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#83ff00]/10 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl">
        <SectionHeading titleId="gallery-title" eyebrow="See what you can create" title="One idea can become a whole library of finished visuals." description="From product images and logos to coloring pages and social posts, Airveek gives you a faster way to make the work you already need." />
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {galleryArtworks.map((artwork) => (
            <div className="group relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={artwork.src}>
              <Image className="h-full w-full object-contain p-1 transition duration-500 sm:p-2" src={artwork.src} alt={artwork.alt} width={artwork.width} height={artwork.height} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 17vw" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#040404] to-transparent px-3 pb-3 pt-10 text-xs font-bold text-[#fdfdfd] opacity-0 transition duration-200 group-hover:opacity-100">Airveek creation</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StepsSection() {
  const steps = [
    { number: "01", title: "Enter your keyword or prompt", description: "Describe the idea in a few words. No complicated prompting needed." },
    { number: "02", title: "Customize your settings", description: "Choose the style, colors, size, resolution, and background you want." },
    { number: "03", title: "Generate and review", description: "Get multiple polished options, then pick the one ready for your project." },
  ];

  return (
    <section id="how-it-works" className="border-y border-white/10 bg-[#080d08] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="steps-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="steps-title" eyebrow="No experience needed" title="Effortless image creation in just 3 easy steps." description="The workflow is simple enough for a first-time user and flexible enough for client work." />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article className="relative rounded-3xl border border-white/10 bg-white/[0.045] p-6 sm:p-8" key={step.number}>
              {index < steps.length - 1 ? <div className="absolute right-[-15%] top-16 hidden h-px w-[30%] bg-gradient-to-r from-[#83ff00]/60 to-[#2ac414]/60 lg:block" aria-hidden="true" /> : null}
              <span className="font-display text-5xl font-extrabold text-[#83ff00]/15">{step.number}</span>
              <h3 className="mt-7 font-display text-2xl font-bold text-[#fdfdfd]">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#a4b19e]">{step.description}</p>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-3xl border border-[#83ff00]/20 bg-[#040404] p-2 shadow-[0_0_60px_rgba(131,255,0,0.12)] sm:p-4">
          <div className="flex items-center justify-between border-b border-white/10 px-3 pb-3 text-xs text-[#81927c]"><span className="font-bold text-[#fdfdfd]">Airveek walkthrough</span><span>See the full workflow</span></div>
          <iframe className="mt-3 aspect-video w-full rounded-2xl border-0" src="https://www.loom.com/embed/62e71dd47a7644cea41dbd274be3cef5?sid=7fbf1819-1127-4d0d-88b0-a6891d37768f&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true" title="Airveek walkthrough video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
      </div>
    </section>
  );
}

export function FeatureSuiteSection() {
  return (
    <section id="features" className="px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="features-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="features-title" eyebrow="One platform, many workflows" title="Cut the monthly tool stack down to one simple creative suite." description="Generate, edit, mock up, expand, upscale, and package your ideas without jumping between five different apps." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => <FeatureCard feature={feature} key={feature.title} />)}
        </div>
      </div>
    </section>
  );
}

export function TextProofSection() {
  return (
    <section className="overflow-hidden bg-gradient-to-br from-[#14220f] via-[#0b120b] to-[#040404] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="text-proof-title">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#83ff00]">The feature people notice</p>
          <h2 id="text-proof-title" className="font-display text-4xl font-extrabold leading-tight text-[#fdfdfd] sm:text-5xl">AI images with text that actually looks right.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#a4b19e] sm:text-lg">Make posters, logos, shirt designs, thumbnails, and ads without fighting distorted letters or sending every revision to a designer.</p>
          <div className="mt-8 space-y-4">
            {[
              "Write the message in your prompt.",
              "Generate the visual and review the result.",
              "Use it for your brand, product, or client project.",
            ].map((item, index) => <div className="flex items-center gap-3 text-sm font-semibold text-[#fdfdfd]" key={item}><span className="grid h-8 w-8 place-items-center rounded-full bg-[#83ff00] text-xs font-black text-[#040404]">{index + 1}</span>{item}</div>)}
          </div>
          <CtaButton className="mt-9" href="#pricing">Create with perfect text</CtaButton>
        </div>
        <div className="relative mx-auto w-full max-w-xl rounded-[2rem] border border-[#83ff00]/30 bg-[#0b120b] p-3 shadow-[0_0_70px_rgba(131,255,0,0.12)] sm:p-5">
          <div className="rounded-2xl border border-white/10 bg-[#040404] p-4 sm:p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#81927c]">Prompt</p>
            <p className="m-0 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-[#fdfdfd]">Create a coffee poster saying “SUMMER COFFEE SALE” in bold cream lettering.</p>
            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[#83ff00]"><span className="h-px flex-1 bg-[#83ff00]/30" />Generated result<span className="h-px flex-1 bg-[#83ff00]/30" /></div>
            <div className="relative overflow-hidden rounded-xl">
              <Image className="aspect-[4/3] w-full object-cover" src={artworks[5].src} alt="AI-generated poster example" width={artworks[5].width} height={artworks[5].height} sizes="(max-width: 1023px) 100vw, 50vw" />
              <div className="absolute inset-x-4 bottom-4 rounded-lg border border-[#83ff00]/30 bg-[#040404]/75 px-3 py-2 text-center font-display text-sm font-bold tracking-[0.14em] text-[#b8ff6b] backdrop-blur sm:text-base">SUMMER COFFEE SALE</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AudienceSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="audience-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="audience-title" eyebrow="What do you want to create?" title="One tool for the work you already do." description="Start with the use case that sounds like you. Then turn the same idea into more content, products, or client work." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            const artwork = artworks[audience.imageIndex];
            return <article className="group relative min-h-56 overflow-hidden rounded-3xl border border-white/10 bg-[#0b120b] p-5" key={audience.title}>
              <Image className="absolute inset-0 h-full w-full object-cover opacity-35 transition duration-500 group-hover:scale-105 group-hover:opacity-50" src={artwork.src} alt={artwork.alt} width={artwork.width} height={artwork.height} sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#040404] via-[#040404]/70 to-transparent" />
              <div className="relative flex h-full min-h-48 flex-col justify-end"><span className="mb-auto grid h-11 w-11 place-items-center rounded-2xl border border-[#83ff00]/30 bg-[#83ff00]/10 text-[#83ff00] backdrop-blur"><Icon className="h-5 w-5" aria-hidden="true" /></span><h3 className="font-display text-2xl font-bold text-[#fdfdfd]">{audience.title}</h3><p className="mt-1 text-sm text-[#a4b19e]">{audience.description}</p></div>
            </article>;
          })}
        </div>
      </div>
    </section>
  );
}

export function BusinessSection() {
  const savings = [
    { title: "Lower design costs", description: "Create visuals without hiring a designer for every revision." },
    { title: "Faster content creation", description: "Minimize time spent making the next image, post, or product asset." },
    { title: "DIY branding", description: "Build logos, brand visuals, and campaign graphics in one place." },
    { title: "Scalable output", description: "Produce a library of images without another fee for every design." },
  ];
  const earnings = ["Print-on-demand products", "Digital art marketplaces", "Freelance graphic design", "Social media management", "Stock photography", "Client marketing assets"];

  return (
    <section className="border-y border-white/10 bg-[#080d08] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="business-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="business-title" eyebrow="Create for yourself—or sell your work" title="Save money, save effort, and make more from every idea." description="Airveek gives you a faster way to create the visuals your business needs, then reuse them across products, campaigns, and client work." />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#0b120b] p-6 sm:p-8">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#83ff00]/15 text-[#83ff00]"><CircleDollarSign className="h-5 w-5" aria-hidden="true" /></span><h3 className="font-display text-2xl font-bold text-[#fdfdfd]">Stop paying for multiple AI tools</h3></div>
            <div className="mt-8 space-y-3">
              {["Image generator", "Product mockup tool", "Background editor", "Image upscaler", "Design tool"].map((tool) => <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[#a4b19e]" key={tool}><span>{tool}</span><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#b8ff6b]">Monthly</span></div>)}
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#2ac414]/25 to-[#83ff00]/10 px-4 py-4"><span className="text-sm font-bold text-[#fdfdfd]">Airveek</span><span className="font-display text-xl font-extrabold text-[#83ff00]">$49 once</span></div>
          </div>
          <div className="rounded-3xl border border-[#83ff00]/20 bg-gradient-to-br from-[#83ff00]/10 via-white/[0.04] to-[#2ac414]/10 p-6 sm:p-8">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#83ff00]/15 text-[#83ff00]"><Zap className="h-5 w-5" aria-hidden="true" /></span><h3 className="font-display text-2xl font-bold text-[#fdfdfd]">Ways to put your creations to work</h3></div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">{earnings.map((earning) => <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0b120b]/70 p-4 text-sm font-semibold text-[#fdfdfd]" key={earning}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#83ff00]" aria-hidden="true" />{earning}</div>)}</div>
            <p className="mt-6 text-sm leading-6 text-[#a4b19e]">Use your creations for your own business or commercial projects according to your plan&apos;s license. No exaggerated promises—just more ways to use the work you already need.</p>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {savings.map((item) => <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={item.title}><h3 className="font-display text-lg font-bold text-[#fdfdfd]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#a4b19e]">{item.description}</p></div>)}
        </div>
      </div>
    </section>
  );
}

export function UseCasesSection() {
  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="use-cases-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="use-cases-title" eyebrow="Dominate any marketing goal" title="Turn one creative idea into every asset your business needs." description="Make social posts, ads, product mockups, presentations, and more without waiting on a separate production queue." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase) => { const Icon = useCase.icon; return <article className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition duration-200 hover:-translate-y-1 hover:border-[#83ff00]/30" key={useCase.title}><Icon className="h-6 w-6 text-[#83ff00]" strokeWidth={1.8} aria-hidden="true" /><h3 className="mt-5 font-display text-xl font-bold capitalize text-[#fdfdfd]">{useCase.title}</h3><p className="mt-2 text-sm leading-6 text-[#a4b19e]">{useCase.description}</p></article>; })}
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  const commercial = ["Unlimited designs", "HD image downloads", "No monthly fees", "Commercial license", "No watermarks", "30-day money-back guarantee"];
  const premium = ["Everything in Commercial", "Consistent character", "Your face in AI images", "Product mockups and virtual models", "Perfect text in AI images", "Faster generation and premium tools"];

  return (
    <section id="pricing" className="border-y border-[#83ff00]/15 bg-gradient-to-b from-[#14220f] to-[#040404] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading titleId="pricing-title" eyebrow="One-time pricing" title="Get unlimited access without another monthly bill." description="Choose the level of creative freedom you need today. Both plans are paid once and include a 30-day money-back guarantee." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-2">
          <PricingCard title="Commercial" price="$49" description="The simple starting point for creators, sellers, marketers, and freelancers." features={commercial} checkoutHref="https://paykstrt.com/50543/131587?click_id=0" featured />
          <PricingCard title="Premium" price="$147" description="More powerful workflows for people who want every premium creation tool." features={premium} checkoutHref="https://paykstrt.com/53843/131587?cc=secret10&click_id=0" />
        </div>
        <p className="mt-8 text-center text-xs font-semibold text-[#81927c]">Use coupon <span className="text-[#83ff00]">SECRET10</span> for 10% off · No upsells · No hidden fees · No monthly charges</p>
      </div>
    </section>
  );
}

type PricingCardProps = { title: string; price: string; description: string; features: string[]; checkoutHref: string; featured?: boolean };

function PricingCard({ title, price, description, features: planFeatures, checkoutHref, featured = false }: PricingCardProps) {
  return (
    <article className={`relative rounded-[2rem] border p-6 sm:p-8 ${featured ? "border-[#83ff00]/70 bg-gradient-to-b from-[#83ff00]/15 to-[#0b120b] shadow-[0_0_60px_rgba(131,255,0,0.14)]" : "border-white/10 bg-[#0b120b]"}`}>
      {featured ? <span className="absolute right-6 top-6 rounded-full bg-[#83ff00] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#040404]">Best value</span> : null}
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b8ff6b]">{title}</p>
      <div className="mt-5 flex items-end gap-2"><span className="font-display text-6xl font-extrabold leading-none text-[#fdfdfd]">{price}</span><span className="pb-1 text-sm font-semibold text-[#81927c]">one time</span></div>
      <p className="mt-5 min-h-14 text-sm leading-6 text-[#a4b19e]">{description}</p>
      <CtaButton className="mt-6 w-full" href={checkoutHref}>Get instant access</CtaButton>
      <ul className="mt-7 space-y-3 border-t border-white/10 pt-6">{planFeatures.map((item) => <li className="flex items-start gap-3 text-sm text-[#d9ffb8]" key={item}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#83ff00]" aria-hidden="true" />{item}</li>)}</ul>
    </article>
  );
}

export function GuaranteeSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20" aria-labelledby="guarantee-title">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[2rem] border border-[#83ff00]/30 bg-gradient-to-r from-[#83ff00]/10 via-[#2ac414]/10 to-transparent p-8 text-center sm:p-12">
        <div className="grid h-16 w-16 place-items-center rounded-full border border-[#83ff00]/40 bg-[#83ff00]/10 text-[#83ff00]"><ShieldCheck className="h-8 w-8" aria-hidden="true" /></div>
        <div><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#83ff00]">Try it without the pressure</p><h2 id="guarantee-title" className="font-display text-3xl font-extrabold text-[#fdfdfd] sm:text-4xl">30-day money-back guarantee</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#a4b19e]">Create, test, and see if Airveek fits your workflow. If it is not right for you, the guarantee gives you a clear way out.</p></div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs font-bold text-[#d9ffb8]"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#83ff00]" aria-hidden="true" /> One-time payment</span><span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#83ff00]" aria-hidden="true" /> Commercial-ready plans</span></div>
      </div>
    </section>
  );
}

export function RecapSection() {
  return (
    <section className="border-y border-white/10 bg-[#080d08] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="recap-title">
      <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div className="lg:sticky lg:top-28"><p className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-[#83ff00]">Everything in one place</p><h2 id="recap-title" className="font-display text-4xl font-extrabold leading-tight text-[#fdfdfd] sm:text-5xl">Here&apos;s what you get from day one.</h2><p className="mt-5 text-base leading-7 text-[#a4b19e]">A practical creative toolkit for the visuals you need now—and the projects you want to try next.</p><CtaButton className="mt-8" href="#pricing">Get Airveek for $49</CtaButton></div>
        <div className="grid gap-3 sm:grid-cols-2">{recapFeatures.map((feature) => <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-[#d9ffb8]" key={feature}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#83ff00]" aria-hidden="true" />{feature}</div>)}</div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#040404] px-4 pb-10 pt-16 sm:px-6" id="footer">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-10 md:flex-row md:items-end"><div><Image src="/images/airveek/logo.png" alt="Airveek" width={1881} height={358} className="w-[234px]" /><p className="mt-4 max-w-sm text-sm leading-6 text-[#a4b19e]">Create more, spend less, and turn your ideas into finished visuals with Airveek.</p><p className="mt-3 text-xs text-[#6f6f6f]">980 Fraser Drive, Suite 209, Burlington ON L7L 5P5, Canada</p></div><div className="flex max-w-xl flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#a4b19e]"><Link className="transition hover:text-[#83ff00]" href="#features">Features</Link><Link className="transition hover:text-[#83ff00]" href="#pricing">Pricing</Link><Link className="transition hover:text-[#83ff00]" href="#faq">FAQ</Link><Link className="transition hover:text-[#83ff00]" href="https://artistly.ai/affiliates/">Affiliates</Link><Link className="transition hover:text-[#83ff00]" href="https://artistly.ai/support/">Support</Link><Link className="transition hover:text-[#83ff00]" href="https://artistly.ai/terms/terms.php">Terms</Link><Link className="transition hover:text-[#83ff00]" href="https://artistly.ai/terms/privacy.php">Privacy</Link><Link className="transition hover:text-[#83ff00]" href="https://artistly.ai/tutorials/">Tutorials</Link><Link className="transition hover:text-[#83ff00]" href="https://artistly.ai/fb/">FB Group</Link></div></div>
        <div className="flex flex-col justify-between gap-4 pt-6 text-xs text-[#6f6f6f] sm:flex-row"><span>© Airveek. All rights reserved.</span><span className="inline-flex items-center gap-1">Made with <Heart className="h-3.5 w-3.5 fill-[#83ff00] text-[#83ff00]" aria-hidden="true" /> in Canada</span></div>
      </div>
    </footer>
  );
}
