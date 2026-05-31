// app/live-smoke.ts — 实测 live LLM 生成一条角色心象。
// 默认走 mock；设置 NOVEL_LIVE_LLM=deepseek 或 hermes 后走真实 provider，失败 fallback。
import { makeLLM } from "./llm-factory";

async function main(): Promise<void> {
  const llm = makeLLM();
  const prompt = `你是修仙世界的角色「苏雪」(境界:练气, 心境张力:0.30)。第3回合，用不超过20字写出此刻心境与下一步意图，只回一句，文风古雅。`;
  console.log(`调用 live LLM (${llm.id}) ...`);
  const t0 = Date.now();
  const out = await llm.complete(prompt);
  console.log(`(${Date.now() - t0}ms) 苏雪·真LLM心象: ${out}`);
}

main().catch((e: unknown) => {
  console.error("live LLM 调用失败:", String(e).slice(0, 240));
  process.exit(0);
});
