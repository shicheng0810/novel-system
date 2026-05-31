// core/runtime/scheduler.ts — M1: 有限循环跑 n tick(异步, 因 tick 内含 LLM 调用)
// generation 由 step 内部推进; 单线程顺序天然无并发双 step(常驻 daemon 化是 M1+)。
import type { DB } from "../services/db";
import type { ContentPack } from "../domain/pack";
import type { LLMProvider } from "../services/llm";
import { step, type StepResult } from "./world-actor";

export async function runTicks(db: DB, worldId: string, pack: ContentPack, llm: LLMProvider, n: number): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (let i = 0; i < n; i++) {
    results.push(await step(db, worldId, pack, llm));
  }
  return results;
}
