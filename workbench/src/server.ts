import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ChapterDraft,
  NarrativeDraft,
  NarrativeLens,
  RunAutoStagesRequest,
  SceneDraft,
  SceneCard,
  SimulationModelProvider,
  StageDirective,
  StageResult,
  TimelineLine,
  WritingModelProvider,
  WritingProviderContext,
} from "../../src/domain";
import {
  AiSettingsStore,
  AtlasCompiler,
  StoryMemoryStore,
  assembleChapterDraft,
  buildNarrativeSourcePack,
  createDefaultSimulationProvider,
  createDefaultWritingProvider,
  maskApiKey,
  NovelRuntimeKernel,
  parseWorldDraft,
  PersistentRuntimeDaemon,
  rewriteNarrativeScene,
  SimulationRunStore,
  WorldDaemon,
  WorldHistoryEngine,
} from "../../src/index";
import type { DeepSeekProviderOptions } from "../../src/deepseek";
import { validateDeepSeekConnection } from "../../src/deepseek";
import {
  DEFAULT_DEEPSEEK_PROFILE,
  DeepSeekReasoningEffort,
  DeepSeekThinkingMode,
  normalizePositiveInteger,
  normalizeReasoningEffort,
  normalizeThinkingMode,
} from "../../src/deepseek-profile";
import type {
  ApplyWorldDraftRequest,
  AtlasFilePayload,
  AtlasTreeNode,
  AiSettingsPayload,
  ComposeResponse,
  ConfirmAuthorFinalRequest,
  ConfirmFinalResponse,
  MemoryPanelPayload,
  PromoteBranchRequest,
  RunDaemonTickRequest,
  RuntimeStartRequest,
  RunStageRequest,
  RunAutoStagesRequest as RunAutoStagesRequestPayload,
  SimulationStageView,
  SimulationStatePayload,
  WorkbenchLineSummary,
  WorkbenchRequest,
  WorkbenchSessionState,
  WorldDraftPreview,
} from "./contracts";

type WorkbenchHandlersOptions = {
  rootDir?: string;
  deepseek?: DeepSeekProviderOptions;
  providerFactory?: () => WritingModelProvider;
  simulationProviderFactory?: () => SimulationModelProvider;
  aiSettingsStore?: AiSettingsStore;
  draftText?: string;
  seedInitialStages?: boolean;
};

type AiSettingsRequest = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  thinkingMode?: DeepSeekThinkingMode;
  reasoningEffort?: DeepSeekReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
};

const WORKBENCH_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(WORKBENCH_DIR, "../..");
const DEFAULT_SAMPLE_STAGES: StageDirective[] = [
  {
    stageLabel: "外门试炼",
    focusCharacterIds: ["林焰"],
  },
  {
    stageLabel: "丹谷风波",
    focusCharacterIds: ["苏雪"],
    intervention: "地火丹谷丹炉爆裂，执法堂勒令半日封谷搜查内应。",
  },
];

function loadSampleWorldDraft(override?: string): string {
  if (override) {
    return override;
  }
  return readFileSync(join(REPO_ROOT, "examples", "sample-world.md"), "utf8");
}

function defaultLens(stageId?: string): NarrativeLens {
  return {
    focusCharacterIds: ["苏雪"],
    style: "omniscient-web",
    stageRange: stageId ? [stageId] : [],
    chapterGoal: "展示外门试炼这一章里三方势力第一次真正撞上台面的过程",
    sceneCount: 5,
    targetLength: [2800, 3300],
    factConstraint: "medium-expansion",
  };
}

function buildWorldPreview(draftText: string): WorldDraftPreview {
  try {
    const parsed = parseWorldDraft(draftText);
    return {
      ok: true,
      parsed,
      worldSpec: parsed.worldSpec,
      characters: parsed.characters,
      relationships: parsed.relationships,
      characterAnchors: parsed.characterAnchors,
      relationshipAnchors: parsed.relationshipAnchors,
      counts: {
        characters: parsed.characters.length,
        relationships: parsed.relationships.length,
        characterAnchors: parsed.characterAnchors.length,
        relationshipAnchors: parsed.relationshipAnchors.length,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown parse error",
      characters: [],
      relationships: [],
      characterAnchors: [],
      relationshipAnchors: [],
      counts: {
        characters: 0,
        relationships: 0,
        characterAnchors: 0,
        relationshipAnchors: 0,
      },
    };
  }
}

function createProvider(options: WorkbenchHandlersOptions): WritingModelProvider {
  if (options.providerFactory) {
    return options.providerFactory();
  }
  return createDefaultWritingProvider({
    deepseek: options.deepseek,
  });
}

function createSimulationProvider(options: WorkbenchHandlersOptions): SimulationModelProvider {
  if (options.simulationProviderFactory) {
    return options.simulationProviderFactory();
  }
  return createDefaultSimulationProvider({
    deepseek: options.deepseek,
  });
}

function isOnlineProvider(provider: WritingModelProvider): boolean {
  return provider.name === "deepseek-writing-provider";
}

function toAiSettingsPayload(store: AiSettingsStore): AiSettingsPayload {
  const settings = store.readSync();
  if (!settings) {
    return {
      configured: false,
      validated: false,
    };
  }

  return {
    configured: true,
    validated: true,
    apiKeyMasked: maskApiKey(settings.apiKey),
    baseUrl: settings.baseUrl,
    model: settings.model,
    timeoutMs: settings.timeoutMs,
    thinkingMode: settings.thinkingMode,
    reasoningEffort: settings.reasoningEffort,
    contextWindowTokens: settings.contextWindowTokens,
    maxOutputTokens: settings.maxOutputTokens,
    updatedAt: settings.updatedAt,
  };
}

function normalizeAiSettingsRequest(request: AiSettingsRequest, existing?: ReturnType<AiSettingsStore["readSync"]>) {
  return {
    apiKey: request.apiKey.trim() || (existing?.apiKey ?? ""),
    baseUrl: request.baseUrl,
    model: request.model,
    timeoutMs: normalizePositiveInteger(request.timeoutMs, DEFAULT_DEEPSEEK_PROFILE.timeoutMs),
    thinkingMode: normalizeThinkingMode(request.thinkingMode ?? existing?.thinkingMode),
    reasoningEffort: normalizeReasoningEffort(request.reasoningEffort ?? existing?.reasoningEffort),
    contextWindowTokens: normalizePositiveInteger(
      request.contextWindowTokens ?? existing?.contextWindowTokens,
      DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens,
    ),
    maxOutputTokens: normalizePositiveInteger(
      request.maxOutputTokens ?? existing?.maxOutputTokens,
      DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens,
    ),
  };
}

function toNarrativeDraft(
  draft: ChapterDraft,
  context: WritingProviderContext,
  sceneCards: SceneCard[],
): NarrativeDraft {
  return {
    ...draft,
    focusCharacterIds: [...context.lens.focusCharacterIds],
    selectedEventIds: context.sourcePack.selectedEventIds,
    sceneIds: sceneCards.map((scene) => scene.id),
    planSummary: `主冲突：${draft.plan.mainConflict} / 副冲突：${draft.plan.secondaryConflict} / 结尾钩子：${draft.plan.closingHook}`,
    sceneSummaries: sceneCards.map((scene) => `${scene.sceneGoal}·${scene.location}：${scene.conflict}`),
    sourcePack: context.sourcePack,
    text: draft.chapterText,
  };
}

function isNarrativeDraft(draft: ChapterDraft | NarrativeDraft): draft is NarrativeDraft {
  return "sourcePack" in draft && "selectedEventIds" in draft;
}

function assertSafeAtlasLineId(lineId: string): string {
  const normalized = lineId.trim();
  if (normalized === "canon") {
    return normalized;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized) || normalized.includes("..")) {
    throw new Error("atlas line id is invalid");
  }
  return normalized;
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function lineAtlasRoot(rootDir: string, lineId: string): string {
  const safeLineId = assertSafeAtlasLineId(lineId);
  return safeLineId === "canon" ? join(rootDir, "atlas", "canon") : join(rootDir, "atlas", "branches", safeLineId);
}

async function readAtlasTree(directory: string, baseDirectory = directory): Promise<AtlasTreeNode[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nodes: AtlasTreeNode[] = [];
    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      const relativePath = relative(baseDirectory, entryPath).replace(/\\/g, "/");
      nodes.push({
        path: relativePath,
        name: entry.name,
        kind: entry.isDirectory() ? "directory" : "file",
      });
      if (entry.isDirectory()) {
        nodes.push(...(await readAtlasTree(entryPath, baseDirectory)));
      }
    }
    return nodes.sort((left, right) => left.path.localeCompare(right.path));
  } catch {
    return [];
  }
}

