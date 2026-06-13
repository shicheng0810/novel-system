// app/warm-fitness.ts — 温情专属 fitness(T3)。与 sim-fitness.ts(戏剧层)彻底分开:
//   绝不复用 siftStories 的戏剧链(复仇/陨落/巨变), 零 valence<0 / 兴亡 / 张力项。
// 六信号(0..10), 度量「温情世界够不够暖、够不够流动、够不够推进、够不够新」:
//   ① W_var(0.30): 近窗章正文 2-gram 名词指纹的逐章两两 Jaccard 均值之补 = 场景/意象多样性。[fv2: 高段幂放大 γ=9, 见 sceneDiversity]
//      [C4] 这才是现有 novelty(4-gram, renjian 0.992 却坍塌)看不见的维度 → 直接惩罚 motif 坍塌。
//   ② W_bond(0.25): 快照 c.props["bond:*"] 正向累计 / 在场人数(关系网越暖越高)。[fv2: log1p 压缩·满分阈 4→8, 见 bondWarmth]
//   ③ W_social(0.20): StageCommitted 的 chosenCandidateId 含 ally/相聚(论道结善)占比 + 新面孔(CharacterEntered)频次。
//   ④ W_arc(0.15): StageCommitted summary 文本匹配温情完成词(团聚/和解/抵达/释怀), 剔负向项。
//   ⑤ W_progress(0.10, T3): 读 progression-ledger.json 累计里程碑达成 + 近窗处境净位移 = 人生脊梁推进度。纯进度、绝不测冲突。
//   ⑥ W_emerge(0.05, T2'): 读事件层涌现多样性(ally 措辞多样/faction 首现广度/move 占比/tier 跨越频次) → 接进化(sim 层一改即反映)。与 social 正交: social 测暖, emerge 测新。
//      [诚实化·审计L-4] 但 emerge 与 ⑤progress 在 move/tier 维度【弱正相关、非完全正交】: 一次 -move 或 ProgressionAdvanced 会同向抬 emerge 与 progress 两路。二者合计仅 0.15 权重、且 progress 经 LLM 处境判定解耦(move 不直接写 lastAdvanceCh), 重叠影响小、可接受; 勿为去耦砍 emerge 的 move/tier(会削其对 sim 层 S2/tier 改动的敏感度)。
//      var 由 0.40→0.30(匀 0.10 给 progress)→ 0.25(再匀 0.05 给 emerge); var 仍并列最高、绝对值不变、不破场景施压主力。
// 落盘镜像 sim-fitness.ts(warm-fitness.json); longrun 每 8 章算好存盘, evolve.ts GENTLE 分支折进基因适应度。
// core/ 不涉, 纯 app 层。
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { WorldEventRecord } from "../core/domain/events";
import type { WorldSnapshot, CharacterState } from "../core/domain/world";
import { motifSig, nameGrams } from "./gentle-director"; // 复用 2-gram 名词指纹 + 人名停用集(避免重写)
import { jaccard } from "./sim-fitness";      // 复用 Jaccard(gentle-director 自己也从这里取, 不转出)
import { loadPL } from "./progression-ledger"; // [T3] 读进展账本算 W_progress(无循环: progression-ledger 不 import warm-fitness, 仅依赖 sim-fitness)

// [P0-8 fv 公式版本戳] WARM_FV=2: bond 对数压缩(满分阈 4→8) + var 高段幂放大(γ=9), 由 yunyou 归档 39 窗重放选型(/tmp/replay-warm.ts, 证据见各函数注释)。
//   旧落盘条目【无 fv 字段 = fv1 语义】(bond perCap×2.5 满分阈≈4 / var 线性 (1-meanSim)*10)——跨 fv 的分数不可直接比较(蓝图: 同 fv 内比较)。
export const WARM_FV = 2;
export interface WarmFitness {
  total: number; var: number; bond: number; social: number; arc: number; progress: number; emerge: number; breath: number; treadmill: number; clean: number; atCh: number;
  fv?: number; // 公式版本戳(compute 恒写 WARM_FV; 旧文件缺省=1 语义)
  progressFrozen?: boolean; // [P0-8] progress 信号源缺失/冻结标注(只标不改分·不动 server, 供后续曲线标注/消费者自取; 仅为 true 时落盘)
}
export interface WarmHistory { history: Array<{ atCh: number; total: number; var: number; bond: number; social: number; arc: number; progress: number; emerge: number; breath: number; treadmill: number; clean: number; fv?: number }> } // fv: 旧条目无此字段=fv1 语义

