import {
  ChapterDraft,
  ChapterPlan,
  cloneValue,
  JobStageRun,
  NarrativeLens,
  NarrativeMemoryPack,
  ResumeCheckpoint,
  ReviewReport,
  RunRecord,
  SceneCard,
  StageDirective,
  StageResult,
  SimulationModelProvider,
  TimelineLine,
  WritingModelProvider,
  WritingProviderContext,
  WritingStage,
} from "./domain";
import { StoryMemoryStore } from "./memory";
import { SimulationRunStore } from "./run-store";
import {
  buildNarrativeSourcePack,
  assembleChapterDraft,
  draftNarrative,
  generateSceneCards,
  planChapter,
  reviewChapterDraft,
} from "./narrative";
import { WorldHistoryEngine } from "./engine";

const STAGE_ORDER: WritingStage[] = [
  "memory-read",
  "blueprint",
  "scene-expand",
  "synthesize",
  "critique",
  "memory-write",
];

function cloneCheckpoint(checkpoint: ResumeCheckpoint | undefined): ResumeCheckpoint | undefined {
  return checkpoint ? cloneValue(checkpoint) : undefined;
}

function stageIndex(stage: WritingStage | "complete"): number {
  if (stage === "complete") {
    return STAGE_ORDER.length - 1;
  }
  return STAGE_ORDER.indexOf(stage);
}

export class LocalWritingModelProvider implements WritingModelProvider {
  readonly name = "local-writing-provider";
  readonly modelName = "local-deterministic";

  async planChapter(context: WritingProviderContext): Promise<ChapterPlan> {
    return planChapter(context.sourcePack, context.lens);
  }

  async expandScenes(context: WritingProviderContext, plan: ChapterPlan): Promise<SceneCard[]> {
    return generateSceneCards(context.sourcePack, plan);
  }

  async synthesizeProse(
    context: WritingProviderContext,
    _plan: ChapterPlan,
    _sceneCards: SceneCard[],
  ): Promise<ChapterDraft> {
    const narrative = draftNarrative({
      line: context.line,
      lens: context.lens,
    });
    return {
      plan: narrative.plan,
      sceneDrafts: narrative.sceneDrafts,
      chapterText: narrative.chapterText,
      review: narrative.review,
      runRecords: narrative.runRecords,
    };
  }

  async critiqueChapter(context: WritingProviderContext, draft: ChapterDraft): Promise<ReviewReport> {
    return reviewChapterDraft(draft, context.sourcePack, context.lens);
  }

  async assembleChapter(context: WritingProviderContext, draft: ChapterDraft): Promise<ChapterDraft> {
    return assembleChapterDraft(draft, context.sourcePack, context.lens);
  }
}

type WritingJobState = {
  memoryPack?: NarrativeMemoryPack;
  sourcePack?: WritingProviderContext["sourcePack"];
  plan?: ChapterPlan;
  sceneCards?: SceneCard[];
  draft?: ChapterDraft;
  review?: ReviewReport;
};

function recordForStage(
  stage: WritingStage,
  provider: WritingModelProvider,
  summary: string,
  extras: Partial<RunRecord> = {},
): RunRecord {
  return {
    stage,
      providerName: provider.name,
    modelName: provider.modelName,
    summary,
    ...extras,
  };
}

export class WritingJob {
  private readonly runRecords: RunRecord[] = [];
  private readonly state: WritingJobState = {};
  private checkpoint?: ResumeCheckpoint;

  constructor(
    private readonly input: {
      line: TimelineLine;
      lens: NarrativeLens;
      provider: WritingModelProvider;
      memoryStore: StoryMemoryStore;
    },
  ) {}

  private async providerContext(): Promise<WritingProviderContext> {
    const memoryPack =
      this.state.memoryPack ??
      (await this.input.memoryStore.readMemoryPack({
        lineId: this.input.line.lineId,
        focusCharacterIds: this.input.lens.focusCharacterIds,
        stageIds: this.input.lens.stageRange,
      }));
    this.state.memoryPack = memoryPack;

    const sourcePack =
      this.state.sourcePack ??
      buildNarrativeSourcePack({
        line: this.input.line,
        lens: this.input.lens,
      });
    this.state.sourcePack = sourcePack;

    return {
      line: this.input.line,
      lens: this.input.lens,
      sourcePack,
      memoryPack,
    };
  }

