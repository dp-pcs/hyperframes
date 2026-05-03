# HyperFrames Composition Project

## Skills — USE THESE FIRST

**Always invoke the relevant skill before writing or modifying compositions.** The default HyperFrames video skill is lightweight: it checks the local environment before CLI use and keeps the core composition contract in context. Runtime-specific skills encode patterns that are NOT in generic web docs.

| Skill                    | Command                 | When to use                                                                                |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| **hyperframes**          | `/hyperframes`          | Default lightweight video entry point, environment preflight, core composition contract    |
| **hyperframes-cli**      | `/hyperframes-cli`      | CLI commands: init, lint, preview, render, transcribe, tts                                 |
| **hyperframes-registry** | `/hyperframes-registry` | Installing blocks and components via `hyperframes add`                                     |
| **tailwind**             | `/tailwind`             | Tailwind v4 browser-runtime styles for projects created with `hyperframes init --tailwind` |
| **gsap**                 | `/gsap`                 | GSAP animations for HyperFrames — tweens, timelines, easing, performance                   |
| **animejs**              | `/animejs`              | Anime.js animations registered on `window.__hfAnime`                                       |
| **css-animations**       | `/css-animations`       | CSS keyframes that HyperFrames can pause and seek                                          |
| **lottie**               | `/lottie`               | `lottie-web` and dotLottie players registered on `window.__hfLottie`                       |
| **three**                | `/three`                | Three.js scenes rendered from HyperFrames `hf-seek` events                                 |
| **waapi**                | `/waapi`                | Web Animations API motion driven through `document.getAnimations()`                        |

Optional full-production skills may also be available:

| Optional skill             | Command                   | When to use                                               |
| -------------------------- | ------------------------- | --------------------------------------------------------- |
| **hyperframes-production** | `/hyperframes-production` | Detailed authoring, captions, TTS, audio-reactive visuals |
| **website-to-hyperframes** | `/website-to-hyperframes` | Full website-to-video pipeline                            |

> **Skills not available?** Ask the user to run `npx hyperframes skills` and restart their
> agent session, or install manually: `npx skills add heygen-com/hyperframes --full-depth`.

## Commands

```bash
npm run dev          # preview in browser (studio editor)
npm run check        # lint + validate + inspect
npm run render       # render to MP4
npm run publish      # publish and get a shareable link
npx hyperframes lint --verbose  # include info-level findings
npx hyperframes lint --json     # machine-readable output for CI
npx hyperframes docs <topic> # reference docs in terminal
```

## Documentation

**For quick reference**, use the local CLI docs command (no network required):

```bash
npx hyperframes docs <topic>
```

Topics: `data-attributes`, `gsap`, `compositions`, `rendering`, `examples`, `troubleshooting`

**For full documentation**, discover pages via the machine-readable index — do NOT guess URLs:

```
https://hyperframes.heygen.com/llms.txt
```

## Project Structure

- `index.html` — main composition (root timeline)
- `compositions/` — sub-compositions referenced via `data-composition-src`
- `meta.json` — project metadata (id, name)
- `transcript.json` — whisper word-level transcript (if generated)

## Linting — ALWAYS RUN AFTER CHANGES

After creating or editing any `.html` composition, **always** run the full check before considering the task complete:

```bash
npm run check
```

Fix all errors before presenting the result. Inspect warnings should be reviewed before rendering.

## Key Rules

1. Every timed element needs `data-start`, `data-duration`, and `data-track-index`
2. Elements with timing **MUST** have `class="clip"` — the framework uses this for visibility control
3. Timelines must be paused and registered on `window.__timelines`:
   ```js
   window.__timelines = window.__timelines || {};
   window.__timelines["composition-id"] = gsap.timeline({ paused: true });
   ```
4. Videos use `muted` with a separate `<audio>` element for the audio track
5. Sub-compositions use `data-composition-src="compositions/file.html"` to reference other HTML files
6. Only deterministic logic — no `Date.now()`, no `Math.random()`, no network fetches
