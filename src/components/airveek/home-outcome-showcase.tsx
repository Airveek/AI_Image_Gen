"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Megaphone,
  PackageCheck,
  Palette,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ComponentType, KeyboardEvent, SVGProps } from "react";

type OutcomeId = "sell" | "market" | "brand" | "content";

type Outcome = {
  id: OutcomeId;
  tabLabel: string;
  title: string;
  description: string;
  proof: string;
  imageSrc: string;
  imageAlt: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const outcomes: Outcome[] = [
  {
    id: "sell",
    tabLabel: "Sell products",
    title: "Turn one product into a complete campaign.",
    description:
      "Create product photos, ecommerce images, packaging concepts, and social-ready visuals without booking a studio.",
    proof: "One product. Multiple ready-to-use formats.",
    imageSrc: "/images/airveek/home/outcomes/sell-products-v1.jpg",
    imageAlt:
      "A green skincare bottle developed into product photography, ecommerce, packaging, and social campaign visuals",
    icon: PackageCheck,
  },
  {
    id: "market",
    tabLabel: "Market your business",
    title: "Build the week’s marketing in one sitting.",
    description:
      "Start with your offer and create coordinated promotions for social posts, email banners, ads, and in-store displays.",
    proof: "Consistent campaign visuals across every channel.",
    imageSrc: "/images/airveek/home/outcomes/market-business-v1.jpg",
    imageAlt:
      "A coffee business campaign adapted into social, email, poster, and counter-display formats",
    icon: Megaphone,
  },
  {
    id: "brand",
    tabLabel: "Build your brand",
    title: "Look established from the very first day.",
    description:
      "Explore a clear visual direction, then carry it across logos, cards, stationery, presentations, and packaging.",
    proof: "One visual identity carried across every asset.",
    imageSrc: "/images/airveek/home/outcomes/build-brand-v1.jpg",
    imageAlt:
      "A cohesive green business identity applied to cards, stationery, presentation materials, and packaging",
    icon: Palette,
  },
  {
    id: "content",
    tabLabel: "Create content",
    title: "Show up consistently without starting over.",
    description:
      "Create recognizable video covers, social series, educational graphics, and digital guides around one business idea.",
    proof: "A recognizable content system, not random posts.",
    imageSrc: "/images/airveek/home/outcomes/create-content-v1.jpg",
    imageAlt:
      "A business advisor presented consistently across video, social, mobile, and digital-guide content",
    icon: BriefcaseBusiness,
  },
];

export function HomeOutcomeShowcase() {
  const [activeId, setActiveId] = useState<OutcomeId>("sell");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeOutcome = outcomes.find((outcome) => outcome.id === activeId) ?? outcomes[0];

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + outcomes.length) % outcomes.length;
    const nextOutcome = outcomes[nextIndex];
    setActiveId(nextOutcome.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="mt-10 lg:mt-12">
      <div
        className="mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 shadow-[0_10px_34px_rgba(var(--theme-shadow))] sm:rounded-full"
        role="tablist"
        aria-label="Choose a business outcome"
      >
        {outcomes.map((outcome, index) => {
          const Icon = outcome.icon;
          const isActive = outcome.id === activeOutcome.id;

          return (
            <button
              key={outcome.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`outcome-tab-${outcome.id}`}
              aria-controls="outcome-panel"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveId(outcome.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold transition sm:rounded-full sm:px-5 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4.5" aria-hidden="true" />
              {outcome.tabLabel}
            </button>
          );
        })}
      </div>

      <article
        key={activeOutcome.id}
        id="outcome-panel"
        role="tabpanel"
        aria-labelledby={`outcome-tab-${activeOutcome.id}`}
        className="mt-6 grid overflow-hidden rounded-[2rem] border border-border bg-surface shadow-[0_24px_80px_rgba(var(--theme-shadow))] lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f7f8f3] sm:aspect-[3/2] lg:aspect-auto lg:min-h-[590px]">
          <Image
            src={activeOutcome.imageSrc}
            alt={activeOutcome.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 1023px) 100vw, 68vw"
          />
        </div>
        <div className="signature-gradient flex flex-col justify-center px-6 py-9 text-white sm:px-9 lg:px-10 lg:py-12">
          <span className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-white/86 backdrop-blur-sm">
            Built around your business goal
          </span>
          <h3 className="mt-5 text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl">
            {activeOutcome.title}
          </h3>
          <p className="mt-4 text-base leading-7 text-white/82">{activeOutcome.description}</p>
          <p className="mt-7 border-t border-white/20 pt-5 text-sm font-bold text-white">
            {activeOutcome.proof}
          </p>
          <Link
            href="#features"
            className="mt-7 inline-flex min-h-12 w-fit items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#0d120d] shadow-sm transition hover:bg-white/90"
          >
            See the creative tools
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </article>
    </div>
  );
}
