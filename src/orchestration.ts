import {
  ChapterDraft,
  ChapterPlan,
  cloneValue,
  JobStageRun,
  NarrativeLens,
  NarrativeMemoryPack,
  ParsedWorldDraft,
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
import { sanitizeProse } from "./anti-slop-sanitizer";
import { verifyXianxia } from "./xianxia-verifier";
import {
  emitComposeStage,
  emitConfirmFinalCascade,
  emitMemoryWrite,
} from "./world-events/emit";

/**
 * W4: post-process the provider's ReviewReport with deterministic
 * anti-slop sanitizer + xianxia verifier checks. Issues from these go to
 * `warnings` (slop) and `issues` (xianxia blockers); style notes get
 * appended too.
 *
 * `passed` is downgraded only if a verifier blocker fires; sanitizer is
 * advisory and never alone fails review.
 */
function augmentReviewWithChecks(
  review: ReviewReport,
  chapterText: string,
  parsed: ParsedWorldDraft | undefined,
): ReviewReport {
  const slop = sanitizeProse(chapterText);
  const slopWarnings = slop.issues.map((i) => `[anti-slop:${i.category}] ${i.message}`);

  let xianxiaIssues: string[] = [];
  let xianxiaWarnings: string[] = [];
  let xianxiaPassed = true;
  if (parsed) {
    const xianxia = verifyXianxia({ text: chapterText, parsed });
    for (const v of xianxia.violations) {
      const line = `[xianxia:${v.kind}] ${v.message}`;
      if (v.severity === "blocker") xianxiaIssues.push(line);
      else xianxiaWarnings.push(line);
    }
    xianxiaPassed = xianxia.passed;
  }

  return {
    passed: review.passed && xianxiaPassed,
    issues: [...review.issues, ...xianxiaIssues],
    warnings: [...review.warnings, ...slopWarnings, ...xianxiaWarnings],
    styleNotes: [
      ...review.styleNotes,
      `slop-score=${slop.slopScore.toFixed(1)}/10`,
    ],
    factCoverage: review.factCoverage,
    suggestedRewrites: review.suggestedRewrites,
  };
}

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
      /**
       * Optional parsed world for the W4 critique post-checks
       * (xianxia verifier needs character + bazi data). When omitted,
       * only the anti-slop sanitizer runs in critique post-processing.
       */
      parsed?: ParsedWorldDraft;
      runId?: string;
      chapterId?: string;
    },
  ) {}

  private emitCtx() {
    return { runId: this.input.runId, chapterId: this.input.chapterId };
  }

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
    emitComposeStage({ ...this.emitCtx(), stage, status: "started", summary: `${stage} 开始` });
    const context = await this.providerContext();

    switch (stage) {
      case "memory-read": {
        const summary = `已读取 ${context.memoryPack.factEntries.length} 条事实记忆`;
        this.runRecords.push(recordForStage(stage, this.input.provider, summary));
        this.saveCheckpoint(stage);
        emitComposeStage({ ...this.emitCtx(), stage, status: "succeeded", summary });
        return;
      }
      case "blueprint": {
        this.state.plan = await this.input.provider.planChapter(context);
        const summary = `已生成章节蓝图：${this.state.plan.chapterGoal}`;
        this.runRecords.push(recordForStage(stage, this.input.provider, summary));
        this.saveCheckpoint(stage);
        emitComposeStage({ ...this.emitCtx(), stage, status: "succeeded", summary });
        return;
      }
      case "scene-expand": {
        this.state.plan ??= await this.input.provider.planChapter(context);
        this.state.sceneCards = await this.input.provider.expandScenes(context, this.state.plan);
        const summary = `已展开 ${this.state.sceneCards.length} 个场景`;
        this.runRecords.push(recordForStage(stage, this.input.provider, summary));
        this.saveCheckpoint(stage);
        emitComposeStage({ ...this.emitCtx(), stage, status: "succeeded", summary });
        return;
      }
      case "synthesize": {
        // Per review · M (orchestration plan crash): assign back to state.plan
        // so subsequent reads see it. Previous code used `state.plan!` after a
        // ?? expression that didn't write through, so a checkpoint with
        // sceneCards-but-no-plan crashed on null deref.
        const plan = this.state.plan ?? (await this.input.provider.planChapter(context));
        this.state.plan = plan;
        const sceneCards =
          this.state.sceneCards ?? (await this.input.provider.expandScenes(context, plan));
        this.state.sceneCards = sceneCards;
        this.state.draft = await this.input.provider.synthesizeProse(
          context,
          plan,
          sceneCards,
        );
        const summary = `已生成 ${this.state.draft.chapterText.length} 字正文`;
        this.runRecords.push(recordForStage(stage, this.input.provider, summary));
        this.saveCheckpoint(stage);
        emitComposeStage({ ...this.emitCtx(), stage, status: "succeeded", summary });
        return;
      }
      case "critique": {
        // Same fix as synthesize — write-through state.plan/sceneCards.
        if (!this.state.draft) {
          const plan = this.state.plan ?? (await this.input.provider.planChapter(context));
          this.state.plan = plan;
          const sceneCards =
            this.state.sceneCards ?? (await this.input.provider.expandScenes(context, plan));
          this.state.sceneCards = sceneCards;
          this.state.draft = await this.input.provider.synthesizeProse(context, plan, sceneCards);
        }
        const baseReview = await this.input.provider.critiqueChapter(context, this.state.draft);
        this.state.review = augmentReviewWithChecks(
          baseReview,
          this.state.draft.chapterText,
          this.input.parsed,
        );
        this.state.draft.review = this.state.review;
        const summary = this.state.review.passed ? "复核通过" : "复核未通过";
        this.runRecords.push(recordForStage(stage, this.input.provider, summary));
        this.saveCheckpoint(stage);
        emitComposeStage({
          ...this.emitCtx(),
          stage,
          status: this.state.review.passed ? "succeeded" : "failed",
          summary,
        });
        return;
      }
      case "memory-write": {
        const wroteAnything = this.state.review?.passed && this.state.draft;
        if (wroteAnything && this.state.draft) {
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
        // Per review · L: don't claim "已写入" if memory wasn't written
        // (critic failed). Surface the actual outcome so re-runs can
        // distinguish "skipped due to review" from "wrote".
        const summary = wroteAnything
          ? `已写入 ${this.state.draft!.sceneDrafts.length} 段表达记忆`
          : "复核未通过，已跳过表达记忆写入";
        this.runRecords.push(recordForStage(stage, this.input.provider, summary));
        this.saveCheckpoint(stage);
        emitComposeStage({
          ...this.emitCtx(),
          stage,
          status: wroteAnything ? "succeeded" : "blocked",
          summary,
        });
        if (wroteAnything && this.state.draft) {
          emitMemoryWrite({
            ...this.emitCtx(),
            count: this.state.draft.sceneDrafts.length,
            breakdown: "表达记忆",
          });
        }
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
        // Per review · M (orchestration mark race): only mark as completed if
        // the gate didn't request author resolution. ask-author runs stay
        // "running" until WorldDaemon flips them to "paused" on the next
        // line, eliminating the brief "completed → paused" window for
        // cross-process consumers.
        const askAuthor = result.gateDecisions?.find((d) => d.result === "ask-author");
        if (!askAuthor) {
          currentRun = await this.input.runStore.markRun(currentRun, "completed");
        }
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
