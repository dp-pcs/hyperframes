import { describe, expect, test } from "bun:test";
import { authorComposition } from "../src/llm-client";

const dummySchema = {
  type: "object",
  additionalProperties: false,
  required: ["indexHtml", "narration", "notes"],
  properties: {
    indexHtml: { type: "string" },
    narration: { type: "array", items: { type: "object" } },
    notes: { type: ["string", "null"] },
  },
} as const;

describe("authorComposition", () => {
  test("routes GPT-5 to the Responses API and returns parsed JSON", async () => {
    let calledUrl = "";
    let body: any;
    const fakeFetch = async (url: string | URL | Request, init: any) => {
      calledUrl = String(url);
      body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          output_text:
            '{"indexHtml": "<!doctype html><html></html>", "narration": [], "notes": null}',
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await authorComposition({
      conversation: [
        { role: "system", content: "sys" },
        { role: "user", content: "u" },
      ],
      schema: dummySchema,
      schemaName: "test_schema",
      ai: { baseUrl: "https://api.openai.com/v1", apiKey: "sk-x", model: "gpt-5" },
      fetchImpl: fakeFetch as any,
      timeoutMs: 1000,
    });

    expect(calledUrl).toContain("/responses");
    expect(body.model).toBe("gpt-5");
    expect(body.text.format.schema.required).toContain("indexHtml");
    expect((result as any).indexHtml).toContain("<!doctype html>");
  });

  test("routes non-OpenAI / non-GPT-5 to Chat Completions", async () => {
    let calledUrl = "";
    const fakeFetch = async (url: string | URL | Request, _init: any) => {
      calledUrl = String(url);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"indexHtml": "<!doctype html></html>", "narration": [], "notes": null}',
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const result = await authorComposition({
      conversation: [{ role: "user", content: "hi" }],
      schema: dummySchema,
      schemaName: "test_schema",
      ai: {
        baseUrl: "https://api.fireworks.ai/inference/v1",
        apiKey: "fw-x",
        model: "qwen3-coder",
      },
      fetchImpl: fakeFetch as any,
      timeoutMs: 1000,
    });

    expect(calledUrl).toContain("/chat/completions");
    expect((result as any).indexHtml).toContain("<!doctype html>");
  });

  test("throws on empty Responses output", async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({ output_text: "" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(
      authorComposition({
        conversation: [{ role: "user", content: "x" }],
        schema: dummySchema,
        schemaName: "test_schema",
        ai: { baseUrl: "https://api.openai.com/v1", apiKey: "sk-x", model: "gpt-5" },
        fetchImpl: fakeFetch as any,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(/empty/i);
  });

  test("strips markdown fences from Responses output before parsing", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          output_text:
            '```json\n{"indexHtml": "<!doctype html>", "narration": [], "notes": null}\n```',
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await authorComposition({
      conversation: [{ role: "user", content: "x" }],
      schema: dummySchema,
      schemaName: "test_schema",
      ai: { baseUrl: "https://api.openai.com/v1", apiKey: "sk-x", model: "gpt-5" },
      fetchImpl: fakeFetch as any,
      timeoutMs: 1000,
    });

    expect((result as any).indexHtml).toContain("<!doctype html>");
  });

  test("strips markdown fences from Chat Completions output before parsing", async () => {
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '```\n{"indexHtml": "<!doctype html>", "narration": [], "notes": null}\n```',
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await authorComposition({
      conversation: [{ role: "user", content: "x" }],
      schema: dummySchema,
      schemaName: "test_schema",
      ai: {
        baseUrl: "https://api.fireworks.ai/inference/v1",
        apiKey: "fw-x",
        model: "qwen3-coder",
      },
      fetchImpl: fakeFetch as any,
      timeoutMs: 1000,
    });

    expect((result as any).indexHtml).toContain("<!doctype html>");
  });
});
