// core/domain/events.ts — 事件代数(纯类型, 零 genre 字面量)
// DomainEvent = 写侧产物(强类型自包含, 可重放); WorldEventRecord = 落盘/SSE 行。
// 展示字段(subsystem/verb/summary)的文案由 pack.eventVocab 提供; 引擎本身 genre-agnostic。
import type { WorldId, LineId, CharacterId, RunId, EventId, FrameId } from "./world";

export type Severity = "ambient" | "notable" | "decision-required";

// 选中候选后对世界状态的通用增量(commit 应用; 引擎不需懂 genre 语义)
export interface StateDelta {
  characterId?: CharacterId;
  set?: Record<string, unknown>;
  note?: string;
}

// ── DomainEvent: 判别联合, payload 强类型自包含 ──────────────────────
export type DomainEvent =
  | { kind: "RunStarted"; runId: RunId; tick: number }
  | { kind: "RunCompleted"; runId: RunId; tick: number }
  | { kind: "RunFailed"; runId: RunId; tick: number; error: string }
  | { kind: "FrameDerived"; frameId: FrameId; packId: string; frameHash: string }
  | { kind: "AgentThought"; characterId: CharacterId; candidateIds: string[] }
  | { kind: "CandidatesScored"; scored: Array<{ candidateId: string; weight: number }>; chosenId: string | null }
  | { kind: "GateEvaluated"; chosenId: string | null; verdict: "pass" | "ask-author" | "blocked"; violations: string[] }
  | { kind: "StageCommitted"; stageNumber: number; chosenCandidateId: string; deltas: StateDelta[]; summary: string }
  | { kind: "DirectorPlanned"; tickIndex: number; arcPhase: string; tension: number; focus: CharacterId[]; compose: boolean }
  | { kind: "DecisionRequired"; decisionId: string; branchId: string; options: string[]; summary: string; hint: string }
  | { kind: "AuthorRuled"; decisionId: string; verdict: "accept" | "reject" | "revise"; note?: string }
  | { kind: "BranchPromoted"; branchId: string; intoLineId: LineId }
  | { kind: "BranchArchived"; branchId: string; reason: string }
  | { kind: "MemoryRecorded"; entryId: string; characterId: CharacterId | null; memoryKind: string; body: string; importance: number }
  | { kind: "CharacterEntered"; characterId: CharacterId; name: string; faction: string }
  | { kind: "StoryEventTriggered"; eventId: string; name: string; summary: string }
  | { kind: "CharacterFell"; characterId: CharacterId; name: string; cause: string }
  | { kind: "FactionDissolved"; faction: string; into: string }
  | { kind: "VengeanceResolved"; characterId: CharacterId; avenged: string; outcome: string }
  | { kind: "CharacterTranscended"; characterId: CharacterId; name: string; toTier: string }
  | { kind: "ChapterDrafted"; chapterId: string; goal: string }
  | { kind: "ChapterInscribed"; chapterId: string; sceneIds: string[] }
  | { kind: "ChapterCritiqued"; chapterId: string; slopFlags: string[] }
  | { kind: "ForeshadowPlanted"; foreshadowId: string; nodeId: string }
  | { kind: "ForeshadowPaid"; foreshadowId: string; payoffStageId: string }
  | { kind: "ProgressionAdvanced"; characterId: CharacterId; fromTier: string; toTier: string };

export type DomainEventKind = DomainEvent["kind"];

// ── WorldEventRecord: 落盘/SSE 行(= DomainEvent + 展示字段 + 标识), 对齐 schema.events ──
export interface WorldEventRecord {
  seq?: number;                      // DB 赋(AUTOINCREMENT)
  id: EventId;                       // 幂等键 subsystem:runId:phase:sourceRef
  worldId: WorldId;
  lineId?: LineId;
  tick?: number;
  kind: DomainEventKind;
  subsystem: string;
  severity: Severity;
  verb?: string;
  subject?: string;
  summary?: string;
  payload: DomainEvent;              // 完整强类型 payload(可重放)
  refs?: Record<string, unknown>;
  ts: number;
}

// kind → (subsystem, 默认 severity)。subsystem 全 genre-agnostic;verb/summary 文案走 pack.eventVocab。
export const EVENT_SUBSYSTEM: Record<DomainEventKind, { subsystem: string; severity: Severity }> = {
  RunStarted: { subsystem: "runtime", severity: "ambient" },
  RunCompleted: { subsystem: "runtime", severity: "ambient" },
  RunFailed: { subsystem: "runtime", severity: "notable" },
  FrameDerived: { subsystem: "frame", severity: "ambient" },
  AgentThought: { subsystem: "agents", severity: "ambient" },
  CandidatesScored: { subsystem: "branches", severity: "ambient" },
  GateEvaluated: { subsystem: "gate", severity: "notable" },
  StageCommitted: { subsystem: "commit", severity: "notable" },
  DirectorPlanned: { subsystem: "director", severity: "ambient" },
  DecisionRequired: { subsystem: "gate", severity: "decision-required" },
  AuthorRuled: { subsystem: "author", severity: "notable" },
  BranchPromoted: { subsystem: "promotion", severity: "notable" },
  BranchArchived: { subsystem: "promotion", severity: "ambient" },
  MemoryRecorded: { subsystem: "memory", severity: "ambient" },
  CharacterEntered: { subsystem: "world", severity: "notable" },
  StoryEventTriggered: { subsystem: "world", severity: "notable" },
  CharacterFell: { subsystem: "world", severity: "notable" },
  FactionDissolved: { subsystem: "world", severity: "notable" },
  VengeanceResolved: { subsystem: "world", severity: "notable" },
  CharacterTranscended: { subsystem: "world", severity: "notable" },
  ChapterDrafted: { subsystem: "compose", severity: "ambient" },
  ChapterInscribed: { subsystem: "compose", severity: "notable" },
  ChapterCritiqued: { subsystem: "compose", severity: "ambient" },
  ForeshadowPlanted: { subsystem: "canon", severity: "ambient" },
  ForeshadowPaid: { subsystem: "canon", severity: "notable" },
  ProgressionAdvanced: { subsystem: "progression", severity: "notable" },
};
