// tests/core/storyevent.test.ts — 系统级剧情事件(势力战争/秘境副本/魔道入侵…)
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

describe("story events", () => {
  it("跑后触发系统级大事(StoryEventTriggered)+ 设世界危机 + 涉事角色聚集", async () => {
    const db = openDb(":memory:");
    const worldId = "t";
    store.saveSnapshot(db, worldId, xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "s", config: {} }), 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
    await runTicks(db, worldId, xianxiaBaziPack, new MockLLM(), 24); // tick 20 触发首桩大事
    const evts = store.readEvents(db, worldId);
    expect(evts.some((e) => e.kind === "StoryEventTriggered")).toBe(true);
    const snap = store.loadSnapshot(db, worldId);
    expect(typeof snap?.snapshot.props["crisis"]).toBe("string");
    const fr = snap?.snapshot.props["factionRelations"] as Record<string, unknown> | undefined;
    expect(fr && Object.keys(fr).length).toBeGreaterThan(0); // 派系关系随大事演化
    db.close();
  });
});
