// app/longrun.ts v2 — 千章长篇连载引擎(修评估问题 + 每章 ≥3000 字)
//   · 情境推进: 故事局面随章/卷前进(破"开篇重写N遍"循环)
//   · 多段成章: 列节拍 → 分段续写 → ≥3000 字
//   · 防重复: 禁与近 6 章雷同, 每章须有新事件/地点/冲突
//   · 控战力崩坏: 36 级阶梯 + 慢进 + 仅卷末批准突破
//   · 可断点续写(文件 DB + 每章落盘) → 适合 hermes/nohup 长跑
// 环境: NOVEL_TARGET=1000  NOVEL_MINLEN=3000  NOVEL_SECTIONS=4  NOVEL_LIVE_LLM=hermes
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "../core/services/db";
import { MockLLM, type LLMProvider } from "../core/services/llm";
import { makeLLM, configSignature } from "./llm-factory";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import { PACK, natalLabel, goalLabel, plateLabel } from "./pack-select";
import { loadGenome, loadLedger, buildGuidance, evolveOnce, loadGlobal } from "./evolve";
import { loadConstraints, constraintsBlock, proposeConstraintMutation } from "./constraints";
import { canonStep, canonBlock, loadCanon, saveCanon } from "./canon";
import type { WorldSnapshot } from "../core/domain/world";

const TARGET = Number(process.env["NOVEL_TARGET"] ?? 1000);
const MINLEN = Number(process.env["NOVEL_MINLEN"] ?? 3000);
const SECTIONS = Number(process.env["NOVEL_SECTIONS"] ?? 4);
const VOL = 25;
const sys = PACK.composeProfile?.systemPrompt ?? "你是一位修仙小说作者。";
const tierName = (id: string | undefined): string => PACK.progression.tiers.find((t) => t.id === id)?.name ?? id ?? "练气初期";
let llm: LLMProvider = makeLLM(); // 章节文笔(可热切换); sim 用 mock 跑世界推演
let llmSig = configSignature();
const sim = new MockLLM();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".novel-output", process.env["NOVEL_SAGA_DIR"] ?? "saga");
const CH_DIR = join(ROOT, "chapters");
mkdirSync(CH_DIR, { recursive: true });

// 单写者锁: 同一世界目录只许一个 longrun 写。防多进程赛跑串台(历史教训: 失败重开堆叠僵尸写者→同一章号被写两遍→标题/正文互相覆盖)。
const LOCK = join(ROOT, "longrun.lock");
if (existsSync(LOCK)) {
  const oldPid = Number(readFileSync(LOCK, "utf8").trim());
  let alive = false;
  try { process.kill(oldPid, 0); alive = oldPid > 0; } catch { alive = false; } // kill(pid,0) 不发信号, 仅探活
  if (alive) {
    console.error(`[longrun] 世界「${process.env["NOVEL_SAGA_DIR"] ?? "saga"}」已有写者 PID ${oldPid} 在跑，本进程退出以免赛跑串台。`);
    process.exit(0);
  }
}
writeFileSync(LOCK, String(process.pid), "utf8");
const releaseLock = (): void => { try { if (existsSync(LOCK) && Number(readFileSync(LOCK, "utf8").trim()) === process.pid) unlinkSync(LOCK); } catch { /* ignore */ } };
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(0); });
process.on("SIGTERM", () => { releaseLock(); process.exit(0); });

// 自进化: 默认开(设 NOVEL_EVOLVE=0 关)。基因(生成参数+引擎 priorWeight)与进化记忆(避雷/发扬/指引)落盘在世界目录。
const EVOLVE = process.env["NOVEL_EVOLVE"] !== "0";
let evoGenome = loadGenome(ROOT);
let evoGuidance = buildGuidance(loadLedger(ROOT), evoGenome, loadGlobal(ROOT).avoid);
let conBlock = constraintsBlock(loadConstraints(ROOT).active); // 规则层: 世界铁律(定义概念空间), 每章注入
let canonInject = canonBlock(loadCanon(ROOT)); // 一致性: 已确立设定 + 待修正矛盾, 每章注入

