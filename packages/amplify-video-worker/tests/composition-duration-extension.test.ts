import { describe, expect, test } from "bun:test";
import { extendCompositionDuration } from "../src/composition";

function buildComposition(opts: {
  rootDuration: number;
  narrationDuration?: number | null;
  scenes?: Array<{ id: string; start: number; duration: number }>;
}): string {
  const narration =
    opts.narrationDuration === null
      ? ""
      : `<audio id="narration-track" src="./narration.mp3" data-start="0" data-duration="${opts.narrationDuration ?? opts.rootDuration}" data-track-index="8"></audio>`;
  const scenes = (opts.scenes ?? [])
    .map(
      (s) =>
        `<div id="${s.id}" class="scene" data-start="${s.start}" data-duration="${s.duration}" data-track-index="1">Scene ${s.id}</div>`,
    )
    .join("\n      ");
  return `<!doctype html>
<html>
  <body>
    <div id="root" data-composition-id="amplify-explainer" data-width="1920" data-height="1080" data-duration="${opts.rootDuration}">
      ${narration}
      ${scenes}
    </div>
  </body>
</html>`;
}

describe("extendCompositionDuration", () => {
  test("no-op when actual duration is at or below target", () => {
    const html = buildComposition({
      rootDuration: 60,
      scenes: [{ id: "s1", start: 0, duration: 60 }],
    });
    const result = extendCompositionDuration(html, 58);
    expect(result.extended).toBe(false);
    expect(result.html).toBe(html);
    expect(result.originalRootDurationSeconds).toBe(60);
  });

  test("extends root, narration track, and last scene when narration overruns", () => {
    const html = buildComposition({
      rootDuration: 60,
      narrationDuration: 60,
      scenes: [
        { id: "s1", start: 0, duration: 20 },
        { id: "s2", start: 20, duration: 20 },
        { id: "s3", start: 40, duration: 20 },
      ],
    });
    const result = extendCompositionDuration(html, 72.5);

    expect(result.extended).toBe(true);
    expect(result.originalRootDurationSeconds).toBe(60);
    expect(result.newRootDurationSeconds).toBe(72.5);

    expect(result.html).toContain(
      'data-composition-id="amplify-explainer" data-width="1920" data-height="1080" data-duration="72.5"',
    );
    expect(result.html).toContain(
      'id="narration-track" src="./narration.mp3" data-start="0" data-duration="72.5"',
    );
    // s3 starts at 40, so its new duration is 72.5 - 40 = 32.5
    expect(result.html).toContain('id="s3" class="scene" data-start="40" data-duration="32.5"');
    // Earlier scenes are untouched
    expect(result.html).toContain('id="s1" class="scene" data-start="0" data-duration="20"');
    expect(result.html).toContain('id="s2" class="scene" data-start="20" data-duration="20"');

    expect(result.modifications).toEqual(
      expect.arrayContaining([
        { target: "root", from: 60, to: 72.5 },
        { target: "narration-track", from: 60, to: 72.5 },
        { target: "last-scene", from: 20, to: 32.5 },
      ]),
    );
  });

  test("works when narration track is absent (voice disabled)", () => {
    const html = buildComposition({
      rootDuration: 30,
      narrationDuration: null,
      scenes: [
        { id: "s1", start: 0, duration: 15 },
        { id: "s2", start: 15, duration: 15 },
      ],
    });
    const result = extendCompositionDuration(html, 42);
    expect(result.extended).toBe(true);
    expect(result.html).toContain('data-duration="42"'); // root
    expect(result.html).toContain('id="s2" class="scene" data-start="15" data-duration="27"');
    expect(result.modifications.some((m) => m.target === "narration-track")).toBe(false);
  });

  test("preserves integer formatting for integer durations", () => {
    const html = buildComposition({
      rootDuration: 60,
      scenes: [{ id: "s1", start: 0, duration: 60 }],
    });
    const result = extendCompositionDuration(html, 70);
    expect(result.html).toContain('data-duration="70"');
    expect(result.html).not.toContain('data-duration="70.0"');
  });

  test("no-op when root has no data-composition-id (unknown HTML)", () => {
    const html = `<!doctype html><html><body><div>nothing</div></body></html>`;
    const result = extendCompositionDuration(html, 90);
    expect(result.extended).toBe(false);
    expect(result.html).toBe(html);
  });

  test("no-op when actual duration is zero or negative", () => {
    const html = buildComposition({
      rootDuration: 60,
      scenes: [{ id: "s1", start: 0, duration: 60 }],
    });
    expect(extendCompositionDuration(html, 0).extended).toBe(false);
    expect(extendCompositionDuration(html, -5).extended).toBe(false);
    expect(extendCompositionDuration(html, Number.NaN).extended).toBe(false);
  });

  test("picks the latest-ending clip even when ordering is not last in document", () => {
    // s2 declared last but ends earlier than s1
    const html = `<!doctype html>
<html><body>
  <div id="root" data-composition-id="amplify-explainer" data-width="1920" data-height="1080" data-duration="60">
    <audio id="narration-track" src="./narration.mp3" data-start="0" data-duration="60" data-track-index="8"></audio>
    <div id="s1" data-start="40" data-duration="20" data-track-index="1">end-at-60</div>
    <div id="s2" data-start="0" data-duration="40" data-track-index="2">end-at-40</div>
  </div>
</body></html>`;
    const result = extendCompositionDuration(html, 75);
    expect(result.extended).toBe(true);
    // s1 ends at 60 (latest) → extend it
    expect(result.html).toContain('id="s1" data-start="40" data-duration="35"');
    expect(result.html).toContain('id="s2" data-start="0" data-duration="40"');
  });

  test("handles single-quoted attributes", () => {
    const html = `<!doctype html><html><body>
  <div data-composition-id='amplify-explainer' data-width='1920' data-height='1080' data-duration='30'>
    <audio id='narration-track' src='./narration.mp3' data-start='0' data-duration='30'></audio>
    <div data-start='0' data-duration='30'>scene</div>
  </div>
</body></html>`;
    const result = extendCompositionDuration(html, 45);
    expect(result.extended).toBe(true);
    expect(result.html).toContain(`data-duration="45"`);
  });

  test("last-scene modification is skipped if last scene already covers actual duration", () => {
    // Scene end already exceeds actual duration somehow — only root + narration update
    const html = buildComposition({
      rootDuration: 60,
      narrationDuration: 60,
      scenes: [{ id: "s1", start: 0, duration: 80 }], // end=80 > actual=70
    });
    const result = extendCompositionDuration(html, 70);
    expect(result.extended).toBe(true);
    expect(result.modifications.some((m) => m.target === "last-scene")).toBe(false);
    // s1 untouched
    expect(result.html).toContain('id="s1" class="scene" data-start="0" data-duration="80"');
  });
});
