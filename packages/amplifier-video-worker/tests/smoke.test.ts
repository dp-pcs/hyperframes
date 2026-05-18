import { describe, expect, test } from "bun:test";

describe("smoke", () => {
  test("test runner is wired", () => {
    expect(1 + 1).toBe(2);
  });
});
