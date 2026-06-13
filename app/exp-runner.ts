// app/exp-runner.ts — P1-6 exp-runner 薄版(独立进程·治理 EXP 框架执行器)。蓝图 .audit/20260610-evolution-overhaul/synthesis.md §四(4.1-4.8)。
// CLI:  npx tsx app/exp-runner.ts <exp-spec.json路径> [--dry]     · --dry=只建臂目录+打印计划不 spawn(上岗门前检查)
//        npx tsx app/exp-runner.ts --help
// 职责: 读预注册 spec → 建臂(forkBase 静态导出物 cp / 冷启动) → 并行 spawn longrun(臂专属 env·NOVEL_EVOLVE=0 冻基因) → 等退出/完成轮询/超时 kill
//        → 机检收数(lint-seams + edit-ledger lint·读臂 db 成章) → 配对符号检验 + 守门(>20% 恶化否决) → exp-report.json + 人读 md。
// 红线(本文件纪律):
//   · 禁 Math.random; Date.now 仅用于超时上限/完成轮询/日志计时(运行管理), 【不进任何实验判读路径】——判读只依赖落盘章文本的确定性机检与计数。
//   · 只写 .novel-output/exp/ 之下(assertInExp 全部写路径); 绝不触碰其它世界目录; 绝不 cp 带 -wal/-shm 的活库(只 cp spec 指定的静态导出物·蓝图§4.3)。
//   · verdict 不自动写: suggestedVerdict 只是建议, v1 由人审 exp-report 后手写 trial-verdict.json{humanSigned:true}(蓝图§4.2)。
//   · 臂跑完退出是正常态(尊重「停止的世界别自启」); 臂目录带 .exp-arm marker 供 trend-watch/isLiveWorldDir 排除(P0-0)。
//   · fail-safe: 任一臂崩(非0退出/超时/零章)→ 报告标注 crashed、不产 suggestedVerdict; runner 中死=无 verdict=现任续任。
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync, openSync, closeSync } from "node:fs";
import { join, dirname, resolve, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "../core/services/db";
import { readChapters } from "../core/services/store";
import { lintSeams, echoLint } from "./lint-seams";
import { lintChapter, updateEditLedger, type EditLedger } from "./edit-ledger";
import { loadCanon } from "./canon";

const PROJ = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(PROJ, ".novel-output");
const EXP_BASE = join(OUT, "exp");
const ALPHA = 0.11; // 预注册显著性门: n=6 配对符号检验 ≥5/6 同向 p(单侧)=0.109 过、4/6 不过(n=8 则须 ≥7/8)。功效地板与蓝图§4.5"粗档化保证效应≥地板"配套。

// ── spec schema(蓝图§4.5) ──
interface ArmSpec { name: string; env?: Record<string, string>; genome?: Record<string, unknown> }
interface ExpSpec { id: string; axis: string; baseWorld: string; forkVol?: number; forkBase?: string; arms: ArmSpec[]; chapters: number; primary: string[]; guards: string[]; decision: string; replicates?: number; fv: number; timeoutMin?: number }

// 每章机检指标(全部确定性·零 LLM·低=好)。echo 恒 0: echoLint 需当时注入指令源, runner 事后无法重构 → sources=[] 跳过并在 notes 注明。
interface ChMetrics { n: number; goal: string; chLen: number; flags: number; issues: number; d1c: number; d2: number; tradeReps: number; microPerK: number; settleRatio: number; pauseBeats: number; similePerK: number; restraint: number; givePerK: number; rep4g: number; dlg1k: number; echo: number }
const MEAN_KEYS = ["chLen", "flags", "issues", "d1c", "d2", "tradeReps", "microPerK", "settleRatio", "pauseBeats", "similePerK", "restraint", "givePerK", "rep4g", "dlg1k", "echo"] as const;
const PRIMARY_OK = new Set<string>(["flags", "issues", "d1c", "d2", "tradeReps", "microPerK", "settleRatio", "pauseBeats", "similePerK", "restraint", "givePerK", "rep4g", "dlg1k"]); // 全部低=好; chLen 不许作主指标
const GUARD_OK = new Set<string>(["D1-D12", "弃章率", "章长cv", "rep4g", "echo"]);

interface RunResult { code: number | null; timedOut: boolean; completedByPoll: boolean; wallMin: number }
interface ArmOut {
  name: string; baseCh: number; wrote: number; abandonRate: number; run: RunResult | null; crashed: boolean; crashReason: string;
  perChapter: ChMetrics[]; means: Record<string, number>; chLenCV: number;
}

const r3 = (x: number): number => +x.toFixed(3);
function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function cv(xs: number[]): number { const m = mean(xs); if (!m || xs.length < 2) return 0; const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); return sd / m; }
function choose(n: number, k: number): number { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }
function binomTail(n: number, k: number): number { let p = 0; for (let i = k; i <= n; i++) p += choose(n, i); return p / Math.pow(2, n); } // P(X>=k)·p=0.5·确定性
function rep4g(text: string): number { // 简易 4-gram 窗内重复率(语义对齐 evolve.metricsOf.repetition·自含免依赖)
  const chars = [...text.replace(/\s+/g, "")];
  if (chars.length < 8) return 0;
  const seen = new Set<string>(); let rep = 0; let total = 0;
  for (let i = 0; i + 4 <= chars.length; i++) { const g = chars.slice(i, i + 4).join(""); total++; if (seen.has(g)) rep++; else seen.add(g); }
  return total ? +(rep / total).toFixed(4) : 0;
}
function dlg1k(text: string): number { const compact = text.replace(/\s/g, ""); if (compact.length < 100) return 0; return +((((text.match(/[「」“”]/g)?.length ?? 0) / 2) / (compact.length / 1000))).toFixed(2); }

