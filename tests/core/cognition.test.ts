// tests/core/cognition.test.ts — 认知①: 命格定志(目标驱动长期行动, 非纯反应)
// 守卫: 每角色由命格得一命定之志, 志确定且多样, 并真驱动 prior(buildFrame)。
import { describe, it, expect } from "vitest";
import { xianxiaBaziPack, goalLabel } from "../../packs/xianxia-bazi/index";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";

function seed(s: string) {
  return xianxiaBaziPack.seedWorld({ worldId: "t", packId: xianxiaBaziPack.id, seed: s, config: {} });
}

describe("角色认知 (认知①: 命定之志)", () => {
  it("每个角色命格 → 一个命定之志(志在X)", () => {
    for (const c of Object.values(seed("natal-A").characters)) {
      expect(goalLabel(c)).toMatch(/^志在/);
    }
  });

  it("志确定性: 同种子 → 同志", () => {
    const a = Object.values(seed("natal-A").characters).map(goalLabel).join("|");
    const b = Object.values(seed("natal-A").characters).map(goalLabel).join("|");
    expect(a).toBe(b);
  });

  it("志多样: 四主角之志不止一种(命格各异)", () => {
    const goals = new Set(Object.values(seed("natal-A").characters).filter((c) => c.id.startsWith("c")).map(goalLabel));
    expect(goals.size).toBeGreaterThanOrEqual(2);
  });

  it("目标驱动 buildFrame: 产出 source=goal 的 targeted 影响力", () => {
    const frame = xianxiaBaziPack.priorSystem!.buildFrame({ snapshot: seed("natal-A"), tick: 1 });
    const goalInf = frame.influences.filter((i) => i.source === "goal");
    expect(goalInf.length).toBeGreaterThan(0);
    expect(goalInf.every((i) => i.scope === "targeted" && !!i.targetId)).toBe(true);
  });
});

describe("角色认知 (认知②: 记忆喂决策)", () => {
  it("互动累积历练 + 记下显著情景记忆(可召回)", async () => {
    const db = openDb(":memory:");
    store.saveSnapshot(db, "m", xianxiaBaziPack.seedWorld({ worldId: "m", packId: xianxiaBaziPack.id, seed: "mem-A", config: {} }), 0, 1);
    store.setSchedulerState(db, "m", { gen: 0, nextTick: 0, status: "running" }, 1);
    await runTicks(db, "m", xianxiaBaziPack, new MockLLM(), 30);
    const snap = store.loadSnapshot(db, "m")!.snapshot;
    const seasoned = Object.values(snap.characters).some((c) => typeof c.props["历练"] === "number" && (c.props["历练"] as number) > 0);
    expect(seasoned).toBe(true);
    const mems = store.readSalientMemories(db, "m", 0.6, 5);
    expect(mems.length).toBeGreaterThan(0);
    expect(mems.every((m) => !!m.characterId && !!m.body)).toBe(true);
    db.close();
  });
});
