// app/warm-fitness.ts — 温情专属 fitness(T3)。与 sim-fitness.ts(戏剧层)彻底分开:
//   绝不复用 siftStories 的戏剧链(复仇/陨落/巨变), 零 valence<0 / 兴亡 / 张力项。
// 四信号(0..10), 度量「温情世界够不够暖、够不够流动」:
//   ① W_var(权重最高 0.40): 近窗章正文 2-gram 名词指纹的逐章两两 Jaccard 均值之补 = 场景/意象多样性。
//      [C4] 这才是现有 novelty(4-gram, renjian 0.992 却坍塌)看不见的维度 → 直接惩罚 motif 坍塌。
//   ② W_bond(0.25): 快照 c.props["bond:*"] 正向累计 / 在场人数(关系网越暖越高)。
//   ③ W_social(0.20): StageCommitted 的 chosenCandidateId 含 ally/相聚(论道结善)占比 + 新面孔(CharacterEntered)频次。
//   ④ W_arc(0.15): StageCommitted summary 文本匹配温情完成词(团聚/和解/抵达/释怀), 剔负向项。
// 落盘镜像 sim-fitness.ts(warm-fitness.json); longrun 每 8 章算好存盘, evolve.ts GENTLE 分支折进基因适应度。
// core/ 不涉, 纯 app 层。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WorldEventRecord } from "../core/domain/events";
import type { WorldSnapshot, CharacterState } from "../core/domain/world";
import { motifSig, nameGrams } from "./gentle-director"; // 复用 2-gram 名词指纹 + 人名停用集(避免重写)
import { jaccard } from "./sim-fitness";      // 复用 Jaccard(gentle-director 自己也从这里取, 不转出)

export interface WarmFitness { total: number; var: number; bond: number; social: number; arc: number; atCh: number }
export interface WarmHistory { history: Array<{ atCh: number; total: number; var: number; bond: number; social: number; arc: number }> }

const WF_FILE = (d: string): string => join(d, "warm-fitness.json");
const WH_FILE = (d: string): string => join(d, "warm-fitness-history.json");

export function loadWarmFit(d: string): WarmFitness | null {
  try { return existsSync(WF_FILE(d)) ? (JSON.parse(readFileSync(WF_FILE(d), "utf8")) as WarmFitness) : null; } catch { return null; }
}
export function saveWarmFit(d: string, wf: WarmFitness): void {
  try {
    writeFileSync(WF_FILE(d), JSON.stringify(wf, null, 2), "utf8");
    const h: WarmHistory = (() => { try { return existsSync(WH_FILE(d)) ? (JSON.parse(readFileSync(WH_FILE(d), "utf8")) as WarmHistory) : { history: [] }; } catch { return { history: [] }; } })();
    h.history.push({ atCh: wf.atCh, total: wf.total, var: wf.var, bond: wf.bond, social: wf.social, arc: wf.arc });
    if (h.history.length > 400) h.history = h.history.slice(-400);
    writeFileSync(WH_FILE(d), JSON.stringify(h, null, 2), "utf8");
  } catch { /* 非关键 */ }
}

// ① 场景·意象多样性 W_var: 对每章正文跑 2-gram 名词指纹 → 逐章两两 Jaccard 均值的补(0..10)。[C4]
function sceneDiversity(recentCh: Array<{ goal: string; text: string }>, nameStop?: Set<string>): number {
  const sigs = recentCh.filter((c) => (c.text ?? "").replace(/\s/g, "").length > 40).map((c) => new Set(motifSig([c.goal ?? ""], [c.text ?? ""], 12, nameStop)));
  if (sigs.length <= 1) return 7; // 样本不足 → 中性偏高(不误判坍塌)
  let acc = 0; let cnt = 0;
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) { acc += jaccard(sigs[i]!, sigs[j]!); cnt++; }
  const meanSim = cnt ? acc / cnt : 0;
  return +Math.max(0, Math.min(10, (1 - meanSim) * 10)).toFixed(2);
}