function assertInExp(p: string): string { // 红线: 一切写路径必须落在 .novel-output/exp/ 之下
  const rp = resolve(p);
  if (rp !== resolve(EXP_BASE) && !rp.startsWith(resolve(EXP_BASE) + sep)) throw new Error(`红线: 拒绝写 exp/ 之外路径: ${rp}`);
  return rp;
}

function validateSpec(s: ExpSpec): string[] {
  const e: string[] = [];
  if (!s.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(s.id)) e.push("id 缺失或含非法字符(限 [a-z0-9_-])");
  if (!s.axis) e.push("axis 缺失(轴Ⅰ消融/轴Ⅱ选择/轴Ⅲ结构)");
  if (!s.baseWorld || !existsSync(join(OUT, "worlds", `${s.baseWorld}.json`))) e.push(`baseWorld 无效: .novel-output/worlds/${s.baseWorld ?? "?"}.json 不存在`);
  if (!Array.isArray(s.arms) || s.arms.length < 2) e.push("arms 须 ≥2 臂");
  const names = new Set<string>();
  for (const a of s.arms ?? []) {
    if (!a.name || !/^[a-z0-9][a-z0-9_-]*$/i.test(a.name)) e.push(`臂名非法: ${a.name ?? "?"}`);
    if (names.has(a.name)) e.push(`臂名重复: ${a.name}`); names.add(a.name);
    for (const k of Object.keys(a.env ?? {})) {
      if (!/^NOVEL_/.test(k)) e.push(`臂 ${a.name} env 键须 NOVEL_ 前缀: ${k}`);
      if (k === "NOVEL_SAGA_DIR" || k === "NOVEL_TARGET") e.push(`臂 ${a.name} 不得覆盖 runner 专属 env: ${k}`);
    }
  }
  if (!Number.isInteger(s.chapters) || s.chapters < 1 || s.chapters > 12) e.push("chapters 须为 1-12 整数(蓝图建议 6-8)");
  if (!Array.isArray(s.primary) || s.primary.length < 1 || s.primary.length > 2) e.push("primary 须 1-2 个");
  for (const p of s.primary ?? []) if (!PRIMARY_OK.has(p)) e.push(`primary 未知指标: ${p}(可用: ${[...PRIMARY_OK].join("/")})`);
  for (const g of s.guards ?? []) if (!GUARD_OK.has(g)) e.push(`guard 未知: ${g}(可用: ${[...GUARD_OK].join("/")})`);
  if (!s.decision) e.push("decision 缺失(预注册判读规则原文)");
  if (typeof s.fv !== "number") e.push("fv 缺失");
  if (s.forkBase !== undefined && typeof s.forkBase !== "string") e.push("forkBase 须为路径字符串");
  return e;
}

