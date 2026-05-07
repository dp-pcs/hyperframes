import { describe, it, expect } from "vitest";
import { lintHyperframeHtml } from "../hyperframeLinter";

function findByCode(html: string, code: string) {
  return lintHyperframeHtml(html).findings.filter((f) => f.code === code);
}

describe("prefer_container_units", () => {
  it("flags px positioning on elements inside a composition", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <h1 style="position:absolute; left:96px; top:108px; font-size:64px;">Title</h1>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings.length).toBeGreaterThanOrEqual(3);
    expect(findings.some((f) => f.message.includes("left"))).toBe(true);
    expect(findings.some((f) => f.message.includes("top"))).toBe(true);
    expect(findings.some((f) => f.message.includes("font-size"))).toBe(true);
  });

  it("suggests cqw for horizontal properties", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <div style="left:192px;">content</div>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings[0].message).toContain("cqw");
  });

  it("suggests cqh for vertical properties", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <div style="top:108px;">content</div>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings[0].message).toContain("cqh");
  });

  it("calculates correct container unit values", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <div style="left:96px;">content</div>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings[0].message).toContain("5cqw");
  });

  it("ignores small px values (borders, shadows)", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <div style="border-radius:2px; width:4px;">content</div>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings).toHaveLength(0);
  });

  it("ignores composition root elements", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080" style="width:1920px; height:1080px;">
      <p>content</p>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings).toHaveLength(0);
  });

  it("ignores script, style, and audio tags", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <script style="width:500px;"></script>
      <style>body { width: 1920px; }</style>
      <audio style="width:100px;" data-start="0" src="vo.mp3"></audio>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings).toHaveLength(0);
  });

  it("severity is info (suggestion, not error)", () => {
    const html = `<div data-composition-id="test" data-width="1920" data-height="1080">
      <div style="left:200px;">content</div>
    </div>`;
    const findings = findByCode(html, "prefer_container_units");
    expect(findings[0].severity).toBe("info");
  });
});
