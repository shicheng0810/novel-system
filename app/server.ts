// app/server.ts — M5 最小可用服务器(composition root)。node 原生 http, 无新依赖。
// 后台 daemon 跑常驻世界 → SSE 事件流; 网页可看世界运行/读章节/对决策裁决。
// 非三层皮完整设计(那是迭代 UI 工作), 但功能闭环: 看得到世界在跑 + 作者裁决真影响正史。
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, renameSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "../core/services/db";
import { makeLLM, readLLMConfig, writeLLMConfig, llmStatus, type LLMConfig } from "./llm-factory";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import { PACK, describeMind, natalLabel, plateLabel } from "./pack-select";
import { generateWorldConfig } from "./world-gen";
import { generateOutlinePlan, saveOutlinePlan, loadOutlinePlan, generateGentleArcPlan, deriveArcFromPremise } from "./outline-plan";
import { normalizeLore, saveLore } from "./lore-lib";
import { loadGenome, loadLedger, loadArchive, loadGlobal } from "./evolve";
import { loadConstraints, applyConstraintVerdict } from "./constraints";
import { loadCanon } from "./canon";
import { loadSimFitness, loadSimHistory } from "./sim-fitness";
import { loadSimRules } from "./sim-rules";
import { loadDrama } from "./drama";

const PORT = Number(process.env["PORT"] ?? 8990);
const here = dirname(fileURLToPath(import.meta.url));
const STANDBY = process.env["NOVEL_STANDBY"] === "1"; // 待机模式: 不跑默认世界, 等网页「定义你的世界」后再 spawn 写者
const viewSaga = process.env["NOVEL_VIEW"] === "saga" || STANDBY; // 看长跑(只读)或待机; 否则跑自带 demo 世界
const SAGA = process.env["NOVEL_SAGA_DIR"] ?? "saga";
const worldId = viewSaga ? "saga" : "live";
if (viewSaga) { try { mkdirSync(join(here, "..", ".novel-output", SAGA), { recursive: true }); } catch { /* 目录可建即可 */ } } // 待机/看长跑: 确保世界目录在, openDb 不炸
const db = viewSaga ? openDb(join(here, "..", ".novel-output", SAGA, "world.db")) : openDb(":memory:");
const pack = PACK;
let defining = false; // 待机→「定义中/起跑中」标志: spawn 写者后置 true, 网页据此显示「世界生成中」直到首章落盘
let definingSince = 0; // P1-4: 置 defining=true 的时刻, 供 /api/standby 在写者撞锁自爆时及时复位(不靠客户端 6 分钟超时)

// 温情判定[P0-a]: 建世界请求显式 style 参数优先, 否则 premise/bible 关键词命中 → "温润"。server 据此写 cfg.style, 不污染 LLM SPEC。
function isGentleRequest(p: { style?: string; prompt?: string }, cfg: { bible?: string }): boolean {
  if (p.style) return p.style === "温润";
  const t = `${p.prompt ?? ""} ${cfg.bible ?? ""}`;
  return /温情|治愈|启发|日常|烟火|寻常|相望相渡|微光|慢|淡/.test(t);
}

// provider 由 llm-factory 据网页设置/环境变量装配(网页 /api/settings 可改)
const llm = makeLLM();

if (!viewSaga) {
  const ts0 = Date.now();
  store.saveSnapshot(db, worldId, pack.seedWorld({ worldId, packId: pack.id, seed: "live-seed", config: {} }), 0, ts0);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, ts0);
}

