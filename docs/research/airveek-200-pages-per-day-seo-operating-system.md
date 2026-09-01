# Airveek 200-Pages-Per-Day SEO Operating System

Research date: 2026-08-29  
Scope: publish 200 new, indexable, product-image use-case pages per day on airveek.com and turn organic discovery into product usage and sales  
Research depth: 37 primary, authoritative, company, and illustrative sources reviewed; repository and live-site audit included

## Executive decision

Airveek can operate at 200 new pages per day. The publishing velocity is not the thing to optimize or fear; it is the factory's output target. The system should produce 240 candidates per day and publish the best 200 that clear a fixed gate. That gives Airveek approximately 6,000 new pages in a 30-day month and 73,000 in a 365-day year.

The winning unit is not a rewritten article. It is a product-backed use-case page containing:

1. a specific product and image job;
2. a real Airveek generation run;
3. the source image, settings, prompt, and selected outputs;
4. product-specific failure checks and corrections;
5. a copyable preset or template;
6. a deep link that opens Airveek with the page's workflow prefilled.

The strategic formula is:

> repeatable search demand + real Airveek output + product-specific guidance + crawlable architecture + measurable CTA

Google's published spam policy defines scaled-content abuse by the primary purpose and lack of value, not by a numeric publishing limit. Its current generative-AI optimization guide also says not to create separate pages merely for every possible query variation. The operational answer is therefore to keep the 200-page target while making every URL a distinct user task and evidence object, not a synonym variation.

## What large-scale winners actually scale

| Publisher/product | What is scaled | What makes each page useful | Relevant evidence |
|---|---|---|---|
| Zapier | App and app-pair integration pages | Supported triggers, actions, workflows, and a working integration CTA | Live Zapier integration pages |
| Wise | Currency and rate pages | Live rates, conversion controls, and rate alerts | Live Wise currency tools |
| Canva | Template category pages | A large, editable template inventory and an immediate creation action | Live Canva template pages |
| Vimeo | Video host pages | Actual videos, chapters, and indexable player metadata | Google reports Vimeo handled a platform receiving 350,000 new videos per day and implemented scalable video SEO |
| Rotten Tomatoes | 100,000 structured pages | Page-specific data represented accurately in structured markup | Google reports 25% higher CTR for pages enhanced with structured data versus pages without it |
| Food Network | 80% of its pages enabled for search features | Structured recipe content that matched visible pages | Google reports a 35% increase in visits |
| MX Player | A catalog exceeding 200,000 hours | Actual video inventory, structured data, and frequently submitted video sitemaps | Google reports more than 3x growth in Google traffic over six months |
| Saramin | Large job and information inventory | Canonicals, de-duplication, applicable schema, crawl fixes, and user-relevant data | Google reports 102% YOY organic growth, 93% more new sign-ups, and 9% higher organic conversion rate |

The repeatable principle is not “big brands may publish anything.” It is that large publishers attach every templated URL to a real database object, tool, listing, video, calculation, review, or template. Airveek's database object should be a reproducible generation run and the finished visual set.

## Airveek's current advantage and current gap

### Existing advantage

The codebase and research artifacts already contain the beginnings of a defensible content moat:

- a live `product-fashion` creator arena at `/create/product-fashion`;
- 20 category-specific ecommerce use cases (`ECO01` through `ECO20`);
- product-specific image jobs such as clean listing, lifestyle, detail, scale, controls, texture, fit, and packaging;
- category-specific image directions and negative constraints;
- an image-quality gate and real recording workflow;
- a library of roughly 50 existing Airveek YouTube tutorials;
- existing user-event capture for generation, checkout, membership, and account events.

This is stronger than a generic writer network because the team can publish first-hand evidence from the product instead of summarizing other websites.

### Current technical gap and implementation status

The repository audit on 2026-08-29 found no scalable content system. That was
the starting point for this playbook, not a permanent design constraint. The
foundation is now implemented and verified on 2026-08-30:

