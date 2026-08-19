import Image, { type StaticImageData } from "next/image";

type TrustBadge = {
  src: string | StaticImageData;
  alt: string;
  width: number;
  height: number;
};

const trustBadges: TrustBadge[] = [
  {
    src: "/images/artistly/badge-capterra-review.svg",
    alt: "Reviewed on Capterra",
    width: 180,
    height: 55,
  },
  {
    src: "/images/artistly/badge-getapp-review.png",
    alt: "Reviewed on GetApp",
    width: 180,
    height: 55,
  },
  {
    src: "/images/artistly/badge-capterra-rating.png",
    alt: "Artistly Capterra rating",
    width: 180,
    height: 55,
  },
  {
    src: "/images/artistly/badge-software-advice-review.png",
    alt: "Reviewed on Software Advice",
    width: 180,
    height: 55,
  },
  {
    src: "/images/artistly/badge-software-advice-rating.png",
    alt: "Artistly Software Advice rating",
    width: 180,
    height: 55,
  },
  {
    src: "/images/artistly/badge-getapp-rating.png",
    alt: "Artistly GetApp rating",
    width: 180,
    height: 55,
  },
];

const ratings = [
  ["Easy to Use", "4.8"],
  ["Customer Support", "4.8"],
  ["Value for Money", "4.8"],
  ["Functionality", "4.8"],
] as const;

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="artistly-rating-star"
      focusable="false"
    >
      <path d="m12 2.7 2.75 5.58 6.16.9-4.46 4.34 1.05 6.13L12 16.76l-5.5 2.89 1.05-6.13-4.46-4.34 6.16-.9L12 2.7Z" />
    </svg>
  );
}

function DownArrow() {
  return (
    <div className="artistly-down-arrow" aria-hidden="true">
      <svg viewBox="0 0 26 26" focusable="false">
        <path d="M13 3v17M6.5 14.5 13 21l6.5-6.5" />
      </svg>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="artistly-hero" aria-labelledby="hero-title">
      <div className="artistly-container">
        <p className="artistly-eyebrow">AI Designs With Perfect Text</p>

        <h1 id="hero-title" className="artistly-title">
          Produce Stunning Images, Logos &amp; Art
          <br className="hidden sm:block" /> With Just a Keyword Using AI
        </h1>

        <p className="artistly-subtitle">
          <span>For Your Brand, Social Media, or Commercial</span>
          <span className="artistly-subtitle-final">Projects!</span>
          <i className="artistly-corner artistly-corner-tl" aria-hidden="true" />
          <i className="artistly-corner artistly-corner-tr" aria-hidden="true" />
          <i className="artistly-corner artistly-corner-bl" aria-hidden="true" />
          <i className="artistly-corner artistly-corner-br" aria-hidden="true" />
        </p>

        <div className="artistly-video-frame">
          <span className="artistly-video-accent" aria-hidden="true" />
          <iframe
            src="https://www.loom.com/embed/62e71dd47a7644cea41dbd274be3cef5?sid=7fbf1819-1127-4d0d-88b0-a6891d37768f&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
            title="Artistly overview video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div className="artistly-offer" id="pricing">
          <h2>Get Unlimited Access to Artistly!</h2>
          <p>For a One-Time Price</p>

          <a className="artistly-cta" href="https://artistly.ai/#table">
            Get Instant Access to Artistly
          </a>

          <Image
            className="artistly-payments"
            src="/images/artistly/payments.png"
            alt="Secure payment methods"
            width={410}
            height={50}
          />

          <ul className="artistly-benefits" aria-label="Offer benefits">
            <li>Unlimited Designs</li>{" "}
            <li>No Hidden Costs</li>{" "}
            <li>Everything Included</li>
          </ul>

          <Image
            className="artistly-guarantee-apps"
            src="/images/artistly/guarantee-apps.png"
            alt="30-day money-back guarantee and app access"
            width={458}
            height={46}
          />
        </div>

        <div className="artistly-trust-badges" aria-label="Independent review platforms">
          {trustBadges.map((badge) => (
            <div className="artistly-trust-badge" key={badge.alt}>
              <Image
                src={badge.src}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
              />
            </div>
          ))}
        </div>

        <dl className="artistly-ratings" aria-label="Artistly customer ratings">
          {ratings.map(([label, score]) => (
            <div className="artistly-rating-card" key={label}>
              <dt>{label}</dt>
              <dd>
                <span className="artistly-rating-stars" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <StarIcon key={index} />
                  ))}
                </span>
                <span>{score}</span>
              </dd>
            </div>
          ))}
        </dl>

        <DownArrow />
      </div>
    </section>
  );
}
