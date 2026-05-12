import { describe, expect, test } from "vitest";

import { buildFrame } from "../../src/v3/metaphysics/frame";
import type { ParsedWorldDraft, StageDirective } from "../../src/v3/domain/world";

const draft: ParsedWorldDraft = {
  worldSpec: {
    genre: "修仙",
    timeScale: "阶段",
    cultivationSystem: "灵海",
    worldRules: [],
    factions: [],
    locations: [],
  },
  characters: [
    {
      id: "林焰",
      name: "林焰",
      baziRaw: "丙午,丙午,丁巳,丁未",
      faction: "青岳宗",
      role: "外门",
      traits: ["倔强"],
      goal: "x",
      stance: "x",
      resource: "x",
    },
    {
      id: "苏雪",
      name: "苏雪",
      baziRaw: "辛酉,癸亥,壬申,辛丑",
      faction: "青岳宗",
      role: "执事",
      traits: ["冷静"],
      goal: "y",
      stance: "y",
      resource: "y",
    },
  ],
  relationships: [],
  characterAnchors: [],
  relationshipAnchors: [],
};

const directiveCalm: StageDirective = {
  stageLabel: "外门日常",
  focusCharacterIds: ["林焰"],
};
const directiveShock: StageDirective = {
  stageLabel: "突发惊变",
  intervention: "丹谷被入侵",
  focusCharacterIds: ["林焰"],
};

describe("v3 metaphysics frame", () => {
  test("frame contains influences for each character + qimen + bagua", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: directiveCalm,
    });
    const characters = frame.influences.filter((i) => i.target.kind === "character");
    expect(characters.map((i) => i.target.kind === "character" ? i.target.characterId : "").sort()).toEqual(["林焰", "苏雪"]);
    expect(frame.influences.some((i) => i.source === "qimen")).toBe(true);
    expect(frame.influences.some((i) => i.source === "bagua")).toBe(true);
  });

  test("different directives produce different qimen patterns", () => {
    const calmFrame = buildFrame({
      runId: "r-calm",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: directiveCalm,
    });
    const shockFrame = buildFrame({
      runId: "r-shock",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: directiveShock,
    });
    expect(calmFrame.qimenContext.pattern).not.toBe(shockFrame.qimenContext.pattern);
  });

  test("trace records each rule application", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: directiveCalm,
    });
    const sources = new Set(frame.trace.map((t) => t.source));
    expect(sources.has("bazi")).toBe(true);
    expect(sources.has("bagua")).toBe(true);
    expect(sources.has("qimen")).toBe(true);
  });

  test("explanation has fate / fortune / qimen layers populated", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 2,
      parsed: draft,
      directive: directiveShock,
    });
    expect(frame.explanation.fateLayer).toContain("林焰");
    expect(frame.explanation.qimenLayer).toContain(frame.qimenContext.pattern);
  });
});
