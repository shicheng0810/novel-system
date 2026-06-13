// app/consistency-judge.ts — P0 外部一致性判官(ConStory-Checker 范式·.audit/20260612-consistency-research §Phase0)。
//   离线逐章·非逐章 gate·高精度/半召回(synthesis A4: 零误杀+全召回数学不可达·只能拿召回换精度)。
//   **判官模型必须 ≠ 写章模型(DeepSeek)防自偏(synthesis 风险节·2508.06709)。** 权威跑法=Opus subagent 驱动(见下);
//   本文件提供 ①判官 prompt 模板(固化·可复跑) ②三类定义 ③证据链 schema ④DeepSeek 自判 fallback(弱·研究警告同模型自判通过率虚高·仅判官不可用时兜底)。
//   验收(2026-06-12 已过): 4/4 已知评测正例命中(三道印/空青芝麻/雾江余债/炊烟)+ 好章基准 0/9 误杀。
import { readFileSync } from "node:fs";
import { makeLLM } from "./llm-factory";

// 三类章内结构 bug 定义(只看本章正文·不跨章·跨章伏笔/实体归 P3 故事 KG)。
export const JUDGE_CLASSES = {
  objAttribution: "物件归属错乱: 同一具体物件前文明确是 A 拿出/带来/拥有, 后文却写成 B 的, 且无转手动作交代。合法转手(递给/接过等动作)不算。",
  stateRestate: "状态语义复述: 同一人物状态/事实, 相隔较远处用不同措辞重复交代两遍(读者已知却被再讲)。真冗余才算; 文学呼应/回旋/不同人物各自得知同一事=正常不算。",
  foreshadowUnclosed: "伏笔不收: 本章开了明确悬念线索(异动/异响/未解之问), 引导读者期待回应, 但本章内再未触及、悬空。留待后续章节的大伏笔不算。",
} as const;

// 判官 prompt(保守高精度·不确定判干净·带正文引文证据链)。判官读全文正文 text, 返回 JSON。
export function buildJudgePrompt(text: string, ch: number): string {
  const defs = Object.entries(JUDGE_CLASSES).map(([k, v], i) => `${i + 1}. **${k}** — ${v}`).join("\n");
  return `你是长篇小说"结构一致性判官"(ConStory-Checker 范式), 独立外部判官——只看正文事实、不揣测作者意图。**保守高精度: 宁漏勿误, 只有非常确信才标记, 不确定一律判"干净"。**
逐项判定下列三类**章内**结构 bug(只看本章正文, 不跨章):
${defs}

只输出一个 JSON(无其他文字):
{"ch":${ch},"objAttribution":[{"evidence1":"前文引文≤30字","evidence2":"矛盾处引文≤30字","why":"一句话"}],"stateRestate":[...],"foreshadowUnclosed":[{"evidence":"悬空线索引文≤30字","why":"一句话"}]}
每类空数组=该类干净。证据必须是正文真实引文。

【本章正文】
${text}`;
}

export interface JudgeFinding { evidence1?: string; evidence2?: string; evidence?: string; why: string }
export interface JudgeResult { ch: number; objAttribution: JudgeFinding[]; stateRestate: JudgeFinding[]; foreshadowUnclosed: JudgeFinding[] }

// fallback 跑法(弱·DeepSeek 自判): 研究警告同模型判官通过率虚高, 仅 Opus subagent 不可用时兜底。
//   权威跑法是 Opus subagent(主 Claude 派 general-purpose agent 读章批判)——见 P0-results.md, 那才是 ≠ 写章模型的解耦判官。
export async function judgeChapterFallback(text: string, ch: number): Promise<JudgeResult> {
  const llm = makeLLM();
  const raw = await llm.complete(buildJudgePrompt(text, ch), { thinking: false, temperature: 0.2 });
  try {
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as Partial<JudgeResult>;
    return { ch, objAttribution: j.objAttribution ?? [], stateRestate: j.stateRestate ?? [], foreshadowUnclosed: j.foreshadowUnclosed ?? [] };
  } catch { return { ch, objAttribution: [], stateRestate: [], foreshadowUnclosed: [] }; }
}

// CLI: npx tsx app/consistency-judge.ts <章文件> [--fallback]
//   默认只打印 prompt(供人工贴给 Opus/外部判官); --fallback 用 DeepSeek 自判(弱)。
if (process.argv[1]?.endsWith("consistency-judge.ts")) {
  const file = process.argv[2];
  if (!file) { console.log("用法: npx tsx app/consistency-judge.ts <章.md> [--fallback]\n  默认打印判官prompt(贴给非写章模型); --fallback=DeepSeek自判(弱·研究警告自偏)"); process.exit(0); }
  const text = readFileSync(file, "utf8");
  const ch = Number(file.match(/ch-(\d+)/)?.[1] ?? 0);
  if (process.argv.includes("--fallback")) {
    void judgeChapterFallback(text, ch).then((r) => console.log(JSON.stringify(r, null, 2)));
  } else {
    console.log(buildJudgePrompt(text, ch));
  }
}
