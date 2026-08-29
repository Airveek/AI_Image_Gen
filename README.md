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

The required quality gates are `lint`, `typecheck`, `build`, and the focused Playwright checks.

The SEO control-plane setup and operating sequence are documented in [the SEO autopilot runbook](docs/seo/airveek-seo-autopilot-runbook.md). It is disabled by default until the Supabase migrations and production provider credentials are verified.

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
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3001
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
DAILY_GENERATION_LIMIT=5
WHOP_API_KEY=
WHOP_COMPANY_ID=
WHOP_COMMERCIAL_PLAN_ID=
WHOP_PREMIUM_PLAN_ID=
WHOP_WEBHOOK_SECRET=
WHOP_SANDBOX=false
# SEO measurement and publishing (see .env.example for the complete list)
NEXT_PUBLIC_SITE_URL=https://airveek.com
GSC_SITE_URL=sc-domain:airveek.com
GA4_PROPERTY_ID=
GOOGLE_SEO_SERVICE_ACCOUNT_JSON_BASE64=
INDEXNOW_KEY=
INDEXNOW_KEY_LOCATION=
SEO_ATTRIBUTION_SIGNING_SECRET=
SEO_AUTOMATION_ENABLED=false
```

Apply the Supabase migrations in `supabase/migrations` before opening the creator or integration settings. The Whop webhook endpoint is:

```text
https://your-domain.example/api/webhooks/whop
```

Configure that URL in Whop and subscribe to membership activation and deactivation events. For local checkout testing, use an HTTPS tunnel and set `NEXT_PUBLIC_APP_URL` to the tunnel URL. Localhost HTTP is supported only for the local prototype and cannot receive a public Whop webhook.

Provider API keys, Whop keys, and the Google Drive refresh token are server-only values; they do not belong in browser code or committed files.

For the Apindex bulk product image workflow, also configure `APINDEX_STORE_API_URL`, `APINDEX_STORE_API_TOKEN`, `APINDEX_STORE_MEDIA_HOSTS`, `INNGEST_EVENT_KEY`, and `INNGEST_SIGNING_KEY`. Apply `supabase/migrations/202608250003_store_image_runs.sql` before opening `/store-images`.

Never expose `SUPABASE_SECRET_KEY`, R2 credentials, provider keys, or Drive tokens in browser code or commit them to the repository. Configure an R2 lifecycle rule to delete objects under `hot/` after one day.
