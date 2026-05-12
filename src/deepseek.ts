import {
  BranchProposal,
  ChapterDraft,
  ChapterPlan,
  NarrativeMemoryPack,
  NarrativeDraft,
  NarrativeLens,
  ParsedWorldDraft,
  ReviewReport,
  SceneCard,
  SceneDraft,
  SimulationProviderContext,
  SimulationStageProposal,
  TimelineLine,
  WritingModelProvider,
  WritingProviderContext,
  WritingRunRecord,
  SimulationModelProvider,
} from "./domain";
import { AiSettingsStore } from "./ai-settings";
import {
  buildNarrativeSourcePack,
  generateSceneCards,
  planChapter,
  reviewChapterDraft,
} from "./narrative";
import {
  DEFAULT_DEEPSEEK_PROFILE,
  DeepSeekReasoningEffort,
  DeepSeekThinkingMode,
  DeepSeekWorkload,
  normalizePositiveInteger,
  normalizeReasoningEffort,
  normalizeThinkingMode,
  resolveWorkloadMaxTokens,
  shouldOmitSamplingControls,
  shouldSendThinkingControls,
  trimTrailingSlash,
} from "./deepseek-profile";

const DEFAULT_MODEL = DEFAULT_DEEPSEEK_PROFILE.model;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_NARRATIVE_TARGET_LENGTH: [number, number] = [2800, 3300];

/**
 * Number of LLM-based length-repair attempts when the first synthesize
 * response is out of `lens.targetLength` range.
 *
 * Each attempt is a full DeepSeek HTTP call (~30-90s with thinking, ~10-30s
 * without). Setting this to 0 skips LLM repair entirely — the local
 * `hardFitOverlongChapter` truncator handles over-length chapters; under-
 * length chapters are returned as-is.
 *
 * Override via env var `NOVEL_LENGTH_REPAIR_ATTEMPTS` (0-3 typical).
 *
 * Default 0 per user request 2026-05-10: each repair attempt costs 30-90s
 * with no quality guarantee, and hardFit truncation is "good enough" for
 * typical 200-500 char overshoots. If you need stricter length adherence
 * for a specific chapter, raise via env var.
 */
function maxLengthRepairAttempts(): number {
  const envVal = process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS;
  if (envVal === undefined) return 0;
  const n = Number.parseInt(envVal, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 5);
}

type ChatToolCall = {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string | null;
  };
};

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  reasoning_content?: string;
  tool_calls?: ChatToolCall[];
};

type ChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: ChatToolCall[] | null;
    };
  }>;
};

type RequestMode = "structured-tool" | "plain-text" | "json-fallback";

type PromptOptions = {
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  workload: DeepSeekWorkload;
};

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    strict: true;
    parameters: Record<string, unknown>;
  };
};

type RequestAttempt = {
  mode: RequestMode;
  url: string;
  finishReason: string;
  raw: string;
  content: string;
  reasoningContent?: string;
  toolCalls: ChatToolCall[];
};

type StructuredResult<T> = {
  value: T;
  raw: string;
  finishReason: string;
  requestMode: RequestMode;
  retryCount: number;
  fallbackUsed?: "json-fallback";
};

type TextResult = {
  value: string;
  raw: string;
  finishReason: string;
  requestMode: "plain-text";
  retryCount: number;
};

type SceneRewriteResult = {
  text: string;
  runRecord: WritingRunRecord;
};

export type DeepSeekProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  structuredBaseUrl?: string;
  model?: string;
  timeoutMs?: number;
  thinkingMode?: DeepSeekThinkingMode;
  reasoningEffort?: DeepSeekReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  defaultStructuredMode?: "strict-tool";
  jsonFallbackEnabled?: boolean;
};

export type ResolvedDeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  structuredBaseUrl: string;
  model: string;
  timeoutMs: number;
  thinkingMode: DeepSeekThinkingMode;
  reasoningEffort: DeepSeekReasoningEffort;
  contextWindowTokens: number;
  maxOutputTokens: number;
  temperature: number;
  fetchImpl: typeof fetch;
  maxRetries: number;
  defaultStructuredMode: "strict-tool";
  jsonFallbackEnabled: boolean;
};

function resolveStoredSettings() {
  return new AiSettingsStore().readSync();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function makeRunRecord(
  step: WritingRunRecord["step"],
  promptVersion: string,
  modelName: string,
  inputSummary: string,
  rawOutput: string,
  conclusion: string,
  meta?: {
    requestMode?: RequestMode;
    finishReason?: string;
    retryCount?: number;
    fallbackUsed?: "json-fallback";
  },
): WritingRunRecord {
  return {
    step,
    promptVersion,
    modelName,
    inputSummary,
    rawOutput,
    conclusion,
    requestMode: meta?.requestMode,
    finishReason: meta?.finishReason,
    retryCount: meta?.retryCount,
    fallbackUsed: meta?.fallbackUsed,
  };
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function summarizeMessages(messages: ChatMessage[]): string {
  return messages.map((message) => `${message.role}:${message.content.slice(0, 120)}`).join(" | ");
}

function buildJsonPrompt(schemaExample: string, body: string): string {
  return `${body}\n\n请严格输出 json 对象，不要输出 markdown，不要补解释。\nJSON 示例：\n${schemaExample}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function limitItems(items: string[], limit: number): string[] {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

function truncateText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function resolveLensTargetLength(lens: NarrativeLens): [number, number] {
  const minLength =
    typeof lens.targetLength?.[0] === "number" && Number.isFinite(lens.targetLength[0])
      ? lens.targetLength[0]
      : DEFAULT_NARRATIVE_TARGET_LENGTH[0];
  const maxLength =
    typeof lens.targetLength?.[1] === "number" && Number.isFinite(lens.targetLength[1])
      ? lens.targetLength[1]
      : DEFAULT_NARRATIVE_TARGET_LENGTH[1];
  return [Math.min(minLength, maxLength), Math.max(minLength, maxLength)];
}

function summarizeList(label: string, items: string[], limit: number, maxItemLength = 80): string {
  const picked = limitItems(items, limit).map((item) => truncateText(item, maxItemLength));
  return `${label}：${picked.join(" / ") || "无"}`;
}

function isConfiguredValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function deriveStructuredBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/beta") ? baseUrl : `${baseUrl}/beta`;
}

export function isDeepSeekConfigured(options: Partial<DeepSeekProviderOptions> = {}): boolean {
  const stored = resolveStoredSettings();
  return isConfiguredValue(options.apiKey ?? stored?.apiKey ?? process.env.DEEPSEEK_API_KEY);
}

export function resolveDeepSeekConfig(options: DeepSeekProviderOptions = {}): ResolvedDeepSeekConfig {
  const stored = resolveStoredSettings();
  const apiKey = options.apiKey ?? stored?.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  if (!apiKey.trim()) {
    throw new Error("DEEPSEEK_API_KEY is required for live DeepSeek calls.");
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is unavailable in this runtime.");
  }

  const baseUrl = trimTrailingSlash(
    options.baseUrl ?? stored?.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_DEEPSEEK_PROFILE.baseUrl,
  );
  const structuredBaseUrl = trimTrailingSlash(
    options.structuredBaseUrl ?? process.env.DEEPSEEK_STRUCTURED_BASE_URL ?? deriveStructuredBaseUrl(baseUrl),
  );

  return {
    apiKey: apiKey.trim(),
    baseUrl,
    structuredBaseUrl,
    model: options.model ?? stored?.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_DEEPSEEK_PROFILE.model,
    timeoutMs: normalizePositiveInteger(
      options.timeoutMs ?? stored?.timeoutMs ?? process.env.DEEPSEEK_TIMEOUT_MS,
      DEFAULT_DEEPSEEK_PROFILE.timeoutMs,
    ),
    thinkingMode: normalizeThinkingMode(
      options.thinkingMode ?? stored?.thinkingMode ?? process.env.DEEPSEEK_THINKING_MODE,
    ),
    reasoningEffort: normalizeReasoningEffort(
      options.reasoningEffort ?? stored?.reasoningEffort ?? process.env.DEEPSEEK_REASONING_EFFORT,
    ),
    contextWindowTokens: normalizePositiveInteger(
      options.contextWindowTokens ?? stored?.contextWindowTokens ?? process.env.DEEPSEEK_CONTEXT_WINDOW_TOKENS,
      DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens,
    ),
    maxOutputTokens: normalizePositiveInteger(
      options.maxOutputTokens ?? stored?.maxOutputTokens ?? process.env.DEEPSEEK_MAX_OUTPUT_TOKENS,
      DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens,
    ),
    temperature: options.temperature ?? 0.7,
    fetchImpl,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    defaultStructuredMode: options.defaultStructuredMode ?? "strict-tool",
    jsonFallbackEnabled: options.jsonFallbackEnabled ?? true,
  };
}

function buildEndpoint(baseUrl: string): string {
  return `${baseUrl}/chat/completions`;
}

async function executeRequest(
  config: ResolvedDeepSeekConfig,
  input: {
    mode: RequestMode;
    endpointBaseUrl: string;
    messages: ChatMessage[];
    promptVersion: string;
    maxTokens: number;
    workload: DeepSeekWorkload;
    tools?: ToolDefinition[];
    toolChoice?: "required" | "auto";
    jsonMode?: boolean;
  },
): Promise<RequestAttempt> {
  const controller = new AbortController();
  const timeoutMs = Math.max(
    config.timeoutMs,
    input.mode === "plain-text" ? 150_000 : 180_000,
  );
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody: Record<string, unknown> = {
      model: config.model,
      messages: input.messages,
      stream: false,
      max_tokens: resolveWorkloadMaxTokens({
        requestedMaxTokens: input.maxTokens,
        configuredMaxOutputTokens: config.maxOutputTokens,
        contextWindowTokens: config.contextWindowTokens,
        workload: input.workload,
      }),
    };

    const requestThinkingMode =
      input.workload === "structured" || input.promptVersion === "writer.composer-length.deepseek.v1"
        ? "disabled"
        : config.thinkingMode;

    if (shouldSendThinkingControls(config.model)) {
      requestBody.thinking = { type: requestThinkingMode };
      if (requestThinkingMode === "enabled") {
        requestBody.reasoning_effort = config.reasoningEffort;
      }
    }

    if (!shouldOmitSamplingControls(config.model, requestThinkingMode)) {
      requestBody.temperature = config.temperature;
    }

    if (input.tools) {
      requestBody.tools = input.tools;
      requestBody.tool_choice = input.toolChoice ?? "required";
    }

    if (input.jsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const url = buildEndpoint(input.endpointBaseUrl);
    const response = await config.fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`DeepSeek API request failed (${response.status} ${response.statusText}): ${raw.slice(0, 500)}`);
    }

    const payload = JSON.parse(raw) as ChatCompletionResponse;
    const choice = payload.choices?.[0];
    const message = choice?.message;

    return {
      mode: input.mode,
      url,
      finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : "unknown",
      raw,
      content: typeof message?.content === "string" ? message.content.trim() : "",
      reasoningContent:
        typeof message?.reasoning_content === "string" && message.reasoning_content.trim()
          ? message.reasoning_content.trim()
          : undefined,
      toolCalls: Array.isArray(message?.tool_calls) ? message.tool_calls : [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseToolArguments<T>(attempt: RequestAttempt, toolName: string): T | undefined {
  const matchingCall = attempt.toolCalls.find((toolCall) => toolCall.function?.name === toolName);
  const argumentsJson = matchingCall?.function?.arguments;
  if (!argumentsJson || !argumentsJson.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(argumentsJson) as T;
  } catch {
    const repaired = argumentsJson
      .replace(/"([A-Za-z0-9_]+):\s*/g, "\"$1\": ")
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, "$1\"$2\":")
      .replace(/,\s*([}\]])/g, "$1");

    try {
      return JSON.parse(repaired) as T;
    } catch {
      return undefined;
    }
  }
}

async function requestJsonFallback<T>(
  config: ResolvedDeepSeekConfig,
  options: PromptOptions,
): Promise<StructuredResult<T>> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${options.systemPrompt}\nReturn valid json only.` },
    {
      role: "user",
      content: `${options.userPrompt}\n\n请严格输出 json 对象。return valid json object only.`,
    },
  ];

  let lastError = "DeepSeek JSON fallback returned no usable result.";

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const response = await executeRequest(config, {
      mode: "json-fallback",
      endpointBaseUrl: config.baseUrl,
      messages,
      promptVersion: options.promptVersion,
      maxTokens: options.maxTokens,
      workload: options.workload,
      jsonMode: true,
    });

    if (response.finishReason === "length") {
      lastError = `DeepSeek ${options.promptVersion} failed with finish reason length during json-fallback.`;
      continue;
    }

    if (!response.content) {
      lastError = response.reasoningContent
        ? `DeepSeek ${options.promptVersion} returned empty content. reasoning_content=${response.reasoningContent.slice(0, 200)}`
        : `DeepSeek ${options.promptVersion} returned empty content. raw=${response.raw.slice(0, 200)}`;
      continue;
    }

    try {
      return {
        value: JSON.parse(response.content) as T,
        raw: response.raw,
        finishReason: response.finishReason,
        requestMode: "json-fallback",
        retryCount: attempt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown parse failure";
      lastError = `DeepSeek ${options.promptVersion} returned invalid JSON: ${message}`;
    }
  }

  throw new Error(lastError);
}

