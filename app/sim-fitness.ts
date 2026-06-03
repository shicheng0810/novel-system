// app/sim-fitness.ts — 模拟层 fitness(T1)。区别于作者层(文笔)的 fitness, 这里度量「世界本身够不够有戏」。
// 三个可验证的符号信号(零 LLM, 抗 game):
//   ① story-sifting: 从事件流里筛出「成链的好故事」(复仇闭环/崛起陨落/逆袭登顶/覆灭复兴/巨变连锁…),
//      产量 × 惊喜质量(统计罕见度 × 因果链完整度 × 跨度)。 [Felt / Select-the-Unexpected / Ryan]
//   ② 派系冲突图张力: 极化/势均(balance)/正面交锋(directness)/赌注(intensity)/化解度(resolution)/波动。 [Ware 冲突四指标]
//   ③ ASAL 历史新颖度: 新章对所有历史章的最大相似度越低越好(抗停滞/抗套路重复)。
// 走文件持久化(镜像 canon): longrun 每 8 章算好存盘, evolveOnce 读 total 折进基因适应度; server 读出来画曲线。
// core/ 不涉, 纯 app 层。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WorldEventRecord, DomainEvent } from "../core/domain/events";
import type { WorldSnapshot, CharacterState } from "../core/domain/world";

export interface StoryChain {
  pattern: string;     // 模式名(复仇闭环/崛起陨落/…)
  desc: string;        // 一句话故事
  span: number;        // 跨 tick 数
  completeness: number; // 0..1 因果链是否闭合
  rarity: number;      // 0..1 统计罕见度(同型越多越不稀奇)
  quality: number;     // = base × completeness × spanFactor × rarity
  atTick: number;
  dangling?: boolean;  // 半成形(可供 drama-manager 顺水推舟)
}
export interface SimFitness {
  sift: { chains: number; quality: number; score: number; top: string[]; patterns: Record<string, number>; dangling: string[] };
  tension: { polarization: number; balance: number; directness: number; intensity: number; resolution: number; volatility: number; score: number };
  novelty: number;     // 0..1
  total: number;       // 0..10 混合(sift 0.5 + tension 0.3 + novelty 0.2)
  vol: number;
  atCh: number;
}
export interface SimHistory { history: Array<{ atCh: number; vol: number; total: number; sift: number; tension: number; novelty: number }> }

const SF_FILE = (d: string): string => join(d, "sim-fitness.json");
const SH_FILE = (d: string): string => join(d, "sim-fitness-history.json");

export function loadSimFitness(d: string): SimFitness | null {
  try { return existsSync(SF_FILE(d)) ? (JSON.parse(readFileSync(SF_FILE(d), "utf8")) as SimFitness) : null; } catch { return null; }
}
export function loadSimHistory(d: string): SimHistory { try { return existsSync(SH_FILE(d)) ? (JSON.parse(readFileSync(SH_FILE(d), "utf8")) as SimHistory) : { history: [] }; } catch { return { history: [] }; } }
export function saveSimFitness(d: string, sf: SimFitness): void {
  try {
    writeFileSync(SF_FILE(d), JSON.stringify(sf, null, 2), "utf8");
    const h: SimHistory = (() => { try { return existsSync(SH_FILE(d)) ? (JSON.parse(readFileSync(SH_FILE(d), "utf8")) as SimHistory) : { history: [] }; } catch { return { history: [] }; } })();
    h.history.push({ atCh: sf.atCh, vol: sf.vol, total: sf.total, sift: sf.sift.score, tension: sf.tension.score, novelty: +(sf.novelty * 10).toFixed(2) });
    if (h.history.length > 400) h.history = h.history.slice(-400);
    writeFileSync(SH_FILE(d), JSON.stringify(h, null, 2), "utf8");
  } catch { /* 非关键 */ }
}

// ── 类型守卫: 从事件流取强类型 payload ──
type EvOf<K extends DomainEvent["kind"]> = Extract<DomainEvent, { kind: K }>;
function payloadsOf<K extends DomainEvent["kind"]>(events: WorldEventRecord[], kind: K): Array<{ tick: number; p: EvOf<K> }> {
  const out: Array<{ tick: number; p: EvOf<K> }> = [];
  for (const e of events) if (e.kind === kind) out.push({ tick: e.tick ?? 0, p: e.payload as EvOf<K> });
  return out;
}

