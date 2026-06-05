// app/longrun.ts v2 — 千章长篇连载引擎(修评估问题 + 每章 ≥3000 字)
//   · 情境推进: 故事局面随章/卷前进(破"开篇重写N遍"循环)
//   · 多段成章: 列节拍 → 分段续写 → ≥3000 字
//   · 防重复: 禁与近 6 章雷同, 每章须有新事件/地点/冲突
//   · 控战力崩坏: 36 级阶梯 + 慢进 + 仅卷末批准突破
//   · 可断点续写(文件 DB + 每章落盘) → 适合 hermes/nohup 长跑
// 环境: NOVEL_TARGET=1000  NOVEL_MINLEN=3000  NOVEL_SECTIONS=4  NOVEL_LIVE_LLM=hermes
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "../core/services/db";
import { MockLLM, type LLMProvider } from "../core/services/llm";
import { makeLLM, configSignature } from "./llm-factory";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import { PACK, natalLabel, goalLabel, plateLabel } from "./pack-select";
import { loadOutlinePlan, beatForChapter } from "./outline-plan";
import { loadLore, recallLore } from "./lore-lib";
import { pickArcStart } from "./arc-select";
import { loadGenome, loadLedger, buildGuidance, evolveOnce, loadGlobal } from "./evolve";
import { computeSimFitness, saveSimFitness, loadSimFitness } from "./sim-fitness";
import { dramaControl, loadDrama, saveDrama } from "./drama";
import { evolveSimRules, loadSimRules } from "./sim-rules";
import { personaBlock, recallShared, INNER_CN } from "./persona";
import { deriveCanon, derivedBlock, derivedFacts } from "./derive-canon";
import { loadMinds, saveMinds, accrueImportance, selectQueue, batchReflect, situationFp } from "./minds";
import { loadConstraints, constraintsBlock, proposeConstraintMutation } from "./constraints";
import { canonStep, canonBlock, loadCanon, saveCanon } from "./canon";
import type { WorldSnapshot, CharacterState } from "../core/domain/world";

const TARGET = Number(process.env["NOVEL_TARGET"] ?? 1000);
const MINLEN = Number(process.env["NOVEL_MINLEN"] ?? 3000);
const SECTIONS = Number(process.env["NOVEL_SECTIONS"] ?? 4);
const WARMUP = Number(process.env["NOVEL_WARMUP"] ?? 0); // 世界预演化: 起跑前静默推演 N tick(不出章)再写第 1 章, 让关系/恩怨/派系成形(StoryBox 实证: 先模拟提升人物/冲突)。0=快起笔(创世即写)
// 笔法风格: 默认爽文向(明快短句); NOVEL_STYLE=温润 切到温情/文学向(留白、舒缓、重内心与余味) —— 温情向/启发向世界用, 不被默认的明快爽利指令带跑。
const PENMANSHIP = process.env["NOVEL_STYLE"] === "温润"
  ? `【笔法·要紧】笔调温润、克制、有留白与回味：容得下环境、细节与内心的细腻铺陈，不必处处明快短促；以具体的人间烟火细节承载情感、不喊口号、不滥煽情；对白自然，可有寒暄、欲言又止与言外之意；节奏舒缓有韵、重在触动余味与启发，而非爽利推进。仍须干净、不无谓注水，避免"仿佛/似乎/宛如"之类空泛模糊词。`
  : `【笔法·要紧】文字干净利落、节奏明快：多用动词与短句，少堆砌形容词与比喻；删去"仿佛/似乎/像是/宛如/一般"之类的模糊修饰；对白须推动情节、不寒暄铺垫；不为凑字数而注水环境描写。`;
const GENTLE = process.env["NOVEL_STYLE"] === "温润"; // 温情/温润向: 节拍走「场景流连/相遇展开/心境流转」而非生新冲突跳切, 章末留余味而非硬悬念
const VOL = 25;
const sys = PACK.composeProfile?.systemPrompt ?? "你是一位修仙小说作者。";
const tierName = (id: string | undefined): string => PACK.progression.tiers.find((t) => t.id === id)?.name ?? id ?? "练气初期";
let llm: LLMProvider = makeLLM(); // 章节文笔(可热切换); sim 用 mock 跑世界推演
let llmSig = configSignature();
const sim = new MockLLM();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".novel-output", process.env["NOVEL_SAGA_DIR"] ?? "saga");
const CH_DIR = join(ROOT, "chapters");
mkdirSync(CH_DIR, { recursive: true });
const loreLib = loadLore(ROOT); // T3 触发式设定库(freeform 世界由 server 据配置写 lore.json; 无则 null, 不召回)
let arcHint = ""; // C方案: 预演化挑出的最佳弧线 → 注入第1章开篇做 in-medias-res 框定(无预演化则空)

