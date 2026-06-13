// app/llm-factory.ts — LLM 装配(composition root)。
// 优先级: 网页设置(.novel-output/llm-config.json) > 环境变量 > mock。
// 网页 /api/settings 写这个文件; longrun 每章按指纹热切换; 引擎(core/)不碰这些机器细节。
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { MockLLM, HermesLLM, DeepSeekLLM, FallbackLLM, type LLMProvider, type HermesOpts } from "../core/services/llm";
import { hashStr } from "../core/util/rng";

const here = dirname(fileURLToPath(import.meta.url));
export const LLM_CONFIG_PATH = join(here, "..", ".novel-output", "llm-config.json");

export interface LLMConfig {
  provider: "deepseek" | "hermes" | "mock";
  deepseekKey?: string;
  deepseekBaseUrl?: string;
  model?: string;
  temperature?: number; // 创作温度(网页可调; 缺省 1.5)
  thinking?: boolean; // v4 深度思考 reasoning_effort=high(缺省开)
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
  const tmp = LLM_CONFIG_PATH + ".tmp." + process.pid; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→readLLMConfig 静默回落(蓝图 .audit/20260610-evolution-overhaul §3.2)
  writeFileSync(tmp, JSON.stringify(cfg, null, 2), "utf8");
  renameSync(tmp, LLM_CONFIG_PATH);
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
    return new FallbackLLM(new DeepSeekLLM({ key: cfg.deepseekKey, model: cfg.model ?? "deepseek-chat", baseUrl: cfg.deepseekBaseUrl, temperature: cfg.temperature ?? 1.5, thinking: cfg.thinking ?? true, reasoningEffort: "high" }), new MockLLM());
  }
  if (cfg.provider === "hermes") {
    const opts = readHermesOpts(cfg.model);
    if (opts) return new FallbackLLM(new HermesLLM(opts), new MockLLM());
  }
  return new MockLLM();
}

// 网页只读状态(永不回传 key 明文, 只报是否已设)
export function llmStatus(cfg: LLMConfig = readLLMConfig()): { provider: string; model: string; hasKey: boolean; temperature: number; thinking: boolean } {
  const model = cfg.model ?? (cfg.provider === "hermes" ? "deepseek-v4-pro" : cfg.provider === "deepseek" ? "deepseek-chat" : "—");
  return { provider: cfg.provider, model, hasKey: !!cfg.deepseekKey, temperature: cfg.temperature ?? 1.5, thinking: cfg.thinking ?? true };
}

// 配置指纹: 变了则 longrun 热切换 provider(温度/thinking 变也要热切换 → 纳入指纹)
export function configSignature(cfg: LLMConfig = readLLMConfig()): string {
  // 取 key+baseUrl 的内容哈希(而非仅长度): 换等长 key / 换端点都能正确触发 longrun 热切换
  return `${cfg.provider}|${cfg.model ?? ""}|${(hashStr((cfg.deepseekKey ?? "") + "|" + (cfg.deepseekBaseUrl ?? "")) >>> 0).toString(16)}|${cfg.temperature ?? ""}|${cfg.thinking ?? ""}`;
}