- dynamic server-rendered SEO hubs and product/job/tutorial/feature routes;
- Supabase content, evidence, assignment, review, generation, asset, link,
  redirect, publish-batch, URL-state, crawl, import-watermark, and audit tables;
- DB-driven `/sitemap.xml`, family/month sitemap shards, and `/robots.txt`;
- self-canonicals, metadata, supported JSON-LD, private-route noindex, and
  permanent canonical-host redirects;
- structured content-to-creator preset handoff and anonymous first-party
  acquisition attribution;
- GSC, GA4/BigQuery fallback, Bing/IndexNow, crawler/probe, Core Web Vitals,
  cohort, and admin aggregate measurement paths;
- signed external-agent callbacks plus an attended local Codex bridge, both
  constrained to non-live drafts and immutable audit evidence.

The remaining gap is operational evidence, not URL plumbing: the first
rights-cleared product pack still needs three independent Airveek jobs, real
workflow screenshots, durable public media, and named author/reviewer records.
The production verifier, focused SEO tests, Playwright checks, and Node 24
build pass while the publish/automation kill switches remain off. The correct
sequence is therefore to complete one reviewed pilot pack, observe its crawl
and conversion signals, and only then scale the approved buffer toward the
200-page daily ceiling.

## The 200-page daily inventory model

### The standard production unit: one five-page product pack

Publish 40 product packs per day. Each pack contains five genuinely different user jobs:

1. **Product hub** — how to create a complete product-image set for the product.
2. **Clean listing image** — white/clean background, shape, color, and exact product identity.
3. **Lifestyle image** — the product in a context that explains use and scale.
4. **Detail and proof image** — the category-specific buyer question: controls, texture, fit, opening, sole, handle, dimensions, included parts, or another critical detail.
5. **Prompt/template page** — a working Airveek preset, prompt variants, negative constraints, example outputs, and “use this preset” CTA.

Calculated output: 40 products x 5 distinct jobs = 200 pages/day.

Do not force all five URLs when research shows the search intent collapses into one page. Substitute another product or another proven image job from the backlog. The daily output remains 200; only the inventory combination changes.

### URL architecture

Recommended stable paths:

```text
/product-photography/
/product-photography/phone-holder/
/product-photography/phone-holder/clean-listing-image/
/product-photography/phone-holder/lifestyle-image/
/product-photography/phone-holder/detail-and-scale/
/product-photo-prompts/phone-holder/
```

Channel-specific children are allowed only when the job materially changes because of a platform rule or shopper context:

```text
/product-photography/phone-holder/amazon-main-image/
/product-photography/phone-holder/etsy-listing-images/
/product-photography/phone-holder/shopify-product-gallery/
```

Do not generate URL combinations for color, adjective, or keyword variants that do not change the workflow or output.

### The product universe

Start with product categories, not individual branded SKUs. Source the backlog from:

- Google Product Taxonomy;
- Amazon, Etsy, Shopify, eBay, and Walmart category trees;
- Airveek's own generation and search logs;
- Search Console queries once the library starts receiving impressions;
- Google Trends, Keyword Planner, and a third-party keyword database if licensed;
- creator/customer requests and support questions;
- the existing Airveek ecommerce opportunity graph.

Examples of product families:

- electronics accessories;
- beauty and skincare;
- apparel and footwear;
- jewelry and watches;
- bags and luggage;
- drinkware and kitchenware;
- home decor and furniture;
- pet supplies;
- baby products;
- fitness and outdoor products;
- art, print-on-demand, and digital products;
- packaged food and beverages.

### Opportunity score

Score every proposed pack from 0 to 100 before briefing:

```text
Opportunity score =
  30% repeated search-demand evidence
  20% commercial intent
  15% Airveek product fit
  15% visual utility / before-after potential
  10% weakness of current results
  10% source-asset and generation feasibility
```

These weights are Airveek operating recommendations, not Google requirements.

Minimum evidence for a candidate:

- one identifiable search intent;
- no existing Airveek URL already satisfying that same intent;
- a source product that the team has rights to use or a safe generic test asset;
- a working Airveek generation path;
- at least one product-specific buyer question;
- a relevant CTA that can be prefilled;
- sources for any marketplace or technical requirements.

