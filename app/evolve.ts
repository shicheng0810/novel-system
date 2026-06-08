// app/evolve.ts v2 — 质量-多样性自进化(MAP-Elites / QDAIF 路线)。app 层；core/ 只读通用 tuning 数值。
// 把 v1「单一适应度 + 单点爬山」升级为：
//   · MAP-Elites 存档：按「语气×节奏」风格网格，每格留该风格下最优精英(基因)，结构性防模式坍塌。
//   · 混合评估：LLM 评委 rubric + 确定性客观指标(重复率/对白占比/词汇多样性/避雷命中)。客观指标只用于打分，绝不进生成提示(F/R 分离，防刷分)。
//   · LLM 提议变异：变异 LLM 读分项反思自由调参(带边界裁剪与确定性兜底)，取代固定旋钮轮换。
//   · 反自欺守门：长度暴涨/重复率飙升 → 适应度打折(抑制讨好评委的伪信号)。
//   · 全局记忆账本：避雷(年龄衰减)/发扬/重点修正，注入下一卷生成。
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LLMProvider } from "../core/services/llm";
import { loadCanon } from "./canon";
import { loadSimFitness } from "./sim-fitness";
import { loadWarmFit } from "./warm-fitness"; // T3 温情专属 fitness(GENTLE 折进基因, 破坍塌; 爽文不读)

// engine = 模拟层旋钮(core 从 props.tuning.* 通用读取; 默认值 = 现状行为, 进化才拨动)。
//   priorWeight 八字/奇门引导强度 · scarcity 资源稀缺度(0自由积累→1零和竞争) · conflictRate 冲突/张力增益
//   eventBias 大事触发倾向 · turnoverRate 登场/陨落代谢率 · nicheWeight 生态位分工加分 · structureGrowth 派系分裂/新生倾向
//   moveBias 自发空间位移偏置(默认0=现状; move 候选无 targetIds 拿不到互动红利 flat+0.3、天生选不中→恒 move=0, 故需评分后偏置破 0; 温情专属经 drama 注入、爽文默认0 逐字节不变)
//   moveBiasAnchor premise 锚(各世界不同: 游历0.20/定居0.15/隐居0.08; 创世时种、跨代不变异)。mutateGenome 每代把 moveBias 朝它收→防 LLM 把所有温情世界收敛到公共0.15、保各自节奏分化(用户选「锚定式」)。
export interface EngineGenes { priorWeight: number; scarcity: number; conflictRate: number; eventBias: number; turnoverRate: number; nicheWeight: number; structureGrowth: number; moveBias: number; moveBiasAnchor: number }
export interface Genome {
  gen: { temperature: number; topP: number; frequencyPenalty: number; presencePenalty: number };
  engine: EngineGenes;
  generation: number;
  targetStyle?: { tone: string; rhythm: string }; // 本卷 novelty 探索目标(逼填未点亮的风格格)
}
export interface Rubric { freshness: number; pacing: number; dialogue: number; hook: number; coherence: number; character: number }
export interface Ledger {
  avoid: Array<{ p: string; age: number; hits?: number }>; // hits=跨卷再现次数(ExpeL 式投票, 高频=真通用套话)
  amplify: string[];
  directives: string[];
  scores: Array<{ vol: number; gen: number; fitness: number; llm: number; obj: number; cell: string; len: number; slm: number; rep: number; dlg: number; ttr: number; avoidHits: number } & Rubric>;
  bestEngine?: { engine: EngineGenes; sim: number }; // 世界级最优模拟旋钮(按 simFit 单独进化, 与风格格解耦 → 不被风格精英化拖拽、跨 15 格共享)
}
export interface Cell { key: string; tone: string; rhythm: string; conflict: string; genome: Genome; fitness: number; at: string }

const G_FILE = (d: string): string => join(d, "genome.json");
const L_FILE = (d: string): string => join(d, "evolution.json");
const A_FILE = (d: string): string => join(d, "archive.json");

const TONES = ["冷峻", "热血", "诙谐", "悲悯", "悬疑"];
const CONFLICTS = ["动作", "权谋", "情感", "解谜", "生存"];
const RHYTHMS = ["急促", "均衡", "绵长"];
// 温情自进化: NOVEL_STYLE=温润 的世界, 自进化奖「温情质感」而非「戏剧密度」——fitness 不奖 simFit、变异守低冲突、simReflect「低张力=健康态」、critique 温情 rubric、pickTarget 只探温情语气。爽文世界 GENTLE=false → 全程逐字节同现状(向后兼容)。与 longrun 同进程同源(process.env)。
const GENTLE = process.env["NOVEL_STYLE"] === "温润";
const GENTLE_TONES = ["悲悯", "冷峻"]; // pickTarget 在温情向只在温情亲和语气里探索(排除热血/诙谐/悬疑)
const RHYTHM_HINT: Record<string, string> = { "急促": "本卷明显多用短句与断句、节奏紧促有力", "均衡": "本卷句子明显拉长一档、适度多用复句，节奏放缓但不拖沓", "绵长": "本卷多用舒展长句与复句、从容铺陈" };

