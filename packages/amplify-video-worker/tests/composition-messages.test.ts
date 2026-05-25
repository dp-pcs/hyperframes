import { describe, expect, test } from "bun:test";
import { buildAuthoringMessages } from "../src/composition";
import type { ExplainerVideoBrief, ExplainerVideoRenderPlan } from "../src/types";

const minimalBrief = {
  version: "2026-05-15",
  article: {
    title: "Example",
    url: "https://example.com",
  } as any,
  interview: {
    goal: "exec_summary",
    audience: "executives",
    durationSeconds: 60,
    narrativeStyle: "documentary",
    textMode: "condense",
    visualMode: "editorial",
    voiceoverMode: "ai_voice",
    ctaMode: "booklet",
  } as any,
  defaultsApplied: [],
  createdAt: "2026-05-18T00:00:00Z",
} as unknown as ExplainerVideoBrief;

const minimalPlan = {
  version: "2026-05-15",
  rendererKind: "hyperframes",
  compositionKind: "article_explainer",
  targetDurationSeconds: 60,
  aspectRatio: "16:9",
  voice: { enabled: true, provider: "elevenlabs", style: "documentary" },
  captions: { enabled: true, burnIn: true, exportSrt: true },
  scenes: [],
  cta: { mode: "booklet", label: "Read the booklet", url: "https://aicoe.fit/x" },
  worker: { status: "processing", queueName: null, notes: "" },
  billing: { billingSurfaceId: "openai:llm-authoring" },
} as unknown as ExplainerVideoRenderPlan;

const source = {
  version: "v1",
  article: {
    text: "Body paragraph one. Body paragraph two.",
    paragraphs: [
      "Body paragraph one is interesting and over forty characters long.",
      "Body paragraph two is also long enough to survive filtering and clearly informative.",
    ],
    bodyHtml: null,
    authors: null,
  },
} as any;

const skillBundle = {
  hyperframesSkill: "# SKILL\nfake content",
  houseStyle: "# House style\nfake",
  patterns: "# Patterns\nfake",
  visualStyles: "# Visual styles\nfake",
  dataInMotion: "# Data in motion\nfake",
  gsapSkill: "# GSAP\nfake",
  amplifyConstraints: "# Amplify constraints\nfake",
};

describe("buildAuthoringMessages", () => {
  test("returns one system message and one user message on first attempt", () => {
    const conv = buildAuthoringMessages({
      brief: minimalBrief,
      plan: minimalPlan,
      source,
      skillBundle,
      retryFeedback: null,
    });
    expect(conv).toHaveLength(2);
    expect(conv[0].role).toBe("system");
    expect(conv[0].content).toContain("# SKILL");
    expect(conv[0].content).toContain("# Amplify constraints");
    expect(conv[1].role).toBe("user");
    expect(conv[1].content).toContain("Example");
    expect(conv[1].content).toContain("60");
    expect(conv[1].content.toLowerCase()).toContain("body paragraph one");
  });

  test("when retryFeedback is provided, appends an assistant turn and a follow-up user message", () => {
    const conv = buildAuthoringMessages({
      brief: minimalBrief,
      plan: minimalPlan,
      source,
      skillBundle,
      retryFeedback: {
        previousIndexHtml: "<!doctype html>...",
        errorText: "ERROR no data-start on clip scene",
      },
    });
    expect(conv).toHaveLength(4);
    expect(conv[2].role).toBe("assistant");
    expect(conv[2].content).toContain("<!doctype html>");
    expect(conv[3].role).toBe("user");
    expect(conv[3].content).toContain("ERROR no data-start");
  });
});
