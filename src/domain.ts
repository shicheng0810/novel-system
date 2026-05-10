import type { CanonGateDecision } from "./runtime-types";

export type Faction = {
  name: string;
  description: string;
};

export type Location = {
  name: string;
  description: string;
};

export type WorldSpec = {
  genre: string;
  timeScale: string;
  cultivationSystem: string;
  worldRules: string[];
  factions: Faction[];
  locations: Location[];
};

export type CharacterProfile = {
  id: string;
  name: string;
  description?: string;
  baziRaw?: string;
  archetypeDraft?: string;
  faction: string;
  role: string;
  traits: string[];
  goal: string;
  stance: string;
  resource: string;
};

export type CharacterInput = Pick<
  CharacterProfile,
  | "id"
  | "name"
  | "description"
  | "baziRaw"
  | "archetypeDraft"
  | "faction"
  | "role"
  | "traits"
  | "goal"
  | "stance"
  | "resource"
>;

export type RelationshipProfile = {
  id: string;
  left: string;
  right: string;
  status: string;
  history: string;
  tension: string;
};

export type CharacterAnchor = {
  characterId: string;
  cannot: string;
  mustTrend: string;
  stageGoal: string;
};

export type RelationshipAnchor = {
  relationshipId: string;
  left: string;
  right: string;
  boundary: string;
  trend: string;
};

export type ParsedWorldDraft = {
  worldSpec: WorldSpec;
  characters: CharacterProfile[];
  relationships: RelationshipProfile[];
  characterAnchors: CharacterAnchor[];
  relationshipAnchors: RelationshipAnchor[];
};

export type CharacterState = {
  name: string;
  faction: string;
  role: string;
  traits: string[];
  goal: string;
  stance: string;
  resource: string;
  progress: number;
  pressure: number;
  lastAction: string;
  alive: boolean;
  notes: string[];
  candidateId: string;
  fateProfile: FateProfile;
  currentFortune: FortuneCycle;
};

export type RelationshipState = {
  key: string;
  left: string;
  right: string;
  status: string;
  trust: number;
  hostility: number;
  notes: string[];
};

export type WorldSnapshot = {
  stageId: string;
  characters: Record<string, CharacterState>;
  relationships: Record<string, RelationshipState>;
  worldFlags: string[];
};

export type HistoryEvent = {
  id: string;
  stageId: string;
  branchId?: string;
  title: string;
  summary: string;
  participants: string[];
  tags: string[];
  stateChanges: string[];
};

export type SimulationStage = {
  id: string;
  stageLabel: string;
  focusCharacterIds: string[];
  intervention?: string;
  inputConstraints: string[];
  events: HistoryEvent[];
  snapshot: WorldSnapshot;
  qimenContext: QimenContext;
  qimenModifier: QimenModifier;
  metaphysicsExplanation: MetaphysicsExplanation;
  writingContextRef?: {
    sourceStageId: string;
    eventIds: string[];
    qimenFocus: string;
  };
};

export type BranchEvaluation = {
  branchId: string;
  title: string;
  passesConsistencyGate: boolean;
  recommended: boolean;
  scores: {
    consistency: number;
    fateConsistency: number;
    fortunePressure: number;
    spectacle: number;
    pacing: number;
    qimenTimingImpact: number;
    qimenOutcomeImpact: number;
    total: number;
  };
  reasons: string[];
  risks: string[];
  metaphysicsExplanation: MetaphysicsExplanation;
};

export type TimelineLine = {
  lineId: string;
  kind: "canon" | "branch";
  label: string;
  stages: SimulationStage[];
  events: HistoryEvent[];
  snapshots: Record<string, WorldSnapshot>;
  parentLineId?: string;
  sourceStageId?: string;
  branchId?: string;
};

export type ArchivedTimeline = {
  lineId: string;
  label: string;
  eventCount: number;
  stageCount: number;
};

export type CanonLine = TimelineLine & {
  kind: "canon";
  archivedTimelines: ArchivedTimeline[];
  branchHistory: Array<{
    branchId: string;
    promotedAtStageId: string;
    replacedLineId: string;
  }>;
};

export type StageDirective = {
  stageLabel: string;
  focusCharacterIds: string[];
  intervention?: string;
  qimenOverride?: Partial<QimenContext> & {
    allowHardDecision?: boolean;
  };
};

