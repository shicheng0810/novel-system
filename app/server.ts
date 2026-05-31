// app/server.ts — M5 最小可用服务器(composition root)。node 原生 http, 无新依赖。
// 后台 daemon 跑常驻世界 → SSE 事件流; 网页可看世界运行/读章节/对决策裁决。
// 非三层皮完整设计(那是迭代 UI 工作), 但功能闭环: 看得到世界在跑 + 作者裁决真影响正史。
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "../core/services/db";
import { makeLLM, readLLMConfig, writeLLMConfig, llmStatus, type LLMConfig } from "./llm-factory";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import { PACK, describeMind, natalLabel, plateLabel } from "./pack-select";
import { generateWorldConfig } from "./world-gen";

const PORT = Number(process.env["PORT"] ?? 8990);
const here = dirname(fileURLToPath(import.meta.url));
const viewSaga = process.env["NOVEL_VIEW"] === "saga"; // 看长跑(只读); 否则跑自带 demo 世界
const SAGA = process.env["NOVEL_SAGA_DIR"] ?? "saga";
const worldId = viewSaga ? "saga" : "live";
const db = viewSaga ? openDb(join(here, "..", ".novel-output", SAGA, "world.db")) : openDb(":memory:");
const pack = PACK;

// provider 由 llm-factory 据网页设置/环境变量装配(网页 /api/settings 可改)
const llm = makeLLM();

if (!viewSaga) {
  const ts0 = Date.now();
  store.saveSnapshot(db, worldId, pack.seedWorld({ worldId, packId: pack.id, seed: "live-seed", config: {} }), 0, ts0);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, ts0);
}

const sseClients = new Set<ServerResponse>();
let lastSeqBroadcast = 0;
function broadcastNew(): void {
  const evs = store.readEvents(db, worldId).filter((e) => (e.seq ?? 0) > lastSeqBroadcast);
  for (const e of evs) {
    lastSeqBroadcast = Math.max(lastSeqBroadcast, e.seq ?? 0);
    const line = `data: ${JSON.stringify({ tick: e.tick, subsystem: e.subsystem, severity: e.severity, verb: e.verb, summary: e.summary, kind: e.kind })}\n\n`;
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
  if (url.startsWith("/api/mind?")) {
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
      .complete(prompt)
      .then((v) => json(res, { id, voice: v.replace(/\s+/g, " ").replace(/^["「“]+|["」”]+$/g, "").slice(0, 30) }))
      .catch((e: unknown) => json(res, { error: String(e).slice(0, 80) }));
    return;
  }
  if (url.startsWith("/api/dialogue?")) {
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
      .complete(prompt)
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
  if (url === "/api/worlds") return json(res, readReg().map((w) => ({ ...w, chapters: chapterCount(w.name) })));
  if (url === "/api/worlds/create" && req.method === "POST") {
    let body = "";
    req.on("data", (d: Buffer) => (body += d.toString()));
    req.on("end", () => {
      void (async () => {
        try {
          const p = JSON.parse(body || "{}") as { prompt?: string; name?: string };
          if (!p.prompt) {
            res.statusCode = 400;
            return json(res, { error: "缺少世界描述" });
          }
          const reg = readReg();
          const safe = (p.name || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || `world-${reg.length + 1}`;
          if (reg.some((w) => w.name === safe)) {
            res.statusCode = 409;
            return json(res, { error: "同名世界已存在" });
          }
          const port = 9000 + reg.length;
          const cfg = await generateWorldConfig(p.prompt, llm); // ← LLM 据提示词生成世界配置
          const cfgPath = join(OUT, "worlds", `${safe}.json`);
          mkdirSync(dirname(cfgPath), { recursive: true });
          writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf8");
          const root = join(here, "..");
          const baseEnv = { ...process.env, NOVEL_PACK: "freeform", NOVEL_WORLD_CONFIG: cfgPath, NOVEL_SAGA_DIR: safe, NOVEL_TARGET: "1000", NOVEL_SECTIONS: "4" };
          spawn("npx", ["tsx", "app/longrun.ts"], { cwd: root, env: baseEnv, detached: true, stdio: "ignore" }).unref(); // 起长跑
          spawn("npx", ["tsx", "app/server.ts"], { cwd: root, env: { ...baseEnv, NOVEL_VIEW: "saga", PORT: String(port) }, detached: true, stdio: "ignore" }).unref(); // 起观察器
          const entry: WorldEntry = { name: safe, displayName: String((cfg as { displayName?: unknown }).displayName ?? safe), port, prompt: p.prompt };
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
