# DESIGN — The Bug That Kept Cutting Our AI Videos Off

Visual system spec for the Part 2 explainer video accompanying the Substack case study
_"The Bug That Kept Cutting Our AI Videos Off Mid-Sentence."_

- **Cut**: 1920×1080 @ 30fps, ~68s, full narrative arc (6 beats)

## Concept

Cinematic dev-incident aesthetic — deep void background with high-contrast type,
electric green for the fix, hard red for the bug. The video should _feel_ the
bug viscerally: a sound that should be there, then isn't. The visual language is
audio waveforms, timeline rulers, and code attributes that disagree.

The narrative pillar: a clock and a voice that don't agree. Every beat returns
to that mismatch and resolves it.

## Palette

```css
/* Void scale (backgrounds) */
--void: #050510; /* page background */
--void-elevated: #0d0d1a; /* cards, code panels */
--void-line: #1a1a2e; /* hairlines, borders */
--void-soft: #2a2a40; /* hover, active borders */

/* Paper (foreground text) */
--paper: #ffffff; /* primary text */
--paper-muted: #9999b3; /* secondary text */
--paper-dim: #5a5a73; /* tertiary, placeholders */

/* Accents (semantic) */
--signal: #00ff88; /* electric green: the fix, success, alignment */
--signal-soft: rgba(0, 255, 136, 0.18);
--signal-glow: rgba(0, 255, 136, 0.4);
--danger: #ff3355; /* hard red: the bug, the cut */
--danger-soft: rgba(255, 51, 85, 0.18);
--danger-glow: rgba(255, 51, 85, 0.5);
--code: #7dd3fc; /* code tokens, attribute values */
--code-soft: rgba(125, 211, 252, 0.15);
--warn: #ffb84d; /* the original target value before the fix */
```

**Rules**:

- One accent dominates per beat. Never two accents in equal weight.
- `signal` belongs to the _fix_, the _aligned_ state, the _resolved_ moment.
- `danger` belongs to the _bug_, the _cut_, the _truncation_.
- `code` shows up wherever real text from the codebase or HTML appears.
- `warn` only appears as the original locked duration value before the fix.

## Typography

```css
--font-display: "Inter Tight", "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
```

**Sizes** (1920×1080):

| Class        | Size  | Weight | Tracking | Use                          |
| ------------ | ----- | ------ | -------- | ---------------------------- |
| `display-xl` | 160px | 600    | -0.02em  | Lesson quote (Beat 6)        |
| `display-l`  | 120px | 500    | -0.015em | Hook headline (Beat 1)       |
| `display-m`  | 84px  | 500    | -0.01em  | Beat captions                |
| `display-s`  | 56px  | 500    | -0.005em | Secondary captions           |
| `body`       | 32px  | 400    | 0        | Annotations                  |
| `mono-l`     | 30px  | 500    | 0        | Code, attribute values       |
| `mono-m`     | 22px  | 400    | 0        | Inline code, file paths      |
| `mono-s`     | 16px  | 500    | 0.06em   | UI chips, timecodes, labels  |

## Motion language

Default eases:
- Entrances: `power3.out`
- Transitions: `power2.inOut`
- Glitch flashes: `power4.in` (sharp, decisive)
- Number ticks: `power2.out` with snap

| Motion                   | Properties                                | Duration        |
| ------------------------ | ----------------------------------------- | --------------- |
| Word-by-word reveal      | `y: 24 → 0, opacity 0 → 1`, stagger 0.06s | per word ~250ms |
| Waveform pulse           | `scaleY: 0.2 → 1.0`, sine.inOut, repeat   | 80ms per bar    |
| Waveform sudden cut      | `opacity: 1 → 0`, sharp ease              | 100ms           |
| Glitch flash             | `x: ±4`, `opacity: 1 → 0.4 → 1`           | 200ms (3 cycles) |
| Number tick              | `innerText`, snap to integer              | 600-1200ms      |
| Code char reveal         | `opacity 0 → 1`, stagger 0.02s            | per char ~150ms |
| Beat-to-beat transition  | cross-fade with hard cut moment           | 350ms           |

## Visual motifs (recurring)

- **Audio waveform**: A row of 60 vertical bars representing audio amplitude.
  Bars pulse with sine wave. Width=8px, gap=4px. When the bug strikes, bars
  freeze and turn `--danger`. When the fix lands, bars resume in `--signal`.
- **Timeline ruler**: A horizontal axis with tick marks every 5 seconds.
  Two parallel tracks: "video timeline" (top) and "narration audio" (bottom).
  Misalignment = bug. Alignment = fix.
- **data-duration attribute**: The literal HTML attribute appears multiple
  times, with the number value highlighted and capable of mutation (from `30`
  to `42` etc.).
- **Three highlight box**: Beat 4 — three rounded rectangles labeled `root`,
  `narration`, `last scene` — each pulses signal-green when rewritten.

## Sound design

- **Voice (required)**: ElevenLabs TTS. The same pipeline the article describes
  — meta-acceptance test. Calm-confident American male. Manifesto-register.
  ~60 words total.
- **Music (none for v1)**: silence between sentences is part of the design.
- **SFX**: none in v1. The waveform cut visual carries the audible weight.

## Asset list

- **Fonts**: Inter Tight (Google Fonts CDN), JetBrains Mono (Google Fonts CDN).
- **Narration**: `narration/master-narration.mp3` (ElevenLabs).
- **QR code**: `assets/qr-article.svg` — generated for `https://aicoe.fit/the-bug-that-kept-cutting-our-ai`. Style: white modules on transparent background, signal-green eye corners.

## What this design is NOT

- Not a recap of Part 1. This stands alone; the bug story has its own arc.
- Not narration-led. The voice is sparse. Visuals carry most of the runtime.
- Not subtle. The bug is dramatic; the fix is dramatic. Restraint of Part 1
  is replaced with cinematic punctuation.