export type RunAutoStagesRequest = StageDirective & {
  targetStageCount: number;
};

export type NarrativeLens = {
  focusCharacterIds: string[];
  style: string;
  stageRange: string[];
  chapterGoal?: string;
  narratorMode?: "omniscient-ensemble";
  proseStyle?: "web-xianxia-ensemble";
  targetLength?: [number, number];
  sceneCount?: 3 | 4 | 5 | 6 | 7 | 8;
  factConstraint?: "strict" | "medium-expansion";
};

export type StageResult = {
  canonStage: SimulationStage;
  branchEvaluations: BranchEvaluation[];
  gateDecisions?: CanonGateDecision[];
};

export type BaziChart = {
  raw: string;
  pillars: string[];
  dominantElements: string[];
  tenGodHints: string[];
  favorableElements: string[];
  unfavorableElements: string[];
};

export type ArchetypeProfile = {
  raw: string;
  dominantElements: string[];
  disposition: string;
  destinyThemes: string[];
};

export type FateProfile = {
  candidateId: string;
  sourceMode: "bazi" | "archetype" | "inferred";
  label: string;
  dominantElements: string[];
  temperament: string;
  pressureResponse: string;
  relationshipStyle: string;
  initiative: number;
  discipline: number;
  opportunism: number;
  volatility: number;
  explainSummary: string;
};

export type FortuneCycle = {
  cycleLabel: string;
  momentum: "rising" | "steady" | "strained" | "volatile";
  favorability: number;
  manifestationTheme: string;
  riskBias: string;
};

export type MetaphysicsExplanation = {
  summary: string;
  fateLayer: string;
  fortuneLayer: string;
  qimenLayer: string;
};

export type BaziCandidate = {
  id: string;
  label: string;
  sourceMode: FateProfile["sourceMode"];
  baziChart?: BaziChart;
  archetypeProfile?: ArchetypeProfile;
  fateProfile: FateProfile;
  scores: {
    characterFit: number;
    worldConsistency: number;
    destinyClarity: number;
    dramaPotential: number;
    relationshipTension: number;
    total: number;
  };
  explanation: MetaphysicsExplanation;
};

export type QimenContext = {
  sourceMode: "auto" | "manual" | "hybrid";
  pattern: string;
  locationFocus: string;
  eventType: string;
  strongSituationScore: number;
  allowHardDecision?: boolean;
};

export type QimenModifier = {
  timingShift: "advance" | "delay" | "redirect" | "steady";
  outcomeBias: "boost" | "drag" | "twist" | "steady";
  timingWeight: number;
  outcomeWeight: number;
  hardDecision?: {
    type: "timing" | "outcome";
    verdict: string;
  };
};

export type WritingDirective = {
  chapterGoal?: string;
  narratorMode?: "omniscient-ensemble";
  proseStyle?: "web-xianxia-ensemble";
  targetLength?: [number, number];
  sceneCount?: 3 | 4 | 5 | 6 | 7 | 8;
  factConstraint?: "strict" | "medium-expansion";
};

export type NarrativeSourcePack = {
  lineId: string;
  lineLabel: string;
  stageIds: string[];
  selectedEventIds: string[];
  events: HistoryEvent[];
  qimenContext: QimenContext;
  qimenModifier: QimenModifier;
  metaphysicsExplanation: MetaphysicsExplanation;
  worldPressureSummary: string;
  palaceSummary: string;
  characterSummaries: string[];
  relationshipSummaries: string[];
  hardFacts: string[];
  softExpansionBudget: string[];
  forbiddenMoves: string[];
  chapterInputView?: ChapterInputView;
  memoryPack?: NarrativeMemoryPack;
};

export type ChapterPlan = {
  chapterTitle?: string;
  chapterGoal: string;
  stageRange: string[];
  mainConflict: string;
  secondaryConflict: string;
  closingHook: string;
  sceneOrder: string[];
  summary: string;
};

export type SceneCard = {
  id: string;
  order: number;
  location: string;
  time: string;
  participants: string[];
  sceneGoal: string;
  conflict: string;
  hardFacts: string[];
  softExpansionBudget: string[];
  transitionIn: string;
  transitionOut: string;
  focusCue: string;
};

