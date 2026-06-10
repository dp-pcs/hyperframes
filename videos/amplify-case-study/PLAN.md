# Amplify Case Study Explainer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two HyperFrames compositions — an 87-second 16:9 master cut and a 30-second 1:1 short cut — accompanying the Substack case study _"We Pulled the Storyboard Module — and Got Better Videos."_

**Architecture:** Each beat is authored as a standalone `compositions/beat-N.html` (independently previewable, lintable, snapshot-able), then composed into a single `index.html` master file. Both cuts share design tokens defined in `shared/tokens.css`. Narration is ElevenLabs-or-Kokoro TTS, written to a single MP3 per cut and referenced as an `<audio>` element in the master composition.

**Tech Stack:** HyperFrames 0.6.x (CLI for `lint`/`validate`/`snapshot`/`render`/`tts`), GSAP (paused-and-registered timelines), Inter Tight + JetBrains Mono via Google Fonts CDN, vanilla HTML/CSS/JS (no bundler).

> **⚠️ CLI surface note (added 2026-06-10, hyperframes v0.6.88):** the example commands below were authored against an older CLI. The current binary differs:
>
> - `lint`, `validate`, `snapshot`, `render` all take a **project DIR** (containing an `index.html`), not a single composition file. A standalone `beat-N.html` outside a project root cannot be linted/snapshotted directly.
> - `snapshot` uses `--at <comma-list>` (not `--times`); there is **no `--output` flag** — snapshots write under the project's snapshots dir by default.
> - Always `npx hyperframes <cmd> --help` before trusting an example command in this PLAN.
>
> Tasks 1-12 were already shipped using corrected invocations at execution time. Short-cut tasks (13+) have been partially updated; if you find a stale flag, fix it inline and append a note here.

**Reference docs:**

- `videos/amplify-case-study/DESIGN.md` — visual system (palette, type, motion)
- `videos/amplify-case-study/STORYBOARD.md` — beat-by-beat plan
- `videos/amplify-case-study/SCRIPT.md` — narration script + voice settings
- `skills/hyperframes/SKILL.md` — framework authoring rules (READ BEFORE EACH BEAT TASK)
- `skills/gsap/SKILL.md` — GSAP timeline conventions (READ BEFORE EACH BEAT TASK)
- `videos/synapse-os-explainer/compositions/beat-1-question.html` — reference for the `<template>`-wrapped beat HTML structure already proven in this repo

**Universal beat conventions:**

- File path: `videos/amplify-case-study/master/compositions/beat-<N>-<slug>.html`
- Root element: `<div data-composition-id="amplify-case-study-beat-<N>" data-start="0" data-duration="<seconds>" data-width="1920" data-height="1080">`
- Class prefix: `b<N>-` on every selector inside the beat (avoids collisions when merged into master)
- GSAP timeline: created paused, registered as `window.__timelines["amplify-case-study-beat-<N>"] = tl`
- Fonts: load via `<link>` to Google Fonts inside `<head>` (Inter Tight 400/500/600, JetBrains Mono 400/500)
- Standalone wrapping: wrap the scene markup in `<template id="beat-<N>-<slug>-template">` per the `synapse-os-explainer` convention

---

## Task 0: Project scaffold + shared tokens

**Files:**

- Create: `videos/amplify-case-study/shared/tokens.css`
- Create: `videos/amplify-case-study/shared/base.html` (reference template for beats)

**Why:** Hoist palette + type + motion tokens into one CSS file every beat imports. Lock the design system in one place so subagents authoring each beat can't drift.

- [ ] **Step 1: Write `shared/tokens.css`**

```css
/* Design tokens — see DESIGN.md for rationale */
:root {
  /* Ink scale */
  --ink: #08090b;
  --ink-elevated: #12141a;
  --ink-line: #1f232c;
  --ink-soft: #2a2f3b;

  /* Paper */
  --paper: #f5f2ec;
  --paper-muted: #8b8e96;
  --paper-dim: #5a5e68;

  /* Accents */
  --signal: #22d67a;
  --signal-soft: rgba(34, 214, 122, 0.15);
  --warn: #f4a641;
  --warn-soft: rgba(244, 166, 65, 0.18);
  --code: #7dd3fc;
  --code-soft: rgba(125, 211, 252, 0.15);

  /* Type families */
  --font-display: "Inter Tight", "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
}

/* Universal beat reset */
[data-composition-id^="amplify-case-study"] {
  position: absolute;
  inset: 0;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-display);
  overflow: hidden;
}

/* Persistent bottom hairline carried across all master beats */
.hf-hairline {
  position: absolute;
  bottom: 80px;
  left: 96px;
  height: 1px;
  background: var(--signal);
  transform-origin: left center;
}
```

- [ ] **Step 2: Write `shared/base.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>amplify-case-study beat (preview)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../shared/tokens.css" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 1920px;
        height: 1080px;
        background: #000;
      }
    </style>
  </head>
  <body>
    <!-- BEAT TEMPLATE GOES HERE — copy the synapse-os-explainer beat-1-question.html
         <template> wrapper pattern, with the scene inside. -->

    <script>
      // GSAP loaded by HyperFrames runtime at preview/render time.
      // Each beat script:
      //   1) Builds a paused GSAP timeline
      //   2) Registers it on window.__timelines["amplify-case-study-beat-<N>"]
    </script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add videos/amplify-case-study/shared/
git commit -m "feat(videos/amplify-case-study): add shared tokens and base template"
```

---

## Task 1: Build Beat 1 — HOOK (7 seconds, silent)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-1-hook.html`
- Create: `videos/amplify-case-study/master/snapshots/beat-1/` (will be populated by snapshot)

**Reference:** STORYBOARD.md → BEAT 1 — HOOK

- [ ] **Step 1: Read framework rules**

```bash
cat skills/hyperframes/SKILL.md skills/gsap/SKILL.md
```

Note in particular:

- Root composition element needs `data-composition-id`, `data-width="1920"`, `data-height="1080"`, `data-duration="7"`.
- GSAP timeline MUST be `gsap.timeline({ paused: true })`.
- The timeline MUST be registered on `window.__timelines["amplify-case-study-beat-1"] = tl` (exact key).
- No inline `visibility: hidden` on scene wrappers — let HyperFrames runtime handle visibility.

- [ ] **Step 2: Author the beat HTML**

Single-line headline, center-anchored, 96px Inter Tight 500 `--paper`. Reveals word-by-word over ~4.5s, then holds 2s. Persistent green hairline at 8% width along the bottom 8% of canvas, anchored 96px from left.

The full text:

> "Click. Wait two minutes. Get a video that actually looks like your article."

Wrap the scene in `<template id="beat-1-hook-template">` like the synapse-os-explainer convention.

Words ("Click.", "Wait", "two", "minutes.", "Get", "a", "video", "that", "actually", "looks", "like", "your", "article.") in individual `<span class="b1-word">` for staggered animation.

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });
tl.from(".b1-word", {
  y: 24,
  opacity: 0,
  duration: 0.6,
  ease: "power3.out",
  stagger: 0.16,
});
tl.to(".b1-hairline", { scaleX: 1, duration: 1.2, ease: "power2.out" }, 0.2);
window.__timelines["amplify-case-study-beat-1"] = tl;
```

The `.b1-hairline` starts at `width: 8%` baseline; the timeline animates its `scaleX` from `0.0 → 1.0` during the beat so that by the end of Beat 1 it has reached its target width.

- [ ] **Step 3: Lint composition**

```bash
npx hyperframes lint videos/amplify-case-study/master/compositions/beat-1-hook.html
```

Expected: `✓ No issues found.`

- [ ] **Step 4: Validate composition (headless Chrome)**

```bash
npx hyperframes validate videos/amplify-case-study/master/compositions/beat-1-hook.html
```

Expected: PASS — no JS errors, fonts load, GSAP timeline registers on window.

- [ ] **Step 5: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-1-hook.html \
  --times 0,1.5,3.5,5.0,7.0 \
  --output videos/amplify-case-study/master/snapshots/beat-1/
```

