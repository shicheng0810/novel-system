// app/canon.ts — 长篇一致性追踪器(借 LifeBook digest 式"结构抽取 + 一致性闸门"的理念)。
//   每隔若干章: ① 从近章抽取/更新结构化「设定档 canon」(人物属性 / 世界事实) ② 校验近章与 canon 有无自相矛盾。
//   产出: 注入生成(保持一致 + 修正矛盾) + 一致性分(作"可验证子目标"计入进化适应度)。core/ 不涉, 叶子模块。
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
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
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→load 静默回空(蓝图 .audit/20260610-evolution-overhaul §3.2)
export function saveCanon(d: string, c: Canon): void { atomicWrite(F(d), JSON.stringify(c, null, 2)); }

// 注入生成提示的「已确立设定 + 须修正矛盾」块
export function canonBlock(c: Canon): string {
  const chars = Object.entries(c.characters).slice(0, 12).map(([n, fs]) => `${n}：${fs.slice(0, 4).join("、")}`);
  const parts: string[] = [];
  if (chars.length || c.world.length) parts.push(`【世界已确立设定·须保持一致(不可与之矛盾)】\n${chars.join("；")}${c.world.length ? "\n世界事实：" + c.world.slice(0, 8).join("；") : ""}`);
  if (c.lastContradictions?.length) parts.push(`【须修正的前后矛盾(本卷消除)】${c.lastContradictions.slice(0, 4).join("；")}`);
  return parts.join("\n");
}

// 一步: 更新 canon(抽取并入新事实) + 校验近章矛盾。落盘(含 lastConsistency / lastContradictions)。
export async function canonStep(llm: LLMProvider, sys: string, d: string, chapters: Array<{ goal: string; text: string }>, atCh: number, hardFacts = ""): Promise<{ canon: Canon; contradictions: string[]; score: number }> {
  const c = loadCanon(d);
  // 样本取头尾(不再只看首 900 字漏掉大半正文): 头 1200 + 尾≤400。修取样死区: 1200~1600 字章按实际长度补尾(首尾相接、不插省略号、不重叠), >1600 才中段省略
  const sample = chapters.map((x) => {
    const t = x.text;
    if (t.length <= 1200) return `《${x.goal}》${t}`;
    const tail = Math.min(400, t.length - 1200); // 1200~1600 段 tail=len-1200(首尾恰好相接), >1600 段 tail=400(中段省略)
    return `《${x.goal}》${t.slice(0, 1200)}${t.length > 1600 ? "……" : ""}${t.slice(-tail)}`;
  }).join("\n\n");
  // ① 抽取/更新【软设定层】(境界/派系/生死由引擎权威派生, 此处不碰 → 消除抽取漂移)
  try {
    const raw = await llm.complete(
      `${sys}\n下面是小说最近几章。已知软设定档(JSON)：${JSON.stringify({ characters: c.characters, world: c.world }).slice(0, 1600)}\n据新章【更新软设定档】：补充人物的**软设定**——灵根来历/性情/隐秘身世/重要关系的由来/未明伏笔；以及新确立的世界事实。\n**切勿记录境界/派系/生死/在场状态**(这些由引擎权威确定, 你记了反而会过时矛盾)。合并已有、勿丢弃旧的。只回 JSON：{"characters":{"人名":["软设定短语"]},"world":["世界事实短语"]}\n\n${sample}`,
      { thinking: false, temperature: 0.2 },
    );
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { characters?: Record<string, string[]>; world?: string[] };
    // [D18防漂闸·2026-06-12雾江余债案] 新人名后两字与已册名相同(非称谓)=极可能名字漂移(宋青舟≈柳青舟已被册封实证)→拒收并记日志·不创建新条目
    const APPELL = new Set(["老三", "老四", "管事", "掌柜", "婶子", "师太", "夫人", "公子", "大娘", "大爷", "把头", "师傅", "郎中", "大夫", "先生", "姑娘"]);
    const givenOf = (n: string): string => (n.length === 3 ? n.slice(1) : "");
    if (j.characters) for (const [n, fs] of Object.entries(j.characters)) {
      if (!(n in c.characters)) {
        const g = givenOf(n);
        const twin = g && !APPELL.has(g) ? Object.keys(c.characters).find((m) => m !== n && givenOf(m) === g) : undefined;
        if (twin) console.log(`  📛 canon同名雷达: 新名「${n}」与已册「${twin}」后两字同(本世界sim名池撞名成灾·只报不拒——拒收会饿死合法角色·2026-06-12实证: 顾小棠/宋青舟等皆sim真角色)`);
      }
      const ex = c.characters[n] ?? []; c.characters[n] = [...new Set([...ex, ...(Array.isArray(fs) ? fs.filter((x) => typeof x === "string") : [])])].slice(0, 8);
    }
    if (Array.isArray(j.world)) c.world = [...new Set([...c.world, ...j.world.filter((x) => typeof x === "string")])].slice(0, 30);
  } catch { /* ignore */ }
  // ② 校验矛盾: 以引擎【权威硬事实】为境界/派系的准绳(不再让 LLM 自抽自查), 软层另查
  let contradictions: string[] = []; let score = 10;
  try {
    const raw = await llm.complete(
      `${sys}\n引擎【权威硬事实】(角色境界/派系以此为准, 是确定值)：${hardFacts || "(无)"}\n软设定档(JSON)：${JSON.stringify({ characters: c.characters, world: c.world }).slice(0, 1400)}\n核对下面最近几章正文有无矛盾：①与权威硬事实冲突(把某人境界写高/写低、写错派系、把已陨落者写成在场) ②与软设定档冲突(性情/身世/时间线/世界规则前后不一)。严格、只挑真冲突。只回 JSON：{"contradictions":["具体矛盾一句话"],"score":0到10的一致性分(10=毫无矛盾)}\n\n${sample}`,
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