export type WritingRunRecord = {
  step: "planner" | "scene-card" | "composer" | "reviewer";
  promptVersion: string;
  modelName: string;
  inputSummary: string;
  rawOutput: string;
  conclusion: string;
  requestMode?: "structured-tool" | "plain-text" | "json-fallback";
  finishReason?: string;
  retryCount?: number;
  fallbackUsed?: "json-fallback";
};

export type SceneDraft = {
  sceneId: string;
  title: string;
  summary: string;
  text: string;
  runRecord: WritingRunRecord;
};

export type ReviewReport = {
  passed: boolean;
  issues: string[];
  warnings: string[];
  styleNotes: string[];
  factCoverage: number;
  suggestedRewrites: string[];
};

export type ChapterDraft = {
  plan: ChapterPlan;
  sceneDrafts: SceneDraft[];
  chapterText: string;
  review: ReviewReport;
  runRecords: WritingRunRecord[];
};

export type NarrativeDraft = ChapterDraft & {
  focusCharacterIds: string[];
  selectedEventIds: string[];
  sceneIds: string[];
  planSummary: string;
  sceneSummaries: string[];
  sourcePack: NarrativeSourcePack;
  text: string;
};

export type TruthEventRef = {
  causationId?: string;
  characterIds: string[];
  relationshipKeys: string[];
  factionNames: string[];
  locationNames: string[];
};

export type TruthEvent = HistoryEvent & {
  lineId: string;
  sequence: number;
  refs: TruthEventRef;
};

export type WorldSnapshotCheckpoint = {
  lineId: string;
  stageId: string;
  sequence: number;
  eventIds: string[];
  snapshot: WorldSnapshot;
};

export type StageBatch = {
  lineId: string;
  stage: SimulationStage;
  truthEvents: TruthEvent[];
  checkpoint: WorldSnapshotCheckpoint;
};

export type TimelineHead = {
  lineId: string;
  sequence: number;
  latestStageId: string;
  latestSnapshotStageId: string;
};

export type BranchForkRecord = {
  branchId: string;
  parentLineId: string;
  sourceStageId: string;
  forkedAtSequence: number;
};

export type CanonHeadRef = {
  activeLineId: string;
  archivedLineIds: string[];
};

export type CharacterStateView = {
  id: string;
  name: string;
  faction: string;
  role: string;
  stance: string;
  lastAction: string;
  pressure: number;
  progress: number;
  currentFortune: FortuneCycle;
};

export type RelationshipStateView = {
  key: string;
  left: string;
  right: string;
  status: string;
  trust: number;
  hostility: number;
};

export type FactionStateView = {
  name: string;
  memberIds: string[];
  pressureTags: string[];
};

export type LocationStateView = {
  name: string;
  stageIds: string[];
  pressureSummary: string;
};

export type ForeshadowView = {
  id: string;
  lineId: string;
  stageId: string;
  summary: string;
  relatedCharacterIds: string[];
  relatedEventIds: string[];
};

export type ChapterInputView = {
  lineId: string;
  stageIds: string[];
  eventIds: string[];
  characterViews: CharacterStateView[];
  relationshipViews: RelationshipStateView[];
  factionViews: FactionStateView[];
  locationViews: LocationStateView[];
  foreshadowViews: ForeshadowView[];
  hardFacts: string[];
  worldPressureSummary: string;
};

export type FactMemoryEntry = {
  id: string;
  lineId: string;
  stageId: string;
  eventId: string;
  summary: string;
  characterIds: string[];
  relationshipKeys: string[];
  factionNames: string[];
  locationNames: string[];
};

export type ExpressionMemorySource = "critic-pass" | "author-final";

export type ExpressionMemoryEntry = {
  id: string;
  lineId: string;
  sceneId: string;
  stageId: string;
  eventIds: string[];
  characterIds: string[];
  relationshipKeys: string[];
  summary: string;
  text: string;
  toneTags: string[];
  voiceTags: string[];
  conflictTags: string[];
  hookTags: string[];
  source: ExpressionMemorySource;
  active: boolean;
};

export type ForeshadowMemoryEntry = {
  id: string;
  lineId: string;
  stageId: string;
  summary: string;
  eventIds: string[];
  characterIds: string[];
  status: "open" | "paid-off";
};

export type RevisionRecord = {
  id: string;
  lineId: string;
  sceneId: string;
  replacedExpressionId: string;
  replacementExpressionId: string;
  summary: string;
};

