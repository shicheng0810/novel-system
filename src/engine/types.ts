// Layer 3 · shared types for the tick engine.

import type { CanonGateDecision } from "../domain/canon";
import type {
  ParsedWorldDraft,
  Stage,
  StageDirective,
  WorldSnapshot,
} from "../domain/world";
import type { MetaphysicsFrame } from "../domain/metaphysics";
import type { ChapterDraft, NarrativeLens } from "../domain/narrative";
import type { CandidateAction, ScoredCandidate } from "../metaphysics/prior";
import type { Reflection } from "../agents/character";

import type { EventBus } from "../services/event-bus";
import type { WorldStore } from "../services/world-store";
import type { MemoryService } from "../services/memory-service";
import type { AtlasService } from "../services/atlas-service";
import type { LLMProvider } from "../services/llm/types";
import type { AgentRegistry } from "../agents/registry";

export type TickRequest = {
  worldId: string;
  threadId: string;
  tickIndex: number;
  directive: StageDirective;
  compose?: boolean;
  lens?: NarrativeLens;        // required when compose=true
};

export type TickPhaseId =
  | "frame"
  | "agents"
  | "branches"
  | "gate"
  | "commit"
  | "memory-read"
  | "blueprint"
  | "scene-cards"
  | "synthesize"
  | "review"
  | "inscribe";

export type TickContext = {
  request: TickRequest;
  runId: string;
  bus: EventBus;
  worldStore: WorldStore;
  memory: MemoryService;
  atlas: AtlasService;
  registry: AgentRegistry;
  llm: LLMProvider;
  parsed: ParsedWorldDraft;
  snapshot: WorldSnapshot;     // mutable; phases can mutate then commit calls save
};

export type FramePhaseResult = { frame: MetaphysicsFrame };

export type AgentsPhaseResult = {
  reflections: Reflection[];
  candidates: CandidateAction[];
};

export type BranchesPhaseResult = {
  scored: ScoredCandidate[];
  chosen: ScoredCandidate;
};

export type GatePhaseResult = {
  decision: CanonGateDecision;
};

export type CommitPhaseResult = {
  stage: Stage;
};

export type ComposePhaseResult = {
  draft: ChapterDraft;
};

export type TickResult = {
  runId: string;
  status: "completed" | "paused" | "failed" | "blocked";
  pauseReason?: string;
  stage?: Stage;
  chapterId?: string;
  decision?: CanonGateDecision;
  framesEmitted: number;
  events: number;             // total events emitted this tick
};