// 叙事·伏笔账(setup→payoff 跨章结构, 文件持久化, resume 安全)
interface Foreshadow { id: string; desc: string; plantedCh: number; dueCh: number; paid: boolean }
const FS_FILE = join(ROOT, "foreshadows.json");
function readFs(): Foreshadow[] {
  try {
    return existsSync(FS_FILE) ? (JSON.parse(readFileSync(FS_FILE, "utf8")) as Foreshadow[]) : [];
  } catch {
    return [];
  }
}
function writeFs(list: Foreshadow[]): void {
  writeFileSync(FS_FILE, JSON.stringify(list, null, 2), "utf8");
}
const db = openDb(join(ROOT, "world.db"));
const worldId = "saga";

// 单写者锁: 防主循环 step 与"快速裁决"step 并发(JS 单线程, 仅 await 处可能交错)
let _busy = false;
async function guardedStep(): Promise<void> {
  while (_busy) await new Promise((r) => setTimeout(r, 30));
  _busy = true;
  try {
    await step(db, worldId, PACK, sim);
  } finally {
    _busy = false;
  }
}

// 情境随章/卷推进(破开篇循环); 循环时升级世界。优先用内容包提供的场景弧线(换 genre 即换场景)
const ARCS: string[] = PACK.arcs ?? [
  "青云宗灵根试炼方毕，四子定根骨、各入门墙",
  "分配洞府、初遇同门，恩怨与机缘并生",
  "后山秘谷历练，逢异兽、夺机缘，险象环生",
  "坊市风波，卷入宗门间的明争暗斗",
  "古秘境开启，四子结伴探宝，盟约暗生嫌隙",
  "宗门大比，道争升级为生死之搏",
  "魔道窥伺青云，白薇阴脉之秘渐浮",
  "夺舍之劫，正魔交锋，生死相托",
  "渡劫历险，境界跃迁，旧敌新仇交织",
  "更高层的势力入局，棋盘骤然扩大",
];
function sceneFor(n: number): string {
  const idx = Math.floor((n - 1) / 6);
  const arc = ARCS[idx % ARCS.length];
  const cycle = Math.floor(idx / ARCS.length);
  return cycle === 0 ? arc : `${arc}（第${cycle + 1}重天地，势力更巨、对手更强、修为更高）`;
}

function roster(snap: WorldSnapshot): string {
  return Object.values(snap.characters)
    .filter((c) => c.present)
    .map((c) => {
      const bonds = Object.entries(c.props)
        .filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && v !== 0)
        .map(([k, v]) => `${(v as number) > 0 ? "善" : "争"}${k.slice(5)}`)
        .join(",");
      const fac = typeof c.props["faction"] === "string" ? `·${c.props["faction"]}` : "";
      const loc = snap.locations[c.locationId ?? ""]?.name;
      const gl = goalLabel(c);
      return `${c.name}(${natalLabel(c)}·${tierName(c.progressionTier)}${gl ? "·" + gl : ""}${fac}${loc ? "@" + loc : ""}${bonds ? "，" + bonds : ""})`;
    })
    .join("、");
}

async function rollSummary(prev: string, recentGoals: string[]): Promise<string> {
  const p = `${sys}\n长篇连载【前情纲要】(保住人物关系/势力/未了伏笔/当前境界/已发生的大事)：\n${prev}\n新增：${recentGoals.join("；")}\n压缩重写为不超过200字的新纲要，只留对后续连贯最关键的线索，只输出纲要。`;
  return (await llm.complete(p, { thinking: false, temperature: 0.6 })).replace(/\s+/g, " ").slice(0, 320);
}

