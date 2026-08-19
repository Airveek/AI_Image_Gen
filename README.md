# Artistly

Artistly is an AI-powered creative platform built with Next.js, TypeScript, and Tailwind CSS.

This repository currently contains the frontend foundation only. AI providers, authentication, persistence, billing, and deployment-specific services will be added when their requirements are defined.

## Requirements

- Node.js 24 LTS
- pnpm 10.15.0

## Getting started

```powershell
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

If PowerShell blocks the pnpm script shim on Windows, use `pnpm.cmd` for the same commands.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Turbopack development server |
| `pnpm lint` | Run ESLint across the project |
| `pnpm typecheck` | Run TypeScript without emitting files |
| `pnpm build` | Create a production build |
| `pnpm start` | Start the production server after building |

The required quality gates are `lint`, `typecheck`, and `build`. Automated tests and test dependencies are intentionally not included at this stage.

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

Local `.env` files are ignored by Git. Only variables that are intentionally safe for the browser may use the `NEXT_PUBLIC_` prefix. Add a documented `.env.example` when the project receives its first environment variable.
