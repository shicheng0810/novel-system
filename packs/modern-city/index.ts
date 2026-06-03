// packs/modern-city/index.ts — 现代都市内容包。
// 关键: 八字(命格)与奇门(天机)【完全复用 xianxia 包, 一字不改】, 只把"世界皮"换成现代——
//   现代人也有生辰八字→命格→性情→志向; 奇门照样推演大事吉凶; 只是场景从修仙变都市名利场。
// 证明 §2.7: 同一引擎 + 同一套八字奇门先验, 换一层世界内容即换 genre。
import type { ContentPack, ProgressionSystem, PriorSystem, PriorFrame, Influence, ScoredCandidate, FrameInput, StoryEvent } from "../../core/domain/pack";
import type { WorldSnapshot, WorldSpec, CharacterState, CandidateAction } from "../../core/domain/world";
import { hashStr } from "../../core/util/rng";
// ↓↓↓ 八字与奇门, 原样复用 xianxia 包(核心先验不变) ↓↓↓
import { natalOf, dayMasterElem, generates, controls, ELEM_CN } from "../xianxia-bazi/index";
import { qimenForecast, plateLabel } from "../xianxia-bazi/qimen";

// 奇门给"抉择"出吉凶建议(逻辑同 xianxia, 奇门本体 qimenForecast 一字不改)
function divine(tick: number): { hint: string; valence: number } {
  const qm = qimenForecast(tick);
  const adv = qm.omen === "吉" ? "奇门示喜：此局宜进、放手一搏" : qm.omen === "凶" ? "奇门示警：此局宜避、强求恐败" : "奇门示平：此局虚实难料，宜慎勿躁";
  return { hint: `${adv}（${qm.line}）`, valence: qm.omen === "吉" ? 0.6 : qm.omen === "凶" ? -0.6 : 0 };
}

function num(v: unknown, d: number): number {
  return typeof v === "number" ? v : d;
}
type DispAxis = "initiative" | "caution" | "harmony" | "discord";

// ── 命格 → 现代志向(八字命格不变, 只把"志"翻译成都市语汇) ──
type GoalKind = "上位" | "搞钱" | "复仇" | "结缘" | "治学";
const GOAL_DEF: Record<GoalKind, { axis: DispAxis; mag: number; desc: string }> = {
  上位: { axis: "initiative", mag: 0.7, desc: "攀上更高位、执掌权柄" },
  搞钱: { axis: "initiative", mag: 0.6, desc: "逐利搏机、积累财富" },
  复仇: { axis: "discord", mag: 0.8, desc: "向仇敌讨还、不死不休" },
  结缘: { axis: "harmony", mag: 0.6, desc: "结交贵人、缔结良缘" },
  治学: { axis: "caution", mag: 0.6, desc: "钻研立身、不负所学" },
};
// 十神格局 → 现代之志(八字定命, 命亦定其所求)
const PATTERN_GOAL: Record<string, GoalKind> = {
  七杀格: "上位", 伤官格: "上位", 劫财: "搞钱", 偏财格: "搞钱", 正财格: "搞钱",
  正官格: "上位", 比肩: "治学", 偏印格: "治学", 正印格: "治学", 食神格: "结缘",
};
function goalOf(ch: CharacterState): GoalKind {
  if (typeof ch.props["avenge"] === "string") return "复仇";
  return PATTERN_GOAL[natalOf(ch).pattern] ?? "上位";
}
export function natalLabel(ch: CharacterState): string {
  const n = natalOf(ch);
  return `${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}·${n.pattern}·${n.trait}`;
}
export function goalLabel(ch: CharacterState): string {
  return `志在${goalOf(ch)}`;
}
export { plateLabel };

// ── 名望阶梯(现代版"境界", 进阶机制不变: 阅历 + 资源门槛) ──
const TIERS = [
  { id: "rookie", name: "素人" },
  { id: "fresh", name: "新秀" },
  { id: "rising", name: "崭露头角" },
  { id: "known", name: "小有名气" },
  { id: "core", name: "业界中坚" },
  { id: "elite", name: "名流新贵" },
  { id: "tycoon", name: "翘楚巨擘" },
  { id: "legend", name: "一代教父" },
].map((t, i) => ({ ...t, order: i + 1 }));
const progression: ProgressionSystem = {
  tiers: TIERS,
  canAdvance(char: CharacterState): { ok: boolean; gate?: string } {
    if (num(char.props["actCount"], 0) < 6) return { ok: false, gate: "bottleneck" };
    const ord = TIERS.findIndex((t) => t.id === char.progressionTier);
    const cost = (Math.max(0, ord) + 1) * 3;
    if (num(char.props["resource"], 0) < cost) return { ok: false, gate: "lack-resource" };
    return { ok: true };
  },
};

