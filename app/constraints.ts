// app/constraints.ts — 双层进化的「规则层」。质变 = 改变"概念空间"(Boden transformational / Wiggins meta 层搜索),
//   而非空间内调参。每个世界有一组显式「铁律」(enabling constraints)定义其叙事可能性空间;
//   进化算子定期【提议】改写一条铁律 → 经【议事】由作者人工裁决(破自动评委天花板)→ 批准则改变空间。
// core/ 不涉, 纯 app 层。
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../core/services/llm";

export interface ConstraintMutation { kind: "rewrite" | "add" | "remove"; targetIndex?: number; target?: string; after?: string; rationale: string; atVol: number }
export interface Constraints {
  active: string[];           // 当前世界铁律(定义概念空间)
  generation: number;         // 规则层进化代数
  pending?: ConstraintMutation; // 待议事裁决的铁律变异
  history: Array<{ mut: ConstraintMutation; verdict: "approve" | "reject"; atVol: number }>;
  lastChangeCh: number;       // 上次铁律变更的章号(控提议节奏)
}

const C_FILE = (d: string): string => join(d, "constraints.json");
// 通用 craft 铁律作种子(genre 中立, 给世界留出"变革"的余地)
const DEFAULT_CONSTRAINTS: string[] = [
  "重大转折必须有代价：不可无损失地化解危机或凭空获得力量。",
  "关键信息通过人物的行动与冲突揭示，不靠叙述者直接交代设定。",
  "每条埋下的伏笔或悬念，须在其后合理章数内兑现或反转，不可遗忘。",
];

export function loadConstraints(d: string): Constraints {
  try {
    if (!existsSync(C_FILE(d))) return { active: [...DEFAULT_CONSTRAINTS], generation: 0, history: [], lastChangeCh: 0 };
    const c = JSON.parse(readFileSync(C_FILE(d), "utf8")) as Partial<Constraints>;
    return { active: Array.isArray(c.active) && c.active.length ? c.active : [...DEFAULT_CONSTRAINTS], generation: c.generation ?? 0, pending: c.pending, history: c.history ?? [], lastChangeCh: c.lastChangeCh ?? 0 };
  } catch { return { active: [...DEFAULT_CONSTRAINTS], generation: 0, history: [], lastChangeCh: 0 }; }
}
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→load 静默回空(蓝图 .audit/20260610-evolution-overhaul §3.2)
export function saveConstraints(d: string, c: Constraints): void { atomicWrite(C_FILE(d), JSON.stringify(c, null, 2)); }

// 注入生成提示的「世界铁律」块
export function constraintsBlock(active: string[]): string {
  if (!active.length) return "";
  return `【本世界铁律·须遵守(违背即出戏)】\n${active.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

// 进化算子: 让 LLM 提议一条【变革性】铁律变异(改概念空间,非微调),写入 pending 待议事。返回提议(或 null)。
export async function proposeConstraintMutation(llm: LLMProvider, sys: string, d: string, recent: string, vol: number): Promise<ConstraintMutation | null> {
  const c = loadConstraints(d);
  if (c.pending) return null; // 已有待裁的不重复提
  const raw = await llm.complete(
    `${sys}\n你在为这部长篇做一次"范式实验"。这个世界当前的【铁律】定义了它的叙事可能性空间：\n${c.active.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n近期梗概：${recent.slice(0, 600)}\n\n提议**改写/新增/删除其中一条铁律**，目标是打开这个世界目前到不了的新叙事 territory——要**变革性(改变规则)而非微调**，大胆但仍能自洽、不至于把世界写崩。只回 JSON：\n{"kind":"rewrite"|"add"|"remove", "targetIndex":要改/删那条铁律的序号(1-based 整数, rewrite/remove 必填), "after":"新铁律一句话(rewrite/add 必填)", "rationale":"这一改会打开什么旧空间里不可能的新可能(一句)"}`,
    { thinking: false, temperature: 0.9 },
  );
  let j: { kind?: string; targetIndex?: number; after?: string; rationale?: string };
  try { j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as typeof j; } catch { return null; }
  if (j.kind !== "rewrite" && j.kind !== "add" && j.kind !== "remove") return null;
  if ((j.kind === "rewrite" || j.kind === "add") && (!j.after || typeof j.after !== "string")) return null;
  const idx = typeof j.targetIndex === "number" ? Math.floor(j.targetIndex) : NaN;
  if ((j.kind === "rewrite" || j.kind === "remove") && !(idx >= 1 && idx <= c.active.length)) return null; // 按序号定位, 防文本匹配失败
  const mut: ConstraintMutation = { kind: j.kind, targetIndex: idx >= 1 ? idx : undefined, target: idx >= 1 && idx <= c.active.length ? c.active[idx - 1] : undefined, after: j.after, rationale: String(j.rationale ?? "").slice(0, 140), atVol: vol };
  c.pending = mut; saveConstraints(d, c);
  return mut;
}

// 议事裁决: approve 则改变 active(概念空间真改变), reject 则丢弃。记入 history。
export function applyConstraintVerdict(d: string, verdict: "approve" | "reject", atCh: number): Constraints {
  const c = loadConstraints(d);
  const mut = c.pending;
  if (!mut) return c;
  if (verdict === "approve") {
    const i = (mut.targetIndex ?? 0) - 1; // 按序号定位(稳健)
    if (mut.kind === "add" && mut.after) c.active.push(mut.after);
    else if (mut.kind === "remove" && i >= 0 && i < c.active.length) c.active.splice(i, 1);
    else if (mut.kind === "rewrite" && i >= 0 && i < c.active.length && mut.after) c.active[i] = mut.after;
    c.generation += 1; c.lastChangeCh = atCh;
  }
  c.history.push({ mut, verdict, atVol: mut.atVol });
  c.pending = undefined;
  saveConstraints(d, c);
  return c;
}
