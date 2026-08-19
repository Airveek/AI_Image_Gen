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
    <div id="top" className="min-h-screen overflow-hidden bg-[#050a29]">
      <PromoBar />
      <SiteHeader />
      <main className="bg-[url('/images/artistly/hero-background.jpg')] bg-[length:100%_auto] bg-top bg-no-repeat">
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
