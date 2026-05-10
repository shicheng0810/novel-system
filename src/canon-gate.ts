import type { BranchEvaluation, ParsedWorldDraft, TimelineLine } from "./domain";
import type { CanonGateDecision, CanonGateReason, CanonGateScore } from "./runtime-types";

function refsFromLine(line: TimelineLine) {
  const latest = line.events.at(-1);
  return [
    {
      causationId: latest?.id,
      characterIds: latest?.participants ?? [],
      relationshipKeys: [],
      factionNames: [],
      locationNames: [],
    },
  ];
}

function scoreFromEvaluation(evaluation: BranchEvaluation): CanonGateScore {
  return {
    anchorCompliance: evaluation.passesConsistencyGate ? 10 : 0,
    canonContinuity: evaluation.passesConsistencyGate ? 8 : 2,
    worldRuleCompliance: evaluation.passesConsistencyGate ? 8 : 2,
    characterContinuity: Math.max(0, Math.min(10, evaluation.scores.fateConsistency)),
    relationshipContinuity: Math.max(0, Math.min(10, evaluation.scores.consistency)),
    metaphysicsFit: Math.max(0, Math.min(10, evaluation.scores.fateConsistency + evaluation.scores.qimenOutcomeImpact)),
    narrativeYield: Math.max(0, Math.min(10, evaluation.scores.spectacle + evaluation.scores.pacing - 8)),
  };
}

function blockerReasons(evaluation: BranchEvaluation, candidateLine: TimelineLine): CanonGateReason[] {
  return evaluation.risks.map((risk) => ({
    code: risk.includes("锚点") || risk.includes("不能") ? "anchor-violation" : "canon-contradiction",
    severity: "blocker",
    message: risk,
    refs: refsFromLine(candidateLine),
  }));
}

export function evaluateCanonGate(input: {
  runId: string;
  parsed: ParsedWorldDraft;
  canonLine: TimelineLine;
  candidateLine: TimelineLine;
  branchEvaluation: BranchEvaluation;
  requireAuthorOnHighRisk?: boolean;
}): CanonGateDecision {
  const score = scoreFromEvaluation(input.branchEvaluation);
  const reasons: CanonGateReason[] = [];

  if (!input.branchEvaluation.passesConsistencyGate) {
    reasons.push(...blockerReasons(input.branchEvaluation, input.candidateLine));
    if (reasons.length === 0) {
      reasons.push({
        code: "canon-contradiction",
        severity: "blocker",
        message: "分支未通过既有一致性门。",
        refs: refsFromLine(input.candidateLine),
      });
    }
    return {
      decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
      runId: input.runId,
      branchId: input.branchEvaluation.branchId,
      result: "reject",
      riskLevel: "fatal",
      score,
      reasons,
      requiredAuthorActions: [],
    };
  }

  reasons.push({
    code: "narrative-payoff",
    severity: "info",
    message: `分支通过一致性门，总分 ${input.branchEvaluation.scores.total}，可归档供作者选择。`,
    refs: refsFromLine(input.candidateLine),
  });

  if (input.branchEvaluation.scores.qimenOutcomeImpact >= 2 || input.branchEvaluation.risks.some((risk) => risk.includes("死亡"))) {
    reasons.push({
      code: "requires-author",
      severity: "warning",
      message: "该分支包含较强术数结果偏转或不可逆风险，需要作者确认后进入正史。",
      refs: refsFromLine(input.candidateLine),
    });
    if (input.requireAuthorOnHighRisk) {
      return {
        decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
        runId: input.runId,
        branchId: input.branchEvaluation.branchId,
        result: "ask-author",
        riskLevel: "high",
        score,
        reasons,
        requiredAuthorActions: [
          {
            actionId: `${input.runId}-${input.branchEvaluation.branchId}-author`,
            reason: "高风险分支需要作者裁决。",
            options: [
              { optionId: "accept", label: "接受为正史", consequence: "分支可进入 promote 流程" },
              { optionId: "archive", label: "只归档", consequence: "分支保留但不改变正史" },
              { optionId: "reject", label: "拒绝", consequence: "分支标记为拒绝" },
              { optionId: "revise-directive", label: "修改指令", consequence: "创建新 SimulationRun" },
            ],
          },
        ],
      };
    }
  }

  return {
    decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
    runId: input.runId,
    branchId: input.branchEvaluation.branchId,
    result: "archive-only",
    riskLevel: reasons.some((reason) => reason.code === "requires-author") ? "medium" : "low",
    score,
    reasons,
    requiredAuthorActions: [],
  };
}
