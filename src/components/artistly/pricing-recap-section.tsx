import Image from "next/image";

type PricingCard = {
  name: "commercial" | "premium";
  features: string[];
  footer: string[];
};

const commercialFeatures = [
  "AI Prompt-to-Image Generator",
  "Magic Merch: Instant E-Commerce Mockups",
  "AI Style Replicator",
  "Instant Scene: AI Background Changer",
  "Canva-Style Image Editor",
  "Kids and Adults Coloring Book Maker",
  "AI Logo Maker",
  "T-Shirt Design Generator",
  "AI Photo-to-Prompt Decoder",
  "Smart AI Prompt Enhancer",
  "Keyword-to-Prompt Builder",
  "AI Image Upscaler",
  "AI Image Redesigner",
  "Smart Image Expander: AI Outpainting",
  "Smart AI Prompt Enhancer",
  "Community & Personal Design Feed",
  "Free Product Updates",
  "HD Image Downloads",
  "No Watermarks",
  "Commercial License",
  "Bonus: Access to the Meta Group",
  "Bonus: Access to the Microsoft Teams Group",
  "Bonus: Access to the WhatsApp Group",
  "30-Day Money-Back Guarantee",
];

const premiumFeatures = [
  "Everything in the Commercial Plan",
  "Plus, Premium Features Including:",
  "Premium: Consistent Character",
  "Premium: Your Face in AI Images",
  "Premium: AI Product Mockup Creator",
  "Premium: AI Style Replicator",
  "Premium: AI Stylizer",
  "Premium: AI Book Covers",
  "Premium: Perfect Text in AI Images",
  "Premium: AI Human Inpainting",
  "Premium: Pet Portraits Creator",
  "Premium: T-Shirt Design Creator",
  "Premium: AI Video Thumbnail Maker",
  "Premium: AI Character Creator",
  "Premium: Bulk Clipart Designer",
  "Premium: Photo to Coloring Pages Creator",
  "Premium: Amazon KDP Paperback Book Creator",
  "Premium: Seamless Pattern Generator",
  "Premium: Talking Storybook Maker",
  "Premium: Script-to-Storybook Maker",
  "Premium: Multilingual Storybook Maker",
  "Premium: Personalized Storybook Maker",
  "Premium: AI Product Influencer",
  "Premium: Custom Character Scene Creator",
  "Premium: AI Fashion Designer",
  "Premium: AI Style Illustrator",
  "Premium: Faster Image Generation",
  "Premium: 4 Images Per Prompt",
  "Unlimited Usage",
  "Access to All Features",
  "No Monthly Fees",
  "Free Product Updates",
  "No Hidden Costs",
  "Enterprise Commercial License",
  "30-Day Money-Back Guarantee",
];

const pricingCards: PricingCard[] = [
  {
    name: "commercial",
    features: commercialFeatures,
    footer: ["Unlimited Designs", "HD Images", "No Monthly Fees"],
  },
  {
    name: "premium",
    features: premiumFeatures,
    footer: [
      'Use Coupon &quot;SECRET10&quot; for 10% OFF!',
      "No Upsells | No Hidden Fees | No Monthly Charges",
      "Unlock All Features for a One-Time Price",
    ],
  },
];

function RecapHeading() {
  return (
    <div className="relative mx-auto max-w-[850px] bg-[#1d2146] px-5 py-2.5 text-center max-[575px]:mx-[-12px] max-[575px]:max-w-none min-[576px]:max-[1199px]:max-w-[650px]">
      <h2 className="m-0 font-display text-[54px] font-extrabold leading-[64.8px] text-white min-[576px]:max-[1199px]:text-[40px] min-[576px]:max-[1199px]:leading-[48px] max-[575px]:text-[25px] max-[575px]:leading-[30px]">Here&apos;s a Recap of<br className="hidden max-[575px]:block min-[576px]:hidden" /> Everything</h2>
      <p className="m-0 bg-[linear-gradient(to_right,_#f28e27_30%,_#fd644f_50%)] bg-clip-text font-display text-[54px] font-extrabold leading-[81px] text-transparent min-[576px]:max-[1199px]:text-[40px] min-[576px]:max-[1199px]:leading-[60px] max-[575px]:text-[25px] max-[575px]:leading-[37.5px]">You Get Access to Today</p>
      <Image className="absolute left-0 top-1/2 h-32 w-2 -translate-y-1/2" src="/images/artistly/pricing-orange-line.png" alt="" width={8} height={128} aria-hidden="true" />
      <Image className="absolute right-0 top-1/2 h-32 w-2 -translate-y-1/2" src="/images/artistly/pricing-orange-line.png" alt="" width={8} height={128} aria-hidden="true" />
    </div>
  );
}

