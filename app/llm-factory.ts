// app/llm-factory.ts — LLM 装配(composition root)。
// 优先级: 网页设置(.novel-output/llm-config.json) > 环境变量 > mock。
// 网页 /api/settings 写这个文件; longrun 每章按指纹热切换; 引擎(core/)不碰这些机器细节。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MockLLM, HermesLLM, DeepSeekLLM, FallbackLLM, type LLMProvider, type HermesOpts } from "../core/services/llm";

const here = dirname(fileURLToPath(import.meta.url));
export const LLM_CONFIG_PATH = join(here, "..", ".novel-output", "llm-config.json");

export interface LLMConfig {
  provider: "deepseek" | "hermes" | "mock";
  deepseekKey?: string;
  deepseekBaseUrl?: string;
  model?: string;
}

export function readLLMConfig(): LLMConfig {
  if (existsSync(LLM_CONFIG_PATH)) {
    try {
      return JSON.parse(readFileSync(LLM_CONFIG_PATH, "utf8")) as LLMConfig;
    } catch {
      /* 损坏则回落环境变量 */
    }
  }
  const env = process.env["NOVEL_LIVE_LLM"];
  if (process.env["DEEPSEEK_API_KEY"]) {
    return {
      provider: "deepseek",
      deepseekKey: process.env["DEEPSEEK_API_KEY"],
      deepseekBaseUrl: process.env["DEEPSEEK_BASE_URL"],
      model: process.env["DEEPSEEK_MODEL"],
    };
  }
  return { provider: env === "hermes" ? "hermes" : env === "deepseek" ? "deepseek" : "mock" };
}

export function writeLLMConfig(cfg: LLMConfig): void {
  mkdirSync(dirname(LLM_CONFIG_PATH), { recursive: true });
  writeFileSync(LLM_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
}

export function readHermesOpts(model?: string): HermesOpts | null {
  const key = process.env["HERMES_SSH_KEY"];
  const host = process.env["HERMES_HOST"];
  if (!key || !host) return null;
  return {
    key,
    host,
    user: process.env["HERMES_USER"] ?? "ubuntu",
    model: model ?? process.env["HERMES_MODEL"] ?? "deepseek-v4-pro",
    bin: process.env["HERMES_BIN"],
  };
}

export function makeLLM(cfg: LLMConfig = readLLMConfig()): LLMProvider {
  if (cfg.provider === "deepseek" && cfg.deepseekKey) {
    return new FallbackLLM(new DeepSeekLLM({ key: cfg.deepseekKey, model: cfg.model ?? "deepseek-chat", baseUrl: cfg.deepseekBaseUrl }), new MockLLM());
  }
  if (cfg.provider === "hermes") {
    const opts = readHermesOpts(cfg.model);
    if (opts) return new FallbackLLM(new HermesLLM(opts), new MockLLM());
  }
  return new MockLLM();
}

// 网页只读状态(永不回传 key 明文, 只报是否已设)
export function llmStatus(cfg: LLMConfig = readLLMConfig()): { provider: string; model: string; hasKey: boolean } {
  const model = cfg.model ?? (cfg.provider === "hermes" ? "deepseek-v4-pro" : cfg.provider === "deepseek" ? "deepseek-chat" : "—");
  return { provider: cfg.provider, model, hasKey: !!cfg.deepseekKey };
}

// 配置指纹: 变了则 longrun 热切换 provider(避免每章重读全文件做对象比较)
export function configSignature(cfg: LLMConfig = readLLMConfig()): string {
  return `${cfg.provider}|${cfg.model ?? ""}|${(cfg.deepseekKey ?? "").length}`;
}
