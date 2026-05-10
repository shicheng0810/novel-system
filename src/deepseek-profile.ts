export type DeepSeekThinkingMode = "enabled" | "disabled";
export type DeepSeekReasoningEffort = "high" | "max";
export type DeepSeekWorkload = "validation" | "structured" | "prose" | "rewrite" | "simulation";

export type DeepSeekModelProfile = {
  model: string;
  baseUrl: string;
  structuredBaseUrl: string;
  timeoutMs: number;
  thinkingMode: DeepSeekThinkingMode;
  reasoningEffort: DeepSeekReasoningEffort;
  contextWindowTokens: number;
  maxOutputTokens: number;
};

export const DEEPSEEK_V4_FLASH_PROFILE: DeepSeekModelProfile = {
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com",
  structuredBaseUrl: "https://api.deepseek.com/beta",
  timeoutMs: 600_000,
  thinkingMode: "enabled",
  reasoningEffort: "high",
  contextWindowTokens: 1_000_000,
  maxOutputTokens: 384_000,
};

export const DEEPSEEK_V4_PRO_PROFILE: DeepSeekModelProfile = {
  ...DEEPSEEK_V4_FLASH_PROFILE,
  model: "deepseek-v4-pro",
};

export const DEFAULT_DEEPSEEK_PROFILE = DEEPSEEK_V4_PRO_PROFILE;

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function normalizeThinkingMode(
  value: unknown,
  fallback = DEFAULT_DEEPSEEK_PROFILE.thinkingMode,
): DeepSeekThinkingMode {
  return value === "enabled" || value === "disabled" ? value : fallback;
}

export function normalizeReasoningEffort(
  value: unknown,
  fallback = DEFAULT_DEEPSEEK_PROFILE.reasoningEffort,
): DeepSeekReasoningEffort {
  return value === "high" || value === "max" ? value : fallback;
}

export function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function isDeepSeekV4Model(model: string): boolean {
  return model.trim().toLowerCase().startsWith("deepseek-v4-");
}

export function isLegacyReasonerModel(model: string): boolean {
  return model.trim().toLowerCase() === "deepseek-reasoner";
}

export function shouldSendThinkingControls(model: string): boolean {
  return isDeepSeekV4Model(model);
}

export function shouldOmitSamplingControls(model: string, thinkingMode: DeepSeekThinkingMode): boolean {
  return isLegacyReasonerModel(model) || (isDeepSeekV4Model(model) && thinkingMode === "enabled");
}

const WORKLOAD_OUTPUT_TARGETS: Record<DeepSeekWorkload, number> = {
  validation: 64,
  structured: 2_048,
  prose: 4_200,
  rewrite: 2_400,
  simulation: 64_000,
};

export function resolveWorkloadMaxTokens(input: {
  requestedMaxTokens: number;
  configuredMaxOutputTokens: number;
  contextWindowTokens: number;
  workload: DeepSeekWorkload;
}): number {
  const target =
    input.contextWindowTokens >= DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens
      ? Math.max(input.requestedMaxTokens, WORKLOAD_OUTPUT_TARGETS[input.workload])
      : input.requestedMaxTokens;
  return Math.min(target, input.configuredMaxOutputTokens);
}