## What every page must contain

### Above the fold

1. One descriptive H1 that names the product and image job.
2. A direct 40–80 word answer.
3. A before/after or three-output result gallery.
4. A short result scorecard: what stayed accurate, what changed, and what the image is for.
5. A primary CTA: “Create this [product] image in Airveek.”

### Main content

1. **The buyer question** — the exact information the image needs to communicate.
2. **Source-image requirements** — angle, crop, lighting, background, visible details.
3. **Real workflow** — actual Airveek settings and steps from the run.
4. **Copyable prompt** — plus product-specific negative constraints.
5. **Selected outputs** — sharp images placed near the text that explains them.
6. **Rejects and fixes** — at least one failed or weak direction and why it was rejected.
7. **Channel checks** — only when the page targets a marketplace or format; cite the current platform source.
8. **Reusable checklist** — a practical tool the visitor can apply.
9. **Related next job** — clean listing, lifestyle, detail, prompt, or product hub.
10. **Authorship and methodology** — named writer, reviewer, visible publication/update date, and how the outputs were created.

There is no useful universal word-count requirement. The recommended Airveek range is usually 700–1,400 words, but the page should be as long as the task requires. A short page with original outputs, a working preset, and precise instructions is better than a padded 2,000-word article.

### Non-commodity requirement

Every page must contain at least five values that a generic text model could not truthfully invent without performing the run:

- generation run ID;
- source image or asset provenance;
- exact Airveek settings;
- selected prompt;
- product-specific negative constraints;
- generated outputs;
- observed defect or reject reason;
- corrected output;
- render/generation timing when measured;
- page-specific preset/deep link.

This is the main defense and the main ranking advantage.

## Example: mobile phone holder pack

### 1. Product hub

**URL:** `/product-photography/phone-holder/`  
**Intent:** create a complete image set for a mobile phone holder  
**Unique asset:** five-image set covering shape, fit, scale, hinge, ports, and desk/car use  
**CTA:** “Create a phone-holder product photo set”

### 2. Clean listing image

**URL:** `/product-photography/phone-holder/clean-listing-image/`  
**Intent:** create a clean ecommerce listing image  
**Buyer question:** can the shopper see the base, clamp, hinge, and phone-fit area without obstruction?  
**Reject checks:** invented logo, incorrect clamp, duplicate product, hidden port, changed material, floating shadow

### 3. Lifestyle image

**URL:** `/product-photography/phone-holder/lifestyle-image/`  
**Intent:** show the holder in believable use  
**Scene:** uncluttered desk or car dashboard, depending on product type  
**Buyer question:** where does it sit and what does its size look like beside a real phone?

### 4. Detail and scale image

**URL:** `/product-photography/phone-holder/detail-and-scale/`  
**Intent:** show adjustment, grip, dimensions, and compatible use  
**Unique asset:** close view of hinge/clamp plus a scale comparison  
**Boundary:** do not claim compatibility that has not been verified from the source product.

### 5. Prompt/template page

**URL:** `/product-photo-prompts/phone-holder/`  
**Intent:** copy a tested phone-holder product-photography prompt  
**Utility:** three presets—clean listing, desk lifestyle, detail close-up—with preview outputs and negative constraints  
**CTA:** opens `/create/product-fashion` with the appropriate product-scene settings and prompt ID.

## Content data model

Store pages as structured records rather than free-form documents. Minimum fields:

```ts
type SeoUseCasePage = {
  id: string;
  status: "brief" | "draft" | "qa" | "scheduled" | "published" | "refresh";
  slug: string;
  pageFamily: "hub" | "listing" | "lifestyle" | "detail" | "prompt" | "channel";
  primaryIntent: string;
  productEntity: string;
  productTaxonomyId?: string;
  imageJob: string;
  channel?: string;
  buyerQuestion: string;
  sourceAsset: {
    url: string;
    provenance: string;
    rightsStatus: string;
  };
  generationRunId: string;
  arenaId: "product-fashion";
  settings: Record<string, string | number | boolean>;
  prompt: string;
  negativeConstraints: string[];
  outputs: Array<{
    url: string;
    alt: string;
    caption: string;
    status: "selected" | "rejected" | "corrected";
    rejectionReason?: string;
  }>;
  sources: Array<{ title: string; url: string; accessedAt: string }>;
  authorId: string;
  reviewerId: string;
  publishedAt: string;
  updatedAt: string;
  relatedPageIds: string[];
  presetId: string;
  canonicalUrl: string;
  qualityScore: number;
  cohortId: string;
};
```

