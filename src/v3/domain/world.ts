// Layer 1 · world types. Pure shapes, zero IO.

export type Faction = { name: string; description: string };
export type Location = { name: string; description: string };

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
  worldId: string;
  stageId: string;
  stageNumber: number;
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

export type Stage = {
  stageId: string;
  worldId: string;
  lineId: string;
  stageNumber: number;
  stageLabel: string;
  ts: number;
  events: HistoryEvent[];
  snapshot: WorldSnapshot;
};

export type StageDirective = {
  stageLabel: string;
  focusCharacterIds: string[];
  intervention?: string;
  qimenOverride?: {
    pattern?: string;
    locationFocus?: string;
    eventType?: string;
    allowHardDecision?: boolean;
  };
};

export function emptySnapshot(worldId: string): WorldSnapshot {
  return {
    worldId,
    stageId: "init",
    stageNumber: 0,
    characters: {},
    relationships: {},
    worldFlags: [],
  };
}

export function cloneSnapshot(snapshot: WorldSnapshot): WorldSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;
}
