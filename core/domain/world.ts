// core/domain/world.ts — genre-agnostic 世界类型(纯类型, 零 IO, 零 genre 字面量)
// 引擎只认这些通用结构; 任何 genre 专属数据都塞进 props / pack 命名空间, 引擎不解构。

export type WorldId = string;
export type LineId = string;
export type CharacterId = string;
export type RunId = string;
export type EventId = string;
export type FrameId = string;

export interface WorldClock {
  tick: number;
  // 抽象时间; 内容包把它映射到自己的历法(引擎不解释具体历法)
  epochMs?: number;
  label?: string;
}

export interface CharacterState {
  id: CharacterId;
  name: string;
  present: boolean;                  // 是否在场(lazy-instantiate: false = 远景/塌缩)
  locationId?: string;
  // 进阶层级 id: 内容包把它实例化为该 genre 的具体层级; 引擎只见通用字符串
  progressionTier?: string;
  // trait-violation 张力(逆本性行动累积); 轴由 pack 的 traitAxes 定义
  narrativeStress: number;
  traits: Record<string, number>;    // axisId -> value(pack 定义的轴)
  summary?: string;                  // 远景塌缩时的摘要(rehydrate 用)
  lastSeenTick?: number;
  props: Record<string, unknown>;    // 包专属数据挂这里
}

export interface LocationState {
  id: string;
  name: string;
  props: Record<string, unknown>;
}

export interface WorldSnapshot {
  worldId: WorldId;
  lineId: LineId;
  tick: number;
  clock: WorldClock;
  characters: Record<CharacterId, CharacterState>;
  locations: Record<string, LocationState>;
  props: Record<string, unknown>;    // 世界级包专属数据(势力/设定/历史…)
}

// 角色 agent 每 tick 产出的候选行动(投进 input_queue, 不直接改世界)
export interface CandidateAction {
  id: string;
  characterId: CharacterId;
  kind: string;                      // move | speak | act | ...(包/引擎约定)
  summary: string;
  axisHints: Record<string, number>; // 该行动在各 trait 轴上的倾向(供 trait-violation + prior 打分)
  targetIds?: string[];
  payload: Record<string, unknown>;
}

// 初始化世界的输入(内容包的 seedWorld 消费)
export interface WorldSpec {
  worldId: WorldId;
  packId: string;
  seed: string;                      // 确定性种子
  config: Record<string, unknown>;   // 包专属初始配置
}