type AutoRunState = {
  active: boolean;
  targetStages: number;
  completedStages: number;
  lastStageLabel?: string;
  lastCompletedStageId?: string;
};

type SessionMetaFactory = () => Pick<WorkbenchSessionState, "aiSettings" | "locked">;

class StudioSession {
  private memoryStore!: StoryMemoryStore;
  private atlasCompiler: AtlasCompiler;
  private engine!: WorldHistoryEngine;
  private appliedDraftText: string;
  private readonly rootDir: string;
  private stageResults: StageResult[] = [];
  private selectedLineId = "canon";
  private selectedStageId?: string;
  private selectedSceneId?: string;
  private lens: NarrativeLens = defaultLens();
  private currentDraft?: NarrativeDraft;
  private atlasUpdatedFiles: string[] = [];
  private autoRunState?: AutoRunState;
  private latestSimulationRun?: {
    summary: string;
    finishReason?: string;
    requestMode?: string;
  };
  private readonly sessionMeta?: SessionMetaFactory;

  private constructor(rootDir: string, draftText: string, sessionMeta?: SessionMetaFactory) {
    this.rootDir = rootDir;
    this.appliedDraftText = draftText;
    this.sessionMeta = sessionMeta;
    this.atlasCompiler = new AtlasCompiler({ rootDir: join(rootDir, "atlas") });
  }

  static async create(options: {
    rootDir: string;
    draftText: string;
    seedInitialStages: boolean;
    sessionMeta?: SessionMetaFactory;
  }) {
    const session = new StudioSession(options.rootDir, options.draftText, options.sessionMeta);
    await session.resetWithDraft(options.draftText, options.seedInitialStages);
    return session;
  }

  private async rebuildStores() {
    await rm(join(this.rootDir, "memory"), { recursive: true, force: true });
    await rm(join(this.rootDir, "atlas"), { recursive: true, force: true });
    await mkdir(this.rootDir, { recursive: true });
    this.memoryStore = await StoryMemoryStore.create({ rootDir: this.rootDir });
    this.atlasCompiler = new AtlasCompiler({ rootDir: join(this.rootDir, "atlas") });
  }

  private currentLine(): TimelineLine {
    return this.engine.getLine(this.selectedLineId);
  }

  getEngineForRuntime(): WorldHistoryEngine {
    return this.engine;
  }

  private updateLens(line: TimelineLine, override?: Partial<NarrativeLens>) {
    const currentStageRange = this.lens.stageRange.filter((stageId) => line.stages.some((stage) => stage.id === stageId));
    const fallbackStageId = line.stages.at(-1)?.id;
    const stageRange =
      override?.stageRange ??
      (currentStageRange.length > 0 ? currentStageRange : fallbackStageId ? [fallbackStageId] : []);

    this.lens = {
      ...this.lens,
      ...override,
      focusCharacterIds:
        override?.focusCharacterIds && override.focusCharacterIds.length > 0
          ? [...override.focusCharacterIds]
          : this.lens.focusCharacterIds.length > 0
            ? [...this.lens.focusCharacterIds]
            : ["苏雪"],
      stageRange,
    };
    this.selectedStageId = stageRange[0] ?? fallbackStageId;
  }

  private buildLineSummaries(): WorkbenchLineSummary[] {
    const lines: WorkbenchLineSummary[] = [
      {
        lineId: "canon",
        label: "正史线",
        kind: "canon",
        latestStageId: this.engine.getCanonLine().stages.at(-1)?.id,
        eventCount: this.engine.getCanonLine().events.length,
      },
    ];

    for (const result of this.stageResults) {
      for (const evaluation of result.branchEvaluations) {
        const line = this.engine.getLine(evaluation.branchId);
        lines.push({
          lineId: line.lineId,
          label: line.label,
          kind: line.kind,
          recommended: evaluation.recommended,
          sourceStageId: result.canonStage.id,
          latestStageId: line.stages.at(-1)?.id,
          eventCount: line.events.length,
        });
      }
    }

    return lines.filter(
      (line, index, source) => index === source.findIndex((candidate) => candidate.lineId === line.lineId),
    );
  }

