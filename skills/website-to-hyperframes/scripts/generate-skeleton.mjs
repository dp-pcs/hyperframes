#!/usr/bin/env node
/**
 * Generate a pre-valid index.html skeleton + composition templates
 * from STORYBOARD.md and transcript.json.
 *
 * Structural rules (position:absolute, HyperShader wiring, autoAlpha
 * toggles, SFX placement, narration audio, grain overlays) are baked
 * into the generated code. Sub-agents only fill in creative content.
 *
 * Usage:
 *   node skills/website-to-hyperframes/scripts/generate-skeleton.mjs <project-dir>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";

const projectDir = resolve(process.argv[2] || ".");

// ── Parse storyboard ────────────────────────────────────────────────────────

const storyboardPath = join(projectDir, "STORYBOARD.md");
if (!existsSync(storyboardPath)) {
  console.error("STORYBOARD.md not found in", projectDir);
  process.exit(1);
}
const storyboard = readFileSync(storyboardPath, "utf-8");

// Extract beats: ## BEAT N — NAME (start–end, duration: Xs)
const beatRegex = /^##\s+BEAT\s+(\d+)\s*[—–-]\s*(.+?)\s*\(([^)]+)\)/gm;
const beats = [];
let m;
while ((m = beatRegex.exec(storyboard)) !== null) {
  const num = parseInt(m[1]);
  const name = m[2].trim();
  const timing = m[3];
  const durMatch = timing.match(/duration[:\s]+(\d+\.?\d*)/i);
  const startMatch = timing.match(/([\d.]+)\s*[–-]\s*([\d.]+)/);
  const start = startMatch ? parseFloat(startMatch[1]) : beats.reduce((s, b) => s + b.duration, 0);
  const endTime = startMatch ? parseFloat(startMatch[2]) : start + 5;
  const duration = durMatch ? parseFloat(durMatch[1]) : Math.round((endTime - start) * 100) / 100;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  beats.push({ num, name, slug, start, duration });
}

if (beats.length === 0) {
  console.error(
    "No beats found in STORYBOARD.md. Expected: ## BEAT 1 — NAME (0.00–5.50s, duration 5.5s)",
  );
  process.exit(1);
}

const totalDuration =
  Math.ceil((beats[beats.length - 1].start + beats[beats.length - 1].duration) * 10) / 10;

// ── Parse transitions from storyboard ────────────────────────────────────────

// Actual shader names from packages/shader-transitions/src/shaders/registry.ts
const shaderNames = [
  "chromatic-split",
  "cinematic-zoom",
  "cross-warp-morph",
  "domain-warp",
  "flash-through-white",
  "glitch",
  "gravitational-lens",
  "light-leak",
  "ridged-burn",
  "ripple-waves",
  "sdf-iris",
  "swirl-vortex",
  "thermal-distortion",
  "whip-pan",
];
// Common misspellings/aliases agents use in storyboards
const shaderAliases = {
  "chromatic-radial-split": "chromatic-split",
  "domain-warp-dissolve": "domain-warp",
  "domain-warp-morph": "domain-warp",
  "cross-warp": "cross-warp-morph",
  "flash-white": "flash-through-white",
  "light-leak-warm": "light-leak",
};

const transitions = [];
for (let i = 0; i < beats.length - 1; i++) {
  const beat = beats[i];
  const nextBeatStart =
    i + 1 < beats.length ? storyboard.indexOf("BEAT " + beats[i + 1].num) : storyboard.length;
  const beatSection = storyboard.slice(storyboard.indexOf("BEAT " + beat.num), nextBeatStart);
  const transMatch = beatSection.match(/transition\s+out[:\s]*(.+)/i);
  if (transMatch) {
    const desc = transMatch[1].toLowerCase();
    // Try exact shader names first, then aliases
    let shader = shaderNames.find((s) => desc.includes(s.replace(/-/g, " ")) || desc.includes(s));
    if (!shader) {
      for (const [alias, real] of Object.entries(shaderAliases)) {
        if (desc.includes(alias.replace(/-/g, " ")) || desc.includes(alias)) {
          shader = real;
          console.log("  [alias] " + alias + " → " + real);
          break;
        }
      }
    }
    if (shader) {
      const boundary = beat.start + beat.duration;
      transitions.push({
        fromBeat: i,
        toBeat: i + 1,
        shader,
        time: Math.round((boundary - 0.3) * 100) / 100,
        duration: 0.6,
      });
    }
  }
}

// ── Determine anchor vs non-anchor scenes ────────────────────────────────────

const anchorIndices = new Set();
for (const t of transitions) {
  anchorIndices.add(t.fromBeat);
  anchorIndices.add(t.toBeat);
}

// ── Find narration ───────────────────────────────────────────────────────────

let narrationDuration = totalDuration;
const transcriptPath = join(projectDir, "transcript.json");
if (existsSync(transcriptPath)) {
  try {
    const words = JSON.parse(readFileSync(transcriptPath, "utf-8"));
    if (Array.isArray(words) && words.length > 0) {
      narrationDuration = Math.ceil(words[words.length - 1].end * 10) / 10;
    }
  } catch {
    /* use total */
  }
}