// ── 建臂: forkBase=静态导出物(VACUUM INTO 产物) cp 为臂 world.db + spec 同目录 state jsons; 无 forkBase=冷启动(WARMUP 由臂 env 给) ──
function buildArm(spec: ExpSpec, arm: ArmSpec, specDir: string, dry: boolean): { armDir: string; notes: string[] } {
  const notes: string[] = [];
  const armDir = assertInExp(join(EXP_BASE, spec.id, arm.name));
  mkdirSync(armDir, { recursive: true });
  // marker: trend-watch/isLiveWorldDir 排除依据(P0-0)。builtAt 仅日志元数据·非决策。
  writeFileSync(assertInExp(join(armDir, ".exp-arm")), JSON.stringify({ expId: spec.id, arm: arm.name, fv: spec.fv, builtAt: new Date().toISOString() }), "utf8");
  if (!dry && existsSync(join(armDir, "world.db"))) throw new Error(`臂目录已有 world.db(疑似旧跑·防误覆盖): ${armDir} —— 换 spec.id 或人工清理后重跑`);
  if (spec.forkBase) {
    const baseAbs = isAbsolute(spec.forkBase) ? spec.forkBase : join(OUT, spec.forkBase);
    if (!existsSync(baseAbs)) throw new Error(`forkBase 不存在: ${baseAbs}`);
    if (existsSync(baseAbs + "-wal") || existsSync(baseAbs + "-shm")) throw new Error(`forkBase 旁有 -wal/-shm: 疑似活库——拒绝 cp(蓝图§4.3: 只 cp 写者持锁 VACUUM INTO 的静态导出物)`);
    if (dry) { notes.push(`(dry) 将 cp ${baseAbs} → world.db + ${specDir} 下 state jsons`); return { armDir, notes }; }
    copyFileSync(baseAbs, assertInExp(join(armDir, "world.db")));
    let copied = 0;
    for (const f of readdirSync(specDir)) { // spec 同目录 state jsons(写者持锁窗口一并快照的 genome/evolution/archive/drama/constraints…)
      if (!f.endsWith(".json") || /^exp-spec|^exp-report|^trial-/.test(f)) continue;
      copyFileSync(join(specDir, f), assertInExp(join(armDir, f))); copied++;
    }
    notes.push(`fork: ${spec.forkBase} → world.db · state jsons ×${copied}`);
  } else notes.push("冷启动臂(无 forkBase): 空目录起跑·WARMUP 由臂 env 控制");
  if (arm.genome && !dry) { writeFileSync(assertInExp(join(armDir, "genome.json")), JSON.stringify(arm.genome, null, 2), "utf8"); notes.push("臂专属 genome.json 已写入"); }
  if (!arm.genome && !spec.forkBase) notes.push("⚠ 臂未给 genome 且无 forkBase → longrun 起步经 loadGenome 从全局 QD 档取种(两臂同时起跑同源·正式 trial 建议显式给 genome 钉死)");
  return { armDir, notes };
}

function countCh(dbPath: string): number {
  const db = openDb(dbPath);
  try { return readChapters(db, "saga").filter((c) => c.id.startsWith("saga-ch-")).length; } finally { db.close(); }
}
const mdCount = (armDir: string): number => { try { return readdirSync(join(armDir, "chapters")).filter((f) => /^ch-\d+\.md$/.test(f)).length; } catch { return 0; } };