async function requestStructuredTool<T>(
  config: ResolvedDeepSeekConfig,
  options: PromptOptions & {
    tool: ToolDefinition;
  },
): Promise<StructuredResult<T>> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${options.systemPrompt}\n你必须调用提供的函数工具一次，并且只通过工具参数返回结构化结果。不要直接回答，不要输出 JSON 文本。`,
    },
    { role: "user", content: options.userPrompt },
  ];

  let lastError = "DeepSeek structured tool request returned no usable tool call.";

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const response = await executeRequest(config, {
      mode: "structured-tool",
      endpointBaseUrl: config.structuredBaseUrl,
      messages,
      promptVersion: options.promptVersion,
      maxTokens: options.maxTokens,
      workload: options.workload,
      tools: [options.tool],
      toolChoice: "auto",
    });

    if (response.toolCalls.length > 0) {
      const parsed = parseToolArguments<T>(response, options.tool.function.name);
      if (parsed !== undefined) {
        return {
          value: parsed,
          raw: response.raw,
          finishReason: response.finishReason,
          requestMode: "structured-tool",
          retryCount: attempt,
        };
      }
      lastError = `DeepSeek ${options.promptVersion} returned invalid tool arguments for ${options.tool.function.name}.`;
      continue;
    }

    if (response.finishReason === "length") {
      lastError = `DeepSeek ${options.promptVersion} failed with finish reason length during structured-tool.`;
      continue;
    }

    lastError = `DeepSeek ${options.promptVersion} returned finish reason ${response.finishReason} without valid tool calls.`;
    continue;
  }

  if (!config.jsonFallbackEnabled) {
    throw new Error(lastError);
  }

  const fallback = await requestJsonFallback<T>(config, options);
  return {
    ...fallback,
    retryCount: fallback.retryCount + config.maxRetries + 1,
    fallbackUsed: "json-fallback",
  };
}

async function requestPlainText(
  config: ResolvedDeepSeekConfig,
  options: PromptOptions,
): Promise<TextResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: options.systemPrompt },
    { role: "user", content: options.userPrompt },
  ];

  let lastError = `DeepSeek ${options.promptVersion} returned empty content.`;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const response = await executeRequest(config, {
      mode: "plain-text",
      endpointBaseUrl: config.baseUrl,
      messages,
      promptVersion: options.promptVersion,
      maxTokens: options.maxTokens,
      workload: options.workload,
    });

    if (response.finishReason === "length") {
      throw new Error(`DeepSeek ${options.promptVersion} failed with finish reason length.`);
    }

    if (!response.content) {
      lastError = response.reasoningContent
        ? `DeepSeek ${options.promptVersion} returned empty content. reasoning_content=${response.reasoningContent.slice(0, 200)}`
        : `DeepSeek ${options.promptVersion} returned empty content. raw=${response.raw.slice(0, 200)}`;
      continue;
    }

    return {
      value: response.content,
      raw: response.raw,
      finishReason: response.finishReason,
      requestMode: "plain-text",
      retryCount: attempt,
    };
  }

  throw new Error(lastError);
}

function normalizeChapterPlan(candidate: unknown, fallback: ChapterPlan): ChapterPlan {
  const record = candidate && typeof candidate === "object" ? candidate : {};
  const sceneOrder = asStringArray((record as Record<string, unknown>).sceneOrder, fallback.sceneOrder);
  const normalizedSceneOrder =
    sceneOrder.length === fallback.sceneOrder.length &&
    sceneOrder.every((item) => /^scene-\d+$/.test(item))
      ? sceneOrder
      : fallback.sceneOrder;

  return {
    chapterTitle: truncateText(
      asString((record as Record<string, unknown>).chapterTitle, fallback.chapterTitle ?? fallback.chapterGoal),
      18,
    ),
    chapterGoal: truncateText(asString((record as Record<string, unknown>).chapterGoal, fallback.chapterGoal), 60),
    stageRange: asStringArray((record as Record<string, unknown>).stageRange, fallback.stageRange),
    mainConflict: truncateText(asString((record as Record<string, unknown>).mainConflict, fallback.mainConflict), 96),
    secondaryConflict: truncateText(
      asString((record as Record<string, unknown>).secondaryConflict, fallback.secondaryConflict),
      96,
    ),
    closingHook: truncateText(asString((record as Record<string, unknown>).closingHook, fallback.closingHook), 72),
    sceneOrder: normalizedSceneOrder,
    summary: truncateText(asString((record as Record<string, unknown>).summary, fallback.summary), 96),
  };
}

function normalizeSceneCard(candidate: unknown, fallback: SceneCard): SceneCard {
  const record = candidate && typeof candidate === "object" ? candidate : {};
  return {
    id: asString((record as Record<string, unknown>).id, fallback.id),
    order:
      typeof (record as Record<string, unknown>).order === "number"
        ? (record as Record<string, number>).order
        : fallback.order,
    location: truncateText(asString((record as Record<string, unknown>).location, fallback.location), 24),
    time: truncateText(asString((record as Record<string, unknown>).time, fallback.time), 16),
    participants: asStringArray((record as Record<string, unknown>).participants, fallback.participants),
    sceneGoal: truncateText(asString((record as Record<string, unknown>).sceneGoal, fallback.sceneGoal), 48),
    conflict: truncateText(asString((record as Record<string, unknown>).conflict, fallback.conflict), 72),
    hardFacts: asStringArray((record as Record<string, unknown>).hardFacts, fallback.hardFacts).map((fact) =>
      truncateText(fact, 56),
    ),
    softExpansionBudget: asStringArray(
      (record as Record<string, unknown>).softExpansionBudget,
      fallback.softExpansionBudget,
    ),
    transitionIn: truncateText(asString((record as Record<string, unknown>).transitionIn, fallback.transitionIn), 64),
    transitionOut: truncateText(asString((record as Record<string, unknown>).transitionOut, fallback.transitionOut), 64),
    focusCue: truncateText(asString((record as Record<string, unknown>).focusCue, fallback.focusCue), 36),
  };
}

function normalizeSceneCards(candidate: unknown, fallback: SceneCard[]): SceneCard[] {
  const rawCards =
    candidate && typeof candidate === "object" && Array.isArray((candidate as Record<string, unknown>).sceneCards)
      ? ((candidate as Record<string, unknown>).sceneCards as unknown[])
      : Array.isArray(candidate)
        ? candidate
        : [];

  return fallback.map((card, index) => normalizeSceneCard(rawCards[index], card));
}

function normalizeReview(candidate: unknown, fallback: ReviewReport): ReviewReport {
  const record = candidate && typeof candidate === "object" ? candidate : {};
  return {
    passed:
      typeof (record as Record<string, unknown>).passed === "boolean"
        ? Boolean((record as Record<string, unknown>).passed)
        : fallback.passed,
    issues: asStringArray((record as Record<string, unknown>).issues, fallback.issues),
    warnings: asStringArray((record as Record<string, unknown>).warnings, fallback.warnings),
    styleNotes: asStringArray((record as Record<string, unknown>).styleNotes, fallback.styleNotes),
    factCoverage:
      typeof (record as Record<string, unknown>).factCoverage === "number"
        ? Math.max(0, Math.min(1, (record as Record<string, number>).factCoverage))
        : fallback.factCoverage,
    suggestedRewrites: asStringArray(
      (record as Record<string, unknown>).suggestedRewrites,
      fallback.suggestedRewrites,
    ),
  };
}

function plannerPrompt(line: TimelineLine, lens: NarrativeLens, sourceSummary: string): PromptOptions {
  const desiredSceneCount = lens.sceneCount ?? 5;
  return {
    promptVersion: "writer.planner.deepseek.v1",
    systemPrompt:
      "你是东方玄幻/修仙群像短章节的章节规划器。只根据既定历史与硬边界产出章节规划，不得改写正史结果。",
    userPrompt: [
      `请规划一章 ${desiredSceneCount} 个叙事 beat、全知旁观、网文修仙节奏的章节。`,
      `历史线：${line.label}`,
      `跟拍角色：${lens.focusCharacterIds.join("、") || "无"}`,
      sourceSummary,
      "只输出与本章直接相关的信息。",
      "章节标题必须短、有网文章节感，不要像任务说明。",
      "必须填写 chapterTitle、chapterGoal、stageRange、mainConflict、secondaryConflict、closingHook、sceneOrder、summary。",
    ].join("\n"),
    maxTokens: 1200,
    workload: "structured",
  };
}

function plannerTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "emit_chapter_plan",
      description: "Emit a chapter plan that follows the existing world-history facts.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: [
          "chapterTitle",
          "chapterGoal",
          "stageRange",
          "mainConflict",
          "secondaryConflict",
          "closingHook",
          "sceneOrder",
          "summary",
        ],
        properties: {
          chapterTitle: { type: "string" },
          chapterGoal: { type: "string" },
          stageRange: { type: "array", items: { type: "string" } },
          mainConflict: { type: "string" },
          secondaryConflict: { type: "string" },
          closingHook: { type: "string" },
          sceneOrder: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
        },
      },
    },
  };
}

function sceneCardPrompt(plan: ChapterPlan, sourceSummary: string, sceneCount: number): PromptOptions {
  const maxTokens = Math.max(1_800, sceneCount * 900);
  return {
    promptVersion: "writer.scene-card.deepseek.v1",
    systemPrompt:
      "你是章节场景卡生成器。只允许在给定历史和章节规划之内拆分场景，不得改写硬事实或关系边界。",
    userPrompt: [
      `请把章节计划拆成 ${sceneCount} 张场景卡。`,
      formatPlanForPrompt(plan),
      sourceSummary,
      "每张卡只保留本场推进必需的信息。",
      "participants 必须列出本场所有主动出场或被本场目标/冲突/硬事实点名的已命名角色；不要只填写焦点角色。",
      "必须填写 id、order、location、time、participants、sceneGoal、conflict、hardFacts、softExpansionBudget、transitionIn、transitionOut、focusCue。",
    ].join("\n"),
    maxTokens,
    workload: "structured",
  };
}

function sceneCardTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "emit_scene_cards",
      description: "Emit ordered scene cards that satisfy the chapter plan and hard facts.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["sceneCards"],
        properties: {
          sceneCards: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "order",
                "location",
                "time",
                "participants",
                "sceneGoal",
                "conflict",
                "hardFacts",
                "softExpansionBudget",
                "transitionIn",
                "transitionOut",
                "focusCue",
              ],
              properties: {
                id: { type: "string" },
                order: { type: "number" },
                location: { type: "string" },
                time: { type: "string" },
                participants: { type: "array", items: { type: "string" } },
                sceneGoal: { type: "string" },
                conflict: { type: "string" },
                hardFacts: { type: "array", items: { type: "string" } },
                softExpansionBudget: { type: "array", items: { type: "string" } },
                transitionIn: { type: "string" },
                transitionOut: { type: "string" },
                focusCue: { type: "string" },
              },
            },
          },
        },
      },
    },
  };
}

function composerPrompt(
  plan: ChapterPlan,
  sceneCards: SceneCard[],
  sourceSummary: string,
  lens: NarrativeLens,
): PromptOptions {
  const [minLength, maxLength] = resolveLensTargetLength(lens);
  const sceneCount = sceneCards.length || lens.sceneCount || 1;
  const minParagraphs = Math.max(6, Math.min(12, sceneCount + 2));
  const maxParagraphs = Math.max(minParagraphs + 1, Math.min(14, sceneCount + 5));
  return {
    promptVersion: "writer.composer.deepseek.v1",
    systemPrompt:
      "你是东方玄幻/修仙群像小说写手。保持全知旁观叙述，不用第一人称，不要改写硬事实，不要输出解释。",
    userPrompt: [
      "请根据以下 beat 卡写出一章连续正文。",
      `章节标题：${plan.chapterTitle ?? plan.chapterGoal}`,
      `要求：总长度约 ${minLength}-${maxLength} 字；至少 ${minParagraphs} 个自然段，建议 ${minParagraphs}-${maxParagraphs} 段，每段之间用空行分隔。`,
      "要求：正文不要把章节标题重复写进正文；标题由系统单独显示。",
      "要求：最终正文必须像真实小说章节，不能输出“【第1场】”“场景一”等工程标题；beat 只是素材，不要硬拼场景卡。",
      "要求：每个自然段都必须改变知识、权力、关系、风险或欲望，不能只有说明和过场。",
      "要求：最后 20% 必须写到章末钩子和本章代价落定，不能停在角色刚要选择、刚要出手、刚发现线索的半截位置。",
      "要求：使用经典长篇写作原则：欲望驱动外部压力；人物转折必须有可见触发和隐藏压力史；物件、地点、时机和术数意象要形成伏笔与回响；优先具体动作、感官和社会/宗门约束，不写空泛情绪标签。",
      "要求：保持网文修仙节奏、对白、动作、中段转折、小高潮与章末钩子，不要解释写作策略，不要改写结果。",
      "要求：硬事实没有给出的悬念内容只能作为未证实线索处理，不得新增确证性罪名、违禁物、内应身份或反转事件定性。",
      formatPlanForPrompt(plan),
      formatSceneCardsForPrompt(sceneCards),
      sourceSummary,
    ].join("\n"),
    maxTokens: 4200,
    workload: "prose",
  };
}

function composerLengthRepairPrompt(
  plan: ChapterPlan,
  sceneCards: SceneCard[],
  sourceSummary: string,
  lens: NarrativeLens,
  chapterText: string,
): PromptOptions {
  const [minLength, maxLength] = resolveLensTargetLength(lens);
  const currentLength = chapterText.trim().length;
  return {
    promptVersion: "writer.composer-length.deepseek.v1",
    systemPrompt:
      "你是小说正文长度校准器。只输出校准后的正文，不要解释，不要输出修改说明，不要改写硬事实。",
    userPrompt: [
      `当前正文约 ${currentLength} 字，目标必须落在 ${minLength}-${maxLength} 字。`,
      `这是硬性验收条件：输出正文字符数必须在 ${minLength}-${maxLength} 之间，不能超过 ${maxLength} 字。`,
      "请在保留章节起承转合、硬事实、角色关系边界和章末钩子的前提下校准长度。",
      "如果原文过长，压缩重复环境、内心解释和弱动作；如果原文过短，补足动作、对白和场间承接。",
      "正文必须像真实小说章节，至少 6 个自然段，段落之间用空行分隔；不要输出“【第1场】”“场景一”等工程标题，不要新增越界结果。",
      "最后 20% 必须写到章末钩子和本章代价落定，不能停在刚要选择或刚要出手。",
      "硬事实没有给出的悬念内容只能作为未证实线索处理，不得新增确证性罪名、违禁物、内应身份或反转事件定性。",
      formatPlanForPrompt(plan),
      formatSceneCardsForPrompt(sceneCards),
      sourceSummary,
      `原正文：\n${chapterText}`,
    ].join("\n"),
    maxTokens: Math.max(900, Math.min(4200, Math.ceil(maxLength * 1.6))),
    workload: "prose",
  };
}

function formatSceneDraftsForPrompt(draft: ChapterDraft): string {
  return draft.sceneDrafts
    .map((scene, index) =>
      [
        `场景 ${index + 1}：${scene.title}`,
        `摘要：${scene.summary}`,
        `正文：${scene.text}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function chapterAssemblerPrompt(
  draft: ChapterDraft,
  sourceSummary: string,
  lens: NarrativeLens,
): PromptOptions {
  const [minLength, maxLength] = resolveLensTargetLength(lens);
  return {
    promptVersion: "writer.chapter-assembler.deepseek.v1",
    systemPrompt:
      "你是长篇小说章节装配器。只输出完整章节正文，不要解释，不要输出修改说明，不要改写硬事实。",
    userPrompt: [
      "请把以下已经写完的场景草稿装配成一章连续、可直接发表的正文。",
      `硬性要求：完整章节总长度必须落在 ${minLength}-${maxLength} 字。`,
      "要求：最终正文至少 6 个自然段，段落之间用空行分隔；不要输出“【第1场】”“场景一”等工程标题；要把场景草稿织成自然起承转合。",
      "要求：每个自然段都必须改变知识、权力、关系、风险或欲望；最后 20% 必须写到章末钩子和本章代价落定。",
      "要求：所有场景结果、硬事实、角色关系边界必须保留；不能把未证实线索写成已确认事实。",
      "要求：硬事实没有给出的悬念内容只能作为未证实线索处理，不得新增确证性罪名、违禁物、内应身份或反转事件定性。",
      formatPlanForPrompt(draft.plan),
      sourceSummary,
      formatSceneDraftsForPrompt(draft),
    ].join("\n"),
    maxTokens: Math.max(4200, Math.ceil(maxLength * 2.2)),
    workload: "prose",
  };
}