Read each PNG and verify:

- t=0: empty canvas + faint hairline at bottom-left only
- t=1.5: first 3 words ("Click. Wait two") visible
- t=3.5: most of headline visible
- t=5.0: full headline + hairline near full
- t=7.0: held final state, hairline at scaleX=1

- [ ] **Step 6: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-1-hook.html
git commit -m "feat(videos/amplify-case-study): build beat 1 — hook"
```

---

## Task 2: Build Beat 2 — TEMPLATE GRID (10 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-2-template-grid.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-2/`

**Reference:** STORYBOARD.md → BEAT 2 — TEMPLATE GRID

- [ ] **Step 1: Read framework rules**

```bash
cat skills/hyperframes/SKILL.md skills/gsap/SKILL.md
```

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-2"`, `data-duration="10"`.

Layout (1920×1080 canvas):

- Top-right `mono-s` label: `amplify / 2026-05-15` at top: 60px, right: 96px, JetBrains Mono 14px `--paper-muted`, letter-spacing 0.04em.
- 3×2 thumbnail grid centered horizontally, anchored ~150px from top. Cells 480×270, 40px gap between cells.
- Cells 1–5: identical templated thumbnails. Cell 6: caption space.
- Each cell: `--ink-elevated` background, 1px `--ink-line` border, 24px padding.
- Inside each cell:
  - Eyebrow at top: 14px JetBrains Mono 500 `--paper-muted`, letter-spacing 0.06em, uppercase
  - Title in middle: 32px Inter Tight 500 `--paper`, line-height 1.15, max-width 380px
  - Accent bar at bottom: 4px tall, 60% width, `--warn`
- Cell contents (only text differs):
  1. eyebrow `EPISODE 014` / title `Dev Day Recap: What Agents Got Right`
  2. eyebrow `EARNINGS Q1` / title `Reading the Numbers Behind the Pivot`
  3. eyebrow `BENCHMARK` / title `Agent Performance Across Six Frontier Models`
  4. eyebrow `MODEL DROP` / title `What Changed in This Week's Release`
  5. eyebrow `TOOLS WEEKLY` / title `Twenty Builders, Twenty Stacks`
  6. (caption cell — empty until 11s)

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });
// Top-right label fades in immediately
tl.from(".b2-label", { opacity: 0, duration: 0.4 }, 0);
// Cells populate one-by-one with subtle scale
tl.from(
  ".b2-cell",
  {
    opacity: 0,
    scale: 0.96,
    duration: 0.5,
    ease: "power3.out",
    stagger: 0.12,
  },
  0.3,
);
// All cells "breathe together" — synchronized opacity oscillation 3→4s
tl.to(
  ".b2-cell",
  {
    keyframes: [{ opacity: 0.85 }, { opacity: 1.0 }, { opacity: 0.85 }],
    duration: 2.5,
    ease: "sine.inOut",
    repeat: 0,
  },
  3,
);
// Caption appears in cell 6 at 4s
tl.from(
  ".b2-caption .b2-word",
  {
    y: 24,
    opacity: 0,
    duration: 0.4,
    ease: "power3.out",
    stagger: 0.1,
  },
  4,
);
// At 9.5s, cells dim and cell 3 enlarges/zooms toward viewer
tl.to(".b2-cell:not(.b2-cell--zoom)", { opacity: 0.3, duration: 0.5 }, 9.5);
tl.to(".b2-cell--zoom", { scale: 2.4, zIndex: 10, duration: 0.5, ease: "power2.in" }, 9.5);

window.__timelines["amplify-case-study-beat-2"] = tl;
```

Mark cell 3 with extra class `b2-cell--zoom` so it can be targeted.

Caption text (in cell 6, hidden until 4s into beat): "Every video looked like every other video." Words wrapped in `<span class="b2-word">`.

Persistent hairline at bottom continues from Beat 1's end-state; this beat's timeline doesn't animate the hairline (Beat 1 already set its `scaleX`).

- [ ] **Step 3: Lint composition**

```bash
npx hyperframes lint videos/amplify-case-study/master/compositions/beat-2-template-grid.html
```

Expected: PASS

- [ ] **Step 4: Validate composition**

```bash
npx hyperframes validate videos/amplify-case-study/master/compositions/beat-2-template-grid.html
```

Expected: PASS

- [ ] **Step 5: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-2-template-grid.html \
  --times 0,1.0,2.5,4.5,6.5,9.0,9.9 \
  --output videos/amplify-case-study/master/snapshots/beat-2/
```

Read PNGs and verify:

- t=0: top-right label visible only
- t=1.0: cells 1-3 visible
- t=2.5: all 5 cells visible
- t=4.5: caption beginning to appear in cell 6
- t=6.5: full caption visible, all cells at full opacity
- t=9.0: cells dimming begin
- t=9.9: cell 3 enlarged, others dimmed

- [ ] **Step 6: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-2-template-grid.html
git commit -m "feat(videos/amplify-case-study): build beat 2 — template grid"
```

---

## Task 3: Build Beat 3 — SCHEMA REVEAL (13 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-3-schema-reveal.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-3/`

**Reference:** STORYBOARD.md → BEAT 3 — SCHEMA REVEAL

- [ ] **Step 1: Read framework rules** (`skills/hyperframes/SKILL.md`, `skills/gsap/SKILL.md`)

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-3"`, `data-duration="13"`.

Layout:

- Left third (x=96 to x=816): zoomed thumbnail carryover from Beat 2 (visual continuation). At t=1, it dissolves (`opacity 0`, `scale 1 → 1.05` over 700ms) revealing code panel beneath.
- Code panel: positioned absolute, left=96px, top=240px, width=720px, padding=28px, `--ink-elevated` background, 1px `--code-soft` border, border-radius=8px.

Code panel contents (as `<pre><code>` with manual line wrapping):

```
{
  "eyebrow":        "",
  "title":          "",
  "body":           "",
  "highlight":      "",
  "supportingPoints": [],
  "narration":      ""
}
```

- Keys (`"eyebrow"`, `"title"`, etc.) in `--code` color
- Values (the empty `""` and `[]`) in `--paper-dim`
- Braces, colons, commas in `--paper-muted`
- Each line wrapped in `<div class="b3-line">` for character reveal animation

Right side: vertical stack of constraint labels, positioned absolute, right=96px, top=300px:

- `layout       ← worker`
- `color        ← worker`
- `motion       ← worker`
- `composition  ← worker`

JetBrains Mono 22px `--paper-muted`, line-height 1.8, each line in `<div class="b3-constraint">`.

