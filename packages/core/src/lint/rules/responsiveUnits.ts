import type { LintContext, HyperframeLintFinding, OpenTag } from "../context";
import { readAttr, truncateSnippet } from "../utils";

const POSITION_PROPS =
  /\b(left|right|top|bottom|width|height|font-size|padding|margin|gap|border-radius)\s*:\s*(\d+(?:\.\d+)?)px/gi;

function isCompositionRoot(tag: OpenTag): boolean {
  return Boolean(readAttr(tag.raw, "data-composition-id"));
}

function suggestUnit(prop: string): string {
  const p = prop.toLowerCase();
  if (p === "top" || p === "bottom" || p === "height") return "cqh";
  return "cqw";
}

function pxToContainerUnit(
  px: number,
  prop: string,
  compWidth: number,
  compHeight: number,
): string {
  const unit = suggestUnit(prop);
  const base = unit === "cqh" ? compHeight : compWidth;
  if (base <= 0) return `${px}px`;
  const value = (px / base) * 100;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}${unit}`;
}

export const responsiveUnitRules: Array<(ctx: LintContext) => HyperframeLintFinding[]> = [
  (ctx) => {
    const findings: HyperframeLintFinding[] = [];
    if (!ctx.rootTag) return findings;

    const widthAttr = readAttr(ctx.rootTag.raw, "data-width");
    const heightAttr = readAttr(ctx.rootTag.raw, "data-height");
    const compWidth = parseInt(widthAttr || "1920", 10);
    const compHeight = parseInt(heightAttr || "1080", 10);

    for (const tag of ctx.tags) {
      if (isCompositionRoot(tag)) continue;
      if (tag.name === "script" || tag.name === "style" || tag.name === "audio") continue;

      const style = readAttr(tag.raw, "style") || "";
      if (!style) continue;

      let match: RegExpExecArray | null;
      POSITION_PROPS.lastIndex = 0;
      while ((match = POSITION_PROPS.exec(style)) !== null) {
        const prop = match[1] ?? "";
        const px = parseFloat(match[2] ?? "0");
        if (px <= 4) continue;

        const elementId = readAttr(tag.raw, "id") || undefined;
        const suggested = pxToContainerUnit(px, prop, compWidth, compHeight);

        findings.push({
          code: "prefer_container_units",
          severity: "info",
          message: `${prop}: ${px}px could be ${suggested} for aspect-ratio independence.`,
          elementId,
          fixHint: `Use container-relative units (cqw/cqh) instead of px for layout properties. Add container-type:size to the composition root, then replace ${prop}: ${px}px with ${prop}: ${suggested}.`,
          snippet: truncateSnippet(tag.raw),
        });
      }
    }

    return findings;
  },
];
