import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { postRenderSanityCheck } from "../src/composition";

describe("postRenderSanityCheck", () => {
  test("rejects a file under 50KB", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sanity-"));
    const path = join(dir, "tiny.mp4");
    writeFileSync(path, Buffer.alloc(10_000));
    try {
      const result = await postRenderSanityCheck(path, 30, {
        probeDuration: async () => 30,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/size/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects a file with duration > 50% off the target", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sanity-"));
    const path = join(dir, "ok.mp4");
    writeFileSync(path, Buffer.alloc(500_000));
    try {
      const result = await postRenderSanityCheck(path, 60, {
        probeDuration: async () => 10,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/duration/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("accepts a healthy file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sanity-"));
    const path = join(dir, "ok.mp4");
    writeFileSync(path, Buffer.alloc(1_000_000));
    try {
      const result = await postRenderSanityCheck(path, 60, {
        probeDuration: async () => 58.5,
      });
      expect(result.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
