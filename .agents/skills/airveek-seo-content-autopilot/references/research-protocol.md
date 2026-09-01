# Airveek research protocol

Use this protocol before adding a new product-photo pillar or before expanding a
cluster into a materially different buyer task. The research packet is part of
the page's evidence, not a keyword list.

## Search matrix

For a new pillar, complete at least 30 targeted searches and save each result
as a row with `query`, `sourceUrl`, `sourceTitle`, `accessedAt`, `signal`,
`claimSupported`, `useCaseRelevance`, `rightsStatus`, `confidence`, and a
`metricLabel`. Cover all six lenses:

| Lens | Minimum searches | What to learn |
| --- | ---: | --- |
| Search intent | 5 | Direct wording of the task, modifiers, and SERP formats |
| First-party/platform rules | 5 | Marketplace, merchant, social, and accessibility constraints |
| Product demand | 5 | Product questions, objections, dimensions, materials, and buying risk |
| Real audience language | 5 | Reddit, YouTube comments, public social discussions, support questions, and creator forums |
| Visual/result research | 5 | What leading examples show, omit, or get wrong |
| Airveek feasibility | 5 | Whether Airveek can reproduce the workflow with a real run |

For an already researched cluster, run 8–12 fresh searches across the same
lenses and query GSC, GA4/BigQuery, and Bing before selecting a new page.

## Evidence rules

1. Prefer primary sources for rules: Google Search Central, Google Merchant
   Center, Amazon Seller Central, Bing Webmaster, W3C, and the relevant platform
   documentation.
2. Use marketplaces, Pinterest, YouTube, Reddit, public social discussions,
   and competitor pages for observed patterns or audience language, never as
   proof that Airveek owns an image or that a product has a particular
   specification. For each page with FAQs, capture at least three recurring
   questions when available, including one from a discussion source (for
   example a Reddit thread, a public YouTube comment, or a public creator
   forum). Treat those questions as qualitative research: paraphrase them,
   cite the source URL and access date in the evidence packet, and never copy a
   user's personal details or imply that the commenter endorses Airveek.
3. Record a URL and access date for every externally sourced claim. Claims that
   expire (policy, limits, pricing, or platform UI) receive a review date.
4. Label every number as `Measured`, `User-provided`, `Calculated`, `Estimated`,
   or `Proxy`. A search-volume estimate is not a forecast of traffic.
5. Reject an opportunity when the searcher job cannot be stated in one sentence,
   the page would only swap an adjective/synonym/year/platform, evidence cannot
   be obtained lawfully, or Airveek cannot demonstrate the workflow.

## Opportunity record

The selected opportunity must include:

```json
{
  "intentKey": "mobile-phone-holder/listing/marketplace-clean-image",
  "productEntity": "mobile-phone-holder",
  "buyerQuestion": "How do I create a marketplace-safe clean image for this holder?",
  "pageFamily": "listing",
  "primaryQuery": "mobile phone holder product image",
  "sources": [],
  "sourceEvidence": [],
  "rightsStatus": "approved",
  "airveekFit": "A real listing generation and QA run exists",
  "metricLabels": { "demand": "Proxy", "clicks": "Measured" },
  "distinctionFromExistingPages": "Different output constraints and buyer decision"
}
```

Before assigning a writer, check the existing `seo_pages` intent index and the
opportunity graph. Similarity >= 0.92 is a hard stop; 0.85–0.92 goes to merge
review with an editor-written distinction. Do not assign a writer simply because
a keyword tool returned a variation.

## Research deliverable

Save a versioned evidence packet next to the brief. It must include the search
matrix, the opportunity score (demand 30%, commercial intent 20%, Airveek fit
15%, visual utility 15%, result weakness 10%, source/generation feasibility
10%), selected page unit, rejected alternatives, rights decision, and an expiry
or refresh date. Link the packet from the draft and quality run.

The policy context for this protocol is documented in the [Airveek programmatic
SEO and content-factory playbook](../../../docs/research/airveek-programmatic-seo-and-content-factory-playbook-v1.md),
[Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies),
[Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content),
and [Google's AI-search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
