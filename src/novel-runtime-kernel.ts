import { ContextCache } from "./context-cache";
import { buildContextPack, type ContextPack } from "./context-pack";
import { DEFAULT_DEEPSEEK_PROFILE } from "./deepseek-profile";
import type { StageDirective } from "./domain";
import { WorldHistoryEngine } from "./engine";
import { NarrativeSession, type NarrativeSessionSnapshot } from "./narrative-session";
import { SimulationRunStore } from "./run-store";
import { RuntimeTrace } from "./runtime-trace";
import { NovelRuntimeWorker } from "./runtime-worker";
import type { WorldDaemonConfig, WorldTickInput, WorldTickResult } from "./runtime-types";
import { WorldDaemon } from "./world-daemon";

export type NovelRuntimeKernelInput = {
  engine: WorldHistoryEngine;
  runStore: SimulationRunStore;
  config: WorldDaemonConfig;
  session?: NarrativeSession;
  cache?: ContextCache;
  worker?: NovelRuntimeWorker;
};

export class NovelRuntimeKernel {
  private readonly daemon: WorldDaemon;
  private readonly session: NarrativeSession;
  private readonly cache: ContextCache;
  private readonly worker: NovelRuntimeWorker;

  constructor(private readonly input: NovelRuntimeKernelInput) {
    this.daemon = new WorldDaemon({
      engine: input.engine,
      runStore: input.runStore,
      config: input.config,
    });
    this.session = input.session ?? new NarrativeSession();
    this.cache = input.cache ?? new ContextCache({ rootDir: input.config.storage.runRoot });
    this.worker = input.worker ?? new NovelRuntimeWorker();
  }

  tick(input: WorldTickInput): Promise<WorldTickResult> {
    return this.worker.enqueue("world-tick", async () => {
      const trace = new RuntimeTrace();
      const pack = this.buildPack(input.directive ?? this.defaultDirective());
      trace.event("context-pack", `built context pack ${pack.packId}`, {
        packId: pack.packId,
        blockHashes: pack.blockHashes,
        tokenEstimate: pack.tokenEstimate,
      });

      const cacheMatch = await this.cache.findReusablePrefix(pack.blockHashes);
      if (cacheMatch) {
        trace.event("cache-hit", `reused ${cacheMatch.matchedBlockCount} context blocks`, {
          packId: cacheMatch.packId,
          matchedBlockCount: cacheMatch.matchedBlockCount,
        });
      } else {
        trace.event("cache-miss", "no reusable context prefix");
      }

      const sync = this.session.sync(pack);
      trace.event("session-sync", `session ${sync.mode}`, sync);
      await this.cache.writeSnapshot(pack, sync.mode === "reuse" ? "continued" : "cold");

      const result = await this.daemon.tick(input);
      trace.event("world-tick", `world tick ${result.status}`, result);
      if (result.canonDecision) {
        trace.event("canon-gate", `CanonGate ${result.canonDecision.result}`, result.canonDecision);
      }
      await this.attachRuntimeArtifacts(result.runId, pack, sync, trace);
      return result;
    });
  }

  resume(runId: string): Promise<WorldTickResult> {
    return this.worker.enqueue("world-resume", async () => this.daemon.resume(runId));
  }

  inspectSession(): NarrativeSessionSnapshot {
    return this.session.snapshot();
  }

  private buildPack(directive: StageDirective): ContextPack {
    const parsed = this.input.engine.getParsedWorld();
    const canonLine = this.input.engine.getCanonLine();
    const latestStage = canonLine.stages.at(-1);
    return buildContextPack({
      worldId: this.input.config.worldId,
      lineId: canonLine.lineId,
      directive,
      canon: {
        lineId: canonLine.lineId,
        stageIds: canonLine.stages.map((stage) => stage.id),
        latestStage: latestStage
          ? {
              stageId: latestStage.id,
              stageLabel: latestStage.stageLabel,
              eventTitles: latestStage.events.map((event) => event.title),
            }
          : undefined,
      },
      memory: {
        characterAnchors: parsed.characterAnchors,
        relationshipAnchors: parsed.relationshipAnchors,
      },
      metaphysics: latestStage
        ? {
            qimenContext: latestStage.qimenContext,
            qimenModifier: latestStage.qimenModifier,
            explanation: latestStage.metaphysicsExplanation,
          }
        : directive.qimenOverride
          ? { qimenOverride: directive.qimenOverride }
          : undefined,
      modelProfile: DEFAULT_DEEPSEEK_PROFILE,
    });
  }

  private async attachRuntimeArtifacts(
    runId: string,
    pack: ContextPack,
    sync: ReturnType<NarrativeSession["sync"]>,
    trace: RuntimeTrace,
  ): Promise<void> {
    const run = await this.input.runStore.loadRun(runId);
    await this.input.runStore.writeArtifact(run, {
      refId: "runtime.context-sync",
      relativePath: "runtime/context-sync.json",
      kind: "json",
      value: {
        packId: pack.packId,
        blockHashes: pack.blockHashes,
        tokenEstimate: pack.tokenEstimate,
        sync,
      },
    });
    await trace.writeArtifacts(this.input.runStore, run);
  }

  private defaultDirective(): StageDirective {
    const first = this.input.engine.getParsedWorld().characters[0]?.id;
    return {
      stageLabel: "世界自动推进",
      focusCharacterIds: first ? [first] : [],
    };
  }
}
