// Layer 4 · single-class Daemon.
// Runs a tick loop using the Phase 4 engine. Replaces the 3-layer (WorldDaemon
// → NovelRuntimeKernel → PersistentRuntimeDaemon) stack with one class.
//
// pause / resume / step / status emit ambient runtime events.
// Daemon is singleton-ish per (db, threadId): the engine acquires a lock.

import { makeEventId } from "../domain/events";
import type { StageDirective } from "../domain/world";
import type { NarrativeLens } from "../domain/narrative";
import type { Db } from "../data/db";
import { Director } from "../director/director";
import type { EngineDeps } from "../engine/tick";
import { runTick } from "../engine/tick";
import type { TickResult } from "../engine/types";
import type { EventBus } from "../services/event-bus";

export type DaemonStartRequest = {
  worldId: string;
  threadId: string;
  targetTicks: number;
  composeEvery?: number;
  composeLens?: NarrativeLens;
  reason?: string;
  requestedBy?: string;
  tickDelayMs?: number;
  initialDirective?: StageDirective;
};

export type DaemonStatus = {
  active: boolean;
  paused: boolean;
  completed: boolean;
  failed: boolean;
  threadId?: string;
  worldId?: string;
  completedTicks: number;
  targetTicks: number;
  runIds: string[];
  lastRunId?: string;
  lastStageLabel?: string;
  pauseReason?: string;
  error?: string;
};

const ACTIVE_DAEMONS = new WeakMap<Db, Daemon>();

export class Daemon {
  private status: DaemonStatus = {
    active: false,
    paused: false,
    completed: false,
    failed: false,
    completedTicks: 0,
    targetTicks: 0,
    runIds: [],
  };
  private loopPromise: Promise<void> = Promise.resolve();
  private pauseRequested = false;
  private currentRequest?: DaemonStartRequest;
  private director?: Director;

  constructor(private readonly deps: EngineDeps) {
    const existing = ACTIVE_DAEMONS.get(deps.db);
    if (existing) {
      throw new Error("a Daemon already exists for this database; reuse it instead of constructing a second one");
    }
    ACTIVE_DAEMONS.set(deps.db, this);
  }

  start(request: DaemonStartRequest): DaemonStatus {
    if (this.status.active) return this.getStatus();
    const targetTicks = Math.max(1, Math.floor(request.targetTicks));
    this.currentRequest = { ...request, targetTicks };
    this.pauseRequested = false;
    this.status = {
      active: true,
      paused: false,
      completed: false,
      failed: false,
      threadId: request.threadId,
      worldId: request.worldId,
      completedTicks: 0,
      targetTicks,
      runIds: [],
    };

    const loaded = this.deps.worldStore.load(request.worldId);
    const parsed = loaded?.parsed ?? {
      worldSpec: { genre: "", timeScale: "", cultivationSystem: "", worldRules: [], factions: [], locations: [] },
      characters: [],
      relationships: [],
      characterAnchors: [],
      relationshipAnchors: [],
    };
    this.director = new Director(
      {
        parsedFn: () => this.deps.worldStore.load(request.worldId)?.parsed ?? parsed,
        snapshotFn: () => this.deps.worldStore.load(request.worldId)!.snapshot,
      },
      { totalTicks: targetTicks, composeEvery: request.composeEvery ?? 3 },
    );

    emitLifecycle(this.deps.bus, "started", request.threadId, request.worldId, `daemon started · ${targetTicks} ticks`);
    this.loopPromise = this.runLoop(this.currentRequest);
    return this.getStatus();
  }

  pause(): DaemonStatus {
    if (!this.status.active) return this.getStatus();
    this.pauseRequested = true;
    this.status = { ...this.status, active: false, paused: true, pauseReason: "author-paused" };
    emitLifecycle(this.deps.bus, "blocked", this.status.threadId, this.status.worldId, "daemon paused");
    return this.getStatus();
  }

  resume(): DaemonStatus {
    if (!this.status.paused || !this.currentRequest) return this.getStatus();
    if (this.status.completedTicks >= this.status.targetTicks) return this.getStatus();
    this.pauseRequested = false;
    this.status = {
      ...this.status,
      active: true,
      paused: false,
      pauseReason: undefined,
      error: undefined,
    };
    emitLifecycle(this.deps.bus, "started", this.status.threadId, this.status.worldId, "daemon resumed");
    this.loopPromise = this.runLoop(this.currentRequest, this.status.completedTicks);
    return this.getStatus();
  }

