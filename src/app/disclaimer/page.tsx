import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/airveek/legal-page";
import { canonicalMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Important limitations and user responsibilities for Airveek AI-generated images and designs.",
  ...canonicalMetadata("/disclaimer"),
};

const sections: LegalSection[] = [
  {
    id: "ai-generated-content",
    title: "AI-generated content",
    paragraphs: [
      <>Airveek is an AI-powered image and design platform. Automated outputs can be inaccurate, incomplete, unexpected, non-exclusive, or unsuitable for a particular use. Similar or identical content may be generated for other users.</>,
      <>Airveek does not guarantee that an output is original, copyrightable, trademark-eligible, non-infringing, accurate, or lawful in every jurisdiction.</>,
    ],
  },
  {
    id: "review-responsibility",
    title: "Your review and responsibility",
    paragraphs: [
      <>You are responsible for reviewing content before you publish, sell, advertise, distribute, or rely on it. Confirm factual claims, inspect visual details, check required disclosures, and obtain any licenses, releases, or permissions needed for your intended use.</>,
      <>You are also responsible for the prompts, reference images, names, logos, people, products, and other materials you upload or ask Airveek to process.</>,
    ],
  },
  {
    id: "no-professional-advice",
    title: "No professional advice",
    paragraphs: [
      <>Airveek outputs are creative materials, not medical, legal, financial, insurance, safety, or other professional advice. Do not use a generated image, character, or statement as a substitute for a qualified professional or as proof of a factual claim.</>,
      <>Generated people do not provide real endorsements or describe real experiences unless you separately obtain valid authorization and clearly communicate the nature of the content.</>,
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual property and likenesses",
    paragraphs: [
      <>Laws governing AI-generated content are evolving and may vary by country. Your ability to own, register, license, or enforce rights in an output depends on applicable law and the material used to create it.</>,
      <>Do not assume that an output is clear for commercial use merely because Airveek generated it. Conduct appropriate searches and professional review before using content as a logo, trademark, product design, public figure likeness, or central commercial asset.</>,
    ],
  },
  {
    id: "third-party-services",
    title: "Third-party services and availability",
    paragraphs: [
      <>Airveek may depend on third-party AI models, APIs, hosting, payment, and delivery services. Changes, outages, restrictions, or errors in those services may affect the availability, speed, quality, or behavior of Airveek.</>,
      <>Links to third-party websites are provided for convenience. Airveek does not control or endorse their content, policies, or practices.</>,
    ],
  },
  {
    id: "copyright-requests",
    title: "Copyright and rights concerns",
    paragraphs: [
      <>Airveek respects intellectual property and other legal rights. If you believe content created or distributed through the Service infringes your rights, send a clear notice to <a className="font-semibold text-primary underline decoration-primary/30 underline-offset-4" href="mailto:support@airveek.com">support@airveek.com</a>.</>,
    ],
    bullets: [
      <>Identify the protected work, person, or right at issue.</>,
      <>Identify the relevant content or account and explain where it appears.</>,
      <>Provide your contact information and a good-faith statement supporting the request.</>,
      <>Include any signature or declaration required by applicable law.</>,
    ],
  },
  {
    id: "no-warranties",
    title: "No warranties and limitation",
    paragraphs: [
      <>Airveek and its outputs are provided “as is” and “as available.” To the maximum extent permitted by law, Airveek disclaims warranties regarding quality, accuracy, availability, fitness for purpose, merchantability, title, and non-infringement.</>,
      <>Airveek is not responsible for losses arising from your use or misuse of an output, a third-party claim, platform enforcement, business decisions, or failure to independently review content. The limitations in the Terms of Service apply to this Disclaimer.</>,
    ],
  },
  {
    id: "acceptance",
    title: "Acceptance and contact",
    paragraphs: [
      <>By using Airveek, you acknowledge the limitations of AI-generated content and accept responsibility for how you use the Service and its outputs.</>,
      <>Questions about this Disclaimer may be sent to <a className="font-semibold text-primary underline decoration-primary/30 underline-offset-4" href="mailto:support@airveek.com">support@airveek.com</a>.</>,
    ],
  },
];

export default function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      description="Understand the limits of AI-generated content and the checks you should complete before using an Airveek output."
      lastUpdated="August 21, 2026"
      summary="Airveek provides creative tools and automated outputs on an “as is” and “as available” basis. You remain responsible for reviewing and lawfully using every output."
      sections={sections}
    />
  );
}
