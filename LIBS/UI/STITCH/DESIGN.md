---
name: EnZIME
stitch_project: projects/7808089884213645532
design_system_asset: assets/e6a4c5bfcd374f5c95a6cfbfea8a12fe
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#bbcac6'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#859490'
  outline-variant: '#3c4947'
  surface-tint: '#4fdbc8'
  primary: '#4fdbc8'
  on-primary: '#003731'
  primary-container: '#14b8a6'
  on-primary-container: '#00423b'
  inverse-primary: '#006b5f'
  secondary: '#44e2cd'
  on-secondary: '#003731'
  secondary-container: '#03c6b2'
  on-secondary-container: '#004d44'
  tertiary: '#bec6e0'
  on-tertiary: '#283044'
  tertiary-container: '#9ca4bd'
  on-tertiary-container: '#323a4f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:   { fontFamily: Space Grotesk, fontSize: 48px, fontWeight: '700', lineHeight: '1.1', letterSpacing: -0.02em }
  headline-lg:  { fontFamily: Space Grotesk, fontSize: 32px, fontWeight: '600', lineHeight: '1.2' }
  headline-md:  { fontFamily: Space Grotesk, fontSize: 24px, fontWeight: '500', lineHeight: '1.3' }
  body-lg:      { fontFamily: Geist, fontSize: 18px, fontWeight: '400', lineHeight: '1.6' }
  body-md:      { fontFamily: Geist, fontSize: 16px, fontWeight: '400', lineHeight: '1.5' }
  label-md:     { fontFamily: Space Grotesk, fontSize: 14px, fontWeight: '600', lineHeight: '1', letterSpacing: 0.05em }
  code:         { fontFamily: Geist, fontSize: 14px, fontWeight: '400', lineHeight: '1.4' }
  reading-body: { fontFamily: Literata, fontSize: 18px, fontWeight: '400', lineHeight: '1.7' }   # ArticleViewer reading surface only
roundness: ROUND_FOUR   # buttons/inputs 4px, cards/progress 8px, chips pill
spacing: { base: 8px, container-max: 1024px, gutter: 24px, margin-mobile: 16px, margin-desktop: 40px }
---

# EnZIME — Design System (Stitch-frozen, TC12)

> Frozen UI source-of-truth for the EnZIME reader/annotator. Per TC12/I-20 this is an
> **input to architecture**, not a mid-pipeline step. The working screen artifacts under
> `screens/<screen>/` are **wired in at CODE, never re-invented** by coders. ARCHITECTURE.md
> §7 (frontend) cites these screen IDs; §5 flows are the user journeys realized here.

## Brand & Style
Pillars: **Resilience, Utility, Calm.** An offline-first tool that feels dependable and
locally permanent, yet lightweight to preserve device resources. Aesthetic = **Technical
Minimalism**: the structured clarity of developer tools + a centered, book-like reading focus
that minimizes eye strain over long reading/annotation sessions. A quiet, high-performance
workspace — no decorative flourishes, rich in functional affordances.

## Colors
Deep nocturnal palette (dark default) for power saving on mobile + a calm reading
environment. **Primary `#14b8a6`** teal-emerald = high-signal actions, progress, active
states ("the energy of the on-device AI"). Surface = deep nocturnal blues (`#051424` base,
container layering to `#273647`) without heavy shadows. Semantic: success/verified = emerald,
warning/untrusted-peer = amber, error/destructive = rose — desaturated to stay calm.

## Typography
- **Space Grotesk** — headings, labels, UI chrome (technical, geometric).
- **Geist** — UI body text and annotation metadata (legible, mono-influenced).
- **Literata** — the **ArticleViewer reading surface only**: warm reading serif, line length
  ≤700px, generous 1.5–1.7rem paragraph rhythm.

## Layout & Spacing
Centered fixed grid; 12-col desktop dashboard, reading collapses to a single centered column.
Breakpoints: mobile <640px (16px margins), tablet 640–1024px (24px), desktop >1024px
(auto margins, 1024px reading max-width). All spacing multiples of 8px.

## Elevation & Depth
No soft floating shadows — **tonal layering + low-contrast 1px outlines**. L0 background, L1
cards (subtle fill + 1px border), L2 popovers/modals (brighter border). Active elements get a
2px teal outer glow at 20% opacity.

## Shapes
Soft engineered roundness: buttons/inputs 4px, cards/progress containers 8px, chips pill.

## Components (consistent affordances for an offline environment)
- **Action buttons:** primary solid `#14b8a6` w/ dark text; secondary = ghost (border only).
- **Selectable radio cards** (AI model selection): a hardware-summary row (CPU/RAM); border
  turns teal when selected.
- **Progress indicators:** thin 4px tracks, teal fill; pulsing fill for AI inference; download
  progress is determinate + resumable (Pause/Cancel) per the Dynamic-Download identity.
- **Hardware-summary rows:** compact mono `code` typography, color-coded dots (green/amber/red).
- **Centered reader card:** ≤720px max width for readability.
- **Annotation markers:** highlight = primary at 30% opacity so text stays the hero.

## Signature layout — Co-visible reader + notebook
Article on one side, the AI chat / annotation **notebook** co-visible on the other:
split-view on desktop/tablet; tabbed/sheet on mobile. The two are always relatable.

## Offline-first dignity
Nothing implies a connection is required. Network is additive; read / search / annotate / ask
the AI all work in airplane mode. No "waiting for server" spinners. Physical-media import
(SD/USB/disc) is a first-class, equal-citizen path to downloading everywhere it appears.

## Screen inventory (see `screens/<id>/` + `MANIFEST.md`)
First-launch onboarding · Library/home · Dynamic-Download catalog · Reader (split + notebook) ·
Search · AI Chat (Chat-with-ZIM) · Annotator · Sidecar share + peer-trust · Model management ·
Settings · Paywall · App-update notification.
