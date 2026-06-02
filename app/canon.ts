// app/canon.ts — 长篇一致性追踪器(借 LifeBook digest 式"结构抽取 + 一致性闸门"的理念)。
//   每隔若干章: ① 从近章抽取/更新结构化「设定档 canon」(人物属性 / 世界事实) ② 校验近章与 canon 有无自相矛盾。
//   产出: 注入生成(保持一致 + 修正矛盾) + 一致性分(作"可验证子目标"计入进化适应度)。core/ 不涉, 叶子模块。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../core/services/llm";

export interface Canon {
  characters: Record<string, string[]>; // 人名 → 关键属性短语(灵根/境界/身份/状态/重要关系)
  world: string[];                        // 已确立的世界事实
  updatedCh: number;
  lastConsistency?: number;               // 最近一致性分 0..10(可验证子目标①)
  lastForeshadow?: number;                // 最近伏笔回收率 0..10(可验证子目标②, 由 longrun 据伏笔账本写入)
  lastContradictions?: string[];          // 最近发现的前后矛盾(喂下一卷修正)
}

const F = (d: string): string => join(d, "canon.json");
const empty = (): Canon => ({ characters: {}, world: [], updatedCh: 0 });
export function loadCanon(d: string): Canon { try { return existsSync(F(d)) ? { ...empty(), ...JSON.parse(readFileSync(F(d), "utf8")) } : empty(); } catch { return empty(); } }
export function saveCanon(d: string, c: Canon): void { writeFileSync(F(d), JSON.stringify(c, null, 2), "utf8"); }

// 注入生成提示的「已确立设定 + 须修正矛盾」块
export function canonBlock(c: Canon): string {
  const chars = Object.entries(c.characters).slice(0, 12).map(([n, fs]) => `${n}：${fs.slice(0, 4).join("、")}`);
  const parts: string[] = [];
  if (chars.length || c.world.length) parts.push(`【世界已确立设定·须保持一致(不可与之矛盾)】\n${chars.join("；")}${c.world.length ? "\n世界事实：" + c.world.slice(0, 8).join("；") : ""}`);
  if (c.lastContradictions?.length) parts.push(`【须修正的前后矛盾(本卷消除)】${c.lastContradictions.slice(0, 4).join("；")}`);
  return parts.join("\n");
}

// 一步: 更新 canon(抽取并入新事实) + 校验近章矛盾。落盘(含 lastConsistency / lastContradictions)。
export async function canonStep(llm: LLMProvider, sys: string, d: string, chapters: Array<{ goal: string; text: string }>, atCh: number): Promise<{ canon: Canon; contradictions: string[]; score: number }> {
  const c = loadCanon(d);
  const sample = chapters.map((x) => `《${x.goal}》${x.text.slice(0, 900)}`).join("\n\n");
  // ① 抽取/更新设定档
  try {
    const raw = await llm.complete(
      `${sys}\n下面是小说最近几章。已知设定档(JSON)：${JSON.stringify({ characters: c.characters, world: c.world }).slice(0, 1600)}\n据新章【更新设定档】：补充新出现的人物及其关键属性(灵根/境界/身份/状态/重要关系)、新确立的世界事实；合并已有，勿丢弃旧的。只回 JSON：{"characters":{"人名":["属性短语"]},"world":["世界事实短语"]}\n\n${sample}`,
      { thinking: false, temperature: 0.2 },
    );
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { characters?: Record<string, string[]>; world?: string[] };
    if (j.characters) for (const [n, fs] of Object.entries(j.characters)) { const ex = c.characters[n] ?? []; c.characters[n] = [...new Set([...ex, ...(Array.isArray(fs) ? fs.filter((x) => typeof x === "string") : [])])].slice(0, 8); }
    if (Array.isArray(j.world)) c.world = [...new Set([...c.world, ...j.world.filter((x) => typeof x === "string")])].slice(0, 30);
  } catch { /* ignore */ }
  // ② 校验矛盾(可验证子目标)
  let contradictions: string[] = []; let score = 10;
  try {
    const raw = await llm.complete(
      `${sys}\n设定档(JSON)：${JSON.stringify({ characters: c.characters, world: c.world }).slice(0, 1600)}\n核对下面最近几章有无与设定档【自相矛盾】(人物属性/境界/身份/时间线/世界规则前后冲突)。严格、只挑真冲突。只回 JSON：{"contradictions":["具体矛盾一句话"],"score":0到10的一致性分(10=毫无矛盾)}\n\n${sample}`,
      { thinking: false, temperature: 0.2 },
    );
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { contradictions?: string[]; score?: number };
    contradictions = Array.isArray(j.contradictions) ? j.contradictions.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 6) : [];
    score = typeof j.score === "number" && j.score >= 0 && j.score <= 10 ? j.score : Math.max(0, 10 - contradictions.length * 2);
  } catch { /* ignore */ }
  c.updatedCh = atCh; c.lastConsistency = score; c.lastContradictions = contradictions;
  saveCanon(d, c);
  return { canon: c, contradictions, score };
}
