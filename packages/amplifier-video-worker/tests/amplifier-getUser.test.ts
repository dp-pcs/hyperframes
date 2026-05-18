import { describe, expect, test } from "bun:test";
import { __testHooks } from "../src/amplifier";
import type { UserRecord } from "../src/types";

describe("getUserWithClient", () => {
  test("returns the user record when present", async () => {
    const calls: any[] = [];
    const fakeDynamo = {
      send: async (cmd: any) => {
        calls.push(cmd.input);
        return {
          Item: {
            userId: "u-1",
            aiBaseUrl: "https://api.openai.com/v1",
            aiApiKey: "sk-test",
            aiModel: "gpt-5",
          } satisfies UserRecord,
        };
      },
    };

    const result = await __testHooks.getUserWithClient(fakeDynamo as any, "u-1");
    expect(result.userId).toBe("u-1");
    expect(result.aiModel).toBe("gpt-5");
    expect(calls[0].Key).toEqual({ userId: "u-1" });
  });

  test("throws a typed error when the user is missing", async () => {
    const fakeDynamo = {
      send: async () => ({}),
    };
    await expect(__testHooks.getUserWithClient(fakeDynamo as any, "u-missing")).rejects.toThrow(
      /User record not found/,
    );
  });
});
