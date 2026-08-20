# Airveek Design System

> Global source of truth for the Airveek landing page. Page-specific overrides live in `design-system/airveek/pages/`.

**Project:** Airveek  
**Updated:** 2026-08-19  
**Category:** AI creative generation suite  
**Direction:** Focused, technical, high-energy, minimal

## Brand signal

The Airveek mark combines airflow lines with a circular motion system. Use the supplied transparent wordmark on dark surfaces. The green symbol is the active signal; the white wordmark is the stable anchor. Never place the wordmark inside a competing color block or apply the old logo hue filter.

## Color tokens

| Role | Hex | CSS variable |
| --- | --- | --- |
| Brand neon | `#83FF00` | `--brand-neon` |
| Brand green | `#2AC414` | `--brand-green` |
| White | `#FDFDFD` | `--brand-white` |
| Soft white | `#D9FFB8` | `--brand-soft` |
| Grey | `#6F6F6F` | `--brand-gray` |
| Dark grey | `#3A3A3A` | `--brand-dark-gray` |
| Black | `#040404` | `--brand-black` |
| Panel | `#0B120B` | `--brand-panel` |
| Raised panel | `#111A11` | `--brand-panel-raised` |

Use neon green for primary actions, active states, focus, and compact emphasis. Keep large surfaces black or near-black. Do not add purple, pink, cyan, amber, or blue to the branded UI.

## Typography

- **Display:** K2D, existing loaded family, bold and compact for headings and pricing.
- **Body:** Inter, existing loaded family, readable at 16px with relaxed line height.
- **Labels:** Inter uppercase, small, and letter-spaced; reserve neon for meaningful cues.

## Components

- **Primary CTA:** `#2AC414 → #83FF00 → #2AC414`, black text, green ambient shadow, minimum 44px touch height.
- **Secondary CTA:** transparent black surface, low-opacity green border, white text, green hover state.
- **Cards:** `#0B120B` or `#111A11`, subtle neutral border, green border on hover.
- **Focus:** 3px `#83FF00` outline with 4px offset; never suppress focus indication.
- **Logo:** `/public/images/airveek/logo.png` for the wordmark and `/public/images/airveek/mark.png` for compact placements. Current display sizes are `200px` mobile / `247px` desktop in the header and `234px` in the footer.

## Layout and behavior

- Preserve the existing narrative landing-page order and conversion path.
- Use responsive container widths and retain at least 16px horizontal gutter on small screens.
- Keep hover transitions between 150–300ms and respect `prefers-reduced-motion`.
- Never rely on color alone for status, trust, pricing, or form feedback.
- Maintain one semantic `h1`, descriptive image alternatives, and keyboard-operable FAQ controls.

## Runtime source

The runtime tokens live in `src/app/globals.css`. The composed page lives in `src/components/airveek/` and uses `next/image` for branded raster assets.
