// tests/core/genre-pack.test.ts — M7: §2.7 运行时铁证 —— 换非修仙包(无 prior/无 lunar), 同一引擎零改动跑通
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";
import { scifiStationPack } from "../../packs/scifi-station/index";

describe("genre pack smoke M7 (§2.7 引擎↔包分离)", () => {
  it("非修仙包(无 priorSystem)→ 同一引擎跑通: 世界演化 + 无半提交 + 出章", async () => {
    const db = openDb(":memory:");
    const worldId = "s";
    const snap = scifiStationPack.seedWorld({ worldId, packId: scifiStationPack.id, seed: "x1", config: {} });
    store.saveSnapshot(db, worldId, snap, 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
    await runTicks(db, worldId, scifiStationPack, new MockLLM(), 12);
    const after = store.loadSnapshot(db, worldId);
    if (!after) throw new Error("no snapshot");
    expect(after.snapshot.tick).toBe(12);
    expect(after.lastSeq).toBe(store.maxSeq(db, worldId)); // 无半提交
    expect(store.readChapters(db, worldId).length).toBeGreaterThanOrEqual(1); // tick 10 出章
    db.close();
  });
});
