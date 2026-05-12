// Slim DeepSeek LLM provider. Implements the v3 LLMProvider interface only.
// The legacy 2300-line src/deepseek.ts is kept around for the old workbench;
// v3 does not depend on it.

import type {
  LLMProvider,
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmStructuredRequest,
  LlmStructuredResult,
} from "./types";

export type DeepSeekProfile = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  thinkingMode: "enabled" | "disabled";
  reasoningEffort: "low" | "medium" | "high" | "max";
  contextWindowTokens: number;
  maxOutputTokens: number;
};

export const DEFAULT_DEEPSEEK_PROFILE: DeepSeekProfile = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
  timeoutMs: 600_000,
  thinkingMode: "enabled",
  reasoningEffort: "high",
  contextWindowTokens: 1_000_000,
  maxOutputTokens: 384_000,
};

const WORKLOAD_OUTPUT_DEFAULTS: Record<NonNullable<LlmCompleteRequest["workload"]>, number> = {
  validation: 256,
  structured: 8_000,
  prose: 12_000,
  rewrite: 12_000,
  simulation: 16_000,
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string; role?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: { message?: string };
};

export type DeepSeekProviderOptions = {
  profile: DeepSeekProfile;
  fetch?: typeof fetch;
};

export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";
  readonly online: boolean;

  constructor(private readonly options: DeepSeekProviderOptions) {
    this.online = Boolean(options.profile.apiKey);
  }

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    if (!this.online) {
      return {
        text: "(deepseek-offline)",
        finishReason: "error",
      };
    }
    const json = await this.callChat(request, /* asJson= */ false);
    const choice = json.choices?.[0];
    return {
      text: choice?.message?.content ?? "",
      finishReason: mapFinishReason(choice?.finish_reason),
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    };
  }

  async completeStructured<T>(request: LlmStructuredRequest<T>): Promise<LlmStructuredResult<T>> {
    if (!this.online) {
      const value = (request.validate?.({}) ?? ({} as T)) as T;
      return {
        text: "{}",
        value,
        finishReason: "error",
      };
    }
    const json = await this.callChat(request, /* asJson= */ true);
    const choice = json.choices?.[0];
    const raw = choice?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `DeepSeek structured response was not valid JSON for schema=${request.schemaName}: ${raw.slice(0, 200)}`,
      );
    }
    const value = (request.validate ? request.validate(parsed) : (parsed as T));
    return {
      text: raw,
      value,
      finishReason: mapFinishReason(choice?.finish_reason),
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
    };
  }

  private async callChat(
    request: LlmCompleteRequest | LlmStructuredRequest<unknown>,
    asJson: boolean,
  ): Promise<ChatCompletionResponse> {
    const fetchImpl = this.options.fetch ?? fetch;
    const profile = this.options.profile;
    const controller = new AbortController();
    if (request.signal) {
      request.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    const timer = setTimeout(() => controller.abort(), profile.timeoutMs);

    const isV4 = profile.model.startsWith("deepseek-v4");
    const maxOutput = clamp(
      request.maxOutputTokens ??
        (request.workload ? WORKLOAD_OUTPUT_DEFAULTS[request.workload] : 4000),
      32,
      profile.maxOutputTokens,
    );

    const body: Record<string, unknown> = {
      model: profile.model,
      messages: request.messages,
      max_tokens: maxOutput,
    };
    if (asJson) body.response_format = { type: "json_object" };
    if (isV4) {
      body.thinking = { type: profile.thinkingMode };
      if (profile.thinkingMode === "enabled") body.reasoning_effort = profile.reasoningEffort;
    }
    if (!isV4 || profile.thinkingMode === "disabled") {
      if (request.temperature !== undefined) body.temperature = request.temperature;
    }

    try {
      const response = await fetchImpl(`${profile.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${profile.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let json: ChatCompletionResponse;
      try {
        json = JSON.parse(text) as ChatCompletionResponse;
      } catch {
        throw new Error(
          `DeepSeek ${response.status} ${response.statusText}: non-JSON body: ${text.slice(0, 200)}`,
        );
      }
      if (!response.ok || json.error) {
        const msg = json.error?.message ?? `${response.status} ${response.statusText}`;
        throw new Error(`DeepSeek error: ${msg}`);
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapFinishReason(value?: string): LlmCompleteResult["finishReason"] {
  switch (value) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool";
    default:
      return "stop";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