function lengthDistance(text: string, lens: NarrativeLens): number {
  const [minLength, maxLength] = resolveLensTargetLength(lens);
  const length = text.trim().length;
  if (length < minLength) {
    return minLength - length;
  }
  if (length > maxLength) {
    return length - maxLength;
  }
  return 0;
}

function shouldRepairLength(text: string, lens: NarrativeLens): boolean {
  return lengthDistance(text, lens) > 0;
}

function chooseLengthCandidate(original: string, repaired: string, lens: NarrativeLens): string {
  return lengthDistance(repaired, lens) <= lengthDistance(original, lens) ? repaired : original;
}

function splitSentences(text: string): string[] {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return [];
  }
  return compact.match(/[^。！？!?；;]+[。！？!?；;]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [
    compact,
  ];
}

function trimTextAtSentenceBoundary(text: string, maxLength: number): string {
  const compact = text.trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  const clipped = compact.slice(0, Math.max(0, maxLength));
  const boundary = Math.max(
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("！"),
    clipped.lastIndexOf("？"),
    clipped.lastIndexOf("；"),
    clipped.lastIndexOf("\n"),
  );
  if (boundary >= Math.max(20, Math.floor(maxLength * 0.6))) {
    return clipped.slice(0, boundary + 1).trim();
  }
  return clipped.trim();
}

