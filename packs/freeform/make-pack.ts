// packs/freeform/make-pack.ts — 配置驱动的世界工厂。
// 核心思想: 引擎(core/)+ 八字(命格)+ 奇门(天机)固定不变; 一个世界的"genre 皮"全部来自一份 WorldConfig 数据。
// 于是"换 genre"从"写 TS 包"降级为"填一份 config"(可由提示词 LLM 生成) → 任何人都能开新世界, 内核一行不改。
import type { ContentPack, ProgressionSystem, PriorSystem, PriorFrame, Influence, ScoredCandidate, FrameInput, StoryEvent } from "../../core/domain/pack";
import type { WorldSnapshot, WorldSpec, CharacterState, CandidateAction } from "../../core/domain/world";
import { hashStr } from "../../core/util/rng";
// 八字与奇门: 原样复用(核心先验, 一字不改)
import { natalOf, dayMasterElem, generates, controls, ELEM_CN } from "../xianxia-bazi/index";
import { qimenForecast } from "../xianxia-bazi/qimen";

function num(v: unknown, d: number): number {
  return typeof v === "number" ? v : d;
}
type DispAxis = "initiative" | "caution" | "harmony" | "discord";

// ── 一个世界 = 这份数据(可由提示词生成) ──
export interface WorldConfig {
  id: string;
  displayName: string;
  bible: string; // 世界设定纲要(喂开篇)
  protagonists: Array<{ name: string; faction: string; element?: string }>; // 主角(生辰由名字散列定→八字命格)
  factions: string[];
  locations: Array<{ id: string; name: string; yield: number }>; // yield=资源/机遇浓度
  tierNames: string[]; // 进阶阶梯(由低到高)
  // 十神命格 → 该世界的"志向"(label + 一句描述 + 主导轴)。键用十神格局名。
  goalMap: Record<string, { label: string; desc: string; axis: DispAxis }>;
  storyEvents: Array<{ name: string; summary: string; gatherAt?: string; crisis: string; stressDelta?: number; factionShifts?: Array<{ a: string; b: string; delta: number }> }>;
  arcs: string[]; // 长篇情境弧线
  composePrompt: string; // 作者文风提示词
  titleStyle?: string; // 章节标题风格(缺省给通用反"假"提示)
  spawnNames: string[]; // 动态登场人名池
  reviverNames: string[]; // 东山再起人名池
  moodWords?: [string, string, string, string]; // 心境四档(焚/动/省/澄), 缺省给通用
}

const DEFAULT_GOAL = { label: "立身", desc: "在这世道里站稳脚跟", axis: "caution" as DispAxis };