Big caption: bottom-center, top=820px, width=1728px, text-align center. Inter Tight 500 96px `--paper`, words in `<span class="b3-cap-word">`. Text: "The schema was the ceiling." — the word "ceiling" in extra span `<span class="b3-ceiling">ceiling.</span>` so it can be colored `--warn`.

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });
// Thumbnail carryover dissolve
tl.to(".b3-carryover", { opacity: 0, scale: 1.05, duration: 0.7 }, 1.0);
// Code panel fades in as carryover dissolves
tl.from(".b3-panel", { opacity: 0, duration: 0.5 }, 1.5);
// Schema lines character-reveal one by one
tl.from(
  ".b3-line",
  {
    opacity: 0,
    duration: 0.3,
    ease: "power2.out",
    stagger: 0.4,
  },
  1.8,
);
// Constraint labels slide in from right, staggered
tl.from(
  ".b3-constraint",
  {
    x: 40,
    opacity: 0,
    duration: 0.4,
    ease: "power2.out",
    stagger: 0.18,
  },
  3.0,
);
// Warn sweep across schema keys at t=6.5s
tl.to(
  ".b3-key",
  {
    color: "var(--warn)",
    duration: 0.18,
    ease: "power2.inOut",
    yoyo: true,
    repeat: 1,
    stagger: 0.1,
  },
  6.5,
);
// Big caption word-by-word at t=8.5s
tl.from(
  ".b3-cap-word",
  {
    y: 24,
    opacity: 0,
    duration: 0.5,
    ease: "power3.out",
    stagger: 0.18,
  },
  8.5,
);
// At 11.5s, code panel + constraints dim to 0.15 opacity (Beat 3 starts exiting)
tl.to(
  [".b3-panel", ".b3-constraints"],
  {
    opacity: 0.15,
    duration: 0.6,
  },
  11.5,
);

window.__timelines["amplify-case-study-beat-3"] = tl;
```

Schema field name spans should have class `b3-key` so the warn sweep can target them.

The word "ceiling." in the caption needs `style="color: var(--warn);"` once revealed — set initially via the GSAP `.from` so the warn color shows up on entry.

- [ ] **Step 3: Lint + validate** (same commands as Task 2)

- [ ] **Step 4: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-3-schema-reveal.html \
  --times 0,1.5,3.0,4.5,7.0,9.5,11.0,13.0 \
  --output videos/amplify-case-study/master/snapshots/beat-3/
```

Verify:

- t=0: carryover thumbnail visible left third
- t=1.5: thumbnail dissolving, panel appearing
- t=3.0: schema fields populating, constraints starting
- t=4.5: schema + constraints visible
- t=7.0: warn sweep mid-flight
- t=9.5: caption mid-reveal
- t=11.0: full caption visible
- t=13.0: caption holds, panel dimmed

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-3-schema-reveal.html
git commit -m "feat(videos/amplify-case-study): build beat 3 — schema reveal"
```

---

## Task 4: Build Beat 4 — THE DELETE (10 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-4-delete.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-4/`

**Reference:** STORYBOARD.md → BEAT 4 — THE DELETE

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-4"`, `data-duration="10"`.

Layout: full-canvas terminal frame.

- Terminal container: 1600×800 centered (x=160, y=140), `--ink-elevated` background, 1px `--ink-line` border, border-radius=12px.
- Title bar (top 48px of terminal): three traffic-light dots (12px circles, 16px gap) at left, padding-left=20px, each in `--paper-dim`. Title text center: `~/amplify — apps/web` in JetBrains Mono 14px `--paper-muted`.
- Body: JetBrains Mono 22px `--paper`, line-height 1.6, padding 40px.

Lines (all initially `opacity: 0`):

```
$ git log --oneline apps/web/src/lib/explainer-storyboard.ts | head -3
e0f0f28 chore: storyboard module
1a2b3c4 feat: explainer interview
d4e5f6a feat: video pipeline scaffolding

$ rm src/lib/explainer-storyboard.ts

$ git diff --stat HEAD~1
 apps/web/src/lib/explainer-storyboard.ts | <span class="b4-counter">000</span> ----------------------------

$ git commit -m "delete the ceiling"
```

Wrap each line in `<div class="b4-line">`. The deletion counter (`000`) is wrapped in `<span class="b4-counter">` for tween. The line-of-minuses (`----------------------------`) in `<span class="b4-dashes">`.

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });

// Lines 1-4 (git log + 3 commit lines) fade in at t=0.5, staggered
tl.from(
  ".b4-line.b4-log",
  {
    opacity: 0,
    duration: 0.3,
    stagger: 0.35,
  },
  0.5,
);

// Prompt line "$ rm ..." typed out character-by-character at t=2.0
const rmLine = document.querySelector(".b4-line-rm .b4-typed");
const rmText = "$ rm src/lib/explainer-storyboard.ts";
rmLine.textContent = "";
tl.to(
  {},
  {
    duration: rmText.length * 0.04,
    onUpdate: function () {
      const progress = this.progress();
      const chars = Math.floor(progress * rmText.length);
      rmLine.textContent = rmText.slice(0, chars);
    },
  },
  2.0,
);

// SFX tick at t=4.0 (when rm line completes)
tl.call(
  () => {
    if (window.__sfxTick) window.__sfxTick();
  },
  [],
  4.0,
);

// "git diff --stat" line fades in at t=5.0
tl.from(".b4-line-diffcmd", { opacity: 0, duration: 0.3 }, 5.0);
tl.from(".b4-line-diffstat", { opacity: 0, duration: 0.3 }, 5.3);

// Counter ticks 0 → 455 in --signal over 1.2s starting at t=5.6
tl.to(
  ".b4-counter",
  {
    innerText: 455,
    duration: 1.2,
    snap: { innerText: 1 },
    ease: "power2.out",
    color: "var(--signal)",
  },
  5.6,
);

// Dashes draw right-to-left in --signal
tl.from(
  ".b4-dashes",
  {
    width: 0,
    duration: 1.0,
    ease: "power2.out",
    color: "var(--signal)",
  },
  5.8,
);

// Commit line types at t=7.5
const commitLine = document.querySelector(".b4-line-commit .b4-typed");
const commitText = '$ git commit -m "delete the ceiling"';
commitLine.textContent = "";
tl.to(
  {},
  {
    duration: commitText.length * 0.03,
    onUpdate: function () {
      const progress = this.progress();
      const chars = Math.floor(progress * commitText.length);
      commitLine.textContent = commitText.slice(0, chars);
    },
  },
  7.5,
);

// Commit line briefly turns --signal then fades
tl.to(".b4-line-commit", { color: "var(--signal)", duration: 0.2 }, 8.6);
tl.to(".b4-line-commit", { opacity: 0.4, duration: 0.3 }, 9.0);

// Hold the terminal until exit at end of beat
window.__timelines["amplify-case-study-beat-4"] = tl;
```

**Inline SFX (Web Audio):**

```html
<script>
  // Inline SFX generator — called by the timeline at the tick moment
  window.__sfxTick = function () {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 600;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    o.stop(ctx.currentTime + 0.2);
  };
</script>
```

**Note**: SFX may not play during HyperFrames render mode (which doesn't capture audio from `AudioContext`). If the render pipeline doesn't capture inline-generated audio, the SFX is a visual-only beat — the counter and color change still land. Confirm via render output; if missing, add a tick.mp3 to `narration/` and switch to `<audio>` element triggered by the timeline.

- [ ] **Step 3: Lint + validate**

- [ ] **Step 4: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-4-delete.html \
  --times 0,0.8,1.8,3.5,5.5,6.8,8.0,9.5 \
  --output videos/amplify-case-study/master/snapshots/beat-4/
```

Verify:

- t=0: empty terminal
- t=0.8: first log line visible
- t=1.8: all log lines visible
- t=3.5: rm line mid-type
- t=5.5: diff stat line appearing
- t=6.8: counter at ~455, dashes drawn
- t=8.0: commit line mid-type
- t=9.5: terminal complete with all lines

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-4-delete.html
git commit -m "feat(videos/amplify-case-study): build beat 4 — delete"
```

---

## Task 5: Build Beat 5 — NEW PIPELINE (18 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-5-new-pipeline.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-5/`

**Reference:** STORYBOARD.md → BEAT 5 — NEW PIPELINE

