import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../../src/v3/data/db";
import { WorldStore } from "../../src/v3/services/world-store";
import type { ParsedWorldDraft } from "../../src/v3/domain/world";

let tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function fresh() {
  const dir = mkdtempSync(join(tmpdir(), "v3-world-store-"));
  tmpDirs.push(dir);
  const db = openDb({ rootDir: dir });
  return { dir, db, store: new WorldStore(db) };
}

const sampleDraft: ParsedWorldDraft = {
  worldSpec: {
    genre: "修仙",
    timeScale: "阶段",
    cultivationSystem: "灵海/化罡/真传",
    worldRules: ["玄脉共鸣会放大角色的欲望"],
    factions: [{ name: "青岳宗", description: "名门正宗" }],
    locations: [{ name: "外门山城", description: "外门弟子聚居" }],
  },
  characters: [
    {
      id: "林焰",
      name: "林焰",
      faction: "青岳宗",
      role: "外门弟子",
      traits: ["倔强"],
      goal: "拿到真传名额",
      stance: "守宗",
      resource: "赤纹残图",
    },
    {
      id: "苏雪",
      name: "苏雪",
      faction: "青岳宗",
      role: "丹谷执事",
      traits: ["冷静"],
      goal: "守住丹谷",
      stance: "守宗",
      resource: "地火炉令",
    },
  ],
  relationships: [
    {
      id: "林焰-苏雪",
      left: "林焰",
      right: "苏雪",
      status: "盟友",
      history: "苏雪曾保过林焰",
      tension: "信任下的压抑情愫",
    },
  ],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "在压力中成长", stageGoal: "接近真传" },
  ],
  relationshipAnchors: [
    { relationshipId: "林焰-苏雪", left: "林焰", right: "苏雪", boundary: "不能反目", trend: "盟友走向紧绷" },
  ],
};

describe("WorldStore", () => {
  test("applyDraft seeds a snapshot with characters + relationships", () => {
    const { db, store } = fresh();
    try {
      const snap = store.applyDraft("w1", sampleDraft);
      expect(snap.worldId).toBe("w1");
      expect(snap.characters["林焰"].alive).toBe(true);
      expect(snap.characters["林焰"].goal).toBe("拿到真传名额");
      expect(snap.relationships["林焰-苏雪"].trust).toBeGreaterThan(50);
      expect(snap.relationships["林焰-苏雪"].hostility).toBeLessThan(50);
    } finally {
      db.close();
    }
  });

  test("load returns the same parsed + snapshot", () => {
    const { db, store } = fresh();
    try {
      store.applyDraft("w1", sampleDraft);
      const loaded = store.load("w1");
      expect(loaded?.parsed.characters).toHaveLength(2);
      expect(loaded?.snapshot.characters["苏雪"].name).toBe("苏雪");
    } finally {
      db.close();
    }
  });

  test("save mutates snapshot, applyDraft preserved parsed_json", () => {
    const { db, store } = fresh();
    try {
      const snap = store.applyDraft("w1", sampleDraft);
      snap.characters["林焰"].pressure = 70;
      store.save("w1", snap, "evt-1");
      const loaded = store.load("w1");
      expect(loaded?.snapshot.characters["林焰"].pressure).toBe(70);
      expect(loaded?.parsed.characters[0].name).toBe("林焰");
    } finally {
      db.close();
    }
  });

  test("appendStage + loadHistory returns stages in order", () => {
    const { db, store } = fresh();
    try {
      const snap = store.applyDraft("w1", sampleDraft);
      store.appendStage({
        stageId: "stage-1",
        worldId: "w1",
        lineId: "canon",
        stageNumber: 1,
        stageLabel: "初撞",
        ts: 1000,
        events: [],
        snapshot: snap,
      });
      store.appendStage({
        stageId: "stage-2",
        worldId: "w1",
        lineId: "canon",
        stageNumber: 2,
        stageLabel: "再战",
        ts: 2000,
        events: [],
        snapshot: snap,
      });
      const history = store.loadHistory("w1");
      expect(history.map((s) => s.stageNumber)).toEqual([1, 2]);
    } finally {
      db.close();
    }
  });

  test("save without prior applyDraft throws (caller bug guard)", () => {
    const { db, store } = fresh();
    try {
      const snap = { worldId: "x", stageId: "s", stageNumber: 0, characters: {}, relationships: {}, worldFlags: [] };
      expect(() => store.save("x", snap)).toThrow();
    } finally {
      db.close();
    }
  });
});