The content system should render these records through Next.js server components or static generation. Essential text, links, image metadata, canonical tags, and JSON-LD must be present without requiring a user interaction.

## Organizing the 100-writer team

Create ten pods of ten people:

- 1 opportunity/brief lead;
- 8 creator-writers;
- 1 editor/publisher lead.

Daily pod math:

- 8 creator-writers x 3 page candidates = 24 candidates;
- editor and automated gates select 20 for publication;
- 4 candidates return for correction or enter the buffer;
- 10 pods x 20 published pages = 200 pages/day.

All writers are product operators, not text-only writers. Each writer is responsible for research, a real Airveek run, output selection, the draft, and first-pass internal links. The editor verifies evidence, intent separation, media, and technical output.

Build a rolling three-day approved buffer of 600 pages so holidays, failed generations, or platform changes do not break the daily rate.

### Daily clock

Operate a rolling pipeline rather than starting and finishing everything in one day:

| Time horizon | Work |
|---|---|
| T-3 days | Opportunity score and product-pack selection |
| T-2 days | Query/SERP research, source validation, and brief freeze |
| T-1 day | Real Airveek runs, output QA, and replacement generations |
| T day | Draft completion, evidence review, link assignment, and technical validation |
| Publish day | Four waves of 50 URLs, sitemap update, CDN warming, and monitoring |
| T+1/T+3 | Server, crawl, structured-data, and analytics check |
| T+7/T+14/T+28/T+56 | Cohort performance readback |

Four releases of 50 pages are recommended for operational observability and fast rollback of a broken template. They are not an SEO ranking trick.

## The 100-point publish gate

| Dimension | Points | Pass condition |
|---|---:|---|
| Distinct intent | 15 | Query and SERP job differ from every existing Airveek page |
| First-hand Airveek evidence | 20 | Valid run, settings, prompt, and outputs |
| Product specificity | 15 | Buyer question and constraints could not be swapped onto another product unchanged |
| Task completeness | 10 | Direct answer, steps, checks, and next action |
| Source integrity | 10 | Every changeable requirement is cited and dated |
| Media quality | 10 | Images load, are sharp, have useful alt/captions, and preserve product truth |
| Internal-link placement | 10 | Parent, siblings, next job, and tool are linked contextually |
| Conversion utility | 5 | Prefilled CTA works and preserves content attribution |
| Technical SEO | 5 | 200 status, indexable, self-canonical, unique metadata, valid schema, sitemap-ready |

Publish threshold: 85/100 and no blocker. This is an Airveek quality threshold, not a Google score.

Automatic blockers:

- no real generation record;
- missing or unclear asset rights;
- materially altered product identity presented as accurate;
- unsupported marketplace, safety, medical, compatibility, or performance claim;
- same intent already satisfied by an existing URL;
- broken source image, output, CTA, or canonical;
- empty/near-empty rendered HTML;
- missing author or reviewer;
- an inaccessible page or non-200 status.

Run semantic similarity and intent checks before assigning the slug. As an internal review trigger, route a page to merge review when it has both the same product/intent and greater than 0.85 embedding similarity to an existing page. The threshold is an operational heuristic, not a Google rule.

Failed candidates remain public only if useful to users; otherwise keep them in draft or `noindex` until fixed. Replace them from the buffer so the published/indexable output still reaches 200.

## Technical SEO for 73,000 annual URLs

### Rendering and status