// ── ① story-sifting: 在事件流上跑模式匹配, 筛成链的好故事 ──
const PATTERN_BASE: Record<string, number> = {
  复仇闭环: 1.0, 巨变连锁: 0.95, 逆袭登顶: 0.9, 崛起陨落: 0.85, 覆灭复兴: 0.8, 派系覆灭: 0.5, 宿敌易主: 0.7,
};
export function siftStories(events: WorldEventRecord[]): StoryChain[] {
  const fell = payloadsOf(events, "CharacterFell");
  const veng = payloadsOf(events, "VengeanceResolved");
  const dissolved = payloadsOf(events, "FactionDissolved");
  const entered = payloadsOf(events, "CharacterEntered");
  const transc = payloadsOf(events, "CharacterTranscended");
  const advanced = payloadsOf(events, "ProgressionAdvanced");
  const stories = payloadsOf(events, "StoryEventTriggered");
  const split = payloadsOf(events, "FactionSplit"); // T3 新事件(可能尚无)
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick ?? 0), 1);
  const chains: StoryChain[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string): void => { counts[k] = (counts[k] ?? 0) + 1; };

  // 复仇闭环: 某人陨落(name=N) → 之后 VengeanceResolved(avenged=N, 雪恨)
  for (const f of fell) {
    const av = veng.find((v) => v.tick >= f.tick && v.p.avenged === f.p.name && /雪恨|功成/.test(v.p.outcome));
    if (av) { chains.push(mkChain("复仇闭环", `${f.p.name}陨于${f.p.cause}，仇得雪`, av.tick - f.tick, 1, av.tick)); bump("复仇闭环"); }
    else { // 悬仇: 陨落但未了 → 半成形(供顺水推舟)
      chains.push({ ...mkChain("复仇闭环", `${f.p.name}陨于${f.p.cause}，仇未雪`, maxTick - f.tick, 0.4, f.tick), dangling: true }); bump("复仇闭环");
    }
  }
  // 崛起陨落: 同一角色 ≥1 次进阶后陨落(悲剧)
  for (const f of fell) {
    const rises = advanced.filter((a) => a.p.characterId === f.p.characterId && a.tick < f.tick).length;
    if (rises >= 1) { chains.push(mkChain("崛起陨落", `${f.p.name}历${rises}番精进终殁`, f.tick, Math.min(1, 0.5 + rises * 0.2), f.tick)); bump("崛起陨落"); }
  }
  // 逆袭登顶: 登场 → 多次进阶 → 登顶(功成身退)
  for (const t of transc) {
    const rises = advanced.filter((a) => a.p.characterId === t.p.characterId && a.tick <= t.tick).length;
    const ent = entered.find((e) => e.p.characterId === t.p.characterId);
    if (rises >= 2) { chains.push(mkChain("逆袭登顶", `${t.p.name}自微末登${t.p.toTier}`, ent ? t.tick - ent.tick : t.tick, Math.min(1, 0.6 + rises * 0.1), t.tick)); bump("逆袭登顶"); }
  }
  // 覆灭复兴: 派系覆灭 → 之后同名派系有人登场(残部复兴)
  for (const d of dissolved) {
    const rev = entered.find((e) => e.tick > d.tick && e.p.faction === d.p.faction);
    if (rev) { chains.push(mkChain("覆灭复兴", `${d.p.faction}一脉覆而复兴`, rev.tick - d.tick, 1, rev.tick)); bump("覆灭复兴"); }
    else { chains.push(mkChain("派系覆灭", `${d.p.faction}为${d.p.into}所并`, 1, 0.6, d.tick)); bump("派系覆灭"); }
  }
  // 宿敌易主: 派系分裂(T3)→ 叛离自立
  for (const s of split) { chains.push(mkChain("宿敌易主", `${s.p.faction}内裂、${s.p.into}自立`, 1, 0.8, s.tick)); bump("宿敌易主"); }
  // 巨变连锁: 一桩大事 3 tick 内引发 ≥2 个 {陨落/覆灭/复仇了断} = 高强度雪崩
  for (const st of stories) {
    const within = [...fell, ...dissolved, ...veng].filter((x) => x.tick >= st.tick && x.tick <= st.tick + 3).length;
    if (within >= 2) { chains.push(mkChain("巨变连锁", `${st.p.name}牵动${within}桩生死兴亡`, 3, Math.min(1, 0.5 + within * 0.15), st.tick)); bump("巨变连锁"); }
  }

  // rarity: 同型越多越不稀奇(StU 统计罕见度); 再按跨度给个体罕见加成
  for (const c of chains) {
    const typeCount = counts[c.pattern] ?? 1;
    const typeRarity = 1 / Math.sqrt(typeCount);
    const spanRarity = Math.min(1, 0.4 + c.span / maxTick); // 跨度大=积累久=更难得
    c.rarity = +(0.6 * typeRarity + 0.4 * spanRarity).toFixed(3);
    const base = PATTERN_BASE[c.pattern] ?? 0.5;
    const spanFactor = Math.min(1, 0.5 + c.span / Math.max(1, maxTick) * 0.5);
    c.quality = +(base * c.completeness * spanFactor * (0.5 + 0.5 * c.rarity) * (c.dangling ? 0.5 : 1)).toFixed(3);
  }
  return chains;
}
function mkChain(pattern: string, desc: string, span: number, completeness: number, atTick: number): StoryChain {
  return { pattern, desc, span: Math.max(0, span), completeness, rarity: 0.5, quality: 0, atTick };
}

