import { JsonLd } from "@/components/seo/json-ld";
import { absoluteUrl } from "@/lib/seo/site";
import type { BillingMode } from "@/lib/billing/types";

export function HomeSchema({ billingMode }: { billingMode: BillingMode }) {
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
            offer("Commercial", "49", billingMode),
            offer("Premium", "147", billingMode),
          ],
        },
      ]}
    />
  );
}

function offer(name: string, price: string, mode: BillingMode) {
  return { "@type": "Offer", name: `${name} ${mode === "subscription" ? "monthly" : "one-time"}`, price, priceCurrency: "USD", url: absoluteUrl("/#pricing"),
    priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: "USD", ...(mode === "subscription" ? { billingDuration: "P1M" } : {}) } };
}
