// Layer 3 · single tick orchestrator.
// Sequence: frame → agents → branches → gate → commit → (if compose)
// memory-read → blueprint → scene-cards → synthesize → review → inscribe.
// Each phase emits events; runs table records start/finish.

import type { Db } from "../data/db";
import { makeEventId } from "../domain/events";
import type { AgentRegistry } from "../agents/registry";
import type { EventBus } from "../services/event-bus";
import type { WorldStore } from "../services/world-store";
import type { MemoryService } from "../services/memory-service";
import type { AtlasService } from "../services/atlas-service";
import type { LLMProvider } from "../services/llm/types";

import { runFramePhase } from "./phases/frame";
import { runAgentsPhase } from "./phases/agents";
import { runBranchesPhase } from "./phases/branches";
import { runGatePhase } from "./phases/gate";
import { runCommitPhase } from "./phases/commit";
import { runComposePhases } from "./phases/compose";
import type { TickContext, TickRequest, TickResult } from "./types";

export type EngineDeps = {
  db: Db;
  bus: EventBus;
  worldStore: WorldStore;
  memory: MemoryService;
  atlas: AtlasService;
  registry: AgentRegistry;
  llm: LLMProvider;
};

const INSERT_RUN = `
  INSERT INTO runs(run_id, world_id, thread_id, tick_index, started_at, status, directive_json)
  VALUES (@runId, @worldId, @threadId, @tickIndex, @startedAt, 'running', @directive)
`;
const UPDATE_RUN = `
  UPDATE runs SET status = @status, finished_at = @finishedAt, result_json = @result
  WHERE run_id = @runId
`;
const INSERT_FRAME = `
  INSERT INTO metaphysics_frames(frame_id, run_id, world_id, stage_number, ts, frame_json)
  VALUES (@frameId, @runId, @worldId, @stageNumber, @ts, @frame)
  ON CONFLICT(frame_id) DO NOTHING
`;
const INSERT_CHAPTER = `
  INSERT INTO chapters(chapter_id, world_id, line_id, stage_id, status, lens_json, scenes_json, draft_text, review_json, created_at, updated_at)
  VALUES (@chapterId, @worldId, @lineId, @stageId, @status, @lens, @scenes, @text, @review, @createdAt, @updatedAt)
  ON CONFLICT(chapter_id) DO UPDATE SET
    status = excluded.status,
    scenes_json = excluded.scenes_json,
    draft_text = excluded.draft_text,
    review_json = excluded.review_json,
    updated_at = excluded.updated_at
`;

export async function runTick(
  deps: EngineDeps,
  request: TickRequest,
): Promise<TickResult> {
  const runId = `${request.worldId}-${request.threadId}-${request.tickIndex}-${Date.now()}`;
  deps.db.prepare(INSERT_RUN).run({
    runId,
    worldId: request.worldId,
    threadId: request.threadId,
    tickIndex: request.tickIndex,
    startedAt: Date.now(),
    directive: JSON.stringify(request.directive),
  });

  deps.bus.emit({
    id: makeEventId({ subsystem: "runtime", runId, sourceRef: "started" }),
    ts: Date.now(),
    worldId: request.worldId,
    runId,
    subsystem: "runtime",
    severity: "ambient",
    status: "started",
    verb: "推演",
    subject: request.directive.stageLabel,
    summary: `推演开始：${request.directive.stageLabel}`,
  });

  const loaded = deps.worldStore.load(request.worldId);
  if (!loaded) {
    return finishWithError(deps, runId, "world has not been applied (call applyDraft first)");
  }
  const ctx: TickContext = {
    request,
    runId,
    bus: deps.bus,
    worldStore: deps.worldStore,
    memory: deps.memory,
    atlas: deps.atlas,
    registry: deps.registry,
    llm: deps.llm,
    parsed: loaded.parsed,
    snapshot: loaded.snapshot,
  };

  const eventCountBefore = deps.bus.query({ runId, limit: 2000 }).length;

  try {
    const { frame } = await runFramePhase(ctx);
    deps.db.prepare(INSERT_FRAME).run({
      frameId: frame.frameId,
      runId,
      worldId: request.worldId,
      stageNumber: frame.stageNumber,
      ts: frame.ts,
      frame: JSON.stringify(frame),
    });

    const { candidates, reflections } = await runAgentsPhase(ctx, frame);
    if (candidates.length === 0) {
      return finishWithError(deps, runId, "no candidate actions produced by agents");
    }
    void reflections;

    const { chosen } = await runBranchesPhase(ctx, frame, candidates);
    const { decision } = await runGatePhase(ctx, chosen);

    if (decision.result === "ask-author") {
      finishRun(deps, runId, "paused", { decision });
      return {
        runId,
        status: "paused",
        pauseReason: decision.reasons[0]?.message ?? "decision required",
        decision,
        framesEmitted: 1,
        events: deps.bus.query({ runId, limit: 2000 }).length - eventCountBefore,
      };
    }

    const { stage } = await runCommitPhase(ctx, chosen);

    let chapterId: string | undefined;
    if (request.compose && request.lens) {
      const { draft } = await runComposePhases(ctx, chosen, request.lens);
      deps.db.prepare(INSERT_CHAPTER).run({
        chapterId: draft.chapterId,
        worldId: draft.worldId,
        lineId: draft.lineId,
        stageId: draft.stageId,
        status: draft.status,
        lens: JSON.stringify(draft.lens),
        scenes: JSON.stringify(draft.scenes),
        text: draft.text,
        review: draft.review ? JSON.stringify(draft.review) : null,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      });
      chapterId = draft.chapterId;
    }

    finishRun(deps, runId, "completed", { stageId: stage.stageId, chapterId });

    deps.bus.emit({
      id: makeEventId({ subsystem: "runtime", runId, sourceRef: "succeeded" }),
      ts: Date.now(),
      worldId: request.worldId,
      runId,
      subsystem: "runtime",
      severity: "ambient",
      status: "succeeded",
      verb: "推演",
      subject: stage.stageLabel,
      summary: `推演完成：${stage.stageLabel}`,
    });

    return {
      runId,
      status: "completed",
      stage,
      chapterId,
      decision,
      framesEmitted: 1,
      events: deps.bus.query({ runId, limit: 2000 }).length - eventCountBefore,
    };
  } catch (err) {
    return finishWithError(deps, runId, err instanceof Error ? err.message : String(err));
  }
}

function finishRun(
  deps: EngineDeps,
  runId: string,
  status: "completed" | "paused" | "failed",
  result: Record<string, unknown>,
): void {
  deps.db.prepare(UPDATE_RUN).run({
    runId,
    status,
    finishedAt: Date.now(),
    result: JSON.stringify(result),
  });
}

function finishWithError(deps: EngineDeps, runId: string, message: string): TickResult {
  finishRun(deps, runId, "failed", { error: message });
  deps.bus.emit({
    id: makeEventId({ subsystem: "runtime", runId, sourceRef: "failed" }),
    ts: Date.now(),
    runId,
    subsystem: "runtime",
    severity: "decision-required",
    status: "failed",
    verb: "推演",
    subject: "本次推演",
    summary: `推演失败：${message}`,
  });
  return {
    runId,
    status: "failed",
    pauseReason: message,
    framesEmitted: 0,
    events: 0,
  };
}