This is the most complex beat. Read the storyboard section carefully before authoring.

- [ ] **Step 1: Read framework rules + storyboard section**

```bash
cat skills/hyperframes/SKILL.md skills/gsap/SKILL.md
grep -A 80 "BEAT 5 — NEW PIPELINE" videos/amplify-case-study/STORYBOARD.md
```

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-5"`, `data-duration="18"`.

Architecture diagram structure:

- 9 node "pills" in 2 rows
  - Row 1 (top, y=240px): `[interview]` → `[brief]` → `[SQS]` → `[worker]`
  - Row 2 (bottom, y=620px, anchored under [worker]): `[LLM composes]` → `[validate]` → `[render]` → `[MP4]`
  - Vertical connector from [worker] down to [LLM composes]
  - Retry arrow from [validate] back to [LLM composes] (curves up over the row)

Pill styling:

- 32px tall, padding 0 24px, border-radius 999px
- 1px `--ink-line` border, `--ink-elevated` background
- JetBrains Mono 18px `--paper-muted`
- Active state: border becomes `--signal`, background becomes `--signal-soft`, text becomes `--paper`
- Each pill is positioned absolutely (or use flex containers per row)

Connector hairlines: SVG `<line>` elements with `stroke-dasharray` for "draw-in" effect. Use `strokeDashoffset` from full length to 0.

GSAP timeline (~12s of motion + 6s hold):

```js
const tl = gsap.timeline({ paused: true });

// Top-right label
tl.from(".b5-label", { opacity: 0, duration: 0.4 }, 0);

// Row 1 nodes activate sequentially (each: 600ms apart)
["interview", "brief", "sqs", "worker"].forEach((id, i) => {
  tl.add(activateNode(`#b5-${id}`), 0.5 + i * 0.6);
  if (i < 3) {
    tl.add(drawLine(`#b5-line-${id}-to-${["brief", "sqs", "worker"][i]}`), 0.5 + i * 0.6 + 0.2);
  }
});

// Worker pulse (extra emphasis)
tl.to(
  "#b5-worker .b5-pill",
  {
    scale: 1.06,
    duration: 0.3,
    yoyo: true,
    repeat: 1,
  },
  2.9,
);

// Vertical drop from worker to Row 2
tl.add(drawLine("#b5-line-worker-down"), 3.5);

// Row 2 nodes activate sequentially
["llm", "validate", "render", "mp4"].forEach((id, i) => {
  tl.add(activateNode(`#b5-${id}`), 4.0 + i * 0.8);
  if (i < 3) {
    tl.add(drawLine(`#b5-line-${id}-to-${["validate", "render", "mp4"][i]}`), 4.0 + i * 0.8 + 0.2);
  }
});

// LLM code snippet panel slides in at t=4.5
tl.from(
  ".b5-code-panel",
  {
    x: -30,
    opacity: 0,
    duration: 0.5,
    ease: "power3.out",
  },
  4.5,
);

// Retry arrow draws back at t=6.0
tl.add(drawLine("#b5-retry-arrow"), 6.0);
tl.from(".b5-retry-label", { opacity: 0, duration: 0.4 }, 6.4);

// Retry loop flash — two cycles
tl.add(retryFlash(), 7.5);

// Final caption at t=10.0
tl.from(
  ".b5-caption .b5-word",
  {
    y: 24,
    opacity: 0,
    duration: 0.5,
    ease: "power3.out",
    stagger: 0.15,
  },
  10.0,
);

// Ambient pulse on retry arrow for the remaining hold
tl.to(
  "#b5-retry-arrow",
  {
    opacity: 0.6,
    duration: 1.0,
    ease: "sine.inOut",
    repeat: -1,
    yoyo: true,
  },
  12.0,
);

window.__timelines["amplify-case-study-beat-5"] = tl;

// --- Helpers, defined inline at top of script block ---
function activateNode(selector) {
  return gsap.to(selector + " .b5-pill", {
    borderColor: "var(--signal)",
    backgroundColor: "var(--signal-soft)",
    color: "var(--paper)",
    duration: 0.4,
  });
}
function drawLine(selector) {
  return gsap.fromTo(
    selector,
    { strokeDashoffset: "var(--len)" },
    { strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut" },
  );
}
function retryFlash() {
  const t = gsap.timeline();
  t.to("#b5-llm .b5-pill, #b5-validate .b5-pill", { scale: 1.03, duration: 0.2 });
  t.to("#b5-llm .b5-pill, #b5-validate .b5-pill", { scale: 1.0, duration: 0.2 });
  t.to("#b5-llm .b5-pill, #b5-validate .b5-pill", { scale: 1.03, duration: 0.2 });
  t.to("#b5-llm .b5-pill, #b5-validate .b5-pill", { scale: 1.0, duration: 0.2 });
  return t;
}
```

Code snippet panel: positioned absolute right side of Row 2 area. Show 4-5 lines of representative LLM call code in JetBrains Mono 14px `--paper`:

```
await openai.responses.create({
  model: 'gpt-5',
  input: [
    { role: 'system', content: skillBundle },
    { role: 'user', content: brief },
  ],
});
```

Caption text (top=920px, JetBrains Mono 18px not display — this is a small label, not the big caption): "The worker authors the whole composition." Wrap words in `<span class="b5-word">`. Actually use 56px Inter Tight 500 `--paper` per storyboard.

SVG architecture for connector lines:

- Each line: `<line>` with `stroke="var(--ink-soft)"`, stroke-width="1", initial `stroke-dasharray="var(--len)"`, `stroke-dashoffset="var(--len)"`. Define `--len` per line based on its actual length.

- [ ] **Step 3: Lint + validate**

- [ ] **Step 4: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-5-new-pipeline.html \
  --times 0,1.5,3.0,4.5,6.0,8.0,10.5,13.0,17.0 \
  --output videos/amplify-case-study/master/snapshots/beat-5/
```

Verify each frame matches storyboard description.

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-5-new-pipeline.html
git commit -m "feat(videos/amplify-case-study): build beat 5 — new pipeline"
```

---

## Task 6: Build Beat 6 — THE FALLBACK (8 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-6-fallback.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-6/`

**Reference:** STORYBOARD.md → BEAT 6 — THE FALLBACK

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-6"`, `data-duration="8"`.

This beat starts with the Beat 5 diagram already on screen (visually carried over). Since each beat is rendered independently, this beat needs to re-create the dimmed pipeline diagram in its initial state. Implementation:

- Statically render the pipeline diagram from Beat 5 in its end-state (all nodes activated), but at 60% opacity from the start of this beat.
- Position it in the upper 60% of canvas (transform: scale(0.85) translateY(-30px)).

Then animate:

- A horizontal hairline draws across the canvas at y=750px in `--ink-soft`, full width (1728px). 600ms.
- A `--ink-elevated` block draws in below the hairline (full width 1728px, height 120px, top=780px, centered horizontally, 1px `--ink-line` border, border-radius 8px).
- Center label: `template renderer (fallback)`, 28px JetBrains Mono 500 `--paper-muted`.
- 8px-thick base plate beneath the block (just an `--ink-line` rect at y=908px, full width, 4px tall).
- Dotted hairlines connecting the [MP4] node above to the fallback block below.
- At t=3.0: caption appears: "Floor solid. Ceiling ambitious." (56px Inter Tight 500 `--paper`, bottom-left at top=860px... wait, the fallback block is around there. Move caption to bottom-left of canvas: x=96, y=960px? No, that's below the canvas. Place caption above the pipeline at top=180px.)

Re-layout: put the caption at the TOP of the beat, above the pipeline carryover. Then the pipeline + hairline + fallback block stack below.

Hard-code the "Floor" word to land in `--paper` and "Ceiling" to land in `--signal`.

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });
// Hairline draws
tl.from(
  ".b6-divider",
  { scaleX: 0, duration: 0.6, ease: "power2.inOut", transformOrigin: "left center" },
  0.5,
);
// Fallback block draws
tl.from(
  ".b6-fallback-block",
  { opacity: 0, scaleX: 0, duration: 0.6, ease: "power3.out", transformOrigin: "center" },
  1.0,
);
tl.from(".b6-fallback-label", { opacity: 0, duration: 0.4 }, 1.5);
// Dotted connector lines
tl.from(".b6-dotted-connector", { strokeDashoffset: "var(--len)", duration: 0.6 }, 1.8);
// Caption word-by-word
tl.from(
  ".b6-cap-word",
  { y: 24, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.18 },
  3.0,
);
// Final hold (no animation)
window.__timelines["amplify-case-study-beat-6"] = tl;
```

- [ ] **Step 3: Lint + validate**

- [ ] **Step 4: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-6-fallback.html \
  --times 0,0.8,1.5,2.5,4.0,7.0 \
  --output videos/amplify-case-study/master/snapshots/beat-6/
```

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-6-fallback.html
git commit -m "feat(videos/amplify-case-study): build beat 6 — fallback"
```

---

## Task 7: Build Beat 7 — BESPOKE GRID (12 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-7-bespoke-grid.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-7/`

