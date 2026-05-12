import { describe, expect, test } from "vitest";

import { buildFrame } from "../../src/v3/metaphysics/frame";
import {
  normalizeWeights,
  scoreCandidate,
  scoreCandidates,
  type CandidateAction,
} from "../../src/v3/metaphysics/prior";
import type { ParsedWorldDraft } from "../../src/v3/domain/world";

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
      baziRaw: "丙午,丙午,丁巳,丁未", // strong fire = high initiative
      faction: "青岳宗",
      role: "外门",
      traits: [],
      goal: "x",
      stance: "x",
      resource: "x",
    },
    {
      id: "苏雪",
      name: "苏雪",
      baziRaw: "辛酉,癸亥,壬申,辛丑", // water+metal =藏锋
      faction: "青岳宗",
      role: "执事",
      traits: [],
      goal: "y",
      stance: "y",
      resource: "y",
    },
  ],
  relationships: [],
  characterAnchors: [],
  relationshipAnchors: [],
};

const aggressive: CandidateAction = {
  candidateId: "林焰-冲",
  characterId: "林焰",
  action: "林焰强攻丹谷封锁",
  intent: "突破封锁",
  axisHints: ["initiative", "rupture"],
  affectsLocationId: "丹谷",
};

const cautious: CandidateAction = {
  candidateId: "林焰-忍",
  characterId: "林焰",
  action: "林焰按兵不动等候时机",
  intent: "保留实力",
  axisHints: ["delay", "discipline"],
  affectsLocationId: "外门",
};

describe("v3 metaphysics prior", () => {
  test("scoreCandidate returns 0..1 weight + breakdown", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: { stageLabel: "外门日常", focusCharacterIds: ["林焰"] },
    });
    const scored = scoreCandidate(aggressive, frame);
    expect(scored.weight).toBeGreaterThanOrEqual(0);
    expect(scored.weight).toBeLessThanOrEqual(1);
    expect(scored.breakdown.total).toBe(scored.weight);
    expect(scored.explain).toContain("权重");
  });

  test("aggressive action scores higher under 惊门 (advance/rupture frame)", () => {
    const calmFrame = buildFrame({
      runId: "r-calm",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: {
        stageLabel: "外门守势",
        focusCharacterIds: ["林焰"],
        qimenOverride: { pattern: "阴遁四局·休门", locationFocus: "外门" },
      },
    });
    const ruptureFrame = buildFrame({
      runId: "r-rupture",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: {
        stageLabel: "高潮决战",
        focusCharacterIds: ["林焰"],
        qimenOverride: { pattern: "阳遁三局·惊门", locationFocus: "丹谷" },
      },
    });

    const calmScore = scoreCandidate(aggressive, calmFrame).weight;
    const ruptureScore = scoreCandidate(aggressive, ruptureFrame).weight;
    expect(ruptureScore).toBeGreaterThan(calmScore);
  });

  test("scoreCandidates returns sorted by weight descending", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: { stageLabel: "高潮决战", focusCharacterIds: ["林焰"] },
    });
    const scored = scoreCandidates([cautious, aggressive], frame);
    expect(scored).toHaveLength(2);
    expect(scored[0].weight).toBeGreaterThanOrEqual(scored[1].weight);
  });

  test("normalizeWeights sums to 1", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: { stageLabel: "外门日常", focusCharacterIds: ["林焰"] },
    });
    const dist = normalizeWeights(scoreCandidates([cautious, aggressive], frame));
    const sum = dist.reduce((acc, d) => acc + d.probability, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  test("contributingInfluences lists which influences moved the score", () => {
    const frame = buildFrame({
      runId: "r1",
      worldId: "w1",
      stageNumber: 1,
      parsed: draft,
      directive: {
        stageLabel: "高潮决战",
        focusCharacterIds: ["林焰"],
        qimenOverride: { pattern: "阳遁三局·惊门", locationFocus: "丹谷" },
      },
    });
    const scored = scoreCandidate(aggressive, frame);
    expect(scored.contributingInfluences.length).toBeGreaterThan(0);
    // Each contributor must appear in the frame influences.
    for (const id of scored.contributingInfluences) {
      expect(frame.influences.some((inf) => inf.influenceId === id)).toBe(true);
    }
  });
});
