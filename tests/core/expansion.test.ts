// tests/core/expansion.test.ts — 世界扩张: 更大地图 + 动态登场新角色 + 角色移动
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { step } from "../../core/runtime/world-actor";
import { runTicks } from "../../core/runtime/scheduler";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

describe("world expansion", () => {
  it("更大地图(≥7 地点)", () => {
    const snap = xianxiaBaziPack.seedWorld({ worldId: "t", packId: xianxiaBaziPack.id, seed: "s", config: {} });
    expect(Object.keys(snap.locations).length).toBeGreaterThanOrEqual(7);
  });

  it("spawn-character input → 新角色入世(CharacterEntered)", async () => {
    const db = openDb(":memory:");
    const worldId = "t";
    store.saveSnapshot(db, worldId, xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "s", config: {} }), 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
    const newc = xianxiaBaziPack.spawnCharacter!("s", 1);
    store.enqueueInput(db, "sp1", worldId, "spawn-character", { character: newc }, 1);
    await step(db, worldId, xianxiaBaziPack, new MockLLM());
    const after = store.loadSnapshot(db, worldId);
    expect(after?.snapshot.characters[newc.id]).toBeTruthy();
    expect(store.readEvents(db, worldId).some((e) => e.kind === "CharacterEntered")).toBe(true);
  });

  it("角色会移动(跑后出现非初始地点的角色)", async () => {
    const db = openDb(":memory:");
    const worldId = "t";
    store.saveSnapshot(db, worldId, xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "seed-A", config: {} }), 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
    await runTicks(db, worldId, xianxiaBaziPack, new MockLLM(), 30);
    const chars = Object.values(store.loadSnapshot(db, worldId)!.snapshot.characters);
    const initial = new Set(["loc-sect", "loc-wild"]);
    expect(chars.some((c) => !initial.has(c.locationId ?? ""))).toBe(true); // 角色移动到了扩展地图(大事聚集/自主移动)
  });
});
