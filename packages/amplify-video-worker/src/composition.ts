import { spawn } from "node:child_process";
import { statSync, readFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { lintHyperframeHtml } from "@hyperframes/core";
import type {
  LintFinding,
  ExplainerSourceArtifact,
  ExplainerVideoBrief,
  ExplainerVideoRenderPlan,
  CompositionAuthoringResult,
  CompositionAttemptError,
} from "./types.js";
import type { ConversationMessage } from "./llm-client.js";

export type ValidationResult = { ok: true } | { ok: false; missing: string[] };

const REQUIRED_MARKERS: Array<{ key: string; pattern: RegExp }> = [
  { key: "doctype", pattern: /<!doctype\s+html/i },
  {
    key: "data-composition-id",
    pattern: /data-composition-id\s*=\s*["']amplify-explainer["']/i,
  },
  { key: "window.__timelines", pattern: /window\.__timelines/ },
  { key: "gsap.timeline", pattern: /gsap\.timeline\s*\(/ },
];

export function validateCompositionHtml(html: string): ValidationResult {
  const missing: string[] = [];
  for (const marker of REQUIRED_MARKERS) {
    if (!marker.pattern.test(html)) {
      missing.push(marker.key);
    }
  }
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

// ── Lint adapter ──────────────────────────────────────────────────────────────

export interface LintResult {
  errors: LintFinding[];
  warnings: LintFinding[];
}

function normalizeFinding(raw: {
  severity?: string;
  code?: string;
  ruleId?: string;
  message?: string;
  line?: number | null;
}): LintFinding {
  const severity: LintFinding["severity"] =
    raw.severity === "error" ? "error" : raw.severity === "warning" ? "warning" : "info";
  return {
    severity,
    ruleId: raw.ruleId ?? raw.code ?? "unknown",
    message: raw.message ?? "",
    line: raw.line ?? null,
  };
}

function readCoreLintFindings(html: string): unknown[] {
  const raw = lintHyperframeHtml(html, {});
  if (Array.isArray(raw)) return raw;
  const wrapped = (raw as { findings?: unknown[] }).findings;
  return Array.isArray(wrapped) ? wrapped : [];
}

function normalizeCoreLintFindings(html: string): LintFinding[] {
  const out: LintFinding[] = [];
  for (const finding of readCoreLintFindings(html)) {
    if (typeof finding !== "object" || finding === null) continue;
    out.push(normalizeFinding(finding as Parameters<typeof normalizeFinding>[0]));
  }
  return out;
}

function partitionBySeverity(findings: LintFinding[]): LintResult {
  const errors: LintFinding[] = [];
  const warnings: LintFinding[] = [];
  for (const finding of findings) {
    if (finding.severity === "error") errors.push(finding);
    else if (finding.severity === "warning") warnings.push(finding);
  }
  return { errors, warnings };
}

export async function lintCompositionHtml(html: string): Promise<LintResult> {
  return partitionBySeverity([...normalizeCoreLintFindings(html), ...lintGsapSelectors(html)]);
}

// ── GSAP selector lint (bd-n59) ──────────────────────────────────────────────
//
// LLM-authored compositions hard-code GSAP selectors inside an inline <script>
// (e.g. `gsap.from("#scene-hook .kicker", ...)`) but the LLM is free to pick
// the actual class names inside each scene's content block. When a selector
// references an id or class that no element actually carries, `gsap.from()`
// silently no-ops — text appears in its final state from t=0 instead of fading
// in, so the scene looks broken on render. We catch the mismatch up front so
// the retry-feedback loop can ask the LLM to fix it before we burn an MP4.
//
// Strategy: regex-extract DOM ids + class tokens (excluding script bodies),
// regex-extract string-literal selectors passed to gsap.from/.to/.fromTo/.set
// (and the same on chained timelines), then for each compound selector verify
// every #id and .class token it references exists somewhere in the DOM.

const GSAP_CALL_PATTERN =
  /(?:^|[^A-Za-z0-9_$])(?:gsap|tl|timeline|master|t)\s*\.\s*(from|to|fromTo|set|add)\s*\(\s*((?:'(?:\\.|[^'\\])*')|(?:"(?:\\.|[^"\\])*")|(?:`(?:\\.|[^`\\])*`))/g;
const CLASS_ATTR_PATTERN = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const ID_ATTR_PATTERN = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const SCRIPT_BLOCK_PATTERN = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;

function stripScripts(html: string): string {
  return html.replace(SCRIPT_BLOCK_PATTERN, " ");
}

function matchedAttrValue(match: RegExpMatchArray): string {
  return (match[1] ?? match[2] ?? "").trim();
}

function collectDomIds(htmlSansScripts: string): Set<string> {
  const out = new Set<string>();
  for (const m of htmlSansScripts.matchAll(ID_ATTR_PATTERN)) {
    const value = matchedAttrValue(m);
    if (value) out.add(value);
  }
  return out;
}

function collectDomClasses(htmlSansScripts: string): Set<string> {
  const out = new Set<string>();
  for (const m of htmlSansScripts.matchAll(CLASS_ATTR_PATTERN)) {
    for (const token of matchedAttrValue(m).split(/\s+/)) {
      if (token) out.add(token);
    }
  }
  return out;
}

const QUOTE_CHARS = new Set(["'", '"', "`"]);

function unquote(raw: string): string {
  if (raw.length < 2) return raw;
  const quote = raw.charAt(0);
  if (!QUOTE_CHARS.has(quote)) return raw;
  if (raw.charAt(raw.length - 1) !== quote) return raw;
  return raw.slice(1, -1);
}

function lineForIndex(html: string, index: number): number {
  if (index <= 0) return 1;
  let count = 1;
  const stop = Math.min(index, html.length);
  for (let i = 0; i < stop; i += 1) {
    if (html.charCodeAt(i) === 10) count += 1;
  }
  return count;
}

interface CompoundTokens {
  ids: string[];
  classes: string[];
}

const ID_TOKEN_PATTERN = /#[A-Za-z_][\w-]*/g;
const CLASS_TOKEN_PATTERN = /\.[A-Za-z_][\w-]*/g;
const PSEUDO_PATTERN = /::?[A-Za-z-]/;
const ATTR_SELECTOR_PATTERN = /\[[^\]]*\]/g;

function collectMatchesAfter(input: string, pattern: RegExp, skipChars: number): string[] {
  const found = input.match(pattern);
  if (!found) return [];
  return found.map((m) => m.slice(skipChars));
}

function stripPseudoAndAttr(part: string): string {
  // Strip pseudo-classes/elements (`:hover`, `::before`) and attribute
  // selectors (`[data-foo="bar"]`) before we look for id/class tokens.
  const noPseudo = part.split(PSEUDO_PATTERN)[0] ?? part;
  return noPseudo.replace(ATTR_SELECTOR_PATTERN, "");
}

function extractTokensFromCompound(compound: string): CompoundTokens {
  // Compound selectors are space-separated descendant chains; each chain
  // element can be tag#id.class.class, .class, #id, *, etc. We only care
  // about #id and .class tokens — combinators (`>`, `+`, `~`, `*`) and
  // attribute-only selectors are fine and left untouched.
  const parts = compound.trim().split(/\s+/).filter(Boolean);
  const ids: string[] = [];
  const classes: string[] = [];
  for (const part of parts) {
    const cleaned = stripPseudoAndAttr(part);
    ids.push(...collectMatchesAfter(cleaned, ID_TOKEN_PATTERN, 1));
    classes.push(...collectMatchesAfter(cleaned, CLASS_TOKEN_PATTERN, 1));
  }
  return { ids, classes };
}

function findMissingTokens(
  compound: string,
  knownIds: Set<string>,
  knownClasses: Set<string>,
): { missingIds: string[]; missingClasses: string[] } | null {
  const { ids, classes } = extractTokensFromCompound(compound);
  const missingIds = ids.filter((id) => !knownIds.has(id));
  const missingClasses = classes.filter((cls) => !knownClasses.has(cls));
  if (missingIds.length === 0 && missingClasses.length === 0) return null;
  return { missingIds, missingClasses };
}

function formatMissingTokens(missingIds: string[], missingClasses: string[]): string {
  const parts: string[] = [];
  if (missingIds.length > 0)
    parts.push(`missing id(s): ${missingIds.map((s) => `#${s}`).join(", ")}`);
  if (missingClasses.length > 0)
    parts.push(`missing class(es): ${missingClasses.map((s) => `.${s}`).join(", ")}`);
  return parts.join("; ");
}

function makeGsapSelectorFinding(
  method: string,
  compound: string,
  detail: string,
  line: number,
): LintFinding {
  return {
    severity: "error",
    ruleId: "gsap-selector-missing",
    message: `gsap.${method}("${compound}") references DOM tokens that no element carries — ${detail}. The animation will silently no-op (text appears static from t=0). Either add the tokens to the scene markup or change the selector to match what your DOM actually emits.`,
    line,
  };
}

function isStaticallyResolvableSelector(selector: string): boolean {
  // Template literals with `${...}` can't be resolved at lint time.
  return selector.length > 0 && !selector.includes("${");
}

interface GsapCallSite {
  method: string;
  selector: string;
  line: number;
}

function checkCompound(
  compound: string,
  call: GsapCallSite,
  knownIds: Set<string>,
  knownClasses: Set<string>,
): LintFinding | null {
  const missing = findMissingTokens(compound, knownIds, knownClasses);
  if (!missing) return null;
  const detail = formatMissingTokens(missing.missingIds, missing.missingClasses);
  return makeGsapSelectorFinding(call.method, compound, detail, call.line);
}

function shouldVisitCompound(compound: string, call: GsapCallSite, seen: Set<string>): boolean {
  if (!compound) return false;
  const dedupeKey = `${call.line}::${call.method}::${compound}`;
  if (seen.has(dedupeKey)) return false;
  seen.add(dedupeKey);
  return true;
}

function lintGsapCallSite(
  call: GsapCallSite,
  knownIds: Set<string>,
  knownClasses: Set<string>,
  seen: Set<string>,
): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const compoundRaw of call.selector.split(",")) {
    const compound = compoundRaw.trim();
    if (!shouldVisitCompound(compound, call, seen)) continue;
    const finding = checkCompound(compound, call, knownIds, knownClasses);
    if (finding) findings.push(finding);
  }
  return findings;
}

// fallow-ignore-next-line complexity
function gsapMatchToSite(html: string, match: RegExpMatchArray): GsapCallSite | null {
  const selector = unquote(match[2] ?? "");
  if (!isStaticallyResolvableSelector(selector)) return null;
  return {
    method: match[1] ?? "",
    selector,
    line: lineForIndex(html, match.index ?? 0),
  };
}

function collectGsapCallSites(html: string): GsapCallSite[] {
  const sites: GsapCallSite[] = [];
  for (const match of html.matchAll(GSAP_CALL_PATTERN)) {
    const site = gsapMatchToSite(html, match);
    if (site) sites.push(site);
  }
  return sites;
}

export function lintGsapSelectors(html: string): LintFinding[] {
  if (!/gsap\s*\./.test(html)) return [];
  const htmlSansScripts = stripScripts(html);
  const knownIds = collectDomIds(htmlSansScripts);
  const knownClasses = collectDomClasses(htmlSansScripts);
  const seen = new Set<string>();
  const findings: LintFinding[] = [];
  for (const call of collectGsapCallSites(html)) {
    findings.push(...lintGsapCallSite(call, knownIds, knownClasses, seen));
  }
  return findings;
}

export function formatLintForFeedback(result: LintResult, limit = 4000): string {
  const lines: string[] = [];
  for (const f of result.errors) {
    const linePart = f.line != null ? ` (line ${f.line})` : "";
    lines.push(`ERROR ${f.ruleId}${linePart}: ${f.message}`);
  }
  for (const f of result.warnings) {
    const linePart = f.line != null ? ` (line ${f.line})` : "";
    lines.push(`WARN ${f.ruleId}${linePart}: ${f.message}`);
  }
  return lines.join("\n").slice(0, limit);
}

// ── Duration extension for LLM-authored compositions ─────────────────────────

export interface DurationModification {
  target: "root" | "narration-track" | "last-scene";
  from: number;
  to: number;
}

export interface ExtendCompositionDurationResult {
  html: string;
  extended: boolean;
  originalRootDurationSeconds: number;
  newRootDurationSeconds: number;
  modifications: DurationModification[];
}

const ROOT_TAG_PATTERN =
  /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?data-composition-id\s*=\s*["']amplify-explainer["'][^>]*?)>/i;
const NARRATION_TAG_PATTERN =
  /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?id\s*=\s*["']narration-track["'][^>]*?)>/i;
const DATA_DURATION_ATTR = /data-duration\s*=\s*["']([0-9]*\.?[0-9]+)["']/i;
const ANY_TAG_PATTERN_GLOBAL = /<([a-zA-Z][a-zA-Z0-9-]*)\s+([^>]*?)>/gs;

function readAttr(attrs: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = attrs.match(re);
  return m ? (m[1] ?? null) : null;
}

function rewriteDurationInTag(tag: string, newDuration: number): string {
  return tag.replace(DATA_DURATION_ATTR, `data-duration="${newDuration}"`);
}

/**
 * Rewrite `data-duration` attributes in an LLM-authored composition when the
 * actual narration duration exceeds the LLM-baked target. Updates the root
 * composition element, the narration audio track, and the last scene clip so
 * the rendered timeline covers the full voiceover. No-op when actual <= root.
 */
export function extendCompositionDuration(
  html: string,
  actualDurationSeconds: number,
): ExtendCompositionDurationResult {
  const noop: ExtendCompositionDurationResult = {
    html,
    extended: false,
    originalRootDurationSeconds: 0,
    newRootDurationSeconds: 0,
    modifications: [],
  };

  if (!Number.isFinite(actualDurationSeconds) || actualDurationSeconds <= 0) {
    return noop;
  }

  const rootMatch = html.match(ROOT_TAG_PATTERN);
  if (!rootMatch || rootMatch.index === undefined) return noop;

  const rootTag = rootMatch[0];
  const rootDurationStr = readAttr(rootTag, "data-duration");
  if (rootDurationStr === null) return noop;
  const originalRootDuration = Number.parseFloat(rootDurationStr);
  if (!Number.isFinite(originalRootDuration)) return noop;

  noop.originalRootDurationSeconds = originalRootDuration;
  noop.newRootDurationSeconds = originalRootDuration;

  // Only extend — never shrink.
  if (actualDurationSeconds <= originalRootDuration + 0.01) {
    return noop;
  }

  const modifications: DurationModification[] = [];
  type Replacement = { start: number; end: number; text: string };
  const replacements: Replacement[] = [];

  // 1. Root.
  const newRootTag = rewriteDurationInTag(rootTag, actualDurationSeconds);
  replacements.push({
    start: rootMatch.index,
    end: rootMatch.index + rootTag.length,
    text: newRootTag,
  });
  modifications.push({
    target: "root",
    from: originalRootDuration,
    to: actualDurationSeconds,
  });

  // 2. Narration audio track.
  const narrationMatch = html.match(NARRATION_TAG_PATTERN);
  if (narrationMatch && narrationMatch.index !== undefined) {
    const narrationTag = narrationMatch[0];
    const narrationDurStr = readAttr(narrationTag, "data-duration");
    const originalNarrationDuration =
      narrationDurStr !== null ? Number.parseFloat(narrationDurStr) : 0;
    const newNarrationTag = rewriteDurationInTag(narrationTag, actualDurationSeconds);
    if (newNarrationTag !== narrationTag) {
      replacements.push({
        start: narrationMatch.index,
        end: narrationMatch.index + narrationTag.length,
        text: newNarrationTag,
      });
      modifications.push({
        target: "narration-track",
        from: originalNarrationDuration,
        to: actualDurationSeconds,
      });
    }
  }

  // 3. Last scene clip — the element (excluding root and narration track)
  //    whose data-start + data-duration is largest. Extend that clip so its
  //    end matches the new root duration; the final frame stays on-screen
  //    while audio finishes instead of going blank.
  let lastSceneIndex = -1;
  let lastSceneTag = "";
  let lastSceneEnd = -1;
  let lastSceneStart = 0;
  let lastSceneDuration = 0;
  for (const tagMatch of html.matchAll(ANY_TAG_PATTERN_GLOBAL)) {
    if (tagMatch.index === undefined) continue;
    const fullTag = tagMatch[0];
    const attrs = tagMatch[2];
    if (attrs === undefined) continue;
    if (/data-composition-id\s*=\s*["']amplify-explainer["']/i.test(attrs)) continue;
    if (/id\s*=\s*["']narration-track["']/i.test(attrs)) continue;
    const startStr = readAttr(attrs, "data-start");
    const durStr = readAttr(attrs, "data-duration");
    if (startStr === null || durStr === null) continue;
    const start = Number.parseFloat(startStr);
    const dur = Number.parseFloat(durStr);
    if (!Number.isFinite(start) || !Number.isFinite(dur)) continue;
    const end = start + dur;
    if (end > lastSceneEnd) {
      lastSceneEnd = end;
      lastSceneIndex = tagMatch.index;
      lastSceneTag = fullTag;
      lastSceneStart = start;
      lastSceneDuration = dur;
    }
  }

  if (lastSceneIndex >= 0 && lastSceneEnd + 0.01 < actualDurationSeconds) {
    const newSceneDuration = Math.max(0, actualDurationSeconds - lastSceneStart);
    const newSceneTag = rewriteDurationInTag(lastSceneTag, newSceneDuration);
    if (newSceneTag !== lastSceneTag) {
      replacements.push({
        start: lastSceneIndex,
        end: lastSceneIndex + lastSceneTag.length,
        text: newSceneTag,
      });
      modifications.push({
        target: "last-scene",
        from: lastSceneDuration,
        to: newSceneDuration,
      });
    }
  }

  // Apply replacements in reverse so earlier indices stay valid.
  replacements.sort((a, b) => b.start - a.start);
  let newHtml = html;
  for (const r of replacements) {
    newHtml = newHtml.slice(0, r.start) + r.text + newHtml.slice(r.end);
  }

  return {
    html: newHtml,
    extended: true,
    originalRootDurationSeconds: originalRootDuration,
    newRootDurationSeconds: actualDurationSeconds,
    modifications,
  };
}

// ── Post-render sanity check ──────────────────────────────────────────────────

export type SanityResult = { ok: true } | { ok: false; reason: string };

export type SanityCheckDeps = {
  probeDuration: (filePath: string) => Promise<number>;
};

export function probeDurationWithFfprobe(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed (${code}): ${stderr.slice(0, 500)}`));
        return;
      }
      const duration = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(duration)) {
        reject(new Error(`ffprobe returned non-numeric duration: ${stdout}`));
        return;
      }
      resolve(duration);
    });
  });
}

const MIN_SANITY_BYTES = 50_000;

export async function postRenderSanityCheck(
  filePath: string,
  targetDurationSeconds: number,
  deps: SanityCheckDeps = { probeDuration: probeDurationWithFfprobe },
): Promise<SanityResult> {
  const stat = statSync(filePath);
  if (stat.size < MIN_SANITY_BYTES) {
    return {
      ok: false,
      reason: `Rendered MP4 size ${stat.size} bytes is below the ${MIN_SANITY_BYTES}-byte sanity threshold. The composition probably rendered blank.`,
    };
  }

  const actualDuration = await deps.probeDuration(filePath);
  const lower = targetDurationSeconds * 0.5;
  const upper = targetDurationSeconds * 1.5;
  if (actualDuration < lower || actualDuration > upper) {
    return {
      ok: false,
      reason: `Rendered MP4 duration ${actualDuration.toFixed(2)}s is more than 50% off the target ${targetDurationSeconds}s. The timeline's data-duration likely does not match the GSAP master timeline length.`,
    };
  }
  return { ok: true };
}

// ── Prompt assembly ───────────────────────────────────────────────────────────

export interface SkillBundle {
  hyperframesSkill: string;
  houseStyle: string;
  patterns: string;
  visualStyles: string;
  dataInMotion: string;
  gsapSkill: string;
  amplifyConstraints: string;
}

export interface RetryFeedback {
  previousIndexHtml: string;
  errorText: string;
}

export interface BuildAuthoringMessagesArgs {
  brief: ExplainerVideoBrief;
  plan: ExplainerVideoRenderPlan;
  source: ExplainerSourceArtifact;
  skillBundle: SkillBundle;
  retryFeedback: RetryFeedback | null;
  /**
   * When set, the narration text + per-scene start times have already been
   * decided (typically by an earlier narration-only LLM call followed by TTS).
   * The HTML-authoring call must illustrate this exact narration rather than
   * generating new copy. Total audio duration is the source of truth for
   * timeline length.
   */
  predeterminedNarration?: NarrationPlan | null;
}

export interface NarrationPlanScene {
  sceneId: string;
  startSeconds: number;
  narrationText: string;
}

export interface NarrationPlan {
  scenes: NarrationPlanScene[];
  audioDurationSeconds: number;
}

function buildSystemContent(bundle: SkillBundle): string {
  return [
    "# Hyperframes Authoring Skill",
    bundle.hyperframesSkill,
    "# House Style",
    bundle.houseStyle,
    "# Composition Patterns",
    bundle.patterns,
    "# Visual Styles",
    bundle.visualStyles,
    "# Data in Motion",
    bundle.dataInMotion,
    "# GSAP Reference",
    bundle.gsapSkill,
    "# Amplify constraints (non-negotiable)",
    bundle.amplifyConstraints,
  ].join("\n\n---\n\n");
}

const BOILERPLATE_PATTERNS: RegExp[] = [
  /^thanks for reading/i,
  /^discussion about this post/i,
  /^install:/i,
  /^start your substack/i,
  /privacy ∙ terms/i,
  /this site requires javascript/i,
  /^get the app$/i,
  /^substack is the home/i,
];

function sanitizeParagraphs(source: ExplainerSourceArtifact): string {
  const seeds = [...source.article.paragraphs, ...source.article.text.split(/\n+/)];
  const seen = new Set<string>();
  return seeds
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 40)
    .filter((line) => !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line)))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n\n");
}

export function dimensionsForAspect(aspect: "16:9" | "1:1" | "9:16"): {
  width: number;
  height: number;
} {
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  return { width: 1920, height: 1080 };
}

const AUTHOR_REFERENCE_INSTRUCTION: Record<
  NonNullable<ExplainerVideoBrief["interview"]["authorReferenceStyle"]>,
  string
> = {
  first_name:
    "Author reference style: refer to the author by FIRST NAME throughout (casual, conversational tone).",
  formal_third:
    'Author reference style: refer to the author formally in the third person (e.g., "the author argues…"). Avoid first names.',
  full_attribution:
    "Author reference style: use the author's full name on first mention, then first or last name as natural thereafter.",
};

const ASPECT_SAFE_AREA: Record<"16:9" | "1:1" | "9:16", string> = {
  "16:9":
    "Aspect safe areas: hold focal content within the central 92% of the frame; captions sit in the lower third.",
  "1:1":
    "Aspect safe areas: SQUARE 1080×1080 — hold focal content in the central 80% of the frame; captions sit in the bottom 20%, away from edges. Avoid layouts that assume landscape width.",
  "9:16":
    "Aspect safe areas: PORTRAIT 1080×1920 — vertical stack layout; captions sit in the lower 25%; avoid landscape-only constructs.",
};

function formatPredeterminedNarration(plan: NarrationPlan): string {
  const header = [
    "PRE-DETERMINED NARRATION (audio is already synthesized — your HTML must illustrate this exact content).",
    `Total audio duration: ${plan.audioDurationSeconds.toFixed(2)}s — your composition's data-duration on the root, the narration audio track, and the SUM of scene clip durations MUST cover this full duration.`,
    "Scene-by-scene narration (use these sceneIds and startSeconds as the timing skeleton — your visual scenes should mount/unmount around these boundaries):",
  ];
  const items = plan.scenes.map(
    (s) =>
      `  • sceneId="${s.sceneId}" start=${s.startSeconds.toFixed(2)}s — ${s.narrationText.replace(/\s+/g, " ").trim()}`,
  );
  const footer = [
    "Do NOT rewrite the narration. Echo it back verbatim in the response's narration array (same sceneId/startSeconds/narrationText).",
    "Design your final scene to hold its visible content until the audio ends — never let the canvas go blank before the timeline ends.",
  ];
  return [...header, ...items, ...footer].join("\n");
}

function buildSourceBodyBlock(
  source: ExplainerSourceArtifact,
  predeterminedNarration: NarrationPlan | null | undefined,
): string {
  if (predeterminedNarration) {
    return `${formatPredeterminedNarration(predeterminedNarration)}\n`;
  }
  const cleaned = sanitizeParagraphs(source);
  const body =
    cleaned || "(article body was empty after sanitization — work from title/subtitle/description)";
  return `Article body (use as the source of truth — do not invent claims):\n${body}`;
}

function buildInitialUserContent(args: BuildAuthoringMessagesArgs): string {
  const { brief, plan, source, predeterminedNarration } = args;
  const article = brief.article;
  const dims = dimensionsForAspect(plan.aspectRatio);
  const authorRefInstruction = brief.interview?.authorReferenceStyle
    ? AUTHOR_REFERENCE_INSTRUCTION[brief.interview.authorReferenceStyle]
    : null;
  const effectiveDuration = predeterminedNarration
    ? predeterminedNarration.audioDurationSeconds
    : plan.targetDurationSeconds;
  const durationSuffix = predeterminedNarration ? " (locked to actual narration audio length)" : "";

  const lines: Array<string | false | null | undefined> = [
    "Author a complete Hyperframes composition for the article below.",
    "",
    `Target duration: ${effectiveDuration.toFixed(2)}s${durationSuffix}`,
    `Aspect ratio: ${plan.aspectRatio} (${dims.width}×${dims.height})`,
    ASPECT_SAFE_AREA[plan.aspectRatio],
    `Voice: ${plan.voice.enabled ? `enabled, style ${plan.voice.style ?? "documentary"}` : "disabled"}`,
    `Captions: ${plan.captions.enabled ? "enabled" : "disabled"}`,
    brief.interview?.goal && `Goal: ${brief.interview.goal}`,
    brief.interview?.audience && `Audience: ${brief.interview.audience}`,
    brief.interview?.narrativeStyle && `Narrative style: ${brief.interview.narrativeStyle}`,
    authorRefInstruction,
    brief.interview?.textMode && `Text mode: ${brief.interview.textMode}`,
    brief.interview?.visualMode && `Visual mode: ${brief.interview.visualMode}`,
    `CTA: ${plan.cta.label}${plan.cta.url ? ` (${plan.cta.url})` : ""}`,
    "",
    `Article title: ${article.title}`,
    article.subtitle && `Article subtitle: ${article.subtitle}`,
    article.description && `Article description: ${article.description}`,
    article.publication?.name && `Publication: ${article.publication.name}`,
    article.primaryAuthor?.name && `Author: ${article.primaryAuthor.name}`,
    article.primaryAuthor?.bio && `Author bio: ${article.primaryAuthor.bio}`,
    article.coverImage && `Cover image URL: ${article.coverImage}`,
    article.url && `Article URL: ${article.url}`,
    article.bookletLink?.shortUrl && `Booklet URL: ${article.bookletLink.shortUrl}`,
    "",
    buildSourceBodyBlock(source, predeterminedNarration),
    "",
    "Return JSON via the structured-output schema. The indexHtml field is the complete <!doctype html> document. The narration array carries per-scene narration text (omit/empty when voice is disabled).",
  ];

  return lines.filter((entry): entry is string => Boolean(entry)).join("\n");
}

function buildRetryUserContent(feedback: RetryFeedback): string {
  return [
    "Your previous composition failed validation. Here are the errors:",
    "",
    feedback.errorText.slice(0, 4000),
    "",
    "Return a new, complete indexHtml that fixes these issues. Keep what was working; change only what needs to change. Do not return a diff.",
  ].join("\n");
}

export function buildAuthoringMessages(args: BuildAuthoringMessagesArgs): ConversationMessage[] {
  const messages: ConversationMessage[] = [
    { role: "system", content: buildSystemContent(args.skillBundle) },
    { role: "user", content: buildInitialUserContent(args) },
  ];

  if (args.retryFeedback) {
    messages.push({
      role: "assistant",
      content: args.retryFeedback.previousIndexHtml,
    });
    messages.push({
      role: "user",
      content: buildRetryUserContent(args.retryFeedback),
    });
  }

  return messages;
}

// ── Narration-only authoring (used to pre-decide what gets TTS'd) ────────────

export interface BuildNarrationMessagesArgs {
  brief: ExplainerVideoBrief;
  plan: ExplainerVideoRenderPlan;
  source: ExplainerSourceArtifact;
  skillBundle: SkillBundle;
}

export const NARRATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["narration", "notes"],
  properties: {
    narration: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sceneId", "startSeconds", "narrationText"],
        properties: {
          sceneId: { type: "string" },
          startSeconds: { type: "number" },
          narrationText: { type: "string" },
        },
      },
    },
    notes: { type: ["string", "null"] },
  },
} as const;

function buildNarrationOnlySystemContent(bundle: SkillBundle): string {
  return [
    "# Amplify explainer narration writer",
    "You are writing only the spoken narration for an explainer video — no HTML, no GSAP, no layout. The narration will be sent to ElevenLabs TTS and the resulting audio length will determine the video's exact runtime, so concise, intentional pacing matters.",
    "",
    "Speak in the voice style requested by the brief. Honor the author-reference style. Use the article body as the source of truth — do not invent claims.",
    "",
    "Pacing: ElevenLabs speaks at roughly 2.3 words per second for documentary/calm styles and 2.6 wps for energetic. Aim for narration whose word count, divided by that rate, lands within ±10% of the target duration.",
    "",
    "Plan 4–7 scenes that cover hook → context → insight(s) → close. Each scene's startSeconds should be your honest estimate of when that scene's narration begins given the pacing above. The HTML compositor will use your scene IDs and timing as the visual skeleton.",
    "",
    "# Amplify constraints (relevant subset)",
    bundle.amplifyConstraints,
  ].join("\n\n");
}

function buildNarrationOnlyUserContent(args: BuildNarrationMessagesArgs): string {
  const { brief, plan, source } = args;
  const article = brief.article;
  const cleaned = sanitizeParagraphs(source);
  const authorRefInstruction = brief.interview?.authorReferenceStyle
    ? AUTHOR_REFERENCE_INSTRUCTION[brief.interview.authorReferenceStyle]
    : null;
  const lines: Array<string | false | null | undefined> = [
    "Write the narration for an explainer video about the article below.",
    "",
    `Target duration: ${plan.targetDurationSeconds}s (the audio you specify will determine the actual runtime).`,
    `Voice: ${plan.voice.enabled ? `enabled, style ${plan.voice.style ?? "documentary"}` : "disabled"}`,
    brief.interview?.goal && `Goal: ${brief.interview.goal}`,
    brief.interview?.audience && `Audience: ${brief.interview.audience}`,
    brief.interview?.narrativeStyle && `Narrative style: ${brief.interview.narrativeStyle}`,
    authorRefInstruction,
    `CTA: ${plan.cta.label}${plan.cta.url ? ` (${plan.cta.url})` : ""}`,
    "",
    `Article title: ${article.title}`,
    article.subtitle && `Article subtitle: ${article.subtitle}`,
    article.primaryAuthor?.name && `Author: ${article.primaryAuthor.name}`,
    article.primaryAuthor?.bio && `Author bio: ${article.primaryAuthor.bio}`,
    article.url && `Article URL: ${article.url}`,
    "",
    "Article body:",
    cleaned || "(article body was empty after sanitization — work from title/subtitle/description)",
    "",
    "Return JSON via the structured-output schema. Only the narration array and notes — no HTML.",
  ];
  return lines.filter((entry): entry is string => Boolean(entry)).join("\n");
}

export function buildNarrationOnlyMessages(
  args: BuildNarrationMessagesArgs,
): ConversationMessage[] {
  return [
    {
      role: "system",
      content: buildNarrationOnlySystemContent(args.skillBundle),
    },
    { role: "user", content: buildNarrationOnlyUserContent(args) },
  ];
}

// ── Skill bundle loader ───────────────────────────────────────────────────────

function readRequired(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Skill bundle file missing: ${filePath} (${reason})`);
  }
}

export function loadSkillBundle(skillsRoot: string): SkillBundle {
  return {
    hyperframesSkill: readRequired(joinPath(skillsRoot, "hyperframes", "SKILL.md")),
    houseStyle: readRequired(joinPath(skillsRoot, "hyperframes", "house-style.md")),
    patterns: readRequired(joinPath(skillsRoot, "hyperframes", "patterns.md")),
    visualStyles: readRequired(joinPath(skillsRoot, "hyperframes", "visual-styles.md")),
    dataInMotion: readRequired(joinPath(skillsRoot, "hyperframes", "data-in-motion.md")),
    gsapSkill: readRequired(joinPath(skillsRoot, "gsap", "SKILL.md")),
    amplifyConstraints: readRequired(joinPath(skillsRoot, "amplify-constraints.md")),
  };
}

// ── Composition loop ──────────────────────────────────────────────────────────

export type LlmFn = (conversation: ConversationMessage[]) => Promise<{
  indexHtml: string;
  narration: Array<{
    sceneId: string;
    startSeconds: number;
    narrationText: string;
  }>;
  notes: string | null;
}>;

export type LintFn = (html: string) => Promise<LintResult>;

export interface RunCompositionLoopArgs {
  brief: ExplainerVideoBrief;
  plan: ExplainerVideoRenderPlan;
  source: ExplainerSourceArtifact;
  skillBundle: SkillBundle;
  maxAttempts: number;
  llmTimeoutMs: number;
  llm: LlmFn;
  lint: LintFn;
  predeterminedNarration?: NarrationPlan | null;
}

export async function runCompositionLoop(
  args: RunCompositionLoopArgs,
): Promise<CompositionAuthoringResult> {
  const errors: CompositionAttemptError[] = [];
  let retryFeedback: RetryFeedback | null = null;

  for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
    const conversation = buildAuthoringMessages({
      brief: args.brief,
      plan: args.plan,
      source: args.source,
      skillBundle: args.skillBundle,
      retryFeedback,
      predeterminedNarration: args.predeterminedNarration ?? null,
    });

    let llmResponse: Awaited<ReturnType<LlmFn>>;
    try {
      llmResponse = await args.llm(conversation);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ attempt, kind: "llm_error", message });
      const previousHtml: string = retryFeedback != null ? retryFeedback.previousIndexHtml : "";
      retryFeedback = {
        previousIndexHtml: previousHtml,
        errorText: `LLM call failed: ${message}`,
      };
      continue;
    }

    const validation = validateCompositionHtml(llmResponse.indexHtml);
    if (!validation.ok) {
      const detail = `Missing required markers: ${validation.missing.join(", ")}`;
      errors.push({ attempt, kind: "html_invalid", message: detail });
      retryFeedback = {
        previousIndexHtml: llmResponse.indexHtml,
        errorText: detail,
      };
      continue;
    }

    const lintResult = await args.lint(llmResponse.indexHtml);
    if (lintResult.errors.length > 0) {
      const detail = formatLintForFeedback(lintResult);
      errors.push({
        attempt,
        kind: "lint_failed",
        message: `${lintResult.errors.length} lint errors`,
        detail,
      });
      retryFeedback = {
        previousIndexHtml: llmResponse.indexHtml,
        errorText: detail,
      };
      continue;
    }

    return {
      ok: true,
      indexHtml: llmResponse.indexHtml,
      narration: llmResponse.narration,
      notes: llmResponse.notes,
      attempts: attempt,
    };
  }

  return { ok: false, attempts: args.maxAttempts, errors };
}
