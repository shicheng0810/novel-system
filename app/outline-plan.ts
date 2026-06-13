// app/outline-plan.ts — 「严格跟纲」模式: 把成品大纲解析成「章节区间 → 情节节拍」的有序主线计划, 写者每章据此 steer。
//   松散底座(loose)模式不生成本文件; 仅 follow 模式在建世界时生成 outline-plan.json, longrun 读到则逐章跟纲。
//   注: 世界模拟仍在底下跑(角色心智/状态/质感), 跟纲只 steer 每章「情节方向」; 若模拟与大纲硬冲突(如大纲要的人已陨落),
//   以 prose 调和为主、不强制模拟服从大纲(那是更大的工程)。app/ 叶子模块, core/ 不涉。
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../core/services/llm";

// steer(转向力度): "hard"=硬转向(节拍必须服务推进、不可跑偏, 旧 strict 跟纲行为) / "soft"=软方向(世界可自然偏离、不抢 T2 场景轮换)。缺省视为 hard(向后兼容旧 strict 计划; 仅 generateGentleArcPlan 显式标 soft)。
export interface OutlineBeat { vol: number; from: number; to: number; goal: string; steer?: "soft" | "hard" }
// obedience(服从度): "balanced"=均衡(软建议、世界可偏离) / "strict"=照写(硬遵循、不可跑偏); 缺省按 strict(向后兼容旧 follow 计划)。"emergent"(涌现)不生成本文件。
export interface OutlinePlan { beats: OutlineBeat[]; source: string; generation: number; obedience?: "balanced" | "strict" }

const PLAN_FILE = (d: string): string => join(d, "outline-plan.json");

export function loadOutlinePlan(d: string): OutlinePlan | null {
  try { return existsSync(PLAN_FILE(d)) ? (JSON.parse(readFileSync(PLAN_FILE(d), "utf8")) as OutlinePlan) : null; }
  catch { return null; }
}
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→load 静默回空(蓝图 .audit/20260610-evolution-overhaul §3.2)
export function saveOutlinePlan(d: string, p: OutlinePlan): void {
  try { atomicWrite(PLAN_FILE(d), JSON.stringify(p, null, 2)); } catch { /* 非关键 */ }
}

// 找覆盖第 n 章的节拍 goal(超出计划末尾 → 返回最后一段, 让结尾不至于突然失纲; 完全无计划 → 空)
export function beatForChapter(plan: OutlinePlan | null, n: number): string {
  if (!plan || !plan.beats.length) return "";
  for (const b of plan.beats) if (n >= b.from && n <= b.to) return b.goal;
  const last = plan.beats[plan.beats.length - 1];
  return last && n > last.to ? last.goal : "";
}

// 同 beatForChapter 区间查表, 但返回 beat 对象(供读 steer 判 soft/hard); 不改 beatForChapter 以免破现有调用。
export function beatObjForChapter(plan: OutlinePlan | null, n: number): OutlineBeat | null {
  if (!plan || !plan.beats.length) return null;
  for (const b of plan.beats) if (n >= b.from && n <= b.to) return b;
  const last = plan.beats[plan.beats.length - 1];
  return last && n > last.to ? last : null;
}

// 解析大纲 → 有序节拍主线(LLM)。大纲常含「第1-12章」式章号 → 直接采用; 没标则按篇幅分配。
export async function generateOutlinePlan(outline: string, llm: LLMProvider, targetCh = 1000): Promise<OutlinePlan> {
  const ol = outline.trim().slice(0, 32000);
  const cap = Math.min(targetCh, 400);
  const raw = await llm.complete(
    `你是"长篇连载节拍规划师"。下面是作者的成品大纲(可能含多卷、章节范围、情节走向、伏笔铺设时机)。把它解析成一条**有序的逐段情节主线**, 供小说引擎逐章跟写。\n要求:\n· 按大纲原有的卷/阶段/章节范围切成若干"节拍段", 每段覆盖一个连续章节区间(from~to);\n· 每段给一句"本段须推进到的情节"(≤40字, 含关键事件/转折/该铺的伏笔);\n· 大纲若标了章号(如"第1-12章")就照用; 没标则按篇幅合理分配, 覆盖到约第 ${cap} 章;\n· 段与段因果相承、顺大纲走, 不打乱顺序、不跳卷。\n只回 JSON, 不要解释、不要代码块标记:\n{"beats":[{"vol":卷号数字,"from":起始章数字,"to":结束章数字,"goal":"本段情节一句"}]}\n\n【成品大纲】\n${ol}`,
    { thinking: false, temperature: 0.3 },
  );
  let beats: OutlineBeat[] = [];
  try {
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { beats?: Array<Record<string, unknown>> };
    beats = (j.beats ?? [])
      .map((b) => ({ vol: Number(b["vol"]) || 1, from: Math.floor(Number(b["from"])) || 0, to: Math.floor(Number(b["to"])) || 0, goal: typeof b["goal"] === "string" ? (b["goal"] as string).slice(0, 60) : "" }))
      .filter((b) => b.goal && b.from > 0 && b.to >= b.from)
      .sort((a, b) => a.from - b.from);
  } catch { /* 解析失败 → 空计划(退化为松散涌现) */ }
  return { beats, source: ol.slice(0, 200), generation: 1 };
}

