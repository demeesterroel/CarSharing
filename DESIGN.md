---
name: CarSharing — Paper Ledger

colors:
  # ── Surface stack (warm parchment) ───────────────────────────
  background: "#ebe3d2"
  on-background: "#1a1a1a"
  surface: "#f5f0e6"
  surface-dim: "#ebe3d2"
  surface-bright: "#faf7f2"
  surface-container-lowest: "#fdf9f3"
  surface-container-low: "#f5f0e6"
  surface-container: "#ebe3d2"
  surface-container-high: "#e3d9c5"
  surface-container-highest: "#d9ceb2"
  on-surface: "#1a1a1a"
  on-surface-variant: "#555047"
  inverse-surface: "#1a1a1a"
  inverse-on-surface: "#f5f0e6"
  outline: "#d9ceb2"
  outline-variant: "#ebe3d2"
  surface-tint: "#555047"
  surface-variant: "#d9ceb2"
  # ── Primary: deep ink ────────────────────────────────────────
  primary: "#1a1a1a"
  on-primary: "#f5f0e6"
  primary-container: "#555047"
  on-primary-container: "#f5f0e6"
  inverse-primary: "#d9ceb2"
  primary-fixed: "#d9ceb2"
  primary-fixed-dim: "#c8bfa0"
  on-primary-fixed: "#1a1a1a"
  on-primary-fixed-variant: "#555047"
  # ── Secondary: slate blue (reservations / info) ───────────────
  secondary: "#3d5a7a"
  on-secondary: "#f5f0e6"
  secondary-container: "#c8d8e8"
  on-secondary-container: "#2a4460"
  secondary-fixed: "#b8cede"
  secondary-fixed-dim: "#90b0c8"
  on-secondary-fixed: "#1e3348"
  on-secondary-fixed-variant: "#2a4460"
  # ── Tertiary: sage green (confirmed / credit / positive) ──────
  tertiary: "#5a7a3c"
  on-tertiary: "#f5f0e6"
  tertiary-container: "#ccdabb"
  on-tertiary-container: "#3d5a28"
  tertiary-fixed: "#b8ceaa"
  tertiary-fixed-dim: "#8fb07a"
  on-tertiary-fixed: "#1e3414"
  on-tertiary-fixed-variant: "#3d5a28"
  # ── Error / Accent: brick red (fuel cost / debt / reject) ─────
  error: "#c44536"
  on-error: "#f5f0e6"
  error-container: "#f5d3ce"
  on-error-container: "#9b2f22"
  # ── Warning: amber (pending / unresolved / discount) ─────────
  warning: "#b87e0f"
  on-warning: "#f5f0e6"
  warning-container: "#f0ddaa"
  on-warning-container: "#7a5108"

typography:
  display:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: "600"
    lineHeight: 36px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 26px
    fontWeight: "600"
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Fraunces
    fontSize: 20px
    fontWeight: "600"
    lineHeight: 24px
    letterSpacing: -0.015em
  title:
    fontFamily: Fraunces
    fontSize: 16px
    fontWeight: "600"
    lineHeight: 20px
  body-lg:
    fontFamily: Courier Prime
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 20px
    letterSpacing: 0em
  body-md:
    fontFamily: Courier Prime
    fontSize: 11px
    fontWeight: "400"
    lineHeight: 16px
    letterSpacing: 0.05em
  label-lg:
    fontFamily: Courier Prime
    fontSize: 10px
    fontWeight: "700"
    lineHeight: 14px
    letterSpacing: 0.15em
  label-sm:
    fontFamily: Courier Prime
    fontSize: 9px
    fontWeight: "700"
    lineHeight: 12px
    letterSpacing: 0.2em
  nav-label:
    fontFamily: Courier Prime
    fontSize: 8px
    fontWeight: "700"
    lineHeight: 10px
    letterSpacing: 0.15em

rounded:
  sm: 0px
  DEFAULT: 0px
  md: 4px
  lg: 4px
  xl: 1rem
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  page: 20px
  section: 24px
  lg: 32px
  nav-clearance: 72px
  fab-clearance: 80px

components:
  activity-strip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-lg}"
    rounded: "{rounded.DEFAULT}"
    padding: 12px 14px

  activity-strip-trip:
    borderLeft: 3px solid {colors.primary}

  activity-strip-fuel:
    borderLeft: 3px solid {colors.error}

  activity-strip-expense:
    borderLeft: 3px solid {colors.warning}

  receipt-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.md}"

  stamp:
    backgroundColor: transparent
    rounded: "{rounded.md}"
    padding: 6px 14px

  stamp-confirmed:
    textColor: "{colors.tertiary}"
    border: 2.5px solid {colors.tertiary}

  stamp-pending:
    textColor: "{colors.warning}"
    border: 2.5px solid {colors.warning}

  stamp-rejected:
    textColor: "{colors.error}"
    border: 2.5px solid {colors.error}

  car-stamp-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: 6px 8px

  car-stamp-inactive:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.DEFAULT}"
    padding: 6px 8px

  fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.headline-md}"
    rounded: "{rounded.DEFAULT}"

  bottom-nav-item:
    backgroundColor: transparent
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.nav-label}"
    padding: 10px 2px 12px

  bottom-nav-item-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"

  input-underline:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    typography: "{typography.headline-md}"
    rounded: "{rounded.DEFAULT}"
    padding: 4px 0

  receipt-row-label:
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-lg}"

  receipt-row-value:
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
---