- Render the main content, links, title, canonical, image metadata, and JSON-LD on the server or at build time.
- Return `200` only for complete records.
- Return `404` or `410` for removed pages with no replacement.
- Use `301` when a page is merged into a genuinely equivalent stronger page.
- Never return a “not found” or empty template with `200`.

### Canonicals and URL control

- Add a self-referencing canonical to every indexable page.
- Link internally only to canonical URLs.
- Do not put tracking parameters in sitemap or internal links.
- Do not allow filters, sort orders, internal searches, preview states, or arbitrary prompt parameters to create indexable URL spaces.
- Use `noindex` for public drafts or low-value variations; use robots rules to manage crawl spaces, not to hide an indexable page.

### Internal-link graph

Every important page must be linked from at least one other crawlable page. Airveek's standard graph should be:

```text
Product Photography hub
  -> Product-family hub
    -> Product hub
      -> Listing image
      -> Lifestyle image
      -> Detail image
      -> Prompt/template
      -> Airveek creator preset
```

Every child page should link to:

- its product hub;
- two useful sibling jobs;
- one adjacent product or category example;
- the relevant source/policy where needed;
- the prefilled creator workflow.

Use standard `<a href>` links and descriptive anchor text. Category and archive pages must have crawlable pagination; do not rely on a “Load more” button alone.

### Sitemaps

Google's hard limit is 50,000 URLs or 50 MB uncompressed per sitemap. Use much smaller shards for diagnosis:

```text
/sitemap.xml                         # sitemap index
/sitemaps/product-hubs-2026-09.xml
/sitemaps/listing-images-2026-09.xml
/sitemaps/lifestyle-images-2026-09.xml
/sitemaps/detail-images-2026-09.xml
/sitemaps/prompts-2026-09.xml
```

Recommended shard size: 2,000–5,000 canonical URLs. This makes Search Console comparisons by page family and month easier.

- include only live, canonical, indexable `200` URLs;
- use fully qualified URLs;
- update `lastmod` only after a substantive page change;
- include discoverable image/video metadata where applicable;
- submit the sitemap index once and update the files automatically;
- do not resubmit unchanged sitemaps multiple times a day.

For Google, use sitemaps for bulk discovery and URL Inspection for a small diagnostic sample. Do not use Google's Indexing API for this library; Google restricts it to `JobPosting` and livestream `BroadcastEvent` pages. Use IndexNow for new, updated, and deleted URLs on Bing and other participating engines.

### Structured data

Use only markup that matches visible page content:

- `Article` or `BlogPosting` for editorial/how-to pages;
- `BreadcrumbList` for hierarchy;
- `VideoObject` when an actual watchable video is embedded and crawlable;
- `ImageObject`/`primaryImageOfPage` for the representative original output;
- `Organization`/`WebSite` at the site level.

Do not mark an Airveek guide as `Product` unless the page actually represents a purchasable product under Google's product-markup rules. Do not rely on `HowTo` or FAQ rich results; the current Google search gallery no longer lists them as supported general search features. Do not use `QAPage` unless users can submit alternative answers to one question.

### Image and video discovery

- use `<img src>` or Next Image output with a real fallback `src`, not CSS background images for core content;
- use short, descriptive filenames;
- write useful alt text that describes the actual image without keyword stuffing;
- add visible captions explaining what the output proves;
- keep source/output URLs stable;
- use responsive images and aggressive but visually safe compression;
- provide high-resolution representative images without making pages slow;
- include video sitemaps and `VideoObject` for actual page-level tutorials;
- create individual landing pages for the existing Airveek tutorial videos, with transcript, screenshots, steps, and a relevant CTA.

### Performance targets

Use Google's current “good” Core Web Vitals targets at the 75th percentile:

- LCP at or below 2.5 seconds;
- INP at or below 200 milliseconds;
- CLS at or below 0.1.

Do not lazy-load the primary above-the-fold result image. Cache rendered pages and shared assets, precompute metadata, avoid per-request generation work, and ensure the origin can absorb search crawler bursts without 5xx errors.

## Turn traffic into Airveek usage and sales

The page must be a product acquisition surface, not a dead-end blog.

