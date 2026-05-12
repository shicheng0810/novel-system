import { makeEventId } from "../../domain/events";
import { buildFrame } from "../../metaphysics/frame";
import type { FramePhaseResult, TickContext } from "../types";

export async function runFramePhase(ctx: TickContext): Promise<FramePhaseResult> {
  ctx.bus.emit({
    id: makeEventId({ subsystem: "frame", runId: ctx.runId, phase: "frame", sourceRef: "started" }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "frame",
    severity: "ambient",
    status: "started",
    phase: "frame",
    verb: "起卦",
    subject: "本次推演",
    summary: `起卦：${ctx.request.directive.stageLabel}`,
  });

  const frame = buildFrame({
    runId: ctx.runId,
    worldId: ctx.request.worldId,
    stageNumber: ctx.snapshot.stageNumber + 1,
    parsed: ctx.parsed,
    directive: ctx.request.directive,
  });

  ctx.bus.emit({
    id: makeEventId({ subsystem: "frame", runId: ctx.runId, phase: "frame", sourceRef: "succeeded" }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "frame",
    severity: "ambient",
    status: "succeeded",
    phase: "frame",
    verb: "起卦",
    subject: "本次推演",
    summary: frame.explanation.summary,
    refs: { frameId: frame.frameId, qimenPattern: frame.qimenContext.pattern },
  });

  return { frame };
}