## Brand & Style

CarSharing is a cooperative car-sharing app for small groups. Its visual identity is built entirely around the metaphor of physical paper documents — receipts, ledgers, tally sheets, and rubber-stamped forms. Every design decision reinforces this metaphor: the interface should feel like handling a beautifully printed paper record, not a software dashboard.

The personality is **analogue-honest**: no gradients, no glassmorphism, no decorative icons. Data is presented with the directness of a typewritten receipt. Trustworthiness is communicated through typography and structure, not decorative flourishes. The tone is warm but precise — a handmade co-op register, not a fintech app.

The single most memorable quality of this design is the combination of a warm parchment background with monospaced Courier Prime type: every label and navigation item reads like it was typed on a vintage typewriter.

## Colors

The palette is built around a single metaphor: **ink on paper**.

The paper stack ranges from warm off-white `#f5f0e6` (fresh receipt paper) through `#ebe3d2` (aged paper) to `#d9ceb2` (the darkest used for borders and input backgrounds). These are never pure white or cold neutral — the warmth is intentional and must be preserved in all contexts.

Text uses near-black `#1a1a1a` (not pure black) for all primary content. Secondary text (`#555047`) and muted/placeholder text (`#8a8273`) are warm browns, never cool grays.

The four semantic colors are used sparingly and carry precise meaning:

- **Error / Accent** `#c44536` — brick red: fuel costs, debt, rejected reservations, delete actions. This is the most prominent color in the app because it signals money leaving the group.
- **Tertiary / Green** `#5a7a3c` — muted sage: confirmed reservations, positive balances, credit entries.
- **Secondary / Blue** `#3d5a7a` — slate: active reservations, informational states.
- **Warning / Amber** `#b87e0f` — ochre: pending/unresolved states, discounts, anything awaiting action.

All four semantic colors are desaturated to remain harmonious with the parchment base. Bright or highly saturated color would feel jarring against the aged-paper aesthetic.

The desktop framing adds a subtle **lined-paper background** — a repeating horizontal gradient alternating between `#e8e2d4` and `#e2dcce` at 2px / 1px intervals — that reinforces the stationery metaphor when the mobile column is centered on a wide screen.

## Typography

Three typefaces are used, each with a precise and exclusive role.

**Fraunces** (variable serif, Google Fonts) is used exclusively for headings, section titles, large monetary amounts, and any text that needs to feel editorial or consequential. Its high-contrast strokes and distinctive ink traps give it the character of a quality printed ledger. Large Fraunces text always carries negative letter spacing (−0.02em to −0.03em) and a lineHeight near 1.1 to feel tight and set.

**Courier Prime** (monospaced, Google Fonts) is used for everything that is data, metadata, navigation, buttons, badges, and labels. The choice of a typewriter-style monospace font is the defining aesthetic decision of the entire design — it makes every label feel like it was physically typed. Courier Prime text is nearly always uppercase with positive letter spacing (0.1em–0.2em). This applies to all navigation labels, all form labels, all receipt row labels, and all status badges.

**Inter** (sans-serif, Google Fonts) is loaded as the base `body` font and acts as an invisible fallback for any text that hasn't been explicitly styled. In practice, virtually no rendered text in the app uses Inter directly.

Typography sizes span from 8px (bottom navigation labels) to 38px (rate assistant feature). The scale is not uniform — sizes are chosen for optical correctness within each context rather than following a strict modular scale.

## Layout & Spacing

The app is a **mobile-first PWA** with a maximum content width of 480px. On desktop, the column is centered with a 20px body padding on all sides. There are no breakpoint-driven layout reflows within the mobile column — the design is built for one column at all times.

The page horizontal padding is `20px` throughout. Section headers indent by `20px` on both sides. The bottom navigation bar is fixed and creates a dead zone that all scrollable content must clear (`72px` for standard pages, `80px` for pages with a FAB).

Form entry uses **bottom sheets** (Radix Dialog) that slide up from the bottom of the screen. Bottom sheets have their top two corners rounded at `16px` — the only rounded corners in the functional interface — and sit on a `rgba(0,0,0,0.2)` overlay with a backdrop blur.

The spacing vocabulary uses these values most frequently: `4px` (tight detail gaps), `8px` (element internal gaps), `12px` (strip padding), `16px` (card padding), `20px` (page margin), `24px` (section gap).

## Elevation & Depth

Elevation is kept extremely subtle to preserve the flat, paper-like quality of the interface. No element should feel like it is floating above the page.