// ── 跑臂: spawn longrun → 等退出。longrun 写满 TARGET 后【不会自退】(:451 setInterval 未 unref·实证 4 僵尸)→ 完成轮询(chapters/*.md 计数·零 db 争用)达标后 SIGTERM(longrun 信号手清锁 exit 0)。
//    Date.now 仅作超时/轮询/计时(运行管理·非判读)。
function runArm(armDir: string, env: NodeJS.ProcessEnv, logPath: string, needMd: number, timeoutMs: number): Promise<RunResult> {
  return new Promise((res) => {
    const fd = openSync(logPath, "a");
    const child = spawn("npx", ["tsx", "app/longrun.ts"], { cwd: PROJ, env, stdio: ["ignore", fd, fd] });
    const t0 = Date.now(); // 计时·非决策
    let timedOut = false; let completedByPoll = false; let settled = false;
    const term = (): void => { try { child.kill("SIGTERM"); } catch { /* 已退 */ } setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* 已退 */ } }, 20_000).unref(); };
    const poll = setInterval(() => {
      if (Date.now() - t0 > timeoutMs) { timedOut = true; clearInterval(poll); term(); return; } // 超时上限 kill
      if (mdCount(armDir) >= needMd) { completedByPoll = true; clearInterval(poll); setTimeout(term, 30_000).unref(); } // 末章 md 落盘后留 30s 让 db 行/账本写完再 SIGTERM
    }, 15_000);
    const done = (code: number | null): void => { if (settled) return; settled = true; clearInterval(poll); try { closeSync(fd); } catch { /* ignore */ } res({ code, timedOut, completedByPoll, wallMin: r3((Date.now() - t0) / 60000) }); };
    child.on("exit", (code) => done(code));
    child.on("error", () => done(-1));
  });
}

// ── 收数: 读臂 db 成章(章号源=db·resume 同源), 逐章 lintSeams + lintChapter(顺序滚动 edit-ledger 模拟·两臂同法公平) + rep4g/dlg1k ──
function collectArm(spec: ExpSpec, arm: ArmSpec, armDir: string, baseCh: number, names: string[], run: RunResult | null): ArmOut {
  let chs: Array<{ n: number; goal: string; text: string }> = [];
  try {
    const db = openDb(join(armDir, "world.db"));
    try { chs = readChapters(db, "saga").filter((c) => c.id.startsWith("saga-ch-")).map((c) => ({ n: Number(c.id.slice(8)), goal: c.goal, text: c.text })).filter((c) => Number.isFinite(c.n) && c.n > baseCh).sort((a, b) => a.n - b.n); }
    finally { db.close(); }
  } catch { /* db 缺失/损坏 → 零章·按崩臂处理 */ }
  const allNames = [...new Set([...names, ...Object.keys(loadCanon(armDir).characters ?? {})])];
  let ledger: EditLedger = { usedImages: [], signatureDetails: [], lints: [] };
  const per: ChMetrics[] = [];
  for (const c of chs) {
    const seam = lintSeams(c.text, allNames, c.goal);
    const lint = lintChapter(c.text, ledger, c.n);
    ledger = updateEditLedger(ledger, c.text, c.n);
    per.push({
      n: c.n, goal: c.goal, chLen: c.text.replace(/\s/g, "").length,
      flags: seam.flags.length, issues: seam.issues.length, d1c: seam.metrics.d1cPairs, d2: seam.metrics.d2Meets, tradeReps: seam.metrics.tradeReps,
      microPerK: lint.metrics.microPerK, settleRatio: lint.metrics.settleRatio, pauseBeats: lint.metrics.pauseBeats, similePerK: lint.metrics.similePerK,
      restraint: lint.metrics.restraint, givePerK: lint.metrics.givePerK,
      rep4g: rep4g(c.text), dlg1k: dlg1k(c.text), echo: echoLint(c.text, c.goal, []).bodyHits.length, // sources=[] → 恒 0(注入源不可事后重构·notes 注明)
    });
  }
  const means: Record<string, number> = {};
  for (const k of MEAN_KEYS) means[k] = r3(mean(per.map((p) => p[k])));
  const wrote = per.length;
  const crashed = !run || run.code === null || (run.code !== 0 && !run.completedByPoll) || run.timedOut || wrote === 0;
  const crashReason = !run ? "未起跑" : run.timedOut ? "超时 kill" : wrote === 0 ? "零章" : run.code !== 0 && !run.completedByPoll ? `退出码 ${run.code}` : "";
  return { name: arm.name, baseCh, wrote, abandonRate: r3(Math.max(0, (spec.chapters - wrote) / spec.chapters)), run, crashed, crashReason, perChapter: per, means, chLenCV: r3(cv(per.map((p) => p.chLen))) };
}

