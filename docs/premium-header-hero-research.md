# Premium Header and Hero Research

This note records the research and design reasoning behind the premium Airveek Header/Hero refresh completed on August 19, 2026. It supplements `design-system.md`; the content structure remains conversion-led while the identity now follows the supplied Airveek logo and green/black palette.

## Research sample

The direction was informed by current product pages and broader landing-page research:

- [Linear](https://linear.app/) leads with a short outcome statement and a product-led visual demonstration. Its dark environment uses restrained depth, disciplined type, and quiet motion rather than ornamental clutter.
- [Runway](https://runway.com/) treats creative AI as a premium visual medium. It pairs concise messaging with cinematic imagery and keeps the product action obvious.
- [Vercel](https://vercel.com/) uses high-contrast typography, precise spacing, thin borders, and layered product surfaces to make complex technology feel understandable.
- [Framer](https://www.framer.com/) demonstrates the value of bold editorial type, polished transitions, and visually rich product storytelling.
- Landdding's [State of Landing Pages 2026](https://landdding.com/state-of-landing-pages-2026) reports that dark-dominant palettes, expressive typography, and motion used as product demonstration are common among current AI/SaaS launches.
- [Unbounce's SaaS benchmark](https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/) emphasizes readable copy and mobile-first execution; the redesign therefore keeps contrast and scanning clarity ahead of decoration.
- [web.dev LCP guidance](https://web.dev/articles/optimize-lcp) recommends making critical hero imagery discoverable in HTML. The generated backdrop is rendered through `next/image`, not hidden exclusively in CSS.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) requires readable contrast, visible focus, reflow, and appropriately sized controls. The CTA retains a strong keyboard focus state and large touch target.

## Patterns adopted

### 1. One dominant conversion path

The existing single CTA remains the only primary action. Its treatment now combines a high-contrast gradient, contained width, strong depth, and directional arrow, while retaining the exact label and destination.

### 2. Product proof as the visual anchor

The Loom demonstration remains unchanged and in the same position. It is presented inside a polished glass-and-gradient product theater rather than the previous sharp-edged frame.

### 3. Cinematic but readable atmosphere

A bespoke AI-generated illustration adds creative depth at the outer edges while the center stays dark and quiet. Layered masks and gradients preserve white-text readability and prevent the art from competing with the message.

### 4. Editorial typography

K2D remains the Airveek display family and Inter remains the supporting family. Larger fluid sizing, tighter display leading, subtle text shadows, and a restrained green highlight make the hierarchy feel more intentional without changing the type system.

### 5. A restrained surface hierarchy

The subtitle and video retain the premium glass treatment, while the offer is intentionally presented in the open page flow so its headline and CTA remain direct. Review badges and rating cards use flat navy tiles with small radii and no decorative borders or shadows, keeping factual trust signals easy to scan without competing with the conversion content.

### 6. Motion with purpose

Only low-amplitude effects are used: backdrop drift, a pill sheen, CTA shimmer, and hover elevation. All motion is disabled through `prefers-reduced-motion`.

## AI-generated asset

`public/images/airveek/hero-premium-generated.png` was created with the built-in image generation tool for this project. The production prompt requested a wide dark creative environment with restrained green light, subtle generative particles, a low-detail center, and no text, people, logos, or generic robot/brain imagery.

The asset is loaded through `next/image` with responsive sizing and high priority so Next.js can serve an appropriately optimized format rather than shipping the full source PNG indiscriminately.

## Guardrails

- Preserve every existing string and the original section sequence.
- Keep the Airveek logo, product video, payment marks, review badges, and ratings authentic; generated art must not replace factual trust signals.
- Use decoration only where it strengthens hierarchy.
- Maintain a dark center behind text across crops.
- Keep the experience fully legible and operable without animation.
- Validate at desktop, tablet, and mobile widths before release.
