# Airveek Design System

This document records the rebranded Airveek landing-page system in this Next.js codebase. Airveek is a black-first AI creative suite with a lime signal, compact display typography, and direct-response content hierarchy.

## Design direction

Airveek should feel like motion captured in a precise technical system: black canvases, restrained green glow, sharp contrast, and calm neutral copy. The logo’s airflow mark supplies the distinctive visual language; UI decoration should support it rather than compete with it.

The rendered page follows this order:

1. High-contrast offer bar
2. Airveek wordmark and navigation
3. Outcome-led hero statement
4. Product proof and workflow
5. Trust, use cases, and feature suite
6. One-time pricing and guarantee
7. FAQ and final conversion path

## Typography

| Role | Family | Typical treatment |
| --- | --- | --- |
| Body and utility copy | Inter | 16px base, relaxed line height, 400–700 |
| Display headings | K2D | Bold, compact, strong hierarchy |
| Promo and labels | Inter | Semibold/black, small uppercase tracking where appropriate |

Typography is unchanged from the previous site so the rebrand is carried by the name, mark, palette, and visual signal rather than a disruptive type change.

## Color tokens

| Token | Value | Usage |
| --- | --- | --- |
| `brand-neon` | `#83FF00` | Primary signal, CTA highlight, focus, active states |
| `brand-green` | `#2AC414` | Gradient anchor and supporting action color |
| `brand-white` | `#FDFDFD` | Headings and primary copy |
| `brand-soft` | `#D9FFB8` | Secondary emphasis on dark surfaces |
| `brand-gray` | `#6F6F6F` | Metadata and legal copy |
| `brand-dark-gray` | `#3A3A3A` | Neutral structural reference |
| `brand-black` | `#040404` | Page background and dark CTA text |
| `brand-panel` | `#0B120B` | Cards and product proof surfaces |
| `brand-panel-raised` | `#111A11` | Elevated cards and expanded FAQ state |

Signature gradient: `linear-gradient(100deg, #2AC414, #83FF00 48%, #2AC414)`. Keep gradients directional and scarce. Do not introduce purple, pink, cyan, amber, or blue into the branded UI.

## Logo assets

- `/public/images/airveek/logo.png` — transparent full wordmark for header and footer.
- `/public/images/airveek/mark.png` — transparent airflow symbol for compact placements and future favicon work.
- The source image’s black background has been removed and the asset has been tightly cropped. Do not re-add a background rectangle or apply a hue filter.

## Components

- Primary buttons use the green gradient, black text, visible hover lift, and green focus ring.
- Secondary buttons use transparent black with a low-opacity green border.
- Cards use near-black surfaces and subtle borders; green is reserved for interaction and signal.
- FAQ rows retain keyboard operation and explicit `aria-expanded` state.
- Images use `next/image` with descriptive alt text and stable dimensions.

## Responsive and accessibility standards

- Maintain 16px minimum mobile gutters and avoid horizontal overflow.
- Preserve a single semantic `h1` and logical heading order.
- Keep focus states visible and touch targets at least 44px where practical.
- Maintain readable contrast; neon green is not used as the only indicator of meaning.
- Respect `prefers-reduced-motion` for all non-essential effects.

## Runtime source

Production tokens live in `src/app/globals.css`. The composed landing page is split across `src/components/airveek/`. The identity source of truth is `docs/brand-guidelines.md`.
