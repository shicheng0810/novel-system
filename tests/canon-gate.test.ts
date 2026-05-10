import { describe, expect, test } from "vitest";

import { evaluateCanonGate } from "../src/canon-gate";
import { WorldHistoryEngine, parseWorldDraft } from "../src/index";

const gateDraft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望与执念

# 势力
- 青岳宗：正宗
- 幽潮殿：潜伏者

# 地点
- 外门山城：试炼地

# 角色
- 林焰 | faction=青岳宗 | role=外门弟子 | traits=倔强,护短 | goal=拿到真传名额 | stance=守宗 | resource=赤纹残图
- 韩渡 | archetypeDraft=水金偏旺、谋定后动、逢乱得势 | faction=幽潮殿 | role=潜伏者 | traits=隐忍,野心 | goal=夺取玄脉坐标 | stance=夺脉 | resource=潮息秘符

# 关系
- 林焰 <-> 韩渡 | status=宿敌 | history=矿脉试炼结仇 | tension=争夺玄脉线索

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额
- 韩渡 | cannot=突然改邪归正 | must_trend=逐步逼近玄脉 | stage_goal=抢到关键线索

# 关系锚点
- 林焰 <-> 韩渡 | boundary=不能突然并肩结盟 | trend=竞争升级为公开冲突
`;

describe("CanonGate", () => {
  test("rejects branches that fail the existing consistency gate", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(gateDraft));
    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "韩渡"],
    });
    const rupture = result.branchEvaluations.find((branch) => branch.branchId.endsWith("rupture"));
    const decision = evaluateCanonGate({
      runId: "run-gate",
      parsed: engine.getParsedWorld(),
      canonLine: engine.getCanonLine(),
      candidateLine: engine.getLine(rupture!.branchId),
      branchEvaluation: rupture!,
    });

    expect(decision.result).toBe("reject");
    expect(decision.riskLevel).toBe("fatal");
    expect(decision.reasons.some((reason) => reason.severity === "blocker")).toBe(true);
  });

  test("archives valid recommended branches without auto-promoting", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(gateDraft));
    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });
    const recommended = result.branchEvaluations.find((branch) => branch.recommended);
    const decision = evaluateCanonGate({
      runId: "run-gate",
      parsed: engine.getParsedWorld(),
      canonLine: engine.getCanonLine(),
      candidateLine: engine.getLine(recommended!.branchId),
      branchEvaluation: recommended!,
    });

    expect(decision.result).toBe("archive-only");
    expect(decision.reasons.map((reason) => reason.code)).toContain("narrative-payoff");
  });
});

describe("WorldHistoryEngine gate integration", () => {
  test("returns gate decisions next to branch evaluations", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(gateDraft));
    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    expect(result.gateDecisions?.length).toBe(result.branchEvaluations.length);
    expect(result.gateDecisions?.every((decision) => decision.result !== "accept-canon")).toBe(true);
  });
});
