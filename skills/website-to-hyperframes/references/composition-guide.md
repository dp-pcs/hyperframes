# Composition Authoring Guide

This is what you read when filling a composition template. The template already has the structural skeleton (background layer, grain overlay, scene-content wrapper, timeline registration). You fill in the creative content.

**Take your time.** A well-animated composition with 30+ GSAP calls, 5+ easings, and continuous mid-scene activity is worth far more than a rushed one with 10 calls. Read the storyboard section thoroughly. Read DESIGN.md for exact colors. If the template includes a commented-out HTML-in-Canvas scaffold — read `docs/guides/html-in-canvas.mdx` and consider using it for hero treatments. Don't skip reads to save time.

---

## Process

### 1. Read the beat's storyboard section

Know the mood, visual description, assets, animation choreography, and transition before writing any HTML.

### 2. Build the static end-state first

Position every element where it should be at its **most visible moment**. Write this as static HTML+CSS inside the `<div class="scene-content">` wrapper. No GSAP yet. The CSS position is the ground truth — animations describe the journey to and from it.

### 3. Add entrance animations

Use `tl.fromTo()` — animate FROM offscreen/invisible TO the CSS position. Prefer `fromTo` over `from` because `from()` has `immediateRender: true` which causes elements to flash or vanish when seeked non-linearly.

```js
// GOOD: deterministic at every timeline position
tl.fromTo(el, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.2);
```

### 4. Add mid-scene activity

Every visible element must keep moving after its entrance. A still element on a still background is a JPEG with a progress bar.

| Element type       | Mid-scene motion                                                            |
| ------------------ | --------------------------------------------------------------------------- |
| Image / screenshot | Slow zoom (scale 1→1.03), slow pan, or Ken Burns                            |
| Stat / number      | Counter animates from 0 to target                                           |
| Logo / icon        | Subtle float (y ±4-6px, sine.inOut, yoyo) or breathing scale (1→1.02, yoyo) |
| Text block         | Letter-spacing settle, color shift, or emphasis pulse on key word           |
| Background         | Slow drift, glow pulse, or particle motion                                  |

### 5. Add exit (if CSS transition)

If the storyboard specifies a CSS transition out, add the exit animation. If the storyboard specifies a shader transition, do NOT add exit animations — the shader handles the visual blend.

---

## Depth Layers

Every composition needs three visual layers. The template provides the structure:

| Layer          | Where in template             | What to fill                                         |
| -------------- | ----------------------------- | ---------------------------------------------------- |
| **Background** | `<div class="bg">`            | Radial glow, grid, particles, blurred screenshot     |
| **Grain**      | Pre-built in template         | Already done — don't modify                          |
| **Content**    | `<div class="scene-content">` | Main text, images, logos, data cards, all animations |

Choose background treatment that fits the brand: tech → dot grid or particles, luxury → radial glow, editorial → subtle gradient.

---

## Asset Presentation

Never embed a raw flat image. Every image needs motion treatment:

- **Perspective tilt**: `gsap.set(el, { transformPerspective: 1200, rotationY: -8 })` + `box-shadow`
- **Slow zoom (Ken Burns)**: `tl.to(img, { scale: 1.04, duration: beatDuration, ease: "none" }, 0)`
- **Device frame**: Wrap in a shape with `border-radius` + `box-shadow`

**Never stack two transform tweens on the same element.** A `y` entrance + `scale` Ken Burns on the same `<img>` breaks — the second tween's `immediateRender` overwrites the first. Fix: combine into one `fromTo`, or split across parent (entrance) + child (Ken Burns).

---

## Animation Density

**Target: 15+ GSAP calls per composition, 3+ different easings.**

Production compositions average 30-70 GSAP calls (6/second). If yours has fewer than 15, add more: varied entrance timings, ambient loops, emphasis pulses, background motion.

### Easing vocabulary

Use at least 3 different easings. Match intensity to the beat's emotion:

| Family        | Character            | Use for                             |
| ------------- | -------------------- | ----------------------------------- |
| `power2.out`  | Smooth, professional | Default entrances                   |
| `power3.out`  | Dramatic, confident  | Hero text, main image               |
| `back.out(2)` | Playful overshoot    | Logo reveals, badge pops            |
| `elastic.out` | Spring bounce        | Panel scatter, energetic drops      |
| `expo.out`    | Extreme deceleration | Premium reveals                     |
| `sine.inOut`  | Smooth, organic      | Ambient float, breathing, Ken Burns |
| `power4.out`  | Sharp snap           | Stat counter landing, cut emphasis  |
| `steps(N)`    | Discrete jumps       | Typing effects, cursor blink        |

---

## Critical Rules

These produce broken output if violated:

- **No `repeat: -1`** — calculate exact repeats: `Math.ceil(duration / cycle) - 1`
- **No `Math.random()`** — use a seeded PRNG if you need randomness
- **No bare `gsap.to()`** — all tweens must be on `tl` (the timeline), never standalone. Standalone tweens don't scrub with the capture engine.
- **No CSS `transform` for centering** — use `display:flex; align-items:center; justify-content:center` on a wrapper. GSAP overwrites CSS transforms.
- **No full-screen dark linear gradients** — H.264 creates visible banding. Use solid colors + localized radial glows.
- **Minimum font sizes**: 60px+ headlines, 20px+ body, 16px+ labels
- **Synchronous timeline construction** — no async/await wrapping timeline code
- **Register the timeline**: `window.__timelines["comp-id"] = tl` (already in the template)

---

## HTML-in-Canvas

For visually ambitious beats — 3D device mockups, shader effects, post-processing — use the `drawElementImage` API. It captures live DOM as a GPU texture at 60fps.

Pattern: put HTML inside `<canvas layoutsubtree>`, call `ctx.drawElementImage(element, x, y, w, h)`, use as Three.js `CanvasTexture`. Read `docs/guides/html-in-canvas.mdx` for full code patterns. HyperFrames auto-enables the Chrome flag during renders.

Use this when flat perspective tilt isn't enough — when the creative vision calls for 3D depth, shader distortion, or cinematic post-processing.
