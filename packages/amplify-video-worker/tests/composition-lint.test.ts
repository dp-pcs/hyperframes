import { describe, expect, test } from "bun:test";
import { lintCompositionHtml, formatLintForFeedback, lintGsapSelectors } from "../src/composition";

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

describe("lintGsapSelectors (bd-n59)", () => {
  // Mirrors the failure pattern from job 43d76fe9: the LLM emits a #scene-hook
  // wrapper that contains .badge, but its inline GSAP timeline animates
  // #scene-hook .kicker (which doesn't exist), so the kicker never animates in.
  const BUG_PATTERN = `<!doctype html><html><body>
  <div data-composition-id="amplify-explainer" data-width="1920" data-height="1080" data-duration="60">
    <section id="scene-hook" class="clip scene" data-start="0" data-duration="10" data-track-index="0">
      <div class="badge">Hello</div>
    </section>
    <section id="scene-problem" class="clip scene" data-start="10" data-duration="10" data-track-index="0">
      <div class="modes"><div class="mode">A</div></div>
      <p class="split-note">note</p>
    </section>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <script>
    window.__timelines = {};
    const tl = gsap.timeline({ paused: true });
    tl.from("#scene-hook .kicker", { opacity: 0 }, 0);
    tl.from("#scene-problem .body, #scene-problem .warning, #scene-problem .meta", { y: 20 }, 10);
    window.__timelines["amplify-explainer"] = tl;
  </script>
</body></html>`;

  test("flags the exact bd-n59 selectors as missing", () => {
    const findings = lintGsapSelectors(BUG_PATTERN);
    const messages = findings.map((f) => f.message).join("\n");
    expect(findings.length).toBe(4); // .kicker, .body, .warning, .meta
    expect(findings.every((f) => f.ruleId === "gsap-selector-missing")).toBe(true);
    expect(messages).toContain(".kicker");
    expect(messages).toContain(".body");
    expect(messages).toContain(".warning");
    expect(messages).toContain(".meta");
  });

  test("lintCompositionHtml surfaces gsap selector errors", async () => {
    const result = await lintCompositionHtml(BUG_PATTERN);
    const ids = result.errors.map((e) => e.ruleId);
    expect(ids).toContain("gsap-selector-missing");
  });

  test("passes when every gsap selector resolves to a DOM token", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplify-explainer" data-duration="10">
        <section id="scene-a"><div class="kicker">k</div></section>
      </div>
      <script>
        window.__timelines = {};
        const tl = gsap.timeline({ paused: true });
        tl.from("#scene-a .kicker", { opacity: 0 }, 0);
        window.__timelines["amplify-explainer"] = tl;
      </script>
    </body></html>`;
    expect(lintGsapSelectors(html)).toHaveLength(0);
  });

  test("flags missing id and class in a single compound selector", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplify-explainer">
        <section id="scene-real"><div class="present">p</div></section>
      </div>
      <script>gsap.from("#scene-missing .absent", {});</script>
    </body></html>`;
    const findings = lintGsapSelectors(html);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain("#scene-missing");
    expect(findings[0]!.message).toContain(".absent");
  });

  test("splits comma-separated selector lists and only flags missing parts", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplify-explainer">
        <section id="scene-a"><div class="present">x</div></section>
      </div>
      <script>gsap.from("#scene-a .present, #scene-a .gone", {});</script>
    </body></html>`;
    const findings = lintGsapSelectors(html);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain(".gone");
    expect(findings[0]!.message).not.toContain(".present");
  });

  test("ignores template-literal selectors that interpolate", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplify-explainer"></div>
      <script>gsap.from(\`#scene-\${i} .body\`, {});</script>
    </body></html>`;
    expect(lintGsapSelectors(html)).toHaveLength(0);
  });

  test("handles chained timeline calls (tl.to / master.fromTo)", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplify-explainer">
        <section id="scene-a"><div class="present">x</div></section>
      </div>
      <script>
        const master = gsap.timeline();
        master.fromTo("#scene-a .missing", { x: 0 }, { x: 1 });
      </script>
    </body></html>`;
    const findings = lintGsapSelectors(html);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toContain(".missing");
  });

  test("returns no findings when html contains no gsap calls", () => {
    const html = `<!doctype html><html><body><div data-composition-id="amplify-explainer"></div></body></html>`;
    expect(lintGsapSelectors(html)).toHaveLength(0);
  });
});

describe("formatLintForFeedback", () => {
  test("renders errors and warnings as lines", () => {
    const formatted = formatLintForFeedback({
      errors: [{ severity: "error", ruleId: "rule-a", message: "bad thing", line: 12 }],
      warnings: [
        {
          severity: "warning",
          ruleId: "rule-b",
          message: "weak thing",
          line: null,
        },
      ],
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
