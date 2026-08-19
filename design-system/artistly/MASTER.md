# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Artistly
**Generated:** 2026-08-19 19:12:34
**Category:** AI Photo & Avatar Generator
**Design Dials:** Variance 5/10 (Balanced / Modern) | Motion 3/10 (Subtle) | Density 4/10 (Standard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#83FF00` | `--brand-neon` |
| Secondary | `#2AC414` | `--brand-green` |
| On Primary | `#040404` | `--brand-black` |
| Background | `#040404` | `--page-background` |
| Foreground | `#FDFDFD` | `--page-foreground` |
| Soft text | `#D9FFB8` | `--brand-soft` |
| Muted text | `#6F6F6F` | `--brand-gray` |
| Dark grey | `#3A3A3A` | `--brand-dark-gray` |
| Card | `#0B120B` | `--brand-panel` |
| Raised card | `#111A11` | `--brand-panel-raised` |
| Ring | `#83FF00` | `--brand-neon` |

**Color Notes:** Black-first, neon-green brand signal, secondary green glow, restrained neutral hierarchy.

### Typography

- **Heading Font:** Space Grotesk
- **Body Font:** DM Sans
- **Mood:** tech, startup, modern, innovative, bold, futuristic
- **Google Fonts:** [Space Grotesk + DM Sans](https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 4/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #EC4899;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #7C3AED;
  border: 2px solid #7C3AED;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FAF5FF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #7C3AED;
  outline: none;
  box-shadow: 0 0 0 3px #7C3AED20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** AI-Native UI

**Keywords:** Chatbot, conversational, voice, assistant, agentic, ambient, minimal chrome, streaming text, AI interactions

**Best For:** AI products, chatbots, voice assistants, copilots, AI-powered tools, conversational interfaces

**Key Effects:** Typing indicators (3-dot pulse), streaming text animations, pulse animations, context cards, smooth reveals

### Page Pattern

**Pattern Name:** Hero + Testimonials + CTA

- **Conversion Strategy:** Social proof before CTA. Use a concise set of verified testimonials with photo, name, and role. CTA after social proof. Provide previous/next and pause controls; stop rotation on focus, hover, and reduced motion; announce slide position. Previous/next buttons and keyboard controls must expose every slide without dragging.
- **CTA Placement:** Hero (sticky) + Post-testimonials
- **Section Order:** Hero > Problem statement > Solution overview > Testimonials carousel > CTA

---

## Motion

**Page Transition** (Subtle) — Trigger: route change | Duration: 200-300ms | Easing: `power1.inOut`

```js
gsap.to(main, { opacity: 0, duration: 0.2, onComplete: () => { navigate(); gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.2 }); } });
```

**Framework notes:** Pair with the router's transition hooks (Next.js App Router transitions, React Router's useNavigate, Vue Router's beforeEach/afterEach); Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Preload the destination route's critical assets before the exit tween finishes
- ❌ Don't block navigation on animation; cap exit duration at ~250ms so the app never feels unresponsive
- ⚡ Exit animation should always resolve faster than entrance (asymmetric timing) so back/forward feels snappy

---

## Anti-Patterns (Do NOT Use)

- ❌ Inconsistent styling
- ❌ Poor contrast ratios

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
