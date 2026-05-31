// core/domain/pack.ts — 引擎 ↔ 内容包边界(纯类型, 零 genre 字面量)
// 引擎只认这些接口, 完全不知道任何具体 genre/先验体系是什么。
// 换包 = 提供一个新的 ContentPack 实现, runtime 一行不改。
import type { WorldSnapshot, WorldSpec, CharacterState, CandidateAction, CharacterId } from "./world";
import type { DomainEventKind } from "./events";

// ── 符号先验系统(内容包提供具体实现; 形状沿用旧 scoreCandidate, 冻结) ──
export interface Influence {
  source: string;          // packId 或子源(通用标签, 引擎不解释其语义)
  axis: string;            // 开放标签(pack 声明自己的轴集)
  polarity: number;        // -1..1 方向
  magnitude: number;       // 0..1 强度
  confidence: number;      // 0..1
  scope?: "global" | "targeted";
  targetId?: CharacterId;
  note?: string;
}

// 引擎对 PriorFrame 不解构(只读 influences); 包可在 ext 里放自己的盘面/中间态
export interface PriorFrame {
  frameId: string;
  packId: string;
  frameHash: string;       // deterministic; 入 events 供重放复用(不重算 prior)
  tick: number;
  influences: Influence[];
  ext?: Record<string, unknown>;
}

export interface ScoreBreakdown {
  base: number;
  influence: number;
  opposing: number;
  bias: number;
  total: number;
  [component: string]: number;   // 允许 pack 追加具名分量
}

export interface ScoredCandidate {
  candidate: CandidateAction;
  weight: number;                // 0..1
  breakdown: ScoreBreakdown;
  contributingInfluences: Influence[];
  explain: string;               // 可解释("为什么这个分支胜出"), 喂 CouncilCard
}

export interface FrameInput {
  snapshot: WorldSnapshot;
  tick: number;
}

export interface PriorSystem {
  id: string;
  axes: Array<{ id: string; opposes?: string }>;
  buildFrame(input: FrameInput): PriorFrame;                                    // deterministic, 无 LLM
  scoreCandidate(candidate: CandidateAction, frame: PriorFrame): ScoredCandidate; // 冻结形状
  explainInfluence?(inf: Influence): Promise<string>;                            // LLM 只在此"解释", 不"计算"
}

// ── 进阶/力量体系状态机(内容包配置为该 genre 的具体层级) ──
export interface TierDef {
  id: string;
  name: string;
  order: number;
}
export interface AdvanceGate {
  ok: boolean;
  gate?: string;                 // 'bottleneck' | 'trial' | ...(包定义的跃迁门)
}
export interface ProgressionSystem {
  tiers: TierDef[];              // 单调有序; 防 power-creep
  canAdvance(char: CharacterState, world: WorldSnapshot): AdvanceGate;
}

// ── trait-violation 张力的轴定义 ──
export interface TraitAxisDef {
  id: string;
  name: string;
  opposes?: string;
}

// ── anti-slop(理由 = 质量, 去 AI-tell) ──
export interface SlopRule {
  id: string;
  pattern: string;
  reason: string;
}
export interface AntiSlopFilter {
  rules: SlopRule[];
  stockImagery: string[];
}

// ── compose 风格(M2+) ──
export interface ComposeProfile {
  systemPrompt: string;          // 引擎不内嵌任何 genre 措辞; 全来自这里
  toneTags: string[];
  sanitizer: AntiSlopFilter;
  glossary: Record<string, string>; // 术语→人话(喂前端 tooltip)
}

// ── NL-storylet(作者用自然语言定义触发, 不写 DSL) ──
export interface Storylet {
  id: string;
  triggerNl: string;
  behavior: string;
  tensionEffect: number;
}

// ── 事件展示词典: 引擎产结构事件, pack 提供文案(verb) + subsystem 标签 ──
export interface EventVocab {
  subsystems: Array<{ id: string; label: string }>;
  verbs: Partial<Record<DomainEventKind, string>>;
}

// ── 系统级剧情事件(势力战争/秘境副本/魔道入侵…)──
export interface StoryEvent {
  id: string;
  name: string;
  summary: string;
  gatherAt?: string; // 涉事角色聚集地
  involve?: "all" | string[]; // 涉及全体 / 指定角色或势力
  stressDelta?: number;
  crisis?: string; // 设为当前世界危机(喂章节)
  factionShifts?: Array<{ a: string; b: string; delta: number }>; // 派系关系增量(+结盟 / -交恶)
  omen?: "吉" | "平" | "凶"; // 奇门吉凶 → 决定大事结果(引擎据此施加进展/折损)
}

// ── 内容包总接口 ──
export interface ContentPack {
  id: string;
  displayName: string;
  seedWorld(spec: WorldSpec): WorldSnapshot;
  priorSystem?: PriorSystem;     // 可空 = 纯涌现包(scoreCandidate 退化为均匀权重)
  progression: ProgressionSystem;
  traitAxes: TraitAxisDef[];
  eventVocab: EventVocab;
  composeProfile?: ComposeProfile; // M2+ 才需
  storylets?: Storylet[];          // M4+ 才需
  // 角色认知的 genre 提示词(引擎不内嵌任何 genre 措辞; 全来自这里)
  agentProfile?: { reflectPrompt(char: CharacterState, tick: number): string };
  // 世界扩张: 动态生成新角色(配角/对手/势力), 由 longrun/导演定期调用并经 input 加入世界
  spawnCharacter?(seed: string, index: number): CharacterState;
  // 系统级剧情事件: 引擎每 tick 问 pack 是否起一桩大事(影响多角色/全局)
  nextStoryEvent?(snapshot: WorldSnapshot, tick: number): StoryEvent | null;
  // 奇门为"作者裁决"提供吉凶建议(议事栏显示 + 无人值守时据此自动裁决)
  divine?(tick: number): { hint: string; omen: "吉" | "平" | "凶" };
  // 被吞并的派系: 残部拥立枭雄复兴(longrun 在吞并数章后调用; 版图有兴有衰)
  reviveFaction?(faction: string, index: number): CharacterState;
  // 长篇情境弧线(genre 场景序列, 喂 longrun 的 sceneFor; 缺省则用 longrun 内置)
  arcs?: string[];
}
