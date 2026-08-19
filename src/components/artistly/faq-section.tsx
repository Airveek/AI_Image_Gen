"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { faqs } from "./landing-data";
import { SectionHeading } from "./section-heading";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-white/10 bg-[#050b2b] px-4 py-20 sm:px-6 lg:py-28" aria-labelledby="faq-title">
      <div className="mx-auto max-w-4xl">
        <SectionHeading titleId="faq-title" eyebrow="Questions, answered" title="Frequently Asked Questions" description="Everything you need to know before you start creating." />
        <div className="mt-10 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0a1539]" key={faq.question}>
                <h3>
                  <button
                    type="button"
                    className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 px-5 text-left font-display text-base font-bold text-white transition hover:bg-white/[0.04] sm:px-6 sm:text-lg"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-cyan-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                </h3>
                {isOpen ? <p className="m-0 border-t border-white/10 px-5 pb-5 pt-4 text-sm leading-7 text-slate-300 sm:px-6">{faq.answer}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