### Prefilled creator handoff

Implement a preset URL such as:

```text
/create/product-fashion?preset=phone-holder-lifestyle&contentId=seo_01...
```

The creator should receive:

- arena: `product-fashion`;
- mode: product scene;
- goal: store listing, social campaign, or other page-specific job;
- scene/preset;
- the tested prompt;
- negative constraints;
- recommended aspect ratio;
- the originating `contentId` and cohort.

Let visitors see the exact expected result before the CTA. If product flow permits, let them upload the source product before forcing account creation; preserve their draft through sign-in and checkout.

### Attribution model

Extend analytics with:

```text
seo_page_view
seo_result_gallery_engaged
seo_prompt_copied
seo_preset_opened
seo_upload_started
account_created
generation_requested
generation_succeeded
checkout_started
membership_activated
```

Attach these properties where relevant:

```text
contentId
cohortId
pageFamily
productEntity
imageJob
writerId
editorId
landingPage
presetId
firstTouchContentId
lastTouchContentId
```

The current authenticated event model starts too late for content attribution. Add a first-party anonymous acquisition ID, persist it through login, and join it to the user record once an account is created.

### Business metrics

Search Console is the source of truth for Google impressions/clicks; product analytics is the source of truth for behavior and sales. Track by page family, product family, writer, editor, publication cohort, and template version.

Core funnel:

```text
published URL
-> discovered
-> crawled
-> indexed
-> impression
-> organic click
-> preset opened
-> upload started
-> generation succeeded
-> checkout started
-> membership activated
```

Required metrics:

- indexation rate = indexed canonical URLs / submitted canonical URLs;
- impression-active rate = URLs with at least one impression / indexed URLs;
- organic CTR = clicks / impressions;
- preset-open rate = preset opens / organic landing sessions;
- generation-success rate = successful generations / organic landing sessions;
- organic purchase rate = memberships activated / organic landing sessions;
- revenue per 100 published pages;
- revenue and gross margin by cohort/page family;
- time to first crawl, first index, first impression, first click, and first sale;
- zero-impression URL rate at days 28 and 56;
- top-query overlap between sibling URLs.

Do not use average position as the only success metric. Google explicitly recommends focusing on impressions and clicks, and Airveek must add product usage and paid conversion.

## Cohort decisions and refresh loop

Read each daily cohort at 7, 14, 28, and 56 days. Search ranking can take longer, so these are diagnostic windows, not guarantees.

Use relative stop rules rather than arbitrary universal promises:

- if a page family has a day-28 indexation rate more than 20 percentage points below the site median, stop only that template family, inspect render/canonical/quality patterns, fix it, and keep the other families publishing;
- if a page family has a day-56 impression-active rate 30% below the site median, re-score the topic source and page utility;
- if two sibling URLs repeatedly receive the same top queries and alternate ranking, merge them and redirect the weaker URL;
- if a page earns impressions but weak CTR, improve title, visible answer, and representative image;
- if it earns clicks but no preset opens, fix the result proof and CTA;
- if it earns preset opens but no successful generations, fix the preset or tool handoff;
- if it generates successfully but does not start checkout after a meaningful sample, test the offer and upgrade moment;
- refresh platform specifications when their primary source changes;
- preserve strong URLs and update them in place instead of creating annual duplicates.

Build controls into the 200/day program. For example, compare matched cohorts with and without an embedded video, a downloadable checklist, or three versus five output examples. Keep the URL and main intent stable; vary the template by cohort, not by serving different content to Googlebot.

## Full-scale launch plan

This plan does not require a slow public trickle. It prepares the machine and then begins at the full rate.

### Foundation sprint: 14 days

Build in parallel:

- content database and author/reviewer records;
- dynamic server-rendered routes;
- canonical and metadata generator;
- Article/Breadcrumb/Image/Video structured data;
- sitemap index and page-family shards;
- robots and parameter controls;
- internal-link graph builder;
- image/video asset pipeline;
- content QA validator;
- creator preset/deep-link support;
- anonymous-to-user attribution;
- Search Console, Bing Webmaster Tools, IndexNow, and BigQuery export;
- dashboards by family/cohort/writer;
- a 600-page approved launch buffer.

