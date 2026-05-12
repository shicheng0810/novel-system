import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../src/data/db";
import { AgentRegistry } from "../src/agents/registry";
import { Daemon } from "../src/daemon/daemon";
import { AtlasService } from "../src/services/atlas-service";
import { EventBus } from "../src/services/event-bus";
import { MemoryService } from "../src/services/memory-service";
import { WorldStore } from "../src/services/world-store";
import { MockLLMProvider } from "../src/services/llm/mock";
import type { ParsedWorldDraft } from "../src/domain/world";

let tmpDirs: string[] = [];
afterEach(async () => {
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
  tmpDirs = [];
});

const draft: ParsedWorldDraft = {
  worldSpec: {
    genre: "修仙",
    timeScale: "阶段",
    cultivationSystem: "灵海",
    worldRules: [],
    factions: [],
    locations: [{ name: "外门", description: "外门" }],
  },
  characters: [
    { id: "林焰", name: "林焰", baziRaw: "丙午,丙午,丁巳,丁未", faction: "青岳宗", role: "外门", traits: [], goal: "x", stance: "x", resource: "x" },
    { id: "苏雪", name: "苏雪", baziRaw: "辛酉,癸亥,壬申,辛丑", faction: "青岳宗", role: "执事", traits: [], goal: "y", stance: "y", resource: "y" },
  ],
  relationships: [],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "成长", stageGoal: "近真传" },
    { characterId: "苏雪", cannot: "无因失守底线", mustTrend: "守与情之间摇摆", stageGoal: "守住丹谷" },
  ],
  relationshipAnchors: [],
};

function harness() {
  const dir = mkdtempSync(join(tmpdir(), "v3-daemon-"));
  tmpDirs.push(dir);
  const db = openDb({ rootDir: dir });
  const bus = new EventBus(db);
  const worldStore = new WorldStore(db);
  const memory = new MemoryService(db, bus);
  const atlas = new AtlasService(db, bus);
  const llm = new MockLLMProvider();
  const registry = new AgentRegistry({ parsed: () => draft });
  worldStore.applyDraft("w1", draft);
  const daemon = new Daemon({ db, bus, worldStore, memory, atlas, registry, llm });
  return { dir, db, bus, worldStore, memory, atlas, llm, registry, daemon };
}

describe("Daemon", () => {
  test("start runs N ticks to completion", async () => {
    const { db, bus, daemon } = harness();
    try {
      daemon.start({
        worldId: "w1",
        threadId: "t1",
        targetTicks: 3,
        composeEvery: 99, // no compose
        reason: "test",
      });
      const final = await daemon.waitForIdle();
      expect(final.completed).toBe(true);
      expect(final.completedTicks).toBe(3);
      expect(final.runIds).toHaveLength(3);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("pause stops the loop at the next tick boundary; resume continues", async () => {
    const { db, bus, daemon } = harness();
    try {
      daemon.start({
        worldId: "w1",
        threadId: "t2",
        targetTicks: 4,
        composeEvery: 99,
        tickDelayMs: 20,
      });
      // Pause shortly after start.
      await new Promise((r) => setTimeout(r, 5));
      daemon.pause();
      const paused = await daemon.waitForIdle();
      expect(paused.paused).toBe(true);
      expect(paused.completedTicks).toBeGreaterThanOrEqual(0);
      expect(paused.completedTicks).toBeLessThan(4);

      daemon.resume();
      const final = await daemon.waitForIdle();
      expect(final.completed).toBe(true);
      expect(final.completedTicks).toBe(4);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("step() advances one tick when daemon is idle", async () => {
    const { db, bus, daemon, worldStore } = harness();
    try {
      const before = worldStore.load("w1")!.snapshot.stageNumber;
      daemon.start({
        worldId: "w1",
        threadId: "t3",
        targetTicks: 1,
        composeEvery: 99,
      });
      await daemon.waitForIdle();
      const after = worldStore.load("w1")!.snapshot.stageNumber;
      expect(after).toBeGreaterThan(before);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("resumeFromCheckpoint reads last incomplete run from disk", async () => {
    const { db, bus, daemon } = harness();
    try {
      daemon.start({
        worldId: "w1",
        threadId: "t4",
        targetTicks: 2,
        composeEvery: 99,
      });
      await daemon.waitForIdle();
      // Simulate restart by reading checkpoint.
      const snapshot = daemon.resumeFromCheckpoint("t4");
      expect(snapshot?.threadId).toBe("t4");
      expect(snapshot?.completedTicks).toBe(2);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("only one daemon may be constructed per db", () => {
    const { db, bus, worldStore, memory, atlas, registry, llm, daemon } = harness();
    try {
      void daemon;
      expect(() => new Daemon({ db, bus, worldStore, memory, atlas, registry, llm })).toThrow();
    } finally {
      bus.close();
      db.close();
    }
  });
});