function splitChapterSections(chapterText: string): string[] {
  const sections = chapterText
    .split(/(?=【第\d+场[:：][^】]+】)/)
    .map((section) => section.trim())
    .filter(Boolean);
  return sections.length > 0 ? sections : [chapterText.trim()].filter(Boolean);
}

function compressSection(section: string, maxLength: number): string {
  if (section.length <= maxLength) {
    return section.trim();
  }
  const heading = section.match(/^【第\d+场[:：][^】]+】/)?.[0] ?? "";
  const body = heading ? section.slice(heading.length).trim() : section.trim();
  const sentences = splitSentences(body);
  const budget = Math.max(40, maxLength - heading.length);
  const kept: string[] = [];

  for (const sentence of sentences) {
    const next = [...kept, sentence].join("");
    if (next.length > budget) {
      break;
    }
    kept.push(sentence);
  }

  const compressedBody = kept.length > 0 ? kept.join("") : trimTextAtSentenceBoundary(body, budget);
  return `${heading}${compressedBody}`.trim();
}

function hardFitOverlongChapter(chapterText: string, lens: NarrativeLens): string {
  const [, maxLength] = resolveLensTargetLength(lens);
  if (chapterText.trim().length <= maxLength) {
    return chapterText.trim();
  }

  const sections = splitChapterSections(chapterText);
  const separatorBudget = Math.max(0, sections.length - 1) * 2;
  let currentPerSectionMax = Math.max(80, Math.floor((maxLength - separatorBudget) / Math.max(1, sections.length)));
  let compressed = sections.map((section) => compressSection(section, currentPerSectionMax)).join("\n\n").trim();

  while (compressed.length > maxLength && currentPerSectionMax > 60) {
    const overflow = compressed.length - maxLength;
    const nextPerSectionMax = Math.max(
      60,
      currentPerSectionMax - Math.ceil(overflow / Math.max(1, sections.length)) - 4,
    );
    if (nextPerSectionMax === currentPerSectionMax) {
      break;
    }
    currentPerSectionMax = nextPerSectionMax;
    compressed = sections.map((section) => compressSection(section, nextPerSectionMax)).join("\n\n").trim();
  }

  return trimTextAtSentenceBoundary(compressed, maxLength);
}

function ensureReadableParagraphs(chapterText: string, lens: NarrativeLens): string {
  const existing = chapterText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (existing.length >= 6) {
    return existing.join("\n\n");
  }

  const sentences =
    existing.length > 1
      ? existing.flatMap((paragraph) => splitSentences(paragraph))
      : splitSentences(chapterText);
  if (sentences.length < 6) {
    return chapterText.trim();
  }

  const targetParagraphs = Math.max(6, Math.min(10, lens.sceneCount ? lens.sceneCount + 2 : 7));
  const buckets = Array.from({ length: Math.min(targetParagraphs, sentences.length) }, () => [] as string[]);
  sentences.forEach((sentence, index) => {
    const bucketIndex = Math.min(buckets.length - 1, Math.floor((index * buckets.length) / sentences.length));
    buckets[bucketIndex].push(sentence);
  });

  return buckets
    .map((bucket) => bucket.join("").trim())
    .filter(Boolean)
    .join("\n\n");
}

function normalizeFinalChapterText(chapterText: string, lens: NarrativeLens): string {
  return ensureReadableParagraphs(chapterText, lens).trim();
}

function enrichSceneParticipants(sceneCards: SceneCard[], sourcePack: ReturnType<typeof buildNarrativeSourcePack>): SceneCard[] {
  const knownParticipants = unique(sourcePack.events.flatMap((event) => event.participants));
  if (knownParticipants.length === 0) {
    return sceneCards;
  }

  return sceneCards.map((card) => {
    const sceneText = [
      card.sceneGoal,
      card.conflict,
      ...card.hardFacts,
      ...card.softExpansionBudget,
      card.transitionIn,
      card.transitionOut,
      card.focusCue,
    ].join("\n");
    const mentionedParticipants = knownParticipants.filter((participant) => sceneText.includes(participant));
    return {
      ...card,
      participants: unique([...card.participants, ...mentionedParticipants]),
    };
  });
}

function reviewerPrompt(chapterText: string, sceneCards: SceneCard[], sourceSummary: string): PromptOptions {
  return {
    promptVersion: "writer.reviewer.deepseek.v1",
    systemPrompt:
      "你是小说写作复核器。只判断事实一致性、全知旁观群像视角、节奏和越界问题，不得改写历史。",
    userPrompt: [
      "请审核下面这一章是否守住硬事实、关系边界、全知旁观群像视角和网文章节节奏。",
      "硬性不通过：少于 6 个自然段、压成一个超长段落、最后 20% 没写到章末钩子、最后两个场景结果缺失、章节停在刚要选择或刚要出手。",
      "重点检查：是否像真实小说章节一样自然起承转合；是否残留“【第1场】”“场景一”等工程标题；是否只是硬拼场景；每段是否改变知识、权力、关系、风险或欲望。",
      formatSceneCardsForPrompt(sceneCards),
      sourceSummary,
      `正文：\n${chapterText}`,
      "必须填写 passed、issues、warnings、styleNotes、factCoverage、suggestedRewrites。",
    ].join("\n"),
    maxTokens: 1400,
    workload: "structured",
  };
}

function reviewerTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "emit_review_report",
      description: "Emit a structured review report for the generated chapter.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["passed", "issues", "warnings", "styleNotes", "factCoverage", "suggestedRewrites"],
        properties: {
          passed: { type: "boolean" },
          issues: { type: "array", items: { type: "string" } },
          warnings: { type: "array", items: { type: "string" } },
          styleNotes: { type: "array", items: { type: "string" } },
          factCoverage: { type: "number" },
          suggestedRewrites: { type: "array", items: { type: "string" } },
        },
      },
    },
  };
}

function rewritePrompt(
  draft: ChapterDraft,
  sceneId: string,
  instructions: string[],
  sourceSummary: string,
): PromptOptions {
  const scene = draft.sceneDrafts.find((item) => item.sceneId === sceneId);
  return {
    promptVersion: "writer.rewrite.deepseek.v1",
    systemPrompt:
      "你是小说局部重写器。只重写指定场景，不得修改其他场景，不得改写硬事实，不要输出解释。",
    userPrompt: [
      `请只重写 sceneId=${sceneId} 的场景文本。`,
      `重写指令：${instructions.join(" / ")}`,
      `场景摘要：${scene?.summary ?? "未找到场景摘要"}`,
      `原场景正文：\n${scene?.text ?? ""}`,
      sourceSummary,
    ].join("\n"),
    maxTokens: 2400,
    workload: "rewrite",
  };
}

