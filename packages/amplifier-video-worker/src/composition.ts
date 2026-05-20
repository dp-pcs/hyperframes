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
    pattern: /data-composition-id\s*=\s*["']amplifier-explainer["']/i,
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

export async function lintCompositionHtml(html: string): Promise<LintResult> {
  const raw = lintHyperframeHtml(html, {});
  const rawFindings: unknown = Array.isArray(raw)
    ? raw
    : ((raw as { findings?: unknown[] }).findings ?? []);
  const findings = Array.isArray(rawFindings) ? rawFindings : [];
  const errors: LintFinding[] = [];
  const warnings: LintFinding[] = [];
  for (const finding of findings) {
    if (typeof finding !== "object" || finding === null) continue;
    const normalized = normalizeFinding(finding as Parameters<typeof normalizeFinding>[0]);
    if (normalized.severity === "error") errors.push(normalized);
    else if (normalized.severity === "warning") warnings.push(normalized);
  }
  return { errors, warnings };
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
  /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*?data-composition-id\s*=\s*["']amplifier-explainer["'][^>]*?)>/i;
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
    if (/data-composition-id\s*=\s*["']amplifier-explainer["']/i.test(attrs)) continue;
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
  amplifierConstraints: string;
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
    "# Amplifier constraints (non-negotiable)",
    bundle.amplifierConstraints,
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

function buildInitialUserContent(args: BuildAuthoringMessagesArgs): string {
  const { brief, plan, source } = args;
  const article = brief.article;
  const cleaned = sanitizeParagraphs(source);

  const lines: Array<string | false | null | undefined> = [
    "Author a complete Hyperframes composition for the article below.",
    "",
    `Target duration: ${plan.targetDurationSeconds}s`,
    `Aspect ratio: ${plan.aspectRatio} (1920×1080)`,
    `Voice: ${plan.voice.enabled ? `enabled, style ${plan.voice.style ?? "documentary"}` : "disabled"}`,
    `Captions: ${plan.captions.enabled ? "enabled" : "disabled"}`,
    brief.interview?.goal && `Goal: ${brief.interview.goal}`,
    brief.interview?.audience && `Audience: ${brief.interview.audience}`,
    brief.interview?.narrativeStyle && `Narrative style: ${brief.interview.narrativeStyle}`,
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
    "Article body (use as the source of truth — do not invent claims):",
    cleaned || "(article body was empty after sanitization — work from title/subtitle/description)",
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
    messages.push({ role: "assistant", content: args.retryFeedback.previousIndexHtml });
    messages.push({ role: "user", content: buildRetryUserContent(args.retryFeedback) });
  }

  return messages;
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
    amplifierConstraints: readRequired(joinPath(skillsRoot, "amplifier-constraints.md")),
  };
}

// ── Composition loop ──────────────────────────────────────────────────────────

export type LlmFn = (conversation: ConversationMessage[]) => Promise<{
  indexHtml: string;
  narration: Array<{ sceneId: string; startSeconds: number; narrationText: string }>;
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
      retryFeedback = { previousIndexHtml: llmResponse.indexHtml, errorText: detail };
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
      retryFeedback = { previousIndexHtml: llmResponse.indexHtml, errorText: detail };
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
