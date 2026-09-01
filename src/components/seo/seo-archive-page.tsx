import Link from "next/link";

import { InteriorHero, InteriorPageShell } from "@/components/airveek/interior-page-shell";
import type { SeoPageSummary } from "@/features/seo/types";

export function SeoArchivePage({
  eyebrow,
  title,
  description,
  pages,
  page,
  pageCount,
  rootPath,
  emptyText,
}: {
  eyebrow: string;
  title: string;
  description: string;
  pages: SeoPageSummary[];
  page: number;
  pageCount: number;
  rootPath: string;
  emptyText: string;
}) {
  return <InteriorPageShell><InteriorHero eyebrow={eyebrow} title={title} description={description} /><section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-20"><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{pages.map((item) => <article className="rounded-3xl border border-white/10 bg-[#0b120b] p-6" key={item.id}><p className="text-xs font-black uppercase tracking-[0.18em] text-[#83ff00]">{item.page_family}</p><h2 className="mt-3 font-display text-2xl font-bold text-white"><Link className="hover:text-[#83ff00]" href={item.path}>{item.title}</Link></h2><p className="mt-3 text-sm leading-7 text-[#a4b19e]">{item.meta_description}</p><Link className="mt-5 inline-flex text-sm font-bold text-[#b8ff6b]" href={item.path}>View the workflow →</Link></article>)}</div>{!pages.length ? <div className="rounded-3xl border border-dashed border-white/15 bg-[#0b120b] p-8 text-center text-[#a4b19e]">{emptyText}</div> : null}<SeoArchiveNav rootPath={rootPath} page={page} pageCount={pageCount} /></section></InteriorPageShell>;
}

export function SeoArchiveNav({ rootPath, page, pageCount }: { rootPath: string; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const visiblePages = new Set([1, pageCount, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pageCount));
  const ordered = [...visiblePages].sort((a, b) => a - b);
  const links: Array<number | "ellipsis"> = [];
  for (const value of ordered) {
    const previous = links.at(-1);
    if (typeof previous === "number" && value - previous > 1) links.push("ellipsis");
    links.push(value);
  }
  return <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label={`${rootPath} pages`}><span className="mr-2 text-sm text-[#a4b19e]">Page {page} of {pageCount}</span>{links.map((value, index) => value === "ellipsis" ? <span className="px-2 text-[#6f6f6f]" key={`ellipsis-${index}`}>…</span> : <Link className={`rounded-full border px-4 py-2 text-sm font-bold ${value === page ? "border-[#83ff00] bg-[#83ff00] text-[#040404]" : "border-white/10 text-[#b8ff6b] hover:border-[#83ff00]/60"}`} href={value === 1 ? rootPath : `${rootPath}/page/${value}`} aria-current={value === page ? "page" : undefined} key={value}>{value}</Link>)}</nav>;
}
