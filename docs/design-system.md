# Artistly Design System

This document captures the visual system observed on the live Artistly sales page and defines how to reproduce it consistently in this Next.js codebase. The source was inspected with Playwright on August 19, 2026 at desktop (`1440 × 1000`) and mobile (`390 × 844`) viewports. Measurements combine computed styles, rendered bounding boxes, source CSS, and visual screenshots.

## Design direction

Artistly uses an energetic direct-response visual language: very dark navy canvases, oversized rounded display type, vivid cyan-to-blue and pink-to-gold gradients, and dark elevated cards. The hierarchy is intentionally theatrical:

1. High-contrast promotional announcement
2. Centered brand mark
3. Compact gradient eyebrow
4. Oversized outcome-led headline
5. Gradient commercial-use statement
6. Video proof
7. Price and CTA
8. Payment, review, and rating reassurance

The source header does not contain a conventional navigation menu. Do not add one unless product requirements change; it would alter the original hierarchy.

## Typography

| Role | Family | Typical size / line height | Weight |
| --- | --- | --- | --- |
| Body and utility copy | Inter | `16 / 24` | 400–700 |
| Promo bar | Inter | `18 / 27`; mobile `16 / 24` | 700 |
| Eyebrow | Inter | `26 / 31.2`; mobile `16 / 19.2` | 900; mobile 700 |
| Hero display | K2D | `64 / 76.8`; mobile `24 / 28.8` | 800 |
| CTA display | K2D | `35 / 52.5`; mobile `19 / 28.5` | 800 |
| Card headings | K2D | `20 / 26` to `34 / 40.8` | 500–800 |
| Secondary/footer support | Outfit | `16 / 24` typical | 400–600 |

K2D provides the distinctive soft, technological display voice. Inter handles high-density supporting text. The current Header/Hero implementation only loads fonts it renders: Inter and K2D. Outfit should be introduced when later sections that use it are built.

## Color tokens

| Token | Value | Usage |
| --- | --- | --- |
| `ink` | `#040d30` | Page background |
| `ink-deep` | `#020825` | Deep hero fallback |
| `surface` | `#1e1f39` | Video backing, badges, rating cards |
| `surface-raised` | `#252245` | Alternate dark cards |
| `text` | `#ffffff` | Primary text |
| `text-muted` | `#b3b6d3` | Supporting copy |
| `yellow` | `#fff254` | Promotion and stars |
| `cyan` | `#0dcbff` | Gradient start and positive accents |
| `blue` | `#4760ff` | Eyebrow gradient end |
| `pink` | `#e065fe` | Decorative gradients |
| `coral` | `#f34491` | Video borders and subtitle gradient |
| `orange` | `#fcc257` | Gradient end |

### Signature gradients

- Promo: `linear-gradient(71deg, #c7208f 0%, #6a14d1 100%)`
- Eyebrow: `linear-gradient(115deg, #0dcbff 0%, #4760ff 100%)`
- Hero statement: pink through coral to gold
- Price emphasis: `#f28e27` to `#fd644f`
- Secondary purple action: `#9929ea` to `#5808fb`

Use gradients as focal accents rather than general decoration. White provides the main reading contrast.

## Spacing and sizing

The page primarily uses an informal 5px-derived rhythm. Common values are `5`, `10`, `12`, `15`, `20`, `24`, `25`, `30`, `35`, `40`, `50`, `60`, `80`, `100`, `150`, and `200px`.

Key layout widths:

| Container | Maximum width |
| --- | --- |
| Page content | `1320px` |
| Trust badges | `1250px` |
| Hero title | `1150px` |
| Rating grid | `1000px` |
| Video | `760px` |

Rules:

- Center primary sales content.
- Preserve a minimum `12px` viewport gutter on the hero at narrow widths.
- Use large vertical separation (`60–200px`) between major narrative sections.
- Keep local component spacing tighter (`10–30px`).
- Favor full-width statements and CTA surfaces to reinforce the sales-page rhythm.

## Shape, borders, and elevation

