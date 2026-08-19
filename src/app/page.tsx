import { HeroSection } from "@/components/artistly/hero-section";
import { PromoBar } from "@/components/artistly/promo-bar";
import { SiteHeader } from "@/components/artistly/site-header";

import { PricingRecapSection } from "@/components/artistly/pricing-recap-section";

export default function Home() {
  return (
    <div id="top" className="min-h-screen bg-[#020825]">
      <PromoBar />
      <div className="min-h-[calc(100vh-74px)] overflow-hidden bg-[#020825] bg-[url('/images/artistly/hero-background.jpg')] bg-cover bg-center bg-no-repeat max-[575px]:min-h-[calc(100vh-64px)]">
        <SiteHeader />
        <main>
          <HeroSection />
          
          <PricingRecapSection />
        </main>
      </div>
    </div>
  );
}
