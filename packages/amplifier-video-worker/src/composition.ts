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
