import Image from "next/image";
import { Star } from "lucide-react";

type TrustBadge = {
  src: string;
  alt: string;
  href: string;
  width: number;
  height: number;
  boxClass?: string;
};

const trustBadges: TrustBadge[] = [
  {
    src: "/images/artistly/badge-capterra-review.svg",
    alt: "Artistly customer rating on Capterra",
    href: "https://www.capterra.com/p/10015856/Artistly/reviews/",
    width: 278,
    height: 91,
  },
  {
    src: "/images/artistly/badge-getapp-review.png",
    alt: "Artistly user reviews on GetApp",
    href: "https://www.getapp.com/all-software/a/artistly/reviews/",
    width: 1667,
    height: 1125,
  },
  {
    src: "/images/artistly/badge-capterra-rating.png",
    alt: "Capterra Best Value 2024 award",
    href: "https://www.capterra.com/p/10015856/Artistly/",
    width: 800,
    height: 625,
    boxClass: "!w-40 !px-[5px]",
  },
  {
    src: "/images/artistly/badge-software-advice-review.png",
    alt: "Software Advice Most Recommended 2024 award",
    href: "https://www.softwareadvice.com/product/449917-Artistly/",
    width: 800,
    height: 625,
    boxClass: "!w-[150px] !px-0",
  },
  {
    src: "/images/artistly/badge-software-advice-rating.png",
    alt: "Software Advice Best Customer Support 2024 award",
    href: "https://www.softwareadvice.com/product/449917-Artistly/",
    width: 590,
    height: 621,
  },
  {
    src: "/images/artistly/badge-getapp-rating.png",
    alt: "GetApp Best Functionality and Features 2024 award",
    href: "https://www.getapp.com/all-software/a/artistly/",
    width: 800,
    height: 625,
  },
];

const ratings = ["Easy to Use", "Customer Support", "Value for Money", "Functionality"];

const badgeBaseClass =
  "flex min-h-[150px] w-[180px] items-center justify-center rounded-[10px] bg-[#1e1f39] px-[15px] max-[575px]:!w-[45%] max-[575px]:!px-[15px]";