**Reference:** STORYBOARD.md → BEAT 7 — BESPOKE GRID

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-7"`, `data-duration="12"`.

Same 3×2 grid layout as Beat 2 (cells 480×270, 40px gap, anchored 150px from top), but each cell is a **visibly distinct mini-composition**. Top-right label: `amplify / 2026-05-19+`.

Cell designs (each rendered as inline HTML/CSS inside its `b7-cell`):

**Cell 1 — Warm-cream serif:**

```html
<div class="b7-cell b7-cell--warmpaper">
  <div class="b7-warmpaper-eyebrow">ESSAY · 02</div>
  <div class="b7-warmpaper-title">On The Quiet Power of Subtraction</div>
  <div class="b7-warmpaper-byline">— d. proctor</div>
</div>
```

Cell background: `#F7F1E6` (cream). Title in serif (use Google Font: `Lora` 600 italic 28px). Eyebrow: 11px caps mono `#7A6A55`. Byline: 12px italic.

**Cell 2 — Deep-navy oversized number:**

```html
<div class="b7-cell b7-cell--navynumber">
  <div class="b7-navynumber-num">42<span class="b7-navynumber-pct">%</span></div>
  <div class="b7-navynumber-cap">of agents that read the docs</div>
</div>
```

Cell background: gradient `linear-gradient(135deg, #0A1F3D, #1A3F75)`. Number in `--paper` 120px Inter Tight 600. Caption JetBrains Mono 14px `#B8C5DC`.

**Cell 3 — Mono paper manifesto:**

```html
<div class="b7-cell b7-cell--manifesto">
  <div class="b7-manifesto-bar"></div>
  <div class="b7-manifesto-title">Make<br />It<br />Move.</div>
  <div class="b7-manifesto-rule"></div>
</div>
```

Cell background: `#F2F0E8` paper. Title: 56px Inter Tight 500 `#0A0A0A`. Rule: 2px `#0A0A0A` 30% width at bottom. Bar at top: 12px tall `#22D67A` 60% width.

**Cell 4 — Gradient mesh + isometric icons:**

```html
<div class="b7-cell b7-cell--mesh">
  <div class="b7-mesh-bg"></div>
  <div class="b7-mesh-title">Six tools that ship</div>
  <div class="b7-mesh-icons">
    <span class="b7-mesh-ico">◆</span>
    <span class="b7-mesh-ico">▲</span>
    <span class="b7-mesh-ico">●</span>
    <span class="b7-mesh-ico">■</span>
    <span class="b7-mesh-ico">★</span>
  </div>
</div>
```

Background: conic-gradient mesh from `#FF6B9D` through `#9D6BFF` and `#6BFFD8`. Title overlay: 24px Inter Tight 500 white. Icons: 32px white, spaced.

**Cell 5 — Dark terminal aesthetic:**

```html
<div class="b7-cell b7-cell--terminal">
  <div class="b7-terminal-chrome"><span></span><span></span><span></span></div>
  <div class="b7-terminal-body">
    <div><span class="b7-terminal-prompt">$</span> deploy --env prod</div>
    <div class="b7-terminal-out">→ shipping…</div>
    <div><span class="b7-terminal-dot"></span> <span class="b7-terminal-success">ok</span></div>
  </div>
</div>
```

Background: `#08090B`. Mono 14px. Prompt in `--code`. Dot pulses `--signal`.

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });
// Label appears immediately
tl.from(".b7-label", { opacity: 0, duration: 0.4 }, 0);
// Cells populate one-by-one (stagger 0.4s)
tl.from(
  ".b7-cell",
  { opacity: 0, scale: 0.96, duration: 0.5, ease: "power3.out", stagger: 0.4 },
  0.3,
);
// Ambient motion per cell — each gets its own little life
tl.add(ambientCell2(), 3.0); // counter ticking
tl.add(ambientCell4(), 3.5); // mesh drift
tl.add(ambientCell5(), 3.8); // pulsing dot
// Caption at t=7.0
tl.from(
  ".b7-cap-word",
  { y: 24, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.12 },
  7.0,
);
// Hold the final state until exit
window.__timelines["amplify-case-study-beat-7"] = tl;

function ambientCell2() {
  return gsap.fromTo(
    ".b7-navynumber-num",
    { innerText: 0 },
    {
      innerText: 42,
      duration: 2.5,
      snap: { innerText: 1 },
      repeat: -1,
      yoyo: true,
      repeatDelay: 1,
    },
  );
}
function ambientCell4() {
  return gsap.to(".b7-mesh-bg", {
    rotation: 360,
    duration: 18,
    ease: "none",
    repeat: -1,
    transformOrigin: "center",
  });
}
function ambientCell5() {
  return gsap.to(".b7-terminal-dot", {
    opacity: 0.3,
    duration: 0.6,
    ease: "sine.inOut",
    yoyo: true,
    repeat: -1,
  });
}
```

Caption: "Now every video is its own thing." (caption styling same as Beat 2's, in cell 6).

- [ ] **Step 3: Lint + validate**

- [ ] **Step 4: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-7-bespoke-grid.html \
  --times 0,1.0,2.5,4.5,7.5,10.0,11.5 \
  --output videos/amplify-case-study/master/snapshots/beat-7/
```

