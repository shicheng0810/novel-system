// 冒烟: 同一引擎(core/ runtime)跑"现代都市"包, 验证 §2.7 引擎↔包分离(换包=换 genre)。
import { openDb } from "../core/services/db";
import { MockLLM } from "../core/services/llm";
import * as store from "../core/services/store";
import { runTicks } from "../core/runtime/scheduler";
import pack, { natalLabel, goalLabel, describeMind, plateLabel } from "../packs/modern-city/index";

const db = openDb(":memory:");
const wid = "modern";
store.saveSnapshot(db, wid, pack.seedWorld({ worldId: wid, packId: pack.id, seed: "modern-A", config: {} }), 0, 1);
store.setSchedulerState(db, wid, { gen: 0, nextTick: 0, status: "running" }, 1);
for (let i = 0; i < 4; i++) store.enqueueInput(db, `sp-${i}`, wid, "spawn-character", { character: pack.spawnCharacter!("现代", i) }, 1);
for (let t = 0; t < 60; t++) {
  if (t % 25 === 24) {
    const sp = store.loadSnapshot(db, wid);
    const pend = sp && Array.isArray(sp.snapshot.props["pendingDecisions"]) ? (sp.snapshot.props["pendingDecisions"] as Array<{ decisionId: string; valence?: number }>) : [];
    for (const p of pend) store.enqueueInput(db, `auto-${p.decisionId}`, wid, "author-verdict", { decisionId: p.decisionId, verdict: (p.valence ?? 0) < -0.2 ? "reject" : "accept" }, 1);
  }
  await runTicks(db, wid, pack, new MockLLM(), 1);
}
const snap = store.loadSnapshot(db, wid)!.snapshot;

console.log("═══ 同一引擎(core/)跑【现代都市】包 ═══");
console.log("四主角(星座→命格→志):");
for (const c of Object.values(snap.characters).filter((c) => c.id.startsWith("c"))) console.log(`  ${c.name}: ${natalLabel(c)} | ${goalLabel(c)} @${snap.locations[c.locationId || ""]?.name}`);
let bonds = 0;
for (const c of Object.values(snap.characters)) for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number" && v !== 0) bonds++;
const evs = store.readEvents(db, wid);
const cnt = (k: string) => evs.filter((e) => e.kind === k).length;
console.log("\n涌现统计: 自发关系", bonds, "| 登场", cnt("CharacterEntered"), "| 大事", cnt("StoryEventTriggered"), "| 落定", cnt("StageCommitted"), "| 上位", cnt("ProgressionAdvanced"));
console.log("大事样本:", evs.filter((e) => e.kind === "StoryEventTriggered").map((e) => e.summary?.slice(0, 40)).slice(0, 2));
console.log("当前星象:", plateLabel(snap.tick ?? 0));
console.log("一句心声:", describeMind(Object.values(snap.characters)[0]!, snap));
console.log("\n→ 引擎一行未改, 仅换内容包, 现代世界照常涌现。");
