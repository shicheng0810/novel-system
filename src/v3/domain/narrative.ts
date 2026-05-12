// Layer 1 · narrative types. Pure shapes, zero IO.

import type { ParsedWorldDraft } from "./world";

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

export type SceneDraft = {
  sceneId: string;
  title: string;
  summary: string;
  text: string;
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
  chapterId: string;
  worldId: string;
  lineId: string;
  stageId?: string;
  status: "drafting" | "reviewed" | "inscribed" | "rejected";
  lens: NarrativeLens;
  plan?: ChapterPlan;
  scenes: SceneCard[];
  sceneDrafts: SceneDraft[];
  text: string;
  review?: ReviewReport;
  createdAt: number;
  updatedAt: number;
};

// =============================================================================
// Memory entry shapes — kept simple; persisted in memory_entries.payload_json
// =============================================================================
export type MemoryKind = "fact" | "expression" | "foreshadow" | "revision";

export type FactEntry = {
  kind: "fact";
  id: string;
  body: string;
  characterIds: string[];
  importance: number;
  source: { kind: "stage" | "chapter"; refId: string };
};

export type ExpressionEntry = {
  kind: "expression";
  id: string;
  body: string;
  characterIds: string[];
  toneTags: string[];
  source: { kind: "scene"; sceneId: string; chapterId: string };
};

export type ForeshadowEntry = {
  kind: "foreshadow";
  id: string;
  body: string;
  intendedPayoffStageId?: string;
  characterIds: string[];
  active: boolean;
};

export type RevisionEntry = {
  kind: "revision";
  id: string;
  body: string;
  prevSceneId: string;
  reason: string;
};

export type MemoryEntry = FactEntry | ExpressionEntry | ForeshadowEntry | RevisionEntry;

export type RecallRequest = {
  worldId: string;
  lineId: string;
  query: string;
  characterIds?: string[];
  kinds?: MemoryKind[];
  limit?: number;
};

export type RecallHit = {
  entry: MemoryEntry;
  scores: {
    keyword: number;
    recency: number;
    importance: number;
    semantic?: number;
    total: number;
  };
};

// Lightweight bundle — what the compose pipeline pulls per chapter.
export type NarrativeSourcePack = {
  worldId: string;
  lineId: string;
  parsed: ParsedWorldDraft;
  recentStageIds: string[];
  recalledMemoryIds: string[];
  hardFacts: string[];
  forbiddenMoves: string[];
};