const guardValue = (a: ArmOut, g: string): number =>
  g === "D1-D12" ? r3((a.means["flags"] ?? 0) + (a.means["issues"] ?? 0)) : g === "弃章率" ? a.abandonRate : g === "章长cv" ? a.chLenCV : g === "rep4g" ? (a.means["rep4g"] ?? 0) : (a.means["echo"] ?? 0);
// 守门绝对地板: 恶化判定 = (cand-base) > max(0.2*base, floor)。纯相对 20% 在 base≈0 时退化为 Inf(合成臂实证: cv 0→0.052 被误否决)→ 各 guard 给噪声地板, base 正常量级时仍由 20% 相对规则主导。
const GUARD_FLOOR: Record<string, number> = { "D1-D12": 0.5, "弃章率": 0.08, "章长cv": 0.08, "rep4g": 0.02, "echo": 0.5 };

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    console.log(`exp-runner v1(蓝图§四·治理 EXP 执行器)
用法: npx tsx app/exp-runner.ts <exp-spec.json路径> [--dry|--collect-only]
  --dry           只建臂目录+写 .exp-arm marker+打印计划, 不 spawn(上岗门前检查)
  --collect-only  不建臂不 spawn: 对已存在的臂目录直接收数+判读+出报告(runner 中死后重收数/复刻判读)
spec schema(§4.5): { id, axis, baseWorld, forkVol?, forkBase?, arms:[{name, env?, genome?}], chapters(6-8), primary:[1-2个], guards:["D1-D12","弃章率","章长cv","rep4g","echo"], decision, replicates?, fv, timeoutMin?(默认90) }
主指标可选: ${[...PRIMARY_OK].join("/")}(全部低=好)
判读: 同章位配对符号检验(单侧 α=${ALPHA}·n=6 须 ≥5/6 同向) + 守门(任一 guard 恶化>20% 否决); suggestedVerdict 仅建议——v1 verdict 由人签。`);
    process.exit(0);
  }
  const dry = args.includes("--dry");
  const collectOnly = args.includes("--collect-only");
  if (dry && collectOnly) { console.error("--dry 与 --collect-only 互斥"); process.exit(1); return; }
  const specPath = args.find((a) => !a.startsWith("--"));
  if (!specPath) { console.error("缺 spec 路径(--help 看用法)"); process.exit(1); return; }
  let spec: ExpSpec;
  try { spec = JSON.parse(readFileSync(specPath, "utf8")) as ExpSpec; } catch (e) { console.error(`spec 读取/解析失败: ${String(e).slice(0, 140)}`); process.exit(1); return; }
  const verrs = validateSpec(spec);
  if (verrs.length) { console.error(`spec 校验失败 ${verrs.length} 条:`); for (const e of verrs) console.error("  ✗ " + e); process.exit(1); return; }
  if ((spec.replicates ?? 1) > 1) console.log("⚠ replicates>1 v1 未实现(臂内重复待 v2)——本次按 1 跑");
  if (spec.chapters < 6 || spec.chapters > 8) console.log(`⚠ chapters=${spec.chapters} 不在蓝图建议 6-8(功效地板按 n=6 设)`);

  const specDir = dirname(resolve(specPath));
  const expRoot = assertInExp(join(EXP_BASE, spec.id));
  mkdirSync(expRoot, { recursive: true });
  const canonicalSpec = join(expRoot, "exp-spec.json");
  if (resolve(specPath) !== resolve(canonicalSpec)) copyFileSync(specPath, assertInExp(canonicalSpec)); // 跑前写死归档(§4.5)
  if (!dry && !collectOnly && existsSync(join(expRoot, "exp-report.json"))) { console.error(`已有 exp-report.json: ${expRoot} —— 该实验已跑过(幂等保护), 换 id 重跑; 只想重判读用 --collect-only`); process.exit(1); return; }
  if (collectOnly && existsSync(join(expRoot, "exp-report.json"))) console.log("⚠ collect-only: 覆盖既有 exp-report(重判读)");

  const worldsCfgPath = join(OUT, "worlds", `${spec.baseWorld}.json`);
  const cfg = JSON.parse(readFileSync(worldsCfgPath, "utf8")) as { protagonists?: Array<{ name?: string }> };
  const protoNames = (cfg.protagonists ?? []).map((p) => p.name ?? "").filter(Boolean);

  // ── 建臂 ──
  const built: Array<{ arm: ArmSpec; armDir: string; baseCh: number; env: NodeJS.ProcessEnv }> = [];
  const globalNotes: string[] = [`echo guard 恒 0: echoLint 需当时注入指令源·runner 事后不可重构(sources=[] 跳过), 仅占位防回归`];
  for (const arm of spec.arms) {
    let armDir: string; let notes: string[] = []; let baseCh = 0;
    if (collectOnly) { // 不建臂: 臂目录须已在(world.db 必备); baseCh 取建臂时写进 marker 的值(冷启动臂缺省 0)
      armDir = assertInExp(join(EXP_BASE, spec.id, arm.name));
      if (!existsSync(join(armDir, "world.db"))) { console.error(`--collect-only: 臂 ${arm.name} 缺 world.db: ${armDir}`); process.exit(1); return; }
      try { baseCh = Number((JSON.parse(readFileSync(join(armDir, ".exp-arm"), "utf8")) as { baseCh?: number }).baseCh ?? 0) || 0; } catch { baseCh = 0; }
      notes = [`collect-only: 复用既有臂(baseCh=${baseCh})`];
    } else {
      let b: { armDir: string; notes: string[] };
      try { b = buildArm(spec, arm, specDir, dry); }
      catch (e) { console.error(`✗ 建臂失败(${arm.name}): ${e instanceof Error ? e.message : String(e)}`); process.exit(1); return; }
      armDir = b.armDir; notes = b.notes;
      baseCh = !dry && spec.forkBase ? countCh(join(armDir, "world.db")) : 0; // fork 臂续写: TARGET=基底章数+spec.chapters(dry 不 cp 故 0·实跑时实测)
      if (!dry) writeFileSync(assertInExp(join(armDir, ".exp-arm")), JSON.stringify({ expId: spec.id, arm: arm.name, fv: spec.fv, baseCh, builtAt: new Date().toISOString() }), "utf8"); // marker 补 baseCh(供 collect-only 重收数·builtAt 仅日志非决策)
    }
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NOVEL_PACK: "freeform", NOVEL_WORLD_CONFIG: worldsCfgPath, NOVEL_SAGA_DIR: `exp/${spec.id}/${arm.name}`,
      NOVEL_STYLE: "温润", NOVEL_TARGET: String(baseCh + spec.chapters), NOVEL_EVOLVE: "0", NOVEL_STANDBY: "0",
      ...(arm.env ?? {}),
    };
    built.push({ arm, armDir, baseCh, env });
    console.log(`🧪 臂 ${arm.name} @ ${armDir.replace(PROJ + sep, "")}`);
    for (const nt of notes) console.log(`     ${nt}`);
    if (notes.some((x) => x.startsWith("⚠"))) globalNotes.push(`${arm.name}: 起步 genome 取自全局 QD 档(同源)·正式 trial 建议钉死`);
  }
  const timeoutMs = (spec.timeoutMin ?? 90) * 60_000;
  console.log(`\n计划: ${spec.arms.length} 臂并行 × ${spec.chapters} 章 · 超时 ${spec.timeoutMin ?? 90} 分 · 基底世界 ${spec.baseWorld} · 主指标 ${spec.primary.join("+")} · 守门 ${spec.guards.join("/")}`);
  for (const b of built) console.log(`  ${b.arm.name}: TARGET=${b.env["NOVEL_TARGET"]} 覆盖env={${Object.entries(b.arm.env ?? {}).map(([k, v]) => `${k}=${v}`).join(" ") || "无"}}`);
  if (dry) { console.log("\n--dry 完成: 臂目录+marker 已建·未 spawn·未 cp 基底。去掉 --dry 实跑。"); process.exit(0); return; }

  // ── 并行跑 + 收数 + 判读(async 段) ──
  void (async (): Promise<void> => {
    const runs = collectOnly
      ? built.map((): RunResult => ({ code: 0, timedOut: false, completedByPoll: true, wallMin: 0 })) // collect-only: 不跑·以"已正常完结"语义收数(崩臂仍由零章兜底判)
      : await Promise.all(built.map((b) => runArm(b.armDir, b.env, join(expRoot, `${b.arm.name}.log`), spec.chapters, timeoutMs)));
    const arms = built.map((b, i) => collectArm(spec, b.arm, b.armDir, b.baseCh, protoNames, runs[i] ?? null));
    const crashed = arms.filter((a) => a.crashed).map((a) => `${a.name}(${a.crashReason})`);

    const baseArm = arms[0]!; // arms[0]=基线/现任臂(预注册次序即语义)
    const pairedTests: Array<Record<string, unknown>> = [];
    const guardsTable: Array<Record<string, unknown>> = [];
    const perCandidate: Array<{ name: string; primaryOk: boolean; guardVeto: boolean; status: string }> = [];
    for (const cand of arms.slice(1)) {
      // 同章位配对(章位 = n - baseCh·fork/冷启动皆对齐)
      const bByPos = new Map(baseArm.perChapter.map((c) => [c.n - baseArm.baseCh, c]));
      let primaryOk = true;
      for (const pk of spec.primary) {
        let better = 0, worse = 0, tie = 0;
        for (const cc of cand.perChapter) {
          const bb = bByPos.get(cc.n - cand.baseCh);
          if (!bb) continue;
          const d = (cc[pk as keyof ChMetrics] as number) - (bb[pk as keyof ChMetrics] as number);
          if (d < 0) better++; else if (d > 0) worse++; else tie++; // 低=好
        }
        const p = better + worse > 0 ? r3(binomTail(better + worse, Math.max(better, 0))) : 1;
        const sig = better > worse && p <= ALPHA;
        if (!sig) primaryOk = false;
        pairedTests.push({ metric: pk, baseline: baseArm.name, candidate: cand.name, n: better + worse + tie, candBetter: better, candWorse: worse, tie, pOneSided: p, significant: sig });
      }
      let guardVeto = false;
      for (const g of spec.guards) {
        const bv = guardValue(baseArm, g), cvv = guardValue(cand, g);
        const rel = bv > 1e-9 ? (cvv - bv) / bv : (cvv > 1e-9 ? Infinity : 0);
        const veto = cvv - bv > Math.max(0.2 * bv, GUARD_FLOOR[g] ?? 0); if (veto) guardVeto = true; // >20% 恶化且超绝对地板(防零基线退化)
        guardsTable.push({ guard: g, baseline: baseArm.name, base: bv, candidate: cand.name, cand: cvv, relChangePct: Number.isFinite(rel) ? r3(rel * 100) : "Inf", floor: GUARD_FLOOR[g] ?? 0, veto });
      }
      perCandidate.push({ name: cand.name, primaryOk, guardVeto, status: guardVeto ? "守门否决" : primaryOk ? "primary显著向好" : "无显著差/向差" });
    }
    const winners = perCandidate.filter((c) => c.status === "primary显著向好");
    const suggestedVerdict = crashed.length ? null : {
      suggestion: winners.length === 1 ? winners[0]!.name : `incumbent:${baseArm.name}`,
      reason: crashed.length ? "臂崩·不判" : winners.length === 1 ? `候选 ${winners[0]!.name} 全主指标 ≥5/6 同向(α=${ALPHA}) 且守门无 >20% 恶化` : winners.length === 0 ? "无候选过双门(主指标显著+守门)" : `多候选同时过门(${winners.map((w) => w.name).join("/")})·不裁·人审`,
      perCandidate, alpha: ALPHA, rule: spec.decision, humanSignRequired: true,
    };

    const report = {
      id: spec.id, axis: spec.axis, fv: spec.fv, runner: collectOnly ? "exp-runner v1(collect-only)" : "exp-runner v1", baseWorld: spec.baseWorld, chaptersPerArm: spec.chapters, forkBase: spec.forkBase ?? null,
      perArm: arms.map((a) => ({ name: a.name, baseCh: a.baseCh, wrote: a.wrote, abandonRate: a.abandonRate, chLenCV: a.chLenCV, exit: a.run, crashed: a.crashed, crashReason: a.crashReason, means: a.means, perChapter: a.perChapter })),
      pairedTests, guardsTable, suggestedVerdict, crashed, notes: globalNotes,
    };
    writeFileSync(assertInExp(join(expRoot, "exp-report.json")), JSON.stringify(report, null, 2), "utf8");
    const md = [
      `# EXP 报告 · ${spec.id}(${spec.axis})`, "",
      `基底 ${spec.baseWorld} · ${spec.chapters} 章/臂 · 主指标 ${spec.primary.join("+")} · 决策规则(预注册): ${spec.decision}`, "",
      `| 臂 | 章 | 弃章率 | 章长cv | ${[...MEAN_KEYS].filter((k) => k !== "chLen").join(" | ")} |`,
      `|---|---|---|---|${[...MEAN_KEYS].filter((k) => k !== "chLen").map(() => "---").join("|")}|`,
      ...arms.map((a) => `| ${a.name}${a.crashed ? "(崩:" + a.crashReason + ")" : ""} | ${a.wrote}/${spec.chapters} | ${a.abandonRate} | ${a.chLenCV} | ${[...MEAN_KEYS].filter((k) => k !== "chLen").map((k) => a.means[k]).join(" | ")} |`), "",
      "## 配对符号检验(同章位·低=好)",
      ...pairedTests.map((t) => `- ${t["metric"]}: ${t["candidate"]} vs ${t["baseline"]} → 优${t["candBetter"]}/劣${t["candWorse"]}/平${t["tie"]} p(单侧)=${t["pOneSided"]} ${t["significant"] ? "✓显著" : "✗未达"}`), "",
      "## 守门(恶化>20% 否决)",
      ...guardsTable.map((g) => `- ${g["guard"]}: ${g["candidate"]}=${g["cand"]} vs ${g["baseline"]}=${g["base"]}(Δ${g["relChangePct"]}%)${g["veto"] ? " ⛔否决" : ""}`), "",
      `## suggestedVerdict: ${suggestedVerdict ? suggestedVerdict.suggestion : "(臂崩·不产)"}`,
      suggestedVerdict ? suggestedVerdict.reason : `崩臂: ${crashed.join("、")}`, "",
      `> v1 人签: 请人工审本报告后手写 trial-verdict.json{humanSigned:true}(蓝图§4.2)——runner 不自动写 verdict。`,
    ].join("\n");
    writeFileSync(assertInExp(join(expRoot, "exp-report.md")), md, "utf8");

    console.log(`\n══ 实验完毕 ══`);
    for (const a of arms) console.log(`  ${a.name}: ${a.wrote}/${spec.chapters} 章 ${a.crashed ? "✗崩(" + a.crashReason + ")" : "✓"} 墙钟${a.run?.wallMin ?? "?"}min`);
    if (crashed.length) console.log(`  ⚠ 臂崩 → 不产 suggestedVerdict(fail-safe: 现任续任)`);
    else console.log(`  suggestedVerdict(仅建议): ${suggestedVerdict!.suggestion} —— ${suggestedVerdict!.reason}`);
    console.log(`  报告: ${join(expRoot, "exp-report.json").replace(PROJ + sep, "")} + exp-report.md`);
    console.log(`\n【v1 人签】请人工审 exp-report 后手写 ${join("exp", spec.id, "trial-verdict.json").replace(/\\/g, "/")}{"humanSigned":true,...}——runner 不自动写 verdict。`);
    process.exit(crashed.length ? 2 : 0);
  })().catch((e: unknown) => { console.error("runner 异常(无 verdict=现任续任):", String(e).slice(0, 300)); process.exit(1); });
}

main();