  private buildSimulationState(): SimulationStatePayload {
    const lines = this.buildLineSummaries();
    const stages: SimulationStageView[] = this.stageResults.map((result) => ({
      canonStageId: result.canonStage.id,
      stageLabel: result.canonStage.stageLabel,
      focusCharacterIds: [...result.canonStage.focusCharacterIds],
      intervention: result.canonStage.intervention,
      branchEvaluations: result.branchEvaluations,
    }));
    const canon = this.engine.getCanonLine();

    return {
      selectedLineId: this.selectedLineId,
      selectedStageId: this.selectedStageId,
      lines,
      stages,
      latestBranchEvaluations: this.stageResults.at(-1)?.branchEvaluations ?? [],
      branchHistory: canon.branchHistory,
      selectedLine: lines.find((line) => line.lineId === this.selectedLineId),
    };
  }

  async buildContext(lineId?: string, lensOverride?: Partial<NarrativeLens>): Promise<WritingProviderContext> {
    if (lineId) {
      this.selectedLineId = lineId;
      this.currentDraft = undefined;
      this.selectedSceneId = undefined;
    }

    const line = this.currentLine();
    this.updateLens(line, lensOverride);
    const memoryPack = await this.memoryStore.readMemoryPack({
      lineId: line.lineId,
      focusCharacterIds: this.lens.focusCharacterIds,
      stageIds: this.lens.stageRange,
    });
    const sourcePack = buildNarrativeSourcePack({
      line,
      lens: this.lens,
    });

    return {
      line,
      lens: this.lens,
      sourcePack,
      memoryPack,
    };
  }

  private async syncFactsForCurrentState(result?: StageResult) {
    await this.memoryStore.syncFactsFromLine(this.engine.getCanonLine());
    const branchIds = result?.branchEvaluations.map((branch) => branch.branchId) ?? [];
    await Promise.all(branchIds.map((branchId) => this.memoryStore.syncFactsFromLine(this.engine.getLine(branchId))));
  }

  async resetWithDraft(draftText: string, seedInitialStages: boolean) {
    this.appliedDraftText = draftText;
    this.stageResults = [];
    this.selectedLineId = "canon";
    this.selectedStageId = undefined;
    this.selectedSceneId = undefined;
    this.currentDraft = undefined;
    this.atlasUpdatedFiles = [];
    this.autoRunState = undefined;
    this.latestSimulationRun = undefined;
    this.engine = new WorldHistoryEngine(parseWorldDraft(draftText));
    this.lens = defaultLens();
    await this.rebuildStores();
    await this.memoryStore.syncFactsFromLine(this.engine.getCanonLine());

    if (seedInitialStages) {
      for (const directive of DEFAULT_SAMPLE_STAGES) {
        const result = this.engine.runStage(directive);
        this.stageResults.push(result);
        await this.syncFactsForCurrentState(result);
      }
      this.selectedStageId = this.engine.getCanonLine().stages.at(-1)?.id;
      this.lens = defaultLens(this.selectedStageId);
    }
  }

  sessionState(provider: WritingModelProvider): WorkbenchSessionState {
    const meta = this.sessionMeta?.();
    return {
      online: isOnlineProvider(provider),
      providerName: provider.name,
      draftApplied: true,
      appliedDraftText: this.appliedDraftText,
      selectedLineId: this.selectedLineId,
      selectedStageId: this.selectedStageId,
      selectedSceneId: this.selectedSceneId,
      lens: this.lens,
      simulation: this.buildSimulationState(),
      worldPreview: buildWorldPreview(this.appliedDraftText),
      currentDraft: this.currentDraft,
      atlasUpdatedFiles: [...this.atlasUpdatedFiles],
      simulationAutoRun: this.autoRunState ? { ...this.autoRunState } : undefined,
      latestSimulationRun: this.latestSimulationRun ? { ...this.latestSimulationRun } : undefined,
      ...meta,
    };
  }

  async parseWorld(draftText: string) {
    return {
      draftText,
      preview: buildWorldPreview(draftText),
    };
  }

  async applyWorld(request: ApplyWorldDraftRequest) {
    await this.resetWithDraft(request.draftText, false);
  }

  async resetWorld() {
    return {
      draftText: this.appliedDraftText,
      preview: buildWorldPreview(this.appliedDraftText),
    };
  }

  async runStage(request: RunStageRequest) {
    const result = this.engine.runStage({
      stageLabel: request.stageLabel,
      focusCharacterIds: request.focusCharacterIds,
      intervention: request.intervention,
      qimenOverride: request.qimenOverride,
    });
    this.stageResults.push(result);
    this.selectedLineId = "canon";
    this.selectedStageId = result.canonStage.id;
    this.selectedSceneId = undefined;
    this.currentDraft = undefined;
    this.updateLens(this.engine.getCanonLine(), {
      focusCharacterIds: request.focusCharacterIds,
      stageRange: [result.canonStage.id],
    });
    await this.syncFactsForCurrentState(result);
    return result;
  }

  async runStageWithProvider(request: RunStageRequest, provider: SimulationModelProvider) {
    const proposalResult = await provider.simulateStage({
      parsed: this.engine.getParsedWorld(),
      canonLine: this.engine.getCanonLine(),
      directive: {
        stageLabel: request.stageLabel,
        focusCharacterIds: request.focusCharacterIds,
        intervention: request.intervention,
        qimenOverride: request.qimenOverride,
      },
      nextStageNumber: this.engine.getCanonLine().stages.length + 1,
    });
    const result = this.engine.runStageWithProposal(
      {
        stageLabel: request.stageLabel,
        focusCharacterIds: request.focusCharacterIds,
        intervention: request.intervention,
        qimenOverride: request.qimenOverride,
      },
      proposalResult.proposal,
    );
    this.stageResults.push(result);
    this.selectedLineId = "canon";
    this.selectedStageId = result.canonStage.id;
    this.selectedSceneId = undefined;
    this.currentDraft = undefined;
    this.latestSimulationRun = {
      summary: proposalResult.runRecord.summary,
      finishReason: proposalResult.runRecord.finishReason,
      requestMode: proposalResult.runRecord.requestMode,
    };
    this.updateLens(this.engine.getCanonLine(), {
      focusCharacterIds: request.focusCharacterIds,
      stageRange: [result.canonStage.id],
    });
    await this.syncFactsForCurrentState(result);
    return {
      result,
      runRecord: proposalResult.runRecord,
    };
  }