function FeatureRow({ feature, premium, index }: { feature: string; premium: boolean; index: number }) {
  const useCrown = premium && index >= 2 && index <= 29;

  return (
    <li className="m-0 mb-2.5 font-sans text-[13px] font-normal leading-[19.5px] text-white last:mb-0 min-[576px]:max-[1199px]:text-[17px] min-[576px]:max-[1199px]:leading-[25.5px] min-[1200px]:mb-7 min-[1200px]:text-[26px] min-[1200px]:leading-[39px]">
      <Image className="mr-2.5 inline-block h-auto w-4 align-middle min-[576px]:max-[1199px]:mr-[15px] min-[576px]:max-[1199px]:w-[25px] min-[1200px]:mr-5 min-[1200px]:w-[33px]" src={useCrown ? "/images/artistly/pricing-crown.svg" : "/images/artistly/pricing-tag-icon.png"} alt="" width={useCrown ? 150 : 33} height={useCrown ? 150 : 31} aria-hidden="true" />
      {feature}
    </li>
  );
}

function PaymentTitle({ name }: { name: PricingCard["name"] }) {
  if (name === "commercial") {
    return (
      <>
        Get an Unlimited Personal License
        <br />
        to Artistly for a One-Time Payment of $49!
      </>
    );
  }

  return (
    <>
      Get Artistly Unlimited for a
      <br />
      One-Time Payment of $147!
    </>
  );
}

