# Meta fashion funnel rollout

The `/ai-fashion-photoshoot` acquisition funnel and `/playground/fashion-photoshoot` workflow are consent-gated. Deploy the database migration before the application build so credit reservation, checkout attempts, funnel events, and the CAPI outbox exist when traffic arrives.

## Required configuration

- `NEXT_PUBLIC_META_PIXEL_ID`: browser Pixel ID.
- `META_PIXEL_ID`: server Pixel ID; normally the same value.
- `META_CAPI_ACCESS_TOKEN`: server-only Conversions API token.
- `META_GRAPH_VERSION`: explicit version such as `v23.0`.
- `META_TEST_EVENT_CODE`: optional during Meta Test Events validation; remove it for live delivery.
- Existing Supabase, Inngest, Stripe, Whop, storage, and creator-provider variables remain required.

Never expose or log the CAPI token. The browser receives only the public Pixel ID. The existing `airveek_analytics_consent` cookie controls GA, Vercel Analytics, Meta Pixel, internal funnel writes, and CAPI delivery.

## Event contract

| Delivery | Events |
| --- | --- |
| Pixel + CAPI | `ViewContent`, `CompleteRegistration`, `GenerationSucceeded`, `PaywallView`, `InitiateCheckout` |
| CAPI only | `Purchase` |
| Browser/internal diagnostics | `PageView`, `LandingPageCTA`, `PlaygroundView`, `GenerationIntent`, `ProductImageUploaded`, `ModelReferenceUploaded`, `FashionShootConfigured`, `GenerationStarted`, `FreeGenerationUsed`, `PricingView`, `LifetimeOfferClick` |

Browser/server pairs share one UUID `event_id`. The strict analytics endpoint rejects non-allowlisted names, unknown or altered properties, and cross-origin source URLs. Image data, filenames, prompts, image URLs, and biometric details are not accepted properties.

## Launch sequence

1. Apply `supabase/migrations/202609060001_meta_fashion_funnel.sql` and run Supabase database lint against the deployed schema.
2. Confirm Admin → Integrations is set to Stripe + one-time for the launch offer. Each checkout attempt snapshots provider, mode, plan, amount, consent, and attribution; later admin changes apply only to new attempts.
3. Configure Meta variables with `META_TEST_EVENT_CODE`, start Inngest, and verify Pixel/CAPI event-ID deduplication in Meta Test Events.
4. Complete Stripe and Whop sandbox purchases. Confirm no `Purchase` occurs from success/cancel URLs and exactly one occurs after verified payment plus active entitlement.
5. Remove `META_TEST_EVENT_CODE`, deploy production variables, and monitor the campaign funnel in Admin → Insights.

The landing page intentionally omits customer testimonials and logo proof until rights-cleared, approved evidence is supplied. Existing Airveek product visuals and the existing short walkthrough are the only media currently used.
