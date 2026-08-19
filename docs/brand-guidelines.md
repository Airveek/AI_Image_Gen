# Artistly Green Signal Brand Guidelines

## Brand direction

Artistly now uses a black-first visual identity built around one high-energy green signal. The system should feel focused, technical, confident, and minimal: dark surfaces create depth, neon green indicates action and progress, and neutral text keeps the page readable.

The supplied reference is the source for the palette. The original Artistly typography is intentionally preserved: Inter for body copy and K2D for display headings.

## Color palette

### Primary

- Branding green: `#83FF00` — primary CTA, active states, success, focus, badges, and key emphasis.
- Secondary green: `#2AC414` — gradient anchor, secondary action, and supporting visual energy.

### Secondary

- Green glow: `rgba(131, 255, 0, 0.20)` — restrained ambient glow around hero and featured surfaces.
- Green wash: `rgba(42, 196, 20, 0.16)` — soft background depth, never used for body text.

### Neutral

- White: `#FDFDFD` — headings, primary copy, and high-contrast UI text.
- Soft white: `#D9FFB8` — secondary emphasis on dark surfaces.
- Grey: `#6F6F6F` — metadata, legal copy, and low-priority labels.
- Dark grey: `#3A3A3A` — neutral structural reference; use sparingly because the web UI is black-first.
- Black: `#040404` — page background, footer, overlays, and high-contrast text on neon controls.
- Panel: `#0B120B` — cards and product-demo surfaces.
- Raised panel: `#111A11` — accordion and elevated component surfaces.

## Usage rules

1. Keep `#83FF00` scarce and purposeful. If everything is neon, nothing feels active.
2. Use black or near-black surfaces behind neon text and controls for contrast.
3. Use green gradients only as a directional glow, not as large decorative rainbow effects.
4. Avoid introducing purple, pink, cyan, amber, or blue into the UI palette.
5. Maintain visible focus states with the primary green and preserve minimum text contrast.
6. Use borders at low opacity (`10%–30%`) to separate dark surfaces without adding visual noise.

## Typography

- Body: Inter, existing weights and loading configuration.
- Display: K2D, existing weights and loading configuration.
- Headings: bold, compact, slightly tight tracking.
- Body copy: 16px minimum where possible, relaxed line-height, soft neutral color.
- Labels: uppercase, small, and letter-spaced; use green only for meaningful section cues.

## Components

- Primary button: `#2AC414 → #83FF00 → #2AC414`, black text, soft green shadow.
- Secondary button: transparent black surface, low-opacity green border, white text.
- Card: near-black/green-tinted panel, neutral border, green hover border.
- Focus ring: `#83FF00`, 3px, offset 4px.
- Selection: neon green background with black text.
- Motion: existing subtle transitions; no new motion required for the palette refresh.

## Responsive and accessibility notes

The color change is applied to every rendered landing-page section at mobile and desktop breakpoints. Neon green is not the only signal for meaning: labels and text remain present for trust, status, and pricing communication.
