# Airveek SEO autopilot runbook

## Status

The repository contains the gated publishing and measurement control plane. It is intentionally off by default until Supabase migrations, credentials, consent language, and the canonical domain are verified.

`SEO_AUTOMATION_ENABLED=true` is necessary but not sufficient. The `seo_automation_config.enabled` database switch must also be true. This gives the team a kill switch that does not require a deploy.

## What happens to an approved page

1. A writer creates a structured page and attaches the exact Airveek generation evidence, source URLs, public media, author, reviewer, and internal-link edges.
2. Automated QA records a score in `seo_quality_runs`. The page must score at least 85 and have no blocker.
3. The publish worker reads at most 50 approved/scheduled pages every 15 minutes and enforces the database daily limit (200 by default, i.e. four 50-page waves). New templates remain human-review gated. A template can be marked `proven` only after 50 reviewed pages and 14 healthy days.
4. The publish gate rechecks independent listing/lifestyle/detail runs, approved media rights, source evidence, canonical state, author/reviewer, workflow completeness, and at least two inbound plus four outbound links.
5. A passing page becomes `live`, `noindex=false`, and receives a `seo_url_state` row. The page, parent hubs, and sitemap are revalidated.
6. `/sitemap.xml` and family/month shards include only live, canonical, indexable pages. Failed pages never enter a sitemap.
7. An `seo/page.published` event queues IndexNow when `INDEXNOW_KEY` and `INDEXNOW_KEY_LOCATION` are configured.
8. The crawler checks HTTP status, canonical, robots directives, title, H1 count, schema types, content hash, and link health. Issues are retained as crawl snapshots and alerts.
9. Daily GSC and GA4 imports upsert by date and dimensions. The admin dashboard reads aggregate SQL/RPC results, not unbounded raw rows.

## How a 200-page day works

The scheduler does not blindly publish 200 generated pages. It processes up to four 50-page waves from an approved buffer. A page is eligible only when its product/use-case intent is distinct and its evidence is complete. If a wave has 17 failures, those 17 stay out of the sitemap and the buffer supplies replacements after review.

## Required production setup

1. Apply `supabase/migrations/202608290001_seo_content_platform.sql` and `202608290002_seo_measurement_control_plane.sql`.
2. Set `NEXT_PUBLIC_SITE_URL=https://airveek.com` and configure the DNS/hosting redirects for HTTPS and `www`.
3. Create content members and assign publisher/SEO-admin roles. Keep the first 50 pages of each template in `editor_review` before changing the rollout row to `proven`.
4. Configure the service-account, GSC, GA4, Bing/IndexNow, alert, and signing-secret variables from `.env.example`.
5. Set the database automation row to enabled only after a pilot wave passes the route, sitemap, crawl, attribution, and rollback checks.
6. Register `/api/inngest` with Inngest and monitor `/admin/seo`.

## Safe pause conditions

Set either `SEO_AUTOMATION_ENABLED=false` or `seo_automation_config.enabled=false` to stop source sync, crawl, and publish workers. Human-approved content remains in the database; no destructive redirect, merge, prune, canonical, or noindex change is automated.