  async syncRuntimeStageResult(result: StageResult, directive?: StageDirective) {
    if (!this.stageResults.some((existing) => existing.canonStage.id === result.canonStage.id)) {
      this.stageResults.push(result);
    }
    this.selectedLineId = "canon";
    this.selectedSceneId = undefined;
    this.currentDraft = undefined;
    this.updateLens(this.engine.getCanonLine(), {
      focusCharacterIds:
        directive?.focusCharacterIds && directive.focusCharacterIds.length > 0
          ? directive.focusCharacterIds
          : result.canonStage.focusCharacterIds,
      stageRange: [result.canonStage.id],
    });
    await this.syncFactsForCurrentState(result);
  }

  async runAuto(request: RunAutoStagesRequestPayload, provider: SimulationModelProvider) {
    const targetStages = Math.max(1, request.targetStageCount);
    const baseStageLabel = request.stageLabel.trim() || "自动推进";
    let completedStages =
      this.autoRunState && this.autoRunState.active && this.autoRunState.targetStages === targetStages
        ? this.autoRunState.completedStages
        : 0;
    let response:
      | Awaited<ReturnType<StudioSession["runStageWithProvider"]>>
      | undefined;
    let pausedForAuthor = false;

    while (completedStages < targetStages) {
      const nextCompleted = completedStages + 1;
      const stageLabel = targetStages > 1 ? `${baseStageLabel}·${nextCompleted}` : baseStageLabel;
      response = await this.runStageWithProvider(
        {
          stageLabel,
          focusCharacterIds: request.focusCharacterIds,
          intervention: request.intervention,
          qimenOverride: request.qimenOverride,
        },
        provider,
      );
      completedStages = nextCompleted;
      if (response.result.gateDecisions?.some((decision) => decision.result === "ask-author")) {
        pausedForAuthor = true;
        break;
      }
    }

    if (!response) {
      response = await this.runStageWithProvider(
        {
          stageLabel: targetStages > 1 ? `${baseStageLabel}·1` : baseStageLabel,
          focusCharacterIds: request.focusCharacterIds,
          intervention: request.intervention,
          qimenOverride: request.qimenOverride,
        },
        provider,
      );
      completedStages = 1;
    }

    this.autoRunState = {
      active: !pausedForAuthor && completedStages < targetStages,
      targetStages,
      completedStages,
      lastStageLabel: response.result.canonStage.stageLabel,
      lastCompletedStageId: response.result.canonStage.id,
    };
    return {
      result: response.result,
      runRecord: response.runRecord,
      autoRun: { ...this.autoRunState },
    };
  }

  async selectLine(lineId: string) {
    this.selectedLineId = lineId;
    this.currentDraft = undefined;
    this.selectedSceneId = undefined;
    this.updateLens(this.currentLine());
  }

  async promoteBranch(request: PromoteBranchRequest) {
    this.engine.promoteBranch(request.branchId);
    this.selectedLineId = "canon";
    this.currentDraft = undefined;
    this.selectedSceneId = undefined;
    this.updateLens(this.engine.getCanonLine());
    await this.memoryStore.syncFactsFromLine(this.engine.getCanonLine());
  }

  async compose(
    request: WorkbenchRequest,
    provider: WritingModelProvider,
  ): Promise<ComposeResponse> {
    const context = await this.buildContext(request.lineId, request.lens);
    const plan = await provider.planChapter(context);
    const sceneCards = await provider.expandScenes(context, plan);
    const draft = await provider.synthesizeProse(context, plan, sceneCards);
    const review = await provider.critiqueChapter(context, draft);
    const narrativeDraft = toNarrativeDraft(
      {
        ...draft,
        review,
      },
      context,
      sceneCards,
    );

    this.currentDraft = narrativeDraft;
    this.selectedSceneId = request.sceneId ?? narrativeDraft.sceneDrafts[0]?.sceneId;

    return {
      online: isOnlineProvider(provider),
      providerName: provider.name,
      draft: narrativeDraft,
      session: this.sessionState(provider),
    };
  }

  async critique(request: WorkbenchRequest, provider: WritingModelProvider) {
    const context = await this.buildContext(request.lineId, request.lens);
    const draft = request.draft ?? this.currentDraft;
    if (!draft) {
      throw new Error("critique requires an existing draft");
    }
    const review = await provider.critiqueChapter(context, draft);
    this.currentDraft = {
      ...toNarrativeDraft(draft, context, draft.sceneDrafts.map((scene: SceneDraft, index: number) => ({
        id: scene.sceneId,
        order: index + 1,
        location: scene.title.split("·")[1] ?? "未知地点",
        time: `第${index + 1}场`,
        participants: context.lens.focusCharacterIds,
        sceneGoal: scene.title.split("·")[0] ?? scene.title,
        conflict: scene.summary,
        hardFacts: context.sourcePack.hardFacts,
        softExpansionBudget: context.sourcePack.softExpansionBudget,
        transitionIn: "延续上一场",
        transitionOut: "推向下一场",
        focusCue: "保持当前叙述焦点",
      }))),
      review,
    };
    return {
      online: isOnlineProvider(provider),
      providerName: provider.name,
      review,
      draft: this.currentDraft,
      session: this.sessionState(provider),
    };
  }

  async assemble(request: WorkbenchRequest, provider: WritingModelProvider): Promise<ComposeResponse> {
    const context = await this.buildContext(request.lineId, request.lens);
    const draft = request.draft ?? this.currentDraft;
    if (!draft) {
      throw new Error("assemble requires an existing draft");
    }
    const assembledDraft = provider.assembleChapter
      ? await provider.assembleChapter(context, draft)
      : assembleChapterDraft(draft, context.sourcePack, context.lens);
    const review = await provider.critiqueChapter(context, assembledDraft);
    const sceneCards = assembledDraft.sceneDrafts.map((scene, index) => ({
      id: scene.sceneId,
      order: index + 1,
      location: scene.title.split("·")[1] ?? "未知地点",
      time: `第${index + 1}场`,
      participants: context.lens.focusCharacterIds,
      sceneGoal: scene.title.split("·")[0] ?? scene.title,
      conflict: scene.summary,
      hardFacts: context.sourcePack.hardFacts,
      softExpansionBudget: context.sourcePack.softExpansionBudget,
      transitionIn: "延续上一场",
      transitionOut: "推向下一场",
      focusCue: "保持当前叙述焦点",
    }));
    this.currentDraft = toNarrativeDraft(
      {
        ...assembledDraft,
        review,
      },
      context,
      sceneCards,
    );
    return {
      online: isOnlineProvider(provider),
      providerName: provider.name,
      draft: this.currentDraft,
      session: this.sessionState(provider),
    };
  }