// ── Find SFX ─────────────────────────────────────────────────────────────────

let sfxManifest = {};
const sfxManifestPath = join(projectDir, "sfx", "manifest.json");
if (existsSync(sfxManifestPath)) {
  try {
    sfxManifest = JSON.parse(readFileSync(sfxManifestPath, "utf-8"));
  } catch {
    /* no sfx */
  }
}

const sfxElements = [];
let sfxTrack = 41;

// First try: match explicit SFX cues from storyboard
for (const beat of beats) {
  const nextBeatStart =
    beat.num < beats.length ? storyboard.indexOf("BEAT " + (beat.num + 1)) : storyboard.length;
  const beatSection = storyboard.slice(
    storyboard.indexOf("BEAT " + beat.num),
    nextBeatStart > 0 ? nextBeatStart : undefined,
  );
  const sfxCue =
    beatSection.match(/\*\*SFX[^*]*\*\*[:\s]*(.+)/i) || beatSection.match(/SFX\s+cue[:\s]*(.+)/i);
  if (sfxCue) {
    const cueText = sfxCue[1].toLowerCase();
    for (const [name, info] of Object.entries(sfxManifest)) {
      if (cueText.includes(name.replace(/-/g, " ")) || cueText.includes(name)) {
        sfxElements.push({
          id: "sfx-" + name + "-b" + beat.num,
          src: "sfx/" + info.file,
          start: Math.round((beat.start + 0.2) * 100) / 100,
          duration: info.duration,
          track: sfxTrack++,
          volume: 0.35,
        });
      }
    }
  }
}

// Fallback: if no explicit SFX cues found, auto-place defaults based on beat structure
if (sfxElements.length === 0 && Object.keys(sfxManifest).length > 0) {
  console.log("  [sfx] No explicit SFX cues in storyboard — auto-placing defaults");
  const firstBeat = beats[0];
  const lastBeat = beats[beats.length - 1];

  // Impact on first beat entrance
  if (sfxManifest["impact-bass-1"]) {
    sfxElements.push({
      id: "sfx-impact-open",
      src: "sfx/" + sfxManifest["impact-bass-1"].file,
      start: Math.round((firstBeat.start + 0.3) * 100) / 100,
      duration: sfxManifest["impact-bass-1"].duration,
      track: sfxTrack++,
      volume: 0.35,
    });
  }

  // Whoosh at each beat transition (except last)
  for (let i = 0; i < beats.length - 1; i++) {
    const boundary = beats[i].start + beats[i].duration;
    const sfx = sfxManifest["whoosh"] || sfxManifest["whoosh-short"];
    if (sfx) {
      sfxElements.push({
        id: "sfx-whoosh-t" + (i + 1),
        src: "sfx/" + sfx.file,
        start: Math.round((boundary - 0.1) * 100) / 100,
        duration: sfx.duration,
        track: sfxTrack++,
        volume: 0.3,
      });
    }
  }

  // Chime or sparkle on CTA beat
  const ctaSfx = sfxManifest["chime"] || sfxManifest["sparkle"];
  if (ctaSfx) {
    sfxElements.push({
      id: "sfx-cta",
      src: "sfx/" + ctaSfx.file,
      start: Math.round((lastBeat.start + 0.5) * 100) / 100,
      duration: ctaSfx.duration,
      track: sfxTrack++,
      volume: 0.3,
    });
  }
}

