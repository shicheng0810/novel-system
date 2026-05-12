import { describe, expect, test } from "vitest";

import { evaluateAnchorViolations, riskFromViolations } from "../src/domain/canon";
import { emptySnapshot } from "../src/domain/world";
import type { ParsedWorldDraft, WorldSnapshot } from "../src/domain/world";

function makeWorld(): ParsedWorldDraft {
  return {
    worldSpec: {
      genre: "x",
      timeScale: "",
      cultivationSystem: "",
      worldRules: [],
      factions: [],
      locations: [],
    },
    characters: [
      { id: "林焰", name: "林焰", faction: "", role: "", traits: [], goal: "", stance: "", resource: "" },
    ],
    relationships: [],
    characterAnchors: [
      { characterId: "林焰", cannot: "提前死亡", mustTrend: "在压力中成长", stageGoal: "近真传" },
    ],
    relationshipAnchors: [],
  };
}

function snapshotWith(over: Partial<{
  lastAction: string;
  notes: string[];
  alive: boolean;
  pressure: number;
}>): WorldSnapshot {
  const snap = emptySnapshot("w1");
  snap.characters["林焰"] = {
    name: "林焰",
    faction: "",
    role: "",
    traits: [],
    goal: "",
    stance: "",
    resource: "",
    progress: 0,
    pressure: over.pressure ?? 0,
    lastAction: over.lastAction ?? "idle",
    alive: over.alive ?? true,
    notes: over.notes ?? [],
  };
  return snap;
}

describe("evaluateAnchorViolations", () => {
  test("cannot keyword hit on lastAction reports error", () => {
    const parsed = makeWorld();
    const snap = snapshotWith({ lastAction: "林焰提前死亡于试炼场" });
    const v = evaluateAnchorViolations(parsed, snap);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe("error");
    expect(v[0].anchorField).toBe("cannot");
    expect(riskFromViolations(v)).toBe("high");
  });

  test("cannot keyword hit on notes reports error", () => {
    const parsed = makeWorld();
    const snap = snapshotWith({ notes: ["平淡度过试炼", "导致 提前死亡 的伏笔"] });
    const v = evaluateAnchorViolations(parsed, snap);
    expect(v.some((vv) => vv.anchorField === "cannot")).toBe(true);
  });

  test("no keyword hit + alive → no cannot violation", () => {
    const parsed = makeWorld();
    const snap = snapshotWith({ lastAction: "林焰守宗护短" });
    const v = evaluateAnchorViolations(parsed, snap);
    expect(v.some((vv) => vv.anchorField === "cannot")).toBe(false);
  });

  test("death-like cannot + alive=false fires error even without keyword in notes", () => {
    const parsed = makeWorld();
    const snap = snapshotWith({ alive: false, lastAction: "倒下", notes: [] });
    const v = evaluateAnchorViolations(parsed, snap);
    expect(v.some((vv) => vv.anchorField === "cannot" && vv.severity === "error")).toBe(true);
  });

  test("mustTrend warning fires under pressure>80 with no matching note", () => {
    const parsed = makeWorld();
    const snap = snapshotWith({ pressure: 92, notes: ["按兵不动"] });
    const v = evaluateAnchorViolations(parsed, snap);
    expect(v.some((vv) => vv.anchorField === "mustTrend" && vv.severity === "warning")).toBe(true);
  });

  test("low pressure + missing trend → no warning", () => {
    const parsed = makeWorld();
    const snap = snapshotWith({ pressure: 30, notes: ["按兵不动"] });
    const v = evaluateAnchorViolations(parsed, snap);
    expect(v).toHaveLength(0);
  });
});
