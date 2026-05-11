export type WorldEventSubsystem =
  | "runtime"
  | "compose"
  | "memory"
  | "atlas"
  | "canon"
  | "character-agent"
  | "qimen"
  | "promotion"
  | "pause";

export type WorldEventSeverity = "ambient" | "notable" | "decision-required";

export type WorldEventStatus =
  | "started"
  | "progress"
  | "succeeded"
  | "failed"
  | "blocked";

export type WorldEvent = {
  id: string;
  ts: number;
  chapterId?: string;
  runId?: string;
  sceneId?: string;
  subsystem: WorldEventSubsystem;
  severity: WorldEventSeverity;
  phase?: string;
  verb: string;
  subject: string;
  summary: string;
  refs?: Record<string, unknown>;
  status: WorldEventStatus;
  expiresAt?: number;
};

export type WorldEventFilter = {
  chapterId?: string;
  runId?: string;
  subsystem?: WorldEventSubsystem[];
  severity?: WorldEventSeverity[];
  since?: number;
  limit?: number;
};
