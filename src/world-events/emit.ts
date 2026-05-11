import type { WritingStage } from "../domain";

import { recordWorldEvent, makeEventId } from "./store";
import type {
  WorldEvent,
  WorldEventSeverity,
  WorldEventStatus,
} from "./types";
import {
  CANON_VERB,
  CONFIRM_FINAL_VERB,
  MEMORY_WRITE_VERB,
  PAUSE_VERB,
  PROMOTION_VERB,
  RUNTIME_TICK_VERB,
  stageVerb,
} from "./verbs";

type BaseContext = {
  runId?: string;
  chapterId?: string;
  sceneId?: string;
};

/**
 * Compose-pipeline stage transition. `status` controls severity:
 * started/progress = ambient, succeeded/failed/blocked = notable.
 */
export function emitComposeStage(
  ctx: BaseContext & {
    stage: WritingStage;
    status: WorldEventStatus;
    summary: string;
    refs?: Record<string, unknown>;
  },
): void {
  const severity: WorldEventSeverity =
    ctx.status === "started" || ctx.status === "progress" ? "ambient" : "notable";
  const id = makeEventId({
    subsystem: "compose",
    runId: ctx.runId,
    phase: ctx.stage,
    sourceRef: ctx.status,
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    sceneId: ctx.sceneId,
    subsystem: "compose",
    severity,
    phase: ctx.stage,
    verb: stageVerb(ctx.stage),
    subject: "本章",
    summary: ctx.summary,
    refs: ctx.refs,
    status: ctx.status,
  });
}

/**
 * Confirm-final cascade summary. Emitted after writing/confirm-final
 * succeeds; consumed by InscriptionReceipt to aggregate the 4-line
 * branch/memory/atlas/canon view.
 */
export function emitConfirmFinalCascade(
  ctx: BaseContext & {
    summary: string;
    refs?: Record<string, unknown>;
  },
): void {
  const id = makeEventId({
    subsystem: "compose",
    runId: ctx.runId,
    phase: "confirm-final",
    sourceRef: String(Date.now()),
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    sceneId: ctx.sceneId,
    subsystem: "compose",
    severity: "notable",
    phase: "confirm-final",
    verb: CONFIRM_FINAL_VERB,
    subject: "本章",
    summary: ctx.summary,
    refs: ctx.refs,
    status: "succeeded",
  });
}

export function emitCanonVerdict(
  ctx: BaseContext & {
    verdict: "accepted" | "rejected" | "paused-on-risk";
    summary: string;
    verdictId?: string;
    refs?: Record<string, unknown>;
  },
): void {
  const severity: WorldEventSeverity =
    ctx.verdict === "accepted" ? "notable" : "decision-required";
  const status: WorldEventStatus =
    ctx.verdict === "accepted"
      ? "succeeded"
      : ctx.verdict === "rejected"
        ? "failed"
        : "blocked";
  const id = makeEventId({
    subsystem: "canon",
    runId: ctx.runId,
    phase: "verdict",
    sourceRef: ctx.verdictId ?? `${ctx.verdict}-${Date.now()}`,
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    sceneId: ctx.sceneId,
    subsystem: "canon",
    severity,
    phase: "verdict",
    verb: CANON_VERB,
    subject: "正史",
    summary: ctx.summary,
    refs: ctx.refs,
    status,
  });
}

export function emitRuntimeTick(
  ctx: BaseContext & {
    phase: "started" | "succeeded" | "failed";
    tickIndex?: number;
    summary: string;
    refs?: Record<string, unknown>;
  },
): void {
  const severity: WorldEventSeverity =
    ctx.phase === "started" ? "ambient" : "notable";
  const status: WorldEventStatus =
    ctx.phase === "started"
      ? "started"
      : ctx.phase === "succeeded"
        ? "succeeded"
        : "failed";
  const id = makeEventId({
    subsystem: "runtime",
    runId: ctx.runId,
    phase: `tick-${ctx.tickIndex ?? "_"}`,
    sourceRef: ctx.phase,
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    sceneId: ctx.sceneId,
    subsystem: "runtime",
    severity,
    phase: `tick-${ctx.tickIndex ?? 0}`,
    verb: RUNTIME_TICK_VERB,
    subject: "世界",
    summary: ctx.summary,
    refs: ctx.refs,
    status,
  });
}

export function emitPause(
  ctx: BaseContext & {
    reason: string;
    severity?: "notable" | "decision-required";
    refs?: Record<string, unknown>;
  },
): void {
  const id = makeEventId({
    subsystem: "pause",
    runId: ctx.runId,
    phase: "pause",
    sourceRef: ctx.reason,
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    subsystem: "pause",
    severity: ctx.severity ?? "notable",
    phase: "pause",
    verb: PAUSE_VERB,
    subject: "世界",
    summary: ctx.reason,
    refs: ctx.refs,
    status: "blocked",
  });
}

export function emitMemoryWrite(
  ctx: BaseContext & {
    count: number;
    breakdown?: string;
    refs?: Record<string, unknown>;
  },
): void {
  const summary = ctx.breakdown
    ? `已写入 ${ctx.count} 条记忆（${ctx.breakdown}）`
    : `已写入 ${ctx.count} 条记忆`;
  const id = makeEventId({
    subsystem: "memory",
    runId: ctx.runId,
    phase: "commit",
    sourceRef: String(Date.now()),
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    sceneId: ctx.sceneId,
    subsystem: "memory",
    severity: "notable",
    phase: "commit",
    verb: MEMORY_WRITE_VERB,
    subject: "记忆",
    summary,
    refs: ctx.refs,
    status: "succeeded",
  });
}

export function emitPromotion(
  ctx: BaseContext & {
    branchId: string;
    promotedStageId?: string;
    refs?: Record<string, unknown>;
  },
): void {
  const id = makeEventId({
    subsystem: "promotion",
    runId: ctx.runId,
    phase: "promote",
    sourceRef: ctx.branchId,
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    subsystem: "promotion",
    severity: "notable",
    phase: "promote",
    verb: PROMOTION_VERB,
    subject: ctx.branchId,
    summary: `分支 ${ctx.branchId} 扶正为正史`,
    refs: { ...ctx.refs, promotedStageId: ctx.promotedStageId },
    status: "succeeded",
  });
}

export function emitSimulationStep(
  ctx: BaseContext & {
    stepIndex: number;
    summary: string;
    refs?: Record<string, unknown>;
  },
): void {
  const id = makeEventId({
    subsystem: "runtime",
    runId: ctx.runId,
    phase: `step-${ctx.stepIndex}`,
    sourceRef: "step",
  });
  recordWorldEvent({
    id,
    ts: Date.now(),
    chapterId: ctx.chapterId,
    runId: ctx.runId,
    subsystem: "runtime",
    severity: "ambient",
    phase: `step-${ctx.stepIndex}`,
    verb: RUNTIME_TICK_VERB,
    subject: "simulation",
    summary: ctx.summary,
    refs: ctx.refs,
    status: "progress",
  });
}

export { recordWorldEvent };
export type { WorldEvent };
