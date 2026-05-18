# Amplifier Composition Constraints

These constraints are non-negotiable. The Amplifier worker will reject and retry any
composition that violates them.

## Required structure

- The composition root element MUST have:
  - `data-composition-id="amplifier-explainer"`
  - `data-width="1920"`
  - `data-height="1080"`
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

## Remote scripts

- Allowed: `cdnjs.cloudflare.com/ajax/libs/gsap/...` only.
- No other remote scripts.

## Output format

You return JSON via structured output. The `indexHtml` field is the complete
`<!doctype html>` document. The `narration` array is per-scene narration text the
worker will pass to ElevenLabs (include only when voice is enabled).