export function makePack(cfg: WorldConfig) {
  const LOC_IDS = cfg.locations.map((l) => l.id);
  const TIERS = cfg.tierNames.map((name, i) => ({ id: `t${i}`, name, order: i + 1 }));
  const LOCS: Record<string, { id: string; name: string; props: Record<string, unknown> }> = {};
  for (const l of cfg.locations) LOCS[l.id] = { id: l.id, name: l.name, props: { yield: l.yield } };
  const ELEMS = ["water", "fire", "earth", "metal", "wood"];
  const mood = cfg.moodWords ?? ["心绪如焚", "心潮起伏", "凝神盘算", "心境澄澈"];

  const goalFor = (ch: CharacterState): { label: string; desc: string; axis: DispAxis } => {
    if (typeof ch.props["avenge"] === "string") return { label: "复仇", desc: `向「${String(ch.props["avenge"])}」讨还`, axis: "discord" };
    return cfg.goalMap[natalOf(ch).pattern] ?? DEFAULT_GOAL;
  };
  const natalLabel = (ch: CharacterState): string => {
    const n = natalOf(ch);
    return `${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}·${n.pattern}·${n.trait}`;
  };
  const goalLabel = (ch: CharacterState): string => `志在${goalFor(ch).label}`;
  const describeMind = (ch: CharacterState, snap: WorldSnapshot): string => {
    const n = natalOf(ch);
    const g = goalFor(ch);
    const loc = snap.locations[ch.locationId ?? ""];
    const ln = loc?.name ?? "某处";
    const yld = typeof loc?.props["yield"] === "number" ? (loc.props["yield"] as number) : 0.5;
    const st = ch.narrativeStress;
    const m = st > 0.75 ? mood[0] : st > 0.5 ? mood[1] : st > 0.25 ? mood[2] : mood[3];
    const econ = yld >= 0.7 ? "此地资源汇聚，正好施展" : yld <= 0.4 ? "此地机会寡淡，难有作为" : "机遇平平";
    const av = typeof ch.props["avenge"] === "string" ? `　心里压着一笔账：找「${String(ch.props["avenge"])}」算清。` : "";
    return `${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}·${n.pattern}：「${n.trait}」之人。所求——${g.desc.replace(/[。.！!，,]$/, "")}。今在${ln}，${m}。${econ}。${av}`;
  };

  const progression: ProgressionSystem = {
    tiers: TIERS,
    canAdvance(char) {
      if (num(char.props["actCount"], 0) < 6) return { ok: false, gate: "bottleneck" };
      const ord = TIERS.findIndex((t) => t.id === char.progressionTier);
      if (num(char.props["resource"], 0) < (Math.max(0, ord) + 1) * 3) return { ok: false, gate: "lack-resource" };
      return { ok: true };
    },
  };

  function mkChar(id: string, name: string, faction: string, h: number, locId: string, tierIdx: number, elem?: string): CharacterState {
    const by = 1970 + (h % 45),
      bm = 1 + ((h >>> 6) % 12),
      bd = 1 + ((h >>> 10) % 27),
      bh = (h >>> 14) % 24;
    const c: CharacterState = {
      id,
      name,
      present: true,
      locationId: locId,
      progressionTier: TIERS[tierIdx]?.id ?? "t0",
      narrativeStress: 0.12 + (h % 35) / 100,
      traits: { initiative: 0, caution: 0 },
      lastSeenTick: 0,
      props: { actCount: 0, birthY: by, birthM: bm, birthD: bd, birthH: bh, element: elem ?? dayMasterElem(by, bm, bd), faction },
    };
    const disp = natalOf(c).disposition;
    c.traits = { initiative: disp.initiative, caution: disp.caution };
    return c;
  }

  function seedWorld(spec: WorldSpec): WorldSnapshot {
    const characters: Record<string, CharacterState> = {};
    cfg.protagonists.forEach((p, i) => {
      const h = hashStr(`${spec.seed}|${p.name}`) >>> 0;
      characters[`c${i + 1}`] = mkChar(`c${i + 1}`, p.name, p.faction, h, LOC_IDS[i % LOC_IDS.length] ?? LOC_IDS[0]!, 0, p.element ?? ELEMS[i % ELEMS.length]);
    });
    return {
      worldId: spec.worldId,
      lineId: "main",
      tick: 0,
      clock: { tick: 0 },
      characters,
      locations: { ...LOCS },
      props: { seed: spec.seed, factions: cfg.factions, factionRelations: {}, bible: cfg.bible },
    };
  }

  function spawnCharacter(seed: string, index: number): CharacterState {
    const h = hashStr(`${seed}|spawn|${index}`) >>> 0;
    const name = (cfg.spawnNames[index % cfg.spawnNames.length] ?? "路人") + (index >= cfg.spawnNames.length ? `·${Math.floor(index / cfg.spawnNames.length) + 1}` : "");
    const faction = cfg.factions[(h >>> 4) % cfg.factions.length] ?? cfg.factions[0] ?? "散众";
    return mkChar(`s${index}`, name, faction, h, LOC_IDS[(h >>> 2) % LOC_IDS.length] ?? LOC_IDS[0]!, (h >>> 8) % Math.min(6, TIERS.length));
  }
  function reviveFaction(faction: string, index: number): CharacterState {
    const h = hashStr(`revive|${faction}|${index}`) >>> 0;
    const c = mkChar(`s${index + 100}`, cfg.reviverNames[index % cfg.reviverNames.length] ?? "枭雄", faction, h, LOC_IDS[(h >>> 2) % LOC_IDS.length] ?? LOC_IDS[0]!, Math.min(4 + (h % 3), TIERS.length - 1));
    c.props["banner"] = `重振${faction}`;
    c.props["reviving"] = true;
    return c;
  }

  function divine(tick: number): { hint: string; valence: number } {
    const qm = qimenForecast(tick);
    const adv = qm.omen === "吉" ? "天机示喜：此局宜进、放手一搏" : qm.omen === "凶" ? "天机示警：此局宜避、强求恐败" : "天机示平：虚实难料，宜慎";
    return { hint: `${adv}（${qm.line}）`, valence: qm.omen === "吉" ? 0.6 : qm.omen === "凶" ? -0.6 : 0 };
  }
  function nextStoryEvent(_s: WorldSnapshot, tick: number): StoryEvent | null {
    if (cfg.storyEvents.length === 0) return null;
    // eventBias(模拟旋钮, 默认1=每20拍): >1 大事更频, <1 更疏。引擎中立; pack 读 props.tuning 决定节律。
    const tune = _s.props["tuning"];
    const eventBias = tune && typeof tune === "object" && typeof (tune as { eventBias?: unknown }).eventBias === "number" ? (tune as { eventBias: number }).eventBias : 1;
    const period = Math.max(6, Math.round(20 / Math.max(0.3, eventBias)));
    if (tick <= 0 || tick % period !== 0) return null;
    const ev = cfg.storyEvents[(Math.floor(tick / period) - 1 + cfg.storyEvents.length) % cfg.storyEvents.length]!;
    const qm = qimenForecast(tick);
    const outcome = qm.omen === "吉" ? "此局得天时、乘势者上" : qm.omen === "凶" ? "此局犯大凶，恐有反目折戟" : "此局虚实难料，胜负在人";
    return { id: `story-${tick}`, involve: "all", ...ev, summary: `${ev.summary}。${qm.line}`, crisis: `${ev.crisis}（${qm.line}；${outcome}）`, stressDelta: Math.min(0.5, (ev.stressDelta ?? 0.22) * qm.mult), outcome: { valence: qm.omen === "吉" ? 0.6 : qm.omen === "凶" ? -0.6 : 0 } };
  }

  const priorSystem: PriorSystem = {
    id: "bazi-qimen",
    axes: [
      { id: "initiative", opposes: "caution" },
      { id: "caution", opposes: "initiative" },
      { id: "harmony", opposes: "discord" },
      { id: "discord", opposes: "harmony" },
    ],
    buildFrame({ snapshot, tick }: FrameInput): PriorFrame {
      const qm = qimenForecast(tick);
      const lean = qm.omen === "吉" ? 1 : qm.omen === "凶" ? -1 : 0;
      const influences: Influence[] = [];
      const elements: Record<string, string> = {};
      if (lean !== 0) influences.push({ source: "qimen-day", axis: "initiative", polarity: lean, magnitude: 0.3, confidence: 0.5, scope: "global", note: qm.line });
      for (const ch of Object.values(snapshot.characters)) {
        if (!ch.present) continue;
        const natal = natalOf(ch);
        elements[ch.id] = typeof ch.props["element"] === "string" ? (ch.props["element"] as string) : natal.dayMasterElem;
        for (const axis of ["initiative", "caution", "harmony", "discord"] as const) {
          const w = natal.disposition[axis];
          if (w > 0) influences.push({ source: "bazi-pattern", axis, polarity: 1, magnitude: Math.min(0.8, w), confidence: 0.6, scope: "targeted", targetId: ch.id, note: `${ch.name}·${natal.pattern}` });
        }
        const g = goalFor(ch);
        const seasoning = 1 + Math.min(0.5, num(ch.props["历练"], 0) * 0.03);
        influences.push({ source: "goal", axis: g.axis, polarity: 1, magnitude: Math.min(0.95, 0.65 * seasoning), confidence: 0.7, scope: "targeted", targetId: ch.id, note: `${ch.name}志在${g.label}` });
      }
      const factions: Record<string, string> = {};
      for (const ch of Object.values(snapshot.characters)) if (ch.present && typeof ch.props["faction"] === "string") factions[ch.id] = ch.props["faction"] as string;
      return { frameId: `frame-${snapshot.worldId}-t${tick}`, packId: cfg.id, frameHash: hashStr(`${snapshot.worldId}|${tick}|${influences.length}`).toString(16), tick, influences, ext: { elements, factions, factionRel: (snapshot.props["factionRelations"] as Record<string, Record<string, number>>) ?? {} } };
    },
    scoreCandidate(candidate: CandidateAction, frame: PriorFrame): ScoredCandidate {
      let influence = 0;
      const contributing: Influence[] = [];
      for (const inf of frame.influences) {
        if (inf.scope === "targeted" && inf.targetId !== candidate.characterId) continue;
        const c = (candidate.axisHints[inf.axis] ?? 0) * inf.polarity * inf.magnitude * inf.confidence * 0.25;
        if (c !== 0) {
          influence += c;
          contributing.push(inf);
        }
      }
      const elements = (frame.ext?.["elements"] as Record<string, string> | undefined) ?? {};
      const target = candidate.targetIds?.[0];
      if (target) {
        const a = elements[candidate.characterId],
          b = elements[target];
        if (a && b) {
          const harmonious = a === b || generates(a) === b || generates(b) === a;
          const conflicting = controls(a) === b || controls(b) === a;
          if (harmonious && (candidate.axisHints["harmony"] ?? 0) > 0) {
            influence += 0.3;
            contributing.push({ source: "bazi-pair", axis: "harmony", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${ELEM_CN[a] ?? a}与${ELEM_CN[b] ?? b}相生` });
          }
          if (conflicting && (candidate.axisHints["discord"] ?? 0) > 0) {
            influence += 0.3;
            contributing.push({ source: "bazi-pair", axis: "discord", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${ELEM_CN[a] ?? a}与${ELEM_CN[b] ?? b}相克` });
          }
        }
        const facs = (frame.ext?.["factions"] as Record<string, string> | undefined) ?? {};
        const rel = (frame.ext?.["factionRel"] as Record<string, Record<string, number>> | undefined) ?? {};
        const fa = facs[candidate.characterId],
          fb = facs[target];
        if (fa && fb && fa !== fb) {
          const r = rel[fa]?.[fb] ?? 0;
          if (r > 0 && (candidate.axisHints["harmony"] ?? 0) > 0) {
            influence += Math.min(0.3, r * 0.1);
            contributing.push({ source: "faction", axis: "harmony", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${fa}与${fb}结盟` });
          }
          if (r < 0 && (candidate.axisHints["discord"] ?? 0) > 0) {
            influence += Math.min(0.3, -r * 0.1);
            contributing.push({ source: "faction", axis: "discord", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${fa}与${fb}交恶` });
          }
        }
      }
      const total = Math.max(0, Math.min(1, 0.5 + influence));
      return { candidate, weight: total, breakdown: { base: 0.5, influence, opposing: 0, bias: 0, total }, contributingInfluences: contributing, explain: `base 0.50 + 八字奇门先验 ${influence >= 0 ? "+" : ""}${influence.toFixed(3)}` };
    },
  };

  const pack: ContentPack = {
    id: cfg.id,
    displayName: cfg.displayName,
    seedWorld,
    spawnCharacter,
    nextStoryEvent,
    divine,
    reviveFaction,
    priorSystem,
    progression,
    arcs: cfg.arcs,
    traitAxes: [
      { id: "initiative", name: "进取", opposes: "caution" },
      { id: "caution", name: "持重", opposes: "initiative" },
      { id: "harmony", name: "亲和", opposes: "discord" },
      { id: "discord", name: "锋锐", opposes: "harmony" },
    ],
    agentProfile: {
      reflectPrompt(char, tick) {
        const n = natalOf(char);
        const g = goalFor(char);
        return `你是【${cfg.displayName}】世界的人物「${char.name}」(${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}·${n.pattern}、${n.trait}，志在${g.label}；身份:${TIERS.find((t) => t.id === char.progressionTier)?.name ?? TIERS[0]?.name}，心绪:${char.narrativeStress.toFixed(2)})。第${tick}回合，用不超过20字写此刻心境与下一步打算(须合${n.pattern}的性情与所求)，只回一句。`;
      },
    },
    eventVocab: {
      subsystems: [
        { id: "world", label: "风云" },
        { id: "agents", label: "心动" },
        { id: "gate", label: "抉择" },
        { id: "commit", label: "落定" },
        { id: "compose", label: "成文" },
      ],
      verbs: { CharacterEntered: "登场", StoryEventTriggered: "风云", CharacterFell: "出局", FactionDissolved: "并吞", FactionSplit: "分立", VengeanceResolved: "了断", ProgressionAdvanced: "晋阶", CharacterTranscended: "归隐", StageCommitted: "落定" },
    },
    composeProfile: {
      systemPrompt: cfg.composePrompt,
      titleStyle: cfg.titleStyle ?? "简洁、贴合本世界题材、有画面感的标题，可带悬念；避免文言对仗回目与堆砌并列短语，自然为先",
      toneTags: [cfg.displayName],
      sanitizer: { rules: [], stockImagery: [] },
      glossary: {},
    },
  };
  return { pack, natalLabel, goalLabel, describeMind };
}