// ── 场所(现代, 各有"机遇"浓度=资源, 现代版"灵气") ──
const LOCATIONS: Record<string, { id: string; name: string; props: Record<string, unknown> }> = {
  "loc-tower": { id: "loc-tower", name: "CBD 写字楼", props: { yield: 0.7 } },
  "loc-incub": { id: "loc-incub", name: "创业孵化器", props: { yield: 0.6 } },
  "loc-club": { id: "loc-club", name: "顶层会所", props: { yield: 0.9 } },
  "loc-bar": { id: "loc-bar", name: "精酿酒吧", props: { yield: 0.4 } },
  "loc-loft": { id: "loc-loft", name: "江景公寓", props: { yield: 0.5 } },
  "loc-cafe": { id: "loc-cafe", name: "独立咖啡馆", props: { yield: 0.3 } },
  "loc-port": { id: "loc-port", name: "国际机场", props: { yield: 0.6 } },
};
const LOC_IDS = Object.keys(LOCATIONS);
const FACTIONS = ["云图科技", "鼎晖资本", "星岚传媒", "自由职业", "灰产圈", "学院派"];

// ── 系统级大事(都市版; 吉凶仍由【奇门】qimenForecast 推演, 不变) ──
const STORY_EVENTS: Array<Omit<StoryEvent, "id" | "outcome">> = [
  { name: "资本寒冬", summary: "资本骤然收紧，各家裁员收缩、人人自危", gatherAt: "loc-tower", crisis: "资本寒冬，现金为王，去留见人心", stressDelta: 0.28, factionShifts: [{ a: "鼎晖资本", b: "云图科技", delta: -2 }] },
  { name: "并购传闻", summary: "云图科技拟收购星岚传媒，暗流汹涌、各方博弈", gatherAt: "loc-club", crisis: "并购传闻四起，站队即站命", stressDelta: 0.24, factionShifts: [{ a: "云图科技", b: "星岚传媒", delta: -3 }, { a: "云图科技", b: "鼎晖资本", delta: 1 }] },
  { name: "绯闻爆料", summary: "一桩顶流绯闻被狗仔爆出，舆论哗然、公关连夜灭火", gatherAt: "loc-bar", crisis: "绯闻爆料引爆热搜，名声反噬", stressDelta: 0.22, factionShifts: [{ a: "星岚传媒", b: "灰产圈", delta: -2 }] },
  { name: "IPO 敲钟", summary: "云图科技远赴敲钟上市，一夜造就无数财富神话", gatherAt: "loc-tower", crisis: "IPO 敲钟在即，造富与套牢一线", stressDelta: 0.2, factionShifts: [{ a: "云图科技", b: "鼎晖资本", delta: 2 }] },
  { name: "政商风波", summary: "一场政商风波牵连甚广，灰产圈首当其冲、人人喊打", gatherAt: "loc-port", crisis: "政商风波骤起，墙倒众人推", stressDelta: 0.3, factionShifts: [{ a: "灰产圈", b: "云图科技", delta: -3 }, { a: "灰产圈", b: "鼎晖资本", delta: -2 }, { a: "云图科技", b: "学院派", delta: 1 }] },
  { name: "天使轮融资", summary: "孵化器里几个年轻人拿到天使轮，意气风发、群雄侧目", gatherAt: "loc-incub", crisis: "天使轮花落谁家，新贵崛起", stressDelta: 0.18, factionShifts: [] },
];
function nextStoryEvent(_snapshot: WorldSnapshot, tick: number): StoryEvent | null {
  if (tick <= 0 || tick % 20 !== 0) return null;
  const ev = STORY_EVENTS[(Math.floor(tick / 20) - 1) % STORY_EVENTS.length]!;
  const qm = qimenForecast(tick); // ← 奇门遁甲推演大事吉凶, 与修仙包一字不差
  const outcome = qm.omen === "吉" ? "此局得天时、乘势者上，机缘暗藏" : qm.omen === "凶" ? "此局犯大凶，恐有反目折戟、满盘皆输" : "此局虚实难料，胜负在人谋";
  return { id: `story-${tick}`, involve: "all", ...ev, summary: `${ev.summary}。${qm.line}`, crisis: `${ev.crisis}（${qm.line}；${outcome}）`, stressDelta: Math.min(0.5, (ev.stressDelta ?? 0.2) * qm.mult), outcome: { valence: qm.omen === "吉" ? 0.6 : qm.omen === "凶" ? -0.6 : 0 } };
}