  async rewrite(request: WorkbenchRequest, provider: WritingModelProvider) {
    const context = await this.buildContext(request.lineId, request.lens);
    const draft = request.draft ?? this.currentDraft;
    const instructions = request.instructions?.filter(Boolean) ?? [];
    const sceneId = request.sceneId ?? this.selectedSceneId;
    if (!draft || !sceneId || instructions.length === 0) {
      throw new Error("rewrite requires draft, sceneId, and at least one instruction");
    }

    const rewrittenDraft = provider.rewriteSegment
      ? await provider.rewriteSegment(context, draft, sceneId, instructions)
      : rewriteNarrativeScene(
          toNarrativeDraft(
            draft,
            context,
            draft.sceneDrafts.map((scene, index) => ({
              id: scene.sceneId,
              order: index + 1,
              location: scene.title.split("·")[1] ?? "未知地点",
              time: `第${index + 1}场`,
              participants: context.lens.focusCharacterIds,
              sceneGoal: scene.title.split("·")[0] ?? scene.title,
              conflict: scene.summary,
              hardFacts: context.sourcePack.hardFacts,
              softExpansionBudget: context.sourcePack.softExpansionBudget,
              transitionIn: "延续上一场",
              transitionOut: "推向下一场",
              focusCue: "保持当前叙述焦点",
            })),
          ),
          sceneId,
          instructions.join("；"),
        );

    this.currentDraft = toNarrativeDraft(
      {
        ...draft,
        ...rewrittenDraft,
      },
      context,
      rewrittenDraft.sceneDrafts.map((scene, index) => ({
        id: scene.sceneId,
        order: index + 1,
        location: scene.title.split("·")[1] ?? "未知地点",
        time: `第${index + 1}场`,
        participants: context.lens.focusCharacterIds,
        sceneGoal: scene.title.split("·")[0] ?? scene.title,
        conflict: scene.summary,
        hardFacts: context.sourcePack.hardFacts,
        softExpansionBudget: context.sourcePack.softExpansionBudget,
        transitionIn: "延续上一场",
        transitionOut: "推向下一场",
        focusCue: "保持当前叙述焦点",
      })),
    );
    this.selectedSceneId = sceneId;

    return {
      online: isOnlineProvider(provider),
      providerName: provider.name,
      draft: this.currentDraft,
      session: this.sessionState(provider),
    };
  }

  async confirmFinal(
    request: ConfirmAuthorFinalRequest,
    provider: WritingModelProvider,
  ): Promise<ConfirmFinalResponse> {
    const lineId = request.lineId ?? this.selectedLineId;
    const line = this.engine.getLine(lineId);
    const stageId = this.selectedStageId ?? line.stages.at(-1)?.id ?? "unknown-stage";
    const draft = request.draft ?? this.currentDraft;
    if (!draft) {
      throw new Error("confirm-final requires an existing draft");
    }

    const targetScenes = request.sceneId
      ? draft.sceneDrafts.filter((scene) => scene.sceneId === request.sceneId)
      : draft.sceneDrafts;

    for (const scene of targetScenes) {
      await this.memoryStore.writeExpression({
        lineId,
        sceneId: scene.sceneId,
        stageId,
        eventIds: isNarrativeDraft(draft) ? draft.selectedEventIds : [],
        characterIds: isNarrativeDraft(draft) ? draft.focusCharacterIds : this.lens.focusCharacterIds,
        relationshipKeys: [],
        summary: scene.summary,
        text: scene.text,
        toneTags: ["压迫"],
        voiceTags: ["全知旁观"],
        conflictTags: ["正面碰撞"],
        hookTags: ["下章钩子"],
        source: "author-final",
      });
    }

    const result = await this.atlasCompiler.compileLine({
      line,
      memoryStore: this.memoryStore,
      changedStageIds: [stageId],
    });
    this.atlasUpdatedFiles = result.updatedFiles;

    return {
      ...result,
      session: this.sessionState(provider),
    };
  }

  async memory(lineId?: string): Promise<MemoryPanelPayload> {
    const targetLineId = lineId ?? this.selectedLineId;
    return {
      lineId: targetLineId,
      factEntries: await this.memoryStore.getAllFacts(targetLineId),
      expressionEntries: await this.memoryStore.getAllExpressions(targetLineId),
      foreshadowEntries: await this.memoryStore.getAllForeshadows(targetLineId),
      revisionEntries: await this.memoryStore.getAllRevisions(targetLineId),
    };
  }

  async compileAtlas(lineId: string) {
    const line = this.engine.getLine(lineId);
    const result = await this.atlasCompiler.compileLine({
      line,
      memoryStore: this.memoryStore,
      changedStageIds: line.stages.map((stage) => stage.id),
    });
    this.atlasUpdatedFiles = result.updatedFiles;
    return result;
  }

  async atlasTree(lineId?: string) {
    const targetLineId = lineId ?? this.selectedLineId;
    const root = lineAtlasRoot(this.rootDir, targetLineId);
    return {
      lineId: targetLineId,
      tree: await readAtlasTree(root),
    };
  }

  async atlasFile(lineId: string | undefined, path: string): Promise<AtlasFilePayload> {
    const targetLineId = lineId ?? this.selectedLineId;
    const root = resolve(lineAtlasRoot(this.rootDir, targetLineId));
    const absolutePath = resolve(root, path);
    if (!isInsideDirectory(root, absolutePath)) {
      throw new Error("atlas path is outside the atlas root");
    }
    const fileStats = await stat(absolutePath);
    if (!fileStats.isFile()) {
      throw new Error("atlas path is not a file");
    }
    return {
      lineId: targetLineId,
      path,
      content: await readFile(absolutePath, "utf8"),
    };
  }
}

async function readJsonBody(request: IncomingMessage): Promise<Partial<WorkbenchRequest & RuntimeStartRequest>> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? (JSON.parse(raw) as Partial<WorkbenchRequest & RuntimeStartRequest>) : {};
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function createUrl(input: string) {
  return new URL(input, "http://localhost");
}

