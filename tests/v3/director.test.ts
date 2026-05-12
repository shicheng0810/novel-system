import { describe, expect, test } from "vitest";

import { Director } from "../../src/v3/director/director";
import type { ParsedWorldDraft, WorldSnapshot } from "../../src/v3/domain/world";
import { emptySnapshot } from "../../src/v3/domain/world";

function makeParsed(): ParsedWorldDraft {
  return {
    worldSpec: { genre: "", timeScale: "", cultivationSystem: "", worldRules: [], factions: [], locations: [] },
    characters: [
      { id: "林焰", name: "林焰", faction: "青岳宗", role: "外门", traits: [], goal: "x", stance: "x", resource: "x" },
      { id: "苏雪", name: "苏雪", faction: "青岳宗", role: "执事", traits: [], goal: "y", stance: "y", resource: "y" },
      { id: "韩煜", name: "韩煜", faction: "天炎门", role: "护法", traits: [], goal: "z", stance: "z", resource: "z" },
    ],
    relationships: [],
    characterAnchors: [
      { characterId: "林焰", cannot: "提前死亡", mustTrend: "成长", stageGoal: "近真传" },
    ],
    relationshipAnchors: [],
  };
}

function makeParsedAllAnchored(): ParsedWorldDraft {
  const parsed = makeParsed();
  parsed.characterAnchors = parsed.characters.map((c) => ({
    characterId: c.id,
    cannot: "提前死亡",
    mustTrend: "成长",
    stageGoal: "下一阶段",
  }));
  return parsed;
}

function snapshotWith(parsed: ParsedWorldDraft): WorldSnapshot {
  const snap = emptySnapshot("w1");
  for (const c of parsed.characters) {
    snap.characters[c.id] = {
      name: c.name,
      faction: c.faction,
      role: c.role,
      traits: [],
      goal: c.goal,
      stance: c.stance,
      resource: c.resource,
      progress: 0,
      pressure: 0,
      lastAction: "idle",
      alive: true,
      notes: [],
    };
  }
  return snap;
}

describe("Director", () => {
  test("arc phase maps to tick ratio", () => {
    const parsed = makeParsed();
    const snap = snapshotWith(parsed);
    const director = new Director(
      { parsedFn: () => parsed, snapshotFn: () => snap },
      { totalTicks: 10, composeEvery: 5 },
    );
    expect(director.plan({ tickIndex: 0, history: [] }).arcPhase).toBe("exposition");
    expect(director.plan({ tickIndex: 4, history: [] }).arcPhase).toBe("rising");
    expect(director.plan({ tickIndex: 7, history: [] }).arcPhase).toBe("climax");
    expect(director.plan({ tickIndex: 8, history: [] }).arcPhase).toBe("falling");
    expect(director.plan({ tickIndex: 9, history: [] }).arcPhase).toBe("coda");
  });

  test("tension EMA rises through climax then falls", () => {
    const parsed = makeParsed();
    const snap = snapshotWith(parsed);
    const director = new Director(
      { parsedFn: () => parsed, snapshotFn: () => snap },
      { totalTicks: 10, composeEvery: 5, initialTension: 25 },
    );
    const expo = director.plan({ tickIndex: 0, history: [] }).tension;
    const climax = director.plan({ tickIndex: 7, history: [] }).tension;
    const coda = director.plan({ tickIndex: 9, history: [] }).tension;
    expect(climax).toBeGreaterThan(expo);
    expect(climax).toBeGreaterThan(coda);
  });

  test("focus rotates across many ticks (not the same character every tick)", () => {
    const parsed = makeParsedAllAnchored();
    const snap = snapshotWith(parsed);
    snap.characters["林焰"].pressure = 30;
    snap.characters["苏雪"].pressure = 30;
    snap.characters["韩煜"].pressure = 30;
    const director = new Director({ parsedFn: () => parsed, snapshotFn: () => snap }, { totalTicks: 30 });
    const primaries = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      primaries.add(director.plan({ tickIndex: i, history: [] }).focusCharacterIds[0]);
    }
    expect(primaries.size).toBeGreaterThan(1);
  });

  test("compose=true every N ticks", () => {
    const parsed = makeParsed();
    const snap = snapshotWith(parsed);
    const director = new Director(
      { parsedFn: () => parsed, snapshotFn: () => snap },
      { totalTicks: 30, composeEvery: 3 },
    );
    expect(director.plan({ tickIndex: 0, history: [] }).compose).toBe(false);
    expect(director.plan({ tickIndex: 1, history: [] }).compose).toBe(false);
    expect(director.plan({ tickIndex: 2, history: [] }).compose).toBe(true);
    expect(director.plan({ tickIndex: 5, history: [] }).compose).toBe(true);
  });
});
