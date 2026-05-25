import { describe, expect, test } from "bun:test";
import { runCompositionLoop } from "../src/composition";
import type { SkillBundle } from "../src/composition";
import type { ConversationMessage } from "../src/llm-client";

const skillBundle: SkillBundle = {
  hyperframesSkill: "S",
  houseStyle: "S",
  patterns: "S",
  visualStyles: "S",
  dataInMotion: "S",
  gsapSkill: "S",
  amplifyConstraints: "S",
};

const baseArgs = {
  brief: { article: { title: "T" } } as any,
  plan: {
    targetDurationSeconds: 60,
    aspectRatio: "16:9",
    voice: { enabled: false },
    captions: { enabled: false },
    cta: { label: "Read" },
  } as any,
  source: {
    article: {
      paragraphs: ["This is paragraph one and it is well over forty characters."],
      text: "This is paragraph one and it is well over forty characters.",
      bodyHtml: null,
      authors: null,
    },
  } as any,
  skillBundle,
  maxAttempts: 5,
  llmTimeoutMs: 1000,
};

const VALID_HTML = `<!doctype html><html><body>
  <div data-composition-id="amplify-explainer" data-width="1920" data-height="1080" data-duration="60"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <script>window.__timelines = {}; const tl = gsap.timeline({ paused: true }); window.__timelines["amplify-explainer"] = tl;</script>
</body></html>`;

describe("runCompositionLoop", () => {
  test("succeeds on first attempt when LLM output is valid", async () => {
    let calls = 0;
    const result = await runCompositionLoop({
      ...baseArgs,
      llm: async () => {
        calls += 1;
        return { indexHtml: VALID_HTML, narration: [], notes: null };
      },
      lint: async () => ({ errors: [], warnings: [] }),
    });
    expect(calls).toBe(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.indexHtml).toBe(VALID_HTML);
      expect(result.attempts).toBe(1);
    }
  });

  test("retries on llm error then succeeds", async () => {
    let calls = 0;
    const result = await runCompositionLoop({
      ...baseArgs,
      llm: async () => {
        calls += 1;
        if (calls === 1) throw new Error("LLM blip");
        return { indexHtml: VALID_HTML, narration: [], notes: null };
      },
      lint: async () => ({ errors: [], warnings: [] }),
    });
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attempts).toBe(2);
  });

  test("retries on validation failure with html_invalid error recorded", async () => {
    let calls = 0;
    const result = await runCompositionLoop({
      ...baseArgs,
      llm: async () => {
        calls += 1;
        if (calls === 1) {
          return { indexHtml: "<html>no markers</html>", narration: [], notes: null };
        }
        return { indexHtml: VALID_HTML, narration: [], notes: null };
      },
      lint: async () => ({ errors: [], warnings: [] }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attempts).toBe(2);
  });

  test("retries on lint error, passing lint feedback into the retry", async () => {
    let calls = 0;
    let secondConversation: ConversationMessage[] = [];
    const result = await runCompositionLoop({
      ...baseArgs,
      llm: async (conversation) => {
        calls += 1;
        if (calls === 2) {
          secondConversation = conversation;
        }
        return { indexHtml: VALID_HTML, narration: [], notes: null };
      },
      lint: async () => {
        if (calls === 1) {
          return {
            errors: [
              { severity: "error" as const, ruleId: "bad-rule", message: "bad thing", line: null },
            ],
            warnings: [],
          };
        }
        return { errors: [], warnings: [] };
      },
    });
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
    const assistantMsg = secondConversation.find((m) => m.role === "assistant");
    const lastUser = [...secondConversation].reverse().find((m) => m.role === "user");
    expect(assistantMsg?.content).toContain("<!doctype html>");
    expect(lastUser?.content).toContain("bad thing");
  });

  test("returns failure after maxAttempts", async () => {
    let calls = 0;
    const result = await runCompositionLoop({
      ...baseArgs,
      maxAttempts: 3,
      llm: async () => {
        calls += 1;
        throw new Error("LLM down");
      },
      lint: async () => ({ errors: [], warnings: [] }),
    });
    expect(calls).toBe(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(3);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]?.kind).toBe("llm_error");
    }
  });
});