export function createWorkbenchApiHandlers(options: WorkbenchHandlersOptions = {}) {
  const rootDir = options.rootDir ?? REPO_ROOT;
  const runtimeRoot = join(rootDir, ".novel-system");
  const runStore = new SimulationRunStore({ rootDir: runtimeRoot });
  const aiSettingsStore = options.aiSettingsStore ?? new AiSettingsStore();
  const configuredAtBoot = toAiSettingsPayload(aiSettingsStore).configured;
  let sessionPromise: Promise<StudioSession> | undefined;
  let runtimeDaemon: PersistentRuntimeDaemon | undefined;
  const syncedRuntimeRunIds = new Set<string>();

  function getSession() {
    sessionPromise ??= StudioSession.create({
      rootDir,
      draftText: loadSampleWorldDraft(options.draftText),
      seedInitialStages: (options.seedInitialStages ?? true) && configuredAtBoot,
      sessionMeta: () => {
        const aiSettings = toAiSettingsPayload(aiSettingsStore);
        return {
          aiSettings,
          locked: !aiSettings.configured,
        };
      },
    });
    return sessionPromise;
  }

  async function withSession<T>(
    handler: (
      session: StudioSession,
      provider: WritingModelProvider,
      simulationProvider: SimulationModelProvider,
    ) => Promise<T>,
  ) {
    const session = await getSession();
    const provider = createProvider(options);
    const simulationProvider = createSimulationProvider(options);
    return handler(session, provider, simulationProvider);
  }

  async function syncRuntimeRun(session: StudioSession, runId: string, directive?: StageDirective) {
    if (syncedRuntimeRunIds.has(runId)) {
      return;
    }
    const run = await runStore.loadRun(runId);
    const stageResultRef = run.artifacts.refs.find((ref) => ref.refId === "simulation.stage-result");
    if (stageResultRef) {
      await session.syncRuntimeStageResult(JSON.parse(await readFile(stageResultRef.path, "utf8")) as StageResult, directive);
    }
    syncedRuntimeRunIds.add(runId);
  }

  async function syncRuntimeSnapshot(session: StudioSession) {
    const snapshot = runtimeDaemon?.status();
    if (!snapshot) {
      return;
    }
    for (const runId of snapshot.runIds) {
      await syncRuntimeRun(session, runId);
    }
  }

  function getRuntimeDaemon(session: StudioSession) {
    runtimeDaemon ??= new PersistentRuntimeDaemon({
      kernel: new NovelRuntimeKernel({
        engine: session.getEngineForRuntime(),
        runStore,
        config: {
          worldId: "workbench-world",
          tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
          autonomy: {
            autoPromote: "never",
            requireAuthorOnCanonRisk: true,
            requireAuthorOnHardDecision: true,
          },
          storage: { runRoot: runtimeRoot, checkpointEveryStep: true },
        },
      }),
      defaultDirective: { stageLabel: "世界后台推演", focusCharacterIds: ["林焰"] },
      onTickResult: async (result, directive) => {
        await syncRuntimeRun(session, result.runId, directive);
      },
    });
    return runtimeDaemon;
  }

  function ensureConfigured() {
    const settings = toAiSettingsPayload(aiSettingsStore);
    if (!settings.configured) {
      throw new Error("DeepSeek Studio is locked until AI settings are configured.");
    }
  }

  return {
    async status() {
      return withSession(async (session, provider) => ({
        online: isOnlineProvider(provider),
        providerName: provider.name,
        settings: toAiSettingsPayload(aiSettingsStore),
        session: session.sessionState(provider),
      }));
    },

    async appStatus() {
      return withSession(async (_session, provider) => ({
        online: isOnlineProvider(provider),
        providerName: provider.name,
        settings: toAiSettingsPayload(aiSettingsStore),
      }));
    },

    async session() {
      return withSession(async (session, provider) => ({
        ...session.sessionState(provider),
        locked: !toAiSettingsPayload(aiSettingsStore).configured,
        aiSettings: toAiSettingsPayload(aiSettingsStore),
      }));
    },

    async getAiSettings() {
      return {
        settings: toAiSettingsPayload(aiSettingsStore),
      };
    },

    async validateAiSettings(request: AiSettingsRequest) {
      const existing = aiSettingsStore.readSync();
      const effectiveSettings = normalizeAiSettingsRequest(request, existing);
      const validation = await validateDeepSeekConnection({
        ...options.deepseek,
        ...effectiveSettings,
      });
      return {
        settings: {
          configured: true,
          validated: true,
          apiKeyMasked: maskApiKey(effectiveSettings.apiKey),
          baseUrl: effectiveSettings.baseUrl,
          model: effectiveSettings.model,
          timeoutMs: effectiveSettings.timeoutMs,
          thinkingMode: effectiveSettings.thinkingMode,
          reasoningEffort: effectiveSettings.reasoningEffort,
          contextWindowTokens: effectiveSettings.contextWindowTokens,
          maxOutputTokens: effectiveSettings.maxOutputTokens,
        },
        validation,
      };
    },

    async saveAiSettings(request: AiSettingsRequest) {
      const existing = aiSettingsStore.readSync();
      const effectiveSettings = normalizeAiSettingsRequest(request, existing);
      if (!effectiveSettings.apiKey) {
        throw new Error("请先填写 DeepSeek API key。");
      }
      await aiSettingsStore.save(effectiveSettings);
      return withSession(async (session, provider) => ({
        settings: toAiSettingsPayload(aiSettingsStore),
        session: {
          ...session.sessionState(provider),
          locked: false,
          aiSettings: toAiSettingsPayload(aiSettingsStore),
        },
      }));
    },

    async clearAiSettings() {
      await aiSettingsStore.clear();
      return withSession(async (session, provider) => ({
        settings: toAiSettingsPayload(aiSettingsStore),
        session: {
          ...session.sessionState(provider),
          locked: true,
          aiSettings: toAiSettingsPayload(aiSettingsStore),
        },
      }));
    },

    async parseWorld(request: ApplyWorldDraftRequest) {
      ensureConfigured();
      return withSession(async (session) => session.parseWorld(request.draftText));
    },

    async applyWorld(request: ApplyWorldDraftRequest) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        await session.applyWorld(request);
        return {
          session: session.sessionState(provider),
        };
      });
    },

    async resetWorld() {
      ensureConfigured();
      return withSession(async (session) => session.resetWorld());
    },

    async runStage(request: RunStageRequest) {
      ensureConfigured();
      return withSession(async (session, provider, simulationProvider) => {
        const { result, runRecord } = await session.runStageWithProvider(request, simulationProvider);
        return {
          result,
          runRecord,
          session: session.sessionState(provider),
        };
      });
    },

    async runAuto(request: RunAutoStagesRequestPayload) {
      ensureConfigured();
      return withSession(async (session, provider, simulationProvider) => {
        const result = await session.runAuto(request, simulationProvider);
        return {
          ...result,
          session: session.sessionState(provider),
        };
      });
    },

    async runDaemonTick(request: RunDaemonTickRequest) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const daemon = new WorldDaemon({
          engine: session.getEngineForRuntime(),
          runStore,
          config: {
            worldId: "workbench-world",
            tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
            autonomy: {
              autoPromote: "never",
              requireAuthorOnCanonRisk: true,
              requireAuthorOnHardDecision: true,
            },
            storage: { runRoot: runtimeRoot, checkpointEveryStep: true },
          },
        });
        const result = await daemon.tick({
          reason: "manual",
          requestedBy: "author",
          directive: request.directive,
        });
        const run = await runStore.loadRun(result.runId);
        const stageResultRef = run.artifacts.refs.find((ref) => ref.refId === "simulation.stage-result");
        if (stageResultRef) {
          await session.syncRuntimeStageResult(JSON.parse(await readFile(stageResultRef.path, "utf8")) as StageResult, request.directive);
        }
        return {
          ...result,
          session: session.sessionState(provider),
        };
      });
    },

    async startRuntime(request: RuntimeStartRequest) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const daemon = getRuntimeDaemon(session);
        const runtime = daemon.start({
          targetTicks: request.targetTicks,
          directive: request.directive,
          reason: "scheduled",
          requestedBy: "daemon",
          tickDelayMs: request.tickDelayMs,
        });
        return {
          runtime,
          session: {
            ...session.sessionState(provider),
            runtimeDaemon: runtime,
          },
        };
      });
    },

    async pauseRuntime() {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const runtime = getRuntimeDaemon(session).pause();
        await syncRuntimeSnapshot(session);
        return {
          runtime,
          session: {
            ...session.sessionState(provider),
            runtimeDaemon: runtime,
          },
        };
      });
    },

    async resumeRuntime() {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const runtime = getRuntimeDaemon(session).resume();
        return {
          runtime,
          session: {
            ...session.sessionState(provider),
            runtimeDaemon: runtime,
          },
        };
      });
    },

    async runtimeStatus() {
      ensureConfigured();
      return withSession(async (session, provider) => {
        await syncRuntimeSnapshot(session);
        const runtime = getRuntimeDaemon(session).status();
        return {
          runtime,
          session: {
            ...session.sessionState(provider),
            runtimeDaemon: runtime,
          },
        };
      });
    },

    async waitForRuntimeIdle() {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const runtime = await getRuntimeDaemon(session).waitForIdle();
        await syncRuntimeSnapshot(session);
        return {
          runtime,
          session: {
            ...session.sessionState(provider),
            runtimeDaemon: runtime,
          },
        };
      });
    },

    async listRuns() {
      ensureConfigured();
      return {
        runs: await runStore.listRuns(),
      };
    },

    async getRunDetail(request: { runId: string }) {
      ensureConfigured();
      const run = await runStore.loadRun(request.runId);
      const stageResultRef = run.artifacts.refs.find((ref) => ref.refId === "simulation.stage-result");
      const stageResult = stageResultRef
        ? (JSON.parse(await readFile(stageResultRef.path, "utf8")) as StageResult)
        : undefined;
      return {
        run,
        gateDecisions: stageResult?.gateDecisions ?? [],
      };
    },

    async selectLine(request: { lineId: string }) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        await session.selectLine(request.lineId);
        return {
          session: session.sessionState(provider),
        };
      });
    },

    async promoteBranch(request: PromoteBranchRequest) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        await session.promoteBranch(request);
        return {
          session: session.sessionState(provider),
        };
      });
    },

    async plan(request: WorkbenchRequest = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const context = await session.buildContext(request.lineId, request.lens);
        const plan = await provider.planChapter(context);
        return {
          online: isOnlineProvider(provider),
          providerName: provider.name,
          plan,
          session: session.sessionState(provider),
        };
      });
    },

    async scenes(request: WorkbenchRequest = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const context = await session.buildContext(request.lineId, request.lens);
        const plan = await provider.planChapter(context);
        const sceneCards = await provider.expandScenes(context, plan);
        return {
          online: isOnlineProvider(provider),
          providerName: provider.name,
          plan,
          sceneCards,
          session: session.sessionState(provider),
        };
      });
    },

    async compose(request: WorkbenchRequest = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => session.compose(request, provider));
    },

    async assemble(request: WorkbenchRequest = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => session.assemble(request, provider));
    },

    async critique(request: WorkbenchRequest = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => session.critique(request, provider));
    },

    async rewrite(request: WorkbenchRequest) {
      ensureConfigured();
      return withSession(async (session, provider) => session.rewrite(request, provider));
    },

    async confirmFinal(request: ConfirmAuthorFinalRequest = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => session.confirmFinal(request, provider));
    },

    async memory(request: { lineId?: string } = {}) {
      ensureConfigured();
      return withSession(async (session) => session.memory(request.lineId));
    },

    async compileAtlas(request: { lineId?: string } = {}) {
      ensureConfigured();
      return withSession(async (session, provider) => {
        const result = await session.compileAtlas(request.lineId ?? "canon");
        return {
          ...result,
          session: session.sessionState(provider),
        };
      });
    },

    async atlasTree(request: { lineId?: string } = {}) {
      ensureConfigured();
      return withSession(async (session) => session.atlasTree(request.lineId));
    },

    async atlasFile(request: { lineId?: string; path: string }) {
      ensureConfigured();
      return withSession(async (session) => session.atlasFile(request.lineId, request.path));
    },
  };
}