- Utility and trust cards: `10px` radius.
- Standard content cards: `20px` radius.
- Feature cards: `25px` radius.
- Eyebrows and compact controls: full pill radius.
- Feature label shape: `0 40px 40px 0` with a `4px` white leading bar.
- Video: dark backing with `5px` coral side borders and angled top/bottom caps.
- Framed hero statement: 2px pink-to-gold border plus 10px corner dots.
- FAQ cards: `2px dashed #00c0fa`, `10px` radius.

Observed elevation is atmospheric rather than physical:

- Coral glow: `0 0 45px rgb(251 105 73 / 40%)`
- Purple glow: `0 0 20px rgb(130 24 212 / 50%)`
- Dark cards generally rely on surface contrast without a conventional drop shadow.

## Component patterns

### Promotional bar

Two centered lines on a magenta-to-purple field. Yellow copy is bold; the first line is underlined. Desktop height is approximately `74px`; mobile height is `64px`.

### Header

The live landing page uses a centered `236 × 52px` logo with `50px` top and `20px` bottom spacing. There is no navigation, search, or account action in this sales-page context.

### Hero eyebrow

A cyan-to-blue pill, heavy white Inter text, and decorative gold rays on desktop. Rays disappear below tablet width to prevent collision.

### Display statements

The main outcome is white K2D at `64px / 1.2`. The secondary commercial-use statement uses the same scale inside a full-width gradient frame, with gradient-filled text. At `425px` and below both reduce to `24px`.

### Primary CTA

The CTA uses the supplied Artistly background artwork, centered white K2D, and a subtle text shadow. Hover brightens and lifts by `2px`; focus receives a visible yellow outline. The original artwork determines the shape, so it should not be replaced with a generic rounded rectangle.

### Trust surfaces

Review badges sit in six dark cards on desktop, three on tablet, and two on mobile. Rating cards use a four-column desktop grid and two-column mobile grid. Both share `#1e1f39` and `10px` corners.

### Feature cards

Later product features use `#1e1f39`, `25px` radius, `50px` padding, and `60px` separation. Feature headings are `34px` K2D with an orange-to-coral gradient.

### FAQ cards

FAQ rows use `#0d1d3d`, a cyan dashed border, purple ambient glow, and `24px` K2D labels. Preserve clear expanded/collapsed states and keyboard operation when implemented.

## Responsive behavior

The live CSS contains many art-direction breakpoints. Consolidate new components around these core bands while preserving measured behavior:

| Breakpoint | Behavior |
| --- | --- |
| `≤ 1399px` | Reduce large card padding and display scale where necessary |
| `≤ 1199px` | Collapse wide multi-column compositions |
| `≤ 991px` | Trust badges become three columns |
| `≤ 767px` | Display type becomes `40px`; eyebrow rays disappear |
| `≤ 575px` | Promo height and copy reduce; trust badges become two columns |
| `≤ 425px` | Hero display becomes `24px`; eyebrow `16px`; video `348 × 190px`; CTA `19px` |
| `≤ 375px` | Promo copy becomes `14px` |

Use content-driven sizing between these breakpoints. Avoid reproducing every one-off source breakpoint unless visual comparison demonstrates a need.

## Accessibility and implementation standards

- Use a single semantic `h1`; retain logical heading order.
- Supply descriptive image alternatives and an iframe title.
- Keep keyboard focus visible. The source site removes some outlines; this implementation deliberately corrects that accessibility issue while matching the visual system.
- Honor `prefers-reduced-motion`.
- Keep decorative ray and frame treatments in CSS pseudo-elements so they are ignored by assistive technology.
- Store stable branded assets locally to avoid third-party CDN layout shifts.
- Use `next/image` for raster and SVG assets and `next/font` for deterministic font loading.
- Keep content/data arrays separate from markup so additional trust signals can be added without duplicating component structure.

## Implemented token source

Production tokens and component rules live in `src/app/globals.css`. The composed page is split across:

- `src/components/artistly/promo-bar.tsx`
- `src/components/artistly/site-header.tsx`
- `src/components/artistly/hero-section.tsx`

This documentation is the design reference; the CSS custom properties are the runtime source of truth.
