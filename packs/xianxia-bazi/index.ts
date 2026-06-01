// packs/xianxia-bazi/index.ts — 旗舰内容包(修仙 + 八字奇门概率先验)· M1 + (b)社交涌现
// 引擎(core/)零 genre 字面量; 此处正当。prior 用真排盘(lunar-javascript):
//   - 角色生辰日主 vs 当日五行 → initiative(targeted)
//   - 两角色五行生克 → harmony/discord(决定谁和谁结盟、谁和谁道争 → 社交涌现)
import type { ContentPack, PriorSystem, ProgressionSystem, PriorFrame, ScoredCandidate, Influence, StoryEvent } from "../../core/domain/pack";
import type { WorldSnapshot, WorldSpec, CandidateAction, CharacterState } from "../../core/domain/world";
import { hashStr } from "../../core/util/rng";
import { Solar } from "lunar-javascript";
import { qimenForecast } from "./qimen";

export const STEM_ELEM: Record<string, string> = {
  "甲": "wood", "乙": "wood", "丙": "fire", "丁": "fire", "戊": "earth",
  "己": "earth", "庚": "metal", "辛": "metal", "壬": "water", "癸": "water",
};
const CYCLE = ["wood", "fire", "earth", "metal", "water"];

function num(v: unknown, dflt: number): number {
  return typeof v === "number" ? v : dflt;
}
export function generates(a: string): string {
  const i = CYCLE.indexOf(a);
  return i < 0 ? a : CYCLE[(i + 1) % 5];
}
export function controls(a: string): string {
  const i = CYCLE.indexOf(a);
  return i < 0 ? a : CYCLE[(i + 2) % 5];
}
export function dayMasterElem(y: number, m: number, d: number): string {
  try {
    const gan = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar().getDayGan() as string;
    return STEM_ELEM[gan] ?? "earth";
  } catch {
    return "earth";
  }
}
function charElemOf(ch: CharacterState): string {
  if (typeof ch.props["element"] === "string") return ch.props["element"] as string; // seed 指定五行优先(主角四象各异)
  return dayMasterElem(num(ch.props["birthY"], 1990), num(ch.props["birthM"], 6), num(ch.props["birthD"], 15));
}
function initiativePolarity(dayElem: string, charElem: string): number {
  if (dayElem === charElem) return 1;
  if (generates(dayElem) === charElem) return 1;
  if (controls(charElem) === dayElem) return 1;
  if (controls(dayElem) === charElem) return -1;
  if (generates(charElem) === dayElem) return -1;
  return 0;
}
function currentDayElem(tick: number): string {
  const cur = new Date(Date.UTC(2000, 0, 1) + tick * 86400000);
  return dayMasterElem(cur.getUTCFullYear(), cur.getUTCMonth() + 1, cur.getUTCDate());
}