function summarizeWorldForSimulation(context: SimulationProviderContext): string {
  const latestStage = context.canonLine.stages.at(-1);
  const latestSnapshot = latestStage?.snapshot ?? context.canonLine.snapshots.initial;
  const world = context.parsed.worldSpec;
  const characterSummaries = latestSnapshot
    ? Object.entries(latestSnapshot.characters)
        .map(
          ([characterId, state]) =>
            `${characterId}:${state.lastAction || "idle"}|进度${state.progress}|压力${state.pressure}|立场${state.stance}`,
        )
        .slice(0, 6)
        .join(" / ")
    : "无";
  const relationshipSummaries = latestSnapshot
    ? Object.values(latestSnapshot.relationships)
        .map((relation) => `${relation.left}-${relation.right}:${relation.status}`)
        .slice(0, 6)
        .join(" / ")
    : "无";
  const recentEvents = context.canonLine.events
    .slice(-3)
    .map((event) => `${event.title}:${truncateText(event.summary, 60)}`)
    .join(" / ");
  const characterAnchors = context.parsed.characterAnchors
    .map((anchor) => `${anchor.characterId}|禁=${anchor.cannot}|趋=${anchor.mustTrend}|目标=${anchor.stageGoal}`)
    .slice(0, 6)
    .join("\n");
  const relationshipAnchors = context.parsed.relationshipAnchors
    .map((anchor) => `${anchor.left}-${anchor.right}|边界=${anchor.boundary}|趋势=${anchor.trend}`)
    .slice(0, 6)
    .join("\n");

  return [
    `世界：${world.genre} / ${world.cultivationSystem} / ${world.timeScale}`,
    summarizeList("世界规则", world.worldRules, 4, 24),
    summarizeList("势力", world.factions.map((faction) => `${faction.name}:${faction.description}`), 3, 26),
    summarizeList("地点", world.locations.map((location) => `${location.name}:${location.description}`), 3, 24),
    `当前阶段标签：${context.directive.stageLabel}`,
    `焦点角色：${context.directive.focusCharacterIds.join("、") || "无"}`,
    `外部干预：${context.directive.intervention ?? "无"}`,
    `奇门覆写：${stableStringify(context.directive.qimenOverride ?? {})}`,
    `最近事件：${recentEvents || "尚无已发生事件"}`,
    `当前人物态：${characterSummaries}`,
    `当前关系态：${relationshipSummaries}`,
    `单角色锚点：\n${characterAnchors || "无"}`,
    `关系锚点：\n${relationshipAnchors || "无"}`,
  ].join("\n");
}

function simulationPrompt(context: SimulationProviderContext): PromptOptions {
  return {
    promptVersion: "simulation.stage.deepseek.v1",
    systemPrompt:
      "你是东方玄幻/修仙世界史引擎的阶段推演器。你必须基于当前真相、角色锚点、关系边界和奇门上下文，生成下一阶段的正史候选与2到4条分叉候选。不得无因改人物，不得写死不合设定的跳变。",
    userPrompt: [
      "请为下一阶段生成一个正史候选和 2-4 条分叉候选。",
      "要求：人物行动必须能回溯到当前状态与锚点；分叉之间要有明显差异；推荐项只能有一条或零条。",
      "要求：不要写小说正文，只输出阶段事件、状态变化、角色更新、关系更新、分叉评分理由。",
      "要求：每条 characterUpdates 必须给出 characterId、lastAction、progressDelta、pressureDelta、note、stance、alive；每条 relationshipUpdates 必须给出 left、right、status、note。",
      summarizeWorldForSimulation(context),
    ].join("\n"),
    maxTokens: 3200,
    workload: "simulation",
  };
}

function simulationTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "emit_simulation_stage",
      description: "Emit the next canon stage proposal plus 2-4 branch proposals for the world-history engine.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["canon", "branches"],
        properties: {
          canon: {
            type: "object",
            additionalProperties: false,
            required: ["event", "characterUpdates", "relationshipUpdates"],
            properties: {
              event: {
                type: "object",
                additionalProperties: false,
                required: ["title", "summary", "participants", "tags", "stateChanges"],
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  participants: { type: "array", items: { type: "string" } },
                  tags: { type: "array", items: { type: "string" } },
                  stateChanges: { type: "array", items: { type: "string" } },
                },
              },
              characterUpdates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["characterId", "lastAction", "progressDelta", "pressureDelta", "note", "stance", "alive"],
                  properties: {
                    characterId: { type: "string" },
                    lastAction: { type: "string" },
                    progressDelta: { type: "number" },
                    pressureDelta: { type: "number" },
                    note: { type: "string" },
                    stance: { type: "string" },
                    alive: { type: "boolean" },
                  },
                },
              },
              relationshipUpdates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["left", "right", "status", "note"],
                  properties: {
                    left: { type: "string" },
                    right: { type: "string" },
                    status: { type: "string" },
                    note: { type: "string" },
                  },
                },
              },
            },
          },
          branches: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "title",
                "event",
                "spectacle",
                "pacing",
                "reasons",
                "risks",
                "recommended",
                "characterUpdates",
                "relationshipUpdates",
              ],
              properties: {
                title: { type: "string" },
                event: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "summary", "participants", "tags", "stateChanges"],
                  properties: {
                    title: { type: "string" },
                    summary: { type: "string" },
                    participants: { type: "array", items: { type: "string" } },
                    tags: { type: "array", items: { type: "string" } },
                    stateChanges: { type: "array", items: { type: "string" } },
                  },
                },
                spectacle: { type: "number" },
                pacing: { type: "number" },
                reasons: { type: "array", items: { type: "string" } },
                risks: { type: "array", items: { type: "string" } },
                recommended: { type: "boolean" },
                characterUpdates: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["characterId", "lastAction", "progressDelta", "pressureDelta", "note", "stance", "alive"],
                    properties: {
                      characterId: { type: "string" },
                      lastAction: { type: "string" },
                      progressDelta: { type: "number" },
                      pressureDelta: { type: "number" },
                      note: { type: "string" },
                      stance: { type: "string" },
                      alive: { type: "boolean" },
                    },
                  },
                },
                relationshipUpdates: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["left", "right", "status", "note"],
                    properties: {
                      left: { type: "string" },
                      right: { type: "string" },
                      status: { type: "string" },
                      note: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function normalizeSimulationEvent(candidate: unknown, fallbackTitle: string): SimulationStageProposal["canon"]["event"] {
  const record = candidate && typeof candidate === "object" ? candidate : {};
  const title = truncateText(asString((record as Record<string, unknown>).title, fallbackTitle), 48);
  return {
    title,
    summary: truncateText(asString((record as Record<string, unknown>).summary, `${title}继续推进。`), 180),
    participants: asStringArray((record as Record<string, unknown>).participants, []),
    tags: asStringArray((record as Record<string, unknown>).tags, ["conflict"]),
    stateChanges: asStringArray((record as Record<string, unknown>).stateChanges, []),
  };
}

function normalizeCharacterUpdates(candidate: unknown): SimulationStageProposal["canon"]["characterUpdates"] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      characterId: asString(item.characterId, ""),
      lastAction: truncateText(asString(item.lastAction, "应局"), 24),
      progressDelta: typeof item.progressDelta === "number" ? item.progressDelta : 0,
      pressureDelta: typeof item.pressureDelta === "number" ? item.pressureDelta : 0,
      note: typeof item.note === "string" ? truncateText(item.note, 72) : undefined,
      stance: typeof item.stance === "string" ? truncateText(item.stance, 24) : undefined,
      alive: typeof item.alive === "boolean" ? item.alive : undefined,
    }))
    .filter((item) => item.characterId);
}

function normalizeRelationshipUpdates(candidate: unknown): SimulationStageProposal["canon"]["relationshipUpdates"] {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      left: asString(item.left, ""),
      right: asString(item.right, ""),
      status: truncateText(asString(item.status, "维持原状"), 24),
      note: typeof item.note === "string" ? truncateText(item.note, 72) : undefined,
    }))
    .filter((item) => item.left && item.right);
}

function normalizeBranchProposals(candidate: unknown): BranchProposal[] {
  if (!Array.isArray(candidate)) {
    throw new Error("DeepSeek simulation response did not contain branch proposals.");
  }

  const normalized = candidate
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => ({
      title: truncateText(asString(item.title, `分支${index + 1}`), 48),
      event: normalizeSimulationEvent(item.event, `分支${index + 1}`),
      spectacle: typeof item.spectacle === "number" ? item.spectacle : 6,
      pacing: typeof item.pacing === "number" ? item.pacing : 6,
      reasons: asStringArray(item.reasons, []),
      risks: asStringArray(item.risks, []),
      recommended: Boolean(item.recommended),
      characterUpdates: normalizeCharacterUpdates(item.characterUpdates),
      relationshipUpdates: normalizeRelationshipUpdates(item.relationshipUpdates),
    }))
    .slice(0, 4);

  if (normalized.length < 2) {
    throw new Error("DeepSeek simulation response must contain 2-4 branch proposals.");
  }

  const recommendedCount = normalized.filter((branch) => branch.recommended).length;
  if (recommendedCount > 1) {
    normalized.forEach((branch, index) => {
      branch.recommended = index === 0;
    });
  }

  return normalized;
}

function normalizeSimulationStageProposal(candidate: unknown): SimulationStageProposal {
  const record = candidate && typeof candidate === "object" ? candidate : {};
  return {
    canon: {
      event: normalizeSimulationEvent((record as Record<string, unknown>).canon && (record as Record<string, unknown>).canon as Record<string, unknown> ? ((record as Record<string, unknown>).canon as Record<string, unknown>).event : undefined, "正史推进"),
      characterUpdates: normalizeCharacterUpdates(
        (record as Record<string, unknown>).canon && typeof (record as Record<string, unknown>).canon === "object"
          ? ((record as Record<string, unknown>).canon as Record<string, unknown>).characterUpdates
          : undefined,
      ),
      relationshipUpdates: normalizeRelationshipUpdates(
        (record as Record<string, unknown>).canon && typeof (record as Record<string, unknown>).canon === "object"
          ? ((record as Record<string, unknown>).canon as Record<string, unknown>).relationshipUpdates
          : undefined,
      ),
    },
    branches: normalizeBranchProposals((record as Record<string, unknown>).branches),
  };
}