  private saveCheckpoint(stage: WritingStage) {
    this.checkpoint = {
      completedStages: [...new Set(this.runRecords.map((record) => record.stage))],
      state: {
        stage,
        plan: this.state.plan,
        sceneCards: this.state.sceneCards,
        draft: this.state.draft,
        review: this.state.review,
      },
    };
  }

  private hydrateFromCheckpoint(checkpoint: ResumeCheckpoint): void {
    this.state.plan = checkpoint.state.plan as ChapterPlan | undefined;
    this.state.sceneCards = checkpoint.state.sceneCards as SceneCard[] | undefined;
    this.state.draft = checkpoint.state.draft as ChapterDraft | undefined;
    this.state.review = checkpoint.state.review as ReviewReport | undefined;
    this.checkpoint = cloneCheckpoint(checkpoint);
  }

  private async executeStage(stage: WritingStage): Promise<void> {
    const context = await this.providerContext();

    switch (stage) {
      case "memory-read": {
        this.runRecords.push(
          recordForStage(stage, this.input.provider, `已读取 ${context.memoryPack.factEntries.length} 条事实记忆`),
        );
        this.saveCheckpoint(stage);
        return;
      }
      case "blueprint": {
        this.state.plan = await this.input.provider.planChapter(context);
        this.runRecords.push(
          recordForStage(stage, this.input.provider, `已生成章节蓝图：${this.state.plan.chapterGoal}`),
        );
        this.saveCheckpoint(stage);
        return;
      }
      case "scene-expand": {
        this.state.plan ??= await this.input.provider.planChapter(context);
        this.state.sceneCards = await this.input.provider.expandScenes(context, this.state.plan);
        this.runRecords.push(
          recordForStage(stage, this.input.provider, `已展开 ${this.state.sceneCards.length} 个场景`),
        );
        this.saveCheckpoint(stage);
        return;
      }
      case "synthesize": {
        this.state.draft = await this.input.provider.synthesizeProse(
          context,
          this.state.plan ?? (await this.input.provider.planChapter(context)),
          this.state.sceneCards ?? (await this.input.provider.expandScenes(context, this.state.plan!)),
        );
        this.runRecords.push(
          recordForStage(stage, this.input.provider, `已生成 ${this.state.draft.chapterText.length} 字正文`),
        );
        this.saveCheckpoint(stage);
        return;
      }
      case "critique": {
        this.state.draft ??= await this.input.provider.synthesizeProse(
          context,
          this.state.plan ?? (await this.input.provider.planChapter(context)),
          this.state.sceneCards ?? (await this.input.provider.expandScenes(context, this.state.plan!)),
        );
        this.state.review = await this.input.provider.critiqueChapter(context, this.state.draft);
        this.state.draft.review = this.state.review;
        this.runRecords.push(
          recordForStage(stage, this.input.provider, this.state.review.passed ? "复核通过" : "复核未通过"),
        );
        this.saveCheckpoint(stage);
        return;
      }
      case "memory-write": {
        if (this.state.review?.passed && this.state.draft) {
          for (const scene of this.state.draft.sceneDrafts) {
            await this.input.memoryStore.writeExpression({
              lineId: this.input.line.lineId,
              sceneId: scene.sceneId,
              stageId: this.input.lens.stageRange[0] ?? this.input.line.stages.at(-1)?.id ?? "unknown-stage",
              eventIds: this.state.sourcePack?.selectedEventIds ?? [],
              characterIds: this.input.lens.focusCharacterIds,
              relationshipKeys: [],
              summary: scene.summary,
              text: scene.text,
              toneTags: ["压迫"],
              voiceTags: ["全知旁观"],
              conflictTags: ["正面碰撞"],
              hookTags: ["下章钩子"],
              source: "critic-pass",
            });
          }
        }
        this.runRecords.push(recordForStage(stage, this.input.provider, "已写入表达记忆"));
        this.saveCheckpoint(stage);
        return;
      }
      default:
        return;
    }
  }

  async runUntil(target: WritingStage): Promise<{
    runRecords: RunRecord[];
    checkpoint?: ResumeCheckpoint;
    draft?: ChapterDraft;
  }> {
    const targetIndex = stageIndex(target);
    for (const stage of STAGE_ORDER.slice(0, targetIndex + 1)) {
      if (this.runRecords.some((record) => record.stage === stage)) {
        continue;
      }
      await this.executeStage(stage);
    }
    return {
      runRecords: cloneValue(this.runRecords),
      checkpoint: cloneCheckpoint(this.checkpoint),
      draft: this.state.draft ? cloneValue(this.state.draft) : undefined,
    };
  }

