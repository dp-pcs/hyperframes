import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { lintHyperframeHtml } from "@hyperframes/core";
import type { LintFinding } from "./types.js";

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
