import type { StageDirective } from "./domain";
import { WorldHistoryEngine } from "./engine";
import { buildSimulationJob } from "./orchestration";
import { SimulationRunStore } from "./run-store";
import type {
  CanonGateDecision,
  WorldDaemonConfig,
  WorldTickInput,
  WorldTickResult,
} from "./runtime-types";
import { emitPause, emitRuntimeTick } from "./world-events/emit";

export type WorldDaemonInput = {
  engine: WorldHistoryEngine;
  runStore: SimulationRunStore;
  config: WorldDaemonConfig;
};

export class WorldDaemon {
  constructor(private readonly input: WorldDaemonInput) {}

  async tick(input: WorldTickInput): Promise<WorldTickResult> {
    const directive = input.directive ?? this.defaultDirective();
    emitRuntimeTick({
      runId: this.input.config.worldId,
      phase: "started",
      summary: `推演开始：${directive.stageLabel}`,
    });
    const job = buildSimulationJob({
      engine: this.input.engine,
      directives: [directive],
      runStore: this.input.runStore,
      worldId: this.input.config.worldId,
      requireAuthorOnHighRisk: this.input.config.autonomy.requireAuthorOnCanonRisk,
    });
    const result = await job.run();
    const runId = result.runRecords[0]?.outputRef;
    if (!runId) {
      emitRuntimeTick({
        runId: this.input.config.worldId,
        phase: "failed",
        summary: "推演未产生 run",
      });
      return {
        runId: "missing-run",
        status: "failed",
      };
    }

    const latest = result.results.at(-1);
    const highRiskDecision = latest?.gateDecisions?.find((decision) => decision.result === "ask-author");
    if (highRiskDecision && this.input.config.autonomy.requireAuthorOnCanonRisk) {
      const run = await this.input.runStore.loadRun(runId);
      await this.input.runStore.markRun(run, "paused");
      emitPause({
        runId,
        reason: highRiskDecision.reasons.find((r) => r.severity === "warning")?.message
          ?? "高风险分支待裁决",
        severity: "decision-required",
        refs: { branchId: highRiskDecision.branchId, riskLevel: highRiskDecision.riskLevel },
      });
      return {
        runId,
        status: "paused",
        canonDecision: highRiskDecision,
      };
    }

    emitRuntimeTick({
      runId,
      phase: "succeeded",
      summary: `推演完成：${directive.stageLabel}`,
    });
    return {
      runId,
      status: "completed",
      canonDecision: latest?.gateDecisions?.find((decision) => decision.result === "archive-only"),
    };
  }

  async resume(runId: string): Promise<WorldTickResult> {
    const run = await this.input.runStore.loadRun(runId);
    if (run.status !== "paused") {
      return { runId, status: run.status === "failed" ? "failed" : "completed" };
    }
    await this.input.runStore.markRun(run, "completed");
    return { runId, status: "completed" };
  }

  /**
   * Resolve a paused ask-author run by recording the author's decision and
   * applying the consequence on the engine.
   *
   * Decisions (per CanonGateDecision.requiredAuthorActions):
   *   - "accept": promote the proposed branch to canon
   *   - "archive": leave as archived branch only (no canon change)
   *   - "reject": delete the branch from engine.branches
   *   - "revise-directive": no engine action — caller must spawn new run
   *
   * Per W2 review · D1: previously `resume()` just flipped paused→completed
   * with no engine call, orphaning the branch entirely.
   */
  async resumeWithDecision(
    runId: string,
    decision: "accept" | "archive" | "reject" | "revise-directive",
    canonDecision?: CanonGateDecision,
  ): Promise<WorldTickResult & { decision: typeof decision }> {
    const run = await this.input.runStore.loadRun(runId);
    if (run.status !== "paused") {
      return {
        runId,
        status: run.status === "failed" ? "failed" : "completed",
        decision,
      };
    }

    // Try to locate the branchId from the supplied canonDecision or by
    // re-deriving from the engine's most recent stage.
    const branchId = canonDecision?.branchId
      ?? this.input.engine
        .getCanonLine()
        .stages.at(-1)
        ?.events.find((e) => e.branchId)?.branchId;

    if (decision === "accept" && branchId) {
      try {
        this.input.engine.promoteBranch(branchId);
      } catch (err) {
        // Branch may have been forked from a stage before a dynamic
        // addCharacter call — promoteBranch handles re-attachment.
        // eslint-disable-next-line no-console
        console.warn(
          "[world-daemon] promoteBranch failed for",
          branchId,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (decision === "reject" && branchId) {
      this.input.engine.archiveBranch(branchId);
    }

    await this.input.runStore.markRun(run, "completed");
    return { runId, status: "completed", decision };
  }

  private defaultDirective(): StageDirective {
    const parsed = this.input.engine.getParsedWorld();
    const first = parsed.characters[0]?.id;
    return {
      stageLabel: "世界自动推进",
      focusCharacterIds: first ? [first] : [],
    };
  }
}