Verify cells are **visibly distinct**.

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-7-bespoke-grid.html
git commit -m "feat(videos/amplify-case-study): build beat 7 — bespoke grid"
```

---

## Task 8: Build Beat 8 — LESSON (9 seconds)

**Files:**

- Create: `videos/amplify-case-study/master/compositions/beat-8-lesson.html`
- Snapshots: `videos/amplify-case-study/master/snapshots/beat-8/`

**Reference:** STORYBOARD.md → BEAT 8 — LESSON

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author the beat HTML**

Root: `data-composition-id="amplify-case-study-beat-8"`, `data-duration="9"`.

Pure ink canvas. Persistent hairline at bottom now spans the full 1728px width in `--signal` (this beat ANIMATES the hairline from its Beat 7 end-state to `scaleX: 1.0` of the full canvas).

Center pull-quote, 168px Inter Tight 600, line-height 1.05, center-aligned:

```
The shape of the schema
is the shape of the ceiling.
```

Two lines. Words wrapped in `<span class="b8-q-word">`. Special spans:

- The word "shape" (first occurrence in each line, so two `shape` words) in `<span class="b8-q-shape">` → color `--signal`
- The word "ceiling." in `<span class="b8-q-ceiling">` → color `--warn`

CTA: below the quote, 64px below the bottom edge of the quote. JetBrains Mono 22px `--paper-muted`, text:

```
read the full case study →
```

GSAP timeline:

```js
const tl = gsap.timeline({ paused: true });
// Hairline grows to full
tl.fromTo(
  ".hf-hairline, .b8-hairline",
  { scaleX: 0.85 },
  { scaleX: 1.0, duration: 1.0, ease: "power2.inOut", transformOrigin: "left center" },
  0,
);
// Pull quote words reveal
tl.from(
  ".b8-q-word",
  {
    y: 24,
    opacity: 0,
    duration: 0.6,
    ease: "power3.out",
    stagger: 0.18,
  },
  0.5,
);
// Hold 3s after the last word
// CTA fades in at t=6.0
tl.from(".b8-cta", { opacity: 0, duration: 0.6 }, 6.0);
// Hold until end of beat
// Final fade to black at end of beat
tl.to(".b8-root", { opacity: 0, duration: 0.6 }, 8.4);

window.__timelines["amplify-case-study-beat-8"] = tl;
```

- [ ] **Step 3: Lint + validate**

- [ ] **Step 4: Snapshot key frames**

```bash
npx hyperframes snapshot videos/amplify-case-study/master/compositions/beat-8-lesson.html \
  --times 0,1.5,3.5,5.5,7.0,9.0 \
  --output videos/amplify-case-study/master/snapshots/beat-8/
```

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/master/compositions/beat-8-lesson.html
git commit -m "feat(videos/amplify-case-study): build beat 8 — lesson"
```

---

## Task 9: Generate master narration MP3

**Files:**

- Create: `videos/amplify-case-study/narration/master-narration.mp3`
- Create: `videos/amplify-case-study/narration/master-transcript.json`

Use HyperFrames' built-in `tts` (Kokoro local model) as the default. If ElevenLabs is preferred and credentials are configured, use ElevenLabs directly.

- [ ] **Step 1: Construct the input script with per-line timing markers**

Build a text file `narration/master-script.txt` with one line per beat narration (per SCRIPT.md). The HyperFrames `tts` command will produce a single MP3 plus a transcript with word-level timestamps.

```
Three weeks ago, every explainer video our platform made looked the same.
The model only filled in strings. Layout, color, motion — all on us. The schema was the ceiling.
So we deleted it. Four hundred and fifty-five lines, gone.
Now the worker reads the brief, calls the model, and the model writes the whole composition. We validate. We retry. We ship.
The old template renderer is still there. Underneath. A floor we can trust. So the ceiling can be ambitious.
Now every video is its own thing. Same runtime. Different design.
The shape of the schema is the shape of the ceiling.
```

- [ ] **Step 2: Generate with Kokoro (default — no external API needed)**

```bash
npx hyperframes tts \
  --input videos/amplify-case-study/narration/master-script.txt \
  --output videos/amplify-case-study/narration/master-narration.mp3 \
  --voice am_eric \
  --speed 1.0 \
  --transcript videos/amplify-case-study/narration/master-transcript.json
```

(If `--voice` flag differs from `am_eric` syntax, run `npx hyperframes tts --help` and adjust. The voice should be a calm-confident American male.)

- [ ] **Step 3: Verify**

```bash
ls -la videos/amplify-case-study/narration/
ffprobe -v error -show_entries format=duration videos/amplify-case-study/narration/master-narration.mp3
```

Expected: MP3 exists, duration is approximately 30–50 seconds (depends on Kokoro pace).

- [ ] **Step 4: Listen (manual check)**

```bash
afplay videos/amplify-case-study/narration/master-narration.mp3
```

Confirm clarity, pace, no garbled words.

- [ ] **Step 5: Commit**

```bash
git add videos/amplify-case-study/narration/
git commit -m "feat(videos/amplify-case-study): generate master narration MP3"
```

---

## Task 10: Compose master/index.html

**Files:**

- Create: `videos/amplify-case-study/master/index.html`

This task assembles the 8 beat HTMLs into a single 87-second composition. Each beat becomes a `<div class="clip">` child of the root composition, with `data-start` and `data-duration` driving HyperFrames' visibility runtime. Beat-level GSAP timelines are stitched into a master timeline.

- [ ] **Step 1: Scaffold the root structure**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Amplify Case Study — Master</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@1,600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../shared/tokens.css" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 1920px;
        height: 1080px;
        background: var(--ink);
      }
      /* Per-beat styles merged below */
    </style>
  </head>
  <body>
    <div
      id="stage"
      data-composition-id="amplify-case-study-master"
      data-start="0"
      data-duration="87"
      data-width="1920"
      data-height="1080"
    >
      <!-- 8 beats as <div class="clip"> children -->
      <!-- Beat 1 -->
      <div class="clip b1-root" data-start="0" data-duration="7" data-track-index="0">
        <!-- (Beat 1 scene markup copied in, with <style> moved to head) -->
      </div>
      <!-- Beat 2 -->
      <div class="clip b2-root" data-start="7" data-duration="10" data-track-index="0">
        <!-- (Beat 2 scene markup copied in) -->
      </div>
      <!-- ... continues for beats 3–8 ... -->

      <!-- Audio narration -->
      <audio
        id="narration"
        data-start="0"
        data-duration="87"
        data-track-index="1"
        data-volume="1.0"
        src="../narration/master-narration.mp3"
      ></audio>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      // Each beat's <script> block was already moved into the body
      // (see merge step below). Each beat's <script> registers
      // window.__timelines["amplify-case-study-beat-N"] = tl
      // synchronously when the beat's clip becomes active.
      // The HyperFrames runtime drives each beat's timeline via
      // its `data-start` offset and the registered timeline key.
    </script>
  </body>
</html>
```

- [ ] **Step 2: Merge beat content**

For each beat HTML (`compositions/beat-1-hook.html` through `compositions/beat-8-lesson.html`):

1. Extract the `<template>` contents — the actual scene markup.
2. Wrap in `<div class="clip b<N>-root" data-start="<offset>" data-duration="<N>">` inside `#stage`.
3. Move the beat's `<style>` block to the master `<head>` `<style>` block.
4. Move the beat's `<script>` block to the bottom of `<body>`. Each beat's script must self-defend: check `if (!document.querySelector('[data-composition-id="amplify-case-study-beat-N"]')) return;` before running.

`data-start` offsets per beat:

| Beat | data-start | data-duration |
| ---- | ---------- | ------------- |
| 1    | 0          | 7             |
| 2    | 7          | 10            |
| 3    | 17         | 13            |
| 4    | 30         | 10            |
| 5    | 40         | 18            |
| 6    | 58         | 8             |
| 7    | 66         | 12            |
| 8    | 78         | 9             |

- [ ] **Step 3: Lint composition**

```bash
npx hyperframes lint videos/amplify-case-study/master/index.html
```

Expected: PASS.

- [ ] **Step 4: Validate composition**

```bash
npx hyperframes validate videos/amplify-case-study/master/index.html
```

Expected: PASS. All 8 beat timelines register on `window.__timelines`.

- [ ] **Step 5: Preview in browser**

```bash
npx hyperframes preview videos/amplify-case-study/master/index.html
```

Open the localhost URL it prints. Scrub the timeline. Verify each beat transitions smoothly into the next.

- [ ] **Step 6: Commit**