// ── 八字真盘: 四柱 + 十神 → 命格(性情/格局), 角色据此行动(不只日主五行) ──
export const ELEM_CN: Record<string, string> = { wood: "木", fire: "火", earth: "土", metal: "金", water: "水" };
const BRANCH_ELEM: Record<string, string> = {
  子: "water", 丑: "earth", 寅: "wood", 卯: "wood", 辰: "earth", 巳: "fire",
  午: "fire", 未: "earth", 申: "metal", 酉: "metal", 戌: "earth", 亥: "water",
};
// 十神 → 主导性情轴 + 格局标签 + 性情词(命局定人, 喂打分与反思)
type DispAxis = "initiative" | "caution" | "harmony" | "discord";
const TEN_GOD: Record<string, { axis: DispAxis; mag: number; pattern: string; trait: string }> = {
  比肩: { axis: "initiative", mag: 0.5, pattern: "比肩", trait: "自立刚健" },
  劫财: { axis: "discord", mag: 0.6, pattern: "劫财", trait: "争强好胜" },
  食神: { axis: "harmony", mag: 0.5, pattern: "食神格", trait: "温雅有才" },
  伤官: { axis: "discord", mag: 0.7, pattern: "伤官格", trait: "桀骜多才" },
  偏财: { axis: "initiative", mag: 0.5, pattern: "偏财格", trait: "豪阔重义" },
  正财: { axis: "caution", mag: 0.5, pattern: "正财格", trait: "务实持重" },
  七杀: { axis: "initiative", mag: 0.8, pattern: "七杀格", trait: "杀伐决断" },
  正官: { axis: "caution", mag: 0.6, pattern: "正官格", trait: "端方守正" },
  偏印: { axis: "discord", mag: 0.5, pattern: "偏印格", trait: "孤高深沉" },
  正印: { axis: "caution", mag: 0.8, pattern: "正印格", trait: "仁厚好学" },
};
export interface Natal {
  pillars: string;       // 四柱干支(显示/叙事)
  dayMaster: string;     // 日主天干
  dayMasterElem: string; // 日主五行
  dominantGod: string;   // 主导十神
  pattern: string;       // 格局
  trait: string;         // 性情词
  disposition: Record<DispAxis, number>; // 命格→性情轴权重
  elementCounts: Record<string, number>; // 八字五行分布
}
function natalChart(y: number, m: number, d: number, hour: number): Natal {
  const mm = ((((Math.trunc(m) - 1) % 12) + 12) % 12) + 1; // 钳到 1..12(兼容旧种子的负月)
  const dd = ((((Math.trunc(d) - 1) % 28) + 28) % 28) + 1; // 钳到 1..28(各月皆安全)
  const hh = ((Math.trunc(hour) % 24) + 24) % 24; // 钳到 0..23
  try {
    const ec = Solar.fromYmdHms(y, mm, dd, hh, 0, 0).getLunar().getEightChar();
    const dayGan = ec.getDayGan();
    const pillars = `${ec.getYear()} ${ec.getMonth()} ${ec.getDay()} ${ec.getTime()}`;
    const gods: string[] = [ec.getYearShiShenGan(), ec.getMonthShiShenGan(), ec.getTimeShiShenGan()];
    for (const z of [ec.getYearShiShenZhi(), ec.getMonthShiShenZhi(), ec.getDayShiShenZhi(), ec.getTimeShiShenZhi()]) {
      if (Array.isArray(z) && typeof z[0] === "string") gods.push(z[0]);
    }
    const tenGods: Record<string, number> = {};
    for (const g of gods) if (g) tenGods[g] = (tenGods[g] ?? 0) + 1;
    const dominantGod = Object.entries(tenGods).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "正印";
    const def = TEN_GOD[dominantGod] ?? TEN_GOD["正印"]!;
    const disposition: Record<DispAxis, number> = { initiative: 0, caution: 0, harmony: 0, discord: 0 };
    disposition[def.axis] += def.mag;
    const elementCounts: Record<string, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    for (const c of pillars.replace(/\s/g, "").split("")) {
      const e = STEM_ELEM[c] ?? BRANCH_ELEM[c];
      if (e) elementCounts[e] = (elementCounts[e] ?? 0) + 1;
    }
    return { pillars, dayMaster: dayGan, dayMasterElem: STEM_ELEM[dayGan] ?? "earth", dominantGod, pattern: def.pattern, trait: def.trait, disposition, elementCounts };
  } catch {
    return { pillars: "—", dayMaster: "戊", dayMasterElem: "earth", dominantGod: "正印", pattern: "正印格", trait: "仁厚", disposition: { initiative: 0, caution: 0.3, harmony: 0.2, discord: 0 }, elementCounts: { wood: 0, fire: 0, earth: 8, metal: 0, water: 0 } };
  }
}
// 命格按生辰缓存(确定性 + 免每 tick 重排盘)
const natalCache = new Map<string, Natal>();
export function natalOf(ch: CharacterState): Natal {
  const y = num(ch.props["birthY"], 1990), m = num(ch.props["birthM"], 6), d = num(ch.props["birthD"], 15), hh = num(ch.props["birthH"], 12);
  const key = `${y}|${m}|${d}|${hh}`;
  let n = natalCache.get(key);
  if (!n) {
    n = natalChart(y, m, d, hh);
    natalCache.set(key, n);
  }
  return n;
}
// 命格短标(喂章节 roster / 叙事): e.g. "辛金·伤官格"
export function natalLabel(ch: CharacterState): string {
  const n = natalOf(ch);
  return `${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}·${n.pattern}·${n.trait}`;
}

