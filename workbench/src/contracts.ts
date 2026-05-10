import type {
  BranchEvaluation,
  ChapterDraft,
  NarrativeDraft,
  NarrativeLens,
  NarrativeMemoryPack,
  ParsedWorldDraft,
  RunAutoStagesRequest as RunAutoStagesRequestBase,
  StageDirective,
  StageResult,
  TimelineLine,
  WorldSpec,
  CharacterProfile,
  RelationshipProfile,
  CharacterAnchor,
  RelationshipAnchor,
} from "../../src/domain";
import type { MetaphysicsFrame } from "../../src/metaphysics/frame";
import type {
  CanonGateDecision,
  RuntimeDaemonSnapshot,
  SimulationRun,
  SimulationRunSummary,
  WorldTickResult,
} from "../../src/runtime-types";
import type { DeepSeekReasoningEffort, DeepSeekThinkingMode } from "../../src/deepseek-profile";
export type { SimulationRunSummary } from "../../src/runtime-types";

export type WorkbenchWorkspace = "writing" | "simulation" | "runtime" | "world" | "memory" | "atlas";

export type ApplyWorldDraftRequest = {
  draftText: string;
};

export type RunStageRequest = StageDirective;

export type RunAutoStagesRequest = RunAutoStagesRequestBase;

export type RunDaemonTickRequest = {
  directive?: StageDirective;
};

export type RuntimeStartRequest = {
  targetTicks: number;
  directive?: StageDirective;
  tickDelayMs?: number;
};

export type PromoteBranchRequest = {
  branchId: string;
};

export type ConfirmAuthorFinalRequest = {
  lineId?: string;
  sceneId?: string;
  draft?: ChapterDraft | NarrativeDraft;
};

export type AiSettingsPayload = {
  configured: boolean;
  validated: boolean;
  apiKeyMasked?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  thinkingMode?: DeepSeekThinkingMode;
  reasoningEffort?: DeepSeekReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  updatedAt?: string;
};

export type SaveAiSettingsRequest = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  thinkingMode?: DeepSeekThinkingMode;
  reasoningEffort?: DeepSeekReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
};

export type WorkbenchLineSummary = {
  lineId: string;
  label: string;
  kind: TimelineLine["kind"];
  latestStageId?: string;
  eventCount: number;
  recommended?: boolean;
  sourceStageId?: string;
};

export type SimulationStageView = {
  canonStageId: string;
  stageLabel: string;
  focusCharacterIds: string[];
  intervention?: string;
  branchEvaluations: BranchEvaluation[];
};

export type SimulationStatePayload = {
  selectedLineId: string;
  selectedStageId?: string;
  lines: WorkbenchLineSummary[];
  stages: SimulationStageView[];
  latestBranchEvaluations: BranchEvaluation[];
  branchHistory: Array<{
    branchId: string;
    promotedAtStageId: string;
    replacedLineId: string;
  }>;
  selectedLine?: WorkbenchLineSummary;
};

export type WorldDraftPreview = {
  ok: boolean;
  error?: string;
  parsed?: ParsedWorldDraft;
  worldSpec?: WorldSpec;
  characters: CharacterProfile[];
  relationships: RelationshipProfile[];
  characterAnchors: CharacterAnchor[];
  relationshipAnchors: RelationshipAnchor[];
  counts: {
    characters: number;
    relationships: number;
    characterAnchors: number;
    relationshipAnchors: number;
  };
};

export type MemoryPanelPayload = NarrativeMemoryPack;

export type AtlasTreeNode = {
  path: string;
  name: string;
  kind: "directory" | "file";
};

export type AtlasFilePayload = {
  lineId: string;
  path: string;
  content: string;
};

export type RunDaemonTickResponse = WorldTickResult & {
  session: WorkbenchSessionState;
};

export type ListRunsResponse = {
  runs: SimulationRunSummary[];
};

export type RunDetailResponse = {
  run: SimulationRun;
  gateDecisions: CanonGateDecision[];
  metaphysicsFrame?: MetaphysicsFrame;
};

export type WorkbenchSessionState = {
  online: boolean;
  providerName: string;
  draftApplied: boolean;
  appliedDraftText: string;
  selectedLineId: string;
  selectedStageId?: string;
  selectedSceneId?: string;
  lens: NarrativeLens;
  simulation: SimulationStatePayload;
  worldPreview: WorldDraftPreview;
  currentDraft?: NarrativeDraft;
  atlasUpdatedFiles: string[];
  aiSettings?: AiSettingsPayload;
  locked?: boolean;
  simulationAutoRun?: {
    active: boolean;
    targetStages: number;
    completedStages: number;
    lastStageLabel?: string;
    lastCompletedStageId?: string;
  };
  runtimeDaemon?: RuntimeDaemonSnapshot;
  latestSimulationRun?: {
    summary: string;
    finishReason?: string;
    requestMode?: string;
  };
};

export type WorkbenchRequest = {
  lineId?: string;
  lens?: Partial<NarrativeLens>;
  draft?: ChapterDraft | NarrativeDraft;
  directive?: StageDirective;
  sceneId?: string;
  instructions?: string[];
  draftText?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  thinkingMode?: DeepSeekThinkingMode;
  reasoningEffort?: DeepSeekReasoningEffort;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  stageLabel?: string;
  focusCharacterIds?: string[];
  intervention?: string;
  qimenOverride?: RunStageRequest["qimenOverride"];
  targetStageCount?: number;
  branchId?: string;
};

export type ComposeResponse = {
  online: boolean;
  providerName: string;
  draft: NarrativeDraft;
  session: WorkbenchSessionState;
};

export type ConfirmFinalResponse = {
  lineId: string;
  updatedFiles: string[];
  session: WorkbenchSessionState;
};

export type RunStageResponse = {
  result: StageResult;
  session: WorkbenchSessionState;
};

export type RuntimeDaemonResponse = {
  runtime: RuntimeDaemonSnapshot;
  session: WorkbenchSessionState;
};