```bash
git add videos/amplify-case-study/master/index.html
git commit -m "feat(videos/amplify-case-study): compose master cut index.html"
```

---

## Task 11: Render master MP4

**Files:**

- Create: `videos/amplify-case-study/renders/master-16x9.mp4`

- [ ] **Step 1: Render**

```bash
npx hyperframes render videos/amplify-case-study/master/index.html \
  --output videos/amplify-case-study/renders/master-16x9.mp4 \
  --width 1920 \
  --height 1080 \
  --fps 30
```

Expected: completes in 1–3 minutes (single-machine render). On macOS, expect screenshot-mode fallback (a diagnostic will appear); on Linux with `chrome-headless-shell`, BeginFrame mode runs.

- [ ] **Step 2: Verify output**

```bash
ls -la videos/amplify-case-study/renders/
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,codec_name videos/amplify-case-study/renders/master-16x9.mp4
```

Expected:

- Duration: ~87s
- Width: 1920, Height: 1080
- Codec: h264 (or hevc on Apple Silicon depending on hyperframes default)

- [ ] **Step 3: Watch end-to-end (manual)**

```bash
open videos/amplify-case-study/renders/master-16x9.mp4
```

Watch in full. Check for:

- All 8 beats visible
- Narration synced to beats
- No frozen/empty frames
- No clipped/runaway animations

If any beat is broken, identify it and return to that beat's task to fix.

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/renders/master-16x9.mp4
git commit -m "feat(videos/amplify-case-study): render master 16:9 MP4"
```

---

## Task 12: Generate short narration MP3

**Files:**

- Create: `videos/amplify-case-study/narration/short-narration.mp3`
- Create: `videos/amplify-case-study/narration/short-transcript.json`

Same procedure as Task 9, with the short cut script (per SCRIPT.md).

- [ ] **Step 1: Write `narration/short-script.txt`**

```
Three weeks ago, every explainer video looked the same.
So we deleted it. Four hundred and fifty-five lines, gone.
Now every video is its own thing.
The shape of the schema is the shape of the ceiling.
```

- [ ] **Step 2: Generate**

```bash
npx hyperframes tts \
  --input videos/amplify-case-study/narration/short-script.txt \
  --output videos/amplify-case-study/narration/short-narration.mp3 \
  --voice am_eric \
  --speed 1.0 \
  --transcript videos/amplify-case-study/narration/short-transcript.json
```

- [ ] **Step 3: Verify**

```bash
ffprobe -v error -show_entries format=duration videos/amplify-case-study/narration/short-narration.mp3
```

Expected: ~15–22 seconds.

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/narration/short-script.txt videos/amplify-case-study/narration/short-narration.mp3 videos/amplify-case-study/narration/short-transcript.json
git commit -m "feat(videos/amplify-case-study): generate short narration MP3"
```

---

## Task 12.5: Short cut project scaffold — `short/index.html` stub

**Why this exists:** `hyperframes lint`/`validate`/`snapshot` all need a project DIR with an `index.html` root. Authoring sbeat-N.html files in `short/compositions/` without a parent project means none of them can be linted or snapshot-verified in isolation. This task lands the parent project shell once so every subsequent sbeat task can validate as it goes.

**Files:**

- Create: `videos/amplify-case-study/short/index.html`

The stub mirrors `master/index.html`'s structure: 1080×1080 stage, four empty `<div class="clip" data-composition-src="compositions/sbeat-N-*.html" ...>` clip slots with correct `data-start`/`data-duration` from the 30s short timeline (per SCRIPT.md and STORYBOARD.md), the design-token `<style>` block inlined (so `validate` works without `shared/`), the narration `<audio>` chain pointing at `narration/short-narration.mp3` and (later) per-line MP3s, and an empty paused master GSAP timeline.

- [ ] **Step 1: Author `short/index.html`** with the four sbeat clip slots even though the referenced `compositions/sbeat-N-*.html` files don't exist yet. The runtime will degrade gracefully on missing children; lint/validate of the index alone should pass.

- [ ] **Step 2: Lint the project DIR**

```bash
npx hyperframes lint videos/amplify-case-study/short
```

- [ ] **Step 3: Commit**

```bash
git add videos/amplify-case-study/short/index.html
git commit -m "feat(videos/amplify-case-study): scaffold short/index.html stub (bd-y0y Task 12.5)"
```

---

## Task 13: Short Beat 1 — Template Grid (8s, 1:1)

**Files:**

- Create: `videos/amplify-case-study/short/compositions/sbeat-1-template-grid.html`

Adapted from Master Beat 2, recomposed for 1080×1080. 2×2 grid (4 templated thumbnails). Caption full-width at bottom.

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author**

Root: `data-composition-id="amplify-case-study-short-1"`, `data-duration="8"`, `data-width="1080"`, `data-height="1080"`.

Layout:

- 2×2 grid centered (cells 440×248 with 32px gap), anchored 120px from top
- 4 templated thumbnails using same eyebrow+title+warn-bar layout from Beat 2 (first 4 entries)
- Caption full-width at bottom, y=900px, x=64, width=952px, Inter Tight 500 56px `--paper`: "Every video looked the same." (word-by-word reveal)

GSAP timeline: same as Master Beat 2 (cells populate stagger, synced pulse, caption reveal). Compress to 8s by tightening stagger.

- [ ] **Step 3: Lint + validate + snapshot**

```bash
# Lint/validate/snapshot operate on the project DIR (videos/amplify-case-study/short),
# which must already exist with an index.html (see Task 12.5). The clip referenced
# from short/index.html drives which composition the runtime activates.
npx hyperframes lint videos/amplify-case-study/short
npx hyperframes validate videos/amplify-case-study/short
npx hyperframes snapshot videos/amplify-case-study/short \
  --at 0,1.5,3.5,6.0,7.8
# Snapshots write under videos/amplify-case-study/short/snapshots/<composition-id>/
```

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/short/compositions/sbeat-1-template-grid.html
git commit -m "feat(videos/amplify-case-study): build short beat 1 — template grid"
```

---

## Task 14: Short Beat 2 — The Delete (6s, 1:1)

**Files:**

- Create: `videos/amplify-case-study/short/compositions/sbeat-2-delete.html`

Adapted from Master Beat 4. Terminal sequence compressed.

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author**

Root: `data-composition-id="amplify-case-study-short-2"`, `data-duration="6"`, `data-width="1080"`, `data-height="1080"`.

Layout:

- Terminal centered, 920×620, padding 32px
- Show only:
  - `$ rm src/lib/explainer-storyboard.ts` (typed in over 1.5s, starting at t=0.3)
  - `−455 lines` ticker (starts at t=2.5, ticks for 1.2s)
- Both in JetBrains Mono 32px (larger than master beat 4 to compensate for square aspect)

Skip the git-log preamble and the commit line (no time for them).

- [ ] **Step 3: Lint + validate + snapshot**

```bash
npx hyperframes snapshot videos/amplify-case-study/short \
  --at 0,1.0,2.5,4.0,5.5
# Snapshots write under videos/amplify-case-study/short/snapshots/<composition-id>/
```

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/short/compositions/sbeat-2-delete.html
git commit -m "feat(videos/amplify-case-study): build short beat 2 — delete"
```

---

## Task 15: Short Beat 3 — Bespoke Grid (10s, 1:1)

**Files:**

- Create: `videos/amplify-case-study/short/compositions/sbeat-3-bespoke-grid.html`