### Full-rate launch

- publish 50 pages in each of four daily waves;
- warm CDN/cache before sitemap inclusion;
- validate a stratified sample from every template and wave;
- automatically remove failed URLs from the sitemap and replace them from the approved buffer;
- review crawl/server errors the same day;
- run the 7/14/28/56-day cohort loop continuously.

### First inventory order

1. Convert each existing tutorial into an individual, transcript-backed landing page.
2. Turn the 20 existing ecommerce use cases into complete five-page product packs: 100 pages.
3. Expand adjacent categories using the same buyer-question framework.
4. Add platform-specific pages only after the rule source and distinct intent are verified.
5. Expand the winning families found in Search Console rather than spreading evenly across every creative feature.

The current live Airveek positioning is broad. For initial topical authority, concentrate the first 5,000–10,000 pages on ecommerce/product photography, where Airveek already has a real tool, use cases, outputs, and a commercial CTA. Expand into thumbnails, logos, print-on-demand, storybooks, and other arenas as separate content clusters after their product workflows are equally real and measurable.

## Research conclusions

1. **Inference from current Google policy:** there is no published daily page ceiling. Abuse is defined by purpose, originality, and user value. Therefore, 200/day is compatible with search guidelines when every page is useful and distinct.
2. **Scale is not an excuse to lower the unit quality.** Google's own examples show that 100,000-page structured implementations and massive video catalogs can produce search gains when the pages represent real objects accurately.
3. **Exact-match variation is not the growth engine in 2026.** Google's current AI optimization guide explicitly warns against separate pages for every fan-out query variation. Airveek should scale product x job x real output, not wording x synonym.
4. **Airveek has a content moat competitors cannot cheaply copy:** source-product inputs, real outputs, prompt/settings, reject reasons, and a working creator preset.
5. **Technical discovery is a production feature.** Server rendering, canonical discipline, crawlable links, sitemaps, image/video discovery, origin reliability, and correct status codes must ship before the daily factory starts.
6. **The SEO program is not complete until it is attributed to generation and revenue.** Search clicks without preset opens, successful generations, checkouts, and activations are not the target outcome.

## Source ledger

### Google Search policy and content quality

1. Google Search Central, Spam policies for Google web search — scaled content abuse and doorway abuse: https://developers.google.com/search/docs/essentials/spam-policies
2. Google Search Central, Creating helpful, reliable, people-first content — original value, first-hand experience, Who/How/Why: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
3. Google Search Central, Guidance on generative AI content — automation is allowed when it adds value: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
4. Google Search Central, Guide to optimizing for generative AI features — non-commodity content, images/video, and warning against page-per-query variation: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
5. Google Search Central, Ranking systems guide — helpful content incorporated into core ranking systems: https://developers.google.com/search/docs/appearance/ranking-systems-guide

### Crawling, indexing, and architecture

6. Google Crawling Infrastructure, Crawl budget management — medium/large rapidly changing sites: https://developers.google.com/crawling/docs/crawl-budget
7. Google Search Central, Troubleshoot crawling errors — discovery, serving capacity, crawl efficiency, soft 404s: https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors
8. Google Search Central, Build and submit a sitemap — 50,000 URL/50 MB limit and canonical URLs: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
9. Google Search Central, Ask Google to recrawl URLs — URL Inspection for a few, sitemap for many: https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
10. Google Search Central, Link best practices — crawlable anchors, descriptive text, and internal links: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
11. Google Search Central, Canonicalization — duplicate clustering and canonical selection: https://developers.google.com/search/docs/crawling-indexing/canonicalization
12. Google Crawling Infrastructure, Faceted navigation — infinite URL spaces and slower discovery: https://developers.google.com/crawling/docs/faceted-navigation
13. Google Search Central, URL structure best practices: https://developers.google.com/search/docs/crawling-indexing/url-structure
14. Google Search Central, Pagination and incremental loading — crawlable paginated links: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
15. Google Search Central, JavaScript SEO basics — server/pre-rendering and rendering queue: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
16. Google Search Central, Control content shared with Search — noindex and crawl controls: https://developers.google.com/search/docs/crawling-indexing/control-what-you-share
17. Google Search Central, Robots meta tag specifications: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag

