# Airveek Programmatic SEO and Content Factory Playbook

Version: 1.0
Research date: 2026-08-30
Research depth: 60 targeted searches (32 programmatic-SEO/competitor searches + 28 ecommerce visual/workflow searches)

## Executive decision

Airveek can scale product-photo use-case pages because it can attach each page to a real, changing evidence object: a source product, a buyer question, a specific image job, a real Airveek generation, selected and rejected outputs, settings, failure notes, and a creator workflow. That is materially different from producing the same article with a different product noun.

The factory unit is:

```text
one product/variant
+ one buyer task
+ one platform or placement context
+ one independently recorded Airveek workflow
+ one distinct evidence set
= one indexable page
```

The three default jobs are:

| Job | Searcher question | Evidence required |
|---|---|---|
| Listing | “How do I show this product clearly and compliantly?” | Clean output, product/variant identity, framing and marketplace checks |
| Lifestyle | “How will this look in real use?” | Branded scene, realistic scale, product-preservation review, crop variants |
| Detail/scale | “What does it look like up close and what detail matters?” | Material, mechanism, dimensions, fit, texture, included-parts or equivalent proof |

The 200-page target is a throughput ceiling, not an obligation. Publish up to four waves of 50 only when the approved buffer contains pages that clear the same gates. If a product has only two distinct jobs, do not invent a third page; choose another validated product or category.

## What the research says

### Search engines evaluate value, not writer count

Google’s scaled-content policy applies whether pages are written by humans, AI, or both. The risk is pages made primarily to manipulate rankings without adding value, including synonymized or stitched pages. Google’s AI-search guidance likewise says not to create a separate page for every query variation merely to attract search traffic. The operational implication is simple: scale the evidence and utility, not the keyword substitutions.

Google treats crawling, indexing, and serving as separate stages. A valid page can still be crawled later, indexed later, or not rank. Sitemaps and IndexNow are discovery hints, not ranking guarantees.

### Large products scale real inventory

The useful pattern in Canva, Adobe Express, Zapier, Shopify, and similar systems is not “publish thousands of pages.” It is a database-backed inventory:

- Canva and Adobe expose meaningful template collections, visual previews, search, filters, and an immediate create action.
- Zapier requires distinct template descriptions and rejects duplicates or overly narrow variants; templates are useful because they encode a real trigger/action workflow.
- Shopify automatically maintains separate sitemap areas as products, collections, blogs, and pages change.
- Google’s ecommerce guidance favors logical category → subcategory → item links instead of search-box-only discovery.

Airveek’s equivalent inventory is the product-photo experiment: source asset → prompt/settings → result set → rejection/fix → usable preset.

### Product imagery has different jobs

Google Merchant Center recommends a main image plus additional images for alternate angles, use, staged scenes, and details. The main image must represent the correct product or variant and must not be replaced by a generic or logo-only image. Amazon’s main-image rules are stricter: product-dominant, pure white, no promotional overlays, props, or watermarks. Pinterest and owned-site/social creative can use realistic scenes and restrained branding.

Therefore “always add the logo” is not a universal image rule. Airveek must store a per-asset `logo_policy`:

1. `inherent_product_branding`: preserve the real mark already on the product or packaging.
2. `authorized_overlay_branding`: an overlay is allowed for owned-site, social, or approved campaign creative.
3. `marketplace_restricted`: remove overlays from marketplace main images.
4. `unverified_brand`: block until ownership or usage permission is confirmed.

Never hallucinate, redraw, or add a third-party logo. A provided logo file may be used only with its provenance and the requested placement recorded.

### Real audience questions converge on the same objections

Community and comment research repeatedly asks how to create professional product photos without a studio, how to create one product asset for Shopify/Instagram/Pinterest/a website, whether the first image should be white-background or lifestyle, how to show dimensions and scale, and how to keep hundreds of SKUs visually consistent. These are useful qualitative inputs, not search-volume proof. Each page should answer one of those objections with a product-specific experiment.

## Opportunity and keyword system

Create a topic record only when all of the following are true:

- one query family maps to one clear buyer job;
- no live Airveek URL already satisfies that intent;
- a rights-cleared source product or user-provided asset exists;
- Airveek can run and record the workflow;
- the answer changes with the product, job, platform, or evidence;
- a creator preset or next action is useful.

Score candidates before writing:

```text
30% repeated demand evidence
20% commercial intent
15% Airveek product fit
15% visual utility / before-after potential
10% weakness or gap in current results
10% source-asset and generation feasibility
```

Use Google Keyword Planner, GSC, Bing, GA4, support questions, and community language as separate evidence types. Label every metric `Measured`, `User-provided`, `Calculated`, `Estimated`, or `Proxy`. Do not use a keyword list to justify a page whose workflow and evidence are unchanged.

### Demand-stage map

| Stage | Modifiers | Airveek page type |
|---|---|---|
| Awareness | how to, guide, examples, product photography | category hub or educational guide |
| Consideration | best, compare, platform requirements, workflow | platform/job guide or comparison |
| Decision | template, prompt, create, generator, pricing | tested prompt/preset page with CTA |
| Implementation | settings, dimensions, checklist, fix | detailed job page with recorded steps |

