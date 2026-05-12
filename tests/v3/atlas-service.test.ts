import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../../src/v3/data/db";
import { EventBus } from "../../src/v3/services/event-bus";
import { AtlasService } from "../../src/v3/services/atlas-service";
import { WorldStore } from "../../src/v3/services/world-store";
import type { ParsedWorldDraft } from "../../src/v3/domain/world";

let tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

const draft: ParsedWorldDraft = {
  worldSpec: {
    genre: "修仙",
    timeScale: "阶段",
    cultivationSystem: "灵海/化罡/真传",
    worldRules: ["玄脉共鸣"],
    factions: [{ name: "青岳宗", description: "名门正宗" }],
    locations: [{ name: "外门山城", description: "外门聚居" }],
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
  ],
  relationships: [],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "成长", stageGoal: "近真传" },
  ],
  relationshipAnchors: [],
};

describe("AtlasService", () => {
  test("compile creates expected file paths and emits an atlas event", () => {
    const dir = mkdtempSync(join(tmpdir(), "v3-atlas-"));
    tmpDirs.push(dir);
    const db = openDb({ rootDir: dir });
    const bus = new EventBus(db);
    const store = new WorldStore(db);
    const atlas = new AtlasService(db, bus);
    try {
      const snap = store.applyDraft("w1", draft);
      const files = atlas.compile({ worldId: "w1", lineId: "canon", parsed: draft, snapshot: snap });

      const paths = files.map((f) => f.path);
      expect(paths).toContain("world/spec.md");
      expect(paths).toContain("world/factions.md");
      expect(paths).toContain("world/locations.md");
      expect(paths).toContain("characters/林焰.md");
      expect(paths).toContain("anchors/characters.md");

      const tree = atlas.tree("w1", "canon");
      expect(tree.find((n) => n.path === "world")?.kind).toBe("directory");
      expect(tree.find((n) => n.path === "characters/林焰.md")?.kind).toBe("file");

      const file = atlas.read("w1", "canon", "characters/林焰.md");
      expect(file?.body).toContain("林焰");
      expect(file?.body).toContain("赤纹残图");

      const events = bus.query({ worldId: "w1" });
      expect(events.find((e) => e.subsystem === "atlas")).toBeTruthy();
    } finally {
      bus.close();
      db.close();
    }
  });

  test("write upserts arbitrary file content", () => {
    const dir = mkdtempSync(join(tmpdir(), "v3-atlas-"));
    tmpDirs.push(dir);
    const db = openDb({ rootDir: dir });
    const bus = new EventBus(db);
    const atlas = new AtlasService(db, bus);
    try {
      atlas.write({ worldId: "w1", lineId: "canon", path: "scratch/note.md", body: "# 笔记" });
      expect(atlas.read("w1", "canon", "scratch/note.md")?.body).toBe("# 笔记");
    } finally {
      bus.close();
      db.close();
    }
  });
});
