import Image from "next/image";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { SeoEngagementTracker } from "@/components/seo/seo-engagement-tracker";
import { SeoPromptCopyButton, SeoTrackedGallery, SeoTrackedLink } from "@/components/seo/seo-interactions";
import { absoluteUrl } from "@/lib/seo/site";
import type { SeoPageRecord } from "@/features/seo/types";

export function SeoContentPage({ page, breadcrumbs }: { page: SeoPageRecord; breadcrumbs: Array<{ label: string; href?: string }> }) {
  const selected = page.assets.filter((asset) => asset.role === "hero" || asset.role === "selected");
  const rejected = page.assets.filter((asset) => asset.role === "rejected" || asset.role === "corrected");
  const sourceAsset = page.assets.find((asset) => asset.role === "source");
  const workflowScreenshots = page.assets.filter((asset) => asset.role === "screenshot");
  const workflowVideos = page.assets.filter((asset) => asset.role === "video");
  const body = page.body;
  const quickSetup = [
    body.platform?.target ? ["Goal", body.platform.target] as const : null,
    body.platform?.outputDimensions?.length ? ["Output", body.platform.outputDimensions.join(", ")] as const : null,
    ...Object.entries(body.settings ?? {}).map(([key, value]) => [key, String(value)] as const),
  ].filter((entry): entry is readonly [string, string] => Boolean(entry));
  const readerSafeItems = (items: string[] | undefined) => (items ?? []).filter((item) => {
    const normalized = item.toLowerCase();
    return !/(rights?|permission|provenance|checksum|evidence|reviewer|logo policy|retailer|watermark|legal|compliance)/i.test(normalized);
  });
  const readerLimitations = readerSafeItems(body.limitations);
  const readerChecklist = readerSafeItems(body.checklist);
  const creatorParams = new URLSearchParams({ contentId: page.id });
  if (body.presetId) creatorParams.set("presetId", body.presetId);
  if (page.product_slug) creatorParams.set("product", page.product_slug);
  if (page.job_slug) creatorParams.set("job", page.job_slug);
  const creatorHref = `/create/product-fashion?${creatorParams.toString()}`;
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
          {page.author_name ? <p className="mt-3 text-sm text-[#81927c]">Written by {page.author_name}</p> : null}
        </header>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-10">
            {body.buyerQuestion ? <section><h2 className="font-display text-2xl font-bold text-white">The buyer question</h2><p className="mt-3 text-base leading-8 text-[#b8c5b2]">{body.buyerQuestion}</p></section> : null}
            {sourceAsset ? <section><h2 className="font-display text-2xl font-bold text-white">Your starting product</h2><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start"><figure className="w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]"><Image className="aspect-[4/3] h-auto w-full object-cover" src={sourceAsset.public_url} alt={sourceAsset.alt_text ?? `Reference image for ${page.title}`} loading="lazy" width={sourceAsset.width ?? 800} height={sourceAsset.height ?? 600} sizes="(max-width: 640px) 100vw, 320px" /><figcaption className="p-3 text-xs leading-5 text-[#a4b19e]">Reference image to start from</figcaption></figure><p className="text-sm leading-7 text-[#b8c5b2]">Start with a clear photo that shows the full product and the details shoppers need to see. Keep this reference nearby while you generate, compare, and refine each image.</p></div></section> : null}
            {quickSetup.length ? <section><h2 className="font-display text-2xl font-bold text-white">Quick setup</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{quickSetup.map(([key, value]) => <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4" key={key}><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{key}</dt><dd className="mt-2 text-sm text-[#d9ffb8]">{value}</dd></div>)}</dl></section> : null}
            {selected.length ? <section><h2 className="font-display text-2xl font-bold text-white">Example Airveek result</h2><SeoTrackedGallery properties={{ contentId: page.id, pageId: page.id, pageFamily: page.page_family, productEntity: page.product_slug ?? undefined, imageJob: page.job_slug ?? undefined, templateVersion: page.template_version, cohortId: page.cohort_id ?? undefined }}><div className="mt-4 grid gap-4 sm:grid-cols-2">{selected.map((asset) => <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={asset.id}><Image className="aspect-[4/3] h-auto w-full object-cover" src={asset.public_url} alt={asset.alt_text ?? page.title} priority={asset.role === "hero"} loading={asset.role === "hero" ? "eager" : "lazy"} width={asset.width ?? 1200} height={asset.height ?? 900} sizes="(max-width: 640px) 100vw, 50vw" /><figcaption className="p-4 text-sm leading-6 text-[#a4b19e]">{asset.caption ?? "Example output showing the recommended direction."}</figcaption></figure>)}</div></SeoTrackedGallery></section> : null}
            {body.steps?.length ? <section><h2 className="font-display text-2xl font-bold text-white">How to create it</h2><ol className="mt-4 space-y-4">{body.steps.map((step, index) => <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={`${step.title}-${index}`}><h3 className="font-display text-lg font-bold text-[#d9ffb8]">{index + 1}. {step.title}</h3><p className="mt-2 text-sm leading-7 text-[#b8c5b2]">{step.description}</p></li>)}</ol></section> : null}
            {workflowScreenshots.length || workflowVideos.length ? <section><h2 className="font-display text-2xl font-bold text-white">Workflow recording</h2><p className="mt-3 text-sm leading-7 text-[#b8c5b2]">Follow these captures to repeat the Airveek workflow for the same image task.</p>{workflowScreenshots.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{workflowScreenshots.map((asset) => <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={asset.id}><Image src={asset.public_url} alt={asset.alt_text ?? `Airveek workflow screenshot for ${page.title}`} width={asset.width ?? 1200} height={asset.height ?? 800} loading="lazy" sizes="(max-width: 640px) 100vw, 50vw" /><figcaption className="p-4 text-sm leading-6 text-[#a4b19e]">{asset.caption ?? "Airveek workflow step."}</figcaption></figure>)}</div> : null}{workflowVideos.map((asset) => <figure className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={asset.id}><video className="h-auto w-full" controls preload="metadata" poster={selected[0]?.public_url}><source src={asset.public_url} type={asset.mime_type} /></video><figcaption className="p-4 text-sm leading-6 text-[#a4b19e]">{asset.caption ?? "Airveek workflow recording."}</figcaption></figure>)}</section> : null}
            {body.prompt ? <section><h2 className="font-display text-2xl font-bold text-white">Tested prompt</h2><pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-[#83ff00]/25 bg-[#071007] p-5 text-sm leading-7 text-[#d9ffb8]"><code>{body.prompt}</code></pre><SeoPromptCopyButton prompt={body.prompt} properties={{ contentId: page.id, pageId: page.id, pageFamily: page.page_family, productEntity: page.product_slug ?? undefined, imageJob: page.job_slug ?? undefined, templateVersion: page.template_version, cohortId: page.cohort_id ?? undefined, presetId: body.presetId }} /></section> : null}
            {body.settings && Object.keys(body.settings).length ? <section><h2 className="font-display text-2xl font-bold text-white">Recorded settings</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(body.settings).map(([key, value]) => <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4" key={key}><dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{key}</dt><dd className="mt-2 text-sm text-[#d9ffb8]">{String(value)}</dd></div>)}</dl></section> : null}
            {body.failureFixes?.length ? <section><h2 className="font-display text-2xl font-bold text-white">Common problems and fixes</h2><div className="mt-4 space-y-3">{body.failureFixes.map((item, index) => <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4" key={`${item.failure}-${index}`}><p className="text-sm font-semibold text-[#ffd9b8]">Problem: {item.failure}</p><p className="mt-2 text-sm leading-7 text-[#b8c5b2]">Fix: {item.fix}</p></div>)}</div></section> : null}
            {rejected.length ? <section><h2 className="font-display text-2xl font-bold text-white">What we rejected or corrected</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{rejected.map((asset) => <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b120b]" key={asset.id}><Image className="aspect-[4/3] h-auto w-full object-cover" src={asset.public_url} alt={asset.alt_text ?? `Rejected output for ${page.title}`} loading="lazy" width={asset.width ?? 1200} height={asset.height ?? 900} sizes="(max-width: 640px) 100vw, 50vw" /><figcaption className="p-4 text-sm leading-6 text-[#a4b19e]">{asset.caption ?? "Direction we changed to improve the final image."}</figcaption></figure>)}</div></section> : null}
            {readerLimitations.length ? <section><h2 className="font-display text-2xl font-bold text-white">What to double-check</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{readerLimitations.map((item) => <li className="rounded-xl border border-amber-200/20 bg-amber-200/[0.04] p-4 text-sm leading-6 text-[#ffd9b8]" key={item}>{item}</li>)}</ul></section> : null}
            {body.whyThisWorks ? <section><h2 className="font-display text-2xl font-bold text-white">Why this works</h2><p className="mt-3 text-base leading-8 text-[#b8c5b2]">{body.whyThisWorks}</p></section> : null}
            {readerChecklist.length ? <section><h2 className="font-display text-2xl font-bold text-white">Before you export</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{readerChecklist.map((item) => <li className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-[#b8c5b2]" key={item}>{item}</li>)}</ul></section> : null}
            {body.faqs?.length ? <section><h2 className="font-display text-2xl font-bold text-white">Common questions</h2><div className="mt-4 space-y-4">{body.faqs.map((faq, index) => { const faqSources = (faq.evidenceSourceIds ?? []).map((sourceId) => page.sources.find((source) => source.id === sourceId)).filter((source): source is (typeof page.sources)[number] => Boolean(source)); return <div key={`${faq.question}-${index}`}><h3 className="font-display text-lg font-bold text-[#d9ffb8]">{faq.question}</h3><p className="mt-2 text-sm leading-7 text-[#b8c5b2]">{faq.answer}</p>{faqSources.length ? <p className="mt-2 text-xs leading-5 text-[#81927c]">Evidence: {faqSources.map((source, sourceIndex) => <span key={source.id}>{sourceIndex ? ", " : ""}<a className="underline decoration-[#83ff00]/30 underline-offset-4 hover:text-[#d9ffb8]" href={source.url} rel="nofollow noreferrer">{source.title}</a></span>)}</p> : null}</div>; })}</div></section> : null}
            {page.sources.length ? <section><h2 className="font-display text-2xl font-bold text-white">Further reading</h2><ul className="mt-4 space-y-3">{page.sources.map((source) => <li key={source.id}><a className="text-sm text-[#b8ff6b] underline decoration-[#83ff00]/30 underline-offset-4" href={source.url} rel="nofollow noreferrer">{source.title}</a>{source.publisher ? <span className="text-sm text-[#81927c]"> — {source.publisher}</span> : null}</li>)}</ul></section> : null}
          </div>
          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-[#83ff00]/25 bg-[#071007] p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#83ff00]">Ready to try it?</p><p className="mt-3 text-sm leading-6 text-[#b8c5b2]">Open the matching Airveek workflow with this page’s tested direction.</p><SeoTrackedLink className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#83ff00] px-4 text-sm font-black text-[#040404] transition hover:bg-[#b8ff6b]" href={creatorHref} eventName="seo_preset_opened" properties={{ contentId: page.id, pageId: page.id, pageFamily: page.page_family, productEntity: page.product_slug ?? undefined, imageJob: page.job_slug ?? undefined, templateVersion: page.template_version, cohortId: page.cohort_id ?? undefined, presetId: body.presetId }}>Open in Airveek</SeoTrackedLink></div>
            {page.links.length ? <div className="rounded-2xl border border-white/10 bg-[#0b120b] p-5"><h2 className="font-display text-lg font-bold text-white">Keep exploring</h2><ul className="mt-4 space-y-3">{page.links.slice(0, 8).map((link) => <li key={`${link.target_path}-${link.link_type}-${link.anchor_text}`}><SeoTrackedLink className="text-sm leading-6 text-[#b8ff6b] hover:text-white" href={link.target_path} targetContentId={link.target_page_id ?? undefined} properties={{ contentId: page.id, pageId: page.id, pageFamily: page.page_family, productEntity: page.product_slug ?? undefined, imageJob: page.job_slug ?? undefined, templateVersion: page.template_version, cohortId: page.cohort_id ?? undefined }}>{link.anchor_text}</SeoTrackedLink></li>)}</ul></div> : null}
          </aside>
        </div>
      </article>
    </>
  );
}