function formatPlanForPrompt(plan: ChapterPlan): string {
  return [
    `章节标题：${plan.chapterTitle ?? plan.chapterGoal}`,
    `章节目标：${plan.chapterGoal}`,
    `阶段范围：${plan.stageRange.join("、") || "未指定"}`,
    `主冲突：${plan.mainConflict}`,
    `副冲突：${plan.secondaryConflict}`,
    `章末钩子：${plan.closingHook}`,
    `场景顺序：${plan.sceneOrder.join(" -> ")}`,
    `结构摘要：${plan.summary}`,
  ].join("\n");
}

function formatSceneCardsForPrompt(sceneCards: SceneCard[]): string {
  return [
    "场景卡：",
    ...sceneCards.map((scene) =>
      [
        `${scene.id}#${scene.order}`,
        `地点=${scene.location}`,
        `时间=${scene.time}`,
        `参与者=${limitItems(scene.participants, 4).join("、") || "无"}`,
        `目标=${scene.sceneGoal}`,
        `冲突=${scene.conflict}`,
        `硬事实=${limitItems(scene.hardFacts, 2).join("；") || "无"}`,
        `扩写=${limitItems(scene.softExpansionBudget, 2).join("；") || "无"}`,
      ].join(" | "),
    ),
  ].join("\n");
}

function buildMemorySummary(memoryPack?: NarrativeMemoryPack): string {
  if (!memoryPack) {
    return "";
  }

  const factSummaries = memoryPack.factEntries.map((entry) => entry.summary);
  const expressionSummaries = memoryPack.expressionEntries
    .filter((entry) => entry.active)
    .map((entry) => `${entry.summary}：${entry.text}`);
  const foreshadowSummaries = memoryPack.foreshadowEntries
    .filter((entry) => entry.status === "open")
    .map((entry) => entry.summary);
  const revisionSummaries = memoryPack.revisionEntries.map((entry) => entry.summary);

  if (
    factSummaries.length === 0 &&
    expressionSummaries.length === 0 &&
    foreshadowSummaries.length === 0 &&
    revisionSummaries.length === 0
  ) {
    return "";
  }

  return [
    "记忆约束：",
    summarizeList("已确认事实记忆", factSummaries, 4, 72),
    summarizeList("作者定稿表达", expressionSummaries, 4, 96),
    summarizeList("未兑现伏笔", foreshadowSummaries, 4, 72),
    summarizeList("修订记录", revisionSummaries, 4, 72),
  ].join("\n");
}

function buildSourceSummary(
  line: TimelineLine,
  lens: NarrativeLens,
  mode: "planner" | "scene" | "compose" | "review" | "rewrite" = "planner",
  memoryPack?: NarrativeMemoryPack,
): string {
  const sourcePack = buildNarrativeSourcePack({ line, lens });
  const memorySummary = buildMemorySummary(memoryPack);
  if (mode === "planner") {
    return [
      `阶段：${sourcePack.stageIds.join("、") || "未指定"}`,
      `焦点：${lens.focusCharacterIds.join("、") || "无"}`,
      `空间：${sourcePack.qimenContext.locationFocus}`,
      `压强：${truncateText(sourcePack.worldPressureSummary, 28)}`,
      summarizeList("关键事实", sourcePack.hardFacts, 2, 24),
      summarizeList("禁止越界", sourcePack.forbiddenMoves, 3, 16),
      memorySummary,
    ].filter(Boolean).join("\n");
  }

  if (mode === "scene") {
    return [
      `阶段：${sourcePack.stageIds.join("、") || "未指定"}`,
      `空间焦点：${sourcePack.qimenContext.locationFocus}`,
      `压强：${truncateText(sourcePack.worldPressureSummary, 42)}`,
      summarizeList("角色摘要", sourcePack.characterSummaries, 2, 24),
      summarizeList("关系摘要", sourcePack.relationshipSummaries, 2, 24),
      summarizeList("关键事实", sourcePack.hardFacts, 3, 28),
      summarizeList("禁止越界", sourcePack.forbiddenMoves, 4, 18),
      memorySummary,
    ].filter(Boolean).join("\n");
  }

  const parts = [
    `阶段：${sourcePack.stageIds.join("、") || "未指定"}`,
    `空间焦点：${sourcePack.qimenContext.locationFocus}`,
    `世界压强：${truncateText(sourcePack.worldPressureSummary, 80)}`,
    `宫位摘要：${truncateText(sourcePack.palaceSummary, 72)}`,
    summarizeList("角色摘要", sourcePack.characterSummaries, 3, 56),
    summarizeList("关系摘要", sourcePack.relationshipSummaries, 3, 56),
    summarizeList("硬事实", sourcePack.hardFacts, 5, 72),
  ];

  if (mode === "compose" || mode === "review" || mode === "rewrite") {
    parts.push(summarizeList("允许扩写", sourcePack.softExpansionBudget, mode === "compose" ? 4 : 3, 18));
  }

  parts.push(summarizeList("禁止越界", sourcePack.forbiddenMoves, 4, 40));
  if (memorySummary) {
    parts.push(memorySummary);
  }
  return parts.join("\n");
}

function splitChapterIntoScenes(chapterText: string, sceneCards: SceneCard[]): string[] {
  const matches = [...chapterText.matchAll(/【第\d+场：[\s\S]*?(?=【第\d+场：|$)/g)];
  if (matches.length === sceneCards.length) {
    return matches.map((match) => match[0].trim());
  }

  if (matches.length > 0) {
    return sceneCards.map((_, index) => matches[index]?.[0]?.trim() ?? "");
  }

  const paragraphs = chapterText
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length >= sceneCards.length) {
    const buckets = Array.from({ length: sceneCards.length }, () => [] as string[]);
    paragraphs.forEach((paragraph, index) => {
      const bucketIndex = Math.min(sceneCards.length - 1, Math.floor((index * sceneCards.length) / paragraphs.length));
      buckets[bucketIndex].push(paragraph);
    });
    return buckets.map((bucket, index) =>
      bucket.length > 0 ? bucket.join("\n\n") : `${sceneCards[index]?.sceneGoal ?? "章节片段"}：${chapterText.trim()}`,
    );
  }

  const chunkSize = Math.max(1, Math.ceil(chapterText.trim().length / Math.max(1, sceneCards.length)));
  return sceneCards.map((card, index) => {
    const start = index * chunkSize;
    const chunk = chapterText.trim().slice(start, start + chunkSize).trim();
    return chunk || `${card.sceneGoal}：${chapterText.trim()}`;
  });
}

function isHardBoundaryIssue(issue: string): boolean {
  return (
    issue.includes("越界") ||
    issue.includes("自然段") ||
    issue.includes("章末钩子") ||
    issue.includes("未完成场景") ||
    issue.includes("改邪归正") ||
    issue.includes("并肩结盟") ||
    issue.includes("无因互信")
  );
}

function buildComposerDraft(sceneCards: SceneCard[], chapterText: string, composerRecord: WritingRunRecord): SceneDraft[] {
  const chapterScenes = splitChapterIntoScenes(chapterText, sceneCards);
  return sceneCards.map((scene, index) => ({
    sceneId: scene.id,
    title: `${scene.sceneGoal}·${scene.location}`,
    summary: `${scene.location}里，${scene.conflict}`,
    text: chapterScenes[index] || `【第${scene.order}场：${scene.sceneGoal}】\n${chapterText.trim()}`,
    runRecord: composerRecord,
  }));
}

function sceneCardsFromChapterDraft(
  draft: ChapterDraft,
  lens: NarrativeLens,
  sourcePack?: ReturnType<typeof buildNarrativeSourcePack>,
): SceneCard[] {
  return draft.sceneDrafts.map((scene, index) => ({
    id: scene.sceneId,
    order: index + 1,
    location: scene.title.split("·").at(-1) ?? "局中",
    time: `第${index + 1}场`,
    participants: lens.focusCharacterIds,
    sceneGoal: scene.title.split("·")[0] ?? scene.title,
    conflict: scene.summary,
    hardFacts: sourcePack?.hardFacts ?? [],
    softExpansionBudget: sourcePack?.softExpansionBudget ?? [],
    transitionIn: "承接上场",
    transitionOut: "压向下场",
    focusCue: "全知旁观",
  }));
}

export async function simulateStageWithDeepSeek(
  context: SimulationProviderContext,
  options: DeepSeekProviderOptions = {},
): Promise<{
  proposal: SimulationStageProposal;
  runRecord: import("./domain").RunRecord;
}> {
  const config = resolveDeepSeekConfig(options);
  const prompt = simulationPrompt(context);
  const response = await requestStructuredTool<Record<string, unknown>>(config, {
    ...prompt,
    tool: simulationTool(),
  });
  const proposal = normalizeSimulationStageProposal(response.value);

  return {
    proposal,
    runRecord: {
      stage: "memory-read",
      providerName: "deepseek-simulation-provider",
      modelName: config.model,
      summary: `已通过 DeepSeek 生成下一阶段提案：${proposal.canon.event.title}`,
      promptVersion: prompt.promptVersion,
      rawOutput: response.raw,
      requestMode: response.requestMode,
      finishReason: response.finishReason,
      retryCount: response.retryCount,
      fallbackUsed: response.fallbackUsed,
      validationResult: `branches=${proposal.branches.length}`,
    },
  };
}

