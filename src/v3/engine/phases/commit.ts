import { makeEventId } from "../../domain/events";
import type { Stage, WorldSnapshot } from "../../domain/world";
import { cloneSnapshot } from "../../domain/world";
import type { ScoredCandidate } from "../../metaphysics/prior";
import type { CommitPhaseResult, TickContext } from "../types";

/**
 * Apply a chosen candidate to the snapshot. dryRun=true returns a clone for
 * gate evaluation without mutating the live snapshot. dryRun=false mutates.
 */
export function applyCandidateToSnapshot(
  snapshot: WorldSnapshot,
  chosen: ScoredCandidate,
  dryRun = false,
): WorldSnapshot {
  const target = dryRun ? cloneSnapshot(snapshot) : snapshot;
  const character = target.characters[chosen.candidate.characterId];
  if (character) {
    character.lastAction = chosen.candidate.action;
    character.notes = [...character.notes, chosen.candidate.action].slice(-10);
    const axes = chosen.candidate.axisHints ?? [];
    if (axes.includes("initiative") || axes.includes("rupture")) {
      character.pressure = Math.min(100, character.pressure + 12);
      character.progress = Math.min(100, character.progress + 8);
    } else if (axes.includes("delay") || axes.includes("discipline")) {
      character.pressure = Math.max(0, character.pressure - 4);
      character.progress = Math.min(100, character.progress + 3);
    } else {
      character.pressure = Math.min(100, character.pressure + 4);
      character.progress = Math.min(100, character.progress + 4);
    }
  }
  return target;
}

export async function runCommitPhase(
  ctx: TickContext,
  chosen: ScoredCandidate,
): Promise<CommitPhaseResult> {
  applyCandidateToSnapshot(ctx.snapshot, chosen, /* dryRun */ false);
  ctx.snapshot.stageNumber += 1;
  ctx.snapshot.stageId = `${ctx.runId}-stage`;

  const stage: Stage = {
    stageId: ctx.snapshot.stageId,
    worldId: ctx.request.worldId,
    lineId: "canon",
    stageNumber: ctx.snapshot.stageNumber,
    stageLabel: ctx.request.directive.stageLabel,
    ts: Date.now(),
    events: [
      {
        id: `${ctx.runId}-event`,
        stageId: ctx.snapshot.stageId,
        title: chosen.candidate.action,
        summary: chosen.candidate.action,
        participants: [chosen.candidate.characterId],
        tags: chosen.candidate.axisHints ?? [],
        stateChanges: [`pressure → ${ctx.snapshot.characters[chosen.candidate.characterId]?.pressure}`],
      },
    ],
    snapshot: cloneSnapshot(ctx.snapshot),
  };

  ctx.worldStore.appendStage(stage);
  ctx.worldStore.save(ctx.request.worldId, ctx.snapshot);

  ctx.bus.emit({
    id: makeEventId({ subsystem: "commit", runId: ctx.runId, phase: "commit", sourceRef: "done" }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "commit",
    severity: "notable",
    status: "succeeded",
    phase: "commit",
    verb: "落定",
    subject: stage.stageLabel,
    summary: `落定第 ${stage.stageNumber} 阶段`,
    refs: { stageId: stage.stageId, stageNumber: stage.stageNumber },
  });

  ctx.bus.emit({
    id: makeEventId({ subsystem: "promotion", runId: ctx.runId, sourceRef: stage.stageId }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "promotion",
    severity: "notable",
    status: "succeeded",
    verb: "扶正",
    subject: stage.stageLabel,
    summary: `分支 ${chosen.candidate.candidateId} 扶正为正史`,
    refs: { candidateId: chosen.candidate.candidateId, weight: chosen.weight },
  });

  return { stage };
}
