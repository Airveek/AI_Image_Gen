import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/airveek/legal-page";
import { canonicalMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern access to and use of the Airveek AI image creation platform.",
  ...canonicalMetadata("/terms"),
};

const sections: LegalSection[] = [
  {
    id: "eligibility",
    title: "Eligibility and authority",
    paragraphs: [
      <>You must be at least 18 years old and legally able to enter into a binding agreement to use Airveek. If you use Airveek for a company or another organization, you confirm that you have authority to accept these Terms on its behalf.</>,
    ],
  },
  {
    id: "accounts",
    title: "Accounts and security",
    paragraphs: [
      <>You are responsible for providing accurate account information, protecting your login credentials, and all activity performed through your account. Tell us promptly if you believe your account has been accessed without permission.</>,
      <>To create an account, you must actively accept these Terms and acknowledge the Privacy Policy. We record the document versions and acceptance time so that the agreement can be verified.</>,
      <>Unless your plan expressly allows team access, an account is personal to the original purchaser and may not be shared, sold, sublicensed, or transferred.</>,
    ],
  },
  {
    id: "service-license",
    title: "Access to the Service",
    paragraphs: [
      <>Subject to these Terms and the plan you purchase, Airveek gives you a limited, non-exclusive, non-transferable, and revocable right to access and use the website, applications, image tools, and related services we make available (the “Service”).</>,
      <>The Service is licensed, not sold. Airveek retains all rights in its software, interfaces, workflows, brand assets, and underlying technology that are not expressly granted to you.</>,
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [<>You may use Airveek only for lawful purposes and in a way that respects other people, their rights, and the security of the Service.</>],
    bullets: [
      <>Do not create, upload, or distribute content that violates law or another person&apos;s copyright, trademark, privacy, publicity, or contractual rights.</>,
      <>Do not create deceptive, fraudulent, abusive, exploitative, or harmful content, or impersonate a person or organization without authorization.</>,
      <>Do not bypass safeguards, usage controls, access restrictions, or security measures.</>,
      <>Do not scrape, reverse engineer, resell, interfere with, overload, or disrupt the Service or its infrastructure.</>,
      <>Do not use Airveek to develop or train a competing model or service unless we give you written permission.</>,
    ],
  },
  {
    id: "ai-content",
    title: "AI-generated content",
    paragraphs: [
      <>Airveek uses automated systems to produce images and design outputs from prompts and other inputs. Outputs may contain errors, may not be unique, and may resemble content generated for other users.</>,
      <>You must review every output before relying on, publishing, selling, or distributing it. Airveek does not guarantee that an output is copyrightable, eligible for trademark protection, accurate, exclusive, or free from third-party rights.</>,
    ],
    bullets: [
      <>Do not present a generated person as a real individual or attribute opinions, endorsements, experiences, or professional advice to that person.</>,
      <>Obtain any permissions required for reference images, names, logos, products, people, or other material included in your inputs or outputs.</>,
      <>Apply additional review before using outputs in regulated, political, medical, legal, financial, insurance, or age-restricted contexts.</>,
    ],
  },
  {
    id: "user-content",
    title: "Your inputs and outputs",
    paragraphs: [
      <>You retain any rights you already hold in prompts, uploads, reference materials, and other content you submit. You grant Airveek and its service providers the limited rights needed to host, process, transmit, and transform that content to operate, secure, support, and improve the Service.</>,
      <>As between you and Airveek, and to the extent permitted by applicable law, Airveek does not claim ownership of your generated outputs. Your rights in an output may depend on the law where you live and on the rights contained in your inputs.</>,
    ],
  },
  {
    id: "moderation",
    title: "Content review and enforcement",
    paragraphs: [
      <>Airveek does not promise to pre-screen all content. We may investigate complaints and may restrict, remove, or preserve content or account information when reasonably necessary to enforce these Terms, protect users or third parties, secure the Service, or comply with law.</>,
      <>We may suspend or terminate access for material or repeated violations, fraud, abuse, security risk, non-payment, or conduct that creates legal or operational risk.</>,
    ],
  },
  {
    id: "fair-use",
    title: "Fair use and resource limits",
    paragraphs: [
      <>Plans described as unlimited remain subject to reasonable fair-use controls. We may apply generation, storage, file-size, concurrency, queue, or compute limits to protect platform stability, prevent automated abuse, and keep the Service sustainable for all customers.</>,
      <>Limits may vary by feature, model availability, system capacity, and plan. We will aim to make material limits clear in the product or purchase flow.</>,
    ],
  },
  {
    id: "payments",
    title: "Payments, taxes, and refunds",
    paragraphs: [
      <>Prices, included features, billing terms, and any guarantee are shown at checkout. You authorize our payment provider to charge the selected payment method and are responsible for applicable taxes, duties, or bank fees.</>,
      <>Monthly subscriptions automatically renew and the payment provider may charge the selected payment method each billing period until the subscription is cancelled. You can manage cancellation through the billing portal linked from your Airveek account; when cancellation takes effect, including any remaining access through the current billing period, follows the terms shown at checkout and by the payment provider.</>,
      <>Except where a stated money-back guarantee applies or law requires otherwise, payments are final. Request an eligible refund through support within the period shown at purchase.</>,
    ],
  },
  {
    id: "lifetime-license",
    title: "Legacy lifetime and one-time-payment licenses",
    paragraphs: [
      <>This section applies only to customers who purchased a plan that was explicitly sold as lifetime or one-time access. Current monthly subscriptions follow the recurring billing terms shown at checkout.</>,
      <>When a plan is marketed as “lifetime,” “lifetime access,” or a “one-time payment,” lifetime refers to the commercial lifespan of the applicable Airveek product—not the lifetime of an individual, a perpetual company existence, or guaranteed compatibility with future devices, models, browsers, or third-party services.</>,
      <>A lifetime plan includes the features identified at purchase. New products, premium models, optional capacity, add-ons, or future services may be offered separately. Lifetime access remains subject to these Terms, fair-use limits, and continued operation of the product.</>,
    ],
    subsections: [
      {
        title: "Product evolution and end of life",
        paragraphs: [<>Airveek may change, replace, or discontinue features as technology and third-party services evolve. If the product reaches end of life, we will provide reasonable notice where commercially practicable. Access ends when the product is discontinued.</>],
      },
      {
        title: "No resale or transfer",
        paragraphs: [<>Lifetime access belongs to the original purchaser and may not be resold, leased, shared, or transferred unless Airveek approves the transfer in writing.</>],
      },
    ],
  },
  {
    id: "third-parties",
    title: "Third-party services",
    paragraphs: [
      <>Airveek may rely on payment processors, hosting providers, analytics tools, AI models, APIs, and other third-party services. Their availability, pricing, and functionality are outside our complete control and may affect the Service.</>,
      <>Third-party websites and services are governed by their own terms and policies. Airveek is not responsible for third-party content, conduct, interruptions, or changes.</>,
    ],
  },
  {
    id: "intellectual-property",
    title: "Airveek intellectual property",
    paragraphs: [
      <>Airveek and its licensors own the Service and its software, design, documentation, brand names, logos, interfaces, and other proprietary materials. You may not copy, modify, distribute, create derivative works from, or exploit those materials except as these Terms expressly allow.</>,
      <>If you send feedback or suggestions, you permit Airveek to use them without restriction or compensation, while we remain responsible for deciding whether to use them.</>,
    ],
  },
  {
    id: "availability",
    title: "Availability and changes",
    paragraphs: [
      <>We work to keep Airveek available, but do not guarantee uninterrupted or error-free operation. Maintenance, security incidents, internet conditions, provider outages, and changes in law or technology may affect access.</>,
      <>We may update the Service and these Terms. If a change materially affects your rights, we will provide notice through the Service, email, or another reasonable method. Continued use after the effective date means you accept the updated Terms.</>,
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    paragraphs: [
      <>To the maximum extent permitted by law, the Service and all outputs are provided “as is” and “as available.” Airveek disclaims implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, accuracy, and availability.</>,
      <>Nothing in these Terms excludes a warranty or consumer right that cannot lawfully be excluded.</>,
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    paragraphs: [
      <>To the maximum extent permitted by law, Airveek and its officers, employees, contractors, affiliates, and licensors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, data, business, goodwill, or opportunities.</>,
      <>Airveek&apos;s total liability relating to the Service will not exceed the amount you paid Airveek for the Service during the twelve months before the event giving rise to the claim. These limits do not apply where law prohibits them.</>,
    ],
  },
  {
    id: "indemnity",
    title: "Indemnification",
    paragraphs: [
      <>You agree to defend, indemnify, and hold Airveek and its affiliates, personnel, and service providers harmless from third-party claims, losses, liabilities, and reasonable costs arising from your content, your use of the Service, your violation of these Terms, or your infringement of another person&apos;s rights.</>,
    ],
  },
  {
    id: "governing-law",
    title: "Governing law and general terms",
    paragraphs: [
      <>These Terms are governed by the laws of Canada and the applicable laws of the Province of Ontario, without regard to conflict-of-law principles. Courts located in Ontario will have exclusive jurisdiction unless applicable consumer law requires otherwise.</>,
      <>If any provision is unenforceable, the remaining provisions continue in effect. A delay in enforcement is not a waiver. You may not assign these Terms without our written consent; Airveek may assign them as part of a merger, reorganization, financing, or sale of assets.</>,
      <>These Terms, together with the Privacy Policy, Disclaimer, and purchase terms presented at checkout, form the complete agreement regarding the Service.</>,
    ],
  },
  {
    id: "contact",
    title: "Contact",
    paragraphs: [
      <>Questions about these Terms may be sent to <a className="font-semibold text-primary underline decoration-primary/30 underline-offset-4" href="mailto:support@airveek.com">support@airveek.com</a> or mailed to Airveek, 980 Fraser Drive, Suite 209, Burlington, Ontario L7L 5P5, Canada.</>,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These Terms explain the rules for accessing Airveek, creating with our AI tools, and using the resulting work."
      lastUpdated="September 6, 2026"
      summary="By accessing or using Airveek, you confirm that you have read, understood, and agreed to these Terms. If you do not agree, do not use the Service."
      sections={sections}
    />
  );
}