  async resumeFrom(
    checkpoint: ResumeCheckpoint,
    target: WritingStage | "complete",
  ): Promise<{
    runRecords: RunRecord[];
    checkpoint?: ResumeCheckpoint;
    draft?: ChapterDraft;
  }> {
    this.hydrateFromCheckpoint(checkpoint);
    const completed = new Set(checkpoint.completedStages);
    const targetIndex = stageIndex(target);

    for (const stage of STAGE_ORDER.slice(0, targetIndex + 1)) {
      if (completed.has(stage) || this.runRecords.some((record) => record.stage === stage)) {
        continue;
      }
      await this.executeStage(stage);
    }

    return {
      runRecords: cloneValue(this.runRecords),
      checkpoint: cloneCheckpoint(this.checkpoint),
      draft: this.state.draft ? cloneValue(this.state.draft) : undefined,
    };
  }
}

export function buildWritingJob(input: {
  line: TimelineLine;
  lens: NarrativeLens;
  provider: WritingModelProvider;
  memoryStore: StoryMemoryStore;
}) {
  return new WritingJob(input);
}

export class SimulationJob {
  private readonly runRecords: JobStageRun[] = [];

  constructor(
    private readonly input: {
      engine: WorldHistoryEngine;
      directives: StageDirective[];
      provider?: SimulationModelProvider;
      providerName?: string;
      modelName?: string;
      runStore?: SimulationRunStore;
      worldId?: string;
      requireAuthorOnHighRisk?: boolean;
    },
  ) {}

  async run(): Promise<{
    results: StageResult[];
    runRecords: JobStageRun[];
  }> {
    const results: StageResult[] = [];
    for (const directive of this.input.directives) {
      let currentRun = this.input.runStore
        ? await this.input.runStore.createRun({
            worldId: this.input.worldId ?? "default-world",
            lineId: this.input.engine.getCanonLine().lineId,
            baseCanonStageId: this.input.engine.getCanonLine().stages.at(-1)?.id,
            directive,
          })
        : undefined;
      if (currentRun && this.input.runStore) {
        currentRun = await this.input.runStore.startStep(currentRun, "simulate-branches");
      }

      const result = this.input.provider
        ? this.input.engine.runStageWithProposal(
            directive,
            (
              await this.input.provider.simulateStage({
                parsed: this.input.engine.getParsedWorld(),
                canonLine: this.input.engine.getCanonLine(),
                directive,
                nextStageNumber: this.input.engine.getCanonLine().stages.length + 1,
              })
            ).proposal,
            { requireAuthorOnHighRisk: this.input.requireAuthorOnHighRisk },
          )
        : this.input.engine.runStage(directive, { requireAuthorOnHighRisk: this.input.requireAuthorOnHighRisk });

      if (currentRun && this.input.runStore) {
        await this.input.runStore.writeArtifact(currentRun, {
          refId: "simulation.stage-result",
          relativePath: "simulation/stage-result.json",
          kind: "json",
          value: result,
        });
        currentRun = await this.input.runStore.completeLatestStep(currentRun, ["simulation.stage-result"]);
        currentRun = await this.input.runStore.markRun(currentRun, "completed");
      }

      results.push(result);
      this.runRecords.push({
        stage: "memory-read",
        providerName: this.input.providerName ?? this.input.provider?.name ?? "world-history-engine",
        modelName: this.input.modelName ?? this.input.provider?.modelName ?? "local-simulator",
        summary: `${directive.stageLabel} 已推进，生成 ${result.branchEvaluations.length} 条分叉评估`,
        outputRef: currentRun?.runId,
      });
    }
    return {
      results,
      runRecords: cloneValue(this.runRecords),
    };
  }
}

export function buildSimulationJob(input: {
  engine: WorldHistoryEngine;
  directives: StageDirective[];
  provider?: SimulationModelProvider;
  providerName?: string;
  modelName?: string;
  runStore?: SimulationRunStore;
  worldId?: string;
  requireAuthorOnHighRisk?: boolean;
}) {
  return new SimulationJob(input);
}
