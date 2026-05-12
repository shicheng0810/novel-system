// Layer 2 · LLM provider interface.
// Three call shapes cover what the v3 engine needs:
//   complete       — free-form prose (chapter synthesis, character reflection)
//   completeStructured — JSON output validated against a schema (planner, scene-cards, review)
//   embed?         — optional; if absent the memory-service falls back to keyword-only

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmCompleteRequest = {
  messages: LlmMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  workload?: "validation" | "structured" | "prose" | "rewrite" | "simulation";
  signal?: AbortSignal;
};

export type LlmCompleteResult = {
  text: string;
  finishReason: "stop" | "length" | "tool" | "error";
  promptTokens?: number;
  completionTokens?: number;
};

export type LlmStructuredRequest<T> = LlmCompleteRequest & {
  /**
   * JSON schema (subset). Provider may use OpenAI-style strict mode if available;
   * otherwise it falls back to plain JSON + manual parse.
   */
  schemaName: string;
  schema: object;
  validate?: (raw: unknown) => T;
};

export type LlmStructuredResult<T> = LlmCompleteResult & {
  value: T;
};

export type LLMProvider = {
  readonly name: string;
  readonly online: boolean; // false for mock/heuristic providers
  complete(request: LlmCompleteRequest): Promise<LlmCompleteResult>;
  completeStructured<T>(request: LlmStructuredRequest<T>): Promise<LlmStructuredResult<T>>;
};
