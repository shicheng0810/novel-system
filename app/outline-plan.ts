// app/outline-plan.ts — 「严格跟纲」模式: 把成品大纲解析成「章节区间 → 情节节拍」的有序主线计划, 写者每章据此 steer。
//   松散底座(loose)模式不生成本文件; 仅 follow 模式在建世界时生成 outline-plan.json, longrun 读到则逐章跟纲。
//   注: 世界模拟仍在底下跑(角色心智/状态/质感), 跟纲只 steer 每章「情节方向」; 若模拟与大纲硬冲突(如大纲要的人已陨落),
//   以 prose 调和为主、不强制模拟服从大纲(那是更大的工程)。app/ 叶子模块, core/ 不涉。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../core/services/llm";

export interface OutlineBeat { vol: number; from: number; to: number; goal: string }
// obedience(服从度): "balanced"=均衡(软建议、世界可偏离) / "strict"=照写(硬遵循、不可跑偏); 缺省按 strict(向后兼容旧 follow 计划)。"emergent"(涌现)不生成本文件。
export interface OutlinePlan { beats: OutlineBeat[]; source: string; generation: number; obedience?: "balanced" | "strict" }

const PLAN_FILE = (d: string): string => join(d, "outline-plan.json");

export function loadOutlinePlan(d: string): OutlinePlan | null {
  try { return existsSync(PLAN_FILE(d)) ? (JSON.parse(readFileSync(PLAN_FILE(d), "utf8")) as OutlinePlan) : null; }
  catch { return null; }
}
export function saveOutlinePlan(d: string, p: OutlinePlan): void {
  try { writeFileSync(PLAN_FILE(d), JSON.stringify(p, null, 2), "utf8"); } catch { /* 非关键 */ }
}

// 找覆盖第 n 章的节拍 goal(超出计划末尾 → 返回最后一段, 让结尾不至于突然失纲; 完全无计划 → 空)
export function beatForChapter(plan: OutlinePlan | null, n: number): string {
  if (!plan || !plan.beats.length) return "";
  for (const b of plan.beats) if (n >= b.from && n <= b.to) return b.goal;
  const last = plan.beats[plan.beats.length - 1];
  return last && n > last.to ? last.goal : "";
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
