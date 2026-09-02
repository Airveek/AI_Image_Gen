# Airveek

Airveek is an AI-powered creative platform built with Next.js, TypeScript, and Tailwind CSS.

This repository contains the Airveek landing page, Supabase email authentication, Whop checkout and entitlement syncing, protected admin tools, and a task-first AI image creator. The creator currently supports general images, product and fashion photoshoots, and single storybook pages.

## Requirements

- Node.js 24 LTS
- pnpm 10.15.0

## Getting started

```powershell
pnpm install
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001).

If PowerShell blocks the pnpm script shim on Windows, use `pnpm.cmd` for the same commands.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Turbopack development server |
| `pnpm lint` | Run ESLint across the project |
| `pnpm typecheck` | Run TypeScript without emitting files |
| `pnpm build` | Create a production build |
| `pnpm start` | Start the production server after building |
| `pnpm test:e2e` | Run Playwright creator and checkout checks |
| `pnpm test:seo` | Run robots, sitemap, noindex, and public-route smoke checks |
| `pnpm seo:create-brief <brief.json> [--apply]` | Validate or create a research-backed SEO brief and evidence-packet handoff |
| `pnpm seo:review-evidence -- --brief-id <uuid> --reviewer-id <uuid> --rights-evidence-id <id> --source-checksum sha256:<64-hex> [--apply]` | Dry-run-first human approval of a brief's source-asset rights packet |
| `pnpm seo:prepare-briefs --limit 1 [--pack] [--write]` | Prepare deterministic product-pack brief candidates from the researched opportunity graph |
| `pnpm seo:brief-intake -- --dry-run` / `--apply` | Reconcile changed opportunity research into idempotent brief handoffs (apply is kill-switch guarded; never creates pages) |
| `pnpm seo:member -- --list-users` / `pnpm seo:member -- --user-id <uuid> --role <role> --display-name <name> --slug <slug> [--apply]` | Read-only Auth-user lookup (including existing roles) or dry-run-first upsert of an existing account into the SEO content team |
| `pnpm seo:audit-kits [--only ECO01]` | Read-only audit of local recording kits against the SEO evidence contract (optionally bounded to selected opportunities) |
| `pnpm seo:qa-generation <kit>` | Run job-aware human/image QA for one independent listing, lifestyle, or detail kit |
| `pnpm seo:run-queue [--apply]` | Run the resumable, sequential evidence-recording queue (dry-run unless `--apply`) |
| `pnpm seo:local-agent --once --dry-run` | Inspect the local Codex content-agent queue without claiming work |
| `pnpm seo:local-agent --once` | Process one assigned brief into a review-only draft (never publishes) |
| `pnpm seo:start-content` | Keep the attended local Codex content worker polling (requires both kill switches) |
| `pnpm seo:autopilot -- --once --dry-run` | Verify production, then inspect one local content-agent tick without claiming work |
| `pnpm seo:autopilot -- --watch --poll-seconds 300` | Run the attended five-minute supervisor (requires both kill switches; never publishes) |
| `pnpm seo:verify-production` | Read-only check of production schema, scheduler/provider access, Search Console sitemap submission, automation switches, and public discovery endpoints |
| `pnpm seo:ingest-keyword-evidence <packet.json> [--apply]` | Dry-run-first, idempotent ingest of measured or qualitative keyword/community evidence; never creates or publishes pages |
| `pnpm seo:promote-kit <kit> <rights.json> <media-map.json> [--apply]` | Validate and optionally promote reviewed kit media to durable public URLs |
| `pnpm seo:validate-page <draft.json>` | Validate an evidence-backed SEO page draft without publishing it |
| `pnpm seo:ingest-draft <draft.json> [--apply]` | Validate, then atomically create a non-live SEO review record and evidence graph |

The required quality gates are `lint`, `typecheck`, `build`, and the focused Playwright checks.

The SEO control-plane setup and operating sequence are documented in [the SEO autopilot runbook](docs/seo/airveek-seo-autopilot-runbook.md). The `/admin/seo` Operations tab provides bounded assignment, review, and template-rollout controls. It is disabled by default until the Supabase migrations and production provider credentials are verified.

## Project structure

```text
src/
├── app/          # Routes, layouts, metadata, and route-specific UI
├── components/   # Shared UI and layout components, added when needed
├── features/     # Feature-owned components and logic, added when needed
├── hooks/        # Shared React hooks, added when needed
├── lib/          # Shared utilities and server-only integrations
└── types/        # Types shared by multiple features
```

Directories should be introduced with their first real module rather than created as empty placeholders.

## Development conventions

- Use Server Components by default. Add `"use client"` only for browser APIs, effects, event handlers, or interactive state.
- Keep client boundaries close to interactive leaf components.
- Use the `@/*` alias for imports across modules and relative imports within a small feature.
- Keep reusable UI in `src/components/ui` and business functionality in `src/features/<feature-name>`.
- Keep secrets and provider clients in server-only modules under `src/lib/server`.
- Treat future Route Handlers and Server Actions as public endpoints that require validation and authorization.
- Use semantic Tailwind theme utilities rather than repeating raw color values.
- Write complete Tailwind class names; do not construct utility names dynamically.
- Add dependencies only when a concrete product requirement needs them.

## Environment variables

Local `.env` files are ignored by Git. The admin panel requires the Supabase URL and publishable key for the signed-in session, plus the Supabase secret key for server-only Auth Admin operations. `ADMIN_EMAILS` is a comma-separated list of admin email addresses for the prototype guard.

Copy `.env.example` to `.env.local` and fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
ADMIN_EMAILS=admin@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3001 # use https://airveek.com in production
NEXT_PUBLIC_APP_URL=http://localhost:3001 # use https://airveek.com in production
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
DAILY_GENERATION_LIMIT=5
WHOP_API_KEY=
WHOP_COMPANY_ID=
# Keep the existing one-time IDs for legacy lifetime access.
WHOP_COMMERCIAL_PLAN_ID=
WHOP_PREMIUM_PLAN_ID=
# New recurring monthly plans ($49 Commercial / $147 Premium).
WHOP_COMMERCIAL_MONTHLY_PLAN_ID=
WHOP_PREMIUM_MONTHLY_PLAN_ID=
WHOP_WEBHOOK_SECRET=
WHOP_SANDBOX=false
# SEO measurement and publishing (see .env.example for the complete list)
GSC_SITE_URL=sc-domain:airveek.com
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
GA4_PROPERTY_ID=
GA4_MEASUREMENT_PROTOCOL_SECRET=
GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64=
BING_SITE_URL=https://airveek.com
BING_WEBMASTER_API_KEY=
BING_WEBMASTER_STATS_ENDPOINT=https://ssl.bing.com/webmaster/api.svc/json/GetPageStats
INDEXNOW_KEY=
INDEXNOW_KEY_LOCATION=
INDEXNOW_ENDPOINT=https://api.indexnow.org/indexnow
SEO_ATTRIBUTION_SIGNING_SECRET=
SEO_AUTOMATION_ENABLED=false
```

Apply the Supabase migrations in `supabase/migrations` before opening the creator or integration settings. The SEO control plane migrations are the `20260829*` files followed by the ordered `202608300003` through `202608310006` files. Keep SEO automation disabled until the pilot gates pass; the full content workflow is available through `.agents/skills/airveek-seo-content-autopilot/SKILL.md`. The Whop webhook endpoint is:

```text
https://your-domain.example/api/webhooks/whop
```

In Whop, configure the monthly plan IDs as recurring USD plans billed every month at $49 for Commercial and $147 for Premium. Keep the two legacy plan IDs unchanged so earlier lifetime purchases continue to resolve correctly. Configure the webhook URL and subscribe to membership activation/deactivation, payment created/pending/succeeded/failed, and refund created/updated events. For local checkout testing, use an HTTPS tunnel and set `NEXT_PUBLIC_APP_URL` to the tunnel URL. Localhost HTTP is supported only for the local prototype and cannot receive a public Whop webhook.

Provider API keys, Whop keys, and the Google Drive refresh token are server-only values; they do not belong in browser code or committed files.

For the Apindex bulk product image workflow, also configure `APINDEX_STORE_API_URL`, `APINDEX_STORE_API_TOKEN`, `APINDEX_STORE_MEDIA_HOSTS`, `INNGEST_EVENT_KEY`, and `INNGEST_SIGNING_KEY`. Apply `supabase/migrations/202608250003_store_image_runs.sql` before opening `/store-images`.

Never expose `SUPABASE_SECRET_KEY`, R2 credentials, provider keys, or Drive tokens in browser code or commit them to the repository. Configure an R2 lifecycle rule to delete objects under `hot/` after one day.
