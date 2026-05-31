// tests/core/economy.test.ts — 经济①: 地点产出(yield) → 角色累积 resource → 喂进阶门槛
// 守卫: 世界有物质基底, 资源随驻留累积, 且进阶受资源约束(富庶之地有争夺价值)。
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

describe("经济 (经济①: 资源→进阶)", () => {
  it("地点有产出(yield) + 角色随驻留累积 resource", async () => {
    const db = openDb(":memory:");
    store.saveSnapshot(db, "e", xianxiaBaziPack.seedWorld({ worldId: "e", packId: xianxiaBaziPack.id, seed: "eco-A", config: {} }), 0, 1);
    store.setSchedulerState(db, "e", { gen: 0, nextTick: 0, status: "running" }, 1);
    const snap0 = store.loadSnapshot(db, "e")!.snapshot;
    expect(Object.values(snap0.locations).some((l) => typeof l.props["yield"] === "number" && (l.props["yield"] as number) > 0)).toBe(true);
    await runTicks(db, "e", xianxiaBaziPack, new MockLLM(), 20);
    const snap = store.loadSnapshot(db, "e")!.snapshot;
    const accrued = Object.values(snap.characters).some((c) => typeof c.props["resource"] === "number" && (c.props["resource"] as number) > 0);
    expect(accrued).toBe(true);
    db.close();
  });

  it("canAdvance 受资源门槛约束(阅历足但资源空 → lack-resource)", () => {
    const snap = xianxiaBaziPack.seedWorld({ worldId: "e", packId: xianxiaBaziPack.id, seed: "eco-A", config: {} });
    const c = Object.values(snap.characters)[0]!;
    c.props["actCount"] = 10;
    c.props["resource"] = 0;
    expect(xianxiaBaziPack.progression.canAdvance(c, snap).gate).toBe("lack-resource");
    c.props["resource"] = 999;
    expect(xianxiaBaziPack.progression.canAdvance(c, snap).ok).toBe(true);
  });
});
