// tests/core/compose.test.ts — M2: director 周期触发 compose, 章节落库且有正文
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

describe("compose M2", () => {
  it("跑 30 tick → director 周期出章(≥3 章, 有梗概+正文)", async () => {
    const db = openDb(":memory:");
    const worldId = "t";
    const snap = xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "seed-A", config: {} });
    store.saveSnapshot(db, worldId, snap, 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
    await runTicks(db, worldId, xianxiaBaziPack, new MockLLM(), 30);
    const chapters = store.readChapters(db, worldId);
    db.close();
    expect(chapters.length).toBeGreaterThanOrEqual(3);
    expect(chapters[0]!.goal.length).toBeGreaterThan(0);
    expect(chapters[0]!.text.length).toBeGreaterThan(0);
  });
});
