# Airveek Whop creator-growth blueprint v1

Research date: 2026-08-27  
Independent web-search pass: 40 targeted searches  
Specialist reviews: 5 domain experts

## Decision

Use two connected rails:

1. **Whop Content Rewards / UGC** for approved original product demonstrations and distribution.
2. **Affiliate attribution** for confirmed customers and retained customers.

Do not call the first campaign “clipping.” Whop describes clipping as turning existing long-form material into short clips. Airveek currently has products and product assets, not a licensed long-form source library, so the correct first campaign is original UGC/product-demo content. Use true clipping later, after Airveek has a permissioned long-form library and timestamped source clips.

The target of 10,000 customers in 30 days is a stretch objective, not a forecast. The first objective is to prove that a qualified creator can produce attributable, compliant customers at positive contribution margin.

## What the campaign must reward

Pay for two different outcomes separately:

- **View reward:** $2.50 per 1,000 legitimate approved views, subject to a campaign cap and Whop verification.
- **Sales commission:** a separate affiliate commission for confirmed, attributable purchases that survive the refund/fraud hold.

Do not make view payment conditional on a sale. That conflicts with the purpose of a view-reward rail and can create unfair, unclear campaign terms. Pay compliant approved views under the published rules; use affiliate commission to reward revenue.

Whop Content Rewards supports campaign content type, platforms, rate, total budget, minimum and maximum payouts, assets, and requirements. Its terms exclude bots, scripts, macros, artificial or fraudulent views, and inappropriate methods; they also state a 10% Content Reward Fee and give Whop discretion over transfers. Verify the live dashboard fee before funding a campaign.

