# Step 6: Build Compositions

## 1. Copy SFX to project

```bash
cp -r skills/website-to-hyperframes/assets/sfx/ <project-dir>/sfx/
# If skill is installed elsewhere:
find . -path "*/website-to-hyperframes/assets/sfx" -exec cp -r {} <project-dir>/sfx/ \;
```

## 2. Generate the skeleton

Run the skeleton generator. It reads STORYBOARD.md and creates a pre-valid `index.html` + composition templates with all structural rules baked in (position:absolute, shader wiring, autoAlpha toggles, SFX placement, narration audio, grain overlays).

```bash
# Find the script (it's in the skill's scripts/ directory)
SKELETON_SCRIPT=$(find / -maxdepth 8 -name "generate-skeleton.mjs" -path "*/website-to-hyperframes/*" 2>/dev/null | head -1)
node "$SKELETON_SCRIPT" <project-dir>
```

The generator outputs:
- `index.html` — root composition with beat slots, shader transitions, SFX, narration
- `compositions/beat-N-name.html` — one template per beat with BG layer, grain, and scene-content wrapper

**Do NOT manually create index.html or write shader wiring code.** The generator handles all structural rules. If you need to adjust (add/remove beats, change shader choices), edit STORYBOARD.md and re-run the generator.

## 3. Build @font-face for brand fonts (if needed)

Common fonts (Inter, Roboto, JetBrains Mono, Poppins, etc.) are auto-resolved by the renderer. Only brand-specific fonts need @font-face.

1. Read `capture/extracted/tokens.json` for font family names
2. Run `ls capture/assets/fonts/` — recognizable filenames (e.g., `gt-walsheim-medium.woff2`) are brand fonts. Hashed filenames are Google Fonts subsets — skip them.
3. If brand fonts exist, write the @font-face block to paste into sub-agent prompts

## 4. Dispatch sub-agents

Spawn one sub-agent per beat composition in parallel. Each sub-agent fills its template with creative content — it does NOT build the root index.html or handle pipeline mechanics.

```
Fill the composition template at compositions/beat-N-name.html for Beat N.

STORYBOARD for this beat:
[paste the beat section from STORYBOARD.md]

ASSETS — reference by path, do NOT read/inline file contents:
[list the assets the storyboard assigned to this beat]

FONTS (only if brand fonts exist):
[paste the @font-face block]

Read these files for guidance:
- DESIGN.md — exact colors, fonts, Do's/Don'ts
- skills/website-to-hyperframes/references/composition-guide.md — animation patterns, depth layers, easing vocabulary, critical rules
- skills/hyperframes/references/techniques.md — code patterns for 11 visual techniques

The template already has: background layer, grain overlay, scene-content wrapper,
timeline registration, and GSAP script. Fill in:
1. Background treatment (radial glow, grid, particles — whatever fits the brand)
2. Content elements inside scene-content (text, images, logos, data)
3. GSAP animations (entrance + mid-scene activity + exit if CSS transition)

Target: 15+ GSAP calls, 3+ different easings, every element has continuous motion.
```

## 5. Verify each composition

After each sub-agent finishes:

```bash
npx hyperframes lint compositions/beat-N-name.html
```

Also verify:
- Every storyboard-assigned asset appears in the HTML (grep for filenames)
- No inlined SVGs (`<svg xmlns=`) — use `<img src="../capture/assets/...">`
- No Google Fonts imports — use local @font-face or let the renderer auto-resolve

## 6. Preview

```bash
npx hyperframes preview <project-dir>
```

Open in browser, scrub through all beats. Check that scenes transition correctly, content is readable, and animations play smoothly.