// 温情世界专用: 从 premise + 人生意图弧派生「人生阶段」软脊梁(obedience 恒 balanced, steer 恒 soft)。
// 与 generateOutlinePlan 区别: 输入 premise+arcSeed(非成品大纲); goal=人生境地(非情节事件); 措辞强制温润零冲突;
// 落点须命中 WARM_DONE 词(团聚/和解/抵达/释怀/了却/相托/安顿…)以接 arc 度量闭环[吸收批评五]。
export async function generateGentleArcPlan(
  premise: string, arcSeed: string, llm: LLMProvider, targetCh = 1000,
): Promise<OutlinePlan> {
  const raw = await llm.complete(
    `你是"温情长篇的人生阶段规划师"。下面是一部温情/启发向小说的设定与主角的人生意图弧。\n` +
    `把这条人生弧拆成 5~7 个**缓慢推进的人生阶段**, 供引擎逐章作【软方向】(世界可自然偏离)。要求:\n` +
    `· 每段覆盖一个连续章节区间(from~to), 段间跨度≥120章、覆盖到约第 ${Math.min(targetCh, 1000)} 章, 让日常充分呼吸;\n` +
    `· 每段一句"本阶段主角该走到的人生境地"(≤40字): 写【处境/身份/心境的挪移】, 并尽量落在「了却/相托/安顿/抵达/释怀/接纳/被托付」这类**安稳完成感**的词上(如"从旁观者被乡邻接纳为可托付的人");\n` +
    `· 【铁律】绝不写冲突/争斗/生死/反派/夺宝/危机——推进靠"多识一人/多走一程/道行长进/被人当作不凡/了却一桩牵念", 不靠事件冲突;\n` +
    `· 至少 1~2 段须写【与第二主角的关系该走到哪】(防第二主角原地)[吸收批评五];\n· 段间顺人生弧缓缓递进, 不跳。\n` +
    `只回 JSON:\n{"beats":[{"vol":卷号,"from":起章,"to":止章,"goal":"本阶段人生境地一句"}]}\n\n` +
    `【设定 premise】${premise}\n【人生意图弧】${arcSeed}`,
    { thinking: false, temperature: 0.4 },
  );
  let beats: OutlineBeat[] = [];
  try {
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { beats?: Array<Record<string, unknown>> };
    beats = (j.beats ?? [])
      .map((b) => ({ vol: Number(b["vol"]) || 1, from: Math.floor(Number(b["from"])) || 0,
                     to: Math.floor(Number(b["to"])) || 0,
                     goal: typeof b["goal"] === "string" ? (b["goal"] as string).slice(0, 60) : "",
                     steer: "soft" as const }))            // ← 恒 soft: 不抢 T2[吸收批评二]
      .filter((b) => b.goal && b.from > 0 && b.to >= b.from)
      .sort((a, b) => a.from - b.from);
  } catch { /* 退化涌现, 不阻断 */ }
  return { beats, source: arcSeed.slice(0, 200), generation: 1, obedience: "balanced" }; // ← 恒 balanced
}

// arcSeed 唯一来源: 从 premise 兜底推一句人生意图弧(删 cfg.lifeArc 依赖, 它不存在)[吸收批评三]。
export async function deriveArcFromPremise(premise: string, llm: LLMProvider): Promise<string> {
  const raw = await llm.complete(
    `下面是一部温情小说的设定。用一句话(≤60字)概括主角贯穿全书的【人生意图弧】——他的处境/身份会缓缓走向哪里(写境地挪移, 不写冲突):\n${premise}`,
    { thinking: false, temperature: 0.3 });
  return raw.trim().slice(0, 120);
}