export const DEFAULT_GENOME: Genome = {
  gen: { temperature: 1.0, topP: 0.95, frequencyPenalty: 0.4, presencePenalty: 0.3 },
  engine: { priorWeight: 1.0, scarcity: 0, conflictRate: 1.0, eventBias: 1.0, turnoverRate: 1.0, nicheWeight: 0, structureGrowth: 0, moveBias: 0, moveBiasAnchor: 0.15 }, // 全默认 = 现状行为(不破坏在跑世界); moveBiasAnchor 默认 0.15(未种 premise 锚的回退)
  generation: 0,
};
// 注意 backfill DEFAULT_GENOME.engine: 旧存档/全局基因是改造前的 engine 形状(只有 priorWeight), 选作变异父本时会丢新旋钮 → undefined。补默认确保 8 个旋钮都在、都能进化。
const cloneGenome = (g: Genome): Genome => ({ gen: { ...g.gen }, engine: { ...DEFAULT_GENOME.engine, ...g.engine }, generation: g.generation });
const emptyLedger = (): Ledger => ({ avoid: [], amplify: [], directives: [], scores: [] });

// 新世界(无本地 genome)起步基因。intent 给目标引擎策略 niche → 取该 niche 的全局精英(如群像类世界取群像引擎, 而非全局文笔冠军), 解「局部最优搁浅传不出」。无 intent = 现状(取全局最高 fitness 派生基因)。
export function loadGenome(d: string, intent?: { turnover?: string; structure?: string }): Genome {
  const bf = (g: Genome): Genome => ({ gen: { ...DEFAULT_GENOME.gen, ...g.gen }, engine: { ...DEFAULT_GENOME.engine, ...g.engine }, generation: 0 });
  try {
    if (!existsSync(G_FILE(d))) {
      const gl = loadGlobal(d); const cells = gl.cells ?? {};
      if (intent && Object.keys(cells).length) { // 按意图取目标 niche 种
        const want = `${intent.turnover ?? ""}×${intent.structure ?? ""}`;
        const hit = cells[want] ?? Object.values(cells).find((c) => !!intent.turnover && c.turnoverBin === intent.turnover) ?? null;
        if (hit?.genome) return bf(hit.genome);
      }
      return gl.genome ? bf(gl.genome) : cloneGenome(DEFAULT_GENOME); // 无意图 = 全局最优(现状行为, 安全退化)
    }
    const p = JSON.parse(readFileSync(G_FILE(d), "utf8")) as Partial<Genome>;
    return { gen: { ...DEFAULT_GENOME.gen, ...(p.gen ?? {}) }, engine: { ...DEFAULT_GENOME.engine, ...(p.engine ?? {}) }, generation: typeof p.generation === "number" ? p.generation : 0 };
  } catch { return cloneGenome(DEFAULT_GENOME); }
}
export function saveGenome(d: string, g: Genome): void { writeFileSync(G_FILE(d), JSON.stringify(g, null, 2), "utf8"); }
export function loadLedger(d: string): Ledger {
  try {
    if (existsSync(L_FILE(d))) return { ...emptyLedger(), ...JSON.parse(readFileSync(L_FILE(d), "utf8")) };
    return { ...emptyLedger(), avoid: loadGlobal(d).avoid.map((p) => ({ p, age: 0 })) }; // 新世界播种全局通用避雷
  } catch { return emptyLedger(); }
}
export function saveLedger(d: string, l: Ledger): void { writeFileSync(L_FILE(d), JSON.stringify(l, null, 2), "utf8"); }
export function loadArchive(d: string): Cell[] { try { return existsSync(A_FILE(d)) ? (JSON.parse(readFileSync(A_FILE(d), "utf8")).cells ?? []) : []; } catch { return []; } }
export function saveArchive(d: string, cells: Cell[]): void { writeFileSync(A_FILE(d), JSON.stringify({ cells }, null, 2), "utf8"); }