export async function validateDeepSeekConnection(
  options: DeepSeekProviderOptions = {},
): Promise<{
  ok: true;
  model: string;
  requestMode: "plain-text";
  finishReason: string;
}> {
  const config = resolveDeepSeekConfig(options);
  const response = await requestPlainText(config, {
    promptVersion: "deepseek.validate.v1",
    systemPrompt: "You are a connectivity probe. Reply with one short word only.",
    userPrompt: "Reply with: pong",
    maxTokens: 64,
    workload: "validation",
  });

  return {
    ok: true,
    model: config.model,
    requestMode: response.requestMode,
    finishReason: response.finishReason,
  };
}

export async function planChapterWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<{
  plan: ChapterPlan;
  runRecord: WritingRunRecord;
}> {
  const config = resolveDeepSeekConfig(options);
  const sourcePack = buildNarrativeSourcePack(input);
  const sourceSummary = buildSourceSummary(input.line, input.lens, "planner", input.memoryPack);
  const fallbackPlan = planChapter(sourcePack, input.lens);
  const prompt = plannerPrompt(input.line, input.lens, sourceSummary);
  const response = await requestStructuredTool<Record<string, unknown>>(config, {
    ...prompt,
    tool: plannerTool(),
  });
  const plan = normalizeChapterPlan(response.value, fallbackPlan);
  return {
    plan,
    runRecord: makeRunRecord(
      "planner",
      prompt.promptVersion,
      config.model,
      summarizeMessages([
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ]),
      response.raw,
      "已通过 DeepSeek 生成章节计划",
      response,
    ),
  };
}

export async function expandScenesWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    plan: ChapterPlan;
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<{
  sceneCards: SceneCard[];
  runRecord: WritingRunRecord;
}> {
  const config = resolveDeepSeekConfig(options);
  const sourcePack = buildNarrativeSourcePack({
    line: input.line,
    lens: input.lens,
  });
  const sourceSummary = buildSourceSummary(input.line, input.lens, "scene", input.memoryPack);
  const fallbackSceneCards = generateSceneCards(sourcePack, input.plan);
  const prompt = sceneCardPrompt(input.plan, sourceSummary, fallbackSceneCards.length);
  const response = await requestStructuredTool<Record<string, unknown>>(config, {
    ...prompt,
    tool: sceneCardTool(),
  });
  const sceneCards = enrichSceneParticipants(normalizeSceneCards(response.value, fallbackSceneCards), sourcePack);
  return {
    sceneCards,
    runRecord: makeRunRecord(
      "scene-card",
      prompt.promptVersion,
      config.model,
      summarizeMessages([
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ]),
      response.raw,
      "已通过 DeepSeek 生成场景卡",
      response,
    ),
  };
}

export async function synthesizeChapterWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    plan: ChapterPlan;
    sceneCards: SceneCard[];
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<{
  chapterText: string;
  sceneDrafts: SceneDraft[];
  runRecord: WritingRunRecord;
}> {
  const config = resolveDeepSeekConfig(options);
  const sourceSummary = buildSourceSummary(input.line, input.lens, "compose", input.memoryPack);
  const prompt = composerPrompt(input.plan, input.sceneCards, sourceSummary, input.lens);
  const response = await requestPlainText(config, prompt);
  let finalPrompt = prompt;
  let finalResponse = response;
  let finalText = normalizeFinalChapterText(response.value, input.lens);
  const lengthRepairResponses: TextResult[] = [];
  let hardLengthFitApplied = false;

  while (shouldRepairLength(finalText, input.lens) && lengthRepairResponses.length < maxLengthRepairAttempts()) {
    const repairPrompt = composerLengthRepairPrompt(
      input.plan,
      input.sceneCards,
      sourceSummary,
      input.lens,
      finalText,
    );
    const repairResponse = await requestPlainText(config, repairPrompt);
    finalPrompt = repairPrompt;
    lengthRepairResponses.push(repairResponse);
    finalText = normalizeFinalChapterText(chooseLengthCandidate(finalText, repairResponse.value, input.lens), input.lens);
    finalResponse = finalText === repairResponse.value ? repairResponse : response;
  }

  if (shouldRepairLength(finalText, input.lens)) {
    const fittedText = hardFitOverlongChapter(finalText, input.lens);
    if (lengthDistance(fittedText, input.lens) <= lengthDistance(finalText, input.lens)) {
      hardLengthFitApplied = fittedText !== finalText;
      finalText = normalizeFinalChapterText(fittedText, input.lens);
    }
  }

  const rawOutput =
    lengthRepairResponses.length > 0 || hardLengthFitApplied
      ? [
          response.raw,
          ...lengthRepairResponses.flatMap((repairResponse, index) => [
            `--- length repair ${index + 1} ---`,
            repairResponse.raw,
          ]),
          ...(hardLengthFitApplied ? ["--- local length fit ---", finalText] : []),
        ].join("\n")
      : finalResponse.raw;
  const runRecord = makeRunRecord(
    "composer",
    finalPrompt.promptVersion,
    config.model,
    summarizeMessages([
      { role: "system", content: finalPrompt.systemPrompt },
      { role: "user", content: finalPrompt.userPrompt },
    ]),
    rawOutput,
    lengthRepairResponses.length > 0 || hardLengthFitApplied
      ? `已通过 DeepSeek 生成章节正文，并校准长度为 ${finalText.trim().length} 字`
      : "已通过 DeepSeek 生成章节正文",
    finalResponse,
  );
  return {
    chapterText: finalText,
    sceneDrafts: buildComposerDraft(input.sceneCards, finalText, runRecord),
    runRecord,
  };
}

export async function assembleChapterWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    draft: ChapterDraft;
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<ChapterDraft> {
  const config = resolveDeepSeekConfig(options);
  const sourcePack = buildNarrativeSourcePack({ line: input.line, lens: input.lens });
  const sourceSummary = buildSourceSummary(input.line, input.lens, "compose", input.memoryPack);
  const prompt = chapterAssemblerPrompt(input.draft, sourceSummary, input.lens);
  const response = await requestPlainText(config, prompt);
  const sceneCards = sceneCardsFromChapterDraft(input.draft, input.lens, sourcePack);
  let finalPrompt = prompt;
  let finalResponse = response;
  let finalText = normalizeFinalChapterText(response.value, input.lens);
  const lengthRepairResponses: TextResult[] = [];
  let hardLengthFitApplied = false;

  while (shouldRepairLength(finalText, input.lens) && lengthRepairResponses.length < maxLengthRepairAttempts()) {
    const repairPrompt = composerLengthRepairPrompt(
      input.draft.plan,
      sceneCards,
      sourceSummary,
      input.lens,
      finalText,
    );
    const repairResponse = await requestPlainText(config, repairPrompt);
    finalPrompt = repairPrompt;
    lengthRepairResponses.push(repairResponse);
    finalText = normalizeFinalChapterText(chooseLengthCandidate(finalText, repairResponse.value, input.lens), input.lens);
    finalResponse = finalText === repairResponse.value ? repairResponse : response;
  }

  if (shouldRepairLength(finalText, input.lens)) {
    const fittedText = hardFitOverlongChapter(finalText, input.lens);
    if (lengthDistance(fittedText, input.lens) <= lengthDistance(finalText, input.lens)) {
      hardLengthFitApplied = fittedText !== finalText;
      finalText = normalizeFinalChapterText(fittedText, input.lens);
    }
  }

  const rawOutput =
    lengthRepairResponses.length > 0 || hardLengthFitApplied
      ? [
          response.raw,
          ...lengthRepairResponses.flatMap((repairResponse, index) => [
            `--- length repair ${index + 1} ---`,
            repairResponse.raw,
          ]),
          ...(hardLengthFitApplied ? ["--- local length fit ---", finalText] : []),
        ].join("\n")
      : finalResponse.raw;
  const runRecord = makeRunRecord(
    "composer",
    finalPrompt.promptVersion,
    config.model,
    summarizeMessages([
      { role: "system", content: finalPrompt.systemPrompt },
      { role: "user", content: finalPrompt.userPrompt },
    ]),
    rawOutput,
    lengthRepairResponses.length > 0 || hardLengthFitApplied
      ? `已通过 DeepSeek 装配完整章节，并校准长度为 ${finalText.trim().length} 字`
      : "已通过 DeepSeek 装配完整章节",
    finalResponse,
  );

  return {
    ...input.draft,
    chapterText: finalText,
    sceneDrafts: buildComposerDraft(sceneCards, finalText, runRecord),
    runRecords: [...input.draft.runRecords, runRecord],
  };
}

