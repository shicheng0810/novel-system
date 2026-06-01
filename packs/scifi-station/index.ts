// packs/scifi-station/index.ts — 非修仙冒烟包(硬科幻·太空站)。
// 关键: 无 priorSystem(纯涌现, scoreCandidate 退化均匀)、无 lunar 依赖。
// 用同一引擎(core/)跑通 → 证明 §2.7 引擎↔内容包分离(换包 = 换这个对象, 引擎一行不改)。
import type { ContentPack, ProgressionSystem } from "../../core/domain/pack";
import type { WorldSnapshot, WorldSpec, CharacterState } from "../../core/domain/world";

function num(v: unknown, dflt: number): number {
  return typeof v === "number" ? v : dflt;
}

const progression: ProgressionSystem = {
  tiers: [
    { id: "crew", name: "船员", order: 1 },
    { id: "officer", name: "军官", order: 2 },
    { id: "captain", name: "舰长", order: 3 },
  ],
  canAdvance(char: CharacterState): { ok: boolean; gate?: string } {
    return num(char.props["actCount"], 0) >= 3 ? { ok: true } : { ok: false, gate: "trial" };
  },
};

function seedWorld(spec: WorldSpec): WorldSnapshot {
  const names = ["阿凛", "Kaye", "老周"];
  const characters: Record<string, CharacterState> = {};
  names.forEach((name, i) => {
    const id = `c${i + 1}`;
    characters[id] = {
      id,
      name,
      present: true,
      locationId: "bridge",
      progressionTier: "crew",
      narrativeStress: 0.1 * i,
      traits: { initiative: 0, caution: 0 },
      lastSeenTick: 0,
      props: { actCount: 0 },
    };
  });
  return {
    worldId: spec.worldId,
    lineId: "main",
    tick: 0,
    clock: { tick: 0, label: "启航" },
    characters,
    locations: { bridge: { id: "bridge", name: "舰桥", props: {} } },
    props: { seed: spec.seed, genre: "scifi" },
  };
}

export const scifiStationPack: ContentPack = {
  id: "scifi-station",
  displayName: "太空站生存(冒烟包, 无玄学 prior)",
  seedWorld,
  // priorSystem 省略 → 纯涌现(引擎用 uniform 权重)
  progression,
  traitAxes: [
    { id: "initiative", name: "果决", opposes: "caution" },
    { id: "caution", name: "审慎", opposes: "initiative" },
  ],
  eventVocab: {
    subsystems: [
      { id: "frame", label: "扫描" },
      { id: "agents", label: "决断" },
      { id: "commit", label: "执行" },
      { id: "director", label: "调度" },
    ],
    verbs: { RunStarted: "轮值起", AgentThought: "决断", StageCommitted: "执行", DirectorPlanned: "调度", RunCompleted: "轮值毕" },
  },
  composeProfile: {
    systemPrompt: "你是一位硬科幻作者，冷峻克制，以舰内事件为素材写连贯章节。",
    titleStyle: "冷峻简洁的标题，短句或名词短语，克制不渲染；不用文言对仗，不堆砌并列短语",
    toneTags: ["冷峻", "克制"],
    sanitizer: { rules: [], stockImagery: [] },
    glossary: {},
  },
  agentProfile: {
    reflectPrompt(char: CharacterState, tick: number): string {
      return `你是太空站船员「${char.name}」(职级:${char.progressionTier ?? "船员"}, 压力:${char.narrativeStress.toFixed(2)})。第${tick}轮，用不超过20字写此刻判断与下一步，只回一句。`;
    },
  },
};

export default scifiStationPack;