// ── 全局传承层: 跨世界通用避雷 + 跨世界 QD 引擎策略存档(按引擎旋钮分 niche, 每 niche 各留最优, 让局部最优如群像引擎不被单一适应度冠军淹没)。core/ 不涉, 纯 app 层。 ──
// 全局 niche cell: 按引擎策略分格(genotype niching, 零新持久化、不依赖未落盘的表型描述符)。
export interface GlobalCell { key: string; turnoverBin: string; structureBin: string; genome: Genome; fitness: number; from: string; at: string }
export interface GlobalEvo { avoid: string[]; genome: Genome | null; from: string[]; bestFitness: number; cells?: Record<string, GlobalCell> }
const GLOBAL_FILE = (root: string): string => join(root, "global-evolution.json");
const isLiveWorldDir = (n: string): boolean => !/-killed-|-raced$|-archive/.test(n) && n !== "worlds";
export function loadGlobal(worldDir: string): GlobalEvo {
  try { const f = GLOBAL_FILE(join(worldDir, "..")); return existsSync(f) ? { avoid: [], genome: null, from: [], bestFitness: 0, cells: {}, ...JSON.parse(readFileSync(f, "utf8")) } : { avoid: [], genome: null, from: [], bestFitness: 0, cells: {} }; }
  catch { return { avoid: [], genome: null, from: [], bestFitness: 0, cells: {} }; }
}
// 全局引擎策略 niche: 按定义「群像 vs 文笔」分野的两个引擎旋钮分桶。turnoverRate(人物代谢): 低=人物长寿群像不坍塌; structureGrowth(派系生长): 生长=派系分裂新生。两旋钮已在基因里, 零新持久化、保证不同策略落不同格(文笔冠军 turnover≈1/structG≈0 → 高代谢×平; 群像引擎 turnover0.5/structG0.7 → 低代谢×生长)。
function engineNiche(g: Genome): { key: string; turnoverBin: string; structureBin: string } {
  const e = { ...DEFAULT_GENOME.engine, ...g.engine };
  const turnoverBin = e.turnoverRate <= 0.75 ? "低代谢" : "高代谢";
  const structureBin = e.structureGrowth >= 0.35 ? "生长" : "平";
  // move 节奏维(Y): 仅温情(moveBias>0)世界按自发位移频率再分格 → 全局存档策展保存「安步/缓行/游历」各自冠军、不被收敛成单节奏。
  // moveBias=0(爽文/arcsaga/未进化温情)→ 空后缀 → 键与改前逐字符不变 = 零迁移扰动、既有 cells 不孤儿。
  const moveBin = e.moveBias <= 0 ? "" : e.moveBias < 0.13 ? "×安步" : e.moveBias <= 0.18 ? "×缓行" : "×游历";
  return { key: `${turnoverBin}×${structureBin}${moveBin}`, turnoverBin, structureBin };
}
// 把某世界 archive 最优格的基因, 按其【引擎策略】沉积进全局 cells(逐 niche 取 fitness max, C1 单调)。
// engine 取世界级最优 ledger.bestEngine(与 evolveOnce L243 解耦语义对齐: gen 取风格冠军、engine 取按 simFit 单独进化的模拟最优), 回退风格 engine。
// 修 P0-2: 旧实现按 champ.genome.engine(风格父本冻结 engine)归格 → 归错 niche + 世界级 bestEngine 永不进全局, 世界内的 engine 解耦在跨世界层前功尽弃。
function depositWorldArchive(root: string, d: string, cells: Record<string, GlobalCell>): void {
  try {
    const A = A_FILE(join(root, d));
    if (!existsSync(A)) return;
    const wc = ((JSON.parse(readFileSync(A, "utf8")).cells ?? []) as Cell[]);
    const champ = wc.reduce<Cell | null>((a, c) => (c.genome && (!a || c.fitness > a.fitness) ? c : a), null);
    if (!champ?.genome) return;
    const bestEng = loadLedger(join(root, d)).bestEngine?.engine; // 世界级模拟最优引擎(解耦)
    const g: Genome = { gen: { ...champ.genome.gen }, engine: { ...DEFAULT_GENOME.engine, ...(bestEng ?? champ.genome.engine) }, generation: 0 };
    const n = engineNiche(g); const ex = cells[n.key];
    if (!ex || champ.fitness > ex.fitness) cells[n.key] = { key: n.key, turnoverBin: n.turnoverBin, structureBin: n.structureBin, genome: g, fitness: champ.fitness, from: d, at: champ.at };
  } catch { /* ignore */ }
}
// 把单冠军 genome 按其引擎策略归格(旧格式升级 / 兼容投影)。
function depositGenome(cells: Record<string, GlobalCell>, g: Genome | null, fit: number, from: string): void {
  if (!g) return; const n = engineNiche(g); const ex = cells[n.key];
  if (!ex || fit > ex.fitness) cells[n.key] = { key: n.key, turnoverBin: n.turnoverBin, structureBin: n.structureBin, genome: { ...cloneGenome(g), generation: 0 }, fitness: fit, from, at: "v0" };
}
// 跨世界互斥锁(P1-3): .novel-output/ 是多世界共享上级, global-evolution.json 是全系统唯一多写者落盘点(各世界 longrun.lock 只锁自己目录)。O_EXCL 独占 + mtime 陈旧清理 + 短忙等 + 兜底兜底直接做。
function withGlobalLock(root: string, fn: () => void): void {
  const LK = join(root, "global-evolution.lock");
  const deadline = Date.now() + 400; // 至多争用 ~400ms(writeGlobal 仅 load-merge-rename 几 ms, 每世界每 8 章一次, 罕争)
  for (;;) {
    let fd: number | null = null;
    try { fd = openSync(LK, "wx"); } catch { fd = null; } // wx=O_CREAT|O_EXCL, 已被持有则抛
    if (fd !== null) { try { fn(); } finally { try { closeSync(fd); unlinkSync(LK); } catch { /* ignore */ } } return; }
    try { if (Date.now() - statSync(LK).mtimeMs > 10000) { unlinkSync(LK); continue; } } catch { /* 锁刚被释放 → 重试 */ } // 清陈旧锁(持有者崩溃)
    if (Date.now() > deadline) { fn(); return; } // 等不到别死等: 兜底直接做(末读合并+原子写仍最终一致)
    const spin = Date.now() + 5; while (Date.now() < spin) { /* 极短忙等, 单线程 sync, 争用罕见且短 */ }
  }
}
// 落盘: 锁内 X3 末读合并(真互斥, 杜绝丢更新)→ 派生向后兼容 genome/bestFitness → X0 原子写(tmp+rename)。
function writeGlobal(root: string, worldDir: string, avoid: string[], from: string[], cells: Record<string, GlobalCell>): void {
  withGlobalLock(root, () => {
    try { const fresh = loadGlobal(worldDir).cells ?? {}; for (const [k, c] of Object.entries(fresh)) { const ex = cells[k]; if (c.genome && (!ex || c.fitness > ex.fitness)) cells[k] = c; } } catch { /* ignore */ } // X3: 合并别写者刚落的 niche(锁内读)
    let bestGenome: Genome | null = null; let bestFit = -1; // 派生: cells 里 fitness 最高那格(向后兼容旧 reader)
    for (const c of Object.values(cells)) if (c.fitness > bestFit && c.genome) { bestFit = c.fitness; bestGenome = { ...cloneGenome(c.genome), generation: 0 }; }
    try {
      const out = JSON.stringify({ avoid, genome: bestGenome, bestFitness: +Math.max(0, bestFit).toFixed(2), from, cells }, null, 2);
      const tmp = GLOBAL_FILE(root) + ".tmp." + process.pid;
      writeFileSync(tmp, out, "utf8"); renameSync(tmp, GLOBAL_FILE(root)); // X0: 同目录 rename 原子
    } catch { /* ignore */ }
  });
}
// 扫所有在跑世界: ≥2 世界都点过的避雷=跨题材通用套话→全局; 各世界 archive 最优格的基因按引擎策略沉进全局 niche(每 niche 单调留最优)。
export function promoteToGlobal(worldDir: string): void {
  const root = join(worldDir, "..");
  let dirs: string[];
  try { dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && isLiveWorldDir(e.name)).map((e) => e.name); } catch { return; }
  const prev = loadGlobal(worldDir); // 单调基底: 既有 cells/avoid 不被无数据世界清空(清世界后重开仍继承)
  const cells: Record<string, GlobalCell> = { ...(prev.cells ?? {}) }; // ★ C2: 以 prev.cells 为基底
  depositGenome(cells, prev.genome, prev.bestFitness ?? 0, "(global)"); // 旧格式平滑升级: 既有单冠军按引擎策略归格(只在该格空或更优时)
  const counts = new Map<string, number>(); const from: string[] = [];
  for (const p of prev.avoid) counts.set(p, 1);
  for (const d of dirs) {
    try {
      if (existsSync(L_FILE(join(root, d)))) {
        const l = JSON.parse(readFileSync(L_FILE(join(root, d)), "utf8")) as Ledger;
        if (Array.isArray(l.avoid) && l.avoid.length) { from.push(d); for (const a of l.avoid) counts.set(a.p, (counts.get(a.p) ?? 0) + 1); }
      }
    } catch { /* ignore */ }
    depositWorldArchive(root, d, cells); // ★ C1: 该世界 archive 最优格基因 → 按引擎策略沉进全局 niche, 逐 niche max
  }
  const avoid = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p).slice(0, 60); // 各世界并集, 跨世界频次高者优先(≥2=真通用排最前)
  writeGlobal(root, worldDir, avoid, from, cells);
}
// 一次性引种: 扫【所有】世界目录(含 -killed/-raced 归档)的 archive → 沉进全局 cells。用于升级时把被 kill 世界(如 arcsaga-killed 的群像配方)的精英补进全局, 之后 promoteToGlobal 只扫在跑世界、靠 prev.cells 基底留住引种结果。幂等。
export function bootstrapGlobalCells(worldDir: string): { added: number; cells: string[] } {
  const root = join(worldDir, "..");
  let dirs: string[];
  try { dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "worlds").map((e) => e.name); } catch { return { added: 0, cells: [] }; }
  const prev = loadGlobal(worldDir);
  const cells: Record<string, GlobalCell> = { ...(prev.cells ?? {}) };
  const before = Object.keys(cells).length;
  depositGenome(cells, prev.genome, prev.bestFitness ?? 0, "(global)");
  for (const d of dirs) depositWorldArchive(root, d, cells);
  writeGlobal(root, worldDir, prev.avoid ?? [], prev.from ?? [], cells);
  return { added: Object.keys(cells).length - before, cells: Object.keys(cells) };
}

