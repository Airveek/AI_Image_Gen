import { PromoBar } from "@/components/airveek/promo-bar";
import { SiteHeader } from "@/components/airveek/site-header";
import {
  AudienceSection,
  BusinessSection,
  FeatureSuiteSection,
  Footer,
  GallerySection,
  GuaranteeSection,
  HeroSection,
  PricingSection,
  RecapSection,
  StepsSection,
  TextProofSection,
  TrustStrip,
  UseCasesSection,
} from "@/components/airveek/landing-sections";
import { FaqSection } from "@/components/airveek/faq-section";

export default function Home() {
  return (
    <div id="top" className="min-h-screen overflow-hidden bg-[#040404]">
      <PromoBar />
      <SiteHeader />
      <main className="brand-glow">
        <HeroSection />
        <TrustStrip />
        <GallerySection />
        <StepsSection />
        <FeatureSuiteSection />
        <TextProofSection />
        <AudienceSection />
        <BusinessSection />
        <UseCasesSection />
        <PricingSection />
        <GuaranteeSection />
        <RecapSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