function PricingCardView({ card }: { card: PricingCard }) {
  const isPremium = card.name === "premium";
  const headingWidth = isPremium
    ? "max-[575px]:w-[98px] min-[576px]:max-[1199px]:w-[91px] min-[1200px]:w-[131.219px]"
    : "max-[575px]:w-[126px] min-[576px]:max-[1199px]:w-[122.719px] min-[1200px]:w-[177.125px]";
  const footerItemClass = "inline-block mr-[5px] min-[576px]:max-[1199px]:mr-[15px] min-[1200px]:mr-[15px]";
  const cardClass = [
    "relative box-border min-w-0 rounded-[10px] border-2 border-dotted border-[#b51afc] bg-[#181b3a] p-[30px_15px] text-white before:hidden",
    "min-[576px]:max-[1199px]:border-x-2 min-[576px]:max-[1199px]:border-b-2 min-[576px]:max-[1199px]:border-t-0 min-[576px]:max-[1199px]:rounded-[0_0_20px_20px] min-[576px]:max-[1199px]:p-[0_0_30px]",
    "min-[576px]:max-[1199px]:before:absolute min-[576px]:max-[1199px]:before:left-[-1px] min-[576px]:max-[1199px]:before:top-[-133px] min-[576px]:max-[1199px]:before:block min-[576px]:max-[1199px]:before:h-[159px] min-[576px]:max-[1199px]:before:w-[calc(100%+2px)] min-[576px]:max-[1199px]:before:bg-[url('/images/artistly/pricing-table-blue.png')] min-[576px]:max-[1199px]:before:bg-contain min-[576px]:max-[1199px]:before:bg-center min-[576px]:max-[1199px]:before:bg-no-repeat min-[576px]:max-[1199px]:before:content-['']",
    "min-[1200px]:border-x-[3px] min-[1200px]:border-b-[3px] min-[1200px]:border-t-0 min-[1200px]:rounded-[0_0_20px_20px] min-[1200px]:p-[0_0_30px]",
    "min-[1200px]:before:absolute min-[1200px]:before:left-0 min-[1200px]:before:top-[-155px] min-[1200px]:before:block min-[1200px]:before:h-[159px] min-[1200px]:before:w-full min-[1200px]:before:bg-[url('/images/artistly/pricing-table-blue.png')] min-[1200px]:before:bg-contain min-[1200px]:before:bg-center min-[1200px]:before:bg-no-repeat min-[1200px]:before:content-['']",
  ];

  if (isPremium) {
    cardClass.push("min-[576px]:max-[1199px]:mt-[120px]");
  }

  const headingClass = [
    "absolute right-0 top-0 z-[1] m-0 rounded-[0_10px_0_0] bg-[#7316f4] p-[1px_10px_5px] font-display text-[20px] font-medium leading-6 lowercase text-white",
    headingWidth,
    "min-[576px]:max-[1199px]:left-[56%] min-[576px]:max-[1199px]:right-auto min-[576px]:max-[1199px]:top-[-80px] min-[576px]:max-[1199px]:rounded-none min-[576px]:max-[1199px]:bg-transparent min-[576px]:max-[1199px]:p-0 min-[576px]:max-[1199px]:text-[23px] min-[576px]:max-[1199px]:font-semibold min-[576px]:max-[1199px]:leading-[27.6px]",
    "min-[1200px]:left-[57%] min-[1200px]:max-w-none min-[1200px]:right-auto min-[1200px]:top-[-114px] min-[1200px]:rounded-none min-[1200px]:bg-transparent min-[1200px]:p-0 min-[1200px]:text-[33px] min-[1200px]:font-bold min-[1200px]:leading-[39.6px]",
  ].join(" ");

  const footerClass = [
    "m-0 px-0 py-[15px] text-center font-sans text-[16px] font-normal leading-6 text-[#9aa0b5] max-[575px]:min-h-[81.25px] min-[576px]:max-[1199px]:py-[20px] min-[576px]:max-[1199px]:pb-[30px] min-[1200px]:box-border min-[1200px]:py-[20px] min-[1200px]:pb-[30px]",
    !isPremium ? "min-[576px]:max-[1199px]:h-[75.625px] min-[1200px]:h-[75.625px]" : "",
  ].join(" ");

  return (
    <article className={cardClass.join(" ")}>
      <h3 className={headingClass}>{card.name}</h3>
      <div className="pb-[30px] min-[576px]:max-[1199px]:absolute min-[576px]:max-[1199px]:left-5 min-[576px]:max-[1199px]:top-[-85px] min-[576px]:max-[1199px]:w-[400px] min-[576px]:max-[1199px]:p-0 min-[1200px]:absolute min-[1200px]:left-[43px] min-[1200px]:top-[-100px] min-[1200px]:w-[600px] min-[1200px]:p-0">
        <Image className="block h-auto w-[130px] min-[576px]:max-[1199px]:w-[180px] min-[1200px]:w-[247px]" src="/images/artistly/pricing-tag-logo.png" alt="" width={247} height={59} priority aria-hidden="true" />
      </div>
      <div className="min-[576px]:max-[1199px]:pl-5 min-[1200px]:mx-[14.75px]">
        <ul className="m-0 list-none p-0">
          {card.features.map((feature, index) => <FeatureRow feature={feature} premium={isPremium} index={index} key={card.name + "-" + index + "-" + feature} />)}
        </ul>
      </div>
      <div className="text-center">
        <h4 className="m-0 p-[20px_10px_10px] font-display text-[15px] font-semibold leading-[18px] text-white min-[576px]:max-[1199px]:p-[40px_10px_20px] min-[576px]:max-[1199px]:text-[20px] min-[576px]:max-[1199px]:leading-6 min-[1200px]:p-[40px_0_20px] min-[1200px]:max-w-none min-[1200px]:text-[30px] min-[1200px]:font-extrabold min-[1200px]:leading-9">
          <PaymentTitle name={card.name} />
        </h4>
        <a className="my-2.5 block bg-[url('/images/artistly/pricing-btn-bg.png')] bg-contain bg-center bg-no-repeat p-2.5 text-center font-display text-[18px] font-extrabold leading-[27px] text-white no-underline min-[576px]:max-[1199px]:mb-[30px] min-[576px]:max-[1199px]:mt-2.5 min-[576px]:max-[1199px]:p-[10px_0] min-[576px]:max-[1199px]:text-[22px] min-[576px]:max-[1199px]:leading-[33px] min-[1200px]:mb-[30px] min-[1200px]:mt-2.5 min-[1200px]:p-[17px_0] min-[1200px]:text-[35px] min-[1200px]:leading-[52.5px]" href="#table">
          Get Instant Access to Artistly
        </a>
        <a className="m-0 block leading-6 text-[#0d6efd]" href="#table" aria-label="View payment options">
          <Image className="inline h-auto w-[410px] max-w-full align-middle max-[575px]:w-[300px]" src="/images/artistly/pricing-payments.png" alt="PayPal, American Express, Mastercard, Visa, and 30-day money-back guarantee" width={410} height={50} />
        </a>
        <ul className={footerClass}>
          {isPremium ? (
            <>
              <li className={footerItemClass}><b>Use Coupon &quot;SECRET10&quot; for 10% OFF!</b><br /><br />No Upsells | No Hidden Fees | No Monthly Charges<br /> Unlock All Features for a One-Time Price</li><br />
            </>
          ) : (
            card.footer.map((item) => <li className={footerItemClass} key={item}>{item}</li>)
          )}
        </ul>
        <Image className="inline h-auto w-[458px] max-w-full" src="/images/artistly/pricing-apps.png" alt="Artistly works with Mac OS, Windows, and ChromeOS" width={458} height={46} />
      </div>
    </article>
  );
}

export function PricingRecapSection() {
  return (
    <section id="pricing-recap" className="bg-[#020825] px-3 pb-[150px] pt-10 text-white max-[575px]:pb-20 max-[575px]:pt-5" aria-labelledby="pricing-recap-title">
      <h2 id="pricing-recap-title" className="sr-only">Artistly pricing recap</h2>
      <RecapHeading />
      <div className="mx-auto mt-[15px] grid max-w-[1418px] grid-cols-2 items-start gap-6 px-[3px] pt-6 min-[576px]:max-[1199px]:mt-[146px] min-[576px]:max-[1199px]:max-w-[510px] min-[576px]:max-[1199px]:grid-cols-1 min-[576px]:max-[1199px]:px-0 max-[575px]:mt-4 max-[575px]:max-w-[345px] max-[575px]:grid-cols-1 max-[575px]:px-0 min-[1200px]:mt-[226px]">
        {pricingCards.map((card) => <PricingCardView card={card} key={card.name} />)}
      </div>
    </section>
  );
}