Adapted from Master Beat 7. 2×2 grid with 4 distinct designs (pick the strongest 4 from Master Beat 7's 5 cells).

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author**

Same 2×2 grid as Short Beat 1, but each cell is a distinct mini-composition (pick Master Beat 7's Cell 1, Cell 2, Cell 3, and Cell 5 — skip Cell 4 mesh since it's the busiest and may not read at smaller size).

Caption full-width at bottom: "Now every video is its own thing."

GSAP timeline: cell-by-cell reveal, ambient motion inside each cell, caption reveal at t=6.5.

- [ ] **Step 3: Lint + validate + snapshot**

```bash
npx hyperframes snapshot videos/amplify-case-study/short \
  --at 0,1.5,3.5,5.5,7.5,9.5
```

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/short/compositions/sbeat-3-bespoke-grid.html
git commit -m "feat(videos/amplify-case-study): build short beat 3 — bespoke grid"
```

---

## Task 16: Short Beat 4 — Lesson (6s, 1:1)

**Files:**

- Create: `videos/amplify-case-study/short/compositions/sbeat-4-lesson.html`

Adapted from Master Beat 8. Pull quote sized for 1:1.

- [ ] **Step 1: Read framework rules**

- [ ] **Step 2: Author**

Root: `data-composition-id="amplify-case-study-short-4"`, `data-duration="6"`, `data-width="1080"`, `data-height="1080"`.

Layout:

- Center pull-quote, 88px Inter Tight 600, two lines, center-anchored at y=400px:

  ```
  The shape of the schema
  is the shape of the ceiling.
  ```

- "shape" words in `--signal`, "ceiling." in `--warn`.
- CTA below, y=720px, JetBrains Mono 20px `--paper-muted`: `read the full case study →`
- Persistent hairline along bottom (full width in `--signal`)

GSAP timeline: word reveal, hold, CTA fade-in, final fade-to-black.

- [ ] **Step 3: Lint + validate + snapshot**

```bash
npx hyperframes snapshot videos/amplify-case-study/short \
  --at 0,1.5,3.0,4.5,6.0
```

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/short/compositions/sbeat-4-lesson.html
git commit -m "feat(videos/amplify-case-study): build short beat 4 — lesson"
```

---

## Task 17: Compose short/index.html

**Files:**

- Create: `videos/amplify-case-study/short/index.html`

Same merging procedure as Task 10, but for the short cut.

- [ ] **Step 1: Scaffold**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Amplify Case Study — Short</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Lora:ital,wght@1,600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../shared/tokens.css" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        width: 1080px;
        height: 1080px;
        background: var(--ink);
      }
      /* Per-beat styles merged below */
    </style>
  </head>
  <body>
    <div
      id="stage"
      data-composition-id="amplify-case-study-short"
      data-start="0"
      data-duration="30"
      data-width="1080"
      data-height="1080"
    >
      <!-- Short Beats -->
      <div class="clip sb1-root" data-start="0" data-duration="8" data-track-index="0"></div>
      <div class="clip sb2-root" data-start="8" data-duration="6" data-track-index="0"></div>
      <div class="clip sb3-root" data-start="14" data-duration="10" data-track-index="0"></div>
      <div class="clip sb4-root" data-start="24" data-duration="6" data-track-index="0"></div>
      <audio
        id="narration"
        data-start="0"
        data-duration="30"
        data-track-index="1"
        data-volume="1.0"
        src="../narration/short-narration.mp3"
      ></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
    </script>
  </body>
</html>
```

- [ ] **Step 2: Merge beat content** (same procedure as Task 10 Step 2, but for the 4 short beats)

- [ ] **Step 3: Lint + validate + preview**

```bash
npx hyperframes lint videos/amplify-case-study/short/index.html
npx hyperframes validate videos/amplify-case-study/short/index.html
npx hyperframes preview videos/amplify-case-study/short/index.html
```

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/short/index.html
git commit -m "feat(videos/amplify-case-study): compose short cut index.html"
```

---

## Task 18: Render short MP4

**Files:**

- Create: `videos/amplify-case-study/renders/short-1x1.mp4`

- [ ] **Step 1: Render**

```bash
npx hyperframes render videos/amplify-case-study/short/index.html \
  --output videos/amplify-case-study/renders/short-1x1.mp4 \
  --width 1080 \
  --height 1080 \
  --fps 30
```

- [ ] **Step 2: Verify**

```bash
ffprobe -v error -show_entries format=duration -show_entries stream=width,height videos/amplify-case-study/renders/short-1x1.mp4
```

Expected: duration ~30s, 1080×1080.

- [ ] **Step 3: Watch (manual)**

```bash
open videos/amplify-case-study/renders/short-1x1.mp4
```

- [ ] **Step 4: Commit**

```bash
git add videos/amplify-case-study/renders/short-1x1.mp4
git commit -m "feat(videos/amplify-case-study): render short 1:1 MP4"
```

---

## Task 19: Final verification + project README

**Files:**

- Create: `videos/amplify-case-study/README.md`

- [ ] **Step 1: Watch both renders end-to-end (manual)**

```bash
open videos/amplify-case-study/renders/master-16x9.mp4
open videos/amplify-case-study/renders/short-1x1.mp4
```

Verify:

- Narration syncs to visuals in both cuts
- No frozen frames or black frames
- All 8 master beats visible
- All 4 short beats visible
- Color palette consistent across both cuts
- Typography consistent across both cuts

- [ ] **Step 2: Write README**

````markdown
# Amplify Case Study Explainer

Two HyperFrames compositions accompanying the Substack case study
_"We Pulled the Storyboard Module — and Got Better Videos."_

## Outputs

- `renders/master-16x9.mp4` — 87-second master cut, 1920×1080. For embedding
  at the top of the article and full-width social posts.
- `renders/short-1x1.mp4` — 30-second short cut, 1080×1080. For LinkedIn
  feed and Substack Notes.

## Build

```bash
# Render both cuts
npx hyperframes render master/index.html --output renders/master-16x9.mp4 --width 1920 --height 1080 --fps 30
npx hyperframes render short/index.html --output renders/short-1x1.mp4 --width 1080 --height 1080 --fps 30
```
````

## Source

- `DESIGN.md` — visual system
- `STORYBOARD.md` — beat-by-beat plan
- `SCRIPT.md` — narration script
- `PLAN.md` — implementation plan
- `master/compositions/` — individual beat HTML files
- `short/compositions/` — short cut beat HTMLs
- `shared/tokens.css` — shared design tokens

````

- [ ] **Step 3: Commit**

```bash
git add videos/amplify-case-study/README.md
git commit -m "docs(videos/amplify-case-study): add project README"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-Review Checklist (done)

- **Spec coverage:** Every beat in `STORYBOARD.md` maps to a task (Beats 1–8 → Tasks 1–8; short cut → Tasks 13–16). Narration → Tasks 9 + 12. Renders → Tasks 11 + 18. Design system → Task 0 (shared tokens). All visual-system rules from `DESIGN.md` are referenced inline in beat tasks.

- **Placeholder scan:** No TBDs. Every step has actual content. The `am_eric` voice flag may need adjustment based on the actual `hyperframes tts --help` output — flagged inline at Task 9 Step 2.

- **Type consistency:** Composition IDs use consistent naming: `amplify-case-study-beat-<N>` for master, `amplify-case-study-short-<N>` for short cut. Timeline registration keys match. Beat class prefixes (`b1-` through `b8-`, `sb1-` through `sb4-`) are unique.

- **Scope check:** 19 tasks is a lot, but each is a self-contained beat or pipeline step. Subagent-driven-development is the right execution sub-skill — one subagent per task, two-stage review between.

---

## Execution

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — Fresh subagent per task, spec-compliance review + code-quality review between tasks, fast iteration. Good for this plan because each beat is independent and benefits from clean context.

2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints. Lower overhead but context accumulates across tasks.
````
