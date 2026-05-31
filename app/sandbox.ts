// app/sandbox.ts — composition root(允许 import 具体包/provider; core/ 引擎不允许)
// M1 端到端冒烟: seed 世界 → 跑 30 tick(MockLLM 确定性)→ 打印事件/快照/角色心象 → 断言无半提交。
import { openDb } from "../core/services/db";
import { PackRegistry } from "../core/services/pack-registry";
import { MockLLM } from "../core/services/llm";
import * as store from "../core/services/store";
import { runTicks } from "../core/runtime/scheduler";
import xianxiaBaziPack from "../packs/xianxia-bazi/index";

function actCount(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

async function main(): Promise<void> {
  const db = openDb(":memory:");
  const registry = new PackRegistry();
  registry.register(xianxiaBaziPack);
  const pack = registry.get("xianxia-bazi");
  const llm = new MockLLM();

  const worldId = "demo";
  const ts = Date.now();
  const snap = pack.seedWorld({ worldId, packId: pack.id, seed: "sandbox-seed", config: {} });
  store.saveSnapshot(db, worldId, snap, 0, ts);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, ts);

  const N = 30;
  const results = await runTicks(db, worldId, pack, llm, N);

  const events = store.readEvents(db, worldId);
  const bySub = new Map<string, number>();
  for (const e of events) bySub.set(e.subsystem, (bySub.get(e.subsystem) ?? 0) + 1);

  console.log(`\n=== 跑了 ${results.length} tick, 共 ${events.length} 事件 (LLM=${llm.id}) ===`);
  console.log("事件按 subsystem:");
  for (const [sub, n] of [...bySub.entries()].sort()) console.log(`  ${sub.padEnd(10)} ${n}`);
  const decisions = events.filter((e) => e.kind === "DecisionRequired").length;
  const ruled = events.filter((e) => e.kind === "AuthorRuled").length;
  console.log(`议事(DecisionRequired): ${decisions}  已裁决(AuthorRuled): ${ruled}`);

  // 抽样几条角色心象(reflection)
  const reflections = events.filter((e) => e.kind === "MemoryRecorded").slice(-4);
  console.log("\n最近几条心象(MemoryRecorded):");
  for (const e of reflections) {
    const p = e.payload as { body?: string; characterId?: string };
    console.log(`  [t${e.tick}] ${p.characterId ?? "?"}: ${p.body ?? ""}`);
  }

  const chapters = store.readChapters(db, worldId);
  console.log(`\n生成章节 ${chapters.length} 章:`);
  for (const ch of chapters) console.log(`  《${ch.goal}》\n    ${ch.text.slice(0, 80).replace(/\n/g, " ")}…`);

  const after = store.loadSnapshot(db, worldId);
  if (!after) throw new Error("snapshot missing after run");
  console.log(`\n世界推进到 tick=${after.snapshot.tick}; 角色 acts / 张力:`);
  for (const c of Object.values(after.snapshot.characters)) {
    console.log(`  ${c.name.padEnd(4)} tier=${c.progressionTier} acts=${actCount(c.props["actCount"])} stress=${c.narrativeStress.toFixed(2)}`);
  }

  const ms = store.maxSeq(db, worldId);
  const ok = after.lastSeq === ms && events.length > 0;
  console.log(`\n无半提交检查: world_state.last_seq=${after.lastSeq} == max(events.seq)=${ms} → ${ok ? "✅ PASS" : "❌ FAIL"}`);
  db.close();
  if (!ok) process.exit(1);
  console.log("✅ M1 sandbox 跑通\n");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