// ② 关系升温 W_bond: 快照在场角色 bond:* 正值累计 / 在场人数 → 暖度(0..10)。
function bondWarmth(snapshot: WorldSnapshot): number {
  const present = Object.values(snapshot.characters).filter((c: CharacterState) => c.present);
  if (!present.length) return 5;
  let posSum = 0;
  for (const c of present) for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number" && v > 0) posSum += v;
  const perCap = posSum / present.length; // 人均正向羁绊强度
  return +Math.max(0, Math.min(10, perCap * 2.5)).toFixed(2); // 人均 ~4 正向 bond → 满分(校准: ally 每次 +1)
}

// ③ 人情往来 W_social: StageCommitted 中 ally/相聚 占 engage 类之比 + 新面孔(CharacterEntered)频次。
//    信号建在 chosenCandidateId(events.ts:24 真字段)正则 + CharacterEntered 计数, 不依赖不存在的 scene 字段。[C8]
function socialWarmth(events: WorldEventRecord[]): number {
  let ally = 0; let engage = 0;
  for (const e of events) {
    if (e.kind !== "StageCommitted") continue;
    const id = (e.payload as { chosenCandidateId?: string }).chosenCandidateId ?? "";
    if (/-ally-/.test(id)) { ally++; engage++; }
    else if (/-clash-|-avenge-/.test(id)) { engage++; }
  }
  const allyRatio = engage ? ally / engage : 0.5; // 无互动 → 中性
  const newFaces = events.filter((e) => e.kind === "CharacterEntered").length;
  const faceFreq = Math.min(1, newFaces / 6); // 新面孔登场频次(窗内 ~6 个登场即满)
  return +Math.max(0, Math.min(10, 10 * (0.7 * allyRatio + 0.3 * faceFreq))).toFixed(2);
}

// ④ 宁静弧完成度 W_arc: StageCommitted summary 匹配温情完成词, 剔除负向项。
//    StageCommitted payload 无 valence 字段(events.ts:24)→ 退化: 用负向语义词(陨/亡/殁/覆灭/仇/杀/夺/争)代替 valence<0 排除, 注释标注。[C9]
const WARM_DONE = /团聚|重逢|相聚|和解|和好|化解|抵达|归来|归乡|释怀|了却|了结|结善|论道|相托|相守|安顿|安居|寻常/;
const NEG_MARK = /陨|亡|殁|死|覆灭|灭门|仇|杀|斩|夺|劫|争|交锋|问罪|追杀|裂/;
function arcWarmth(events: WorldEventRecord[]): number {
  let warm = 0; let total = 0;
  for (const e of events) {
    if (e.kind !== "StageCommitted") continue;
    const s = (e.payload as { summary?: string }).summary ?? e.summary ?? "";
    if (!s) continue;
    if (NEG_MARK.test(s)) continue; // 退化排除 valence<0(无该字段): 含兴亡/冲突语义的不计入温情善了
    total++;
    if (WARM_DONE.test(s)) warm++;
  }
  if (!total) return 5; // 无可判样本 → 中性
  return +Math.max(0, Math.min(10, (warm / total) * 10)).toFixed(2);
}

export function computeWarmFit(events: WorldEventRecord[], snapshot: WorldSnapshot, recentCh: Array<{ goal: string; text: string }>): WarmFitness {
  const wVar = sceneDiversity(recentCh, nameGrams(Object.values(snapshot.characters).map((c) => c.name)));
  const wBond = bondWarmth(snapshot);
  const wSocial = socialWarmth(events);
  const wArc = arcWarmth(events);
  const total = +(0.40 * wVar + 0.25 * wBond + 0.20 * wSocial + 0.15 * wArc).toFixed(2);
  return { total, var: wVar, bond: wBond, social: wSocial, arc: wArc, atCh: snapshot.tick ?? 0 };
}
