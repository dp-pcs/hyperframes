export type ConversationMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type AuthorCompositionArgs<_T> = {
  conversation: ConversationMessage[];
  schema: object;
  schemaName: string;
  ai: AiConfig;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

function shouldUseResponsesApi(ai: AiConfig): boolean {
  const normalizedModel = ai.model.replace(/^@[^/]+\//, "");
  return (
    ai.baseUrl.includes("api.openai.com") &&
    (/^gpt-5(\b|[-.])/.test(normalizedModel) || /^o\d/.test(normalizedModel))
  );
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

async function callResponses<T>(args: AuthorCompositionArgs<T>): Promise<T> {
  const { conversation, schema, schemaName, ai, timeoutMs, fetchImpl = fetch } = args;
  const instructions = conversation
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const inputs = conversation
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${normalizeBaseUrl(ai.baseUrl)}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        instructions,
        input: inputs,
        max_output_tokens: 16000,
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI Responses API error ${response.status}: ${text.slice(0, 500)}`);
    }
    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text =
      (typeof payload.output_text === "string" && payload.output_text.trim()) ||
      (payload.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((c) => c.type === "output_text" && typeof c.text === "string")
        .map((c) => (c.text ?? "").trim())
        .filter(Boolean)
        .join("\n");
    if (!text || !text.trim()) {
      throw new Error("OpenAI Responses API returned an empty response");
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function callChatCompletions<T>(args: AuthorCompositionArgs<T>): Promise<T> {
  const { conversation, ai, timeoutMs, fetchImpl = fetch } = args;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${normalizeBaseUrl(ai.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: conversation,
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 16000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chat Completions error ${response.status}: ${text.slice(0, 500)}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      throw new Error("Chat Completions returned an empty response");
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function authorComposition<T>(args: AuthorCompositionArgs<T>): Promise<T> {
  if (shouldUseResponsesApi(args.ai)) {
    return callResponses<T>(args);
  }
  return callChatCompletions<T>(args);
}