// 单写者锁: 同一世界目录只许一个 longrun 写。防多进程赛跑串台(历史教训: 失败重开堆叠僵尸写者→同一章号被写两遍→标题/正文互相覆盖)。
const LOCK = join(ROOT, "longrun.lock");
if (existsSync(LOCK)) {
  const oldPid = Number(readFileSync(LOCK, "utf8").trim());
  let alive = false;
  try { process.kill(oldPid, 0); alive = oldPid > 0; } catch { alive = false; } // kill(pid,0) 不发信号, 仅探活
  const fresh = (() => { try { return Date.now() - statSync(LOCK).mtimeMs < 10 * 60 * 1000; } catch { return false; } })(); // 锁文件 mtime = 心跳(主循环每章重写刷新)
  if (alive && fresh) { // PID 活【且】心跳新鲜(<10min)才认作真写者 → 防 pkill -9 后 PID 被系统复用而误判有写者退出(锁与"pkill -9 重启"打架)
    console.error(`[longrun] 世界「${process.env["NOVEL_SAGA_DIR"] ?? "saga"}」已有写者 PID ${oldPid} 在跑(心跳新鲜)，本进程退出以免赛跑串台。`);
    process.exit(0);
  } // PID 活但心跳陈旧 = 多半 PID 复用(旧写者已 pkill -9、releaseLock 没跑)→ 接管
}
const heartbeat = (): void => { try { writeFileSync(LOCK, String(process.pid), "utf8"); } catch { /* ignore */ } }; // 重写刷新 mtime
heartbeat();
const releaseLock = (): void => { try { if (existsSync(LOCK) && Number(readFileSync(LOCK, "utf8").trim()) === process.pid) unlinkSync(LOCK); } catch { /* ignore */ } };
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(0); });
process.on("SIGTERM", () => { releaseLock(); process.exit(0); });

// 自进化: 默认开(设 NOVEL_EVOLVE=0 关)。基因(生成参数+引擎 priorWeight)与进化记忆(避雷/发扬/指引)落盘在世界目录。
const EVOLVE = process.env["NOVEL_EVOLVE"] !== "0";
// X4 传承闭环: 新世界(无本地 genome)可经 NOVEL_WORLD_INTENT 指定目标引擎策略 niche, 从全局 QD 存档取该 niche 精英起步(群像类世界取群像引擎而非全局文笔冠军)。别名「群像/爽文」→低代谢×生长; 或直接传「低代谢×生长」。已有本地 genome 的世界不受影响。
const _intentRaw = (process.env["NOVEL_WORLD_INTENT"] ?? "").trim();
const worldIntent: { turnover?: string; structure?: string } | undefined = _intentRaw
  ? (_intentRaw === "群像" || _intentRaw === "爽文" ? { turnover: "低代谢", structure: "生长" } : (() => { const [t, s] = _intentRaw.split("×"); return { turnover: t || undefined, structure: s || undefined }; })())
  : undefined;
let evoGenome = loadGenome(ROOT, worldIntent);
let evoGuidance = buildGuidance(loadLedger(ROOT), evoGenome, loadGlobal(ROOT).avoid);
let drama = loadDrama(ROOT); // T4 临界控制器 + 戏剧导演状态(coldStreak/hotStreak), 跨重启持久
const minds = loadMinds(ROOT); // M3 全员连续心智: pending_importance 队列 + 上次反思章, 跨重启持久
let conBlock = constraintsBlock(loadConstraints(ROOT).active); // 规则层: 世界铁律(定义概念空间), 每章注入
let canonInject = canonBlock(loadCanon(ROOT)); // 一致性·软层: 已确立软设定 + 待修正矛盾, 每章注入
let canonHard = ""; // 一致性·硬层(deriveCanon): 引擎权威境界/派系/生死/恩怨, 每章从快照确定性派生 + 强注入(prose 不漂)

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
// 临界区(读快照→改 props→存快照)须与 step 互斥: 否则 setInterval 的快速裁决 step 在其 await 处交错, 旁路 saveSnapshot 会丢更新(审计: drama/bible 写竞态)
async function withLock<T>(fn: () => T): Promise<T> {
  while (_busy) await new Promise((r) => setTimeout(r, 30));
  _busy = true;
  try { return fn(); } finally { _busy = false; }
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
      const inner = INNER_CN[String(c.props["innerDrive"] ?? "")] ?? "";
      return `${c.name}(${natalLabel(c)}·${tierName(c.progressionTier)}${gl ? "·" + gl : ""}${inner ? "·" + inner : ""}${fac}${loc ? "@" + loc : ""}${bonds ? "，" + bonds : ""})`;
    })
    .join("、");
}

async function rollSummary(prev: string, recentGoals: string[]): Promise<string> {
  const p = `${sys}\n长篇连载【前情纲要】(保住人物关系/势力/未了伏笔/当前境界/已发生的大事)：\n${prev}\n新增：${recentGoals.join("；")}\n压缩重写为不超过200字的新纲要，只留对后续连贯最关键的线索，只输出纲要。`;
  return (await llm.complete(p, { thinking: false, temperature: 0.6 })).replace(/\s+/g, " ").slice(0, 320);
}

