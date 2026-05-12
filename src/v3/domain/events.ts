// Layer 1 · pure types + helpers, zero IO.
// WorldEvent is the single source of truth for world-state changes.
// Every state transition emits one before its reducer applies it.

export type EventSubsystem =
  | "runtime"        // tick lifecycle (started / progress / succeeded / failed)
  | "frame"          // metaphysics frame built
  | "agents"         // character agent reflection / plan
  | "branches"       // branch candidates scored
  | "gate"           // canon gate verdict
  | "commit"         // world snapshot mutated
  | "compose"        // 6-stage chapter pipeline
  | "memory"         // memory write
  | "atlas"          // atlas (re)compile
  | "promotion"      // branch promoted to canon
  | "pause"          // daemon paused
  | "qimen"          // qimen pattern shift
  | "character-agent"; // legacy: kept so old world-events tests still pass

export type EventSeverity = "ambient" | "notable" | "decision-required";

export type EventStatus = "started" | "progress" | "succeeded" | "failed" | "blocked";

export type TickPhase =
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
  phase?: TickPhase | string;
  verb: string;
  subject: string;
  summary: string;
  refs?: Record<string, unknown>;
  expiresAt?: number;
};

export type EventFilter = {
  worldId?: string;
  runId?: string;
  chapterId?: string;
  subsystem?: EventSubsystem[];
  severity?: EventSeverity[];
  since?: number;
  until?: number;
  limit?: number;
};

// =============================================================================
// Verb dictionary — short literary verbs UI surfaces show to the author.
// Keys are stable; values are user-visible Chinese.
// =============================================================================
export const PHASE_VERBS: Record<TickPhase, string> = {
  frame: "起卦",
  agents: "心动",
  branches: "分流",
  gate: "裁决",
  commit: "落定",
  "memory-read": "取材",
  blueprint: "立骨",
  "scene-cards": "铺场",
  synthesize: "成文",
  review: "自审",
  inscribe: "入史",
};

export const PHASE_VERBS_ACTIVE: Record<TickPhase, string> = {
  frame: "起卦中",
  agents: "心动中",
  branches: "分流中",
  gate: "裁决中",
  commit: "落定中",
  "memory-read": "取材中",
  blueprint: "立骨中",
  "scene-cards": "铺场中",
  synthesize: "成文中",
  review: "自审中",
  inscribe: "入史中",
};

export const SUBSYSTEM_VERBS: Record<EventSubsystem, string> = {
  runtime: "推演",
  frame: "起卦",
  agents: "心动",
  branches: "分流",
  gate: "裁决",
  commit: "落定",
  compose: "成文",
  memory: "落册",
  atlas: "结图",
  promotion: "扶正",
  pause: "驻笔",
  qimen: "转盘",
  "character-agent": "心动",
};

export const RUNTIME_TICK_VERB = "推演";
export const RUNTIME_TICK_ACTIVE_VERB = "推演中";
export const PAUSE_VERB = "驻笔";
export const CONFIRM_FINAL_VERB = "入史";
export const IDLE_ACTIVE_VERB = "静观";

export function phaseVerb(phase: TickPhase, active = false): string {
  return active ? PHASE_VERBS_ACTIVE[phase] : PHASE_VERBS[phase];
}

export function subsystemVerb(subsystem: EventSubsystem): string {
  return SUBSYSTEM_VERBS[subsystem];
}

// =============================================================================
// Event id helpers — keep the same idempotency contract as legacy world-events.
// =============================================================================
export type EventIdInput = {
  subsystem: EventSubsystem;
  runId?: string;
  chapterId?: string;
  phase?: string;
  sourceRef?: string;
};

export function makeEventId(input: EventIdInput): string {
  const parts = [
    input.subsystem,
    input.runId ?? "",
    input.chapterId ?? "",
    input.phase ?? "",
    input.sourceRef ?? "",
  ];
  return parts.join(":");
}
