/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { SeoEngagementTracker } from "@/components/seo/seo-engagement-tracker";
import { absoluteUrl } from "@/lib/seo/site";
import type { SeoPageRecord } from "@/features/seo/types";

export function SeoContentPage({ page, breadcrumbs }: { page: SeoPageRecord; breadcrumbs: Array<{ label: string; href?: string }> }) {
  const selected = page.assets.filter((asset) => asset.role === "hero" || asset.role === "selected");
  const rejected = page.assets.filter((asset) => asset.role === "rejected" || asset.role === "corrected");
  const body = page.body;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${page.canonical_url}#article`,
    headline: page.title,
    description: page.meta_description,
    url: page.canonical_url,
    datePublished: page.published_at ?? undefined,
    dateModified: page.search_lastmod_at ?? page.published_at ?? undefined,
    author: page.author_name ? { "@type": "Person", name: page.author_name } : { "@type": "Organization", name: "Airveek" },
    image: selected[0]?.public_url,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, item: absoluteUrl(item.href ?? page.path) })),
  };

  return (
    <>
      <SeoEngagementTracker properties={{ contentId: page.id, pageId: page.id, pageFamily: page.page_family, productEntity: page.product_slug ?? undefined, imageJob: page.job_slug ?? undefined, templateVersion: page.template_version, cohortId: page.cohort_id ?? undefined }} />
      <JsonLd data={[articleSchema, breadcrumbSchema]} />
      <article className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
        <Breadcrumbs items={breadcrumbs} />
        <header className="max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#83ff00]">Airveek field guide</p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">{page.title}</h1>
          <p className="mt-6 text-lg leading-8 text-[#b8c5b2]">{page.direct_answer}</p>
          <p className="mt-4 text-sm text-[#81927c]">Search task: {page.primary_query}</p>
        </header>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-10">
            {body.buyerQuestion ? <section><h2 className="font-display text-2xl font-bold text-white">The buyer question</h2><p className="mt-3 text-base leading-8 text-[#b8c5b2]">{body.buyerQuestion}</p></section> : null}
            {selected.length ? <section><h2 className="font-display text-2xl font-bold text-white">Verified Airveek result</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{selected.map((asset) => <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={asset.id}><img className="aspect-[4/3] h-auto w-full object-cover" src={asset.public_url} alt={asset.alt_text ?? page.title} loading="lazy" width={asset.width ?? 1200} height={asset.height ?? 900} /><figcaption className="p-4 text-sm leading-6 text-[#a4b19e]">{asset.caption ?? "Selected output from a documented Airveek generation run."}</figcaption></figure>)}</div></section> : null}
            {body.steps?.length ? <section><h2 className="font-display text-2xl font-bold text-white">How to create it</h2><ol className="mt-4 space-y-4">{body.steps.map((step, index) => <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={`${step.title}-${index}`}><h3 className="font-display text-lg font-bold text-[#d9ffb8]">{index + 1}. {step.title}</h3><p className="mt-2 text-sm leading-7 text-[#b8c5b2]">{step.description}</p></li>)}</ol></section> : null}
            {body.prompt ? <section><h2 className="font-display text-2xl font-bold text-white">Tested prompt</h2><pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[#83ff00]/25 bg-[#071007] p-5 text-sm leading-7 text-[#d9ffb8]"><code>{body.prompt}</code></pre></section> : null}
            {body.negativeConstraints?.length ? <section><h2 className="font-display text-2xl font-bold text-white">Negative constraints</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{body.negativeConstraints.map((constraint) => <li className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-[#b8c5b2]" key={constraint}>{constraint}</li>)}</ul></section> : null}
            {rejected.length ? <section><h2 className="font-display text-2xl font-bold text-white">What we rejected or corrected</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{rejected.map((asset) => <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={asset.id}><img className="aspect-[4/3] h-auto w-full object-cover" src={asset.public_url} alt={asset.alt_text ?? `Rejected output for ${page.title}`} loading="lazy" width={asset.width ?? 1200} height={asset.height ?? 900} /><figcaption className="p-4 text-sm leading-6 text-[#a4b19e]">{asset.caption ?? "Rejected during product-identity or buyer-detail QA."}</figcaption></figure>)}</div></section> : null}
            {body.checklist?.length ? <section><h2 className="font-display text-2xl font-bold text-white">Publish checklist</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{body.checklist.map((item) => <li className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-[#b8c5b2]" key={item}>{item}</li>)}</ul></section> : null}
            {page.sources.length ? <section><h2 className="font-display text-2xl font-bold text-white">Sources and methodology</h2><ul className="mt-4 space-y-3">{page.sources.map((source) => <li key={source.id}><a className="text-sm text-[#b8ff6b] underline decoration-[#83ff00]/30 underline-offset-4" href={source.url} rel="nofollow noreferrer">{source.title}</a>{source.publisher ? <span className="text-sm text-[#81927c]"> — {source.publisher}</span> : null}</li>)}</ul>{body.methodology ? <p className="mt-5 text-sm leading-7 text-[#a4b19e]">{body.methodology}</p> : null}</section> : null}
          </div>
          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[#83ff00]/25 bg-[#071007] p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#83ff00]">Ready to try it?</p><p className="mt-3 text-sm leading-6 text-[#b8c5b2]">Open the matching Airveek workflow with this page’s tested direction.</p><Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#83ff00] px-4 text-sm font-black text-[#040404] transition hover:bg-[#b8ff6b]" href={`/create/product-fashion?contentId=${encodeURIComponent(page.id)}`}>Open in Airveek</Link></div>
            {page.links.length ? <div className="rounded-2xl border border-white/10 bg-[#0b120b] p-5"><h2 className="font-display text-lg font-bold text-white">Keep exploring</h2><ul className="mt-4 space-y-3">{page.links.slice(0, 8).map((link) => <li key={`${link.target_page_id}-${link.link_type}`}><Link className="text-sm leading-6 text-[#b8ff6b] hover:text-white" href={link.target_path}>{link.anchor_text}</Link></li>)}</ul></div> : null}
          </aside>
        </div>
      </article>
    </>
  );
}
