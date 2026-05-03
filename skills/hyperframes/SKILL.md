---
name: hyperframes
description: Default lightweight video skill for HyperFrames HTML video work. Use when asked to create, edit, preview, render, or troubleshoot videos, animations, title cards, overlays, captions, or HyperFrames compositions, or when the HyperFrames CLI/docs are needed. This default skill has no bundled runtime dependencies; before running CLI commands, verify Node.js, FFmpeg, and browser availability with the preflight below, and surface missing dependencies instead of assuming they are installed. If the user needs detailed composition authoring and the optional hyperframes-production skill is unavailable, prompt them to install the full-depth skill set with `npx skills add heygen-com/hyperframes --full-depth` or `npx hyperframes skills`.
---

# HyperFrames

HyperFrames turns HTML compositions into video. This default video skill is intentionally small: it tells the agent that HyperFrames is the video path, how to enter the CLI safely, and where to load deeper guidance when available.

## Preflight

Before running any HyperFrames CLI command:

1. Check the local runtime first:
   ```bash
   node --version
   ```
   Known minimum runtime for the current CLI is Node.js 20.12+. Supported and CI-tested baseline is Node.js 22+. If Node is missing or older than 20.12, stop and tell the user exactly what is missing. If Node is 20.12-21.x, continue only after surfacing that it is below the supported baseline and package managers may warn because package manifests still declare Node.js 22+.
2. Run the CLI diagnostics:
   ```bash
   npx hyperframes doctor
   ```
3. If diagnostics report missing FFmpeg, FFprobe, Chrome, Docker, or low system resources, stop before render-only workflows and surface the exact failed check plus install hint. Do not try to render and let it crash. Do not install large dependencies or download a browser unless the user asks you to.
4. Prefer `npx hyperframes <command>` or project `npm run` scripts. Do not require a global HyperFrames install.

If Chrome is the only missing dependency and the user wants the CLI to manage it, use:

```bash
npx hyperframes browser ensure
```

## Workflow

- For CLI syntax, use the `hyperframes-cli` skill or `npx hyperframes docs <topic>`.
- For registry blocks/components, use the `hyperframes-registry` skill.
- For GSAP, Tailwind, Anime.js, CSS animations, Lottie, Three.js, or WAAPI, use the dedicated skill for that runtime.
- If the optional `hyperframes-production` skill is installed, use it for detailed composition authoring, captions, TTS, audio-reactive animation, and transitions.
- If the user is asking for detailed composition authoring and `hyperframes-production` is not installed, tell them they may have installed only the lightweight default skill. Prompt them to run `npx skills add heygen-com/hyperframes --full-depth` or `npx hyperframes skills`, then restart the agent session. For a basic edit or quick fix, continue with this skill's minimal contract.

## Minimal Composition Contract

- Root composition: `data-composition-id`, `data-width`, and `data-height`.
- Timed visible elements: `class="clip"`, `data-start`, `data-duration`, and `data-track-index`.
- GSAP timelines: `gsap.timeline({ paused: true })`, registered on `window.__timelines["<composition-id>"]`.
- Rendering must be deterministic: no `Date.now()`, unseeded `Math.random()`, or render-time network fetches.

After editing composition HTML, run the project checks:

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect
```
