import { PromoBar } from "@/components/artistly/promo-bar";
import { SiteHeader } from "@/components/artistly/site-header";
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
} from "@/components/artistly/landing-sections";
import { FaqSection } from "@/components/artistly/faq-section";

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
