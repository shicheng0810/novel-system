import { describe, expect, test } from "vitest";

import { MockLLMProvider } from "../../src/v3/services/llm/mock";
import {
  DEFAULT_DEEPSEEK_PROFILE,
  DeepSeekProvider,
} from "../../src/v3/services/llm/deepseek";

describe("MockLLMProvider", () => {
  test("complete returns deterministic text", async () => {
    const llm = new MockLLMProvider();
    const result = await llm.complete({ messages: [{ role: "user", content: "续写林焰一段" }] });
    expect(result.text).toContain("林焰");
    expect(result.finishReason).toBe("stop");
    expect(llm.online).toBe(false);
  });

  test("completeStructured runs validate and round-trips JSON", async () => {
    const llm = new MockLLMProvider({
      structuredTemplate: () => ({ a: 1 }),
    });
    const result = await llm.completeStructured<{ a: number }>({
      messages: [{ role: "user", content: "x" }],
      schemaName: "test",
      schema: {},
      validate: (v) => v as { a: number },
    });
    expect(result.value.a).toBe(1);
    expect(JSON.parse(result.text)).toEqual({ a: 1 });
  });
});

describe("DeepSeekProvider", () => {
  test("complete sends V4 thinking + reasoning_effort and parses output", async () => {
    const captured: { url: string; body: any } = { url: "", body: null };
    const fakeFetch: typeof fetch = (input, init) => {
      captured.url = String(input);
      captured.body = init?.body ? JSON.parse(String(init.body)) : null;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "你好" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 12, completion_tokens: 3 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    };
    const provider = new DeepSeekProvider({
      profile: { ...DEFAULT_DEEPSEEK_PROFILE, apiKey: "sk-x" },
      fetch: fakeFetch,
    });
    const result = await provider.complete({
      messages: [{ role: "user", content: "test" }],
      workload: "prose",
    });
    expect(captured.url).toBe("https://api.deepseek.com/chat/completions");
    expect(captured.body.model).toBe("deepseek-v4-pro");
    expect(captured.body.thinking).toEqual({ type: "enabled" });
    expect(captured.body.reasoning_effort).toBe("high");
    expect(captured.body.max_tokens).toBeGreaterThan(0);
    expect(result.text).toBe("你好");
    expect(result.finishReason).toBe("stop");
    expect(result.promptTokens).toBe(12);
  });

  test("completeStructured asks for json_object and parses it", async () => {
    const captured: { body: any } = { body: null };
    const fakeFetch: typeof fetch = (_input, init) => {
      captured.body = init?.body ? JSON.parse(String(init.body)) : null;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"plan":"立骨"}' }, finish_reason: "stop" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    };
    const provider = new DeepSeekProvider({
      profile: { ...DEFAULT_DEEPSEEK_PROFILE, apiKey: "sk-x" },
      fetch: fakeFetch,
    });
    const result = await provider.completeStructured<{ plan: string }>({
      messages: [{ role: "user", content: "x" }],
      schemaName: "plan",
      schema: { type: "object" },
    });
    expect(captured.body.response_format).toEqual({ type: "json_object" });
    expect(result.value.plan).toBe("立骨");
  });

  test("offline (no apiKey) returns synthetic response without throwing", async () => {
    const provider = new DeepSeekProvider({ profile: DEFAULT_DEEPSEEK_PROFILE });
    expect(provider.online).toBe(false);
    const result = await provider.complete({ messages: [{ role: "user", content: "x" }] });
    expect(result.finishReason).toBe("error");
  });

  test("DeepSeek surfaces error JSON as a thrown error", async () => {
    const fakeFetch: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: { message: "rate limited" } }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
      );
    const provider = new DeepSeekProvider({
      profile: { ...DEFAULT_DEEPSEEK_PROFILE, apiKey: "sk-x" },
      fetch: fakeFetch,
    });
    await expect(
      provider.complete({ messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow(/rate limited/);
  });
});