- **Activity strips**: `0 1px 2px rgba(0,0,0,0.04)` — barely perceptible, just enough to lift from the parchment background.
- **Receipt cards**: `0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.07)` — the most elevated surface in the app, used for statement/summary cards.
- **Admin stat cards**: `0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)` — intermediate.
- **FAB**: `0 6px 20px rgba(0,0,0,0.25)` — the single exception; the floating action button casts a stronger shadow because it genuinely floats above the content layer.
- **FAB sub-actions**: `0 4px 12px rgba(0,0,0,0.15)`.

Borders are used more than shadows to define structure. The standard divider is a `1.5px dashed` line in ink (`#1a1a1a`) or ink-dim (`#555047`) — explicitly mimicking the perforation line on a tear-off receipt. Solid borders are used for the `outline` role (`#d9ceb2`), section containers, and form inputs.

## Shapes

**Zero border radius is the dominant shape language.** Activity strips, cards, stamps, buttons, the FAB, car code chips, and all data-bearing elements are perfectly square-cornered. This is intentional: rounded corners feel digital and soft; square corners feel physical and precise, like a cut piece of paper.

The only exceptions:

- **Stamps** use `4px` radius — the smallest visible curve, just enough to read as a rubber stamp rather than a hard-cut label.
- **Bottom sheets** use `16px 16px 0 0` — top corners only, to suggest a sheet of paper being lifted from a flat surface.
- **Status dot indicators** use `50%` (circular).

Rotated elements are a signature motif. Status stamps (confirmed / pending / rejected) are rendered with `transform: rotate(-6deg)` to simulate a hand-applied rubber stamp. Dashboard decoration stamps are rotated between −5° and −8°. This slight disorder is deliberate — it signals that a human process is behind the data.

## Components

### Activity Strips

The primary content atom. Each strip represents a single logged event (trip, fuel fillup, or expense) and consists of a left accent border, a car code chip, a serif location/description, and a mono amount. The left border color encodes type: ink (`#1a1a1a`) for trips, brick red for fuel, amber for expenses. Strips have `0` radius, `12px 14px` padding, and a `0 1px 2px rgba(0,0,0,0.04)` shadow.

### Stamps

Status badges that mimic physical rubber stamps. Always bordered (2.5px solid), always uppercase mono, always rotated −6deg, always `4px` radius. Three semantic variants: green (confirmed), amber (pending), red (rejected). The `stampDrop` animation (`cubic-bezier(0.36, 0.07, 0.19, 0.97)`, 350ms) scales the stamp in from 2.4× with rotation, bounces slightly at 60%, and settles — simulating the physical impact of a stamp hitting paper.

### Pending Reservation Hatching

Pending reservations use a diagonal stripe pattern as their background: `repeating-linear-gradient(-45deg, #ebe3d2, #ebe3d2 4px, #f5f0e6 4px, #f5f0e6 10px)`. This directly references the cross-hatching used on paper forms to mark incomplete or provisional entries.

### Floating Action Button (FAB)

A `56px × 56px` square (radius `0`) in pure ink (`#1a1a1a`). The `+` glyph uses `Fraunces` at `34px`. Positioned `86px` above the bottom edge to clear the bottom navigation bar. When expanded into multi-action mode, child "chit" buttons slide up with the `popIn` animation (200ms ease-out) and carry their own `0 4px 12px rgba(0,0,0,0.15)` shadow. The `+` rotates 45° on open (200ms ease-out).

### Bottom Navigation

A fixed bar at the bottom of the viewport with a `1.5px dashed` top border in ink — the same perforation line used throughout the app. Active tab is an inverted ink rectangle (white-on-black, matching the car-stamp-active pattern). Labels use `Courier Prime` at `8px`, uppercase, `1.2px` letter spacing. The bar height is `72px` of clearance.

### Car Stamps

Short vehicle code chips (e.g. "VW", "LEAF") presented as small bordered rectangles in Courier Prime bold, uppercase, `2px` letter spacing. Active state: ink background, paper text. Inactive/dormant state: transparent background, dashed border. Both have `0` radius.

### Input Fields

Form inputs use the `.input-underline` pattern: no box, no background, only a `1.5px solid` bottom border in ink. The font is `Fraunces` at `22px` weight `500` — so the value being entered appears in the display serif, feeling like filling in a printed form. Placeholders are italic and `ink-mute` (#8a8273).

### Receipt Rows

Label-value pairs in `.receipt-row` format: label in uppercase mono `10px` with `1px` letter spacing in ink-dim, value in mono `13px` semi-bold. Used inside receipt cards to present structured financial data. The `.perf` and `.perf-light` dividers (dashed horizontal rules) separate receipt sections.

### Animations

Three keyframe animations carry the physical metaphor:
- **popIn** (200ms ease-out): elements appear from below (FAB chit menu items, tooltips).
- **stampDrop** (350ms, custom cubic-bezier): stamps scale in with a bounce, simulating impact.
- **tearOff** (400ms ease-in): list items exit downward with opacity fade, simulating a receipt being torn away.