### Search appearance, media, and performance

18. Google Search Central, General structured data guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies
19. Google Search Central, Article structured data: https://developers.google.com/search/docs/appearance/structured-data/article
20. Google Search Central, Breadcrumb structured data: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
21. Google Search Central, Supported structured-data gallery: https://developers.google.com/search/docs/appearance/structured-data/search-gallery
22. Google Search Central, Image SEO best practices — discovery, image sitemaps, `<img src>`, filenames, alt, captions: https://developers.google.com/search/docs/appearance/google-images
23. Google Search Central, Video SEO best practices: https://developers.google.com/search/docs/appearance/video
24. Google Search Central, VideoObject structured data: https://developers.google.com/search/docs/appearance/structured-data/video
25. Google Search Central, Snippet and meta-description guidance — unique and programmatically generated descriptions: https://developers.google.com/search/docs/appearance/snippet
26. Google Search Central, Byline dates: https://developers.google.com/search/docs/appearance/publication-dates
27. Google Search Central, Core Web Vitals — LCP, INP, and CLS targets: https://developers.google.com/search/docs/appearance/core-web-vitals

### Measurement and submission

28. Google Search Console API, Search Analytics query — page/query/country/device measurement: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
29. Google Search Central, Bulk Search Console export to BigQuery — daily large-site data: https://developers.google.com/search/blog/2023/02/bulk-data-export
30. Google Search Central, Using Search Console and Google Analytics together — search versus on-site conversion sources of truth: https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console
31. Google Search Central, Indexing API restriction — JobPosting and livestream BroadcastEvent only: https://developers.google.com/search/apis/indexing-api/v3/using-api
32. Bing Webmaster Tools, IndexNow: https://www.bing.com/webmasters/help/indexnow-0z209wby

### Large-site and product-image evidence

33. Google Search Central, Structured data introduction — Rotten Tomatoes and Food Network scale results: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
34. Google Search Central, Vimeo video SEO case study — scalable video pages and chapters: https://developers.google.com/search/case-studies/vimeo-case-study
35. Google Search Central, MX Player case study — video catalog discovery and 3x Google traffic: https://developers.google.com/search/case-studies/mx-case-study
36. Google Search Central, Saramin case study — canonicals, duplicate cleanup, schema, sign-ups, and conversion: https://developers.google.com/search/case-studies/saramin-case-study
37. Google Merchant Center image requirements — resolution, product framing, and accurate product display: https://support.google.com/merchants/answer/6324350

Additional implementation examples reviewed:

- Zapier integration page: https://zapier.com/apps/connect/integrations
- Wise live exchange-rate page: https://wise.com/us/currency-converter/live-exchange-rates
- Canva product template page: https://www.canva.com/templates/s/product/
- Etsy listing-image requirements: https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop
- Shopify ecommerce photography types: https://www.shopify.com/blog/ecommerce-photography
- Current Airveek site and product positioning: https://airveek.com/

## Evidence labels and dependency status

- **Measured:** numerical outcomes attributed above to Google-published case studies.
- **Calculated:** 200 pages/day = 6,000 per 30-day month and 73,000 per 365-day year; 40 five-page packs/day = 200 pages/day.
- **Recommended:** team design, quality scores, release waves, page mix, sitemap shard size, similarity trigger, and cohort stop rules.
- **Unknown until connected:** search volume, current rankings, Search Console coverage, organic revenue, conversion baseline, and keyword-level demand for each proposed product pack.
- `narrative_canon_id`: unavailable
- `narrative_canon_version`: unavailable
- `claims_projection_offset`: unavailable
- `dependency_status`: approved-fallback for strategy only; no narrative/claims projections exist in the workspace. Any customer-facing performance or sales claim still requires source approval before publication.
