import { makeEventId } from "../../domain/events";
import type { MetaphysicsFrame } from "../../domain/metaphysics";
import type { CandidateAction } from "../../metaphysics/prior";
import { normalizeWeights, scoreCandidates } from "../../metaphysics/prior";

import type { BranchesPhaseResult, TickContext } from "../types";

export async function runBranchesPhase(
  ctx: TickContext,
  frame: MetaphysicsFrame,
  candidates: CandidateAction[],
): Promise<BranchesPhaseResult> {
  if (candidates.length === 0) {
    throw new Error("branches phase: no candidate actions to score");
  }

  const scored = scoreCandidates(candidates, frame);
  const distribution = normalizeWeights(scored);
  const chosen = scored[0]; // top-weighted; engine could swap to weighted sample later

  ctx.bus.emit({
    id: makeEventId({ subsystem: "branches", runId: ctx.runId, phase: "branches", sourceRef: "scored" }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "branches",
    severity: "ambient",
    status: "succeeded",
    phase: "branches",
    verb: "分流",
    subject: "本次分支",
    summary: `${chosen.candidate.action} (权重 ${chosen.weight.toFixed(2)})`,
    refs: {
      candidates: scored.length,
      distribution: distribution.map((d) => ({
        candidateId: d.candidate.candidateId,
        probability: Number(d.probability.toFixed(3)),
      })),
      contributingInfluences: chosen.contributingInfluences,
      explain: chosen.explain,
    },
  });

  return { scored, chosen };
}
