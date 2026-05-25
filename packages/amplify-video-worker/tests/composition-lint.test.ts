import { describe, expect, test } from "bun:test";
import { lintCompositionHtml, formatLintForFeedback } from "../src/composition";

const WELL_FORMED = `<!doctype html><html><body>
  <div data-composition-id="amplify-explainer" data-width="1920" data-height="1080" data-duration="60">
    <div class="clip scene" data-start="0" data-duration="10" data-track-index="0"></div>
    <div class="clip scene" data-start="10" data-duration="10" data-track-index="0"></div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <script>
    window.__timelines = {};
    const tl = gsap.timeline({ paused: true });
    tl.set({}, {}, 20);
    window.__timelines["amplify-explainer"] = tl;
  </script>
</body></html>`;

describe("lintCompositionHtml", () => {
  test("returns no errors for a well-formed composition", async () => {
    const result = await lintCompositionHtml(WELL_FORMED);
    expect(result.errors).toHaveLength(0);
  });

  test("flags a composition missing data-composition-id", async () => {
    const broken = WELL_FORMED.replace(' data-composition-id="amplify-explainer"', "");
    const result = await lintCompositionHtml(broken);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("formatLintForFeedback", () => {
  test("renders errors and warnings as lines", () => {
    const formatted = formatLintForFeedback({
      errors: [{ severity: "error", ruleId: "rule-a", message: "bad thing", line: 12 }],
      warnings: [{ severity: "warning", ruleId: "rule-b", message: "weak thing", line: null }],
    });
    expect(formatted).toContain("ERROR rule-a");
    expect(formatted).toContain("(line 12)");
    expect(formatted).toContain("WARN rule-b");
  });

  test("truncates to the given limit", () => {
    const longMessage = "x".repeat(5000);
    const formatted = formatLintForFeedback(
      {
        errors: [{ severity: "error", ruleId: "r", message: longMessage, line: null }],
        warnings: [],
      },
      200,
    );
    expect(formatted.length).toBeLessThanOrEqual(200);
  });
});