  async step(directive?: StageDirective, lens?: NarrativeLens): Promise<TickResult> {
    if (this.status.active) {
      throw new Error("Daemon is running a multi-tick loop; pause before stepping manually.");
    }
    if (!this.currentRequest && !directive) {
      throw new Error("step() requires either a prior start() or an explicit directive");
    }
    const base: DaemonStartRequest = this.currentRequest ?? {
      worldId: this.status.worldId ?? "default",
      threadId: this.status.threadId ?? "manual",
      targetTicks: 1,
      composeLens: lens,
      initialDirective: directive,
    };
    const tickIndex = this.status.completedTicks;
    const plan = this.director?.plan({ tickIndex, history: [] });
    const useDirective =
      directive ?? (plan ? this.director!.toDirective(plan) : base.initialDirective);
    if (!useDirective) throw new Error("step() could not derive a directive");
    const result = await runTick(this.deps, {
      worldId: base.worldId,
      threadId: base.threadId,
      tickIndex,
      directive: useDirective,
      compose: plan?.compose ?? false,
      lens: lens ?? base.composeLens,
    });
    this.recordResult(result);
    return result;
  }

  getStatus(): DaemonStatus {
    return { ...this.status, runIds: [...this.status.runIds] };
  }

  async waitForIdle(): Promise<DaemonStatus> {
    await this.loopPromise;
    return this.getStatus();
  }

  /**
   * Resume from on-disk state after a process restart. Looks up the latest
   * incomplete run on (threadId), and continues from the next tick index.
   */
  resumeFromCheckpoint(threadId: string): DaemonStatus | null {
    const stmt = this.deps.db.prepare(
      "SELECT tick_index, world_id, status, directive_json FROM runs WHERE thread_id = ? ORDER BY tick_index DESC LIMIT 1",
    );
    const lastRun = stmt.get(threadId) as
      | { tick_index: number; world_id: string; status: string; directive_json: string }
      | undefined;
    if (!lastRun) return null;
    this.status = {
      ...this.status,
      threadId,
      worldId: lastRun.world_id,
      completedTicks: lastRun.status === "completed" ? lastRun.tick_index + 1 : lastRun.tick_index,
      targetTicks: Math.max(this.status.targetTicks, lastRun.tick_index + 1),
    };
    return this.getStatus();
  }

  private async runLoop(request: DaemonStartRequest, completedOffset = 0): Promise<void> {
    const targetTicks = request.targetTicks;
    const delay = request.tickDelayMs ?? 0;

    try {
      for (let i = completedOffset; i < targetTicks; i += 1) {
        if (this.pauseRequested) {
          this.status = { ...this.status, active: false, paused: true, pauseReason: this.status.pauseReason ?? "author-paused" };
          return;
        }

        const plan = this.director!.plan({ tickIndex: i, history: [] });
        const directive = this.director!.toDirective(plan);
        const result = await runTick(this.deps, {
          worldId: request.worldId,
          threadId: request.threadId,
          tickIndex: i,
          directive,
          compose: plan.compose,
          lens: plan.compose ? request.composeLens : undefined,
        });
        this.recordResult(result);

        if (result.status === "paused") {
          this.status = {
            ...this.status,
            active: false,
            paused: true,
            pauseReason: `CanonGate paused: ${result.pauseReason ?? "decision required"}`,
          };
          emitLifecycle(this.deps.bus, "blocked", this.status.threadId, this.status.worldId, this.status.pauseReason ?? "");
          return;
        }
        if (result.status === "failed") {
          this.status = {
            ...this.status,
            active: false,
            failed: true,
            error: result.pauseReason ?? "tick failed",
          };
          emitLifecycle(this.deps.bus, "failed", this.status.threadId, this.status.worldId, this.status.error ?? "tick failed");
          return;
        }
        this.status = { ...this.status, completedTicks: this.status.completedTicks + 1 };
        if (delay > 0) await sleep(delay);
      }
      this.status = { ...this.status, active: false, completed: true };
      this.currentRequest = undefined;
      emitLifecycle(this.deps.bus, "succeeded", this.status.threadId, this.status.worldId, "daemon completed");
    } catch (err) {
      this.status = {
        ...this.status,
        active: false,
        failed: true,
        error: err instanceof Error ? err.message : String(err),
      };
      emitLifecycle(this.deps.bus, "failed", this.status.threadId, this.status.worldId, this.status.error ?? "loop crashed");
    }
  }

  private recordResult(result: TickResult): void {
    this.status = {
      ...this.status,
      runIds: result.runId ? [...this.status.runIds, result.runId] : this.status.runIds,
      lastRunId: result.runId,
      lastStageLabel: result.stage?.stageLabel,
    };
  }
}

function emitLifecycle(
  bus: EventBus,
  status: "started" | "succeeded" | "failed" | "blocked",
  threadId: string | undefined,
  worldId: string | undefined,
  summary: string,
): void {
  bus.emit({
    id: makeEventId({ subsystem: "runtime", sourceRef: `${threadId}-${status}-${Date.now()}` }),
    ts: Date.now(),
    worldId,
    subsystem: "runtime",
    severity: status === "blocked" ? "decision-required" : "ambient",
    status,
    verb: status === "blocked" ? "驻笔" : "推演",
    subject: threadId ?? "daemon",
    summary,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
