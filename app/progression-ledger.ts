// app/progression-ledger.ts — 温情「进展账本 + 防拍子循环」(T2): 给温情世界的「推进」做机读度量回路。
//   gentle-director.ts(T2 空间维·场景轮换)的时间/处境维对位: 记主角处境 ground truth + 已写拍子签名,
//   仅在 weave 空窗章兜底产一句温润推进任务; 拍子签名比对历史→命中重复则改写为「升级新发展」;
//   每 8 章搭 canonStep 同班 LLM 判里程碑达成、写回处境(真 ground truth, 非自评)。
// 铁律(镜像 gentle-director.ts): 只在 GENTLE; 绝不写 conflictRate/tuning/crisis/drama, 结构上不引冲突,
//   推进靠「多识一人/多走一程/道行长进/近一桩牵念」非事件冲突; core/packs 不涉。
//   选择全基于 pl.turn 计数器(禁 Math.random/Date.now) → resume 完全复现。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../core/services/llm";
import type { OutlinePlan } from "./outline-plan";
import { jaccard } from "./sim-fitness";          // 复用现成 Jaccard(与 gentle-director/warm-fitness 同源, 不重写)

export interface Milestone { id: string; goal: string; reached: boolean; atCh?: number }
export interface WrittenBeat { sig: string[]; ch: number }   // sig = 处境/动作/关系 2-gram 指纹(防循环本体)
export interface ProgressLedger {
  situation: { place: string; role: string; nearPerson: string }; // 主角当前处境(机读 ground truth)
  reachedMilestones: string[];      // 已达里程碑 id(对账 outline-plan 阶段)
  writtenBeats: WrittenBeat[];      // 滚动历史拍子签名(取近 ~12 章)
  lastAdvanceCh: number;            // 上次处境真挪移的章号(产任务的间隔依据)
  turn: number;                     // 自增计数器(替代 random/Date.now, resume 确定性)
}

const F = (d: string): string => join(d, "progression-ledger.json");
const EMPTY = (): ProgressLedger => ({ situation: { place: "", role: "", nearPerson: "" }, reachedMilestones: [], writtenBeats: [], lastAdvanceCh: 0, turn: 0 });

export function loadPL(d: string): ProgressLedger {
  try { return existsSync(F(d)) ? { ...EMPTY(), ...JSON.parse(readFileSync(F(d), "utf8")) } : EMPTY(); }
  catch { return EMPTY(); }
}
export function savePL(d: string, p: ProgressLedger): void {
  try { writeFileSync(F(d), JSON.stringify(p, null, 2), "utf8"); } catch { /* 非关键 */ }
}

// 虚词/语法碎片停用集(对齐 gentle-director.isContentGram, 但这里聚焦动作/处境词、不取静物): 滤掉功能字 → 2-gram 聚焦「主角做了什么/走到哪/与谁」, 不被高频语法字稀释。
const FUNC_CHARS = "的了着过吗呢吧啊呀么哦嗯之其所为以于而且但却则因如此些个种样一半两三他她它你我们谁每各这那是不也都还又把被将与和跟同向往从来去到在有没要会能可得地很就只便已再让对";
const isContentGram = (g: string): boolean => !FUNC_CHARS.includes(g[0]!) && !FUNC_CHARS.includes(g[1]!);

// 拍子签名: 从本章标题+末拍(hook)取处境/动作 2-gram。freq≥1 取前 8(防循环用: 比对近窗 Jaccard)。
export function beatSig(title: string, hook: string): string[] {
  const text = `${title ?? ""}　${hook ?? ""}`.replace(/\s+/g, "");
  const freq: Record<string, number> = {};
  for (let i = 0; i + 2 <= text.length; i++) {
    const g = text.slice(i, i + 2);
    if (/^[一-龥]{2}$/.test(g) && isContentGram(g)) freq[g] = (freq[g] ?? 0) + 1;
  }
  return Object.entries(freq).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
}