// ── ② 派系冲突图张力 ──
function numProp(c: CharacterState, k: string): number { return typeof c.props[k] === "number" ? (c.props[k] as number) : 0; }
function factionOf(c: CharacterState): string { return typeof c.props["faction"] === "string" ? (c.props["faction"] as string) : ""; }
export function factionTension(snapshot: WorldSnapshot, events: WorldEventRecord[]): SimFitness["tension"] {
  const present = Object.values(snapshot.characters).filter((c) => c.present);
  const fr = (snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined) ?? {};
  const facs = [...new Set(present.map(factionOf).filter(Boolean))];
  const sizeOf = (f: string): number => present.filter((c) => factionOf(c) === f).length;
  const powerOf = (f: string): number => present.filter((c) => factionOf(c) === f).reduce((a, c) => a + 1 + numProp(c, "历练") * 0.3 + (c.progressionTier ? 0.5 : 0), 0);

  // 敌对对: factionRelations < 0。只算「双方都有在场成员」的派系对——空壳关系(成员已尽殁)不该撑高张力(已验证: 坍塌世界关系图很丰富但无人去演)
  const live = new Set(facs);
  const hostile: Array<{ a: string; b: string; w: number }> = [];
  for (const a of Object.keys(fr)) for (const b of Object.keys(fr[a] ?? {})) if (a < b && (fr[a]?.[b] ?? 0) < 0 && live.has(a) && live.has(b)) hostile.push({ a, b, w: fr[a]![b]! });
  const pairs = Math.max(1, (facs.length * (facs.length - 1)) / 2);
  const polarization = Math.min(1, hostile.reduce((s, h) => s + Math.min(1, -h.w / 6), 0) / pairs);

  // balance: 最敌对一对的势力是否势均
  let balance = 0.5, directness = 0;
  if (hostile.length) {
    const worst = [...hostile].sort((x, y) => x.w - y.w)[0]!;
    const pa = powerOf(worst.a), pb = powerOf(worst.b);
    balance = pa + pb > 0 ? 1 - Math.abs(pa - pb) / (pa + pb) : 0.5;
    // directness: 敌对两派的成员间是否真有负 bond(正面交锋)
    const ma = present.filter((c) => factionOf(c) === worst.a), mb = present.filter((c) => factionOf(c) === worst.b);
    let cross = 0, neg = 0;
    for (const x of ma) for (const y of mb) { cross++; if (numProp(x, `bond:${y.id}`) < 0 || numProp(y, `bond:${x.id}`) < 0) neg++; }
    directness = cross ? neg / cross : 0;
  }

  // intensity: 平均张力 + 危机 + 悬而未决的复仇
  const avgStress = present.length ? present.reduce((a, c) => a + c.narrativeStress, 0) / present.length : 0;
  const hasCrisis = typeof snapshot.props["crisis"] === "string" && (snapshot.props["crisis"] as string).length > 4 ? 1 : 0;
  const avengers = present.filter((c) => typeof c.props["avenge"] === "string").length;
  const intensity = Math.min(1, 0.55 * avgStress + 0.25 * hasCrisis + 0.2 * Math.min(1, avengers / 3));

  // resolution: 历史上多少陨落得到了了断(VengeanceResolved / CharacterFell)
  const nFell = events.filter((e) => e.kind === "CharacterFell").length;
  const nResolved = events.filter((e) => e.kind === "VengeanceResolved").length;
  const resolution = nFell ? Math.min(1, nResolved / nFell) : 0.5;

  // volatility: 近 24 tick 的兴亡事件密度
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick ?? 0), 1);
  const recent = events.filter((e) => (e.tick ?? 0) >= maxTick - 24);
  const upheaval = recent.filter((e) => e.kind === "CharacterFell" || e.kind === "FactionDissolved" || e.kind === "FactionSplit" || e.kind === "CharacterTranscended").length;
  const volatility = Math.min(1, upheaval / 6);

  // 合成(0..10): 要极化+势均+正面交锋, intensity 中高最佳, resolution 取中段(有了有未了=有张弛)
  const band = (x: number, peak: number, w: number): number => Math.max(0, 1 - Math.abs(x - peak) / w);
  const intensityBand = band(intensity, 0.65, 0.5);
  const resolutionBand = band(resolution, 0.55, 0.5);
  const score = +(10 * (0.22 * polarization + 0.18 * balance + 0.15 * directness + 0.22 * intensityBand + 0.13 * resolutionBand + 0.10 * volatility)).toFixed(2);
  return { polarization: +polarization.toFixed(3), balance: +balance.toFixed(3), directness: +directness.toFixed(3), intensity: +intensity.toFixed(3), resolution: +resolution.toFixed(3), volatility: +volatility.toFixed(3), score };
}