// ── 动态登场 / 东山再起 ──
const SPAWN_NAMES = ["陈骁", "Linda", "老钱", "苏曼", "K 总", "阿杰", "周婷", "Victor", "马总", "小野", "雷子", "顾盼"];
const REVIVER_NAMES = ["东山客", "复盘人", "归零者", "卷土生", "翻盘侠", "再起君"];
function makeModern(seedIdx: number, h: number, name: string): CharacterState {
  const by = 1970 + (h % 40),
    bm = 1 + ((h >>> 6) % 12),
    bd = 1 + ((h >>> 10) % 27),
    bh = (h >>> 14) % 24;
  const faction = FACTIONS[(h >>> 4) % FACTIONS.length] ?? "自由职业";
  const locId = LOC_IDS[(h >>> 2) % LOC_IDS.length] ?? "loc-tower";
  const tierIdx = (h >>> 8) % Math.min(6, TIERS.length);
  const c: CharacterState = {
    id: `s${seedIdx}`,
    name,
    present: true,
    locationId: locId,
    progressionTier: TIERS[tierIdx]?.id ?? "rookie",
    narrativeStress: 0.15 + (h % 40) / 100,
    traits: { initiative: 0, caution: 0 },
    lastSeenTick: 0,
    props: { actCount: 0, birthY: by, birthM: bm, birthD: bd, birthH: bh, element: dayMasterElem(by, bm, bd), faction },
  };
  const disp = natalOf(c).disposition; // ← 八字命格定性情(复用)
  c.traits = { initiative: disp.initiative, caution: disp.caution };
  return c;
}
function spawnCharacter(seed: string, index: number): CharacterState {
  const h = hashStr(`${seed}|spawn|${index}`) >>> 0;
  const name = (SPAWN_NAMES[index % SPAWN_NAMES.length] ?? "路人") + (index >= SPAWN_NAMES.length ? `·其${Math.floor(index / SPAWN_NAMES.length) + 1}` : "");
  return makeModern(index, h, name);
}
function reviveFaction(faction: string, index: number): CharacterState {
  const h = hashStr(`revive|${faction}|${index}`) >>> 0;
  const c = makeModern(index + 100, h, REVIVER_NAMES[index % REVIVER_NAMES.length] ?? "枭雄");
  c.progressionTier = TIERS[Math.min(4 + (h % 3), TIERS.length - 1)]?.id ?? c.progressionTier;
  c.props["faction"] = faction;
  c.props["banner"] = `重振${faction}`;
  c.props["reviving"] = true;
  return c;
}

// ── 实时"心声"(命格不变, 措辞现代) ──
export function describeMind(ch: CharacterState, snapshot: WorldSnapshot): string {
  const n = natalOf(ch);
  const g = goalOf(ch);
  const loc = snapshot.locations[ch.locationId ?? ""];
  const locName = loc?.name ?? "城中某处";
  const yld = typeof loc?.props["yield"] === "number" ? (loc.props["yield"] as number) : 0.5;
  const st = ch.narrativeStress;
  const mood = st > 0.75 ? "焦头烂额、几近崩盘" : st > 0.5 ? "心潮起伏、势在必得" : st > 0.25 ? "盘算权衡" : "云淡风轻";
  const econ = yld >= 0.7 ? "此地资源人脉云集，正好下注" : yld <= 0.4 ? "此地机会寡淡，难有作为" : "机遇平平";
  const av = typeof ch.props["avenge"] === "string" ? `　心里压着一笔账：要找「${String(ch.props["avenge"])}」算清。` : "";
  return `${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}日主·${n.pattern}：「${n.trait}」之人。所求——${GOAL_DEF[g].desc}。今在${locName}，${mood}。${econ}。${av}`;
}