const WF_FILE = (d: string): string => join(d, "warm-fitness.json");
const WH_FILE = (d: string): string => join(d, "warm-fitness-history.json");

export function loadWarmFit(d: string): WarmFitness | null {
  try { return existsSync(WF_FILE(d)) ? (JSON.parse(readFileSync(WF_FILE(d), "utf8")) as WarmFitness) : null; } catch { return null; }
}
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→load 静默回空(蓝图 .audit/20260610-evolution-overhaul §3.2)
export function saveWarmFit(d: string, wf: WarmFitness): void {
  try {
    atomicWrite(WF_FILE(d), JSON.stringify(wf, null, 2));
    const h: WarmHistory = (() => { try { return existsSync(WH_FILE(d)) ? (JSON.parse(readFileSync(WH_FILE(d), "utf8")) as WarmHistory) : { history: [] }; } catch { return { history: [] }; } })();
    h.history.push({ atCh: wf.atCh, total: wf.total, var: wf.var, bond: wf.bond, social: wf.social, arc: wf.arc, progress: wf.progress, emerge: wf.emerge, breath: wf.breath, treadmill: wf.treadmill, clean: wf.clean ?? 5, fv: wf.fv ?? WARM_FV }); // [P0-8] fv 戳随条目入史(无 fv 的旧条目=fv1 语义)
    if (h.history.length > 400) h.history = h.history.slice(-400);
    atomicWrite(WH_FILE(d), JSON.stringify(h, null, 2));
  } catch { /* 非关键 */ }
}

// ① 场景·意象多样性 W_var: 对每章正文跑 2-gram 名词指纹 → 逐章两两 Jaccard 均值的补(0..10)。[C4]
function sceneDiversity(recentCh: Array<{ goal: string; text: string }>, nameStop?: Set<string>): number {
  const sigs = recentCh.filter((c) => (c.text ?? "").replace(/\s/g, "").length > 40).map((c) => new Set(motifSig([c.goal ?? ""], [c.text ?? ""], 12, nameStop)));
  if (sigs.length <= 1) return 7; // 样本不足 → 中性偏高(不误判坍塌)。⚠此常量是【成品分】, 不过下方 γ=9 幂放大(过则 7→0.40, 误杀新世界)
  let acc = 0; let cnt = 0;
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length; j++) { acc += jaccard(sigs[i]!, sigs[j]!); cnt++; }
  const meanSim = cnt ? acc / cnt : 0;
  // [P0-8 fv2 高段幂放大 γ=9 · yunyou 39 窗重放定参] 旧线性 (1-meanSim)*10 把 yunyou 全史挤在 9.65-9.85(σ=0.043, 近零梯度=蓝图证据#8)。
  // γ 网格重放(/tmp/replay-warm.ts): γ=8→σ=0.290(不达 0.3); γ=9→σ=0.319 且 yunyou 均值 9.79→8.23、huolang 现值 9.64→7.19(好世界仍≥7);
  // γ=10→σ=0.346 但 huolang→6.93(破"好世界仍高分") → 取最小达标 γ=9。motif 坍塌世界(旧分 8.0/meanSim 0.2)→1.34 重罚 = C4 本意不变。
  return +Math.max(0, Math.min(10, 10 * (1 - meanSim) ** 9)).toFixed(2);
}

