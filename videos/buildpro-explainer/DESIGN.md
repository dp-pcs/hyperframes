# BuildPro Explainer — Design System

Source of truth: `~/Documents/GitHub/buildpro/server/src/brand.ts` and
`design/exports/brand-board.png` (Progressive palette, approved lockup).

## Brand

- Wordmark: italic, weight 800, letter-spacing -0.02em. "Build" in Steel Blue
  900 (#0A3360), "Pro" in Progressive Blue 700 (#0077B3). Light surface primary.
- Voice: guidance reads like a colleague, never a compliance officer.
- Tagline: "Governance as guidance."

## Colors (Progressive palette — exact values, do not invent)

| Token       | Hex     | Use                                  |
| ----------- | ------- | ------------------------------------ |
| blue-700    | #0077B3 | Primary accent, links, actions       |
| blue-900    | #2862A4 | Deep blue surfaces                   |
| blue-500    | #4EBEE5 | Illustrative accent                  |
| blue-100    | #F3F9FC | Tinted panel bg                      |
| steel-900   | #0A3360 | Headlines, wordmark "Build"          |
| steel-700   | #405E7C | Secondary text                       |
| steel-300   | #D1E2E5 | Borders / rules                      |
| steel-100   | #F4F9FA | Page background (canvas)             |
| gray-900    | #2D2D2D | Body text                            |
| gray-700    | #707070 | Muted text                           |
| green-900   | #067462 | Success text                         |
| green-700   | #08CAA9 | Fresh / active / adopted             |
| green-100   | #EFFBF7 | Success chip bg                      |
| yellow-900  | #A86800 | Caution text                         |
| yellow-700  | #EFAB00 | Quiet / paused                       |
| yellow-100  | #FFF8E5 | Caution chip bg                      |
| red-700     | #D41659 | Caution / bypassed / PII             |
| red-100     | #FCEFF2 | Bypass chip bg                       |

## Typography

Brand spec is "96 Sans (brand) · Inter/system fallback" — 96 Sans is
proprietary, so the declared fallback family carries the video:

- Display / body: **Inter Tight** (400, 500, 600, 800, italic 800 for the
  wordmark). Tracking -0.02 to -0.04em at display sizes.
- System / data / policy voice: **JetBrains Mono** (400, 500). Policies are
  YAML, the registry is data — the mono voice IS the product's second register.

## Video adaptation (light canvas)

- Canvas: steel-100 (#F4F9FA), never pure white full-bleed. Add texture: faint
  dot grid or steel-300 hairlines so frames don't read as blank slides.
- Borders 2-3px, full-saturation accent hits (blue-700, green-700, red-700).
- Chips: colored bg (green-100/yellow-100/red-100) + colored text, mono font.
- Headlines steel-900 72-110px w800; body gray-900 28-36px; mono labels
  18-22px gray-700.

## Do / Don't

- DO use status chips exactly as the product does: `active` green,
  `presumed-paused` yellow, `1 bypassed` red, `customer-pii` red.
- DO keep guidance copy conversational (colleague, not cop).
- DON'T use dark canvas — the brand is light-first.
- DON'T introduce colors outside the table above.
