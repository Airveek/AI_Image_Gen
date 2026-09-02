import { SiteHeader } from "@/components/airveek/site-header";
import {
  Footer,
  HomeCreativeSuite,
  HomeFeatures,
  HomeFinalCta,
  HomeHero,
  HomeHowItWorks,
  HomePricingAndGuarantee,
  HomeTrustRow,
} from "@/components/airveek/home-sections";
import { FaqSection } from "@/components/airveek/faq-section";
import { HomeSchema } from "@/components/airveek/home-schema";

export default function Home() {
  return (
    <div id="top" className="min-h-screen overflow-hidden bg-background text-foreground">
      <HomeSchema />
      <div className="home-hero-gradient text-white">
        <SiteHeader variant="home" />
        <HomeHero />
      </div>
      <main>
        <HomeTrustRow />
        <HomeFeatures />
        <HomeHowItWorks />
        <HomeCreativeSuite />
        <HomePricingAndGuarantee />
        <FaqSection />
        <HomeFinalCta />
      </main>
      <Footer />
    </div>
  );
}