Primary references: [Whop Content Rewards setup](https://docs.whop.com/memberships-and-access/third-party-apps/content-rewards), [Whop Content Rewards terms](https://whop.com/content-rewards-terms-of-service/), [Whop setup guide](https://whop.com/blog/set-up-content-rewards/), and [Whop affiliate guide](https://docs.whop.com/developer/guides/affiliates).

## Campaign A: original UGC/product-demo pilot

Every submitted video must:

- show a real Airveek product workflow or clearly permissioned Airveek asset;
- open with a visible result or a specific buyer problem;
- explain one practical decision in plain English;
- show the input, the action, and the output—not only a claim;
- use original narration, analysis, or demonstration;
- make truthful claims and avoid invented speed, features, savings, or results;
- include a clear spoken/on-screen disclosure such as “Sponsored by Airveek. I may earn a commission if you purchase through my link,” plus the platform’s native disclosure control;
- include a working mobile destination and the creator’s assigned tracking link;
- contain no bought views, engagement pods, bots, duplicate submissions, third-party watermark, impersonation, or fake testimonial.

Suggested brief: **proof → buyer question → real workflow → inspect the result → one useful lesson → one CTA**. Give creators beats and guardrails rather than a word-for-word script so the delivery stays natural.

Suggested starting timing for a short demo (test ranges, not universal benchmarks):

- 0–1s: show the result or the mistake;
- 1–3s: state who has the problem;
- 3–6s: give the viewer a simple scorecard;
- 6–18s: perform the workflow;
- 18–28s: reveal the result and explain one quality check;
- final 3–5s: one action only.

Use the same idea for long-form, but add chapters, comparison, failure cases, and a full before/after proof. YouTube requires original/authentic value and rejects mass-produced or minimally transformed reused content; TikTok and Meta similarly distinguish recommendation eligibility from merely remaining live.

References: [YouTube reused content](https://support.google.com/youtube/answer/1311392?hl=en-EN), [YouTube Shorts policies](https://support.google.com/youtube/answer/12504220?hl=en), [TikTok integrity and authenticity](https://www.tiktok.com/community-guidelines/en/integrity-authenticity/), [TikTok commercial disclosure](https://support.tiktok.com/en/business-and-creator/creator-and-business-accounts/promoting-a-brand-product-or-service), and [Meta original-content guidance](https://about.fb.com/news/2026/03/rewarding-original-creators-on-facebook/amp/).

## Campaign B: true clipping, later

Only launch this after Airveek owns or has permission to use the source recording. Store the source URL/file, permission, allowed platforms, expiration, creator credit, exact in/out timestamps, and the minimum transformation required. A clip must add meaningful context, not just subtitles, a crop, or a watermark removal.

## Acceptance and rejection gate

Approve only when rights, originality, disclosure, product accuracy, link tracking, and legitimate traffic all pass. Reject when the post is copied, mass-produced, misleading, undisclosed, off-brief, impossible to attribute, or driven by artificial traffic. Never condition payment on positive sentiment or a fabricated testimonial; the [FTC fake-review rule](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials) is directly relevant.

## Tracking and payout design

Give each creator a redirect and a link with stable campaign metadata:

`/go/{creator_slug}?utm_source=tiktok&utm_medium=creator&utm_campaign=airveek_ugc_pilot&utm_id={campaign_id}&utm_content={creative_id}&creator_id={creator_id}`

Persist the click server-side and record: order ID, creator ID, creative ID, click ID, coupon, first/last touch, plan, gross revenue, discount, tax, processor fee, refund, chargeback status, activation status, and payout status. Do not put personally identifiable information in UTM values. Use the [GA4 URL-builder guidance](https://support.google.com/analytics/answer/10917952?hl=en) and [GA4 ecommerce events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

Recommended state machine:

`pending → refund_hold → fraud_review → approved → paid`

Use the last eligible creator click within 30 days for creator credit, preserve first-touch acquisition for analysis, and use a coupon as a fallback—not as a second commission. Never double-pay a purchase.

The real funnel is:

`approved view → attributable visit → checkout → confirmed purchase → first successful generation → saved/downloaded within 24h → no refund after 30 days`

The primary metric is retained customers plus contribution margin. Views and clicks are diagnostics, not the business result. On YouTube, use “chose to view” versus “swiped away” as a creative diagnostic; on every platform, compare retention and activation by creative angle.

## Unit economics and the 10,000-customer goal

Use these formulas:

```text
qualified_views = reported_views × (1 - invalid_view_rate)
view_payout = min(campaign_cap, qualified_views × 0.0025)
paid_customers = qualified_views × view_to_click_rate × click_to_paid_rate
retained_customers = paid_customers × (1 - refund_rate)
creator_CAC = (view_payout + fixed_ops_cost + affiliate_commission) / retained_customers
```

Illustrative planning case only: 100,000 reported views, 10% invalid, 0.75% click-through, 5% click-to-paid, and 15% refunds gives 90,000 qualified views, $225 view payout, and about 26 retained customers before fixed costs and sales commission. These are planning assumptions, not market benchmarks.

At a 1% view-to-click rate and 5% click-to-paid rate, 10,000 paid customers requires roughly 20 million qualified views and about $50,000 in view rewards at $2.50/1,000. At 2% click-to-paid, it still requires roughly 50 million qualified views. Therefore $500 cannot responsibly fund a guaranteed 10,000-customer campaign.

## Safe $500 pilot allocation

- $100: first Whop payout tranche;
- $10: conservative 10% Content Reward Fee reserve, subject to live confirmation;
- $50: tracking, QA, creator operations, and support;
- $100: refund, dispute, and fraud reserve;
- $240: uncommitted buffer.

Release another tranche only after view reconciliation, click reconciliation, customer activation, refunds, and contribution margin are visible. Keep the initial per-creator cap at $25 and the first campaign tranche at $100. This buys learning without exposing the full runway.

## 30-day operating plan

**Days 1–3:** lock the offer, checkout, activation event, `/go/{creator}` redirect, affiliate ledger, refund hold, disclosure copy, claims list, and takedown process.

**Days 4–7:** produce the gold-standard Airveek demo brief, product asset pack, five tested angles, rejection checklist, and creator onboarding page.

**Days 8–14:** launch the $100 pilot with 10–25 creators; manually review each creator’s first two posts; track qualified views, visits, checkouts, purchases, activations, refunds, and complaints daily.

**Days 15–21:** keep only winning angles, test one variable at a time, and release the next tranche only if observed CAC and contribution margin pass the gate.

**Days 22–30:** calculate the actual views, creators, cash, and time required for scale. Set the next target from observed data, not from a viral assumption.

## Airveek implementation order

The existing project already contains the 20-category opportunity graph, product-image quality gates, content briefs, real-workflow recording/timeline work, and four current candidates. The next implementation layer is not another generic writing skill. It is:

1. creator campaign/brief and claim registry;
2. `/go/{creator}` redirect plus UTM persistence;
3. purchase, activation, refund, and payout ledgers;
4. Whop submission import/reconciliation;
5. automated acceptance gate with manual review fallback;
6. creative-learning ledger that feeds the next topic, hook, script, and edit brief.

This should remain one Airveek content-growth system with separate modules, not a disconnected project. A separate service can be added later for queues or analytics, but it must consume the same opportunity graph, claim registry, creator IDs, and experiment IDs.

## Hard boundaries

No bought traffic, fake engagement, undisclosed paid content, copied clips, invented testimonials, guaranteed virality, guaranteed income, or unverified product claims. “Approved” must mean compliant and attributable; “paid” must mean reconciled and past the refund/fraud hold.

