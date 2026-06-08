// app/warm-fitness.ts — 温情专属 fitness(T3)。与 sim-fitness.ts(戏剧层)彻底分开:
//   绝不复用 siftStories 的戏剧链(复仇/陨落/巨变), 零 valence<0 / 兴亡 / 张力项。
// 六信号(0..10), 度量「温情世界够不够暖、够不够流动、够不够推进、够不够新」:
//   ① W_var(0.30): 近窗章正文 2-gram 名词指纹的逐章两两 Jaccard 均值之补 = 场景/意象多样性。
//      [C4] 这才是现有 novelty(4-gram, renjian 0.992 却坍塌)看不见的维度 → 直接惩罚 motif 坍塌。
//   ② W_bond(0.25): 快照 c.props["bond:*"] 正向累计 / 在场人数(关系网越暖越高)。
//   ③ W_social(0.20): StageCommitted 的 chosenCandidateId 含 ally/相聚(论道结善)占比 + 新面孔(CharacterEntered)频次。
//   ④ W_arc(0.15): StageCommitted summary 文本匹配温情完成词(团聚/和解/抵达/释怀), 剔负向项。
//   ⑤ W_progress(0.10, T3): 读 progression-ledger.json 累计里程碑达成 + 近窗处境净位移 = 人生脊梁推进度。纯进度、绝不测冲突。
//   ⑥ W_emerge(0.05, T2'): 读事件层涌现多样性(ally 措辞多样/faction 首现广度/move 占比/tier 跨越频次) → 接进化(sim 层一改即反映)。与 social 正交: social 测暖, emerge 测新。
//      [诚实化·审计L-4] 但 emerge 与 ⑤progress 在 move/tier 维度【弱正相关、非完全正交】: 一次 -move 或 ProgressionAdvanced 会同向抬 emerge 与 progress 两路。二者合计仅 0.15 权重、且 progress 经 LLM 处境判定解耦(move 不直接写 lastAdvanceCh), 重叠影响小、可接受; 勿为去耦砍 emerge 的 move/tier(会削其对 sim 层 S2/tier 改动的敏感度)。
//      var 由 0.40→0.30(匀 0.10 给 progress)→ 0.25(再匀 0.05 给 emerge); var 仍并列最高、绝对值不变、不破场景施压主力。
// 落盘镜像 sim-fitness.ts(warm-fitness.json); longrun 每 8 章算好存盘, evolve.ts GENTLE 分支折进基因适应度。
// core/ 不涉, 纯 app 层。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WorldEventRecord } from "../core/domain/events";
import type { WorldSnapshot, CharacterState } from "../core/domain/world";
import { motifSig, nameGrams } from "./gentle-director"; // 复用 2-gram 名词指纹 + 人名停用集(避免重写)
import { jaccard } from "./sim-fitness";      // 复用 Jaccard(gentle-director 自己也从这里取, 不转出)
import { loadPL } from "./progression-ledger"; // [T3] 读进展账本算 W_progress(无循环: progression-ledger 不 import warm-fitness, 仅依赖 sim-fitness)

export interface WarmFitness { total: number; var: number; bond: number; social: number; arc: number; progress: number; emerge: number; breath: number; atCh: number }
export interface WarmHistory { history: Array<{ atCh: number; total: number; var: number; bond: number; social: number; arc: number; progress: number; emerge: number; breath: number }> }

const WF_FILE = (d: string): string => join(d, "warm-fitness.json");
const WH_FILE = (d: string): string => join(d, "warm-fitness-history.json");

