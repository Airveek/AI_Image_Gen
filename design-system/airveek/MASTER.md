# Airveek Design System

> Global source of truth for the Airveek website and application. Page-specific guidance lives in `design-system/airveek/pages/`.

**Project:** Airveek  
**Updated:** 2026-09-01
**Category:** AI creative generation suite  
**Direction:** Premium, light-first, green-led, minimal

## Brand signal

The Airveek mark combines airflow lines with a circular motion system. Use the Ink wordmark on light surfaces and the white wordmark on dark surfaces. The reusable `AirveekLogo` component makes this switch automatically.

## Named primitives

| Role | Hex | CSS variable |
| --- | --- | --- |
| Airveek Canvas | `#FFFFFF` | `--airveek-canvas` |
| Mint Mist | `#F5F7F3` | `--mint-mist` |
| Raised Mint | `#EEF3EB` | `--raised-mint` |
| Leaf Line | `#DDE6D9` | `--leaf-line` |
| Airveek Ink | `#0D120D` | `--airveek-ink` |
| Forest Gray | `#52604F` | `--forest-gray` |
| Night Canvas | `#040404` | `--night-canvas` |
| Forest Panel | `#0B120B` | `--forest-panel` |
| Raised Forest | `#111A11` | `--raised-forest` |
| Night Line | `#2A342A` | `--night-line` |
| Snow | `#FDFDFD` | `--snow` |
| Sage Copy | `#A4B19E` | `--sage-copy` |
| Deep Forest | `#064E3B` | `--deep-forest` |
| Airveek Emerald | `#087A43` | `--airveek-emerald` |
| Clear Green | `#10863F` | `--clear-green` |
| Growth Green | `#2AC414` | `--growth-green` |
| Energy Lime | `#83FF00` | `--energy-lime` |
| Lime Mist | `#E6FFD0` | `--lime-mist` |

Use semantic surface, text, border, input, focus, state, and control tokens in components. Primitive greens remain stable while their semantic role changes between themes. Signature gradients are fixed brand treatments.

## Typography

- **Display:** K2D, existing loaded family, bold and compact for headings and pricing.
- **Body:** Inter, existing loaded family, readable at 16px with relaxed line height.
- **Labels:** Inter uppercase, small, and letter-spaced; reserve neon for meaningful cues.

## Components

- **Primary CTA:** semantic primary background and foreground, minimum 44px touch height.
- **Inverse CTA:** white with Ink text, only on the signature gradient.
- **Cards:** semantic surface and border with restrained shadows in light mode.
- **Focus:** semantic focus outline; never suppress focus indication.
- **Logo:** `/public/images/airveek/logo-ink.png` in light mode and `/public/images/airveek/logo.png` in dark mode.

## Layout and behavior

- Use light as the default and preserve the browser-local theme selection.
- Use responsive container widths and retain at least 16px horizontal gutter on small screens.
- Keep hover transitions between 150–300ms and respect `prefers-reduced-motion`.
- Never rely on color alone for status, trust, pricing, or form feedback.
- Maintain one semantic `h1`, descriptive image alternatives, and keyboard-operable FAQ controls.

## Runtime source

The runtime tokens live in `src/app/globals.css`. The composed page lives in `src/components/airveek/` and uses `next/image` for branded raster assets.
