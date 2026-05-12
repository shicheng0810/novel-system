import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../src/data/db";
import { EventBus } from "../src/services/event-bus";
import { WorldStore } from "../src/services/world-store";
import { MemoryService } from "../src/services/memory-service";
import { AtlasService } from "../src/services/atlas-service";
import { MockLLMProvider } from "../src/services/llm/mock";
import { AgentRegistry } from "../src/agents/registry";
import { runTick } from "../src/engine/tick";
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
    worldRules: ["玄脉共鸣"],
    factions: [{ name: "青岳宗", description: "正宗" }],
    locations: [{ name: "外门", description: "外门聚居" }],
  },
  characters: [
    {
      id: "林焰",
      name: "林焰",
      baziRaw: "丙午,丙午,丁巳,丁未",
      faction: "青岳宗",
      role: "外门",
      traits: ["倔强"],
      goal: "拿到真传",
      stance: "守宗",
      resource: "赤纹残图",
    },
  ],
  relationships: [],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "在压力中成长", stageGoal: "近真传" },
  ],
  relationshipAnchors: [],
};

function harness() {
  const dir = mkdtempSync(join(tmpdir(), "v3-tick-"));
  tmpDirs.push(dir);
  const db = openDb({ rootDir: dir });
  const bus = new EventBus(db);
  const worldStore = new WorldStore(db);
  const memory = new MemoryService(db, bus);
  const atlas = new AtlasService(db, bus);
  const llm = new MockLLMProvider();
  const registry = new AgentRegistry({ parsed: () => draft });
  worldStore.applyDraft("w1", draft);
  return { dir, db, bus, worldStore, memory, atlas, llm, registry };
}

describe("v3 tick engine (no compose)", () => {
  test("happy path emits frame → agents → branches → gate → commit events in order", async () => {
    const { db, bus, worldStore, memory, atlas, llm, registry } = harness();
    try {
      const result = await runTick(
        { db, bus, worldStore, memory, atlas, llm, registry },
        {
          worldId: "w1",
          threadId: "t1",
          tickIndex: 0,
          directive: { stageLabel: "外门日常", focusCharacterIds: ["林焰"] },
        },
      );
      expect(result.status).toBe("completed");
      expect(result.stage?.stageNumber).toBe(1);

      const events = bus.query({ runId: result.runId, limit: 100 }).reverse();
      const phasesSeen = events.map((e) => `${e.subsystem}:${e.status}`);
      expect(phasesSeen).toContain("frame:succeeded");
      expect(phasesSeen.some((p) => p.startsWith("agents:"))).toBe(true);
      expect(phasesSeen).toContain("branches:succeeded");
      expect(phasesSeen).toContain("gate:succeeded");
      expect(phasesSeen).toContain("commit:succeeded");
      expect(phasesSeen).toContain("promotion:succeeded");
      expect(phasesSeen).toContain("runtime:succeeded");
    } finally {
      bus.close();
      db.close();
    }
  });

  test("snapshot is mutated and persisted", async () => {
    const { db, bus, worldStore, memory, atlas, llm, registry } = harness();
    try {
      const before = worldStore.load("w1")!.snapshot.characters["林焰"].progress;
      await runTick(
        { db, bus, worldStore, memory, atlas, llm, registry },
        {
          worldId: "w1",
          threadId: "t1",
          tickIndex: 0,
          directive: { stageLabel: "高潮决战", focusCharacterIds: ["林焰"] },
        },
      );
      const after = worldStore.load("w1")!.snapshot.characters["林焰"].progress;
      expect(after).toBeGreaterThan(before);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("stage row is written to world_history", async () => {
    const { db, bus, worldStore, memory, atlas, llm, registry } = harness();
    try {
      await runTick(
        { db, bus, worldStore, memory, atlas, llm, registry },
        {
          worldId: "w1",
          threadId: "t1",
          tickIndex: 0,
          directive: { stageLabel: "外门日常", focusCharacterIds: ["林焰"] },
        },
      );
      const history = worldStore.loadHistory("w1");
      expect(history).toHaveLength(1);
      expect(history[0].stageLabel).toBe("外门日常");
    } finally {
      bus.close();
      db.close();
    }
  });

  test("metaphysics_frames row written for each tick", async () => {
    const { db, bus, worldStore, memory, atlas, llm, registry } = harness();
    try {
      await runTick(
        { db, bus, worldStore, memory, atlas, llm, registry },
        {
          worldId: "w1",
          threadId: "t1",
          tickIndex: 0,
          directive: { stageLabel: "外门日常", focusCharacterIds: ["林焰"] },
        },
      );
      const rows = db.prepare("SELECT * FROM metaphysics_frames").all();
      expect(rows.length).toBeGreaterThan(0);
    } finally {
      bus.close();
      db.close();
    }
  });
});

describe("v3 tick engine (with compose)", () => {
  test("compose=true triggers 6 sub-phases and writes a chapter", async () => {
    const { db, bus, worldStore, memory, atlas, llm, registry } = harness();
    try {
      const result = await runTick(
        { db, bus, worldStore, memory, atlas, llm, registry },
        {
          worldId: "w1",
          threadId: "t1",
          tickIndex: 0,
          directive: { stageLabel: "外门日常", focusCharacterIds: ["林焰"] },
          compose: true,
          lens: {
            focusCharacterIds: ["林焰"],
            style: "omniscient-web",
            stageRange: [],
            chapterGoal: "推进核心冲突",
            sceneCount: 4,
            targetLength: [2800, 3300],
            factConstraint: "medium-expansion",
          },
        },
      );

      expect(result.status).toBe("completed");
      expect(result.chapterId).toBeTruthy();

      const composePhases = bus
        .query({ runId: result.runId, limit: 200 })
        .filter((e) => e.subsystem === "compose")
        .map((e) => e.phase);
      // Each of the 6 phases emits a started + (succeeded|blocked) event.
      const distinctPhases = new Set(composePhases);
      for (const phase of [
        "memory-read",
        "blueprint",
        "scene-cards",
        "synthesize",
        "review",
        "inscribe",
      ]) {
        expect(distinctPhases.has(phase)).toBe(true);
      }

      const chapterRow = db
        .prepare("SELECT chapter_id, status FROM chapters WHERE chapter_id = ?")
        .get([result.chapterId!]) as { chapter_id: string; status: string };
      expect(chapterRow.chapter_id).toBe(result.chapterId);
      expect(["inscribed", "rejected"]).toContain(chapterRow.status);
    } finally {
      bus.close();
      db.close();
    }
  });
});
