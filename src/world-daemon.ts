import type { StageDirective } from "./domain";
import { WorldHistoryEngine } from "./engine";
import { buildSimulationJob } from "./orchestration";
import { SimulationRunStore } from "./run-store";
import type { WorldDaemonConfig, WorldTickInput, WorldTickResult } from "./runtime-types";

export type WorldDaemonInput = {
  engine: WorldHistoryEngine;
  runStore: SimulationRunStore;
  config: WorldDaemonConfig;
};

export class WorldDaemon {
  constructor(private readonly input: WorldDaemonInput) {}

  async tick(input: WorldTickInput): Promise<WorldTickResult> {
    const directive = input.directive ?? this.defaultDirective();
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
      return {
        runId,
        status: "paused",
        canonDecision: highRiskDecision,
      };
    }

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

  private defaultDirective(): StageDirective {
    const parsed = this.input.engine.getParsedWorld();
    const first = parsed.characters[0]?.id;
    return {
      stageLabel: "世界自动推进",
      focusCharacterIds: first ? [first] : [],
    };
  }
}
