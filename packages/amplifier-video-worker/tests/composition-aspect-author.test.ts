import { describe, expect, test } from "bun:test";
import { dimensionsForAspect } from "../src/composition";

describe("dimensionsForAspect", () => {
  test("16:9 returns 1920×1080", () => {
    expect(dimensionsForAspect("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  test("1:1 returns 1080×1080", () => {
    expect(dimensionsForAspect("1:1")).toEqual({ width: 1080, height: 1080 });
  });

  test("9:16 returns 1080×1920", () => {
    expect(dimensionsForAspect("9:16")).toEqual({ width: 1080, height: 1920 });
  });
});
