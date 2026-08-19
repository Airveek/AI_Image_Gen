import { HeroSection } from "@/components/artistly/hero-section";
import { PromoBar } from "@/components/artistly/promo-bar";
import { SiteHeader } from "@/components/artistly/site-header";

export default function Home() {
  return (
    <div id="top" className="min-h-screen bg-background">
      <PromoBar />
      <div className="artistly-hero-shell">
        <SiteHeader />
        <main>
          <HeroSection />
        </main>
      </div>
    </div>
  );
}