// ── novelty 探索: 选一个未点亮的风格格作目标(优先沿最强格的语气扫节奏轴→再branch相邻语气), 逼 archive 多样化 ──
export function pickTarget(archive: Cell[]): { tone: string; rhythm: string } | null {
  if (archive.length === 0) return null; // 首卷自然成型, 不强推
  const filled = new Set(archive.map((c) => c.key));
  const best = [...archive].sort((a, b) => b.fitness - a.fitness)[0]!;
  for (const r of RHYTHMS) if (!filled.has(`${best.tone}×${r}`)) return { tone: best.tone, rhythm: r }; // 锚定强格语气, 先扫节奏(最连贯)
  for (const t of (GENTLE ? GENTLE_TONES : TONES)) for (const r of RHYTHMS) if (!filled.has(`${t}×${r}`)) return { tone: t, rhythm: r }; // 该语气满→探索相邻语气(温情向只探温情亲和语气)
  return null; // 15 格全满
}
function styleDirective(t: { tone: string; rhythm: string }): string {
  return `【本卷风格探索】本卷有意识地偏向「${t.tone}」的语气基调与「${t.rhythm}」的叙事节奏——${RHYTHM_HINT[t.rhythm] ?? ""}；在不突兀、不违背世界基调的前提下，让这一卷与往卷有可感的风格区别。`;
}

// ── 注入下一卷的进化指引(全局记忆 + 可选 novelty 风格探索) ──
export function buildGuidance(l: Ledger, g?: Genome, globalAvoid: string[] = []): string {
  const parts: string[] = [];
  const localTop = [...l.avoid].sort((a, b) => (b.hits ?? 1) - (a.hits ?? 1)).slice(0, 20).map((a) => a.p); // 高频(ExpeL投票)优先
  const avoid = [...new Set([...localTop, ...globalAvoid])].slice(0, 30); // 本地高频 + 全局通用补足, 去重
  if (avoid.length) parts.push(`【避免·已被用滥的表达，换新说法勿复用】${avoid.join("、")}`);
  if (l.amplify.length) parts.push(`【发扬·已验证有效的写法】${l.amplify.slice(-6).join("；")}`);
  if (l.directives.length) parts.push(`【本卷重点修正】${l.directives.slice(0, 4).join("；")}`);
  if (g?.targetStyle) parts.push(styleDirective(g.targetStyle));
  return parts.join("\n");
}