function DownArrow() {
  return (
    <svg
      className="mx-auto mt-5 h-[26px] w-[26px] fill-none stroke-white stroke-[3.5] [stroke-linecap:round] [stroke-linejoin:round]"
      viewBox="0 0 26 26"
      aria-hidden="true"
    >
      <path d="m4 5 9 9 9-9" />
      <path d="m4 12 9 9 9-9" />
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="pb-[200px] text-center" aria-labelledby="hero-title">
      <div className="mx-auto w-[calc(100%-24px)]">
        <p className="relative mx-auto w-fit min-w-[400px] rounded-full bg-[linear-gradient(115deg,#0dcbff,#4760ff)] px-5 py-[15px] text-[26px] font-black leading-[1.2] before:absolute before:right-[calc(100%+10px)] before:top-5 before:h-[19px] before:w-20 before:bg-[url('/images/artistly/eyebrow-left.png')] before:bg-contain before:bg-center before:bg-no-repeat before:content-[''] after:absolute after:left-[calc(100%+10px)] after:top-5 after:h-[19px] after:w-20 after:bg-[url('/images/artistly/eyebrow-right.png')] after:bg-contain after:bg-center after:bg-no-repeat after:content-[''] max-[767px]:min-w-[350px] max-[767px]:text-[22px] max-[767px]:before:hidden max-[767px]:after:hidden max-[425px]:min-w-[250px] max-[425px]:text-base max-[425px]:font-bold">
          AI Designs With Perfect Text
        </p>

        <h1
          id="hero-title"
          className="mx-auto max-w-[1150px] py-[15px] font-[family-name:var(--font-k2d)] text-[64px] font-extrabold leading-[1.2] text-white max-[767px]:text-[40px] max-[425px]:max-w-[360px] max-[425px]:text-2xl"
        >
          Produce Stunning Images, Logos &amp; Art
          <br className="hidden sm:block" /> With Just a Keyword Using AI
        </h1>

        <h2 className="relative my-[15px] mb-20 inline-block w-full border-2 border-transparent [border-image:linear-gradient(45deg,#e065fe,#fcc257)_1] px-[25px] py-2.5 font-[family-name:var(--font-k2d)] text-[64px] font-extrabold leading-[1.2] text-[#e065fe] before:absolute before:-left-[6px] before:-top-[6px] before:h-[10px] before:w-[10px] before:bg-[#e065fe] before:content-[''] after:absolute after:-bottom-[6px] after:-left-[6px] after:h-[10px] after:w-[10px] after:bg-[#e065fe] after:content-[''] max-[767px]:mb-[60px] max-[767px]:text-[40px] max-[425px]:mb-10 max-[425px]:px-[15px] max-[425px]:text-2xl">
          For Your Brand, Social Media, {" "}
          <span className="bg-[linear-gradient(to_right,#f34491_30%,#fcc257_50%)] bg-clip-text text-transparent before:absolute before:-right-[6px] before:-top-[6px] before:h-[10px] before:w-[10px] before:bg-[#fcc257] before:content-[''] after:absolute after:-bottom-[6px] after:-right-[6px] after:h-[10px] after:w-[10px] after:bg-[#fcc257] after:content-['']">
            or Commercial Projects!
          </span>
        </h2>

        <div className="relative z-[1] mx-auto h-[425px] w-[min(100%,760px)] border-x-[5px] border-[#f34491] bg-[#1e213b] before:absolute before:-top-5 before:left-1/2 before:-z-[1] before:h-5 before:w-[400px] before:-translate-x-1/2 before:bg-[#1e213b] before:transition-[background-color,filter] before:duration-300 before:[clip-path:polygon(0_100%,4%_0,96%_0,100%_100%)] before:content-[''] after:absolute after:-bottom-5 after:left-1/2 after:-z-[1] after:h-5 after:w-[400px] after:-translate-x-1/2 after:rotate-180 after:bg-[#1e213b] after:transition-[background-color,filter] after:duration-300 after:[clip-path:polygon(0_100%,4%_0,96%_0,100%_100%)] after:content-[''] hover:before:bg-[#d45cff] hover:before:[filter:drop-shadow(0_0_14px_rgba(212,92,255,0.9))] hover:after:bg-[#d45cff] hover:after:[filter:drop-shadow(0_0_14px_rgba(212,92,255,0.9))] max-[991px]:h-[calc(50vw+1px)] max-[425px]:h-[190px] max-[425px]:w-[min(100%,348px)] max-[425px]:before:-top-[10px] max-[425px]:before:h-[10px] max-[425px]:before:w-[180px] max-[425px]:after:-bottom-[10px] max-[425px]:after:h-[10px] max-[425px]:after:w-[180px]">
          <span className="pointer-events-none absolute inset-0 z-[2] before:absolute before:-right-[35px] before:-top-[31px] before:h-[26px] before:w-[35px] before:bg-[url('/images/artistly/video-shape.png')] before:bg-contain before:bg-no-repeat before:content-[''] after:absolute after:-bottom-[31px] after:-left-[35px] after:h-[26px] after:w-[35px] after:rotate-180 after:bg-[url('/images/artistly/video-shape.png')] after:bg-contain after:bg-no-repeat after:content-[''] max-[425px]:hidden" aria-hidden="true" />
          <iframe
            className="block aspect-video w-full border-0"
            src="https://www.loom.com/embed/62e71dd47a7644cea41dbd274be3cef5?sid=7fbf1819-1127-4d0d-88b0-a6891d37768f&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
            title="Artistly overview video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div id="pricing">
          <h2 className="m-0 pt-10 font-[family-name:var(--font-k2d)] text-[46px] font-extrabold leading-[1.2] text-white max-[991px]:px-2.5 max-[991px]:text-[40px] max-[991px]:font-semibold max-[425px]:pt-5 max-[425px]:text-[27px]">
            Get Unlimited Access to Artistly!
          </h2>
          <p className="m-0 bg-[linear-gradient(to_right,#f28e27,#fd644f)] bg-clip-text font-[family-name:var(--font-k2d)] text-[46px] font-extrabold leading-[1.5] text-transparent max-[991px]:text-[40px] max-[425px]:text-[27px]">
            For a One-Time Price
          </p>

          <a
            className="mx-auto my-5 block w-full bg-[url('/images/artistly/button-background.png')] bg-contain bg-center bg-no-repeat px-2.5 py-[17px] font-[family-name:var(--font-k2d)] text-[35px] font-extrabold leading-[1.5] text-white no-underline max-[991px]:py-2.5 max-[991px]:text-[22px] max-[425px]:w-[calc(100%-30px)] max-[425px]:py-3 max-[425px]:text-[19px]"
            href="https://artistly.ai/#table"
          >
            Get Instant Access to Artistly&nbsp; &rarr;
          </a>

          <Image
            className="mx-auto block w-[min(calc(100%-30px),410px)]"
            src="/images/artistly/payments.png"
            alt="PayPal, American Express, Mastercard, Visa, and 30-day money-back guarantee"
            width={410}
            height={50}
          />

          <ul className="m-0 mx-auto flex list-none flex-wrap justify-center gap-x-[15px] gap-y-1 px-0 py-[20px] pb-[30px] text-base font-semibold text-[#b3b6d3] max-[575px]:w-[calc(100%-30px)] max-[575px]:px-2.5 max-[575px]:py-2.5 max-[575px]:pb-2.5" aria-label="Offer benefits">
            <li>✓&nbsp; Unlimited Designs</li>
            <li>✓&nbsp; No Hidden Costs</li>
            <li>✓&nbsp; Everything Included</li>
          </ul>

          <Image
            className="mx-auto block w-[min(calc(100%-30px),458px)]"
            src="/images/artistly/guarantee-apps.png"
            alt="Artistly works with Mac OS, Windows, and ChromeOS"
            width={458}
            height={46}
          />
        </div>

        <div className="mx-auto flex max-w-[1250px] flex-wrap items-center justify-center gap-6 pt-10 max-[575px]:gap-[15px]" aria-label="Independent review platforms">
          {trustBadges.map((badge) => (
            <a
              className={`${badgeBaseClass} ${badge.boxClass ?? ""}`}
              href={badge.href}
              key={badge.alt}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                className="w-[150px] object-contain max-[575px]:w-[120px]"
                src={badge.src}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
                loading="eager"
                sizes="(max-width: 575px) 120px, 150px"
              />
            </a>
          ))}
        </div>

        <dl className="mx-auto mb-5 mt-[30px] grid max-w-[1000px] grid-cols-4 gap-6 max-[991px]:grid-cols-2 max-[575px]:w-[calc(100%+24px)] max-[575px]:-translate-x-3 max-[575px]:px-3" aria-label="Artistly customer ratings">
          {ratings.map((label) => (
            <div className="min-h-[108px] rounded-[10px] bg-[#1e1f39] px-[15px] py-[25px] max-[425px]:min-h-0 max-[425px]:px-2.5 max-[425px]:py-5" key={label}>
              <dt className="mb-2.5 font-[family-name:var(--font-k2d)] text-xl font-medium leading-[1.2] text-white max-[425px]:text-base">
                {label}
              </dt>
              <dd className="m-0 flex items-center justify-center gap-2.5 text-sm font-bold text-white max-[425px]:gap-[5px]">
                <span className="flex items-center gap-[3px] text-[#fd810d] max-[425px]:gap-0.5" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      className="h-[20px] w-[20px] fill-current stroke-current"
                      key={index}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span>4.8</span>
              </dd>
            </div>
          ))}
        </dl>

        <DownArrow />
      </div>
    </section>
  );
}