// ── ③ ASAL 历史新颖度: 窗口章对所有历史章的最大相似度越低越好 ──
function gramSig(text: string, n = 4, cap = 400): Set<string> {
  const chars = [...text.replace(/\s+/g, "")];
  const s = new Set<string>();
  const stride = Math.max(1, Math.floor((chars.length - n) / cap));
  for (let i = 0; i + n <= chars.length; i += stride) s.add(chars.slice(i, i + n).join(""));
  return s;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
export function historicalNovelty(chapters: Array<{ text: string }>, windowN: number): number {
  if (chapters.length <= 1) return 1;
  const sigs = chapters.map((c) => gramSig(c.text));
  const start = Math.max(1, chapters.length - windowN);
  let acc = 0, cnt = 0;
  for (let i = start; i < chapters.length; i++) {
    let maxSim = 0;
    for (let j = 0; j < i; j++) maxSim = Math.max(maxSim, jaccard(sigs[i]!, sigs[j]!));
    acc += 1 - maxSim; cnt++;
  }
  return cnt ? +(acc / cnt).toFixed(3) : 1;
}

// ── 合成模拟层 fitness ──
export function computeSimFitness(events: WorldEventRecord[], snapshot: WorldSnapshot, chapters: Array<{ goal: string; text: string }>, vol: number, atCh: number, windowN = 8): SimFitness {
  const chains = siftStories(events);
  const patterns: Record<string, number> = {};
  for (const c of chains) patterns[c.pattern] = (patterns[c.pattern] ?? 0) + 1;
  const lifetimeQ = chains.reduce((a, c) => a + c.quality, 0);
  // sift score(0..10): 按「完成于近窗」recency 加权(Awash: 故事完成那刻才记分), 而非全生命周期除以窗口 → 度量本卷基因产出的当下戏剧密度
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick ?? 0), 1);
  const halfLife = windowN * 3 * 0.7; // 半衰≈窗口的 0.7(近 8 章主导)
  const recentQ = chains.reduce((a, c) => a + c.quality * Math.exp(-(maxTick - c.atTick) / Math.max(1, halfLife)), 0);
  const SIFT_SCALE = 5; // 经 qunxiang 真实数据校准: 近窗 recentQ≈1.5 → ~6.5 分
  const siftScore = +Math.min(10, Math.log1p(recentQ * SIFT_SCALE) / Math.log1p(SIFT_SCALE * 0.8) * 5).toFixed(2);
  const top = [...chains].filter((c) => !c.dangling).sort((a, b) => b.quality - a.quality).slice(0, 4).map((c) => `${c.pattern}:${c.desc}`);
  const dangling = chains.filter((c) => c.dangling).map((c) => c.desc).slice(0, 6);

  const tension = factionTension(snapshot, events);
  const novelty = historicalNovelty(chapters, windowN);

  // 反 reward-hack(审计 §防自欺红线): 兴亡密度顶天 + 化解极低 = 永恒混战/天天灭门(曲线顶格也无聊), 非真有戏 → 折扣
  // 防进化发现"多杀人多起大事就能抬 simFit"而朝灭门坍塌(simFit 占基因适应度 28%)。
  const massacre = tension.volatility >= 0.9 && tension.resolution < 0.3;
  let total = +(0.5 * siftScore + 0.3 * tension.score + 0.2 * (novelty * 10)).toFixed(2);
  if (massacre) total = +(total * 0.75).toFixed(2);
  return {
    sift: { chains: chains.length, quality: +lifetimeQ.toFixed(2), score: siftScore, top, patterns, dangling },
    tension, novelty, total, vol, atCh,
  };
}
