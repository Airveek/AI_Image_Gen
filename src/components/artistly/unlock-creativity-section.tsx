"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";

type Artwork = {
  src: string;
  width: number;
  height: number;
};

const artworks: Artwork[] = [
  { src: "/images/artistly/unlock/slider/ul-s1.png", width: 244, height: 302 },
  { src: "/images/artistly/unlock/slider/ul-s2.png", width: 300, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s3.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s4.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s5.png", width: 220, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s6.png", width: 300, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s7.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s8.png", width: 220, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s9.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s10.png", width: 300, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s11.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s12.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s13.png", width: 220, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s14.png", width: 300, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s15.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s16.png", width: 220, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s17.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s18.png", width: 300, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s19.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s20.png", width: 220, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s21.png", width: 220, height: 250 },
  { src: "/images/artistly/unlock/slider/ul-s22.png", width: 300, height: 300 },
  { src: "/images/artistly/unlock/slider/ul-s23.png", width: 220, height: 300 },
];

const benefits = ["unlimited designs", "unique images", "commercial use"];

const containerClass =
  "mx-auto w-full px-3 sm:max-w-[540px] md:max-w-[720px] lg:max-w-[960px] xl:max-w-[1140px] min-[1400px]:!max-w-[1320px]";

function DownArrow() {
  return (
    <div className="h-[26.625px] text-center leading-none">
      <svg
        className="inline-block h-[26px] w-[26px] fill-none stroke-white stroke-[3.5] [stroke-linecap:round] [stroke-linejoin:round]"
        viewBox="0 0 26 26"
        aria-hidden="true"
      >
        <path d="m4 5 9 9 9-9" />
        <path d="m4 12 9 9 9-9" />
      </svg>
    </div>
  );
}

export function UnlockCreativitySection() {
  const swiperRef = useRef<SwiperInstance | null>(null);

  const moveSlider = (direction: "previous" | "next") => {
    const swiper = swiperRef.current;

    if (!swiper) {
      return;
    }

    swiper.autoplay.stop();

    if (direction === "previous") {
      swiper.slidePrev();
    } else {
      swiper.slideNext();
    }
  };

  return (
    <section
      id="unlock-creativity"
      className="relative z-0 -mt-[130px] bg-[url('/images/artistly/unlock/background.png')] bg-cover bg-center bg-no-repeat py-[170px] text-center max-[575px]:py-20"
      aria-labelledby="unlock-creativity-title"
    >
      <div className={containerClass}>
        <div className="relative inline-block rounded-[40px] bg-[#312a44] py-[5px] pl-[120px] pr-10 max-[575px]:px-5">
          <Image
            className="absolute -left-[70px] -top-[60px] h-[150px] w-[169px] max-[575px]:hidden"
            src="/images/artistly/unlock/heading.png"
            alt=""
            width={169}
            height={150}
            aria-hidden="true"
          />
          <p
            id="unlock-creativity-title"
            className="m-0 inline-block bg-[linear-gradient(to_right,#f34491_30%,#fcc257_50%)] bg-clip-text font-[family-name:var(--font-k2d)] text-[44px] font-extrabold capitalize leading-[1.5] text-transparent max-[575px]:text-[25px]"
          >
            unlock your creativity
          </p>
        </div>

        <div className="relative mx-auto mt-10 max-w-[910px] rounded-[20px] bg-black/30 px-5 py-[15px] max-[575px]:mt-[60px]">
          <Image
            className="absolute -left-1 top-1/2 h-32 w-2 -translate-y-1/2"
            src="/images/artistly/unlock/orange-line.png"
            alt=""
            width={8}
            height={128}
            aria-hidden="true"
          />
          <Image
            className="absolute -right-1 top-1/2 h-32 w-2 -translate-y-1/2"
            src="/images/artistly/unlock/yellow-line.png"
            alt=""
            width={8}
            height={128}
            aria-hidden="true"
          />
          <h2 className="m-0 font-[family-name:var(--font-k2d)] text-[54px] font-extrabold leading-[1.2] text-white max-[575px]:text-2xl">
            <span className="bg-[linear-gradient(to_right,#0dccff_30%,#4760ff_50%)] bg-clip-text capitalize text-transparent">
              Generate AI Images
            </span>{" "}
            That Captivate &amp; Inspire Like Never Before!
          </h2>
        </div>
      </div>

      <div className="relative mt-[50px]">
        <Swiper
          className="!m-0 [&_.swiper-wrapper]:items-center [&_.swiper-slide]:!h-auto"
          modules={[Autoplay]}
          slidesPerView={2}
          spaceBetween={15}
          centeredSlides
          loop
          speed={2000}
          autoplay={{
            delay: 2500,
            waitForTransition: true,
            disableOnInteraction: true,
          }}
          breakpoints={{
            320: { slidesPerView: 2, spaceBetween: 15 },
            575: { slidesPerView: 3, spaceBetween: 15 },
            768: { slidesPerView: 4, spaceBetween: 15 },
            992: { slidesPerView: 5, spaceBetween: 10 },
            1200: { slidesPerView: 8, spaceBetween: 10 },
          }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
        >
          {artworks.map((artwork, index) => (
            <SwiperSlide className="flex items-center" key={artwork.src}>
              <Image
                className="h-auto w-full rounded-[10px]"
                src={artwork.src}
                alt={`Artistly AI artwork example ${index + 1}`}
                width={artwork.width}
                height={artwork.height}
                sizes="(max-width: 574px) 48vw, (max-width: 767px) 32vw, (max-width: 991px) 24vw, (max-width: 1199px) 19vw, 12vw"
                unoptimized
              />
            </SwiperSlide>
          ))}
        </Swiper>

        <button
          type="button"
          className="absolute left-5 top-1/2 z-10 -mt-[22px] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[linear-gradient(78deg,#ff404f_0%,#fdc159_100%)] text-white transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#fff254] max-[575px]:left-2.5 max-[575px]:h-10 max-[575px]:w-10"
          onClick={() => moveSlider("previous")}
          aria-label="Previous artwork"
        >
          <ChevronLeft className="h-6 w-6 max-[575px]:h-5 max-[575px]:w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="absolute right-5 top-1/2 z-10 -mt-[22px] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[linear-gradient(78deg,#ff404f_0%,#fdc159_100%)] text-white transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#fff254] max-[575px]:right-2.5 max-[575px]:h-10 max-[575px]:w-10"
          onClick={() => moveSlider("next")}
          aria-label="Next artwork"
        >
          <ChevronRight className="h-6 w-6 max-[575px]:h-5 max-[575px]:w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div className={containerClass}>
        <ul className="m-0 mt-[50px] flex list-none items-center justify-center gap-[30px] p-0 text-left text-base leading-6 text-[#212529] max-[991px]:gap-2.5 max-[575px]:flex-col max-[575px]:gap-[15px]">
          {benefits.map((benefit) => (
            <li className="flex items-center" key={benefit}>
              <Image
                className="h-[60px] w-[57px] shrink-0"
                src="/images/artistly/unlock/success-icon.png"
                alt=""
                width={57}
                height={60}
                aria-hidden="true"
              />
              {benefit}
            </li>
          ))}
        </ul>
        <DownArrow />
      </div>
    </section>
  );
}
