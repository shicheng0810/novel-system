// Heuristic LLM mock. Used when no API key is configured or in tests.
// Output is short, deterministic, and seeded by the request hash.

import type {
  LLMProvider,
  LlmCompleteRequest,
  LlmCompleteResult,
  LlmStructuredRequest,
  LlmStructuredResult,
} from "./types";

export type MockLLMOptions = {
  template?: (request: LlmCompleteRequest) => string;
  structuredTemplate?: <T>(request: LlmStructuredRequest<T>) => unknown;
};

function fallbackTemplate(request: LlmCompleteRequest): string {
  const last = request.messages[request.messages.length - 1];
  const seed = (last?.content ?? "").slice(0, 60);
  return `（启发式·无 LLM）${seed}`;
}

export class MockLLMProvider implements LLMProvider {
  readonly name = "mock-llm";
  readonly online = false;

  constructor(private readonly options: MockLLMOptions = {}) {}

  async complete(request: LlmCompleteRequest): Promise<LlmCompleteResult> {
    const template = this.options.template ?? fallbackTemplate;
    const text = template(request);
    return Promise.resolve({
      text,
      finishReason: "stop",
      promptTokens: estimateTokens(request.messages.map((m) => m.content).join(" ")),
      completionTokens: estimateTokens(text),
    });
  }

  async completeStructured<T>(request: LlmStructuredRequest<T>): Promise<LlmStructuredResult<T>> {
    const value = (this.options.structuredTemplate
      ? this.options.structuredTemplate(request)
      : { schema: request.schemaName, mock: true }) as T;
    const validated = request.validate ? request.validate(value) : value;
    const text = JSON.stringify(validated);
    return Promise.resolve({
      text,
      value: validated,
      finishReason: "stop",
      promptTokens: estimateTokens(request.messages.map((m) => m.content).join(" ")),
      completionTokens: estimateTokens(text),
    });
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