// ── 先验系统(八字命格 + 五行生克 + 奇门天时, 全复用 xianxia 逻辑; 仅志向标签现代化) ──
const priorSystem: PriorSystem = {
  id: "bazi-qimen", // 同一套先验
  axes: [
    { id: "initiative", opposes: "caution" },
    { id: "caution", opposes: "initiative" },
    { id: "harmony", opposes: "discord" },
    { id: "discord", opposes: "harmony" },
  ],
  buildFrame({ snapshot, tick }: FrameInput): PriorFrame {
    const qm = qimenForecast(tick); // 奇门天时
    const lean = qm.omen === "吉" ? 1 : qm.omen === "凶" ? -1 : 0;
    const influences: Influence[] = [];
    const elements: Record<string, string> = {};
    if (lean !== 0) influences.push({ source: "qimen-day", axis: "initiative", polarity: lean, magnitude: 0.3, confidence: 0.5, scope: "global", note: qm.line });
    for (const ch of Object.values(snapshot.characters)) {
      if (!ch.present) continue;
      const natal = natalOf(ch); // 八字命格(不变)
      const elem = typeof ch.props["element"] === "string" ? (ch.props["element"] as string) : natal.dayMasterElem;
      elements[ch.id] = elem;
      for (const axis of ["initiative", "caution", "harmony", "discord"] as const) {
        const w = natal.disposition[axis];
        if (w > 0) influences.push({ source: "bazi-pattern", axis, polarity: 1, magnitude: Math.min(0.8, w), confidence: 0.6, scope: "targeted", targetId: ch.id, note: `${ch.name}·${natal.pattern}` });
      }
      const gk = goalOf(ch);
      const gd = GOAL_DEF[gk];
      const seasoning = 1 + Math.min(0.5, num(ch.props["历练"], 0) * 0.03);
      influences.push({ source: "goal", axis: gd.axis, polarity: 1, magnitude: Math.min(0.95, gd.mag * seasoning), confidence: 0.7, scope: "targeted", targetId: ch.id, note: `${ch.name}志在${gk}` });
    }
    const frameHash = hashStr(`${snapshot.worldId}|${tick}|${influences.length}`).toString(16);
    const factions: Record<string, string> = {};
    for (const ch of Object.values(snapshot.characters)) if (ch.present && typeof ch.props["faction"] === "string") factions[ch.id] = ch.props["faction"] as string;
    const factionRel = (snapshot.props["factionRelations"] as Record<string, Record<string, number>>) ?? {};
    return { frameId: `frame-${snapshot.worldId}-t${tick}`, packId: "modern-city", frameHash, tick, influences, ext: { elements, factions, factionRel } };
  },
  scoreCandidate(candidate: CandidateAction, frame: PriorFrame): ScoredCandidate {
    let influence = 0;
    const contributing: Influence[] = [];
    for (const inf of frame.influences) {
      if (inf.scope === "targeted" && inf.targetId !== candidate.characterId) continue;
      const hint = candidate.axisHints[inf.axis] ?? 0;
      const c = hint * inf.polarity * inf.magnitude * inf.confidence * 0.25;
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
        const harmonious = a === b || generates(a) === b || generates(b) === a; // 五行相生(复用)
        const conflicting = controls(a) === b || controls(b) === a; // 五行相克(复用)
        const hHint = candidate.axisHints["harmony"] ?? 0,
          dHint = candidate.axisHints["discord"] ?? 0;
        if (harmonious && hHint > 0) {
          influence += 0.3;
          contributing.push({ source: "bazi-pair", axis: "harmony", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${ELEM_CN[a] ?? a}与${ELEM_CN[b] ?? b}相生` });
        }
        if (conflicting && dHint > 0) {
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
        const hHint = candidate.axisHints["harmony"] ?? 0,
          dHint = candidate.axisHints["discord"] ?? 0;
        if (r > 0 && hHint > 0) {
          influence += Math.min(0.3, r * 0.1);
          contributing.push({ source: "faction", axis: "harmony", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${fa}与${fb}结盟` });
        }
        if (r < 0 && dHint > 0) {
          influence += Math.min(0.3, -r * 0.1);
          contributing.push({ source: "faction", axis: "discord", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${fa}与${fb}交恶` });
        }
      }
    }
    const baseW = 0.5,
      total = Math.max(0, Math.min(1, baseW + influence));
    return { candidate, weight: total, breakdown: { base: baseW, influence, opposing: 0, bias: 0, total }, contributingInfluences: contributing, explain: `base ${baseW.toFixed(2)} + 八字奇门先验 ${influence >= 0 ? "+" : ""}${influence.toFixed(3)}` };
  },
};

function seedWorld(spec: WorldSpec): WorldSnapshot {
  const seeds = [
    { name: "林深", faction: "云图科技" },
    { name: "苏念", faction: "云图科技" },
    { name: "程屿", faction: "鼎晖资本" },
    { name: "白杨", faction: "星岚传媒" },
    { name: "江野", faction: "鼎晖资本" },
    { name: "沈薇", faction: "星岚传媒" },
    { name: "何川", faction: "灰产圈" },
  ];
  const ELEMS = ["water", "fire", "earth", "metal", "wood"]; // 五行各异 → 生克张力
  const characters: Record<string, CharacterState> = {};
  seeds.forEach((sd, i) => {
    const h = hashStr(`${spec.seed}|${sd.name}`) >>> 0;
    const by = 1985 + (h % 20),
      bm = 1 + ((h >>> 6) % 12),
      bd = 1 + ((h >>> 10) % 27),
      bh = (h >>> 14) % 24;
    const c: CharacterState = {
      id: `c${i + 1}`,
      name: sd.name,
      present: true,
      locationId: LOC_IDS[i % LOC_IDS.length] ?? "loc-tower", // 散布各场所
      progressionTier: "rookie",
      narrativeStress: 0.08 * (i % 5),
      traits: { initiative: 0, caution: 0 },
      lastSeenTick: 0,
      props: { actCount: 0, birthY: by, birthM: bm, birthD: bd, birthH: bh, element: ELEMS[i % ELEMS.length], faction: sd.faction },
    };
    const disp = natalOf(c).disposition;
    c.traits = { initiative: disp.initiative, caution: disp.caution };
    characters[c.id] = c;
  });
  return {
    worldId: spec.worldId,
    lineId: "main",
    tick: 0,
    clock: { tick: 0 },
    characters,
    locations: { ...LOCATIONS },
    props: { seed: spec.seed, factions: FACTIONS, factionRelations: {}, bible: "云图科技四个年轻人——林深、苏念、程屿、白杨，生辰八字各异、命格不同，在资本与名利的漩涡里各奔前程。" },
  };
}

export const modernCityPack: ContentPack = {
  id: "modern-city",
  displayName: "现代都市 · 八字奇门",
  seedWorld,
  spawnCharacter,
  nextStoryEvent,
  divine, // ← 奇门给"抉择"出吉凶建议, 复用
  reviveFaction,
  priorSystem,
  progression,
  arcs: [
    "四个年轻人初入云图科技，定岗分组、各怀心思",
    "项目争夺、办公室政治，恩怨与机缘并生",
    "一笔关键融资，卷入资本与派系的博弈",
    "行业峰会，结识贵人也树立暗敌",
    "并购暗战，盟约之下嫌隙暗生",
    "舆论风暴，一桩丑闻牵动各方站队",
    "对手反扑，旧账新仇一并清算",
    "资本寒冬，生死存亡之际见人心",
    "绝地翻盘，一战封神或满盘皆输",
    "更大的资本与权力入局，棋盘骤然扩大",
  ],
  traitAxes: [
    { id: "initiative", name: "进取", opposes: "caution" },
    { id: "caution", name: "持重", opposes: "initiative" },
    { id: "harmony", name: "亲和", opposes: "discord" },
    { id: "discord", name: "锋锐", opposes: "harmony" },
  ],
  agentProfile: {
    reflectPrompt(char: CharacterState, tick: number): string {
      const n = natalOf(char);
      const g = goalOf(char);
      return `你是都市世界的人物「${char.name}」(${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}日主·${n.pattern}、${n.trait}，志在${g}；身份:${TIERS.find((t) => t.id === char.progressionTier)?.name ?? "素人"}，心绪:${char.narrativeStress.toFixed(2)})。第${tick}回合，用不超过20字写此刻心境与下一步打算(须合你${n.pattern}的性情与所求)，只回一句，口吻现代。`;
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
    verbs: {
      RunStarted: "开局",
      AgentThought: "心动",
      CandidatesScored: "权衡",
      GateEvaluated: "抉择",
      StageCommitted: "落定",
      DirectorPlanned: "运镜",
      CharacterEntered: "登场",
      StoryEventTriggered: "风云",
      CharacterFell: "出局",
      FactionDissolved: "并购",
      VengeanceResolved: "了断",
      ProgressionAdvanced: "上位",
      CharacterTranscended: "退隐",
    },
  },
  composeProfile: {
    systemPrompt: "你是一位现代都市小说作者，文笔利落、对白鲜活，擅写资本、职场、名利场中的人心博弈与命运沉浮。可借八字命格写人物性情、借奇门天机写时运转折，但不点破术语。",
    titleStyle: "简洁有力的现代标题，名词短语或一句短句即可，可带悬念或反差；切忌文言对仗回目、不堆砌并列短语，像真实都市小说的章名那样自然口语",
    toneTags: ["都市", "现实", "博弈"],
    sanitizer: { rules: [{ id: "cliche", pattern: "霸道总裁|玛丽苏", reason: "套路 AI 味" }], stockImagery: ["落地窗外的城市夜景", "手中的红酒杯"] },
    glossary: { 上位: "在权力/名望阶梯上更进一阶" },
  },
};

export default modernCityPack;
