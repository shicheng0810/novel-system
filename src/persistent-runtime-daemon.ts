import type { StageDirective } from "./domain";
import { NovelRuntimeKernel } from "./novel-runtime-kernel";
import type { RuntimeDaemonSnapshot, RuntimeDaemonStartRequest, WorldTickResult } from "./runtime-types";
import { emitPause, emitRuntimeTick } from "./world-events/emit";

export type PersistentRuntimeDaemonInput = {
  kernel: NovelRuntimeKernel;
  defaultDirective: StageDirective;
  tickDelayMs?: number;
  onTickResult?: (result: WorldTickResult, directive: StageDirective) => Promise<void> | void;
};

function cloneSnapshot(snapshot: RuntimeDaemonSnapshot): RuntimeDaemonSnapshot {
  return {
    ...snapshot,
    runIds: [...snapshot.runIds],
  };
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function directiveForTick(base: StageDirective, tickNumber: number, targetTicks: number): StageDirective {
  return {
    ...base,
    focusCharacterIds: [...base.focusCharacterIds],
    stageLabel: targetTicks > 1 ? `${base.stageLabel}·${tickNumber}` : base.stageLabel,
    qimenOverride: base.qimenOverride ? { ...base.qimenOverride } : undefined,
  };
}

export class PersistentRuntimeDaemon {
  private snapshotValue: RuntimeDaemonSnapshot = {
    active: false,
    paused: false,
    failed: false,
    completed: false,
    completedTicks: 0,
    targetTicks: 0,
    runIds: [],
  };
  private runPromise: Promise<void> = Promise.resolve();
  private lastRequest?: RuntimeDaemonStartRequest;
  private pauseRequested = false;

  constructor(private readonly input: PersistentRuntimeDaemonInput) {}

  start(request: RuntimeDaemonStartRequest): RuntimeDaemonSnapshot {
    if (this.snapshotValue.active) {
      return this.status();
    }

    const targetTicks = Math.max(1, Math.floor(request.targetTicks));
    this.lastRequest = {
      ...request,
      targetTicks,
      directive: request.directive ? directiveForTick(request.directive, 1, 1) : undefined,
    };
    this.pauseRequested = false;
    this.snapshotValue = {
      active: true,
      paused: false,
      failed: false,
      completed: false,
      completedTicks: 0,
      targetTicks,
      runIds: [],
      lastStageLabel: request.directive?.stageLabel ?? this.input.defaultDirective.stageLabel,
    };
    this.runPromise = this.runLoop({ ...request, targetTicks });
    return this.status();
  }

  pause(): RuntimeDaemonSnapshot {
    if (this.snapshotValue.active) {
      this.pauseRequested = true;
      // Per review · L: flip active=false immediately so callers using
      // (active && !paused) as "actually running" don't see the transient
      // both-true state. The runLoop verifies pauseRequested at the next
      // tick boundary and exits cleanly.
      this.snapshotValue = {
        ...this.snapshotValue,
        active: false,
        paused: true,
        pauseReason: "author-paused",
      };
    }
    return this.status();
  }

  resume(): RuntimeDaemonSnapshot {
    if (!this.snapshotValue.paused || !this.lastRequest) {
      return this.status();
    }
    const remainingTicks = this.snapshotValue.targetTicks - this.snapshotValue.completedTicks;
    if (remainingTicks <= 0) {
      return this.status();
    }
    const previous = this.snapshotValue;
    this.pauseRequested = false;
    this.snapshotValue = {
      ...previous,
      active: true,
      paused: false,
      failed: false,
      completed: false,
      pauseReason: undefined,
      error: undefined,
    };
    emitRuntimeTick({
      runId: previous.lastRunId,
      phase: "started",
      summary: "daemon resumed",
    });
    this.runPromise = this.runLoop(this.lastRequest, previous.completedTicks);
    return this.status();
  }

  status(): RuntimeDaemonSnapshot {
    return cloneSnapshot(this.snapshotValue);
  }

  async waitForIdle(): Promise<RuntimeDaemonSnapshot> {
    await this.runPromise;
    return this.status();
  }

  private async runLoop(request: RuntimeDaemonStartRequest, completedOffset = 0): Promise<void> {
    const targetTicks = Math.max(1, Math.floor(request.targetTicks));
    const baseDirective = request.directive ?? this.input.defaultDirective;
    const tickDelayMs = request.tickDelayMs ?? this.input.tickDelayMs ?? 0;

    try {
      for (let index = completedOffset; index < targetTicks; index += 1) {
        if (this.pauseRequested) {
          this.snapshotValue = {
            ...this.snapshotValue,
            active: false,
            paused: true,
            pauseReason: this.snapshotValue.pauseReason ?? "author-paused",
          };
          return;
        }

        const directive = directiveForTick(baseDirective, index + 1, targetTicks);
        this.snapshotValue = {
          ...this.snapshotValue,
          lastStageLabel: directive.stageLabel,
        };
        const result = await this.input.kernel.tick({
          reason: request.reason,
          requestedBy: request.requestedBy,
          directive,
        });
        await this.input.onTickResult?.(result, directive);
        const runIds = result.runId ? [...this.snapshotValue.runIds, result.runId] : [...this.snapshotValue.runIds];
        this.snapshotValue = {
          ...this.snapshotValue,
          runIds,
          lastRunId: result.runId,
        };

        if (result.status === "paused") {
          this.snapshotValue = {
            ...this.snapshotValue,
            active: false,
            paused: true,
            pauseReason: `CanonGate paused: ${result.canonDecision?.result ?? "author action required"}`,
          };
          emitPause({
            runId: result.runId,
            reason: this.snapshotValue.pauseReason ?? "daemon paused",
            severity: "decision-required",
          });
          return;
        }

        if (result.status === "failed") {
          this.snapshotValue = {
            ...this.snapshotValue,
            active: false,
            failed: true,
            error: "world tick failed",
          };
          emitRuntimeTick({
            runId: result.runId,
            phase: "failed",
            tickIndex: index + 1,
            summary: "world tick failed",
          });
          return;
        }

        this.snapshotValue = {
          ...this.snapshotValue,
          completedTicks: this.snapshotValue.completedTicks + 1,
        };
        await sleep(tickDelayMs);
      }

      this.snapshotValue = {
        ...this.snapshotValue,
        active: false,
        completed: this.snapshotValue.completedTicks >= targetTicks,
      };
      // Per review · M (lastRequest never cleared): drop on terminal states
      // so a subsequent resume() returns no-op rather than re-running the
      // request that just finished.
      if (this.snapshotValue.completed) this.lastRequest = undefined;
    } catch (error) {
      this.snapshotValue = {
        ...this.snapshotValue,
        active: false,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      };
      // Drop lastRequest on failure too — re-running a failed directive
      // without operator intervention is rarely what callers want.
      this.lastRequest = undefined;
    }
  }
}
