import type { BranchEvaluation, ParsedWorldDraft, TimelineLine } from "./domain";
import type { CanonGateDecision, CanonGateReason, CanonGateScore } from "./runtime-types";
import { emitCanonVerdict } from "./world-events/emit";

function emitVerdictForDecision(decision: CanonGateDecision): void {
  let verdict: "accepted" | "rejected" | "paused-on-risk";
  let summary: string;
  if (decision.result === "reject") {
    verdict = "rejected";
    summary = decision.reasons[0]?.message ?? "分支被一致性门拒绝";
  } else if (decision.result === "ask-author") {
    verdict = "paused-on-risk";
    summary = decision.reasons.find((r) => r.severity === "warning")?.message ?? "高风险分支需要作者裁决";
  } else {
    verdict = "accepted";
    summary = decision.reasons[0]?.message ?? "分支通过一致性门";
  }
  emitCanonVerdict({
    runId: decision.runId,
    verdict,
    verdictId: decision.decisionId,
    summary,
    refs: {
      branchId: decision.branchId,
      riskLevel: decision.riskLevel,
      result: decision.result,
    },
  });
}

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

  // Death / 不可逆-risk → escalate to ask-author BEFORE the consistency-gate
  // reject. Previously the rejection at !passesConsistencyGate ran first,
  // making the death warning later in this function unreachable (review · D3).
  // A branch with lethal stakes shouldn't be silently rejected — the author
  // should choose whether to accept the lethal outcome or revise the directive.
  const lethalRisk = input.branchEvaluation.risks.some(
    (risk) =>
      risk.includes("死亡") ||
      risk.includes("身亡") ||
      risk.includes("不可逆"),
  );

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

    // If lethal AND requireAuthorOnHighRisk is on, surface as ask-author
    // instead of silently rejecting — the lethal outcome is a story decision,
    // not a mechanical violation.
    if (lethalRisk && input.requireAuthorOnHighRisk) {
      reasons.push({
        code: "requires-author",
        severity: "warning",
        message: "该分支涉及死亡或不可逆后果，作者必须裁决：接受、修改或拒绝。",
        refs: refsFromLine(input.candidateLine),
      });
      const decision: CanonGateDecision = {
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
            reason: "致命/不可逆分支需要作者裁决。",
            options: [
              { optionId: "accept", label: "接受为正史", consequence: "分支可进入 promote 流程" },
              { optionId: "archive", label: "只归档", consequence: "分支保留但不改变正史" },
              { optionId: "reject", label: "拒绝", consequence: "分支标记为拒绝" },
              { optionId: "revise-directive", label: "修改指令", consequence: "创建新 SimulationRun" },
            ],
          },
        ],
      };
      emitVerdictForDecision(decision);
      return decision;
    }

    const rejectDecision: CanonGateDecision = {
      decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
      runId: input.runId,
      branchId: input.branchEvaluation.branchId,
      result: "reject",
      riskLevel: "fatal",
      score,
      reasons,
      requiredAuthorActions: [],
    };
    emitVerdictForDecision(rejectDecision);
    return rejectDecision;
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
      const decision: CanonGateDecision = {
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
      emitVerdictForDecision(decision);
      return decision;
    }
  }

  const acceptDecision: CanonGateDecision = {
    decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
    runId: input.runId,
    branchId: input.branchEvaluation.branchId,
    result: "archive-only",
    riskLevel: reasons.some((reason) => reason.code === "requires-author") ? "medium" : "low",
    score,
    reasons,
    requiredAuthorActions: [],
  };
  emitVerdictForDecision(acceptDecision);
  return acceptDecision;
}
