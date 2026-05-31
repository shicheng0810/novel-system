// app/novella.ts — 跑一部首尾完整的短篇。
// (a)更长: 8 章弧线; 每章前推 3 拍世界攒事件; 章节素材 = 真实发生的事(互动/突破/结盟道争)→ 剧情从模拟涌现。
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "../core/services/db";
import { MockLLM, type LLMProvider } from "../core/services/llm";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import xianxiaBaziPack from "../packs/xianxia-bazi/index";
import type { WorldSnapshot } from "../core/domain/world";
import { makeLLM } from "./llm-factory";

const sys = xianxiaBaziPack.composeProfile?.systemPrompt ?? "你是一位小说作者，文笔古雅。";
const llm: LLMProvider = makeLLM();

function roster(snap: WorldSnapshot): string {
  return Object.values(snap.characters)
    .filter((c) => c.present)
    .map((c) => {
      const bonds = Object.entries(c.props)
        .filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && v !== 0)
        .map(([k, v]) => `${(v as number) > 0 ? "善" : "争"}${k.slice(5)}`)
        .join(",");
      return `${c.name}(${c.progressionTier}${bonds ? "，" + bonds : ""})`;
    })
    .join("、");
}

async function writeChapter(beat: string, storySoFar: string, snap: WorldSnapshot, events: string[], isFinal: boolean): Promise<{ goal: string; text: string }> {
  const present = roster(snap);
  const happened = events.slice(-6).join("；") || "（尚无大事）";
  const titlePrompt = `${sys}\n【本章定位】${beat}\n【前情】${storySoFar}\n【在场】${present}\n【近期事件】${happened}\n拟本章回目标题，不超过14字，只回标题本身（无书名号）。`;
  const goal = (await llm.complete(titlePrompt)).replace(/\s+/g, " ").replace(/[《》「」]/g, "").slice(0, 20);
  const instr = isFinal ? "这是终章，须收束全篇、了结主要因果、给出结局。" : "推进剧情，埋一处伏笔，留有余韵。";
  const prosePrompt = `${sys}\n【本章定位】${beat}\n【前情】${storySoFar}\n【在场角色(及亲疏)】${present}\n【近期实际发生】${happened}\n写约240字本章正文，须呼应"近期实际发生"的事件与人物亲疏，承接前情，${instr}文风古雅、连贯成篇，只输出正文。`;
  const text = (await llm.complete(prosePrompt)).trim();
  return { goal, text };
}

async function main(): Promise<void> {
  const db = openDb(":memory:");
  const worldId = "novella";
  const ts = Date.now();
  store.saveSnapshot(db, worldId, xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "长篇一部", config: {} }), 0, ts);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, ts);
  const sim = new MockLLM();

  const beats = [
    "开端·灵根初显，四修聚青云",
    "相识·道心各异，亲疏初分",
    "秘境·古境现世，结伴而入",
    "分歧·利害交错，盟约生隙",
    "暗涌·心魔渐起，背信之念",
    "危局·强敌压境，生死相托",
    "高潮·秘钥现世，一念定生死",
    "终章·因果落定，各归其道（收束全篇）",
  ];
  const title = "《青云命数录》";
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", ".novel-output");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `novella-${ts}.md`);

  const chapters: Array<{ n: number; goal: string; text: string }> = [];
  let storySoFar = "（楔子：青云宗灵根试炼之日，苏雪、林焰、玄渊、白薇四名弟子命数交汇。）";

  function render(): string {
    let md = `# ${title}\n\n> Novel System · 世界推演 + 八字奇门先验 + 社交涌现生成 · ${llm.id} · ${new Date(ts).toISOString().slice(0, 10)}\n\n`;
    for (const c of chapters) md += `## 第${c.n}章　${c.goal}\n\n${c.text}\n\n`;
    return md;
  }

  console.log(`开始生成 ${title}（8 章完整弧线，${llm.id}，剧情由模拟涌现）…\n`);
  for (let i = 0; i < beats.length; i++) {
    for (let t = 0; t < 3; t++) await step(db, worldId, xianxiaBaziPack, sim); // 推世界 3 拍攒事件(mock, 快)
    const snap = store.loadSnapshot(db, worldId);
    if (!snap) throw new Error("no snapshot");
    const events = store.readRecentStageSummaries(db, worldId, 8);
    process.stdout.write(`· 第${i + 1}章（${beats[i]}）…`);
    const t0 = Date.now();
    const ch = await writeChapter(beats[i]!, storySoFar, snap.snapshot, events, i === beats.length - 1);
    chapters.push({ n: i + 1, goal: ch.goal, text: ch.text });
    storySoFar = chapters.slice(-2).map((c) => `第${c.n}章「${c.goal}」`).join("；");
    writeFileSync(outPath, render(), "utf8");
    console.log(` 《${ch.goal}》(${Date.now() - t0}ms)`);
  }

  console.log(`\n${"=".repeat(56)}\n`);
  console.log(render());
  console.log(`${"=".repeat(56)}\n已存档: ${outPath}`);
}

main().catch((e: unknown) => {
  console.error("失败(fallback 已兜底):", String(e).slice(0, 300));
  process.exit(0);
});