async function writeChapter(n: number, vol: number, scene: string, crisis: string, bible: string, ros: string, recent: string[], prevHook: string, weave: string, outlineBeat: string, obedience: string): Promise<{ goal: string; text: string; hook: string }> {
  const forbid = recent.slice(-6).join("、") || "无";
  const beatSpec = GENTLE
    ? `列出本章 ${SECTIONS} 个叙事节拍(每个≤20字)：首拍由上章余韵自然承接；节拍可是同一场景的流连、一次相遇或对话的展开、一段心境或回忆的流转，前后气脉相承、连贯不跳，不必每拍生新冲突或硬跳时间地点；多写人情、观察与细微的触动；${outlineBeat ? "顺着上述主线、" : ""}末拍以一个安静的画面或一点余味收束、不必留悬念。只列 ${SECTIONS} 行节拍。`
    : `列出本章 ${SECTIONS} 个情节节拍(每个≤20字)：首拍由上章钩子直接引发；每拍须是前一拍的直接后果(因果相承"因→果→再生变"，不得并列罗列)；${outlineBeat ? "在推进上述大纲主线的前提下" : `在"当前情境"内`}生新事件/冲突/转折；末拍留引向下章的悬念。只列 ${SECTIONS} 行节拍。`;
  const outline = await llm.complete(
    `${sys}\n【连载第${n}章·第${vol}卷】\n【当前情境】${scene}\n【当前世界大事】${crisis || "暂无"}\n【前情纲要】${bible}\n【在场(含亲疏)】${ros}\n【上章末钩子】${prevHook || "（开篇）"}\n【最近章节标题——严禁雷同、严禁重演开篇灵根试炼】${forbid}${weave ? `\n【本章叙事任务·须落实】${weave}` : ""}${outlineBeat ? (obedience === "balanced" ? `\n【本章大纲主线·建议方向】${outlineBeat} —— 优先顺势推进这条主线；但世界若自发涌现变数/冲突，可顺其自然地偏离，不必硬贴。` : `\n【本章须遵循的大纲主线·最要紧】${outlineBeat} —— 你列的 ${SECTIONS} 个节拍必须服务于推进这条主线、顺着它走，不可跑偏到别处情节。`) : ""}${n === 1 && arcHint ? "\n【开篇·in-medias-res·要紧】" + arcHint : ""}\n${beatSpec}`,
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
  const loreBlock = recallLore(loreLib, `${crisis} ${ros} ${beats.join(" ")} ${goal} ${weave}`); // T3: 召回本章相关设定(关键词命中→注入, 保设定一致)
  let text = "";
  let prev = "";
  for (let i = 0; i < beats.length; i++) {
    const last = i === beats.length - 1;
    const secPrompt = `${sys}\n【第${n}章《${goal}》·第${vol}卷·情境：${scene}】\n【当前世界大事】${crisis || "暂无"}\n【在场角色及修为】${ros}\n【上文结尾】${prev.slice(-280) || "（本章开篇，承接上一章）"}\n续写本章第${i + 1}/${SECTIONS}段，对应情节：「${beats[i]}」。${weave && i === Math.min(1, SECTIONS - 1) ? `本段须自然落实：${weave}。` : ""}须由上段结果直接引发、承接因果，各角色言行暗合其命格性情。\n${PENMANSHIP}${canonHard ? "\n" + canonHard : ""}${loreBlock ? "\n" + loreBlock : ""}${canonInject ? "\n" + canonInject : ""}${conBlock ? "\n" + conBlock : ""}${evoGuidance ? "\n" + evoGuidance : ""}\n约 ${perSec} 字。${last ? (GENTLE ? "段末以一个安静的画面或一点余味自然收束，不必强留悬念。" : "段末留一个引向下一章的悬念钩子。") : ""}只输出正文，不要写任何章节标题或"第X章"字样。`;
    let sec = "";
    for (let attempt = 0; attempt < 4; attempt++) { // 每段守门: 正常数百字; <120 字多半是 DeepSeek 抽风回退 mock 占位 → 等 15s 重试本段, 扛持续抽风、防部分垃圾混入
      sec = await llm.complete(secPrompt, { thinking: false, temperature: evoGenome.gen.temperature, topP: evoGenome.gen.topP, frequencyPenalty: evoGenome.gen.frequencyPenalty, presencePenalty: evoGenome.gen.presencePenalty }); // 进化基因控制采样
      if (sec.replace(/\s/g, "").length >= 120) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 15000));
    }
    const clean = sec.trim()
      .replace(/^第\s*[零〇一二三四五六七八九十百千两\d]+\s*[\/／]\s*[零〇一二三四五六七八九十百千两\d]+\s*段[：:．.、]?\s*\n*/, "") // 去掉 LLM 抄进正文的「第1/4段：」分段标记(只匹配带/的 prompt 分段格式, 不误伤「第三段路…」类正文)
      .replace(/^(#{1,6}\s*)?第[零〇一二三四五六七八九十百千两\d]+[章回][^\n]*\n+/, "") // 去掉混进正文的章标题行
      .replace(/^#{1,6}\s+[^\n]*\n+/, ""); // 去掉任何残留 markdown 标题行
    text += (text ? "\n\n" : "") + clean;
    prev = sec;
  }
  return { goal, text, hook: beats[beats.length - 1] ?? "" };
}

async function main(): Promise<void> {
  let n = store.listChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-")).length; // 只数标题(不读全量正文)
  if (n === 0) {
    const seeded = PACK.seedWorld({ worldId, packId: PACK.id, seed: "千章长篇", config: {} });
    seeded.props["autoCompose"] = false;
    store.saveSnapshot(db, worldId, seeded, 0, Date.now());
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, Date.now());
  }
  const s0 = store.loadSnapshot(db, worldId);
  let bible = s0 && typeof s0.snapshot.props["bible"] === "string" ? (s0.snapshot.props["bible"] as string) : (process.env["NOVEL_BIBLE"]?.trim() || "青云宗灵根试炼，苏雪(冰)、林焰(火)、玄渊(幽)、白薇(阴脉之谜)四修命数交汇，各入门墙。"); // 新世界(无快照)可经 NOVEL_BIBLE 注入自定义 premise; 已有世界续用快照 bible(不受影响)
  const recent: string[] = [];
  let prevHook = "";
  let evCursor = n > 0 ? store.maxSeq(db, worldId) : 0; // P1-2 resume 安全: 已有章节(重启)则游标设当前 maxSeq(已落盘章对应事件视为已叙述), 免首章把全史兴亡当近时变故重灌 LLM; 新世界(含预演化)从 0 起、首章 in-medias-res 叙述预演化建起的局面。
  let revivals: Array<{ faction: string; at: number }> = [];
  const outlinePlan = loadOutlinePlan(ROOT); // 严格跟纲模式: 有计划则逐章 steer 情节(松散底座模式为 null)
  if (outlinePlan?.beats.length) console.log(`  📑 跟纲模式(${outlinePlan.obedience === "balanced" ? "均衡·软建议、世界可偏离" : "照写·硬遵循"}): ${outlinePlan.beats.length} 段大纲主线`);
  let _wasPaused = false;
  const PAUSE = join(ROOT, "paused"); // 网页暂停开关(存在=暂停)

  // 🌱 世界预演化(C·挑最有戏弧线起笔): scout 临时 db 静默空跑 N tick 探弧线 → sim-fitness+Reagan+可空降性挑最佳弧 → 定 in-medias-res 起笔 tick → 真世界快进到该 tick(同 worldId/seed 确定性复现 scout 前 T tick) → 第 1 章从冲突现场起笔。
  //   step() 在 autoCompose=false 下只推演不落章。scout 在内存 db 看完整弧线(供排序)、不污染真世界; 真世界只快进到起笔点 T(< N), 故不回溯、无风险。研究 .audit/20260604-arc-selection-research/。
  if (n === 0 && WARMUP > 0) {
    console.log(`  🌱 世界预演化(挑弧线起笔): scout 静默推演 ${WARMUP} tick 探最有戏的弧线…`);
    const sdb = openDb(":memory:"); // scout: 内存 db, 同 worldId/seed → 与真世界确定性一致
    const sseed = PACK.seedWorld({ worldId, packId: PACK.id, seed: "千章长篇", config: {} });
    sseed.props["autoCompose"] = false;
    store.saveSnapshot(sdb, worldId, sseed, 0, Date.now());
    store.setSchedulerState(sdb, worldId, { gen: 0, nextTick: 0, status: "running" }, Date.now());
    const warmRefill = (xdb: typeof db, t: number): void => { // 群像稳态补血(scout 与真世界快进共用, 防预演化期人口坍塌; 高位 index 避免与章节期 spawn 撞 id)
      if (t % 5 !== 0 || !PACK.spawnCharacter) return;
      const sp = store.loadSnapshot(xdb, worldId);
      const present = sp ? Object.values(sp.snapshot.characters).filter((c) => c.present).length : 99;
      if (present < 16) { const k = present < 10 ? Math.min(4, 16 - present) : 1; for (let i = 0; i < k; i++) store.enqueueInput(xdb, `warmup-spawn-${t}-${i}`, worldId, "spawn-character", { character: PACK.spawnCharacter("预演化", 2000 + t * 4 + i) }, Date.now()); }
    };
    for (let t = 0; t < WARMUP; t++) { warmRefill(sdb, t); await step(sdb, worldId, PACK, sim); }
    const pick = pickArcStart(store.readEvents(sdb, worldId), GENTLE); // 温情向: 用温情情感弧权重(压暴烈、抬救赎)+放松起笔位置
    const T = Math.max(1, Math.min(pick ? pick.tick : Math.floor(WARMUP / 2), WARMUP - 1));
    arcHint = pick ? (GENTLE
      ? `世界已暗中走过一程、结下些人情旧识。本章从眼下一个寻常而有人情味的当口徐徐写起（读者一翻开就在人情与气息里、不在冲突里），从容入场、不急着交代前情，前事留待后文细补。眼下牵系：${pick.arc.desc}`
      : `世界已暗中发展一段，眼下正值：${pick.arc.desc}。本章 in-medias-res 直接切入这个局面（读者一翻开就在矛盾/张力里），不从头交代，前情留待后文渐补。`) : "";
    console.log(`  🌱 scout 完: ${pick ? `选「${pick.arc.pattern}」"${pick.arc.desc}"(分${pick.score}) → in-medias-res 起笔 tick${T}（峰值 tick${pick.arc.atTick} 是开篇要建向的目标）` : `未筛出弧线 → 取中点 tick${T} 起笔`}`);
    console.log(`  🌱 真世界快进到起笔点 tick${T}…`);
    for (let t = 0; t < T; t++) {
      if (existsSync(PAUSE)) { await new Promise((r) => setTimeout(r, 3000)); t--; continue; }
      warmRefill(db, t);
      await guardedStep();
    }
    console.log(`  🌱 已快进到起笔点 → 第 1 章从此 in-medias-res 起笔`);
  }
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
    heartbeat(); // 刷新单写者锁 mtime(心跳): 让本写者的锁保持"新鲜", 防被误判为陈旧锁接管
    const vol = Math.floor((n - 1) / VOL) + 1;
    const scene = sceneFor(n);
    // 世代更替 + 群像稳态: 每 5 章补血, 维持在场 ~16; 跌破下限 10 → 批量补(防坍塌, 已验证旧世界减员快于补员→塌到 2 人)。turnoverRate 旋钮另在引擎侧调折损节律。
    if (n % 5 === 0 && PACK.spawnCharacter) {
      const sp0 = store.loadSnapshot(db, worldId);
      const present = sp0 ? Object.values(sp0.snapshot.characters).filter((c) => c.present).length : 99;
      const ROSTER_TARGET = 16, FLOOR = 10; // 目标在场人数(勿与模块级 TARGET=章节总目标混淆)
      if (present < ROSTER_TARGET) {
        const nSpawn = present < FLOOR ? Math.min(4, ROSTER_TARGET - present) : 1;
        for (let k = 0; k < nSpawn; k++) store.enqueueInput(db, `spawn-${n}-${k}`, worldId, "spawn-character", { character: PACK.spawnCharacter("长篇", n + k) }, Date.now());
      }
    }
    // T4 临界控制器 + 戏剧导演: 每章在进化 baseline(evoGenome.engine)上做稳态/戏剧干预 → 写 tuning/dramaFocus/dramaHint, 本章步进据此演化
    let dramaHintText = "";
    if (EVOLVE) {
      dramaHintText = await withLock(() => { // 与 step 互斥, 防快速裁决 step 交错覆盖本章 tuning/dramaFocus/simRules
        const spd = store.loadSnapshot(db, worldId);
        if (!spd) return "";
        const dc = dramaControl(store.readRecentEvents(db, worldId, 300), spd.snapshot, loadSimFitness(ROOT), evoGenome.engine, drama, GENTLE); // 只需近窗事件算雪崩密度; GENTLE=温情向: 冷不加注(否则每章顶高 conflictRate 绕过基因锚)
        drama = dc.ctrl; saveDrama(ROOT, drama);
        spd.snapshot.props["tuning"] = { ...dc.tuning };
        spd.snapshot.props["dramaFocus"] = dc.dramaFocus;
        // T5: 把已准入的进化机制注入活世界(保留各机制的 lastFired 冷却态, 防每章重置后狂触发)
        const fileRules = loadSimRules(ROOT).active;
        const cur = Array.isArray(spd.snapshot.props["simRules"]) ? (spd.snapshot.props["simRules"] as Array<{ id: string; lastFired?: number }>) : [];
        const lastById = new Map(cur.map((r) => [r.id, r.lastFired]));
        spd.snapshot.props["simRules"] = fileRules.map((r) => ({ ...r, lastFired: lastById.get(r.id) ?? r.lastFired ?? -99999 }));
        store.saveSnapshot(db, worldId, spd.snapshot, spd.lastSeq, Date.now());
        if (n % 4 === 0) console.log(`  🎭 ${dc.log}`);
        return dc.dramaHint;
      });
    }
    for (let t = 0; t < 3; t++) await guardedStep();

    // 议事·奇门定夺: 作者若宽限期(~3章)内未裁, 由奇门吉凶自动落定(吉/平→依准, 凶→另议); 作者可在窗口内 /api/verdict 抢先裁
    {
      const sp = store.loadSnapshot(db, worldId);
      const pend = sp && Array.isArray(sp.snapshot.props["pendingDecisions"]) ? (sp.snapshot.props["pendingDecisions"] as Array<{ decisionId: string; valence?: number }>) : [];
      const curTick = sp?.snapshot.tick ?? 0;
      const GRACE_TICKS = existsSync(join(ROOT, "autoverdict")) ? 0 : 3 * 3; // 宽限约 3 章(给作者插手窗口); 网页开「全自动裁决」则归零→立即据奇门吉凶自动定夺
      let auto = false;
      for (const p of pend) {
        const m = p.decisionId.match(/t(\d+)$/);
        const age = curTick - (m ? Number(m[1]) : curTick);
        if (age >= GRACE_TICKS) {
          store.enqueueInput(db, `auto-${p.decisionId}`, worldId, "author-verdict", { decisionId: p.decisionId, verdict: (p.valence ?? 0) < -0.2 ? "reject" : "accept" }, Date.now());
          auto = true;
        }
      }
      if (auto) await guardedStep();
    }

    const snap = store.loadSnapshot(db, worldId);
    if (!snap) throw new Error("no snapshot");
    const ros = roster(snap.snapshot);
    canonHard = derivedBlock(deriveCanon(snap.snapshot, tierName)); // 权威硬事实(境界/派系/生死/恩怨)从快照确定性派生, 本章强注入
    const t0 = Date.now();
    const crisisBase = typeof snap.snapshot.props["crisis"] === "string" ? (snap.snapshot.props["crisis"] as string) : "";
    const fr = snap.snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined;
    const facSummary = fr
      ? Object.entries(fr).flatMap(([a, m]) => Object.entries(m).filter(([b]) => a < b).map(([b, v]) => `${a}与${b}${v > 0 ? "结盟" : v < 0 ? "交恶" : "中立"}`)).slice(0, 4).join("；")
      : "";
    // 变故: 自上章以来的陨落/吞并 + 复兴 + 怀复仇者 → 写进本章正文。【仅叙述耦合副作用(evCursor推进/复兴入队出队/伏笔/反思)延后到本章落盘成功后, 守门弃章则这些一概不发生 → 干净重试。注: 世界步进/drama streak 已在上方提交、不随弃章回滚——但 evCursor 未推进, 其新事件下章如实补叙, 无重复计数】
    const newEvs = store.readEventsSince(db, worldId, evCursor); // 增量读(替代全量读再 filter, 治千章 O(N^2))
    const upsets = newEvs.filter((e) => e.kind === "CharacterFell" || e.kind === "FactionDissolved" || e.kind === "VengeanceResolved" || e.kind === "CharacterTranscended").map((e) => e.summary).filter((s): s is string => !!s);
    // 被吞并的派系排期 8 章后复兴; 到期者此处只算"值"(供正文), 真正入队/出队延后到落盘后
    const dueRevivals = PACK.reviveFaction ? revivals.filter((r) => n >= r.at) : [];
    const reviveSpawns: Array<{ faction: string; reviver: CharacterState }> = [];
    const reviveNotes: string[] = [];
    for (const r of dueRevivals) { const reviver = PACK.reviveFaction!(r.faction, n); reviveSpawns.push({ faction: r.faction, reviver }); reviveNotes.push(`${r.faction}残部拥立${reviver.name}、揭竿复兴`); }
    const avengers = Object.values(snap.snapshot.characters)
      .filter((c) => c.present && typeof c.props["avenge"] === "string")
      .map((c) => `${c.name}痛失${String(c.props["avenge"])}、誓复此仇`);
    const upheaval = [...upsets, ...avengers, ...reviveNotes].join("；");
    const qimen = plateLabel(snap.snapshot.tick ?? n * 3);
    const crisis = [crisisBase, `奇门·${qimen}`, facSummary ? `派系格局：${facSummary}` : "", upheaval ? `近时变故：${upheaval}` : "", dramaHintText ? `导演：${dramaHintText}` : ""].filter(Boolean).join(" ｜ ");
    const sig = configSignature();
    if (sig !== llmSig) { llm = makeLLM(); llmSig = sig; console.log(`↻ LLM 已切换为 ${llm.id}`); } // 网页改设置 → 热切换, 无需重启长跑
    // 认知②: 召回在场角色的显著情景记忆 → 章节作前情回响(callback)
    const present = new Set(Object.values(snap.snapshot.characters).filter((c) => c.present).map((c) => c.id));
    const echoes = store.readSalientMemories(db, worldId, 0.6, 6).filter((m) => present.has(m.characterId)).map((m) => m.body);
    const baseEcho = echoes.length ? `${bible}\n【角色近事回响】${echoes.slice(0, 4).join("；")}` : bible;
    // M2 终身记忆: 每角色 persona digest(canon属性+M1心境+恩怨账+执念) + 宿缘旧账, 注入前情 → 角色带一生与恩怨出场(零新 LLM)
    const persona = personaBlock(snap.snapshot, loadCanon(ROOT));
    const shared = recallShared(store.readSalientMemories(db, worldId, 0.6, 40), snap.snapshot);
    const bibleEcho = [baseEcho, persona, shared.length ? "【宿缘·同框者旧账(可点到)】" + shared.slice(0, 3).join("；") : ""].filter(Boolean).join("\n");
    // 叙事·伏笔账: 到期回收 / 每 6 章埋设(开放伏笔 < 3 时), 形成 setup→payoff 跨章结构
    const fsList = readFs();
    let weave = "";
    let paidDue: Foreshadow | undefined; // 落盘成功后才置 paid + writeFs(防守门弃章 → 伏笔假回收 + 灌假 consFit 适应度)
    let plantedF: Foreshadow | undefined;
    const due = fsList.find((f) => !f.paid && f.dueCh <= n);
    if (due) {
      weave = `回收伏笔——给出回应或揭其真相："${due.desc}"`;
      paidDue = due;
      console.log(`  ⟡ 回收伏笔: ${due.desc}`);
    } else if (n % 6 === 0 && fsList.filter((f) => !f.paid).length < 3) {
      const hook = (await llm.complete(`${sys}\n据当前态势构思一个可在 8~14 章后回收的"伏笔"(一桩悬念/隐秘/信物/预言/未了之债，≤24字)，只回伏笔本身：\n世界大事：${crisis}\n在场：${ros.slice(0, 200)}`)).replace(/\s+/g, " ").replace(/[《》「」#]/g, "").slice(0, 30);
      if (hook) {
        plantedF = { id: `fs-${n}`, desc: hook, plantedCh: n, dueCh: n + 8 + (n % 7), paid: false };
        weave = `自然埋下一个伏笔(只露端倪、勿点破)："${hook}"`;
        console.log(`  ⟡ 埋伏笔: ${hook}（第${plantedF.dueCh}章回收）`);
      }
    }
    conBlock = constraintsBlock(loadConstraints(ROOT).active); // 拾取议事已批准的铁律变更(规则层概念空间)
    const ch = await writeChapter(n, vol, scene, crisis, bibleEcho, ros, recent, prevHook, weave, beatForChapter(outlinePlan, n), outlinePlan?.obedience ?? "strict");

    if (ch.text.replace(/\s/g, "").length < MINLEN * 0.4) { // 守门: 疑似 LLM 失败回退占位(正常≥3000字)→ 不落盘、退避重试本章, 不推进(防垃圾入正文/污染进化)
      console.log(`  ⚠ 第${n}章疑似生成失败(仅${ch.text.length}字, 多半 DeepSeek 瞬时故障回退占位)→ 弃, 30s 后重试本章`);
      n--; await new Promise((r) => setTimeout(r, 30000)); continue;
    }
    writeFileSync(join(CH_DIR, `ch-${String(n).padStart(4, "0")}.md`), `# 第${n}章　${ch.goal}\n\n${ch.text}\n`, "utf8");
    store.saveChapter(db, { id: `saga-ch-${n}`, worldId, goal: ch.goal, text: ch.text, status: "inscribed", createdAt: Date.now() });
    // ── 本章落盘成功 → 现在才提交叙述耦合副作用(守门弃章则下面一概未发生 → 干净重试; 修审计「守门 n-- 不回滚 evCursor/复兴/伏笔」)。世界步进已在上方提交但 evCursor 未推进→新事件下章补叙不重复 ──
    for (const e of newEvs) evCursor = Math.max(evCursor, e.seq ?? 0);
    for (const e of newEvs) if (e.kind === "FactionDissolved") { const f = (e.payload as { faction?: string }).faction; if (f) revivals.push({ faction: f, at: n + 8 }); }
    for (const rs of reviveSpawns) store.enqueueInput(db, `revive-${rs.faction}-${n}`, worldId, "spawn-character", { character: rs.reviver }, Date.now());
    revivals = revivals.filter((r) => n < r.at);
    if (paidDue) { paidDue.paid = true; writeFs(fsList); }
    else if (plantedF) { fsList.push(plantedF); writeFs(fsList); }
    // M3 批量异步反思(落盘后跑: 守门弃章不浪费 LLM、不双重累加卷入度)
    if (EVOLVE) {
      try {
        accrueImportance(minds, newEvs, snap.snapshot);
        if (n - minds.lastReflectCh >= 3) {
          const queue = selectQueue(minds, snap.snapshot, minds.force); // force-set 角色即便未破阈也 union 进队(里程碑大事必反思)
          minds.lastFp = minds.lastFp ?? {};
          const fresh: string[] = []; let cachedN = 0;
          const forceSet = new Set(minds.force ?? []); // 大事经历者(复仇/破境/羁绊者陨落)强制反思, 绕过 M4 情境指纹缓存(防漏反思)
          for (const id of queue) { const c = snap.snapshot.characters[id]; if (!c) continue; if (forceSet.has(id) || situationFp(c) !== minds.lastFp[id]) fresh.push(id); else { delete minds.pendingImp[id]; cachedN++; } } // M4: 情境未变且无大事→复用旧心声、不调 LLM
          if (fresh.length) {
            const recentByChar = (c: CharacterState): string =>
              newEvs.filter((e) => (e.payload as { characterId?: string })?.characterId === c.id || (e.summary ?? "").includes(c.name)).map((e) => e.summary).filter((s): s is string => !!s).slice(-2).join("；") || "近来世事牵动";
            const updates = await batchReflect(llm, sys, snap.snapshot, fresh, crisis, recentByChar);
            if (updates.length) {
              store.enqueueInput(db, `mind-${n}`, worldId, "mind-update", { updates }, Date.now());
              for (const id of fresh) { delete minds.pendingImp[id]; const c = snap.snapshot.characters[id]; if (c) minds.lastFp[id] = situationFp(c); } // 反思过即清零 + 记指纹
              minds.lastReflectCh = n;
              console.log(`  🧠 批量反思 ${updates.length} 人(1次LLM${cachedN ? "·缓存复用" + cachedN + "人" : ""}): ${updates.slice(0, 3).map((u) => (snap.snapshot.characters[u.id]?.name ?? u.id) + "「" + u.mind + "」").join(" ")}`);
            }
          } else if (cachedN) minds.lastReflectCh = n;
        }
        saveMinds(ROOT, minds);
      } catch (e) { console.log("  🧠 反思跳过:", String(e).slice(0, 60)); }
    }
    try { // 发 compose 事件 → SSE 点亮「成文」灯 + 触发网页"新章已落"+刷新(长跑此前不发, 故成文灯不亮)
      store.appendEvent(db, { id: `compose:ch${n}:ChapterInscribed`, worldId, lineId: "main", tick: n * 3, kind: "ChapterInscribed", subsystem: "compose", severity: "notable", verb: "成文", subject: ch.goal, summary: `第${n}章《${ch.goal}》落成`, payload: { kind: "ChapterInscribed", chapterId: `saga-ch-${n}`, sceneIds: [] }, ts: Date.now() });
    } catch { /* 灯轨非关键, 失败不影响写章 */ }
    recent.push(`第${n}章「${ch.goal}」`);
    prevHook = ch.hook;

    if (n % 8 === 0) { // 一致性: 更新设定档 canon + 校验矛盾, 喂生成(修正)与适应度(canonStep 先于 evolveOnce)
      try {
        const rcc = store.readRecentChapters(db, worldId, 8).map((c) => ({ goal: c.goal, text: c.text }));
        const cs = await canonStep(llm, sys, ROOT, rcc, n, derivedFacts(deriveCanon(snap.snapshot, tierName))); // 传引擎权威硬事实, 一致性校验据此判 prose 对错(不再让 LLM 自抽境界)

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
          const recentCh = store.readRecentChapters(db, worldId, 48).map((c) => ({ goal: c.goal, text: c.text })); // 近 48 章(novelty 对照窗口; 不再读全量千章正文)
          // 模拟层 fitness: 先算好存盘(evolveOnce 会读它折进基因适应度; server 读出来画曲线)
          const spf = store.loadSnapshot(db, worldId);
          if (spf) {
            const sf = computeSimFitness(store.readRecentEvents(db, worldId, 800), spf.snapshot, recentCh, vol, n); // 近 800 事件(recency 加权下足够; sift/张力按近窗算)
            saveSimFitness(ROOT, sf);
            console.log(`  🌍 模拟层${sf.total}/10 · 故事链${sf.sift.score}(${sf.sift.chains}条:${Object.entries(sf.sift.patterns).map(([k, v]) => k + v).join(",")}) · 派系张力${sf.tension.score}(势均${sf.tension.balance}/交锋${sf.tension.directness}/化解${sf.tension.resolution}) · 新颖${(sf.novelty * 10).toFixed(1)}${sf.sift.dangling.length ? " · 悬而未决:" + sf.sift.dangling.length : ""}`);
          }
          const evo = await evolveOnce(llm, sys, ROOT, vol, recentCh.slice(-8));
          evoGenome = evo.genome; evoGuidance = evo.guidance; // 下一卷据此生成
          console.log(`  🧬 ${evo.report}`);
        } catch (e) { console.log("  🧬 进化跳过:", String(e).slice(0, 80)); }
      }
      // T5 模拟器自创机制: 每 16 章让 LLM 提议一条全新世界机制 → 静态/新颖/影子模拟三闸 → 过则注入活世界(模拟器自己长出新玩法)
      if (EVOLVE && n % 16 === 0) {
        try {
          const sps = store.loadSnapshot(db, worldId);
          if (sps) { const out = await evolveSimRules(llm, sys, ROOT, sps.snapshot, PACK, recent.slice(-6).join("；"), vol); console.log(`  🧪 ${out.report}`); }
        } catch (e) { console.log("  🧪 机制提议跳过:", String(e).slice(0, 80)); }
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
      await withLock(() => { // 与 step 互斥, 防 bible 写覆盖快速裁决 step 的世界推进
        const s = store.loadSnapshot(db, worldId);
        if (s) { s.snapshot.props["bible"] = bible; store.saveSnapshot(db, worldId, s.snapshot, s.lastSeq, Date.now()); } // tuning 改由 T4 控制器每章写
      });
    }
    console.log(`第 ${n}/${TARGET} 章　《${ch.goal}》　${ch.text.length}字　(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`\n完成 ${TARGET} 章 → ${CH_DIR}`);
}

main().catch((e: unknown) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
