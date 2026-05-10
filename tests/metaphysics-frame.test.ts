import { describe, expect, test } from "vitest";

import type { QimenContext, QimenModifier } from "../src/domain";
import { deriveBaguaSituation } from "../src/metaphysics/bagua";
import { buildMetaphysicsFrame } from "../src/metaphysics/frame";
import { buildQimenBoard } from "../src/metaphysics/qimen-board";
import { parseWorldDraft } from "../src/parser";

describe("bagua situation", () => {
  test("maps hidden danger and exposure pressure to 坎离 structure", () => {
    const situation = deriveBaguaSituation({
      stageLabel: "丹谷搜查",
      intervention: "地火丹谷丹炉爆裂，执法堂搜查内应，密信暴露。",
      focusCharacterIds: ["苏雪"],
    });

    expect(situation.internalTrigram).toBe("坎");
    expect(situation.externalTrigram).toBe("离");
    expect(situation.structuralTags).toContain("hidden-threat");
    expect(situation.structuralTags).toContain("exposure");
  });

  test("maps trial and blockage pressure to 艮 structure", () => {
    const situation = deriveBaguaSituation({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    expect(situation.externalTrigram).toBe("艮");
    expect(situation.narrativeEffect).toContain("门槛");
  });
});

describe("qimen board", () => {
  test("converts an existing qimen context into a manual-lite board", () => {
    const context: QimenContext = {
      sourceMode: "manual",
      pattern: "惊门迫宫",
      locationFocus: "地火丹谷",
      eventType: "危机爆发",
      strongSituationScore: 3,
      allowHardDecision: true,
    };
    const modifier: QimenModifier = {
      timingShift: "redirect",
      outcomeBias: "twist",
      timingWeight: 2,
      outcomeWeight: 1,
      hardDecision: { type: "outcome", verdict: "惊门强局允许结果反转" },
    };

    const board = buildQimenBoard({ context, modifier, stageNumber: 2 });

    expect(board.school).toBe("manual-lite");
    expect(board.palaces[board.activePalace - 1].door).toBe("惊门");
    expect(board.hardDecisionAllowed).toBe(true);
    expect(board.focusPalaces).toContain(board.activePalace);
  });
});

const frameDraft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望

# 势力
- 青岳宗：正宗

# 地点
- 地火丹谷：炼丹重地

# 角色
- 苏雪 | baziRaw=辛巳,癸酉,己亥,乙丑 | description=外冷内热，重秩序 | faction=青岳宗 | role=丹谷执事 | traits=冷静,克制,重情 | goal=守住丹谷 | stance=守宗 | resource=地火炉令

# 关系

# 单角色锚点
- 苏雪 | cannot=无因失守底线 | must_trend=在规则与情感之间摇摆 | stage_goal=守住丹谷

# 关系锚点
`;

describe("metaphysics frame", () => {
  test("combines bazi, bagua, and qimen into traceable influences", () => {
    const parsed = parseWorldDraft(frameDraft);
    const frame = buildMetaphysicsFrame({
      runId: "run-frame",
      parsed,
      stageNumber: 1,
      directive: {
        stageLabel: "丹谷搜查",
        focusCharacterIds: ["苏雪"],
        intervention: "地火丹谷丹炉爆裂，执法堂搜查内应。",
        qimenOverride: {
          pattern: "惊门迫宫",
          locationFocus: "地火丹谷",
          eventType: "危机爆发",
          allowHardDecision: true,
        },
      },
    });

    expect(frame.influences.some((influence) => influence.source === "bazi")).toBe(true);
    expect(frame.influences.some((influence) => influence.source === "bagua")).toBe(true);
    expect(frame.influences.some((influence) => influence.source === "qimen")).toBe(true);
    expect(frame.trace.map((trace) => trace.source)).toEqual(expect.arrayContaining(["bazi", "bagua", "qimen"]));
  });
});