// 世事流转解说(诉求②): 把世界事件渲染成一句中文给用户看。零 LLM——纯读事件已有的 summary/payload + 模板。
// 与 gentle-emergence(写者侧, 渲染进正文 prompt)同思路、不同去向(此处进网页 DOM, 温情/爽文都跑)。
let _tierMap: Record<string, string> | null = null;
function tierName(tid: string): string { // tier id(t0..t7) → 境界名。优先读世界自身配置 tierNames(写者权威源); 观察器 pack 可能是默认题材(无 NOVEL_WORLD_CONFIG 时)故不优先信它。
  if (!_tierMap) {
    _tierMap = {};
    try { // 世界配置 tierNames 数组按序对应 t0..tN
      const cfgP = join(OUT, "worlds", `${SAGA}.json`);
      if (existsSync(cfgP)) { const tn = (JSON.parse(readFileSync(cfgP, "utf8")) as { tierNames?: string[] }).tierNames; if (Array.isArray(tn)) tn.forEach((nm, i) => { _tierMap![`t${i}`] = nm; }); }
    } catch { /* ignore */ }
    if (Object.keys(_tierMap).length === 0) { try { for (const t of pack.progression.tiers) _tierMap[t.id] = t.name; } catch { /* ignore */ } } // 回退 pack
  }
  return _tierMap[tid] ?? tid;
}
function narrate(e: { kind: string; summary?: string; payload?: unknown }, nameOf: (id: string) => string): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const s = (k: string): string => String(p[k] ?? "");
  switch (e.kind) {
    // summary 已是好中文(登场·/出局·/并吞·/分立·/归隐·/风云·/落定·)的, 直接用
    case "ChapterInscribed":     // 「第N章《X》落成」
    case "StoryEventTriggered":  // 「风云·X」世界大事
    case "CharacterEntered":     // 「登场·X（派）」
    case "CharacterFell":        // 「出局·X — 因」
    case "CharacterTranscended": // 「归隐·X 登顶、功成身退」
    case "FactionDissolved":     // 「并吞·X一脉为Y所并」
    case "FactionSplit":         // 「分立·X另开Y」
    case "StageCommitted":       // 「落定·X与Y结善/道争/移动」世界社交动静(实时感来源)
      return e.summary || null;
    // 这两条 summary 含原始 id/tier 码, 润色成名字+境界名
    case "ProgressionAdvanced":
      return `晋阶 · ${nameOf(s("characterId"))} ${tierName(s("fromTier"))}→${tierName(s("toTier"))}`;
    case "VengeanceResolved":
      return `了断 · ${nameOf(s("characterId"))}为${s("avenged")}${s("outcome") ? "，" + s("outcome") : ""}`;
    case "DecisionRequired":
      return `⌜待裁⌟ ${String(p["summary"] ?? e.summary ?? "一桩抉择")} · 右栏「议事」定夺`;
    case "AuthorRuled":
      return `议事已裁 · ${p["verdict"] === "accept" ? "依准" : p["verdict"] === "reject" ? "另议" : s("verdict")}`;
    default:
      return null; // 噪声不进解说区: MemoryRecorded/RunStarted/RunCompleted/GateEvaluated/FrameDerived/DirectorPlanned/CandidatesScored/AgentThought/Branch*
  }
}

const sseClients = new Set<ServerResponse>();
let lastSeqBroadcast = 0;
function broadcastNew(): void {
  const evs = store.readEvents(db, worldId).filter((e) => (e.seq ?? 0) > lastSeqBroadcast);
  if (evs.length === 0) return;
  const chars = store.loadSnapshot(db, worldId)?.snapshot.characters ?? {}; // id→名 解析(每批一次, 仅有新事件时)
  const nameOf = (id: string): string => chars[id]?.name ?? id;
  for (const e of evs) {
    lastSeqBroadcast = Math.max(lastSeqBroadcast, e.seq ?? 0);
    const line = `data: ${JSON.stringify({ tick: e.tick, subsystem: e.subsystem, severity: e.severity, verb: e.verb, summary: e.summary, kind: e.kind, narration: narrate(e, nameOf) })}\n\n`;
    for (const c of sseClients) c.write(line);
  }
}

