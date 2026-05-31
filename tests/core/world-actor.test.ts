// tests/core/world-actor.test.ts — M1 runtime: 无半提交 + 确定性(MockLLM) + 八字 prior 真实影响
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

async function runWorld(seed: string, n: number): Promise<{ snapshot: WorldSnap; lastSeq: number; maxSeq: number; tick: number }> {
  const db = openDb(":memory:");
  const worldId = "t";
  const snap = xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed, config: {} });
  store.saveSnapshot(db, worldId, snap, 0, 1);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
  await runTicks(db, worldId, xianxiaBaziPack, new MockLLM(), n);
  const after = store.loadSnapshot(db, worldId);
  if (!after) throw new Error("no snapshot");
  const ms = store.maxSeq(db, worldId);
  db.close();
  return { snapshot: after.snapshot, lastSeq: after.lastSeq, maxSeq: ms, tick: after.snapshot.tick };
}

interface WorldSnap {
  tick: number;
}

describe("WorldActor M1", () => {
  it("跑 30 tick, 无半提交(world_state.last_seq == max events.seq)", async () => {
    const r = await runWorld("seed-A", 30);
    expect(r.tick).toBe(30);
    expect(r.maxSeq).toBeGreaterThan(0);
    expect(r.lastSeq).toBe(r.maxSeq);
  });

  it("确定性: 同 seed → 同世界; 不同 seed(不同生辰→不同八字 prior)→ 不同世界", async () => {
    const a1 = await runWorld("seed-A", 20);
    const a2 = await runWorld("seed-A", 20);
    const b = await runWorld("seed-B", 20);
    expect(JSON.stringify(a1.snapshot)).toBe(JSON.stringify(a2.snapshot));
    expect(JSON.stringify(a1.snapshot)).not.toBe(JSON.stringify(b.snapshot));
  });
});
