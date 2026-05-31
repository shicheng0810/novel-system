// core/services/llm.ts — LLM provider 抽象。引擎只认接口。
//   MockLLM   : 确定性(同 prompt→同输出)、零成本 → 测试/sandbox 保持可重放
//   HermesLLM : 走已修好的 hermes deepseek(SSH `hermes -z`)做 live 推理; 失败抛错由调用方 fallback
import { execFileSync } from "node:child_process";
import { hashStr } from "../util/rng";

export interface LLMProvider {
  readonly id: string;
  complete(prompt: string): Promise<string>;
}

export class MockLLM implements LLMProvider {
  readonly id = "mock";
  async complete(prompt: string): Promise<string> {
    const h = hashStr(prompt);
    const moods = ["沉吟", "决然", "迟疑", "振奋", "警觉", "默然"];
    const verbs = ["出手", "蓄势", "结盟", "试探", "退避", "潜修"];
    const mood = moods[h % moods.length];
    const verb = verbs[(h >>> 5) % verbs.length]; // 无符号位移, 防高位 hash 变负索引
    return `${mood}片刻，意欲${verb}。`;
  }
}

export interface HermesOpts {
  key: string;
  host: string;
  user: string;
  model?: string;
  bin?: string;
}

export class HermesLLM implements LLMProvider {
  readonly id = "hermes-deepseek";
  constructor(private opts: HermesOpts) {}
  async complete(prompt: string): Promise<string> {
    // prompt 含 CJK/括号/标点 → 经 ssh 传远端 shell 会被解析。base64 编码 + 远端 base64 -d 还原(base64 仅安全字符)。
    const b64 = Buffer.from(prompt, "utf8").toString("base64");
    const model = this.opts.model ?? "deepseek-v4-pro";
    const bin = this.opts.bin ?? '"$HOME/.local/bin/hermes"'; // 非登录 shell PATH 不含 ~/.local/bin
    const remote = `P=$(printf %s '${b64}' | base64 -d); ${bin} -z "$P" --provider deepseek -m ${model}`;
    const out = execFileSync(
      "ssh",
      [
        "-i", this.opts.key,
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=20",
        "-o", "BatchMode=yes",
        `${this.opts.user}@${this.opts.host}`,
        remote,
      ],
      { encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 }
    );
    return out.trim();
  }
}

export interface DeepSeekOpts {
  key: string;
  model?: string;
  baseUrl?: string;
}

// DeepSeek 官方 API 直连(无需 VPS/SSH; 用户在网页填 key 即用)。失败抛错由 FallbackLLM 兜底。
export class DeepSeekLLM implements LLMProvider {
  readonly id: string;
  constructor(private opts: DeepSeekOpts) {
    this.id = `deepseek:${opts.model ?? "deepseek-chat"}`;
  }
  async complete(prompt: string): Promise<string> {
    const base = this.opts.baseUrl ?? "https://api.deepseek.com";
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.opts.key}` },
      body: JSON.stringify({ model: this.opts.model ?? "deepseek-chat", messages: [{ role: "user", content: prompt }], stream: false }),
    });
    if (!res.ok) throw new Error(`deepseek ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (j.choices?.[0]?.message?.content ?? "").trim();
  }
}

// 带 fallback 的包装: 主 provider 失败 → 回退(用户指令: hermes 不应答就本地直接跑)
export class FallbackLLM implements LLMProvider {
  readonly id: string;
  constructor(private primary: LLMProvider, private fallback: LLMProvider) {
    this.id = `${primary.id}|fallback:${fallback.id}`;
  }
  async complete(prompt: string): Promise<string> {
    try {
      const out = await this.primary.complete(prompt);
      if (out && out.length > 0) return out;
      return await this.fallback.complete(prompt);
    } catch {
      return await this.fallback.complete(prompt);
    }
  }
}
