// app/lore-lib.ts — T3 触发式设定库(借 AI Dungeon Story Cards / NovelAI Lorebook)。
//   门派/功法/灵根/地点/法宝/概念 做成条目, 正文提到关键词才召回注入写作 prompt, 而非全量前置(省 token、防过载、保一致)。
//   中文用子串匹配(includes, 无需分词); alwaysOn 条目无条件常驻。lore.json 落各世界目录。app/ 叶子模块, core/ 不涉。
//   v1 用关键词召回; 中文别名靠 keys 多写; 语义召回(embedding)留作后续(minds 已有 embedding 基建可借)。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface LoreEntry { name: string; keys: string[]; text: string; alwaysOn?: boolean }
export interface LoreLib { entries: LoreEntry[] }
const F = (d: string): string => join(d, "lore.json");

export function loadLore(d: string): LoreLib | null {
  try { return existsSync(F(d)) ? (JSON.parse(readFileSync(F(d), "utf8")) as LoreLib) : null; } catch { return null; }
}
export function saveLore(d: string, l: LoreLib): void { try { writeFileSync(F(d), JSON.stringify(l, null, 2), "utf8"); } catch { /* 非关键 */ } }

// 规范化任意输入(LLM 产出的 cfg.lore 或用户填)为 LoreLib。
export function normalizeLore(raw: unknown): LoreLib {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { entries?: unknown[] })?.entries) ? (raw as { entries: unknown[] }).entries : [];
  const entries: LoreEntry[] = [];
  for (const e of arr) {
    const o = e as Record<string, unknown>;
    const name = typeof o["name"] === "string" ? (o["name"] as string).slice(0, 24) : "";
    const text = typeof o["text"] === "string" ? (o["text"] as string).trim().slice(0, 200) : "";
    if (!text) continue;
    let keys = Array.isArray(o["keys"]) ? (o["keys"] as unknown[]).filter((k): k is string => typeof k === "string" && !!k.trim()).map((k) => k.trim().slice(0, 16)) : [];
    if (name && !keys.includes(name)) keys = [name, ...keys];
    keys = [...new Set(keys)].slice(0, 8);
    if (!keys.length) continue;
    entries.push({ name: name || keys[0]!, keys, text, alwaysOn: o["alwaysOn"] === true });
  }
  return { entries: entries.slice(0, 40) };
}

// 召回: 关键词(中文子串)命中 context 的条目 + alwaysOn, 取至多 max 条, 返回注入块(空则 "")。
export function recallLore(lib: LoreLib | null, context: string, max = 4): string {
  if (!lib || !lib.entries.length) return "";
  const ctx = context || "";
  const hit = lib.entries.filter((e) => e.alwaysOn || e.keys.some((k) => k && ctx.includes(k)));
  hit.sort((a, b) => (b.alwaysOn ? 1 : 0) - (a.alwaysOn ? 1 : 0)); // alwaysOn 优先占位
  const picked = hit.slice(0, max);
  if (!picked.length) return "";
  return `【世界设定·本章相关(须与之一致、可化入正文)】\n${picked.map((e) => `· ${e.name}：${e.text}`).join("\n")}`;
}