## Page architecture

Use subfolders and a hub-and-spoke graph:

```text
/product-photography/
  /product-photography/{category}/
    /product-photography/{product}/
      /clean-listing-image/
      /lifestyle-image/
      /detail-and-scale/
/product-photo-prompts/{product}/
/tutorials/{slug}/
/features/{slug}/
```

Add a platform child only when platform rules materially change the workflow:

```text
/product-photography/{product}/amazon-main-image/
/product-photography/{product}/google-merchant-gallery/
/product-photography/{product}/pinterest-lifestyle-image/
```

Every public page must be reachable through ordinary links within three clicks of a hub. Before publication it needs a product-hub link, category-hub link, two sibling links, a related-product/category link, a relevant tutorial/feature link, and a prefilled creator CTA. Filters, sorts, query parameters, previews, and internal search remain non-indexable.

## Page template

The template is structured data rendered into visible server HTML; it is not a prompt that emits arbitrary HTML.

### Above the fold

1. Visible breadcrumb.
2. One H1 naming the product and image job.
3. A direct 40–80 word answer.
4. Selected output gallery with factual alt text and captions.
5. A result scorecard: what stayed accurate, what changed, and which buyer question the image answers.
6. A primary “Create this in Airveek” CTA carrying `page_id`, `product_entity`, `image_job`, `preset_id`, and `cohort_id`.

### Body sections

1. Buyer question and why it matters.
2. Source-product requirements and rights/provenance.
3. Exact Airveek settings and prompt.
4. Negative constraints and product invariants.
5. Step-by-step workflow with screenshots or a real recording.
6. Selected output(s), rejected direction, and failure/fix note.
7. Platform or channel checklist when relevant.
8. Limitations and unsupported-claim boundaries.
9. FAQ answers sourced from real audience language.
10. Related jobs and products.
11. Byline, reviewer, method, accessed dates, and citations.

The page is normally 700–1,400 words when the task requires it; there is no universal word-count target. A shorter page with original outputs and an executable preset is preferable to padded prose.

### Non-commodity evidence requirement

Every indexable page needs at least five facts that a generic text model could not truthfully invent:

- generation run ID and timestamp;
- source asset URL/path, checksum, and rights status;
- exact prompt, settings, and negative constraints;
- selected output and at least one rejected output with reason;
- an observed defect, correction, limitation, or measured generation fact;
- a tested creator preset/deep link;
- a screenshot or recording from the real Airveek workflow.

## Image and brand QA

Use the image-generation capability for a single preview before a recording. Inspect the result full-size and as a thumbnail. Fail the preview when the model changes product geometry, material, color, label, included parts, or logo; invents readable text; hides a buyer-critical detail; duplicates the product; produces weak commercial lighting; or turns a lifestyle job into empty generic staging. Add the required supplied logo only under the asset’s policy and preserve a clean marketplace variant when overlays are prohibited.

For image SEO, use standard HTML image elements, stable public URLs, explicit dimensions/aspect ratio, descriptive filenames, contextual alt text, and nearby explanatory copy. Do not rely on CSS backgrounds for indexable images. Preserve AI provenance metadata when required by the destination.

## Quality and publication gates

Use Airveek’s 100-point gate:

| Dimension | Points |
|---|---:|
| Distinct intent | 15 |
| First-hand Airveek evidence | 20 |
| Product specificity | 15 |
| Task completeness | 10 |
| Source integrity | 10 |
| Media quality | 10 |
| Internal-link correctness | 10 |
| Conversion utility | 5 |
| Technical correctness | 5 |

Minimum 85/100 and zero blockers. Block missing independent listing/lifestyle/detail evidence, rights, author/reviewer, source citations, selected media, direct answer, steps, links, CTA, canonical, 200 rendering, or schema/content mismatch. Similarity is an internal control: same product + intent at ≥0.92 blocks; 0.85–0.92 enters merge review. These are Airveek operating thresholds, not Google thresholds.

Use only `Organization`, `WebSite`, and `BreadcrumbList` globally, plus `Article` for genuine editorial/tutorial pages. Use `Product` only for a page that visibly focuses on one real purchasable product with authoritative facts. Do not add fake reviews, ratings, FAQ, HowTo, or Product markup.

## Writer-pod operating model

Ten pods of ten people are a useful starting shape:

- one opportunity/brief lead;
- eight creator-writers who research, run Airveek, select outputs, draft, and propose links;
- one editor/publisher lead.

The rolling queue is T−3 opportunity scoring, T−2 research and brief freeze, T−1 real run and image QA, T draft/evidence/link QA, publish day four waves of 50, then 7/14/28/56-day readback. A three-day approved buffer (600 pages) absorbs failed generations, holidays, and source changes.

Do not equate writer capacity with publish capacity. A candidate can be returned to `changes_requested`, `merged`, `refresh`, or `archived` without entering the sitemap.

## Autopilot sequence

