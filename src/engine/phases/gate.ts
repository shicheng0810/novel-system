import { evaluateAnchorViolations, riskFromViolations } from "../../domain/canon";
import type { CanonGateDecision } from "../../domain/canon";
import { makeEventId } from "../../domain/events";
import type { ScoredCandidate } from "../../metaphysics/prior";

import { applyCandidateToSnapshot } from "./commit";
import type { GatePhaseResult, TickContext } from "../types";

export async function runGatePhase(
  ctx: TickContext,
  chosen: ScoredCandidate,
): Promise<GatePhaseResult> {
  // Project the candidate onto a draft snapshot, then evaluate anchors
  // against it. We don't mutate ctx.snapshot here — commit phase does that.
  const draft = applyCandidateToSnapshot(ctx.snapshot, chosen, /* dryRun */ true);
  const violations = evaluateAnchorViolations(ctx.parsed, draft);
  const risk = riskFromViolations(violations);

  let result: CanonGateDecision["result"] = "promote";
  const requiredAuthorActions: CanonGateDecision["requiredAuthorActions"] = [];
  if (risk === "high") {
    result = "ask-author";
    requiredAuthorActions.push("accept", "reject", "revise-directive");
  } else if (risk === "medium") {
    // medium-risk + low-weight branch → also ask author
    if (chosen.weight < 0.4) {
      result = "ask-author";
      requiredAuthorActions.push("accept", "archive");
    } else {
      result = "archive-only";
      requiredAuthorActions.push("accept", "archive");
    }
  }

  const decision: CanonGateDecision = {
    decisionId: `${ctx.runId}-canon`,
    result,
    riskLevel: risk,
    reasons: violations.map((v) => ({
      severity: v.severity === "error" ? "error" : "warning",
      anchorId: v.anchorField,
      message: v.message,
    })),
    requiredAuthorActions,
  };

  ctx.bus.emit({
    id: makeEventId({ subsystem: "gate", runId: ctx.runId, phase: "gate", sourceRef: result }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "gate",
    severity: result === "ask-author" ? "decision-required" : "notable",
    status: result === "ask-author" ? "blocked" : "succeeded",
    phase: "gate",
    verb: "裁决",
    subject: chosen.candidate.action,
    summary: `${result} (risk=${risk}, ${violations.length} 锚点违规)`,
    refs: { violationCount: violations.length, requiredAuthorActions },
  });

  return { decision };
}