export function fitnessOf(r: Rubric): number {
  return +(r.freshness * 0.28 + r.hook * 0.18 + r.character * 0.16 + r.pacing * 0.14 + r.dialogue * 0.12 + r.coherence * 0.12).toFixed(2);
}

// ── 确定性客观指标(无 LLM；F/R 分离：这些只用于打分/归格，绝不进生成提示) ──
export function metricsOf(text: string, avoid: string[]): { sentLenMean: number; dialogueRatio: number; ttr: number; repetition: number; avoidHits: number; len: number } {
  const compact = text.replace(/\s+/g, "");
  const sents = text.split(/[。！？!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const lens = sents.map((s) => s.replace(/\s+/g, "").length).filter((n) => n > 0);
  const sentLenMean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const dialogueRatio = sents.length ? sents.filter((s) => /[“”「」"']/.test(s)).length / sents.length : 0;
  const chars = [...compact];
  const bigrams: string[] = []; for (let i = 0; i < chars.length - 1; i++) bigrams.push(chars[i]! + chars[i + 1]!);
  const ttr = bigrams.length ? new Set(bigrams).size / bigrams.length : 0;
  const grams: string[] = []; for (let i = 0; i < chars.length - 3; i++) grams.push(chars.slice(i, i + 4).join(""));
  const seen = new Set<string>(); let rep = 0; for (const g of grams) { if (seen.has(g)) rep++; else seen.add(g); }
  const repetition = grams.length ? rep / grams.length : 0;
  const avoidHits = avoid.reduce((n, p) => n + (p && text.includes(p) ? 1 : 0), 0);
  return { sentLenMean, dialogueRatio, ttr, repetition, avoidHits, len: compact.length };
}
function objectiveScore(m: ReturnType<typeof metricsOf>): number {
  const repScore = (1 - Math.min(1, m.repetition * 4)) * 10; // 重复越低越高(中文散文 ~0.09 属正常)
  const ttrScore = Math.min(1, m.ttr * 2) * 10; // 词汇多样性
  const dlgScore = (1 - Math.min(1, Math.abs(m.dialogueRatio - 0.3) / 0.35)) * 10; // 对白占比~0.3 为佳
  const avoidPenalty = Math.min(2.5, m.avoidHits * 0.3); // 轻惩罚(上限2.5)：旧章含的是事后才加入避雷表的雷，不该重罚
  return Math.max(0, +(0.4 * repScore + 0.3 * ttrScore + 0.3 * dlgScore - avoidPenalty).toFixed(2));
}
function pctile(arr: number[], p: number): number { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor((s.length - 1) * p)))] ?? 0; }
// 节奏分箱：按本世界历史句长的 34/67 分位自适应(narrow 题材也能三分)；历史<4 卷时回退固定阈值。
function rhythmBin(sentLenMean: number, hist: number[]): string {
  if (hist.length >= 4) { const lo = pctile(hist, 0.34), hi = pctile(hist, 0.67); return sentLenMean < lo ? "急促" : sentLenMean <= hi ? "均衡" : "绵长"; }
  return sentLenMean < 16 ? "急促" : sentLenMean < 26 ? "均衡" : "绵长";
}

// ── 批评(LLM rubric + 滥用表 + 亮点 + 修正 + 风格描述子) ──
export async function critique(llm: LLMProvider, sys: string, chapters: Array<{ goal: string; text: string }>): Promise<{ rubric: Rubric; overused: string[]; wins: string[]; fixes: string[]; tone: string; conflict: string }> {
  const sample = chapters.map((c, i) => `【第${i + 1}章《${c.goal}》】\n${c.text.slice(0, 1300)}`).join("\n\n");
  const raw = await llm.complete(
    `${sys}\n你现在是严格的文学编辑，审阅最近 ${chapters.length} 章。只输出 JSON(不要解释/代码块)：\n{\n "rubric": {"freshness":1-10,"pacing":1-10,"dialogue":1-10,"hook":1-10,"coherence":1-10,"character":1-10},\n "overused": [3-6 个被用滥的具体词/比喻/句式开头，原样摘录],\n "wins": [2-3 个有效写法],\n "fixes": [2-3 条下一卷可执行修正],\n "tone": 从[${TONES.join("/")}]里选最贴切的一个语气基调,\n "conflict": 从[${CONFLICTS.join("/")}]里选最主导的冲突类型\n}${GENTLE ? "\n【本作为温情/启发向，非爽文：按温情标准评分——freshness=新鲜真切的观察与意境(非情节新奇)、pacing=从容张弛与留白(慢而有味为佳、不催不赶)、hook=章节的余韵回味(非悬念钩子)、dialogue=对白的自然与言外之意、character=人物的真切与人情温度、coherence=气脉连贯。冲突强弱不计分；温润克制、能打动人、有余味者为上品，堆砌煽情或空灵辞藻者打低分。】" : ""}\n评分拉开差距、敢打低分。\n\n${sample}`,
    { thinking: false, temperature: 0.3 },
  );
  const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as Record<string, unknown>;
  const r = (j["rubric"] ?? {}) as Record<string, unknown>;
  const num = (x: unknown, d = 5): number => (typeof x === "number" && x >= 0 && x <= 10 ? x : d);
  const strs = (x: unknown, n: number): string[] => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string" && y.length > 0).slice(0, n) : []);
  const pick = (x: unknown, set: string[]): string => (typeof x === "string" && set.includes(x) ? x : (set.find((s) => typeof x === "string" && (x as string).includes(s)) ?? set[0]!));
  return {
    rubric: { freshness: num(r["freshness"]), pacing: num(r["pacing"]), dialogue: num(r["dialogue"]), hook: num(r["hook"]), coherence: num(r["coherence"]), character: num(r["character"]) },
    overused: strs(j["overused"], 6), wins: strs(j["wins"], 3), fixes: strs(j["fixes"], 3),
    tone: pick(j["tone"], TONES), conflict: pick(j["conflict"], CONFLICTS),
  };
}

// ── LLM 提议变异(自由调参，带边界裁剪与确定性兜底) ──
async function mutateGenome(llm: LLMProvider, parent: Genome, engineBase: EngineGenes, reflection: string): Promise<Genome> {
  const child = cloneGenome(parent); child.generation = parent.generation + 1;
  child.engine = { ...DEFAULT_GENOME.engine, ...engineBase }; // engine 取世界级最优(解耦于风格父本 → 风格精英化不再拖拽模拟旋钮), 下面只在此基础上微调
  const e = child.engine;
  try {
    const raw = await llm.complete(
      `你在为「小说世界模拟器」调参。两类基因：\n[文笔] temperature=${parent.gen.temperature}, frequencyPenalty=${parent.gen.frequencyPenalty}, presencePenalty=${parent.gen.presencePenalty}\n[模拟] priorWeight=${e.priorWeight}(命理先验引导强度) scarcity=${e.scarcity}(资源稀缺度: 0自由积累→1零和竞争, 催生派系生态/寄生分工) conflictRate=${e.conflictRate}(冲突张力增益) eventBias=${e.eventBias}(大事触发倾向) turnoverRate=${e.turnoverRate}(人物登场/陨落代谢, 偏低则人物更长寿、群像不易坍塌) nicheWeight=${e.nicheWeight}(生态位分工加分: 鼓励派系内角色职能互补) structureGrowth=${e.structureGrowth}(派系分裂/新生倾向)${GENTLE ? ` moveBias=${e.moveBias}(角色自发迁徙/换地频率: 高→多游历、换景遇新人, 低→安土重迁、人来人往)` : ""}\n最近评审：${reflection}\n${GENTLE ? "据反馈微调(只动 1-2 个键；每个幅度≤0.15)。本世界为温情/启发向：目标是温润质感、人情真切、克制与余韵；模拟旋钮务必守低冲突慢节奏——conflictRate/eventBias 宜偏低(≤0.7)、绝不为提戏剧而升, structureGrowth/scarcity 也宜低。moveBias(自发位移)据场景流动感微调: 久黏同一处可略升、角色乱跑失了温情留白则略降, 守 [0.05,0.22]。" : "据反馈提议小幅调整(只动 1-3 个键；文笔每个幅度≤0.2、模拟每个≤0.25)，目标同时提升文笔质量与「世界涌现的戏剧性/丰富度/群像存活」。"}只回 JSON(只列你要改的键)：{"scarcity":数,"conflictRate":数,...}`,
      { thinking: false, temperature: 0.5 },
    );
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as Record<string, unknown>;
    const clamp = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === "number" && v >= lo && v <= hi ? +v.toFixed(2) : d);
    child.gen.temperature = clamp(j["temperature"], 0.7, 1.5, parent.gen.temperature);
    child.gen.frequencyPenalty = clamp(j["frequencyPenalty"], 0, 0.8, parent.gen.frequencyPenalty);
    child.gen.presencePenalty = clamp(j["presencePenalty"], 0, 0.7, parent.gen.presencePenalty);
    child.engine.priorWeight = clamp(j["priorWeight"], 0.5, 1.6, e.priorWeight);
    child.engine.scarcity = clamp(j["scarcity"], 0, 1, e.scarcity);
    child.engine.conflictRate = clamp(j["conflictRate"], 0.5, 1.8, e.conflictRate);
    child.engine.eventBias = clamp(j["eventBias"], 0.5, 2.0, e.eventBias);
    child.engine.turnoverRate = clamp(j["turnoverRate"], 0.4, 1.6, e.turnoverRate);
    child.engine.nicheWeight = clamp(j["nicheWeight"], 0, 1, e.nicheWeight);
    child.engine.structureGrowth = clamp(j["structureGrowth"], 0, 1, e.structureGrowth);
    if (GENTLE) { // 温情向: engine 软上限压低 + 每代向温和锚收 10%(破「奖戏剧」棘轮, 即便误升也自然回落到温和)
      const toward = (k: number, a: number, hi: number): number => +Math.min(hi, a + (k - a) * 0.9).toFixed(2);
      child.engine.conflictRate = toward(child.engine.conflictRate, 0.6, 1.05);
      child.engine.eventBias = toward(child.engine.eventBias, 0.7, 1.0);
      child.engine.scarcity = +Math.min(0.4, child.engine.scarcity).toFixed(2);
      child.engine.structureGrowth = +Math.min(0.4, child.engine.structureGrowth).toFixed(2);
      // move 节奏【锚定式自进化】(用户选): LLM 仍可提议(界内), 但每代把结果朝本世界 premise 锚 moveBiasAnchor(游历0.20/定居0.15/隐居0.08)收 66%、只留 34% 漂移 → 防 LLM 把所有温情世界收敛到公共0.15、保各世界节奏分化。clamp[0.05,0.22] 防回归move=0 & 防过量稀释。经 engineNiche 落安步/缓行/游历 niche。爽文 !GENTLE 不进此块→moveBias 保持 0→逐字节不变。
      const _mvProp = clamp(j["moveBias"], 0.05, 0.22, e.moveBias > 0 ? e.moveBias : e.moveBiasAnchor);
      child.engine.moveBias = +Math.min(0.22, Math.max(0.05, e.moveBiasAnchor + (_mvProp - e.moveBiasAnchor) * 0.34)).toFixed(2);
    }
  } catch {
    child.gen.temperature = Math.max(0.7, Math.min(1.5, +(parent.gen.temperature + 0.05).toFixed(2))); // 兜底微扰
  }
  return child;
}