export function loadWarmFit(d: string): WarmFitness | null {
  try { return existsSync(WF_FILE(d)) ? (JSON.parse(readFileSync(WF_FILE(d), "utf8")) as WarmFitness) : null; } catch { return null; }
}
export function saveWarmFit(d: string, wf: WarmFitness): void {
  try {
    writeFileSync(WF_FILE(d), JSON.stringify(wf, null, 2), "utf8");
    const h: WarmHistory = (() => { try { return existsSync(WH_FILE(d)) ? (JSON.parse(readFileSync(WH_FILE(d), "utf8")) as WarmHistory) : { history: [] }; } catch { return { history: [] }; } })();
    h.history.push({ atCh: wf.atCh, total: wf.total, var: wf.var, bond: wf.bond, social: wf.social, arc: wf.arc, progress: wf.progress, emerge: wf.emerge, breath: wf.breath });
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
// [F1 附带] 扩入 S1 ally 措辞库新动词(煮茶/夜话/结伴/对弈/切磋/援手/闲话/消闲/互赠/托付/共渡) → 防新措辞被误判非温情完成。
const WARM_DONE = /团聚|重逢|相聚|和解|和好|化解|抵达|归来|归乡|释怀|了却|了结|结善|论道|相托|相守|安顿|安居|寻常|煮茶|夜话|结伴|对弈|切磋|援手|闲话|消闲|互赠|托付|共渡/;
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

// ⑤ 进展动量 W_progress(0..10): 读 progression-ledger.json 的累计里程碑达成数 + 近窗处境净位移。[T3]
//    纯进度信号, 绝不测冲突 → 与 bond/social/arc 并列、不与 var(场景多样)语义重叠。无账本 → 中性 5。
//    合成 = 0.6·里程碑达成进度分(reached 越多越高) + 0.4·近窗新鲜分(lastAdvanceCh 距当前 atCh 越近越高)。
function progressMomentum(dir: string): number {
  const pl = loadPL(dir);
  // 无账本 / 从未写过任何拍子 → 尚无进度可测, 给中性(不误判停滞、也不送分)。
  if (!pl || (pl.reachedMilestones.length === 0 && pl.writtenBeats.length === 0 && pl.lastAdvanceCh === 0)) return 5;
  // 达成分: 每达成 1 个里程碑 +2.5, 封顶 10(4 个里程碑即满 → 与温情慢燃节奏匹配)。
  const reachedScore = Math.min(10, pl.reachedMilestones.length * 2.5);
  // [F2 真实化] 新鲜分: 当前章号(取近窗最末拍子 ch, 无则用 lastAdvanceCh)与上次真挪移章的间距; 越近越高。≥60 章未挪移 → 0(收紧 80→60, 更敏感)。
  const lastBeatCh = pl.writtenBeats.length ? pl.writtenBeats[pl.writtenBeats.length - 1]!.ch : pl.lastAdvanceCh;
  const sinceAdvance = Math.max(0, lastBeatCh - pl.lastAdvanceCh);
  const freshScore = pl.lastAdvanceCh > 0 ? Math.max(0, 10 - (sinceAdvance / 60) * 10) : 3;
  // [F2] 权重翻转: 0.35·达成(脊梁在走) + 0.65·新鲜(近期真挪移) → 剧本耗尽不再锁高(旧 0.6·达成封顶锁 9.2), 须持续长新才高。真正的真实化靠 C1 刷新 lastAdvanceCh。
  return +Math.max(0, Math.min(10, 0.35 * reachedScore + 0.65 * freshScore)).toFixed(2);
}

// ⑥ 涌现多样性 W_emerge(0..10): 读【事件层】——ally summary 措辞多样性 + faction 首现广度 + move 占比 + tier 跨越频次。[T2']
//    纯事件度量(非 prose), 故 sim 层措辞库化(S1)/命名多样(S3)/move 可选(S2)一改即反映 → 进化可见(修死穴: prose 通道改不动 socialWarmth 的 sim 度量→进化看不见)。
//    与 W_social(测 ally 比/暖度)正交: social 测"暖不暖", emerge 测"新不新"。
function emergeDiversity(events: WorldEventRecord[]): number {
  const allySummaries: string[] = []; const factions = new Set<string>(); let moves = 0; let engage = 0; let tierJumps = 0;
  for (const e of events) {
    if (e.kind === "StageCommitted") {
      const id = (e.payload as { chosenCandidateId?: string }).chosenCandidateId ?? "";
      const s = (e.payload as { summary?: string }).summary ?? "";
      if (/-ally-/.test(id)) { allySummaries.push(s.replace(/[一-龥]{2,4}与[一-龥]{2,4}/, "")); engage++; } // 去人名, 留动词
      else if (/-clash-|-avenge-/.test(id)) engage++;
      else if (/-move\b/.test(id)) { moves++; engage++; }
    } else if (e.kind === "CharacterEntered") { const f = (e.payload as { faction?: string }).faction; if (f) factions.add(f); }
    else if (e.kind === "ProgressionAdvanced") tierJumps++;
  }
  // ① ally 措辞多样: 不同动词种类 / ally 总数(单模板→趋 0; 10 词轮替→趋 1)
  const verbVariety = allySummaries.length ? new Set(allySummaries).size / Math.min(allySummaries.length, 10) : 0.5;
  // ② faction 首现广度: 窗内出现的不同 faction 数 / 6(目标多样)
  const facVariety = Math.min(1, factions.size / 6);
  // ③ move 占比: 有移动=处境真挪(0→趋 0; 越多越高, 封顶在 ~15% 即满, 不鼓励满世界乱跑)
  const moveRatio = engage ? Math.min(1, (moves / engage) / 0.15) : 0;
  // ④ tier 跨越频次: 窗内 ProgressionAdvanced 数 / 4
  const tierFreq = Math.min(1, tierJumps / 4);
  return +Math.max(0, Math.min(10, 10 * (0.4 * verbVariety + 0.25 * facVariety + 0.2 * moveRatio + 0.15 * tierFreq))).toFixed(2);
}

// ⑦ 留白节奏 W_breath(0..10): 对白信息密度的【反向】项——对话/千字 低=寡淡留白(言外之意)、高=情报播报(读着累)。[M3·降密度·info-density 研究 .audit/20260607-info-density]
//    ⚠实测教训(2caf8ae→本次修): 物象/感官密度三种测法(总命中/去重种类/重复度)都【区分不开】温情好/坏章——因"一两件物反复回扣"(降密度想要的)会重复同一物→物象总命中也高、且高密度章重复度反而最高(sj136=11.3)→物象 lexicon 是噪声、还反向罚回扣, 故【弃用 obj 项】。唯一干净的密度判别=对话/千字(好章 3.7-5.9 寡淡 vs 高密度 9.2-13.1 情报播报)。与 W_var 正交。
function breathRhythm(recentCh: Array<{ goal: string; text: string }>): number {
  const texts = recentCh.filter((c) => (c.text ?? "").replace(/\s/g, "").length > 200).map((c) => c.text ?? "");
  if (!texts.length) return 6; // 样本不足 → 中性偏高(不误判)
  let acc = 0; let n = 0;
  for (const t of texts) {
    const compact = t.replace(/\s/g, "");
    if (compact.length < 200) continue;
    const dlgPer1k = ((t.match(/[「」“”]/g)?.length ?? 0) / 2) / (compact.length / 1000); // 对话/千字(引号对数)
    acc += Math.max(0, Math.min(1, (13 - dlgPer1k) / 7)); // 对话/1k ≤6→满, ≥13→0(高密度章对白=情报播报、信息密集)
    n++;
  }
  if (!n) return 6;
  return +Math.max(0, Math.min(10, 10 * (acc / n))).toFixed(2);
}

export function computeWarmFit(events: WorldEventRecord[], snapshot: WorldSnapshot, recentCh: Array<{ goal: string; text: string }>, dir: string): WarmFitness {
  const wVar = sceneDiversity(recentCh, nameGrams(Object.values(snapshot.characters).map((c) => c.name)));
  const wBond = bondWarmth(snapshot);
  const wSocial = socialWarmth(events);
  const wArc = arcWarmth(events);
  const wProg = progressMomentum(dir); // [T3] 读账本, 纯进度
  const wEmerge = emergeDiversity(events); // [T2'] 读事件层涌现多样性, 接进化
  const wBreath = breathRhythm(recentCh); // [M3·降密度] 段内留白节奏(短句呼吸+疏密起伏); 低=读着累
  // [M3] var 0.25→0.17 匀 0.08 给 breath。var 权重降(研究: W_var 跨章求新会传导成「每章铺新器物」的密度-UP 压力, 降权减此压); var 信号值仍由 gentle-director 守高(命门是值≥9.4、非权重, 不受影响)。其余信号语义不动。
  const total = +(0.17 * wVar + 0.25 * wBond + 0.20 * wSocial + 0.15 * wArc + 0.10 * wProg + 0.05 * wEmerge + 0.08 * wBreath).toFixed(2);
  return { total, var: wVar, bond: wBond, social: wSocial, arc: wArc, progress: wProg, emerge: wEmerge, breath: wBreath, atCh: snapshot.tick ?? 0 };
}
