import type { Metadata } from "next";
import { CalendarOff, CheckCircle2, Clock3, Mail, MessageSquareText, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { InteriorHero, InteriorPageShell } from "@/components/airveek/interior-page-shell";
import { canonicalMetadata } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Contact Support",
  description: "Contact the Airveek support team for account, billing, access, or creative workflow help.",
  ...canonicalMetadata("/support"),
};

const requestChecklist = [
  "The email address connected to your Airveek purchase or account",
  "The feature or page you were using when the issue occurred",
  "A short description of what you expected and what happened instead",
  "A screenshot or error message, with passwords and payment details removed",
];

export default function SupportPage() {
  return (
    <InteriorPageShell>
      <InteriorHero
        eyebrow="Airveek support"
        title="Real help for your creative workflow."
        description="Questions about access, billing, an image tool, or your results? Send one clear support request and our team will help you move forward."
      />

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <article className="rounded-3xl border border-[#83ff00]/20 bg-[#0b120b]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8 lg:p-10">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#83ff00]/25 bg-[#83ff00]/10 text-[#83ff00]">
              <MessageSquareText className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-6 font-display text-3xl font-extrabold text-[#fdfdfd] sm:text-4xl">Tell us what you need.</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#a4b19e]">
              Email is the fastest way to reach Airveek support. Put all details for the same issue in one message so we can investigate efficiently and keep your answers in one thread.
            </p>

            <Link className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#2ac414] via-[#83ff00] to-[#2ac414] px-5 text-base font-black text-[#040404] shadow-[0_16px_40px_rgba(131,255,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(131,255,0,0.28)] sm:w-auto sm:px-7" href="mailto:support@airveek.com?subject=Airveek%20Support%20Request">
              <Mail className="h-5 w-5" aria-hidden="true" />
              support@airveek.com
            </Link>

            <div className="mt-10 border-t border-white/10 pt-8">
              <h3 className="font-display text-xl font-bold text-[#d9ffb8]">Include these details</h3>
              <ul className="mt-5 grid gap-3">
                {requestChecklist.map((item) => (
                  <li className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm leading-6 text-[#b8c5b2]" key={item}>
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#83ff00]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="grid content-start gap-4" aria-label="Airveek support information">
            <div className="rounded-3xl border border-white/10 bg-[#111a11]/95 p-6 sm:p-7">
              <Clock3 className="h-6 w-6 text-[#83ff00]" aria-hidden="true" />
              <h2 className="mt-5 font-display text-2xl font-bold text-[#fdfdfd]">Response time</h2>
              <p className="mt-3 text-sm leading-7 text-[#a4b19e]">We often respond within a few hours. Please allow up to 24 business hours for a complete reply.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111a11]/95 p-6 sm:p-7">
              <CalendarOff className="h-6 w-6 text-[#83ff00]" aria-hidden="true" />
              <h2 className="mt-5 font-display text-2xl font-bold text-[#fdfdfd]">Support hours</h2>
              <p className="mt-3 text-sm leading-7 text-[#a4b19e]">Our office is closed on weekends and Canadian public holidays. Messages remain queued for the next business day.</p>
            </div>

            <div className="rounded-3xl border border-[#83ff00]/15 bg-[#83ff00]/6 p-6 sm:p-7">
              <ShieldAlert className="h-6 w-6 text-[#83ff00]" aria-hidden="true" />
              <h2 className="mt-5 font-display text-2xl font-bold text-[#fdfdfd]">Protect your account</h2>
              <p className="mt-3 text-sm leading-7 text-[#b8c5b2]">Never email your password, full payment-card number, security code, or API credentials. Airveek support will not ask for them.</p>
            </div>

            <Link className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#83ff00]/25 bg-black/20 px-5 text-sm font-bold text-[#d9ffb8] transition hover:border-[#83ff00]/60 hover:bg-[#83ff00]/8" href="/#faq">
              Check common questions first
            </Link>
          </aside>
        </div>
      </section>
    </InteriorPageShell>
  );
}
