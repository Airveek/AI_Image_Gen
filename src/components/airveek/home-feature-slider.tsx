"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { A11y, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

export interface FeatureCategory {
  title: string;
  description: string;
  iconSrc: string;
  artworkSrc: string;
  artworkAlt: string;
}

const featureCategories: FeatureCategory[] = [
  {
    title: "Generate Anything",
    description: "Turn a short idea into polished images for campaigns, content, and everyday creative work.",
    iconSrc: "/images/airveek/home/icons/ai-generator.png",
    artworkSrc: "/images/airveek/features/unlimited-ai-image-creator-v3.png",
    artworkAlt: "Airveek AI image generator showing multiple creative outputs",
  },
  {
    title: "Perfect Text & Logos",
    description: "Create readable campaign typography, logos, posters, and branded graphics with Premium tools.",
    iconSrc: "/images/airveek/home/icons/perfect-text.png",
    artworkSrc: "/images/airveek/features/perfect-text-in-ai-images-v4.png",
    artworkAlt: "Airveek artwork with crisp readable campaign typography",
  },
  {
    title: "Product Visuals",
    description: "Build polished product scenes and marketing images without organizing a traditional photoshoot.",
    iconSrc: "/images/airveek/home/icons/product-studio.png",
    artworkSrc: "/images/airveek/features/ai-product-photographer-v3.png",
    artworkAlt: "Airveek product photography scene with a branded jar",
  },
  {
    title: "Edit & Enhance",
    description: "Replace scenes, refine images, expand compositions, and make assets ready for their next use.",
    iconSrc: "/images/airveek/home/icons/magic-editor.png",
    artworkSrc: "/images/airveek/features/instant-scene-background-editor-v3.png",
    artworkAlt: "Airveek scene editor showing a vibrant tropical composition",
  },
  {
    title: "Consistent Characters",
    description: "Keep the same character recognizable across outfits, locations, products, and story scenes.",
    iconSrc: "/images/airveek/home/icons/character-studio.png",
    artworkSrc: "/images/airveek/features/consistent-character-v3.png",
    artworkAlt: "A consistent Airveek character shown in several scenes",
  },
  {
    title: "Storybooks & Voice",
    description: "Create illustrated stories, personalize their worlds, and add narration for immersive reading.",
    iconSrc: "/images/airveek/home/icons/storybook-voice.png",
    artworkSrc: "/images/airveek/features/talking-storybook-creator-v2.png",
    artworkAlt: "A narrated illustrated storybook created with Airveek",
  },
];

export function HomeFeatureSlider() {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAtEnd, setIsAtEnd] = useState(false);

  function syncSliderState(swiper: SwiperInstance): void {
    setActiveIndex(swiper.activeIndex);
    setIsAtEnd(swiper.isEnd);
  }

  return (
    <div className="mt-10">
      <Swiper
        className="!overflow-visible [&_.swiper-slide]:h-auto"
        modules={[A11y, Keyboard]}
        slidesPerView={1.08}
        spaceBetween={14}
        keyboard={{ enabled: true, onlyInViewport: true }}
        a11y={{ enabled: true }}
        breakpoints={{
          640: { slidesPerView: 2.05, spaceBetween: 16 },
          1024: { slidesPerView: 3, spaceBetween: 20 },
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          syncSliderState(swiper);
        }}
        onSlideChange={syncSliderState}
        onReachBeginning={syncSliderState}
        onReachEnd={syncSliderState}
      >
        {featureCategories.map((feature) => (
          <SwiperSlide key={feature.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[0_18px_55px_rgba(var(--theme-shadow))]">
              <div className="flex items-start gap-3 p-5 pb-4 sm:p-6 sm:pb-5">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-surface-muted">
                  <Image src={feature.iconSrc} alt="" width={768} height={768} className="size-14 object-contain" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </div>
              </div>
              <div className="relative mt-auto aspect-[4/3] overflow-hidden border-t border-border bg-media-stage">
                <Image
                  src={feature.artworkSrc}
                  alt={feature.artworkAlt}
                  fill
                  className="object-cover transition duration-500 hover:scale-[1.02]"
                  sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 31vw"
                />
              </div>
            </article>
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2" aria-label="Choose a feature slide">
          {featureCategories.map((feature, index) => (
            <button
              type="button"
              key={feature.title}
              onClick={() => swiperRef.current?.slideTo(index)}
              className={`h-2.5 rounded-full transition-[width,background-color] ${activeIndex === index ? "w-8 bg-primary" : "w-2.5 bg-border hover:bg-muted-foreground"}`}
              aria-label={`Show ${feature.title}`}
              aria-current={activeIndex === index ? "true" : undefined}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => swiperRef.current?.slidePrev()}
            disabled={activeIndex === 0}
            aria-label="Previous feature"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => swiperRef.current?.slideNext()}
            disabled={isAtEnd}
            aria-label="Next feature"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