export async function critiqueChapterWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    chapterText: string;
    sceneCards: SceneCard[];
    sceneDrafts: SceneDraft[];
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<{
  review: ReviewReport;
  runRecord: WritingRunRecord;
}> {
  const config = resolveDeepSeekConfig(options);
  const sourcePack = buildNarrativeSourcePack({
    line: input.line,
    lens: input.lens,
  });
  const baseReview = reviewChapterDraft(
    {
      plan: {
        chapterTitle: input.lens.chapterGoal ?? "章节正文",
        chapterGoal: input.lens.chapterGoal ?? "章节正文",
        stageRange: [...input.lens.stageRange],
        mainConflict: sourcePack.hardFacts[0] ?? sourcePack.worldPressureSummary,
        secondaryConflict: sourcePack.hardFacts[1] ?? sourcePack.relationshipSummaries[0] ?? "副冲突待展开",
        closingHook: "下一章压力继续抬升。",
        sceneOrder: input.sceneCards.map((scene) => scene.id),
        summary: "DeepSeek review baseline",
      },
      sceneDrafts: input.sceneDrafts,
      chapterText: input.chapterText,
      review: {
        passed: true,
        issues: [],
        warnings: [],
        styleNotes: [],
        factCoverage: 1,
        suggestedRewrites: [],
      },
      runRecords: input.sceneDrafts.map((scene) => scene.runRecord),
    },
    sourcePack,
    input.lens,
  );

  const sourceSummary = buildSourceSummary(input.line, input.lens, "review", input.memoryPack);
  const prompt = reviewerPrompt(input.chapterText, input.sceneCards, sourceSummary);
  const response = await requestStructuredTool<Record<string, unknown>>(config, {
    ...prompt,
    tool: reviewerTool(),
  });
  const aiReview = normalizeReview(response.value, baseReview);
  const hardGuardIssues = baseReview.issues.filter(isHardBoundaryIssue);
  const softGuardWarnings = baseReview.issues.filter((issue) => !isHardBoundaryIssue(issue));
  const review: ReviewReport = {
    passed: aiReview.passed && hardGuardIssues.length === 0,
    issues: unique([...hardGuardIssues, ...aiReview.issues]),
    warnings: unique([...baseReview.warnings, ...softGuardWarnings, ...aiReview.warnings]),
    styleNotes: unique([...baseReview.styleNotes, ...aiReview.styleNotes]),
    factCoverage: aiReview.factCoverage,
    suggestedRewrites: unique([...baseReview.suggestedRewrites, ...aiReview.suggestedRewrites]),
  };

  return {
    review,
    runRecord: makeRunRecord(
      "reviewer",
      prompt.promptVersion,
      config.model,
      summarizeMessages([
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ]),
      response.raw,
      review.passed ? "DeepSeek 复核通过" : "DeepSeek 复核未通过",
      response,
    ),
  };
}

export async function rewriteSceneWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    draft: ChapterDraft;
    sceneId: string;
    instructions: string[];
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<SceneRewriteResult> {
  const config = resolveDeepSeekConfig(options);
  const sourceSummary = buildSourceSummary(input.line, input.lens, "rewrite", input.memoryPack);
  const prompt = rewritePrompt(input.draft, input.sceneId, input.instructions, sourceSummary);
  const response = await requestPlainText(config, prompt);
  return {
    text: response.value,
    runRecord: makeRunRecord(
      "composer",
      prompt.promptVersion,
      config.model,
      summarizeMessages([
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt },
      ]),
      response.raw,
      "已通过 DeepSeek 重写指定场景",
      response,
    ),
  };
}

export async function draftNarrativeWithDeepSeek(
  input: {
    line: TimelineLine;
    lens: NarrativeLens;
    memoryPack?: NarrativeMemoryPack;
  },
  options: DeepSeekProviderOptions = {},
): Promise<NarrativeDraft> {
  const sourcePack = buildNarrativeSourcePack(input);
  const planned = await planChapterWithDeepSeek(input, options);

  const expanded = await expandScenesWithDeepSeek(
    {
      ...input,
      plan: planned.plan,
    },
    options,
  );

  const synthesized = await synthesizeChapterWithDeepSeek(
    {
      ...input,
      plan: planned.plan,
      sceneCards: expanded.sceneCards,
    },
    options,
  );

  const reviewed = await critiqueChapterWithDeepSeek(
    {
      ...input,
      chapterText: synthesized.chapterText,
      sceneCards: expanded.sceneCards,
      sceneDrafts: synthesized.sceneDrafts,
    },
    options,
  );

  return {
    plan: planned.plan,
    sceneDrafts: synthesized.sceneDrafts,
    chapterText: synthesized.chapterText,
    review: reviewed.review,
    runRecords: [planned.runRecord, expanded.runRecord, synthesized.runRecord, reviewed.runRecord],
    focusCharacterIds: [...input.lens.focusCharacterIds],
    selectedEventIds: sourcePack.selectedEventIds,
    sceneIds: expanded.sceneCards.map((scene) => scene.id),
    planSummary: `主冲突：${planned.plan.mainConflict} / 副冲突：${planned.plan.secondaryConflict} / 结尾钩子：${planned.plan.closingHook}`,
    sceneSummaries: expanded.sceneCards.map((scene) => `${scene.sceneGoal}·${scene.location}：${scene.conflict}`),
    sourcePack,
    text: synthesized.chapterText,
  };
}

class DeepSeekUnconfiguredWritingProvider implements WritingModelProvider {
  readonly name = "deepseek-unconfigured-provider";
  readonly modelName = DEFAULT_MODEL;

  private fail(): never {
    throw new Error("DeepSeek provider is not configured. Set DEEPSEEK_API_KEY or save Studio AI settings.");
  }

  async planChapter(): Promise<ChapterPlan> {
    this.fail();
  }

  async expandScenes(): Promise<SceneCard[]> {
    this.fail();
  }

  async synthesizeProse(): Promise<ChapterDraft> {
    this.fail();
  }

  async critiqueChapter(): Promise<ReviewReport> {
    this.fail();
  }
}

export class DeepSeekWritingProvider implements WritingModelProvider {
  readonly name = "deepseek-writing-provider";
  readonly modelName: string;

  constructor(private readonly options: DeepSeekProviderOptions = {}) {
    this.modelName = options.model ?? resolveStoredSettings()?.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  }

  async planChapter(context: WritingProviderContext): Promise<ChapterPlan> {
    return (
      await planChapterWithDeepSeek(
        { line: context.line, lens: context.lens, memoryPack: context.memoryPack },
        this.options,
      )
    ).plan;
  }

  async expandScenes(context: WritingProviderContext, plan: ChapterPlan): Promise<SceneCard[]> {
    return (
      await expandScenesWithDeepSeek(
        { line: context.line, lens: context.lens, plan, memoryPack: context.memoryPack },
        this.options,
      )
    ).sceneCards;
  }

  async synthesizeProse(
    context: WritingProviderContext,
    plan: ChapterPlan,
    sceneCards: SceneCard[],
  ): Promise<ChapterDraft> {
    const synthesized = await synthesizeChapterWithDeepSeek(
      {
        line: context.line,
        lens: context.lens,
        plan,
        sceneCards,
        memoryPack: context.memoryPack,
      },
      this.options,
    );
    return {
      plan,
      sceneDrafts: synthesized.sceneDrafts,
      chapterText: synthesized.chapterText,
      review: {
        passed: true,
        issues: [],
        warnings: [],
        styleNotes: [],
        factCoverage: 1,
        suggestedRewrites: [],
      },
      runRecords: [synthesized.runRecord],
    };
  }

  async critiqueChapter(context: WritingProviderContext, draft: ChapterDraft): Promise<ReviewReport> {
    return (
      await critiqueChapterWithDeepSeek(
        {
          line: context.line,
          lens: context.lens,
          chapterText: draft.chapterText,
          sceneCards: draft.sceneDrafts.map((scene, index) => ({
            id: scene.sceneId,
            order: index + 1,
            location: scene.title.split("·").at(-1) ?? "局中",
            time: "局中时刻",
            participants: context.lens.focusCharacterIds,
            sceneGoal: scene.title.split("·")[0] ?? "推进场景",
            conflict: scene.summary,
            hardFacts: context.sourcePack.hardFacts,
            softExpansionBudget: context.sourcePack.softExpansionBudget,
            transitionIn: "承接上场",
            transitionOut: "压向下场",
            focusCue: "全知旁观",
          })),
          sceneDrafts: draft.sceneDrafts,
          memoryPack: context.memoryPack,
        },
        this.options,
      )
    ).review;
  }

  async assembleChapter(context: WritingProviderContext, draft: ChapterDraft): Promise<ChapterDraft> {
    return assembleChapterWithDeepSeek(
      {
        line: context.line,
        lens: context.lens,
        draft,
        memoryPack: context.memoryPack,
      },
      this.options,
    );
  }

  async rewriteSegment(
    context: WritingProviderContext,
    draft: ChapterDraft,
    sceneId: string,
    instructions: string[],
  ): Promise<ChapterDraft> {
    const rewritten = await rewriteSceneWithDeepSeek(
      {
        line: context.line,
        lens: context.lens,
        draft,
        sceneId,
        instructions,
        memoryPack: context.memoryPack,
      },
      this.options,
    );
    const sceneDrafts = draft.sceneDrafts.map((scene) =>
      scene.sceneId === sceneId ? { ...scene, text: rewritten.text, runRecord: rewritten.runRecord } : scene,
    );
    return {
      ...draft,
      sceneDrafts,
      chapterText: sceneDrafts.map((scene) => scene.text).join("\n\n"),
      runRecords: [...draft.runRecords, rewritten.runRecord],
    };
  }
}

export class DeepSeekSimulationProvider implements SimulationModelProvider {
  readonly name = "deepseek-simulation-provider";
  readonly modelName: string;

  constructor(private readonly options: DeepSeekProviderOptions = {}) {
    this.modelName = options.model ?? resolveStoredSettings()?.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  }

  async simulateStage(context: SimulationProviderContext) {
    return simulateStageWithDeepSeek(context, this.options);
  }
}

export function createDefaultWritingProvider(options: { deepseek?: DeepSeekProviderOptions } = {}): WritingModelProvider {
  if (isDeepSeekConfigured(options.deepseek)) {
    return new DeepSeekWritingProvider(options.deepseek);
  }
  return new DeepSeekUnconfiguredWritingProvider();
}

export function createDefaultSimulationProvider(
  options: { deepseek?: DeepSeekProviderOptions } = {},
): SimulationModelProvider {
  if (isDeepSeekConfigured(options.deepseek)) {
    return new DeepSeekSimulationProvider(options.deepseek);
  }
  return {
    name: "deepseek-unconfigured-provider",
    modelName: DEFAULT_MODEL,
    async simulateStage(): Promise<never> {
      throw new Error("DeepSeek provider is not configured. Set DEEPSEEK_API_KEY or save Studio AI settings.");
    },
  };
}