async function writeChapter(n: number, vol: number, scene: string, crisis: string, bible: string, ros: string, recent: string[], prevHook: string, weave: string): Promise<{ goal: string; text: string; hook: string }> {
  const forbid = recent.slice(-6).join("、") || "无";
  const outline = await llm.complete(
    `${sys}\n【连载第${n}章·第${vol}卷】\n【当前情境】${scene}\n【当前世界大事】${crisis || "暂无"}\n【前情纲要】${bible}\n【在场(含亲疏)】${ros}\n【上章末钩子】${prevHook || "（开篇）"}\n【最近章节标题——严禁雷同、严禁重演开篇灵根试炼】${forbid}${weave ? `\n【本章叙事任务·须落实】${weave}` : ""}\n列出本章 ${SECTIONS} 个情节节拍(每个≤20字)：首拍由上章钩子直接引发；每拍须是前一拍的直接后果(因果相承"因→果→再生变"，不得并列罗列)；在"当前情境"内生新事件/冲突/转折；末拍留引向下章的悬念。只列 ${SECTIONS} 行节拍。`,
    { temperature: 0.9 },
  );
  const beats = outline.split("\n").map((s) => s.replace(/^[\d.、)\-—•·*\s]+/, "").replace(/^节拍[零〇一二三四五六七八九十\d]+[：:、.\s]*/, "").trim()).filter(Boolean).slice(0, SECTIONS);
  while (beats.length < SECTIONS) beats.push("情节推进");

  const titleStyle = PACK.composeProfile?.titleStyle ?? "简洁自然、有画面感的标题，避免堆砌并列短语与生硬对仗";
  const goal = (await llm.complete(`${sys}\n为本章起一个标题。要求：紧扣本章核心转折，自然、有画面感、含一点悬念；≤12字；${titleStyle}。不含"第X章"字样，不得与「${forbid}」雷同。只回标题本身：\n${beats.join("；")}`, { thinking: false, temperature: 1.0 }))
    .replace(/\s+/g, " ")
    .replace(/[《》「」#*_~`\n]/g, "") // 去书名号/markdown 强调符
    .replace(/^[\s\-—•·*]+/, "") // 去前导项目符/破折号
    .replace(/^第[零〇一二三四五六七八九十百千两\d]+[章回][:：\s]*/, "") // 去掉混进的"第X章"
    .replace(/^节拍[零〇一二三四五六七八九十\d]+[：:、.\s]*/, "") // 去掉混进的"节拍一："
    .slice(0, 20);

  const perSec = Math.ceil((MINLEN / SECTIONS) * 1.2);
  let text = "";
  let prev = "";
  for (let i = 0; i < beats.length; i++) {
    const last = i === beats.length - 1;
    const sec = await llm.complete(
      `${sys}\n【第${n}章《${goal}》·第${vol}卷·情境：${scene}】\n【当前世界大事】${crisis || "暂无"}\n【在场角色及修为】${ros}\n【上文结尾】${prev.slice(-280) || "（本章开篇，承接上一章）"}\n续写本章第${i + 1}/${SECTIONS}段，对应情节：「${beats[i]}」。${weave && i === Math.min(1, SECTIONS - 1) ? `本段须自然落实：${weave}。` : ""}须由上段结果直接引发、承接因果，各角色言行暗合其命格性情。\n【笔法·要紧】文字干净利落、节奏明快：多用动词与短句，少堆砌形容词与比喻；删去"仿佛/似乎/像是/宛如/一般"之类的模糊修饰；对白须推动情节、不寒暄铺垫；不为凑字数而注水环境描写。${canonInject ? "\n" + canonInject : ""}${conBlock ? "\n" + conBlock : ""}${evoGuidance ? "\n" + evoGuidance : ""}\n约 ${perSec} 字。${last ? "段末留一个引向下一章的悬念钩子。" : ""}只输出正文，不要写任何章节标题或"第X章"字样。`,
      { thinking: false, temperature: evoGenome.gen.temperature, topP: evoGenome.gen.topP, frequencyPenalty: evoGenome.gen.frequencyPenalty, presencePenalty: evoGenome.gen.presencePenalty }, // 进化基因控制采样
    );
    const clean = sec.trim()
      .replace(/^(#{1,6}\s*)?第[零〇一二三四五六七八九十百千两\d]+[章回][^\n]*\n+/, "") // 去掉混进正文的章标题行
      .replace(/^#{1,6}\s+[^\n]*\n+/, ""); // 去掉任何残留 markdown 标题行
    text += (text ? "\n\n" : "") + clean;
    prev = sec;
  }
  return { goal, text, hook: beats[beats.length - 1] ?? "" };
}

async function main(): Promise<void> {
  let n = store.readChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-")).length;
  if (n === 0) {
    const seeded = PACK.seedWorld({ worldId, packId: PACK.id, seed: "千章长篇", config: {} });
    seeded.props["autoCompose"] = false;
    store.saveSnapshot(db, worldId, seeded, 0, Date.now());
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, Date.now());
  }
  const s0 = store.loadSnapshot(db, worldId);
  let bible = s0 && typeof s0.snapshot.props["bible"] === "string" ? (s0.snapshot.props["bible"] as string) : "青云宗灵根试炼，苏雪(冰)、林焰(火)、玄渊(幽)、白薇(阴脉之谜)四修命数交汇，各入门墙。";
  const recent: string[] = [];
  let prevHook = "";
  let evCursor = 0;
  let revivals: Array<{ faction: string; at: number }> = [];
  let _wasPaused = false;
  const PAUSE = join(ROOT, "paused"); // 网页暂停开关(存在=暂停)

  console.log(`长篇连载 v2：目标 ${TARGET} 章 · 每章≥${MINLEN}字(${SECTIONS}段) · 从第 ${n + 1} 章续写（LLM=${llm.id}）`);
  // 快速裁决: 作者在网页裁决后, 每 ~15s 检一次, 有待裁就用 sim 快走一步即时落定(不必等当前章写完)
  setInterval(() => {
    if (!_busy && store.countPendingInputs(db, worldId, "author-verdict") > 0) void guardedStep();
  }, 15000);
  while (n < TARGET) {
    if (existsSync(PAUSE)) { // 暂停: 原地等待, 不推进世界/不写章
      if (!_wasPaused) { console.log("⏸ 世界已暂停（网页点继续或删 paused 文件恢复）"); _wasPaused = true; }
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (_wasPaused) { console.log("▶ 世界已继续"); _wasPaused = false; }
    n++;
    const vol = Math.floor((n - 1) / VOL) + 1;
    const scene = sceneFor(n);
    // 世代更替: 持续补充新血(每 10 章), 在场上限 ~18 → 有人退场(飞升/陨落)便有新人填补, 代谢不息
    if (n % 10 === 0 && PACK.spawnCharacter) {
      const sp0 = store.loadSnapshot(db, worldId);
      const present = sp0 ? Object.values(sp0.snapshot.characters).filter((c) => c.present).length : 99;
      if (present < 18) store.enqueueInput(db, `spawn-${n}`, worldId, "spawn-character", { character: PACK.spawnCharacter("长篇", n / 10) }, Date.now());
    }
    for (let t = 0; t < 3; t++) await guardedStep();

    // 议事·奇门定夺: 作者若宽限期(~3章)内未裁, 由奇门吉凶自动落定(吉/平→依准, 凶→另议); 作者可在窗口内 /api/verdict 抢先裁
    {
      const sp = store.loadSnapshot(db, worldId);
      const pend = sp && Array.isArray(sp.snapshot.props["pendingDecisions"]) ? (sp.snapshot.props["pendingDecisions"] as Array<{ decisionId: string; omen?: string }>) : [];
      const curTick = sp?.snapshot.tick ?? 0;
      const GRACE_TICKS = 3 * 3; // 宽限约 3 章(给作者插手窗口)
      let auto = false;
      for (const p of pend) {
        const m = p.decisionId.match(/t(\d+)$/);
        const age = curTick - (m ? Number(m[1]) : curTick);
        if (age >= GRACE_TICKS) {
          store.enqueueInput(db, `auto-${p.decisionId}`, worldId, "author-verdict", { decisionId: p.decisionId, verdict: p.omen === "凶" ? "reject" : "accept" }, Date.now());
          auto = true;
        }
      }
      if (auto) await guardedStep();
    }

    const snap = store.loadSnapshot(db, worldId);
    if (!snap) throw new Error("no snapshot");
    const ros = roster(snap.snapshot);
    const t0 = Date.now();
    const crisisBase = typeof snap.snapshot.props["crisis"] === "string" ? (snap.snapshot.props["crisis"] as string) : "";
    const fr = snap.snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined;
    const facSummary = fr
      ? Object.entries(fr).flatMap(([a, m]) => Object.entries(m).filter(([b]) => a < b).map(([b, v]) => `${a}与${b}${v > 0 ? "结盟" : v < 0 ? "交恶" : "中立"}`)).slice(0, 4).join("；")
      : "";
    // 变故: 自上章以来的陨落/吞并 + 当前怀复仇之心者 → 写进本章正文
    const newEvs = store.readEvents(db, worldId).filter((e) => (e.seq ?? 0) > evCursor);
    for (const e of newEvs) evCursor = Math.max(evCursor, e.seq ?? 0);
    const upsets = newEvs.filter((e) => e.kind === "CharacterFell" || e.kind === "FactionDissolved" || e.kind === "VengeanceResolved" || e.kind === "CharacterTranscended").map((e) => e.summary).filter((s): s is string => !!s);
    // (f) 被吞并的派系排期 8 章后复兴; 到期则残部拥立枭雄, 版图复振
    for (const e of newEvs) if (e.kind === "FactionDissolved") { const f = (e.payload as { faction?: string }).faction; if (f) revivals.push({ faction: f, at: n + 8 }); }
    const reviveNotes: string[] = [];
    for (const r of revivals.filter((r) => n >= r.at)) {
      if (PACK.reviveFaction) {
        const reviver = PACK.reviveFaction(r.faction, n);
        store.enqueueInput(db, `revive-${r.faction}-${n}`, worldId, "spawn-character", { character: reviver }, Date.now());
        reviveNotes.push(`${r.faction}残部拥立${reviver.name}、揭竿复兴`);
      }
    }
    revivals = revivals.filter((r) => n < r.at);
    const avengers = Object.values(snap.snapshot.characters)
      .filter((c) => c.present && typeof c.props["avenge"] === "string")
      .map((c) => `${c.name}痛失${String(c.props["avenge"])}、誓复此仇`);
    const upheaval = [...upsets, ...avengers, ...reviveNotes].join("；");
    const qimen = plateLabel(snap.snapshot.tick ?? n * 3);
    const crisis = [crisisBase, `奇门·${qimen}`, facSummary ? `派系格局：${facSummary}` : "", upheaval ? `近时变故：${upheaval}` : ""].filter(Boolean).join(" ｜ ");
    const sig = configSignature();
    if (sig !== llmSig) { llm = makeLLM(); llmSig = sig; console.log(`↻ LLM 已切换为 ${llm.id}`); } // 网页改设置 → 热切换, 无需重启长跑
    // 认知②: 召回在场角色的显著情景记忆 → 章节作前情回响(callback)
    const present = new Set(Object.values(snap.snapshot.characters).filter((c) => c.present).map((c) => c.id));
    const echoes = store.readSalientMemories(db, worldId, 0.6, 6).filter((m) => present.has(m.characterId)).map((m) => m.body);
    const bibleEcho = echoes.length ? `${bible}\n【角色近事回响】${echoes.slice(0, 4).join("；")}` : bible;
    // 叙事·伏笔账: 到期回收 / 每 6 章埋设(开放伏笔 < 3 时), 形成 setup→payoff 跨章结构
    const fsList = readFs();
    let weave = "";
    const due = fsList.find((f) => !f.paid && f.dueCh <= n);
    if (due) {
      weave = `回收伏笔——给出回应或揭其真相："${due.desc}"`;
      due.paid = true;
      writeFs(fsList);
      console.log(`  ⟡ 回收伏笔: ${due.desc}`);
    } else if (n % 6 === 0 && fsList.filter((f) => !f.paid).length < 3) {
      const hook = (await llm.complete(`${sys}\n据当前态势构思一个可在 8~14 章后回收的"伏笔"(一桩悬念/隐秘/信物/预言/未了之债，≤24字)，只回伏笔本身：\n世界大事：${crisis}\n在场：${ros.slice(0, 200)}`)).replace(/\s+/g, " ").replace(/[《》「」#]/g, "").slice(0, 30);
      if (hook) {
        const f: Foreshadow = { id: `fs-${n}`, desc: hook, plantedCh: n, dueCh: n + 8 + (n % 7), paid: false };
        fsList.push(f);
        writeFs(fsList);
        weave = `自然埋下一个伏笔(只露端倪、勿点破)："${hook}"`;
        console.log(`  ⟡ 埋伏笔: ${hook}（第${f.dueCh}章回收）`);
      }
    }
    conBlock = constraintsBlock(loadConstraints(ROOT).active); // 拾取议事已批准的铁律变更(规则层概念空间)
    const ch = await writeChapter(n, vol, scene, crisis, bibleEcho, ros, recent, prevHook, weave);

    writeFileSync(join(CH_DIR, `ch-${String(n).padStart(4, "0")}.md`), `# 第${n}章　${ch.goal}\n\n${ch.text}\n`, "utf8");
    store.saveChapter(db, { id: `saga-ch-${n}`, worldId, goal: ch.goal, text: ch.text, status: "inscribed", createdAt: Date.now() });
    recent.push(`第${n}章「${ch.goal}」`);
    prevHook = ch.hook;

    if (n % 8 === 0) { // 一致性: 更新设定档 canon + 校验矛盾, 喂生成(修正)与适应度(canonStep 先于 evolveOnce)
      try {
        const rcc = store.readChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-")).slice(-8).map((c) => ({ goal: c.goal, text: c.text }));
        const cs = await canonStep(llm, sys, ROOT, rcc, n);
        // 可验证子目标②: 伏笔回收率(据伏笔账本, 到期未收=扣分)
        const fsAll = readFs(); const due = fsAll.filter((f) => f.dueCh <= n);
        const fsRate = due.length ? +((due.filter((f) => f.paid).length / due.length) * 10).toFixed(1) : 10;
        const cc = loadCanon(ROOT); cc.lastForeshadow = fsRate; saveCanon(ROOT, cc);
        canonInject = canonBlock(cc);
        console.log(`  📜 canon ${Object.keys(cs.canon.characters).length}人·一致性${cs.score}/10·伏笔回收${fsRate}/10${cs.contradictions.length ? " ⚠" + cs.contradictions[0]!.slice(0, 32) : ""}`);
      } catch (e) { console.log("  📜 canon 跳过:", String(e).slice(0, 60)); }
    }
    if (n % 8 === 0) {
      bible = await rollSummary(bible, recent.slice(-8));
      if (EVOLVE) {
        try {
          const rc = store.readChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-")).slice(-8).map((c) => ({ goal: c.goal, text: c.text }));
          const evo = await evolveOnce(llm, sys, ROOT, vol, rc);
          evoGenome = evo.genome; evoGuidance = evo.guidance; // 下一卷据此生成
          console.log(`  🧬 ${evo.report}`);
        } catch (e) { console.log("  🧬 进化跳过:", String(e).slice(0, 80)); }
      }
      // 规则层进化: 每 24 章, 若无待裁且距上次铁律变更≥16章, 提议一条【变革性】铁律变异 → 进议事由作者裁决
      if (n % 24 === 0) {
        try {
          const con0 = loadConstraints(ROOT);
          if (!con0.pending && n - con0.lastChangeCh >= 16) {
            const fits = loadLedger(ROOT).scores.slice(-3).map((s) => s.fitness);
            const stagnating = fits.length >= 3 && Math.max(...fits) - Math.min(...fits) < 0.6; // 适应度停滞=该换空间(Wiggins uninspiration)
            if (stagnating || n - con0.lastChangeCh >= 48) { // 停滞触发, 或每48章强制一次防僵化
              const mut = await proposeConstraintMutation(llm, sys, ROOT, recent.slice(-6).join("；"), vol);
              if (mut) console.log(`  ⚖ 铁律提案(${mut.kind}${stagnating ? "·因停滞" : ""}): ${mut.after ?? mut.target} ——待议事裁决`);
            }
          }
        } catch (e) { console.log("  ⚖ 铁律提案跳过:", String(e).slice(0, 80)); }
      }
      const s = store.loadSnapshot(db, worldId);
      if (s) {
        s.snapshot.props["bible"] = bible;
        s.snapshot.props["tuning"] = { priorWeight: evoGenome.engine.priorWeight }; // 引擎读: 先验引导强度
        store.saveSnapshot(db, worldId, s.snapshot, s.lastSeq, Date.now());
      }
    }
    console.log(`第 ${n}/${TARGET} 章　《${ch.goal}》　${ch.text.length}字　(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`\n完成 ${TARGET} 章 → ${CH_DIR}`);
}

main().catch((e: unknown) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
