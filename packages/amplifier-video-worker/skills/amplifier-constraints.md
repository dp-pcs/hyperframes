# Amplifier Composition Constraints

These constraints are non-negotiable. The Amplifier worker will reject and retry any
composition that violates them.

## Required structure

- The composition root element MUST have:
  - `data-composition-id="amplifier-explainer"`
  - `data-width` and `data-height` MUST match the aspect ratio in the user prompt header.
    Use these pixel dimensions:
    - 16:9 → `data-width="1920" data-height="1080"`
    - 1:1 → `data-width="1080" data-height="1080"`
    - 9:16 → `data-width="1080" data-height="1920"`
  - `data-duration="<targetDurationSeconds>"` — matches the brief's target duration in seconds.
- The composition MUST register a paused GSAP master timeline as:
  ```js
  window.__timelines = window.__timelines || {};
  window.__timelines["amplifier-explainer"] = tl; // tl = gsap.timeline({ paused: true })
  ```
- Every scene clip MUST have `data-start` and `data-duration` attributes.
- Scene clips MUST NOT carry inline `visibility:hidden` or `opacity:0` styles. The
  Hyperframes runtime drives visibility from `data-start`/`data-duration`. Animate inner
  elements (text, cards) with opacity if you want fade-ins.

## Audio

- If the brief has voiceover enabled, the composition MUST include
  `<audio id="narration-track" src="./narration.mp3" data-start="0" data-duration="<targetDurationSeconds>" data-track-index="8"></audio>`.
  The worker writes `narration.mp3` next to `index.html`.
- If voiceover is disabled, do not include an `<audio>` track.

## Aspect-ratio safe zones

The user prompt header tells you the target aspect ratio and exact pixel dimensions.
Lay out the composition so:

- 16:9: keep focal content inside the central 92% of the frame; captions in the lower third.
- 1:1: SQUARE — keep focal content inside the central 80%; captions in the bottom 20%, well clear of edges; do NOT assume landscape width for typography or image placement.
- 9:16: PORTRAIT — vertical stack; captions in the lower 25%; never use a landscape-only layout.

## Author attribution

When the user prompt header specifies an "Author reference style" line, follow it for ALL narration text and any on-screen author credit:

- `first_name` — refer to the author by first name throughout (casual, conversational).
- `formal_third` — refer to the author formally in the third person (e.g., "the author argues…"). Avoid first names.
- `full_attribution` — use the author's full name on first mention, then first or last name as natural thereafter.

When no style is specified, default to `full_attribution`.

## Remote scripts

- Allowed: `cdnjs.cloudflare.com/ajax/libs/gsap/...` only.
- No other remote scripts.

## Output format

You return JSON via structured output. The `indexHtml` field is the complete
`<!doctype html>` document. The `narration` array is per-scene narration text the
worker will pass to ElevenLabs (include only when voice is enabled).