// ── Find DESIGN.md background color ──────────────────────────────────────────

let bgColor = "#000000";
const designPath = join(projectDir, "DESIGN.md");
if (existsSync(designPath)) {
  const design = readFileSync(designPath, "utf-8");
  const bgMatch =
    design.match(/primary\s+surface[^`]*`(#[0-9a-fA-F]{6})`/i) ||
    design.match(/background[^`]*`(#[0-9a-fA-F]{6})`/i);
  if (bgMatch) bgColor = bgMatch[1];
}

// ── Generate index.html ──────────────────────────────────────────────────────

const sceneLines = beats
  .map((beat, i) => {
    const id = "beat-" + beat.num;
    const compId = "beat-" + beat.num + "-" + beat.slug;
    const isAnchor = anchorIndices.has(i);
    const isFirst = i === 0;
    const initialStyle = isAnchor
      ? ' style="opacity:0;"'
      : isFirst
        ? ""
        : ' style="visibility:hidden;"';
    return [
      '    <div class="scene" id="' + id + '"' + initialStyle,
      '      data-composition-id="' + compId + '"',
      '      data-composition-src="compositions/' + compId + '.html"',
      '      data-start="' + beat.start + '" data-duration="' + beat.duration + '"',
      '      data-track-index="1" data-width="1920" data-height="1080"></div>',
    ].join("\n");
  })
  .join("\n\n");

const sfxLines = sfxElements
  .map(
    (s) =>
      '    <audio id="' +
      s.id +
      '" src="' +
      s.src +
      '" data-start="' +
      s.start +
      '" data-duration="' +
      s.duration +
      '" data-track-index="' +
      s.track +
      '" data-volume="' +
      s.volume +
      '"></audio>',
  )
  .join("\n");

// autoAlpha toggles for non-anchor scenes
const toggles = [];
for (let i = 0; i < beats.length; i++) {
  if (anchorIndices.has(i)) continue;
  const id = '"#beat-' + beats[i].num + '"';
  if (i === 0) {
    toggles.push(
      "  tl.set(" + id + ", { autoAlpha: 0 }, " + (beats[i].start + beats[i].duration) + ");",
    );
  } else {
    toggles.push("  tl.set(" + id + ", { autoAlpha: 1 }, " + beats[i].start + ");");
    toggles.push(
      "  tl.set(" + id + ", { autoAlpha: 0 }, " + (beats[i].start + beats[i].duration) + ");",
    );
  }
}

// HyperShader config — build a valid chain of anchor scenes.
// The constraint is: scenes.length === transitions.length + 1.
// All consecutive pairs in the chain get shader transitions.
// Non-chain scenes are managed via autoAlpha toggles.

// Collect unique anchor beat indices in order
const anchorBeatIndices = [];
for (const t of transitions) {
  if (!anchorBeatIndices.includes(t.fromBeat)) anchorBeatIndices.push(t.fromBeat);
  if (!anchorBeatIndices.includes(t.toBeat)) anchorBeatIndices.push(t.toBeat);
}
anchorBeatIndices.sort((a, b) => a - b);

// Build the chain transitions — every consecutive pair of anchors gets a shader.
// Use the storyboard's specified shader if available, otherwise pick a neutral bridge shader.
const chainTransitions = [];
const neutralShaders = ["cross-warp-morph", "light-leak", "cinematic-zoom"];
let neutralIdx = 0;
for (let i = 0; i < anchorBeatIndices.length - 1; i++) {
  const fromIdx = anchorBeatIndices[i];
  const toIdx = anchorBeatIndices[i + 1];
  const boundary = beats[fromIdx].start + beats[fromIdx].duration;

  // Check if there's a storyboard-specified transition for this pair
  const specified = transitions.find((t) => t.fromBeat === fromIdx && t.toBeat === toIdx);
  if (specified) {
    chainTransitions.push(specified);
  } else {
    // Bridge transition — pick a neutral shader
    chainTransitions.push({
      fromBeat: fromIdx,
      toBeat: toIdx,
      shader: neutralShaders[neutralIdx % neutralShaders.length],
      time: Math.round((boundary - 0.3) * 100) / 100,
      duration: 0.5,
    });
    neutralIdx++;
  }
}

const shaderScenes = anchorBeatIndices.map((i) => "beat-" + beats[i].num);
const shaderInit =
  chainTransitions.length > 0
    ? [
        "",
        "  // Shader transitions (auto-generated — " +
          shaderScenes.length +
          " anchor scenes, " +
          chainTransitions.length +
          " transitions)",
        "  window.HyperShader.init({",
        '    bgColor: "' + bgColor + '",',
        "    scenes: " + JSON.stringify(shaderScenes) + ",",
        "    transitions: [",
        ...chainTransitions.map(
          (t) =>
            "      { time: " +
            t.time +
            ', shader: "' +
            t.shader +
            '", duration: ' +
            t.duration +
            " },",
        ),
        "    ],",
        "    timeline: tl,",
        "  });",
      ].join("\n")
    : "";

const shaderScript =
  transitions.length > 0
    ? '\n<script src="https://cdn.jsdelivr.net/npm/@hyperframes/shader-transitions/dist/index.global.js"></script>'
    : "";

const indexHtml =
  [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8">',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/@hyperframes/core/dist/hyperframe.runtime.iife.js"></script>' +
      shaderScript,
    "<style>",
    "  * { margin: 0; padding: 0; box-sizing: border-box; }",
    "  html, body { width: 1920px; height: 1080px; overflow: hidden; background: " +
      bgColor +
      "; }",
    "  .scene { position: absolute; top: 0; left: 0; width: 1920px; height: 1080px; overflow: hidden; }",
    "</style>",
    "</head>",
    "<body>",
    '  <div id="root" data-composition-id="main" data-start="0" data-duration="' +
      totalDuration +
      '" data-width="1920" data-height="1080">',
    "",
    sceneLines,
    "",
    "    <!-- Narration -->",
    '    <audio id="narration" src="narration.wav" data-start="0" data-duration="' +
      narrationDuration +
      '" data-track-index="0" data-volume="1"></audio>',
    "",
    "    <!-- SFX (auto-placed from storyboard cues + manifest) -->",
    sfxLines,
    "",
    "  </div>",
    "",
    "  <script>",
    "  window.__timelines = window.__timelines || {};",
    "  var tl = gsap.timeline({ paused: true });",
    '  window.__timelines["main"] = tl;',
    "",
    "  // Scene visibility toggles (autoAlpha for non-anchor, HyperShader owns anchors)",
    toggles.join("\n"),
    shaderInit,
    "  </script>",
    "</body>",
    "</html>",
  ].join("\n") + "\n";

// ── Generate composition templates ───────────────────────────────────────────

mkdirSync(join(projectDir, "compositions"), { recursive: true });

for (const beat of beats) {
  const compId = "beat-" + beat.num + "-" + beat.slug;
  const compPath = join(projectDir, "compositions", compId + ".html");

  if (existsSync(compPath)) {
    console.log("  [skip] " + compId + ".html already exists");
    continue;
  }

  const template =
    [
      '<template id="' + compId + '-template">',
      '<div data-composition-id="' + compId + '" data-width="1920" data-height="1080">',
      "",
      "  <!-- BG LAYER (z:0) -->",
      '  <div class="bg" style="position:absolute;inset:0;z-index:0;">',
      "    <!-- FILL: ambient background -->",
      "  </div>",
      "",
      "  <!-- GRAIN (z:50) -->",
      '  <div style="position:absolute;inset:0;z-index:50;pointer-events:none;opacity:0.06;mix-blend-mode:overlay;',
      "    background-image:radial-gradient(rgba(255,255,255,0.08) 1px,transparent 1.2px),radial-gradient(rgba(0,0,0,0.18) 1px,transparent 1.2px);",
      '    background-size:3px 3px,5px 5px;background-position:0 0,1px 2px;"></div>',
      "",
      "  <!-- CONTENT (z:10) -->",
      '  <div class="scene-content" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px;box-sizing:border-box;position:relative;z-index:10;">',
      "    <!-- FILL: Beat " + beat.num + " — " + beat.name + " (" + beat.duration + "s) -->",
      "  </div>",
      "",
      "  <!--",
      "  ═══ HTML-IN-CANVAS (optional — uncomment for 3D/WebGL hero treatment) ═══",
      "  Replace the scene-content div above with this pattern to render content",
      "  through Three.js with GPU shaders, 3D geometry, or post-processing.",
      "",
      '  <canvas id="' +
        compId +
        '-cap" layoutsubtree width="1920" height="1080" style="position:absolute;inset:0;opacity:0;z-index:5;">',
      '    <div style="width:1920px;height:1080px;display:flex;align-items:center;justify-content:center;">',
      "      PUT YOUR HTML CONTENT HERE (images, text, cards)",
      "    </div>",
      "  </canvas>",
      '  <canvas id="' +
        compId +
        '-gl" width="1920" height="1080" style="position:absolute;inset:0;z-index:10;"></canvas>',
      '  <script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>',
      "  <script>",
      '    var capCanvas = document.getElementById("' + compId + '-cap");',
      '    var capCtx = capCanvas.getContext("2d");',
      "    var scene3d = new THREE.Scene();",
      "    var camera = new THREE.PerspectiveCamera(45, 1920/1080, 0.1, 100);",
      "    camera.position.set(0, 0, 4);",
      '    var renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("' +
        compId +
        '-gl"), alpha: true });',
      "    renderer.setSize(1920, 1080);",
      "    var texture = new THREE.CanvasTexture(capCanvas);",
      "    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshBasicMaterial({ map: texture }));",
      "    scene3d.add(mesh);",
      "    var proxy3d = { rotY: 0 };",
      "    tl.to(proxy3d, { rotY: 0.3, duration: " +
        beat.duration +
        ', ease: "sine.inOut", onUpdate: function() {',
      "      mesh.rotation.y = proxy3d.rotY;",
      '      capCtx.drawElementImage(capCanvas.querySelector("div"), 0, 0, 1920, 1080);',
      "      texture.needsUpdate = true;",
      "      renderer.render(scene3d, camera);",
      "    }}, 0);",
      "  </script>",
      "  -->",
      "",
      "  <style>",
      '    [data-composition-id="' + compId + '"] {',
      "      width: 1920px; height: 1080px; overflow: hidden;",
      "      position: relative; background: " + bgColor + ";",
      "      font-family: sans-serif; color: #fff;",
      "    }",
      "    /* FILL: per-beat styles */",
      "  </style>",
      "",
      '  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>',
      "  <script>",
      "    window.__timelines = window.__timelines || {};",
      "    var tl = gsap.timeline({ paused: true });",
      "",
      "    // FILL: GSAP animations for Beat " + beat.num + " — " + beat.name,
      "    // Target: 15+ tween calls, 3+ different easings",
      "    // Include: entrance, mid-scene activity, exit (if CSS transition)",
      "",
      '    window.__timelines["' + compId + '"] = tl;',
      "  </script>",
      "</div>",
      "</template>",
    ].join("\n") + "\n";

  writeFileSync(compPath, template);
  console.log("  [created] " + compId + ".html");
}

// ── Write index.html ─────────────────────────────────────────────────────────

writeFileSync(join(projectDir, "index.html"), indexHtml);
console.log(
  "\n  [created] index.html (" +
    beats.length +
    " beats, " +
    transitions.length +
    " shader transitions, " +
    sfxElements.length +
    " SFX)",
);
console.log("  Total duration: " + totalDuration + "s");
if (transitions.length > 0) {
  console.log("  Shaders: " + transitions.map((t) => t.shader + " at " + t.time + "s").join(", "));
}
console.log("\n  Sub-agents now fill each composition template with creative content.");
