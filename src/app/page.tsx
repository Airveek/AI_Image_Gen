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
import { getActiveBillingConfiguration } from "@/features/billing/server/settings";

export default async function Home() {
  const { mode } = await getActiveBillingConfiguration();
  return (
    <div id="top" className="min-h-screen overflow-hidden bg-background text-foreground">
      <HomeSchema billingMode={mode} />
      <div className="home-hero-gradient text-white">
        <SiteHeader variant="home" />
        <HomeHero />
      </div>
      <main>
        <HomeTrustRow billingMode={mode} />
        <HomeFeatures />
        <HomeHowItWorks />
        <HomeCreativeSuite />
        <HomePricingAndGuarantee billingMode={mode} />
        <FaqSection />
        <HomeFinalCta billingMode={mode} />
      </main>
      <Footer />
    </div>
  );
}