export function createWorkbenchApiMiddleware(options: WorkbenchHandlersOptions = {}) {
  const handlers = createWorkbenchApiHandlers(options);

  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = request.url ?? "";
    if (!url.startsWith("/api/")) {
      next();
      return;
    }

    const parsedUrl = createUrl(url);

    try {
      if (request.method === "GET" && parsedUrl.pathname === "/api/writing/status") {
        sendJson(response, 200, await handlers.status());
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/app/status") {
        sendJson(response, 200, await handlers.appStatus());
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/session") {
        sendJson(response, 200, await handlers.session());
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/settings/ai") {
        sendJson(response, 200, await handlers.getAiSettings());
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/runs") {
        sendJson(response, 200, await handlers.listRuns());
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/runtime/status") {
        sendJson(response, 200, await handlers.runtimeStatus());
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname.startsWith("/api/runs/")) {
        sendJson(
          response,
          200,
          await handlers.getRunDetail({
            runId: decodeURIComponent(parsedUrl.pathname.split("/").at(-1) ?? ""),
          }),
        );
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/memory") {
        sendJson(response, 200, await handlers.memory({ lineId: parsedUrl.searchParams.get("lineId") ?? undefined }));
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/atlas/tree") {
        sendJson(response, 200, await handlers.atlasTree({ lineId: parsedUrl.searchParams.get("lineId") ?? undefined }));
        return;
      }
      if (request.method === "GET" && parsedUrl.pathname === "/api/atlas/file") {
        const path = parsedUrl.searchParams.get("path");
        if (!path) {
          sendJson(response, 400, { error: "Missing atlas file path" });
          return;
        }
        sendJson(
          response,
          200,
          await handlers.atlasFile({
            lineId: parsedUrl.searchParams.get("lineId") ?? undefined,
            path,
          }),
        );
        return;
      }

      if (request.method === "DELETE" && parsedUrl.pathname === "/api/settings/ai") {
        sendJson(response, 200, await handlers.clearAiSettings());
        return;
      }

      if (request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      const body = await readJsonBody(request);

      if (parsedUrl.pathname === "/api/settings/ai") {
        sendJson(
          response,
          200,
          await handlers.saveAiSettings({
            apiKey: String(body.apiKey ?? ""),
            baseUrl: String(body.baseUrl ?? ""),
            model: String(body.model ?? ""),
            timeoutMs: Number(body.timeoutMs ?? DEFAULT_DEEPSEEK_PROFILE.timeoutMs),
            thinkingMode: normalizeThinkingMode(body.thinkingMode),
            reasoningEffort: normalizeReasoningEffort(body.reasoningEffort),
            contextWindowTokens: Number(body.contextWindowTokens ?? DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens),
            maxOutputTokens: Number(body.maxOutputTokens ?? DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens),
          }),
        );
        return;
      }
      if (parsedUrl.pathname === "/api/settings/ai/validate") {
        sendJson(
          response,
          200,
          await handlers.validateAiSettings({
            apiKey: String(body.apiKey ?? ""),
            baseUrl: String(body.baseUrl ?? ""),
            model: String(body.model ?? ""),
            timeoutMs: Number(body.timeoutMs ?? DEFAULT_DEEPSEEK_PROFILE.timeoutMs),
            thinkingMode: normalizeThinkingMode(body.thinkingMode),
            reasoningEffort: normalizeReasoningEffort(body.reasoningEffort),
            contextWindowTokens: Number(body.contextWindowTokens ?? DEFAULT_DEEPSEEK_PROFILE.contextWindowTokens),
            maxOutputTokens: Number(body.maxOutputTokens ?? DEFAULT_DEEPSEEK_PROFILE.maxOutputTokens),
          }),
        );
        return;
      }
      if (parsedUrl.pathname === "/api/world/parse") {
        sendJson(response, 200, await handlers.parseWorld({ draftText: body.draftText ?? "" }));
        return;
      }
      if (parsedUrl.pathname === "/api/world/apply") {
        sendJson(response, 200, await handlers.applyWorld({ draftText: body.draftText ?? "" }));
        return;
      }
      if (parsedUrl.pathname === "/api/world/reset") {
        sendJson(response, 200, await handlers.resetWorld());
        return;
      }
      if (parsedUrl.pathname === "/api/simulation/run-stage") {
        sendJson(
          response,
          200,
          await handlers.runStage({
            stageLabel: body.stageLabel ?? "未命名阶段",
            focusCharacterIds: body.focusCharacterIds ?? [],
            intervention: body.intervention,
            qimenOverride: body.qimenOverride,
          }),
        );
        return;
      }
      if (parsedUrl.pathname === "/api/simulation/run-auto") {
        sendJson(
          response,
          200,
          await handlers.runAuto({
            targetStageCount: Number(body.targetStageCount ?? 1),
            stageLabel: body.stageLabel ?? "自动推进",
            focusCharacterIds: body.focusCharacterIds ?? [],
            intervention: body.intervention,
            qimenOverride: body.qimenOverride,
          }),
        );
        return;
      }
      if (parsedUrl.pathname === "/api/runtime/tick") {
        sendJson(response, 200, await handlers.runDaemonTick({ directive: body.directive }));
        return;
      }
      if (parsedUrl.pathname === "/api/runtime/start") {
        sendJson(
          response,
          200,
          await handlers.startRuntime({
            targetTicks: Number(body.targetTicks ?? 1),
            directive: body.directive,
            tickDelayMs: body.tickDelayMs === undefined ? undefined : Number(body.tickDelayMs),
          }),
        );
        return;
      }
      if (parsedUrl.pathname === "/api/runtime/pause") {
        sendJson(response, 200, await handlers.pauseRuntime());
        return;
      }
      if (parsedUrl.pathname === "/api/runtime/resume") {
        sendJson(response, 200, await handlers.resumeRuntime());
        return;
      }
      if (parsedUrl.pathname === "/api/runtime/status") {
        sendJson(response, 200, await handlers.runtimeStatus());
        return;
      }
      if (parsedUrl.pathname === "/api/simulation/select-line") {
        sendJson(response, 200, await handlers.selectLine({ lineId: body.lineId ?? "canon" }));
        return;
      }
      if (parsedUrl.pathname === "/api/simulation/promote-branch") {
        sendJson(response, 200, await handlers.promoteBranch({ branchId: body.branchId ?? "" }));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/plan") {
        sendJson(response, 200, await handlers.plan(body));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/scenes") {
        sendJson(response, 200, await handlers.scenes(body));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/compose") {
        sendJson(response, 200, await handlers.compose(body));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/assemble") {
        sendJson(response, 200, await handlers.assemble(body));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/critique") {
        sendJson(response, 200, await handlers.critique(body));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/rewrite") {
        sendJson(response, 200, await handlers.rewrite(body));
        return;
      }
      if (parsedUrl.pathname === "/api/writing/confirm-final") {
        sendJson(response, 200, await handlers.confirmFinal(body));
        return;
      }
      if (parsedUrl.pathname === "/api/atlas/compile") {
        sendJson(response, 200, await handlers.compileAtlas({ lineId: body.lineId }));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown workbench error";
      sendJson(response, 500, { error: message });
    }
  };
}