// ② 关系升温 W_bond: 快照在场角色 bond:* 正值累计 / 在场人数 → 暖度(0..10)。
function bondWarmth(snapshot: WorldSnapshot): number {
  const present = Object.values(snapshot.characters).filter((c: CharacterState) => c.present);
  if (!present.length) return 5;
  let posSum = 0;
  for (const c of present) for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number" && v > 0) posSum += v;
  const perCap = posSum / present.length; // 人均正向羁绊强度
  // [P0-8 fv2 对数压缩(满分阈 4→8) · yunyou 归档 39 窗重放选型] 旧 perCap×2.5(满分阈≈4)重放 39/39 窗钉 10.0(σ=0.000),
  // 而事件折叠重建的真实 perCap 在 4.9-25 间大幅波动(重放法: StageCommitted.deltas 的 bond 绝对值 set 逐窗折叠,
  // 终态对 world_state ground truth 校验 present 15/15·perCap 误差 4.9%)。两候选对比(/tmp/replay-warm.ts):
  //   线性 cap@8(×1.25):  σ=0.879 封顶82%, 但 perCap=4(旧"人均~4 够暖"满分校准锚)→5.00 = 把已校准好世界打成中分 ✗
  //   log1p 压缩 cap@8:   σ=0.416 封顶82%, 且 perCap=4→7.32 仍处高分段 ✓ → 选对数压缩(σ>0.3 真梯度 + 不破已校准语义)
  return +Math.max(0, Math.min(10, (Math.log1p(perCap) / Math.log1p(8)) * 10)).toFixed(2);
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

// [P0-8] progress 冻结态标注(只标不改分·不动 server): 两类可检测情形 →
//   ① 信号源缺失: 无账本/账本从未写过(= progressMomentum 走中性 5 分支) → true;
//   ② 冻结可检测: 本窗 progress 与 history 最近 3 窗完全相同(账本 ≥3 窗未动; 实证: yunyou 39 窗恒 6.5、huolang 21 窗恒 6.5,
//      根因=progression-ledger lastBeatCh==lastAdvanceCh 后不再更新) → true。
//   确定性: 输入仅 progression-ledger.json + warm-fitness-history.json 文件态, 零随机; 检测不了的冻结(如不足 3 窗)留 false, 字段供后续消费者(曲线标注/进化去权)自取。
function progressFrozenFlag(dir: string, current: number): boolean {
  const pl = loadPL(dir);
  if (!pl || (pl.reachedMilestones.length === 0 && pl.writtenBeats.length === 0 && pl.lastAdvanceCh === 0)) return true; // ① 源数据缺失
  try {
    const h = existsSync(WH_FILE(dir)) ? (JSON.parse(readFileSync(WH_FILE(dir), "utf8")) as WarmHistory) : null;
    const tail = (h?.history ?? []).slice(-3);
    return tail.length === 3 && tail.every((r) => r.progress === current); // ② 连续 3 窗+本窗同值=冻结
  } catch { return false; }
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

// [2026-06-08 去饱和·L8] 反跑步机信号: 升级跑步机(晋阶+归隐+突破裁决)占近窗事件比越高→世界越被爬塔机械霸屏、无天花板的关系/冲突/格局戏被挤成噪声→分越低。修 warm-fitness 对饱和"色盲"(原 progress 正权曾奖励更多爬坡, 自进化把世界推回跑步机)。F/R 分离: 只打分、不进生成提示。蓝图 .audit/20260608-desaturation/。
function antiTreadmill(events: WorldEventRecord[]): number {
  const NARR = ["ChapterInscribed", "StoryEventTriggered", "CharacterEntered", "CharacterFell", "CharacterTranscended", "FactionDissolved", "FactionSplit", "StageCommitted", "ProgressionAdvanced", "VengeanceResolved", "DecisionRequired", "AuthorRuled"]; // 有解说事件(=用户世事流转区实际看到的)
  const TREAD = ["ProgressionAdvanced", "CharacterTranscended", "AuthorRuled", "DecisionRequired"]; // 升级跑步机机械事件
  const narr = events.slice(-400).filter((e) => NARR.includes(e.kind)); // 排除 MemoryRecorded/obs 等噪声把分母撑虚→信号失灵; 实证: raw 分母跑步机仅占7-14%(色盲), 有解说分母占~35%(有效)
  if (narr.length < 24) return 6; // 样本不足→中性偏高, 不误判新世界
  const tread = narr.filter((e) => TREAD.includes(e.kind)).length;
  const ratio = tread / narr.length; // 跑步机占世事流转比(当前饱和世界实测 ~0.35, 去饱和后应降→分升)
  return +Math.max(0, Math.min(10, 10 * (1 - ratio / 0.6))).toFixed(2); // ratio≤0→满分, ≥0.6 跑步机霸屏→0
}

// ⑧ W_clean(0..10·观察版·不入 total): edit-pass lint(draft·修订前)的"制造量"反向信号——microPerK/settleRatio/pauseBeats/similePerK 四维线性映射均值。
//   [Q5·协同审计] 断"genome 替编辑领功"归因链第一步: critique 读的是删后文本→基因学不会少制造; 此信号读修订前草稿账(edit-ledger.lints), 先观察一两卷与 total 相关性, 再议转正入权(W5②)。
function cleanSignal(dir: string): number {
  try {
    const l = JSON.parse(readFileSync(join(dir, "edit-ledger.json"), "utf8")) as { lints?: Array<{ similePerK: number; microPerK: number; settleRatio: number; pauseBeats: number }> };
    const xs = (l.lints ?? []).slice(-12); if (!xs.length) return 5; // 无账→中性
    const lin = (v: number, good: number, bad: number): number => Math.max(0, Math.min(10, 10 * (bad - v) / (bad - good))); // good→10, bad→0
    const per = xs.map((x) => (lin(x.microPerK, 1.7, 3.0) + lin(x.settleRatio, 0.05, 0.12) + lin(x.pauseBeats, 3, 6) + lin(x.similePerK, 4, 6)) / 4); // 阈值=AI-tells 校准基线(好章/病例)
    return +(per.reduce((s, v) => s + v, 0) / per.length).toFixed(2);
  } catch { return 5; }
}

export function computeWarmFit(events: WorldEventRecord[], snapshot: WorldSnapshot, recentCh: Array<{ goal: string; text: string }>, dir: string): WarmFitness {
  const wVar = sceneDiversity(recentCh, nameGrams(Object.values(snapshot.characters).map((c) => c.name)));
  const wBond = bondWarmth(snapshot);
  const wSocial = socialWarmth(events);
  const wArc = arcWarmth(events);
  const wProg = progressMomentum(dir); // [T3] 读账本, 纯进度
  const wEmerge = emergeDiversity(events); // [T2'] 读事件层涌现多样性, 接进化
  const wBreath = breathRhythm(recentCh); // [M3·降密度] 段内留白节奏(短句呼吸+疏密起伏); 低=读着累
  // [2026-06-08 归零 W_breath] 章后精修 pass(longrun.reviseChapter)已确定性治密度(删比喻过密/情绪过释/意象复读) → 对话-only 的 breath 信号既冗余、又被 premise 混淆(shanju 对话天生少≠写得差), 撤出适应度选择免噪声; var 权重还原 0.17→0.25(密度压力改由 pass 兜底, 不再靠降 var 权重缓解)。breath 仍计算并入史供观察、但不入 total/不参与选择。
  const wTread = antiTreadmill(events); // [L8 去饱和] 升级跑步机霸屏→扣分, 修进化对饱和色盲
  const wClean = cleanSignal(dir); // [Q5] 观察版默认不入 total; [P1-2] env NOVEL_WCLEAN=1 转正入权(见下)
  // [P1-2 W_clean 转正·gated 默认关] env NOVEL_WCLEAN="1" 才入权; 关=现状(爽文不走 warm-fitness——GENTLE-only 调用, 公式默认亦=现状)。
  //   关(现状): total = 0.20*var + 0.25*bond + 0.20*social + 0.15*arc + 0.10*progress + 0.10*treadmill          (Σ=1.00)
  //   开:       total = 0.20*var + 0.25*bond + 0.16*social + 0.11*arc + 0.10*progress + 0.10*treadmill + 0.08*clean (Σ=1.00)
  //   即 clean +0.08, 从 social/arc 各匀 0.04(权重和不变); 两态差 = 0.08*clean − 0.04*social − 0.04*arc。
  //   ⚠转正前置核查(蓝图宪法③·开 env 前人工确认): corr(clean, llmFit) 须 ≥2 个窗方向一致——现 n=10 r=+0.65 已半足,
  //   补一窗同向后再人工置 NOVEL_WCLEAN=1; 代码只就位、不自动开。(历史注: 旧行 var0.25→0.20 + emerge0.05→0 匀给 W_treadmill; emerge/breath 仍入史不入 total)
  const total = process.env.NOVEL_WCLEAN === "1"
    ? +(0.20 * wVar + 0.25 * wBond + 0.16 * wSocial + 0.11 * wArc + 0.10 * wProg + 0.10 * wTread + 0.08 * wClean).toFixed(2)
    : +(0.20 * wVar + 0.25 * wBond + 0.20 * wSocial + 0.15 * wArc + 0.10 * wProg + 0.10 * wTread).toFixed(2);
  const frozen = progressFrozenFlag(dir, wProg); // [P0-8] 冻结标注(只标不改分; 仅 true 才落字段, 健康世界 json 形状不变)
  return { total, var: wVar, bond: wBond, social: wSocial, arc: wArc, progress: wProg, emerge: wEmerge, breath: wBreath, treadmill: wTread, clean: wClean, atCh: snapshot.tick ?? 0, fv: WARM_FV, ...(frozen ? { progressFrozen: true } : {}) };
}
