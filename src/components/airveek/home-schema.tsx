import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/lib/seo/site";

export function HomeSchema() {
  const organizationId = `${absoluteUrl("/")}#organization`;
  const websiteId = `${absoluteUrl("/")}#website`;

  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": organizationId,
          name: "Airveek",
          url: absoluteUrl("/"),
          logo: absoluteUrl("/images/airveek/mark-square.png"),
          email: "support@airveek.com",
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": websiteId,
          name: "Airveek",
          url: absoluteUrl("/"),
          publisher: { "@id": organizationId },
        },
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${absoluteUrl("/")}#webpage`,
          url: absoluteUrl("/"),
          name: "Airveek: All-in-One AI Image Generator",
          isPartOf: { "@id": websiteId },
          about: { "@id": organizationId },
        },
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Airveek",
          applicationCategory: "DesignApplication",
          operatingSystem: "Web",
          url: absoluteUrl("/"),
          description: "Create images, logos, and commercial artwork from a keyword with Airveek.",
          offers: [
            { "@type": "Offer", name: "Commercial monthly", price: "49", priceCurrency: "USD", url: absoluteUrl("/#pricing"), priceSpecification: { "@type": "UnitPriceSpecification", price: "49", priceCurrency: "USD", billingDuration: "P1M" } },
            { "@type": "Offer", name: "Premium monthly", price: "147", priceCurrency: "USD", url: absoluteUrl("/#pricing"), priceSpecification: { "@type": "UnitPriceSpecification", price: "147", priceCurrency: "USD", billingDuration: "P1M" } },
          ],
        },
      ]}
    />
  );
}
