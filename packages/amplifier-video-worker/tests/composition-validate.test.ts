import { describe, expect, test } from "bun:test";
import { validateCompositionHtml } from "../src/composition";

describe("validateCompositionHtml", () => {
  test("accepts a minimal compliant document", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplifier-explainer" data-width="1920" data-height="1080" data-duration="60"></div>
      <script>window.__timelines = {}; const tl = gsap.timeline({ paused: true }); window.__timelines["amplifier-explainer"] = tl;</script>
    </body></html>`;
    const result = validateCompositionHtml(html);
    expect(result.ok).toBe(true);
  });

  test("rejects missing doctype", () => {
    const html = `<html><body>
      <div data-composition-id="amplifier-explainer"></div>
      <script>window.__timelines = {}; gsap.timeline({ paused: true });</script>
    </body></html>`;
    const result = validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("doctype");
    }
  });

  test("rejects missing composition root", () => {
    const html = `<!doctype html><html><body>
      <div></div>
      <script>window.__timelines = {}; gsap.timeline({ paused: true });</script>
    </body></html>`;
    const result = validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("data-composition-id");
    }
  });

  test("rejects missing timeline registration", () => {
    const html = `<!doctype html><html><body>
      <div data-composition-id="amplifier-explainer"></div>
    </body></html>`;
    const result = validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("window.__timelines");
      expect(result.missing).toContain("gsap.timeline");
    }
  });
});