export type NarrativeMemoryPack = {
  lineId: string;
  factEntries: FactMemoryEntry[];
  expressionEntries: ExpressionMemoryEntry[];
  foreshadowEntries: ForeshadowMemoryEntry[];
  revisionEntries: RevisionRecord[];
};

export type MemoryRetrievalRequest = {
  lineId: string;
  focusCharacterIds: string[];
  stageIds: string[];
};

export type WritingStage =
  | "memory-read"
  | "blueprint"
  | "scene-expand"
  | "synthesize"
  | "critique"
  | "rewrite"
  | "memory-write"
  | "atlas-compile";

export type SimulationCharacterUpdate = {
  characterId: string;
  lastAction: string;
  progressDelta: number;
  pressureDelta: number;
  note?: string;
  stance?: string;
  alive?: boolean;
};

export type SimulationRelationshipUpdate = {
  left: string;
  right: string;
  status: string;
  note?: string;
};

export type SimulationEventProposal = {
  title: string;
  summary: string;
  participants: string[];
  tags: string[];
  stateChanges: string[];
};

export type BranchProposal = {
  title: string;
  event: SimulationEventProposal;
  spectacle: number;
  pacing: number;
  reasons: string[];
  risks: string[];
  recommended?: boolean;
  characterUpdates: SimulationCharacterUpdate[];
  relationshipUpdates: SimulationRelationshipUpdate[];
  qimenOverride?: Partial<QimenContext> & {
    allowHardDecision?: boolean;
  };
};

export type SimulationStageProposal = {
  canon: {
    event: SimulationEventProposal;
    characterUpdates: SimulationCharacterUpdate[];
    relationshipUpdates: SimulationRelationshipUpdate[];
    qimenOverride?: Partial<QimenContext> & {
      allowHardDecision?: boolean;
    };
  };
  branches: BranchProposal[];
};

export type SimulationProviderContext = {
  parsed: ParsedWorldDraft;
  canonLine: CanonLine;
  directive: StageDirective;
  nextStageNumber: number;
};

export type SimulationModelProvider = {
  readonly name: string;
  readonly modelName: string;
  simulateStage(context: SimulationProviderContext): Promise<{
    proposal: SimulationStageProposal;
    runRecord: RunRecord;
  }>;
};

export type JobStageRun = {
  stage: WritingStage;
  providerName: string;
  modelName: string;
  summary: string;
  outputRef?: string;
  error?: string;
};

export type RunRecord = JobStageRun & {
  promptVersion?: string;
  rawOutput?: string;
  requestMode?: "structured-tool" | "plain-text" | "json-fallback";
  finishReason?: string;
  retryCount?: number;
  fallbackUsed?: "json-fallback";
  validationResult?: string;
};

export type ResumeCheckpoint = {
  completedStages: WritingStage[];
  state: Record<string, unknown>;
};

export type WritingProviderContext = {
  line: TimelineLine;
  lens: NarrativeLens;
  sourcePack: NarrativeSourcePack;
  memoryPack: NarrativeMemoryPack;
};

export type WritingModelProvider = {
  readonly name: string;
  readonly modelName: string;
  planChapter(context: WritingProviderContext): Promise<ChapterPlan>;
  expandScenes(context: WritingProviderContext, plan: ChapterPlan): Promise<SceneCard[]>;
  synthesizeProse(
    context: WritingProviderContext,
    plan: ChapterPlan,
    sceneCards: SceneCard[],
  ): Promise<ChapterDraft>;
  critiqueChapter(context: WritingProviderContext, draft: ChapterDraft): Promise<ReviewReport>;
  assembleChapter?(
    context: WritingProviderContext,
    draft: ChapterDraft,
  ): Promise<ChapterDraft>;
  rewriteSegment?(
    context: WritingProviderContext,
    draft: ChapterDraft,
    sceneId: string,
    instructions: string[],
  ): Promise<ChapterDraft>;
};

export type AtlasCompilationRequest = {
  line: TimelineLine;
  memoryPack: NarrativeMemoryPack;
  changedStageIds: string[];
};

export type AtlasCompilationResult = {
  lineId: string;
  updatedFiles: string[];
};

export function pairKey(left: string, right: string): string {
  return `${left}::${right}`;
}

export function createCharacterId(name: string): string {
  return name.trim();
}

export function normalizeBulletLine(line: string): string {
  return line.replace(/^\s*-\s*/, "").trim();
}

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
