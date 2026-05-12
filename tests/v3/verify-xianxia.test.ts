import { describe, expect, test } from "vitest";

import { verifyXianxia } from "../../src/v3/verify/xianxia";
import type { ParsedWorldDraft } from "../../src/v3/domain/world";

const parsed: ParsedWorldDraft = {
  worldSpec: {
    genre: "修仙",
    timeScale: "阶段",
    cultivationSystem: "灵海/化罡/真传",
    worldRules: [],
    factions: [],
    locations: [],
  },
  characters: [
    {
      id: "林焰",
      name: "林焰",
      faction: "青岳宗",
      role: "外门",
      traits: [],
      goal: "x",
      stance: "x",
      resource: "赤纹残图",
    },
  ],
  relationships: [],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "成长", stageGoal: "近真传" },
  ],
  relationshipAnchors: [],
};

describe("v3 verify xianxia", () => {
  test("clean text passes with no violations", () => {
    const report = verifyXianxia({
      text: "林焰拿到化罡境界令牌。他握住玉简，转身离去。",
      parsed,
    });
    expect(report.passed).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  test("realm regression flagged as blocker", () => {
    const text =
      "林焰已突破化罡境界，可与执事一战。十几日后，林焰仍是灵海弟子，未曾突破。";
    const report = verifyXianxia({ text, parsed });
    expect(report.violations.some((v) => v.kind === "realm-regression")).toBe(true);
    expect(report.passed).toBe(false);
  });

  test("anchor cannot=提前死亡 violation flagged", () => {
    const text = "雾散时，林焰已身殒，玉简碎落山涧。";
    const report = verifyXianxia({ text, parsed });
    expect(report.violations.some((v) => v.kind === "anchor-cannot-violation")).toBe(true);
    expect(report.passed).toBe(false);
  });
});
