import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";

import {
  DEFAULT_DEEPSEEK_PROFILE,
  DeepSeekReasoningEffort,
  DeepSeekThinkingMode,
  normalizePositiveInteger,
  normalizeReasoningEffort,
  normalizeThinkingMode,
} from "./deepseek-profile";

export type AiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  thinkingMode?: DeepSeekThinkingMode;
  reasoningEffort?: DeepSeekReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  updatedAt: string;
};

export type AiSettingsInput = Omit<AiSettings, "updatedAt">;

function settingsRoot(): string {
  return process.env.LOCALAPPDATA || join(homedir(), ".config");
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "****";
  }
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

export class AiSettingsStore {
  readonly filePath: string;

  constructor(rootDir = settingsRoot()) {
    this.filePath = join(rootDir, "WorldHistoryEngine", "studio-config.json");
  }

  readSync(): AiSettings | undefined {
    if (!existsSync(this.filePath)) {
      return undefined;
    }
    try {
      return JSON.parse(readFileSync(this.filePath, "utf8")) as AiSettings;
    } catch (err) {
      // Per review · L: don't silently swallow — the user sees a "key not set"
      // error downstream when the actual cause is a corrupt config file.
      // eslint-disable-next-line no-console
      console.warn(
        `[ai-settings] failed to parse ${this.filePath}:`,
        err instanceof Error ? err.message : err,
      );
      return undefined;
    }
  }

  async save(input: AiSettingsInput): Promise<AiSettings> {
    const settings: AiSettings = {
      ...input,
      apiKey: input.apiKey.trim(),
      baseUrl: input.baseUrl.trim(),
      model: input.model.trim(),
      timeoutMs: normalizePositiveInteger(input.timeoutMs, DEFAULT_DEEPSEEK_PROFILE.timeoutMs),
      thinkingMode: normalizeThinkingMode(input.thinkingMode),
      reasoningEffort: normalizeReasoningEffort(input.reasoningEffort),
      contextWindowTokens: normalizePositiveInteger(
        input.contextWindowTokens,
        DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens,
      ),
      maxOutputTokens: normalizePositiveInteger(input.maxOutputTokens, DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens),
      updatedAt: new Date().toISOString(),
    };
    await mkdir(join(this.filePath, ".."), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(settings, null, 2), "utf8");
    // Per review · L1: apiKey + secrets must not be world-readable. chmod 0o600.
    // Windows: chmod is a no-op (NTFS ACL semantics differ); we accept the
    // limitation and surface it in a console warning.
    if (platform() !== "win32") {
      try {
        await chmod(this.filePath, 0o600);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[ai-settings] chmod 0o600 failed (config file may be world-readable):",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return settings;
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }
}
