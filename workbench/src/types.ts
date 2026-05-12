// Shared types between the v3 backend (src/domain/*) and the workbench
// frontend. Re-exported here so the frontend doesn't have to reach into
// src/ directly (vite's @v3 alias would also work, but a re-export keeps
// the surface explicit).

export type EventSubsystem =
  | "runtime" | "frame" | "agents" | "branches" | "gate" | "commit"
  | "compose" | "memory" | "atlas" | "promotion" | "pause" | "qimen" | "character-agent";

export type EventSeverity = "ambient" | "notable" | "decision-required";
export type EventStatus = "started" | "progress" | "succeeded" | "failed" | "blocked";

export type WorldEvent = {
  id: string;
  ts: number;
  worldId?: string;
  runId?: string;
  chapterId?: string;
  sceneId?: string;
  subsystem: EventSubsystem;
  severity: EventSeverity;
  status: EventStatus;
  phase?: string;
  verb: string;
  subject: string;
  summary: string;
  refs?: Record<string, unknown>;
  expiresAt?: number;
};

export type DaemonStatus = {
  active: boolean;
  paused: boolean;
  completed: boolean;
  failed: boolean;
  threadId?: string;
  worldId?: string;
  completedTicks: number;
  targetTicks: number;
  runIds: string[];
  lastRunId?: string;
  lastStageLabel?: string;
  pauseReason?: string;
  error?: string;
};

export type CharacterStateLite = {
  name: string;
  faction: string;
  role: string;
  progress: number;
  pressure: number;
  lastAction: string;
  alive: boolean;
};

export type RelationshipStateLite = {
  left: string;
  right: string;
  status: string;
  trust: number;
  hostility: number;
};

export type WorldSnapshot = {
  worldId: string;
  stageId: string;
  stageNumber: number;
  characters: Record<string, CharacterStateLite>;
  relationships: Record<string, RelationshipStateLite>;
  worldFlags: string[];
};

export type ParsedCharacter = {
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

export type ParsedRelationship = {
  id: string;
  left: string;
  right: string;
  status: string;
  history: string;
  tension: string;
};

export type ParsedWorldDraft = {
  worldSpec: {
    genre: string;
    timeScale: string;
    cultivationSystem: string;
    worldRules: string[];
    factions: Array<{ name: string; description: string }>;
    locations: Array<{ name: string; description: string }>;
  };
  characters: ParsedCharacter[];
  relationships: ParsedRelationship[];
  characterAnchors: Array<{ characterId: string; cannot: string; mustTrend: string; stageGoal: string }>;
  relationshipAnchors: Array<{ relationshipId: string; left: string; right: string; boundary: string; trend: string }>;
};