// ── 角色认知: 命格定其志(人生目标), 目标驱动长期行动而非纯反应 ──
type GoalKind = "突破" | "夺宝" | "复仇" | "结盟" | "称雄" | "证道";
const GOAL_DEF: Record<GoalKind, { axis: DispAxis; mag: number; desc: string }> = {
  突破: { axis: "initiative", mag: 0.6, desc: "破境登高、勇猛精进" },
  夺宝: { axis: "initiative", mag: 0.5, desc: "夺秘宝灵机、增益修为" },
  复仇: { axis: "discord", mag: 0.8, desc: "向仇敌问罪、不死不休" },
  结盟: { axis: "harmony", mag: 0.6, desc: "结交道友、缔结同盟" },
  称雄: { axis: "discord", mag: 0.7, desc: "争雄一方、压服群伦" },
  证道: { axis: "caution", mag: 0.6, desc: "潜心证道、超脱纷争" },
};
// 命格 → 初志(八字定命, 命亦定其所求)
const PATTERN_GOAL: Record<string, GoalKind> = {
  七杀格: "称雄", 伤官格: "称雄", 劫财: "夺宝", 偏财格: "夺宝", 正财格: "夺宝",
  正官格: "突破", 比肩: "突破", 偏印格: "证道", 正印格: "证道", 食神格: "结盟",
};
function goalForPattern(pattern: string): GoalKind {
  return PATTERN_GOAL[pattern] ?? "突破";
}
function goalOf(ch: CharacterState): GoalKind {
  if (typeof ch.props["avenge"] === "string") return "复仇"; // 怀仇者, 复仇压倒初志
  const base = goalForPattern(natalOf(ch).pattern);
  if (base === "突破") {
    const ord = XIANXIA_TIERS.findIndex((t) => t.id === ch.progressionTier);
    if (ord >= 12) return "称雄"; // 登高位后由"突破"转"称雄", 目标随境界演进
  }
  return base;
}
export function goalLabel(ch: CharacterState): string {
  const k = goalOf(ch);
  return k ? `志在${k}` : "";
}
// 实时"想法"(从命格性情/命定之志/所在地灵气/心境张力/历练合成; 确定性, 非 mock; 喂画布悬浮)
export function describeMind(ch: CharacterState, snapshot: WorldSnapshot): string {
  const n = natalOf(ch);
  const g = goalOf(ch);
  const loc = snapshot.locations[ch.locationId ?? ""];
  const locName = loc?.name ?? "未知之地";
  const yld = typeof loc?.props["yield"] === "number" ? (loc.props["yield"] as number) : 0.5;
  const s = ch.narrativeStress;
  const mood = s > 0.75 ? "心绪如焚、几欲噬人" : s > 0.5 ? "心潮起伏、意有所决" : s > 0.25 ? "凝神内省" : "心境澄澈";
  const econ = yld >= 0.7 ? "此地灵气充盈，正好用功" : yld <= 0.4 ? "此地灵气稀薄，难以精进" : "灵气平平";
  const li = num(ch.props["历练"], 0);
  const seasoned = li >= 15 ? "（历经百劫）" : li >= 6 ? "（略有阅历）" : "";
  const av = typeof ch.props["avenge"] === "string" ? `　胸中横亘一念：为「${String(ch.props["avenge"])}」复仇。` : "";
  return `${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}日主·${n.pattern}：「${n.trait}」之性${seasoned}。所求——${GOAL_DEF[g].desc}。今在${locName}，${mood}。${econ}。${av}`;
}

