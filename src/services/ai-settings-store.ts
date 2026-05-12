// Layer 2 · AiSettingsStore.
// CRUD for the single-row ai_settings table. Holds the DeepSeek profile +
// embedding profile that the server boots from. Replaces the v2
// studio-config.json file. Reads also fall back to environment variables
// (DEEPSEEK_API_KEY etc.) so first-run users don't need to write SQLite by
// hand.

import type { Db } from "../data/db";
import {
  DEFAULT_DEEPSEEK_PROFILE,
  type DeepSeekProfile,
} from "./llm/deepseek";

export type AiSettings = DeepSeekProfile & {
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
  embeddingModel?: string;
  embeddingDim?: number;
};

type Row = {
  api_key: string | null;
  base_url: string | null;
  model: string | null;
  timeout_ms: number | null;
  thinking_mode: string | null;
  reasoning_effort: string | null;
  context_window_tokens: number | null;
  max_output_tokens: number | null;
  embedding_api_key: string | null;
  embedding_base_url: string | null;
  embedding_model: string | null;
  embedding_dim: number | null;
};

const SELECT = `
  SELECT api_key, base_url, model, timeout_ms, thinking_mode, reasoning_effort,
         context_window_tokens, max_output_tokens,
         embedding_api_key, embedding_base_url, embedding_model, embedding_dim
  FROM ai_settings WHERE id = 1
`;

const UPSERT = `
  INSERT INTO ai_settings (
    id, api_key, base_url, model, timeout_ms, thinking_mode, reasoning_effort,
    context_window_tokens, max_output_tokens,
    embedding_api_key, embedding_base_url, embedding_model, embedding_dim,
    updated_at
  ) VALUES (
    1, @apiKey, @baseUrl, @model, @timeoutMs, @thinkingMode, @reasoningEffort,
    @contextWindowTokens, @maxOutputTokens,
    @embeddingApiKey, @embeddingBaseUrl, @embeddingModel, @embeddingDim,
    @updatedAt
  )
  ON CONFLICT(id) DO UPDATE SET
    api_key               = excluded.api_key,
    base_url              = excluded.base_url,
    model                 = excluded.model,
    timeout_ms            = excluded.timeout_ms,
    thinking_mode         = excluded.thinking_mode,
    reasoning_effort      = excluded.reasoning_effort,
    context_window_tokens = excluded.context_window_tokens,
    max_output_tokens     = excluded.max_output_tokens,
    embedding_api_key     = excluded.embedding_api_key,
    embedding_base_url    = excluded.embedding_base_url,
    embedding_model       = excluded.embedding_model,
    embedding_dim         = excluded.embedding_dim,
    updated_at            = excluded.updated_at
`;

export class AiSettingsStore {
  private readonly selectStmt: ReturnType<Db["prepare"]>;
  private readonly upsertStmt: ReturnType<Db["prepare"]>;

  constructor(private readonly db: Db) {
    this.selectStmt = db.prepare(SELECT);
    this.upsertStmt = db.prepare(UPSERT);
  }

  /**
   * Load saved settings. Returns null only when no row has ever been written
   * AND no env-var fallback is available. Otherwise returns a fully-populated
   * AiSettings (DB row overlays defaults, env-var apiKey fills if DB is
   * blank).
   */
  load(): AiSettings | null {
    const row = this.selectStmt.get([]) as Row | undefined;
    const merged = rowToSettings(row);
    if (!merged.apiKey && !envFallback("DEEPSEEK_API_KEY")) {
      return null;
    }
    if (!merged.apiKey) {
      merged.apiKey = envFallback("DEEPSEEK_API_KEY") ?? "";
      merged.baseUrl = envFallback("DEEPSEEK_BASE_URL") ?? merged.baseUrl;
      merged.model = envFallback("DEEPSEEK_MODEL") ?? merged.model;
    }
    return merged;
  }

  /**
   * Save partial settings. Unspecified fields fall back to defaults; the
   * existing row is used as the base if present.
   */
  save(input: Partial<AiSettings>): AiSettings {
    const current = (this.selectStmt.get([]) as Row | undefined) ?? null;
    const merged: AiSettings = {
      ...DEFAULT_DEEPSEEK_PROFILE,
      ...(current ? rowToSettings(current) : {}),
      ...input,
    };
    this.upsertStmt.run({
      apiKey: merged.apiKey || null,
      baseUrl: merged.baseUrl || null,
      model: merged.model || null,
      timeoutMs: merged.timeoutMs ?? null,
      thinkingMode: merged.thinkingMode || null,
      reasoningEffort: merged.reasoningEffort || null,
      contextWindowTokens: merged.contextWindowTokens ?? null,
      maxOutputTokens: merged.maxOutputTokens ?? null,
      embeddingApiKey: merged.embeddingApiKey || null,
      embeddingBaseUrl: merged.embeddingBaseUrl || null,
      embeddingModel: merged.embeddingModel || null,
      embeddingDim: merged.embeddingDim ?? null,
      updatedAt: Date.now(),
    });
    return merged;
  }
}

/**
 * Mask an api key for safe display. Returns "" if blank; otherwise keeps the
 * last 4 chars and prefixes "…".
 */
export function maskApiKey(key: string | undefined | null): string {
  if (!key) return "";
  if (key.length <= 4) return "…";
  return `…${key.slice(-4)}`;
}

function rowToSettings(row: Row | undefined): AiSettings {
  return {
    apiKey: row?.api_key ?? "",
    baseUrl: row?.base_url ?? DEFAULT_DEEPSEEK_PROFILE.baseUrl,
    model: row?.model ?? DEFAULT_DEEPSEEK_PROFILE.model,
    timeoutMs: row?.timeout_ms ?? DEFAULT_DEEPSEEK_PROFILE.timeoutMs,
    thinkingMode:
      (row?.thinking_mode as DeepSeekProfile["thinkingMode"]) ?? DEFAULT_DEEPSEEK_PROFILE.thinkingMode,
    reasoningEffort:
      (row?.reasoning_effort as DeepSeekProfile["reasoningEffort"]) ?? DEFAULT_DEEPSEEK_PROFILE.reasoningEffort,
    contextWindowTokens: row?.context_window_tokens ?? DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens,
    maxOutputTokens: row?.max_output_tokens ?? DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens,
    embeddingApiKey: row?.embedding_api_key ?? undefined,
    embeddingBaseUrl: row?.embedding_base_url ?? undefined,
    embeddingModel: row?.embedding_model ?? undefined,
    embeddingDim: row?.embedding_dim ?? undefined,
  };
}

function envFallback(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}