// MAP-Elites 选父：70% 利用强格(前3随机)，30% 探索(随机格)
function selectParent(archive: Cell[], fallback: Genome): Genome {
  if (archive.length === 0) return fallback;
  const sorted = [...archive].sort((a, b) => b.fitness - a.fitness);
  const cell = Math.random() < 0.7 ? sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]! : archive[Math.floor(Math.random() * archive.length)]!;
  return cell.genome;
}

// ── 一次进化：评估(混合) → 放进 MAP-Elites 存档 → 更新账本 → 选父+变异出下卷基因 → 落盘 ──
export async function evolveOnce(llm: LLMProvider, sys: string, dir: string, vol: number, chapters: Array<{ goal: string; text: string }>): Promise<{ genome: Genome; ledger: Ledger; guidance: string; report: string }> {
  const ledger = loadLedger(dir);
  const archive = loadArchive(dir);
  const cur = loadGenome(dir); // 这些章节是用 cur 写的

  const c = await critique(llm, sys, chapters);
  const m = metricsOf(chapters.map((x) => x.text).join("\n"), ledger.avoid.map((a) => a.p));
  const llmFit = fitnessOf(c.rubric);
  const objFit = objectiveScore(m);
  const lens = ledger.scores.map((s) => s.len).filter((n) => n > 0);
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const cn = loadCanon(dir);
  const castSize = Object.keys(cn.characters ?? {}).length;
  const repThreshold = 0.15 + Math.min(0.12, castSize * 0.006); // 群像豁免: 人物越多, 实体/人名复现越正常, 重复阈值随之放宽(4人≈0.17, 14人≈0.23, 上限0.27)
  const antiProxy = (avgLen > 0 && m.len > avgLen * 1.6) || m.repetition > repThreshold || m.dialogueRatio > 0.55 || m.ttr > 0.62; // 刷分嫌疑: 长度暴涨/重复飙升/对白堆砌(>55%)/碎句刷词汇多样(ttr>0.62) — 覆盖 obj 的可刷代理指标
  const consFit = (() => { const a = typeof cn.lastConsistency === "number" ? cn.lastConsistency : 5; const b = typeof cn.lastForeshadow === "number" ? cn.lastForeshadow : 5; return +((a + b) / 2).toFixed(1); })(); // 缺省取保守 5(未测≠及格8: 防白送地板污染跨卷/跨世界比较)
  // 模拟层 fitness(longrun 在 evolveOnce 前算好存盘): 世界本身够不够有戏(story-sifting+派系张力+新颖度)。有则作主驱动之一, 无则退回纯作者层混合。
  const sf = loadSimFitness(dir);
  const simFit = sf ? sf.total : null;
  const wf = GENTLE ? loadWarmFit(dir) : null; // T3: 温情专属 fitness(场景多样/关系暖/人情/善了), longrun 每 8 章算好存盘
  if (simFit !== null && !GENTLE && (!ledger.bestEngine || simFit > ledger.bestEngine.sim)) ledger.bestEngine = { engine: { ...cur.engine }, sim: simFit }; // engine 按 simFit 单独进化(温情向 GENTLE 不追戏剧最优 engine、不更新 bestEngine → 锚住温和基因, 破棘轮)
  let fitness = (simFit !== null && !GENTLE) // 温情自进化: 温润世界不奖 simFit(戏剧密度), 改奖 warmFit(温情专属) → 进化长期偏好多样/暖, 把 T2 逐章纠偏沉淀进基因
    ? +(0.42 * llmFit + 0.18 * objFit + 0.12 * consFit + 0.28 * simFit).toFixed(2) // 作者层(文笔+客观+一致) + 模拟层(simFit 28%)
    : (GENTLE && wf) // 温情向且有 warmFit: 把 simFit 的位置让给 warmFit·30%(W_var 权重最高 → 直接对坍塌施压)
      ? +(0.45 * llmFit + 0.15 * objFit + 0.10 * consFit + 0.30 * wf.total).toFixed(2)
      : +(0.6 * llmFit + 0.25 * objFit + 0.15 * consFit).toFixed(2);
  if (antiProxy) fitness = +(fitness * 0.8).toFixed(2);

  const rhythm = rhythmBin(m.sentLenMean, ledger.scores.map((s) => s.slm).filter((n): n is number => typeof n === "number" && n > 0));
  const key = `${c.tone}×${rhythm}`;
  const prev = archive.find((x) => x.key === key);
  let placed: string;
  if (!prev) { archive.push({ key, tone: c.tone, rhythm, conflict: c.conflict, genome: cloneGenome(cur), fitness, at: `v${vol}` }); placed = `★新格 ${key}`; }
  else if (fitness > prev.fitness) { prev.genome = cloneGenome(cur); const old = prev.fitness; prev.fitness = fitness; prev.conflict = c.conflict; prev.at = `v${vol}`; placed = `↑刷新 ${key}(${old}→${fitness})`; }
  else placed = `${key} 未超精英(${fitness}≤${prev.fitness})`;

  // 账本：避雷增长+衰老；发扬/修正滚动；评分入时间线
  for (const a of ledger.avoid) a.age += 1;
  const aidx = new Map(ledger.avoid.map((a, i) => [a.p, i]));
  for (const p of c.overused) { const i = aidx.get(p); if (i !== undefined) { ledger.avoid[i]!.age = 0; ledger.avoid[i]!.hits = (ledger.avoid[i]!.hits ?? 1) + 1; } else ledger.avoid.push({ p, age: 0, hits: 1 }); } // 再现=upvote+复活
  ledger.avoid = ledger.avoid.filter((a) => a.age < 6 + Math.min(8, ((a.hits ?? 1) - 1) * 2)).slice(-50); // 高频套话保留更久
  ledger.amplify = [...ledger.amplify, ...c.wins].slice(-12);
  ledger.directives = c.fixes;
  ledger.scores.push({ vol, gen: cur.generation, fitness, llm: llmFit, obj: objFit, cell: key, len: m.len, slm: +m.sentLenMean.toFixed(1), rep: +m.repetition.toFixed(3), dlg: +m.dialogueRatio.toFixed(3), ttr: +m.ttr.toFixed(3), avoidHits: m.avoidHits, ...c.rubric });

  // 选父 + 变异 → 下卷基因
  const simReflect = sf
    ? ` 模拟层${sf.total}/10(故事链${sf.sift.score}·派系张力${sf.tension.score}·新颖${(sf.novelty * 10).toFixed(1)}；极化${sf.tension.polarization}/势均${sf.tension.balance}/交锋${sf.tension.directness}/化解${sf.tension.resolution}/在场派系${Object.keys(sf.sift.patterns).length}型戏)。${GENTLE ? "本世界温情/启发向：低张力、戏剧密度低是【健康态】(不是病)——conflictRate/eventBias 宜守低(≤0.7)、绝勿为提戏剧而升；仅冲突/大事过密(张力>6)才略回降。人物自然生老病死即可、不硬造冲突。" : `${sf.tension.score < 4 ? "⚠世界张力低/疑人物坍塌→宜降 turnoverRate、升 structureGrowth/scarcity 让派系活起来；" : ""}${sf.sift.score < 4 ? "戏剧密度低→宜升 conflictRate/eventBias；" : ""}`}`
    : "";
  const reflection = `适应度${fitness}(LLM${llmFit}/客观${objFit})。修正：${c.fixes.join("；") || "无"}。客观：重复率${(m.repetition * 100).toFixed(1)}%、对白${(m.dialogueRatio * 100).toFixed(0)}%、词汇多样${(m.ttr * 100).toFixed(0)}%、命中避雷${m.avoidHits}。${simReflect}${antiProxy ? "⚠长度/重复疑似刷分(已打折)" : ""}`;
  const next = await mutateGenome(llm, selectParent(archive, cur), ledger.bestEngine?.engine ?? cur.engine, reflection); // gen 取风格父本、engine 取世界级最优(解耦)
  const target = pickTarget(archive); if (target) next.targetStyle = target; // novelty: 逼填未点亮的风格格

  saveGenome(dir, next); saveArchive(dir, archive); saveLedger(dir, ledger);
  promoteToGlobal(dir); // 把本世界新学到的提升进全局传承层(提升整个引擎)
  const tstr = next.targetStyle ? ` · 探索→${next.targetStyle.tone}×${next.targetStyle.rhythm}` : "";
  return {
    genome: next, ledger, guidance: buildGuidance(ledger, next, loadGlobal(dir).avoid),
    report: `适应度${fitness}(LLM${llmFit}+客观${objFit}+一致${consFit}${simFit !== null ? "+模拟" + simFit : ""}${antiProxy ? "·打折" : ""}) · ${placed} · 存档${archive.length}/${TONES.length * RHYTHMS.length}格${tstr} · 下卷 temp${next.gen.temperature}/prior${next.engine.priorWeight}/稀缺${next.engine.scarcity}/冲突${next.engine.conflictRate}/代谢${next.engine.turnoverRate}/生态位${next.engine.nicheWeight}/结构${next.engine.structureGrowth}${GENTLE ? "/位移" + next.engine.moveBias : ""} · 避雷${ledger.avoid.length}`,
  };
}

// ── CLI(仅作入口): 评估某世界最近 N 章并进化一次 ──
if (process.argv[1]?.endsWith("evolve.ts")) {
  void (async (): Promise<void> => {
    const { openDb } = await import("../core/services/db");
    const store = await import("../core/services/store");
    const { makeLLM } = await import("./llm-factory");
    const { PACK } = await import("./pack-select");
    const dir = join(fileURLToPath(new URL(".", import.meta.url)), "..", ".novel-output", process.env["NOVEL_SAGA_DIR"] ?? "saga");
    const db = openDb(join(dir, "world.db"));
    const all = store.readChapters(db, "saga").filter((c) => c.id.startsWith("saga-ch-"));
    const chs = all.slice(-Number(process.env["EVOLVE_N"] ?? 8));
    if (chs.length === 0) { console.error("无章节可评。"); process.exit(1); }
    const sys = PACK.composeProfile?.systemPrompt ?? "你是一位小说作者。";
    const out = await evolveOnce(makeLLM(), sys, dir, Math.ceil(all.length / 25), chs);
    console.log("【进化报告】", out.report);
    console.log("【注入指引】\n" + (out.guidance || "(无)"));
  })();
}
