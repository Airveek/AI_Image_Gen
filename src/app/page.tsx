import { HeroSection } from "@/components/artistly/hero-section";
import { PromoBar } from "@/components/artistly/promo-bar";
import { SiteHeader } from "@/components/artistly/site-header";
import Image from "next/image";

export default function Home() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <PromoBar />
      <div className="artistly-hero-shell">
        <div className="artistly-hero-backdrop" aria-hidden="true">
          <Image
            src="/images/artistly/hero-premium-generated.png"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="artistly-hero-ambient" aria-hidden="true" />
        <SiteHeader />
        <main>
          <HeroSection />
        </main>
      </div>
    </div>
  );
}
