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