let running = true;
const TICKS = Number(process.env["NOVEL_LIVE_TICKS"] ?? 120);
async function daemon(): Promise<void> {
  for (let i = 0; i < TICKS && running; i++) {
    try {
      await step(db, worldId, pack, llm);
      broadcastNew();
    } catch (e: unknown) {
      console.error("tick error:", String(e).slice(0, 200));
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
}
if (viewSaga) {
  setInterval(broadcastNew, 1500); // 只读模式: 轮询长跑进程写入的新事件并推送
} else {
  void daemon();
}

function json(res: ServerResponse, data: unknown): void {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

// 多世界注册表(网页"新建世界"用): 每个世界一行 {name, displayName, port, prompt}
const OUT = join(here, "..", ".novel-output");
const REG = join(OUT, "worlds-registry.json");
interface WorldEntry { name: string; displayName: string; port: number; prompt: string }
function readReg(): WorldEntry[] {
  try {
    return existsSync(REG) ? (JSON.parse(readFileSync(REG, "utf8")) as WorldEntry[]) : [];
  } catch {
    return [];
  }
}
function writeReg(r: WorldEntry[]): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(REG, JSON.stringify(r, null, 2), "utf8");
}
function chapterCount(name: string): number {
  try {
    const d = join(OUT, name, "chapters");
    return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".md")).length : 0;
  } catch {
    return 0;
  }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? "/";
  if (url === "/") {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(readFileSync(join(here, "web", "index.html"), "utf8"));
    return;
  }
  if (url === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": connected\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  if (url === "/api/snapshot") return json(res, store.loadSnapshot(db, worldId)?.snapshot ?? null);
  if (url === "/api/minds") {
    const snap = store.loadSnapshot(db, worldId)?.snapshot;
    if (!snap) return json(res, { thoughts: {}, crisis: "" });
    const thoughts: Record<string, string> = {};
    for (const c of Object.values(snap.characters)) if (c.present) thoughts[c.id] = describeMind(c, snap);
    const crisis = typeof snap.props["crisis"] === "string" ? (snap.props["crisis"] as string).split(" ｜ ")[0] : "";
    return json(res, { thoughts, crisis });
  }
  if (url === "/api/chapters") return json(res, store.listChapters(db, worldId));
  if (url.startsWith("/api/chapter?")) {
    const id = new URLSearchParams(url.split("?")[1] ?? "").get("id") ?? "";
    return json(res, store.getChapter(db, worldId, id));
  }
  if (url.startsWith("/api/export")) { // 导出全本小说: 拼标题+逐章正文 → 浏览器下载(txt 通用 / md 带结构)
    const fmt = new URLSearchParams(url.split("?")[1] ?? "").get("fmt") === "md" ? "md" : "txt";
    const chs = store.readChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-"));
    let title = SAGA;
    try { const cfgP = join(OUT, "worlds", `${SAGA}.json`); if (existsSync(cfgP)) { const dn = (JSON.parse(readFileSync(cfgP, "utf8")) as { displayName?: string }).displayName; if (dn) title = dn; } } catch { /* fallback below */ }
    if (title === SAGA) { try { const bible = store.loadSnapshot(db, worldId)?.snapshot.props["bible"]; if (typeof bible === "string" && bible) title = bible.slice(0, 20); } catch { /* keep SAGA */ } }
    const doc = fmt === "md"
      ? `# ${title}\n\n` + chs.map((c, i) => `## 第${i + 1}章　${c.goal}\n\n${c.text}`).join("\n\n")
      : `${title}\n\n` + chs.map((c, i) => `第${i + 1}章　${c.goal}\n\n${c.text}`).join("\n\n\n");
    res.statusCode = 200;
    res.setHeader("Content-Type", `${fmt === "md" ? "text/markdown" : "text/plain"}; charset=utf-8`);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(title + "." + fmt)}`);
    return res.end(doc);
  }
  if (url.startsWith("/api/mind?")) {
    if (process.env["NOVEL_LIVE_VOICE"] !== "1") return json(res, { disabled: true }); // 默认关: LLM 实时心声=按悬停时长无界烧 token、纯 UI 装饰(不进正文/记忆/进化)。设 NOVEL_LIVE_VOICE=1 复原 demo。悬停仍有 describeMind 符号「所思」。
    const id = new URLSearchParams(url.split("?")[1] ?? "").get("id") ?? "";
    const snap = store.loadSnapshot(db, worldId)?.snapshot;
    const c = snap?.characters[id];
    if (!snap || !c) return json(res, { error: "无此人" });
    const locName = snap.locations[c.locationId ?? ""]?.name ?? "某处";
    const crisis = typeof snap.props["crisis"] === "string" ? (snap.props["crisis"] as string).split(" ｜ ")[0] : "";
    const qm = plateLabel(typeof snap.tick === "number" ? snap.tick : 0);
    const stress = c.narrativeStress > 0.7 ? "心绪如焚" : c.narrativeStress > 0.4 ? "心潮起伏" : "心境澄澈";
    const prompt = `修仙世界·窥角色心声。「${c.name}」（${natalLabel(c)}），此刻在${locName}，${stress}。世道：${crisis || "暂无大事"}。天机：${qm}。\n以第一人称写${c.name}此刻一闪而过的心声，仅 1 句、不超过 22 字，须合其命格性情与处境，文风古雅，不得出现"命格/八字/奇门"等术语。只输出这一句。`;
    llm
      .complete(prompt, { thinking: false, temperature: 1.3, frequencyPenalty: 0.3, presencePenalty: 0.2 })
      .then((v) => json(res, { id, voice: v.replace(/\s+/g, " ").replace(/^["「“]+|["」”]+$/g, "").slice(0, 30) }))
      .catch((e: unknown) => json(res, { error: String(e).slice(0, 80) }));
    return;
  }
  if (url.startsWith("/api/dialogue?")) {
    if (process.env["NOVEL_LIVE_VOICE"] !== "1") return json(res, { disabled: true }); // 默认关: LLM 实时对话=按对话框开启时长无界烧 token、纯 UI 装饰。设 NOVEL_LIVE_VOICE=1 复原 demo。
    const q = new URLSearchParams(url.split("?")[1] ?? "");
    const aid = q.get("a") ?? "", bid = q.get("b") ?? "", prev = (q.get("prev") ?? "").slice(0, 420);
    const snap = store.loadSnapshot(db, worldId)?.snapshot;
    const A = snap?.characters[aid], B = snap?.characters[bid];
    if (!snap || !A || !B) return json(res, { error: "角色不在场" });
    const bond = typeof A.props[`bond:${bid}`] === "number" ? (A.props[`bond:${bid}`] as number) : 0;
    const rel = bond > 1 ? "交厚之谊" : bond > 0 ? "略有交善" : bond < -1 ? "积怨道争" : bond < 0 ? "略有龃龉" : "萍水相逢";
    const locName = snap.locations[A.locationId ?? ""]?.name ?? "某处";
    const crisis = typeof snap.props["crisis"] === "string" ? (snap.props["crisis"] as string).split(" ｜ ")[0] : "";
    const qm = plateLabel(typeof snap.tick === "number" ? snap.tick : 0); // 当前奇门局, 让对话随天机流转
    const base = `修仙世界·偷听对话。甲：${A.name}（${natalLabel(A)}）。乙：${B.name}（${natalLabel(B)}）。关系：${rel}。同在${locName}。世道：${crisis || "暂无大事"}。天机：${qm}。`;
    const prompt = prev
      ? `${base}\n前文：\n${prev}\n承接前文、续写二人接下来你来我往的 2~3 句(须反映各自命格性情与关系，并暗合此刻天机/世道；若关系或时局有变，话锋随之变，不得复读前文)。每句「名：……」，只输出新增对话。`
      : `${base}\n写二人此刻对话的开篇，3~4 句，须各合命格性情与关系(交善则温、道争则锋)，文风古雅。每句「名：……」，只输出对话。`;
    llm
      .complete(prompt, { thinking: false, temperature: 1.3, frequencyPenalty: 0.3, presencePenalty: 0.2 })
      .then((text) => json(res, { a: A.name, b: B.name, rel, text: text.trim() }))
      .catch((e: unknown) => json(res, { error: String(e).slice(0, 120) }));
    return;
  }
  if (url === "/api/packmeta") return json(res, { tiers: Object.fromEntries(pack.progression.tiers.map((t) => [t.id, t.name])) });
  if (url === "/api/foreshadows") {
    try {
      const fp = join(here, "..", ".novel-output", SAGA, "foreshadows.json");
      return json(res, existsSync(fp) ? JSON.parse(readFileSync(fp, "utf8")) : []);
    } catch {
      return json(res, []);
    }
  }
  if (url === "/api/evolution") {
    try {
      const dir = join(here, "..", ".novel-output", SAGA);
      const l = loadLedger(dir);
      const cn = loadCanon(dir);
      const sf = loadSimFitness(dir); // 模拟层(世界本身)自进化
      const sr = loadSimRules(dir);
      return json(res, { genome: loadGenome(dir), archive: loadArchive(dir), scores: l.scores, avoid: l.avoid.map((a) => a.p), amplify: l.amplify, directives: l.directives, global: loadGlobal(dir), canon: { characters: cn.characters, world: cn.world, consistency: cn.lastConsistency, foreshadow: cn.lastForeshadow, contradictions: cn.lastContradictions },
        sim: sf ? { total: sf.total, sift: sf.sift, tension: sf.tension, novelty: sf.novelty, history: loadSimHistory(dir).history, rules: sr.active.map((r) => ({ name: r.name, trigger: r.trigger, summary: r.event.summary, rationale: r.rationale })), rulesRejected: sr.rejected.slice(-5), drama: loadDrama(dir) } : null });
    } catch {
      return json(res, { genome: null, archive: [], scores: [] });
    }
  }
  if (url === "/api/constraint") { // 规则层: 查世界铁律+待裁提案 / 裁决铁律变异(双层进化的议事闸门)
    const dir = join(here, "..", ".novel-output", SAGA);
    if (req.method === "POST") {
      let body = "";
      req.on("data", (d: Buffer) => (body += d.toString()));
      req.on("end", () => {
        try {
          const p = JSON.parse(body || "{}") as { verdict?: string };
          const c = applyConstraintVerdict(dir, p.verdict === "approve" ? "approve" : "reject", chapterCount(SAGA));
          json(res, { ok: true, active: c.active, pending: c.pending ?? null, generation: c.generation });
        } catch (e: unknown) { res.statusCode = 400; json(res, { error: String(e) }); }
      });
      return;
    }
    const c = loadConstraints(dir);
    return json(res, { active: c.active, pending: c.pending ?? null, generation: c.generation, history: c.history.slice(-5) });
  }
  if (url === "/api/pause") { // 暂停/继续该世界(写者 longrun 轮询此文件)
    const dir = join(here, "..", ".novel-output", SAGA);
    const pf = join(dir, "paused");
    if (req.method === "POST") { try { if (existsSync(pf)) unlinkSync(pf); else writeFileSync(pf, String(Date.now()), "utf8"); } catch { /* ignore */ } }
    let alive = false; try { const lf = join(dir, "longrun.lock"); if (existsSync(lf)) { const pid = Number(readFileSync(lf, "utf8").trim()); process.kill(pid, 0); alive = pid > 0; } } catch { alive = false; }
    return json(res, { paused: existsSync(pf), alive });
  }
  if (url === "/api/autoverdict") { // 全自动裁决开关(默认开: longrun 默认 GRACE=0、议事立即据奇门定夺。作者关闭 = 建 manualverdict 文件 → 恢复约3章宽限请作者亲裁; 写者每章轮询此文件)
    const dir = join(here, "..", ".novel-output", SAGA);
    const mf = join(dir, "manualverdict"); // 存在=作者要亲自参与裁决(关自动); 不存在=默认全自动(作者后参与)
    if (req.method === "POST") { try { if (existsSync(mf)) unlinkSync(mf); else writeFileSync(mf, String(Date.now()), "utf8"); } catch { /* ignore */ } }
    return json(res, { auto: !existsSync(mf) }); // 前端 {auto} 语义不变: 默认 true(全自动开)
  }
  if (url === "/api/standby") { // 待机状态 + 当前世界用的模式(涌现/均衡/照写): 网页据此显示落地页或模式标
    const has = chapterCount(SAGA) > 0; // 待机落地页停留到「首章落定」才切走(预演化/生成期都显示「世界生成中」)
    // P1-4: 定义中且超 25s 宽限(写者启动+建锁足够)、longrun.lock 无活进程 → 写者撞锁/自爆, 复位 defining, 免待机页黑洞至客户端 6 分钟超时
    if (defining && !has && Date.now() - definingSince > 25000) {
      let writerAlive = false;
      try { const lf = join(here, "..", ".novel-output", SAGA, "longrun.lock"); if (existsSync(lf)) { const pid = Number(readFileSync(lf, "utf8").trim()); if (pid > 0) { process.kill(pid, 0); writerAlive = true; } } } catch { writerAlive = false; }
      if (!writerAlive) defining = false;
    }
    const plan = loadOutlinePlan(join(here, "..", ".novel-output", SAGA));
    const mode = !plan ? "emergent" : plan.obedience === "balanced" ? "balanced" : "strict"; // 无大纲计划=涌现; 有则按 obedience(缺省 strict)
    return json(res, { standby: STANDBY, hasWorld: has, defining, mode });
  }
  if (url === "/api/define-world" && req.method === "POST") { // 待机世界被定义: 生成配置(+跟纲计划) → spawn 写者本目录 → 首章落盘后网页自动从待机切正常
    let body = "";
    req.on("data", (d: Buffer) => (body += d.toString()));
    req.on("end", () => {
      void (async () => {
        try {
          const p = JSON.parse(body || "{}") as { prompt?: string; outline?: string; outlineMode?: string; rules?: string; protagonists?: string; warmup?: number; style?: string; lifeArc?: string };
          const basePrompt = (p.prompt || "").trim() || ((p.outline || "").trim().split("\n").find((l) => l.trim()) || "").slice(0, 120);
          if (!basePrompt) { res.statusCode = 400; return json(res, { error: "缺少世界描述或大纲" }); }
          const warmup = typeof p.warmup === "number" ? Math.max(0, Math.min(200, Math.floor(p.warmup))) : 0; // 预演化 tick(0=快起笔)
          defining = true; definingSince = Date.now();
          const cfg = await generateWorldConfig(basePrompt, llm, p.outline, { rules: p.rules, protagonists: p.protagonists });
          (cfg as { style?: string }).style = isGentleRequest(p, cfg as { bible?: string }) ? "温润" : "爽文"; // [P0-a] server 附加, 非 LLM 产出
          const cfgStyle = (cfg as { style?: string }).style;
          const cfgPath = join(OUT, "worlds", `${SAGA}.json`);
          mkdirSync(dirname(cfgPath), { recursive: true });
          writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
          const WDIR = join(here, "..", ".novel-output", SAGA);
          if ((p.outlineMode === "balanced" || p.outlineMode === "strict") && p.outline && p.outline.trim()) {
            try { const plan = await generateOutlinePlan(p.outline, llm, 1000); plan.obedience = p.outlineMode; if (plan.beats.length) saveOutlinePlan(WDIR, plan); } catch { /* 退化涌现, 不阻断 */ }
          }
          // [T1-3] 温情世界且无成品大纲 → 自动派生 balanced/soft「人生阶段」软脊梁(退化纯涌现不阻断)
          else if (cfgStyle === "温润" && !loadOutlinePlan(WDIR)) {
            try {
              const premise = String((cfg as { bible?: unknown }).bible ?? "");
              const arcSeed = (p.lifeArc?.trim()) || await deriveArcFromPremise(premise, llm); // 删 cfg.lifeArc[批评三]
              const plan = await generateGentleArcPlan(premise, arcSeed, llm, 1000);
              if (plan.beats.length) saveOutlinePlan(WDIR, plan);
            } catch { /* 退化纯涌现, 不阻断 */ }
          }
          try { const lore = normalizeLore((cfg as { lore?: unknown }).lore); if (lore.entries.length) saveLore(join(here, "..", ".novel-output", SAGA), lore); } catch { /* lore 非关键 */ }
          const child = spawn("npx", ["tsx", "app/longrun.ts"], { cwd: join(here, ".."), env: { ...process.env, NOVEL_PACK: "freeform", NOVEL_WORLD_CONFIG: cfgPath, NOVEL_SAGA_DIR: SAGA, NOVEL_STANDBY: "0", NOVEL_TARGET: "1000", NOVEL_SECTIONS: "4", NOVEL_WARMUP: String(warmup), NOVEL_STYLE: cfgStyle === "温润" ? "温润" : "" }, detached: true, stdio: "ignore" }); // [P0-b] NOVEL_STYLE 由 cfg 同源
          child.on("error", () => { defining = false; }); // spawn 失败(npx/tsx 起不来)→ 复位标志, 防网页永卡「世界生成中」(客户端另有超时兜底)
          child.unref();
          json(res, { ok: true, displayName: String((cfg as { displayName?: unknown }).displayName ?? SAGA) });
        } catch (e: unknown) { defining = false; res.statusCode = 500; json(res, { error: String(e).slice(0, 150) }); }
      })();
    });
    return;
  }
  if (url === "/api/kill" && req.method === "POST") { // 终止该世界写者(读锁文件 PID, SIGKILL)。已写章节保留, server 不停可继续看。
    const lf = join(here, "..", ".novel-output", SAGA, "longrun.lock");
    let killed = false, pid = 0;
    try { if (existsSync(lf)) { pid = Number(readFileSync(lf, "utf8").trim()); if (pid > 0) { process.kill(pid, "SIGKILL"); killed = true; } } } catch { killed = false; }
    return json(res, { killed, pid });
  }
  if (url === "/api/delete" && req.method === "POST") { // 彻底删除本世界: 杀写者 + 归档数据目录(可逆) + 移出注册表, 之后 server 自停。
    const dir = join(here, "..", ".novel-output", SAGA);
    let killed = false, pid = 0, archived = "";
    try { const lf = join(dir, "longrun.lock"); if (existsSync(lf)) { pid = Number(readFileSync(lf, "utf8").trim()); if (pid > 0) { process.kill(pid, "SIGKILL"); killed = true; } } } catch { /* ignore */ }
    try { if (existsSync(dir)) { archived = `${dir}-killed-${Date.now()}`; renameSync(dir, archived); } } catch { /* ignore */ }
    try { writeFileSync(REG, JSON.stringify(readReg().filter((w: { name?: string }) => w.name !== SAGA), null, 2), "utf8"); } catch { /* ignore */ }
    json(res, { deleted: true, killed, pid, archived: archived.split("/").pop() ?? "" });
    setTimeout(() => process.exit(0), 800); // 数据已移走, 本 server 无法再服务该世界
    return;
  }
  if (url === "/api/worlds") return json(res, readReg().map((w) => ({ ...w, chapters: chapterCount(w.name) })));
  if (url === "/api/worlds/create" && req.method === "POST") {
    let body = "";
    req.on("data", (d: Buffer) => (body += d.toString()));
    req.on("end", () => {
      void (async () => {
        try {
          const p = JSON.parse(body || "{}") as { prompt?: string; name?: string; outline?: string; outlineMode?: string; rules?: string; protagonists?: string; warmup?: number; style?: string; lifeArc?: string };
          const basePrompt = (p.prompt || "").trim() || ((p.outline || "").trim().split("\n").find((l) => l.trim()) || "").slice(0, 120);
          if (!basePrompt) {
            res.statusCode = 400;
            return json(res, { error: "缺少世界描述或大纲" });
          }
          const reg = readReg();
          const safe = (p.name || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || `world-${reg.length + 1}`;
          if (reg.some((w) => w.name === safe)) {
            res.statusCode = 409;
            return json(res, { error: "同名世界已存在" });
          }
          const port = 9000 + reg.length;
          const cfg = await generateWorldConfig(basePrompt, llm, p.outline, { rules: p.rules, protagonists: p.protagonists }); // ← LLM 据提示词(+大纲+体系/主角槽位)生成世界配置
          (cfg as { style?: string }).style = isGentleRequest(p, cfg as { bible?: string }) ? "温润" : "爽文"; // [P0-a] server 附加, 非 LLM 产出
          const cfgStyle = (cfg as { style?: string }).style;
          const cfgPath = join(OUT, "worlds", `${safe}.json`);
          mkdirSync(dirname(cfgPath), { recursive: true });
          writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
          const wdir = join(OUT, safe); mkdirSync(wdir, { recursive: true });
          // 严格跟纲模式: 解析大纲 → 章节节拍主线, 落到世界目录, longrun 读到则逐章跟纲(松散底座模式不生成)
          if ((p.outlineMode === "balanced" || p.outlineMode === "strict") && p.outline && p.outline.trim()) {
            try { const plan = await generateOutlinePlan(p.outline, llm, 1000); plan.obedience = p.outlineMode; if (plan.beats.length) saveOutlinePlan(wdir, plan); } catch { /* 跟纲计划失败 → 退化涌现, 不阻断 */ }
          }
          // [T1-3] 温情世界且无成品大纲 → 自动派生 balanced/soft「人生阶段」软脊梁(退化纯涌现不阻断)
          else if (cfgStyle === "温润" && !loadOutlinePlan(wdir)) {
            try {
              const premise = String((cfg as { bible?: unknown }).bible ?? "");
              const arcSeed = (p.lifeArc?.trim()) || await deriveArcFromPremise(premise, llm); // 删 cfg.lifeArc[批评三]
              const plan = await generateGentleArcPlan(premise, arcSeed, llm, 1000);
              if (plan.beats.length) saveOutlinePlan(wdir, plan);
            } catch { /* 退化纯涌现, 不阻断 */ }
          }
          try { const lore = normalizeLore((cfg as { lore?: unknown }).lore); if (lore.entries.length) saveLore(wdir, lore); } catch { /* lore 非关键 */ }
          const root = join(here, "..");
          const baseEnv = { ...process.env, NOVEL_PACK: "freeform", NOVEL_WORLD_CONFIG: cfgPath, NOVEL_SAGA_DIR: safe, NOVEL_TARGET: "1000", NOVEL_SECTIONS: "4", NOVEL_WARMUP: String(typeof p.warmup === "number" ? Math.max(0, Math.min(200, Math.floor(p.warmup))) : 0), NOVEL_STYLE: cfgStyle === "温润" ? "温润" : "" }; // [P0-b] NOVEL_STYLE 由 cfg 同源(观察器 server 继承 ...baseEnv 自动带上)
          spawn("npx", ["tsx", "app/longrun.ts"], { cwd: root, env: baseEnv, detached: true, stdio: "ignore" }).unref(); // 起长跑
          spawn("npx", ["tsx", "app/server.ts"], { cwd: root, env: { ...baseEnv, NOVEL_VIEW: "saga", PORT: String(port) }, detached: true, stdio: "ignore" }).unref(); // 起观察器
          const entry: WorldEntry = { name: safe, displayName: String((cfg as { displayName?: unknown }).displayName ?? safe), port, prompt: basePrompt };
          reg.push(entry);
          writeReg(reg);
          json(res, { ok: true, ...entry, url: `http://127.0.0.1:${port}` });
        } catch (e: unknown) {
          res.statusCode = 500;
          json(res, { error: String(e).slice(0, 150) });
        }
      })();
    });
    return;
  }
  if (url === "/api/settings" && req.method === "GET") return json(res, llmStatus());
  if (url === "/api/settings" && req.method === "POST") {
    let body = "";
    req.on("data", (d: Buffer) => (body += d.toString()));
    req.on("end", () => {
      try {
        const p = JSON.parse(body || "{}") as Partial<LLMConfig>;
        const cur = readLLMConfig();
        const next: LLMConfig = {
          provider: (p.provider as LLMConfig["provider"]) ?? cur.provider,
          model: p.model ?? cur.model,
          deepseekKey: p.deepseekKey && p.deepseekKey.length > 0 ? p.deepseekKey : cur.deepseekKey, // 空则保留原 key
          deepseekBaseUrl: cur.deepseekBaseUrl,
          temperature: typeof p.temperature === "number" ? p.temperature : cur.temperature,
          thinking: typeof p.thinking === "boolean" ? p.thinking : cur.thinking,
        };
        writeLLMConfig(next);
        json(res, { ok: true, status: llmStatus(next) });
      } catch (e: unknown) {
        res.statusCode = 400;
        json(res, { error: String(e) });
      }
    });
    return;
  }
  if (url === "/api/decisions") {
    const snap = store.loadSnapshot(db, worldId)?.snapshot;
    const pend = snap && Array.isArray(snap.props["pendingDecisions"]) ? snap.props["pendingDecisions"] : [];
    return json(res, pend);
  }
  if (url === "/api/verdict" && req.method === "POST") {
    let body = "";
    req.on("data", (d: Buffer) => (body += d.toString()));
    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}") as { decisionId?: string; verdict?: string };
        store.enqueueInput(db, `v-${parsed.decisionId}-${Date.now()}`, worldId, "author-verdict", { decisionId: parsed.decisionId, verdict: parsed.verdict }, Date.now());
        json(res, { ok: true });
      } catch (e: unknown) {
        res.statusCode = 400;
        json(res, { error: String(e) });
      }
    });
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

server.listen(PORT, () => console.log(`Novel System live (LLM=${llm.id}) → http://127.0.0.1:${PORT}`));