// 核心: weave 空窗时产一句温润推进任务 + 防循环改写。
// 入参: ledger, 本章 n, 当前阶段 goal(来自 outline-plan), 上一阶段落点(给「已从…起步」承接语)。
export function nextProgressTask(pl: ProgressLedger, n: number, stageGoal: string, prevStageGoal: string): string {
  const gap = n - pl.lastAdvanceCh;
  // 间隔太短(刚推过, gap < 8) → 不施压, 让日常呼吸[吸收批评四/七: 锚阶段容呼吸]。
  if (gap < 8) return "";
  // 防循环·stale 真判定: 候选拍子签名(由近章 writtenBeats 末项推) 与近 12 章历史签名并集的 Jaccard > 0.5 → 处境原地打转。
  const recent = pl.writtenBeats.slice(-12);
  const candidate = new Set(recent.length ? recent[recent.length - 1]!.sig : []);
  const history = new Set(recent.flatMap((b) => b.sig));
  const stale = candidate.size > 0 && jaccard(candidate, history) > 0.5;
  const fromTo = prevStageGoal ? `已从「${prevStageGoal}」起步，` : "";
  return stale
    ? `${fromTo}近来情形与前几章太相似了——本章宜有一处**新的**人生进展(识一个从未出现的人、走一段没去过的路、把那桩牵念再推近一步)，朝「${stageGoal}」缓缓挪动；仍温润、不靠冲突。`
    : `${fromTo}本章宜让主角处境朝「${stageGoal}」缓缓挪一小步(多识一人/多走一程/心境长进一分/近一桩牵念)；温润收束、不靠冲突。`;
}

// 每 8 章: 搭 canonStep 同班 LLM 读近 8 章判里程碑达成、写回处境(真 ground truth)[吸收批评五]。
export async function advanceStep(
  pl: ProgressLedger, recentChapters: Array<{ goal: string; text: string }>,
  arcMilestones: Array<{ id: string; goal: string }>, n: number, llm: LLMProvider,
): Promise<ProgressLedger> {
  const out: ProgressLedger = { ...pl, situation: { ...pl.situation }, reachedMilestones: [...pl.reachedMilestones], writtenBeats: pl.writtenBeats };
  try {
    const raw = await llm.complete(
      `读下面近 8 章, 只回 JSON。判断主角当前【处境】, 以及下列人生里程碑里【哪些已真正达成】(看正文事实, 不看是否提过):\n` +
      `里程碑:${JSON.stringify(arcMilestones.map((m) => ({ id: m.id, goal: m.goal })))}\n` +
      `{"place":"现在身处/身份一句","role":"被旁人当作什么","nearPerson":"最近正与谁来往","reached":["已达成里程碑id"]}\n\n` +
      recentChapters.map((c, i) => `【${i + 1}】${c.goal}\n${(c.text ?? "").slice(0, 600)}`).join("\n\n"),
      { thinking: false, temperature: 0.2 });
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { place?: unknown; role?: unknown; nearPerson?: unknown; reached?: unknown };
    // 写回处境(仅当非空, 不抹掉旧值)
    if (typeof j.place === "string" && j.place.trim()) out.situation.place = j.place.slice(0, 60);
    if (typeof j.role === "string" && j.role.trim()) out.situation.role = j.role.slice(0, 60);
    if (typeof j.nearPerson === "string" && j.nearPerson.trim()) out.situation.nearPerson = j.nearPerson.slice(0, 60);
    // 新达成的里程碑进账(去重, 仅采纳 arcMilestones 里真实存在的 id)
    const validIds = new Set(arcMilestones.map((m) => m.id));
    const reached = Array.isArray(j.reached) ? j.reached.filter((x): x is string => typeof x === "string" && validIds.has(x)) : [];
    let gotNew = false;
    for (const id of reached) if (!out.reachedMilestones.includes(id)) { out.reachedMilestones.push(id); gotNew = true; }
    if (gotNew) out.lastAdvanceCh = n;  // 有新里程碑达成 → 处境真挪移过, 刷新间隔基准
  } catch { /* LLM/解析失败 → 处境保持原样, 不阻断写章 */ }
  out.turn++;                            // 计数器自增(禁 random/Date.now, resume 确定性)
  return out;
}

// 从 outline-plan 的 beats 派生里程碑(id=`m${i}`, goal=beat.goal)。供 advanceStep 判达成、W_progress 算进度。
export function arcMilestonesFromPlan(plan: OutlinePlan | null): Array<{ id: string; goal: string }> {
  if (!plan || !plan.beats.length) return [];
  return plan.beats.map((b, i) => ({ id: `m${i}`, goal: b.goal }));
}
