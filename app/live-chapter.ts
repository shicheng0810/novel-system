// app/live-chapter.ts — M6 证明: 用 live LLM 跑几 tick 攒素材 → compose 一整章正文。
// 完整一部小说 = 让 daemon 这样长跑(几十章); 此处证明端到端 live 出真章。
import { openDb } from "../core/services/db";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import { composeChapter } from "../core/actors/compose-actor";
import xianxiaBaziPack from "../packs/xianxia-bazi/index";
import { makeLLM } from "./llm-factory";

async function main(): Promise<void> {
  const llm = makeLLM();
  const db = openDb(":memory:");
  const worldId = "live";
  const ts = Date.now();
  store.saveSnapshot(db, worldId, xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "live-chapter", config: {} }), 0, ts);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, ts);

  console.log(`攒素材: ${llm.id} 跑 4 tick(角色心象)...`);
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) await step(db, worldId, xianxiaBaziPack, llm);
  const material = store.readRecentReflections(db, worldId, 8);
  console.log(`心象素材(${Date.now() - t0}ms):`);
  for (const m of material) console.log("  · " + m);

  const snap = store.loadSnapshot(db, worldId);
  if (!snap) throw new Error("no snapshot");
  console.log(`\n生成章节(${llm.id}, blueprint + 正文)...`);
  const t1 = Date.now();
  const ch = await composeChapter(snap.snapshot, material, xianxiaBaziPack, llm, snap.snapshot.tick);
  console.log(`\n──────── 真实章节 (${Date.now() - t1}ms) ────────`);
  console.log(`《${ch.goal}》\n`);
  console.log(ch.text);
  console.log(`────────────────────────────────────`);
}

main().catch((e: unknown) => {
  console.error("失败(fallback 已兜底):", String(e).slice(0, 300));
  process.exit(0);
});
