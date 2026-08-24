import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/airveek/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Airveek collects, uses, shares, and protects personal information.",
};

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "Scope of this Policy",
    paragraphs: [
      <>This Privacy Policy applies when you visit Airveek websites, create or use an account, purchase access, use our image and design tools, contact support, or receive communications from us.</>,
      <>It does not govern third-party websites, payment providers, AI providers, or other services that have their own privacy policies.</>,
    ],
  },
  {
    id: "information-you-provide",
    title: "Information you provide",
    paragraphs: [<>We collect information you choose to provide when you create an account, purchase a plan, use the Service, or contact us.</>],
    bullets: [
      <>Account details, such as your name, email address, login information, and profile preferences.</>,
      <>Purchase and transaction details, such as the product selected, billing metadata, receipts, and payment status. Payment providers process full card or account details under their own policies.</>,
      <>Support requests, feedback, survey responses, and other communications you send to Airveek.</>,
      <>Prompts, uploaded images, reference materials, instructions, generated outputs, and related project information submitted when using creative tools.</>,
    ],
  },
  {
    id: "automatic-information",
    title: "Information collected automatically",
    paragraphs: [<>When you access the Service, we and our providers may automatically receive technical and usage information needed to operate, secure, and improve Airveek.</>],
    bullets: [
      <>IP address, browser type, operating system, device identifiers, language, and approximate location derived from IP.</>,
      <>Pages viewed, referring pages, feature interactions, timestamps, session events, performance data, and error logs.</>,
      <>Security and fraud-prevention signals, including unusual access patterns and failed login activity.</>,
    ],
  },
  {
    id: "cookies",
    title: "Cookies and similar technologies",
    paragraphs: [
      <>Airveek may use cookies, local storage, pixels, and similar technologies for authentication, security, preferences, checkout, analytics, and performance measurement.</>,
      <>You can control cookies through your browser. Blocking essential cookies may prevent account, checkout, or other Service features from working correctly.</>,
    ],
  },
  {
    id: "how-we-use-data",
    title: "How we use information",
    bullets: [
      <>Provide, personalize, maintain, and improve the Service.</>,
      <>Create and secure accounts, authenticate users, and deliver purchased access.</>,
      <>Process prompts and uploaded materials to generate, edit, expand, or otherwise produce requested outputs.</>,
      <>Process transactions, maintain business records, and administer guarantees or refunds.</>,
      <>Respond to support inquiries and send operational, security, and product communications.</>,
      <>Monitor performance, diagnose errors, prevent abuse, and protect Airveek, our users, and third parties.</>,
      <>Comply with law, enforce our agreements, and establish or defend legal claims.</>,
    ],
  },
  {
    id: "legal-bases",
    title: "Legal bases for processing",
    paragraphs: [
      <>Where GDPR, UK GDPR, or similar law applies, Airveek processes personal information when necessary to perform a contract, comply with legal obligations, pursue legitimate interests such as security and service improvement, or act with your consent.</>,
      <>When processing relies on consent, you may withdraw that consent at any time. Withdrawal does not affect processing that was lawful before withdrawal.</>,
    ],
  },
  {
    id: "ai-processing",
    title: "Prompts, uploads, and AI processing",
    paragraphs: [
      <>Airveek must process the prompts, reference images, and other materials you submit to provide the requested creative function. This processing may involve specialized AI, hosting, storage, moderation, and delivery providers acting for us.</>,
      <>Do not upload confidential information or personal information about another person unless you have a lawful basis and all required permissions. Review project content before submission and remove information that is not needed for the creative request.</>,
    ],
  },
  {
    id: "sharing",
    title: "How information is shared",
    paragraphs: [<><strong className="text-[#fdfdfd]">Airveek does not sell personal information.</strong> We disclose information only as reasonably necessary for the purposes described in this Policy.</>],
    bullets: [
      <><strong className="text-[#d9ffb8]">Service providers:</strong> hosting, AI processing, storage, analytics, email, customer support, fraud prevention, and payment services.</>,
      <><strong className="text-[#d9ffb8]">Professional advisors:</strong> legal, accounting, insurance, audit, and compliance professionals where necessary.</>,
      <><strong className="text-[#d9ffb8]">Legal and safety disclosures:</strong> authorities or other parties when required by law or reasonably necessary to protect rights, safety, and security.</>,
      <><strong className="text-[#d9ffb8]">Business transfers:</strong> a buyer, investor, lender, or successor involved in a merger, financing, restructuring, acquisition, or asset sale, subject to appropriate safeguards.</>,
    ],
  },
  {
    id: "international-transfers",
    title: "International transfers",
    paragraphs: [
      <>Airveek and its providers may process information in Canada, the United States, and other countries. Privacy laws in those locations may differ from the laws where you live.</>,
      <>Where required, we use contractual and organizational safeguards intended to support lawful cross-border transfers.</>,
    ],
  },
  {
    id: "retention",
    title: "Data retention",
    paragraphs: [
      <>We keep personal information only as long as reasonably necessary to provide and secure the Service, maintain transaction and business records, meet legal obligations, resolve disputes, and enforce agreements.</>,
      <>Retention depends on the type of information, account status, feature used, legal requirements, and operational need. When information is no longer required, we may delete, aggregate, or de-identify it.</>,
    ],
  },
  {
    id: "security",
    title: "Data security",
    paragraphs: [
      <>Airveek uses reasonable administrative, technical, and organizational safeguards designed to protect personal information from unauthorized access, alteration, loss, or disclosure.</>,
      <>No internet transmission or storage system is completely secure. You are responsible for using a strong password, protecting your credentials, and notifying us if you suspect unauthorized account activity.</>,
    ],
  },
  {
    id: "rights",
    title: "Your privacy rights and choices",
    paragraphs: [<>Depending on where you live, you may have rights regarding your personal information. We will respond to verified requests as required by applicable law.</>],
    bullets: [
      <>Request access to or a copy of personal information we hold about you.</>,
      <>Ask us to correct inaccurate or incomplete information.</>,
      <>Request deletion, restriction, objection, or portability where those rights apply.</>,
      <>Withdraw consent when consent is the basis for processing.</>,
      <>Appeal certain decisions or complain to your local privacy regulator.</>,
    ],
    subsections: [
      {
        title: "Submitting a request",
        paragraphs: [<>Email <a className="font-semibold text-[#83ff00] underline decoration-[#83ff00]/30 underline-offset-4" href="mailto:support@airveek.com">support@airveek.com</a>. We may ask for information needed to verify your identity and protect your account. Authorized agents may submit requests where local law permits.</>],
      },
    ],
  },
  {
    id: "communications",
    title: "Email and marketing choices",
    paragraphs: [
      <>We may send transactional messages about purchases, account access, security, support, feature changes, and other Service matters. These messages are necessary to provide Airveek.</>,
      <>Where permitted by law, including Canada&apos;s Anti-Spam Legislation (CASL), we may send product news or promotional messages with your consent or another lawful basis. Use the unsubscribe link in a marketing email or contact support to opt out. Opting out of marketing does not stop essential Service messages.</>,
    ],
  },
  {
    id: "children",
    title: "Children’s privacy",
    paragraphs: [
      <>Airveek is intended for adults and is not directed to anyone under 18. We do not knowingly collect personal information from children. Contact us if you believe a child has provided personal information so we can take appropriate action.</>,
    ],
  },
  {
    id: "changes",
    title: "Changes to this Policy",
    paragraphs: [
      <>We may update this Policy as Airveek, our providers, or applicable laws change. We will post the updated version and revise the effective date. For material changes, we may also provide notice through the Service or by email.</>,
    ],
  },
  {
    id: "contact",
    title: "Contact us",
    paragraphs: [
      <>For privacy questions or requests, email <a className="font-semibold text-[#83ff00] underline decoration-[#83ff00]/30 underline-offset-4" href="mailto:support@airveek.com">support@airveek.com</a> or write to Airveek, 980 Fraser Drive, Suite 209, Burlington, Ontario L7L 5P5, Canada.</>,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This Policy explains what information Airveek handles, why we use it, and the choices available to you."
      lastUpdated="August 21, 2026"
      summary="We use personal information to provide and secure Airveek, process creative requests, support customers, and improve the Service. We do not sell personal information."
      sections={sections}
    />
  );
}
