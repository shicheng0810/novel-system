// 冒烟: 证明 (e)复仇了断 + (f)派系复兴 真生效。MockLLM 内存快跑 250 tick。
import { openDb } from "../core/services/db";
import { MockLLM } from "../core/services/llm";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import pack from "../packs/xianxia-bazi/index";

const db = openDb(":memory:");
const wid = "ab";
store.saveSnapshot(db, wid, pack.seedWorld({ worldId: wid, packId: pack.id, seed: "ab-seed", config: {} }), 0, 1);
store.setSchedulerState(db, wid, { gen: 0, nextTick: 0, status: "running" }, 1);
const llm = new MockLLM();
for (let i = 0; i < 8; i++) {
  const c = pack.spawnCharacter!("test", i);
  if (i === 0) c.props["faction"] = "万剑门";
  if (i === 1 || i === 2) c.props["faction"] = "幽冥教";
  store.enqueueInput(db, `sp-${i}`, wid, "spawn-character", { character: c }, 1);
}
for (let t = 0; t < 250; t++) await step(db, wid, pack, llm);

const evs = store.readEvents(db, wid);
const pick = (k: string) => evs.filter((e) => e.kind === k).map((e) => e.summary);
console.log("陨落(b):", pick("CharacterFell").length, "起", pick("CharacterFell").slice(0, 3));
console.log("吞并(d):", pick("FactionDissolved"));
console.log("复仇了断(e):", pick("VengeanceResolved").length ? pick("VengeanceResolved") : "(无复仇被了结)");

// (f) 复兴: 取一个被吞并的派系, 调 reviveFaction → 入队 → step, 验证版图复振
const dissolved = evs.filter((e) => e.kind === "FactionDissolved").map((e) => (e.payload as { faction?: string }).faction).filter(Boolean)[0];
if (dissolved && pack.reviveFaction) {
  const before = Object.values(store.loadSnapshot(db, wid)!.snapshot.characters).filter((c) => c.present && c.props["faction"] === dissolved).length;
  const reviver = pack.reviveFaction(dissolved, 999);
  store.enqueueInput(db, `rev-${dissolved}`, wid, "spawn-character", { character: reviver }, 1);
  await step(db, wid, pack, llm);
  const after = Object.values(store.loadSnapshot(db, wid)!.snapshot.characters).filter((c) => c.present && c.props["faction"] === dissolved);
  console.log(`复兴(f): ${dissolved} 复兴前在场${before}人 → 拥立「${reviver.name}」(${pack.progression.tiers.find((t) => t.id === reviver.progressionTier)?.name}) → 复兴后${after.length}人，版图复振 ✓`);
} else {
  console.log("复兴(f): (本段无派系被吞并, 跳过)");
}
