import { describe, expect, test } from "vitest";

import { CharacterAgent } from "../../src/v3/agents/character";
import { AgentRegistry } from "../../src/v3/agents/registry";
import { buildFrame } from "../../src/v3/metaphysics/frame";
import { emptySnapshot } from "../../src/v3/domain/world";
import type { ParsedWorldDraft, WorldSnapshot } from "../../src/v3/domain/world";
import { MockLLMProvider } from "../../src/v3/services/llm/mock";

const parsed: ParsedWorldDraft = {
  worldSpec: { genre: "", timeScale: "", cultivationSystem: "", worldRules: [], factions: [], locations: [] },
  characters: [
    { id: "林焰", name: "林焰", baziRaw: "丙午,丙午,丁巳,丁未", faction: "青岳宗", role: "外门", traits: [], goal: "突破", stance: "守宗", resource: "赤纹残图" },
  ],
  relationships: [],
  characterAnchors: [],
  relationshipAnchors: [],
};

function makeSnap(): WorldSnapshot {
  const snap = emptySnapshot("w1");
  snap.characters["林焰"] = {
    name: "林焰",
    faction: "青岳宗",
    role: "外门",
    traits: [],
    goal: "突破",
    stance: "守宗",
    resource: "赤纹残图",
    progress: 0,
    pressure: 50,
    lastAction: "idle",
    alive: true,
    notes: [],
  };
  return snap;
}

describe("CharacterAgent (heuristic mode)", () => {
  test("reflect produces a summary citing memory ids when present", async () => {
    const snap = makeSnap();
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
    });
    const agent = new CharacterAgent({});
    const reflection = await agent.reflect({
      character: parsed.characters[0],
      snapshot: snap,
      frame,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
      memories: [
        { kind: "fact", id: "f1", body: "外门压制重", characterIds: ["林焰"], importance: 6, source: { kind: "stage", refId: "s1" } },
      ],
    });
    expect(reflection.summary).toContain("林焰");
    expect(reflection.citedMemoryIds).toContain("f1");
    expect(reflection.pressureRead).toBe(50);
  });

  test("plan returns at least 2 candidate actions ordered by fate", async () => {
    const snap = makeSnap();
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
    });
    const agent = new CharacterAgent({});
    const refl = await agent.reflect({
      character: parsed.characters[0],
      snapshot: snap,
      frame,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
      memories: [],
    });
    const candidates = await agent.plan(
      {
        character: parsed.characters[0],
        snapshot: snap,
        frame,
        directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
        memories: [],
      },
      refl,
    );
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    // fire-dominant character → aggressive should be ordered first
    expect(candidates[0].axisHints).toContain("initiative");
  });
});

describe("AgentRegistry", () => {
  test("reflectAll + planAll fan out to every focus character", async () => {
    const snap = makeSnap();
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
    });
    const registry = new AgentRegistry({ parsed: () => parsed });
    const reflections = await registry.reflectAll({
      snapshot: snap,
      frame,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
      memories: { 林焰: [] },
      characterIds: ["林焰"],
    });
    const candidates = await registry.planAll({
      snapshot: snap,
      frame,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
      memories: { 林焰: [] },
      reflections,
    });
    expect(reflections).toHaveLength(1);
    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  test("LLM mock can be plugged in (no network)", async () => {
    const snap = makeSnap();
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
    });
    const llm = new MockLLMProvider({});
    const agent = new CharacterAgent({ llm });
    const refl = await agent.reflect({
      character: parsed.characters[0],
      snapshot: snap,
      frame,
      directive: { stageLabel: "高潮", focusCharacterIds: ["林焰"] },
      memories: [],
    });
    expect(refl.characterId).toBe("林焰");
  });
});