```text
topic evidence
  → opportunity score / duplicate-intent check
  → structured brief
  → rights-cleared source asset
  → image preview + human image review
  → real Airveek recording
  → output/recording QA
  → structured page draft
  → rendered route/canonical/schema/link/media QA
  → editor approval
  → four 50-page publish waves
  → sitemap shard + cache invalidation
  → IndexNow for Bing
  → GSC/GA4/Bing/crawler probes
  → 7/14/28/56-day feedback
```

The existing `publishSeoPage` function is the only path that should make a page live. It updates `seo_url_state`, revalidates the page, parent hubs, archives, and sitemap, and emits `seo/page.published`. The sitemap index reads live, canonical, indexable records and creates family/month shards capped at 2,000 URLs. Google re-fetches the submitted sitemap on its own schedule; IndexNow is a Bing discovery signal and does not guarantee indexing.

## Measurement and learning

Keep sources separate:

- GSC: Google impressions, clicks, CTR, queries, and position;
- GA4/BigQuery: anonymous landing behavior and engagement;
- Supabase: page state, preset opens, generations, signups, and activation;
- Whop: payment, refund, currency, and transaction truth;
- Bing/IndexNow: discovery and Bing performance;
- Airveek crawler: actual HTTP, canonical, schema, link, image, and render health.

Report first-touch and last-non-direct attribution separately. Track `page_id`, `content_id`, `cluster_id`, `page_family`, `product_entity`, `image_job`, `template_version`, `preset_id`, `cohort_id`, `writer_id`, and `editor_id` without PII. Make decisions from comparable cohorts, not one unusually successful page. Refresh, merge, or retire low-value pages when indexed/live rates, engagement, or conversion fail the cohort gate.

## Implementation decisions for Airveek

1. Keep the existing Supabase content platform and content-kit/recording system; do not add a second CMS.
2. Extend the page body contract with platform, logo policy, source checksum, failure/fix notes, FAQ evidence, selected/rejected media, and preset metadata.
3. Add a deterministic draft validator before any database insert.
4. Make the creator CTA product/job/preset-aware instead of hard-coded to one route.
5. Keep the first 50 pages per template human-reviewed and leave automation disabled until one end-to-end pilot passes.
6. Start with the 20 researched ecommerce opportunities and expand only after measured evidence supports a new category.

## Sources and confidence

Primary/official guidance (very high confidence):

- [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google AI-search optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- [Crawling and indexing overview](https://developers.google.com/search/docs/crawling-indexing)
- [Crawl troubleshooting](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
- [Sitemap requirements](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- [Ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure)
- [Faceted navigation](https://developers.google.com/crawling/docs/faceted-navigation)
- [Pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
- [Google image SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [GSC and GA4 measurement](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console)
- [Search Console API limits](https://developers.google.com/webmaster-tools/limits)
- [Google Merchant image link](https://support.google.com/merchants/answer/6324350?hl=en)
- [Google Merchant additional images](https://support.google.com/merchants/answer/6324370?hl=en)
- [Google Merchant AI-generated content](https://support.google.com/merchants/answer/14743464?hl=en-GB)
- [Shopify sitemap behavior](https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map)
- [Shopify site structure](https://help.shopify.com/en/manual/promoting-marketing/seo/optimize-site)
- [IndexNow documentation](https://www.indexnow.org/documentation)
- [W3C image alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [Photography and copyright](https://www.copyright.gov/engage/docs/photography.pdf)

Observed product patterns (high confidence for the pattern, not causal ranking proof):

- [Canva templates](https://www.canva.com/templates/) and [product templates](https://www.canva.com/templates/s/product/)
- [Adobe Express templates](https://www.adobe.com/express/templates/) and [template search](https://www.adobe.com/express/templates/search)
- [Zapier template publishing](https://docs.zapier.com/integrations/publish/zap-templates)

Directional case studies (medium or lower confidence; use as hypotheses):

- [Silkdrive programmatic SEO case study](https://www.silkdrive.com/insights/programmatic-seo-case-study)
- [Nico Digital 162-page experiment](https://www.nicodigital.com/technical-seo/programmatic-seo-experiment-162-pages/)
- [Atastic programmatic SEO case study](https://atastic.com/case-studies/programmatic-seo-case-study)

Qualitative visual/audience references:

- [Amazon image style guidance](https://images-na.ssl-images-amazon.com/images/G/01/help/Amazon_Home_Selection_Style_Guide.pdf)
- [Pinterest creative best practices](https://business.pinterest.com/en-us/creative-best-practices/?change_language=true)
- [YouTube thumbnail/title guidance](https://support.google.com/youtube/answer/12340300?hl=en)
- [Reddit: product photos without a studio](https://www.reddit.com/r/ecommerce/comments/1rru8mv/how_are_people_making_product_photos_look_so/)
- [Reddit: multi-platform product photography](https://www.reddit.com/r/ecommerce/comments/1r8jf07/running_product_photography_for_4_platforms_separately_is_killing_my_time/)
- [Reddit: listing images and buyer doubts](https://www.reddit.com/r/AmazonFBA/comments/1v4czj2/after_7_years_making_amazon_listing_images_i_stopped_judging_images_by_how_nice_they_look/)
