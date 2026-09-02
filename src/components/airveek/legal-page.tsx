import type { ReactNode } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { InteriorHero, InteriorPageShell } from "./interior-page-shell";

export type LegalSubsection = {
  title: string;
  paragraphs?: ReactNode[];
  bullets?: ReactNode[];
};

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: ReactNode[];
  bullets?: ReactNode[];
  subsections?: LegalSubsection[];
};

type LegalPageProps = {
  title: string;
  description: string;
  lastUpdated: string;
  summary: string;
  sections: LegalSection[];
};

function ContentsLinks({ sections }: { sections: LegalSection[] }) {
  return (
    <ol className="space-y-2 text-sm leading-6 text-muted-foreground">
      {sections.map((section, index) => (
        <li key={section.id}>
          <Link className="group flex gap-3 rounded-lg px-3 py-2 transition hover:bg-primary/8 hover:text-primary" href={`#${section.id}`}>
            <span className="w-6 shrink-0 font-bold text-primary/70">{String(index + 1).padStart(2, "0")}</span>
            <span>{section.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function Paragraphs({ items }: { items?: ReactNode[] }) {
  if (!items?.length) return null;

  return (
    <div className="space-y-4">
      {items.map((paragraph, index) => <p className="text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8" key={index}>{paragraph}</p>)}
    </div>
  );
}

function Bullets({ items }: { items?: ReactNode[] }) {
  if (!items?.length) return null;

  return (
    <ul className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
      {items.map((item, index) => (
        <li className="flex gap-3" key={index}>
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function LegalPage({ title, description, lastUpdated, summary, sections }: LegalPageProps) {
  return (
    <InteriorPageShell>
      <InteriorHero eyebrow="Airveek legal" title={title} description={description} />
      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden rounded-3xl border border-border bg-surface/90 p-5 lg:sticky lg:top-28 lg:block" aria-label={`${title} table of contents`}>
            <p className="mb-4 px-3 text-xs font-black uppercase tracking-[0.2em] text-primary">On this page</p>
            <ContentsLinks sections={sections} />
          </aside>

          <article className="min-w-0 rounded-3xl border border-border bg-surface/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Effective date</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{lastUpdated}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-2 text-xs font-bold text-primary">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Airveek policy
              </span>
            </div>

            <div className="my-8 rounded-2xl border border-primary/20 bg-primary/7 p-5 text-sm leading-7 text-foreground sm:p-6 sm:text-base">
              {summary}
            </div>

            <details className="mb-8 rounded-2xl border border-border bg-surface-muted p-4 lg:hidden">
              <summary className="cursor-pointer font-display text-base font-bold text-foreground">Table of contents</summary>
              <div className="mt-4 border-t border-border pt-4"><ContentsLinks sections={sections} /></div>
            </details>

            <div>
              {sections.map((section, index) => (
                <section className={`${index === 0 ? "pt-1" : "border-t border-border pt-9"} scroll-mt-28 pb-9`} id={section.id} key={section.id}>
                  <h2 className="font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">{index + 1}. {section.title}</h2>
                  <div className="mt-5"><Paragraphs items={section.paragraphs} /></div>
                  <Bullets items={section.bullets} />
                  {section.subsections?.map((subsection) => (
                    <div className="mt-7 rounded-2xl border border-border bg-surface-muted p-5 sm:p-6" key={subsection.title}>
                      <h3 className="font-display text-lg font-bold text-foreground sm:text-xl">{subsection.title}</h3>
                      <div className="mt-4"><Paragraphs items={subsection.paragraphs} /></div>
                      <Bullets items={subsection.bullets} />
                    </div>
                  ))}
                </section>
              ))}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-surface-muted p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
              <div>
                <p className="font-display text-lg font-bold text-foreground">Questions about this policy?</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Our support team can help you understand how this document applies to Airveek.</p>
              </div>
              <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover sm:mt-0" href="mailto:support@airveek.com">
                <Mail className="h-4 w-4" aria-hidden="true" />
                support@airveek.com
              </Link>
            </div>
          </article>
        </div>
      </section>
    </InteriorPageShell>
  );
}
