import type {
  BranchEvaluation,
  CanonLine,
  CharacterAnchor,
  HistoryEvent,
  QimenContext,
  QimenModifier,
  RelationshipAnchor,
  StageDirective,
  TimelineLine,
  TruthEventRef,
} from "./domain";

export type ArtifactKind = "json" | "jsonl" | "markdown" | "text";

export type ArtifactRef = {
  refId: string;
  path: string;
  kind: ArtifactKind;
};

export type SimulationArtifacts = {
  rootDir: string;
  refs: ArtifactRef[];
};

export type SimulationStepKind =
  | "load-context"
  | "metaphysics-frame"
  | "activate-entities"
  | "generate-candidates"
  | "simulate-branches"
  | "evaluate-branches"
  | "canon-gate"
  | "memory-sync"
  | "read-model";

export type SimulationStepStatus = "started" | "completed" | "failed" | "paused";

export type SimulationStep = {
  stepId: string;
  kind: SimulationStepKind;
  status: SimulationStepStatus;
  startedAt: string;
  endedAt?: string;
  inputRefs: string[];
  outputRefs: string[];
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
};

export type SimulationRunStatus = "running" | "paused" | "completed" | "failed";

export type SimulationRun = {
  runId: string;
  worldId: string;
  lineId: string;
  baseCanonStageId?: string;
  status: SimulationRunStatus;
  createdAt: string;
  updatedAt: string;
  directive: StageDirective;
  steps: SimulationStep[];
  artifacts: SimulationArtifacts;
};

export type AuthorActionRequest = {
  actionId: string;
  reason: string;
  options: Array<{
    optionId: "accept" | "archive" | "reject" | "revise-directive";
    label: string;
    consequence: string;
  }>;
};

export type CanonGateDecision = {
  decisionId: string;
  runId: string;
  branchId: string;
  result: "accept-canon" | "archive-only" | "reject" | "ask-author";
  riskLevel: "low" | "medium" | "high" | "fatal";
  score: CanonGateScore;
  reasons: CanonGateReason[];
  requiredAuthorActions: AuthorActionRequest[];
};

export type CanonGateScore = {
  anchorCompliance: number;
  canonContinuity: number;
  worldRuleCompliance: number;
  characterContinuity: number;
  relationshipContinuity: number;
  metaphysicsFit: number;
  narrativeYield: number;
};

export type CanonGateReason = {
  code:
    | "anchor-violation"
    | "canon-contradiction"
    | "world-rule-violation"
    | "character-break"
    | "relationship-break"
    | "metaphysics-support"
    | "metaphysics-pressure"
    | "narrative-payoff"
    | "requires-author";
  severity: "info" | "warning" | "blocker";
  message: string;
  refs: TruthEventRef[];
};

export type WorldDaemonConfig = {
  worldId: string;
  tickPolicy: {
    mode: "manual" | "interval" | "chapter-progress" | "pressure-threshold";
    intervalMs?: number;
    maxTicksPerRun: number;
  };
  autonomy: {
    autoPromote: "never" | "safe-only" | "author-approved";
    requireAuthorOnCanonRisk: boolean;
    requireAuthorOnHardDecision: boolean;
  };
  storage: {
    runRoot: string;
    checkpointEveryStep: boolean;
  };
};

export type WorldTickInput = {
  directive?: StageDirective;
  reason: "manual" | "scheduled" | "pressure" | "resume";
  requestedBy: "author" | "daemon" | "test";
};

export type WorldTickResult = {
  runId: string;
  status: "completed" | "paused" | "failed";
  canonDecision?: CanonGateDecision;
  nextWake?: string;
};

export type RuntimeDaemonStartRequest = {
  targetTicks: number;
  directive?: StageDirective;
  reason: WorldTickInput["reason"];
  requestedBy: WorldTickInput["requestedBy"];
  tickDelayMs?: number;
};

export type RuntimeDaemonSnapshot = {
  active: boolean;
  paused: boolean;
  failed: boolean;
  completed: boolean;
  completedTicks: number;
  targetTicks: number;
  runIds: string[];
  lastRunId?: string;
  lastStageLabel?: string;
  pauseReason?: string;
  error?: string;
};

export type CharacterActionCandidate = {
  candidateId: string;
  characterId: string;
  action: string;
  intent: string;
  expectedGain: string;
  expectedCost: string;
  riskTags: string[];
  supportingInfluences: string[];
  violatesKnownAnchor: boolean;
};

export type SimulationRunSummary = {
  runId: string;
  status: SimulationRunStatus;
  worldId: string;
  lineId: string;
  stageLabel: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
};

export type CanonGateInput = {
  runId: string;
  parsedAnchors: {
    characterAnchors: CharacterAnchor[];
    relationshipAnchors: RelationshipAnchor[];
  };
  canonLine: CanonLine;
  candidateLine: TimelineLine;
  branchEvaluation: BranchEvaluation;
  qimenContext: QimenContext;
  qimenModifier: QimenModifier;
  events: HistoryEvent[];
};