const priorSystem: PriorSystem = {
  id: "bazi-qimen",
  axes: [
    { id: "initiative", opposes: "caution" },
    { id: "caution", opposes: "initiative" },
    { id: "harmony", opposes: "discord" },
    { id: "discord", opposes: "harmony" },
  ],
  buildFrame({ snapshot, tick }): PriorFrame {
    const dayElem = currentDayElem(tick);
    const influences: Influence[] = [];
    const elements: Record<string, string> = {};
    const globalLean = dayElem === "wood" || dayElem === "fire" ? 1 : dayElem === "metal" || dayElem === "water" ? -1 : 0;
    if (globalLean !== 0) {
      influences.push({ source: "qimen-day", axis: "initiative", polarity: globalLean, magnitude: 0.3, confidence: 0.5, scope: "global", note: `当日${dayElem}` });
    }
    for (const ch of Object.values(snapshot.characters)) {
      if (!ch.present) continue;
      const charElem = charElemOf(ch);
      elements[ch.id] = charElem;
      const pol = initiativePolarity(dayElem, charElem);
      if (pol !== 0) {
        influences.push({ source: "bazi-natal", axis: "initiative", polarity: pol, magnitude: 0.4, confidence: 0.6, scope: "targeted", targetId: ch.id, note: `${ch.name}日主${charElem}` });
      }
      // 命格(八字真盘十神格局) → 性情驱动: 在主导轴加 targeted 影响力, 角色按命行动
      const natal = natalOf(ch);
      for (const axis of ["initiative", "caution", "harmony", "discord"] as const) {
        const w = natal.disposition[axis];
        if (w > 0) influences.push({ source: "bazi-pattern", axis, polarity: 1, magnitude: Math.min(0.8, w), confidence: 0.6, scope: "targeted", targetId: ch.id, note: `${ch.name}·${natal.pattern}` });
      }
      // 人生目标 → 长期驱动: 朝目标主导轴加 targeted 影响力(角色追求而非纯反应); 历练越深, 追求越坚
      const gk = goalOf(ch);
      if (gk) {
        const gd = GOAL_DEF[gk];
        const seasoning = 1 + Math.min(0.5, num(ch.props["历练"], 0) * 0.03); // 历练加成: 记忆喂决策
        influences.push({ source: "goal", axis: gd.axis, polarity: 1, magnitude: Math.min(0.95, gd.mag * seasoning), confidence: 0.7, scope: "targeted", targetId: ch.id, note: `${ch.name}志在${gk}` });
      }
    }
    const frameHash = hashStr(`${snapshot.worldId}|${tick}|${dayElem}|${influences.length}`).toString(16);
    const factions: Record<string, string> = {};
    for (const ch of Object.values(snapshot.characters)) if (ch.present && typeof ch.props["faction"] === "string") factions[ch.id] = ch.props["faction"] as string;
    const factionRel = (snapshot.props["factionRelations"] as Record<string, Record<string, number>>) ?? {};
    return { frameId: `frame-${snapshot.worldId}-t${tick}`, packId: "xianxia-bazi", frameHash, tick, influences, ext: { elements, factions, factionRel } };
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
    // 互动候选: 两角色五行生克决定亲疏(和则结善胜出, 克则道争胜出 → 社交涌现)
    const elements = (frame.ext?.["elements"] as Record<string, string> | undefined) ?? {};
    const target = candidate.targetIds?.[0];
    if (target) {
      const a = elements[candidate.characterId];
      const b = elements[target];
      if (a && b) {
        const harmonious = a === b || generates(a) === b || generates(b) === a; // 同气/相生 → 和
        const conflicting = controls(a) === b || controls(b) === a; // 相克 → 争
        const hHint = candidate.axisHints["harmony"] ?? 0;
        const dHint = candidate.axisHints["discord"] ?? 0;
        if (harmonious && hHint > 0) {
          influence += 0.3;
          contributing.push({ source: "bazi-pair", axis: "harmony", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${a}与${b}相生` });
        }
        if (conflicting && dHint > 0) {
          influence += 0.3;
          contributing.push({ source: "bazi-pair", axis: "discord", polarity: 1, magnitude: 0.3, confidence: 0.7, note: `${a}与${b}相克` });
        }
      }
      // 派系关系叠加: 敌对派系更易道争, 结盟派系更易结善(随大事动态演化)
      const facs = (frame.ext?.["factions"] as Record<string, string> | undefined) ?? {};
      const rel = (frame.ext?.["factionRel"] as Record<string, Record<string, number>> | undefined) ?? {};
      const fa = facs[candidate.characterId];
      const fb = facs[target];
      if (fa && fb && fa !== fb) {
        const r = rel[fa]?.[fb] ?? 0;
        const hHint = candidate.axisHints["harmony"] ?? 0;
        const dHint = candidate.axisHints["discord"] ?? 0;
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
    const baseW = 0.5;
    const total = Math.max(0, Math.min(1, baseW + influence));
    return {
      candidate,
      weight: total,
      breakdown: { base: baseW, influence, opposing: 0, bias: 0, total },
      contributingInfluences: contributing,
      explain: `base ${baseW.toFixed(2)} + 八字奇门先验 ${influence >= 0 ? "+" : ""}${influence.toFixed(3)}`,
    };
  },
};

// 36 级阶梯(9 大境界 × 4 小层次)→ 千章修为成长空间, 慢进防战力崩坏
const REALMS = ["练气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫"];
const SUBS = ["初期", "中期", "后期", "圆满"];
const XIANXIA_TIERS = REALMS.flatMap((r, ri) => SUBS.map((s, si) => ({ id: `${ri}-${si}`, name: `${r}${s}`, order: ri * SUBS.length + si + 1 })));

const progression: ProgressionSystem = {
  tiers: XIANXIA_TIERS,
  canAdvance(char: CharacterState): { ok: boolean; gate?: string } {
    if (num(char.props["actCount"], 0) < 6) return { ok: false, gate: "bottleneck" }; // 心境/阅历未足
    const ord = XIANXIA_TIERS.findIndex((t) => t.id === char.progressionTier);
    const cost = (Math.max(0, ord) + 1) * 3; // 资粮门槛随境界递增: 越高阶, 突破越费灵气
    if (num(char.props["resource"], 0) < cost) return { ok: false, gate: "lack-resource" };
    return { ok: true };
  },
};

// 世界扩张: 更大的地图 + 可生成的配角/势力
const LOCATIONS: Record<string, { id: string; name: string; props: Record<string, unknown> }> = {
  "loc-sect": { id: "loc-sect", name: "青云宗", props: { yield: 0.6 } },
  "loc-wild": { id: "loc-wild", name: "莽荒", props: { yield: 0.3 } },
  "loc-market": { id: "loc-market", name: "天衍坊市", props: { yield: 0.4 } },
  "loc-sword": { id: "loc-sword", name: "万剑峰", props: { yield: 0.6 } },
  "loc-abyss": { id: "loc-abyss", name: "幽冥涧", props: { yield: 0.8 } },
  "loc-relic": { id: "loc-relic", name: "上古秘境", props: { yield: 1.0 } },
  "loc-library": { id: "loc-library", name: "藏经阁", props: { yield: 0.7 } },
};
const LOC_IDS = Object.keys(LOCATIONS);
const SPAWN_NAMES = ["秦霜", "陆沉", "叶孤鸿", "苍墟", "墨衍", "云栖月", "厉无咎", "南宫泫", "顾长歌", "邪刹", "冷千秋", "白骨真人"];
const FACTIONS = ["青云宗", "万剑门", "散修", "幽冥教", "北域妖族", "天衍商会"];
const PROTAG_ELEM = ["water", "fire", "metal", "wood"]; // 主角四人五行各异 → 保证生克张力(冰/火/金/木)

function spawnCharacter(seed: string, index: number): CharacterState {
  const h = hashStr(`${seed}|spawn|${index}`) >>> 0; // 无符号: 防负哈希污染日期/派系派生
  const name = (SPAWN_NAMES[index % SPAWN_NAMES.length] ?? "无名") + (index >= SPAWN_NAMES.length ? `·其${Math.floor(index / SPAWN_NAMES.length) + 1}` : "");
  const by = 1955 + (h % 55);
  const bm = 1 + ((h >>> 6) % 12);
  const bd = 1 + ((h >>> 10) % 27);
  const bh = (h >>> 14) % 24;
  const faction = FACTIONS[(h >>> 4) % FACTIONS.length] ?? "散修";
  const locId = LOC_IDS[(h >>> 2) % LOC_IDS.length] ?? "loc-sect";
  const tierIdx = (h >>> 8) % Math.min(8, XIANXIA_TIERS.length); // 对手/前辈可有更高起点
  const natal = natalChart(by, bm, bd, bh);
  return {
    id: `s${index}`,
    name,
    present: true,
    locationId: locId,
    progressionTier: XIANXIA_TIERS[tierIdx]?.id ?? "0-0",
    narrativeStress: 0.15 + (h % 40) / 100,
    traits: { initiative: natal.disposition.initiative, caution: natal.disposition.caution }, // 命格定性情
    lastSeenTick: 0,
    props: { actCount: 0, birthY: by, birthM: bm, birthD: bd, birthH: bh, element: dayMasterElem(by, bm, bd), faction },
  };
}

function seedWorld(spec: WorldSpec): WorldSnapshot {
  const names = ["苏雪", "林焰", "玄渊", "白薇"];
  const characters: Record<string, CharacterState> = {};
  names.forEach((name, i) => {
    const id = `c${i + 1}`;
    const h = hashStr(`${spec.seed}|${id}`) >>> 0;
    const by = 1970 + (h % 40);
    const bm = 1 + ((h >>> 6) % 12);
    const bd = 1 + ((h >>> 10) % 27);
    const bh = (h >>> 14) % 24;
    const natal = natalChart(by, bm, bd, bh);
    characters[id] = {
      id,
      name,
      present: true,
      locationId: i % 2 === 0 ? "loc-sect" : "loc-wild",
      progressionTier: "0-0",
      narrativeStress: 0.1 * i,
      traits: { initiative: natal.disposition.initiative, caution: natal.disposition.caution }, // 命格定性情(灵根五行另由 element 管社交)
      lastSeenTick: 0,
      props: { actCount: 0, birthY: by, birthM: bm, birthD: bd, birthH: bh, element: PROTAG_ELEM[i % PROTAG_ELEM.length], faction: "青云宗" },
    };
  });
  return {
    worldId: spec.worldId,
    lineId: "main",
    tick: 0,
    clock: { tick: 0, label: "开篇" },
    characters,
    locations: { ...LOCATIONS },
    props: { seed: spec.seed, genre: "xianxia", factionRelations: {} },
  };
}

// 系统级剧情事件: 每 20 拍起一桩大事, 轮转 6 类(影响全体 + 设世界危机)
const STORY_EVENTS = [
  { name: "上古秘境现世", summary: "上古秘境轰然洞开，灵宝气息引动诸方修士争涌", gatherAt: "loc-relic", crisis: "上古秘境现世，群雄逐宝，危机四伏", stressDelta: 0.22, factionShifts: [{ a: "青云宗", b: "天衍商会", delta: -1 }] },
  { name: "两派之争", summary: "万剑门与幽冥教积怨爆发，剑气魔氛笼罩万剑峰", gatherAt: "loc-sword", crisis: "万剑门与幽冥教大战将起，青云宗被迫选边", stressDelta: 0.26, factionShifts: [{ a: "万剑门", b: "幽冥教", delta: -3 }, { a: "青云宗", b: "万剑门", delta: 1 }] },
  { name: "青云大比", summary: "青云宗百年大比开启，同门论道争锋、明争暗斗", gatherAt: "loc-sect", crisis: "青云宗大比，名次定资源，道争见生死", stressDelta: 0.16, factionShifts: [] },
  { name: "魔道倾巢", summary: "幽冥涧魔气冲霄，魔道大军倾巢而出，正魔交锋在即", gatherAt: "loc-abyss", crisis: "魔道入侵，正道存亡之秋，诸派暂结同盟", stressDelta: 0.3, factionShifts: [{ a: "青云宗", b: "幽冥教", delta: -3 }, { a: "万剑门", b: "幽冥教", delta: -2 }, { a: "青云宗", b: "万剑门", delta: 2 }, { a: "青云宗", b: "北域妖族", delta: -2 }] },
  { name: "天宝现世", summary: "天衍坊市惊现一件来历不明的仙宝，暗流汹涌、杀机四伏", gatherAt: "loc-market", crisis: "仙宝现世，各方觊觎，坊市暗藏杀局", stressDelta: 0.2, factionShifts: [{ a: "青云宗", b: "天衍商会", delta: -1 }, { a: "万剑门", b: "幽冥教", delta: -1 }] },
  { name: "幻境试炼", summary: "藏经阁深处幻境开启，幻劫考验道心，入者九死一生", gatherAt: "loc-library", crisis: "藏经阁幻境试炼，道心受劫，生死一线", stressDelta: 0.2, factionShifts: [] },
];
// 奇门真盘排局(节气定局/转盘九星·八门·八神/复合读吉凶)已移至 ./qimen.ts; qimenForecast 自该模块导入。
function nextStoryEvent(snapshot: WorldSnapshot, tick: number): StoryEvent | null {
  if (tick <= 0 || tick % 20 !== 0) return null;
  const ev = STORY_EVENTS[(Math.floor(tick / 20) - 1) % STORY_EVENTS.length]!;
  const qm = qimenForecast(tick);
  const outcome = qm.omen === "吉" ? "此局得天时，正道破局功成、机缘暗藏" : qm.omen === "凶" ? "此局犯大凶，恐有折损反目、道途受挫" : "此局虚实难料，胜负在人谋";
  return {
    id: `story-${tick}`,
    involve: "all",
    ...ev,
    summary: `${ev.summary}。${qm.line}`,
    crisis: `${ev.crisis}（${qm.line}；${outcome}）`,
    stressDelta: Math.min(0.5, (ev.stressDelta ?? 0.2) * qm.mult),
    omen: qm.omen,
  };
}

// 奇门为"作者裁决"提供吉凶建议(议事栏显示 + 无人值守时据此自动裁决)
function divine(tick: number): { hint: string; omen: "吉" | "平" | "凶" } {
  const qm = qimenForecast(tick);
  const adv = qm.omen === "吉" ? "奇门示喜：此局宜进，破之有望" : qm.omen === "凶" ? "奇门示警：此局宜避，强为恐遭反噬" : "奇门示平：此局虚实难料，宜慎勿躁";
  return { hint: `${adv}（${qm.line}）`, omen: qm.omen };
}

// 被吞并派系的复兴: 残部拥立一名修为颇高的枭雄, 重举旗号(版图有兴有衰)
const REVIVER_NAMES = ["残刃", "孤煞", "复涛", "遗孤", "断尘", "煞影", "归墟", "复阳"];
function reviveFaction(faction: string, index: number): CharacterState {
  const base = spawnCharacter(`复兴${faction}`, index + 100);
  const h = hashStr(`revive|${faction}|${index}`);
  const tierIdx = Math.min(6 + (h % 6), XIANXIA_TIERS.length - 1); // 枭雄起点较高
  return {
    ...base,
    name: REVIVER_NAMES[index % REVIVER_NAMES.length] ?? "枭雄",
    progressionTier: XIANXIA_TIERS[tierIdx]?.id ?? base.progressionTier,
    props: { ...base.props, faction, banner: `复兴${faction}`, reviving: true },
  };
}

export const xianxiaBaziPack: ContentPack = {
  id: "xianxia-bazi",
  displayName: "修仙 · 八字奇门",
  seedWorld,
  spawnCharacter,
  nextStoryEvent,
  divine,
  reviveFaction,
  priorSystem,
  progression,
  traitAxes: [
    { id: "initiative", name: "进取", opposes: "caution" },
    { id: "caution", name: "持重", opposes: "initiative" },
    { id: "harmony", name: "亲和", opposes: "discord" },
    { id: "discord", name: "相争", opposes: "harmony" },
  ],
  eventVocab: {
    subsystems: [
      { id: "frame", label: "起卦" },
      { id: "agents", label: "心动" },
      { id: "branches", label: "分流" },
      { id: "gate", label: "裁决" },
      { id: "commit", label: "落定" },
      { id: "director", label: "推演" },
      { id: "memory", label: "心象" },
      { id: "runtime", label: "运行" },
    ],
    verbs: {
      RunStarted: "推演起",
      FrameDerived: "起卦",
      AgentThought: "心动",
      MemoryRecorded: "心象",
      CandidatesScored: "分流",
      GateEvaluated: "裁决",
      StageCommitted: "落定",
      DirectorPlanned: "导演",
      RunCompleted: "推演毕",
      CharacterEntered: "登场",
      StoryEventTriggered: "大事",
      CharacterFell: "陨落",
      FactionDissolved: "吞并",
      VengeanceResolved: "了断",
      CharacterTranscended: "飞升",
      ProgressionAdvanced: "破境",
      DecisionRequired: "请裁",
      AuthorRuled: "已裁",
    },
  },
  composeProfile: {
    systemPrompt: "你是一位修仙小说作者，文风古雅凝练，以世界推演的事件为素材写出连贯章节。",
    titleStyle: "工整凝练的章回标题，可用一组对仗（两个短语）；只取一组，切忌堆砌三四个并列短语，不生造对仗、不用冷僻字凑工整，宁可平实也要自然",
    toneTags: ["古雅", "凝练"],
    sanitizer: { rules: [{ id: "simile", pattern: "犹如|仿佛", reason: "AI 味比喻" }], stockImagery: ["血色残阳", "翻涌的杀意"] },
    glossary: { "境界": "修为层次", "起卦": "以奇门起一局" },
  },
  agentProfile: {
    reflectPrompt(char: CharacterState, tick: number): string {
      const n = natalOf(char);
      const gk = goalOf(char);
      return `你是修仙世界的角色「${char.name}」(${n.dayMaster}${ELEM_CN[n.dayMasterElem] ?? ""}日主·${n.pattern}，性情${n.trait}${gk ? `，志在${gk}` : ""}；境界:${char.progressionTier ?? "练气"}, 心境张力:${char.narrativeStress.toFixed(2)})。第${tick}回合，用不超过20字写出此刻心境与下一步意图(须合你${n.pattern}的性情与${gk ?? "道心"})，只回一句，文风古雅。`;
    },
  },
};

export default xianxiaBaziPack;
