// app/evolve.ts v2 — 质量-多样性自进化(MAP-Elites / QDAIF 路线)。app 层；core/ 只读通用 tuning 数值。
// 把 v1「单一适应度 + 单点爬山」升级为：
//   · MAP-Elites 存档：按「语气×节奏」风格网格，每格留该风格下最优精英(基因)，结构性防模式坍塌。
//   · 混合评估：LLM 评委 rubric + 确定性客观指标(重复率/对白占比/词汇多样性/避雷命中)。客观指标只用于打分，绝不进生成提示(F/R 分离，防刷分)。
//   · LLM 提议变异：变异 LLM 读分项反思自由调参(带边界裁剪与确定性兜底)，取代固定旋钮轮换。
//   · 反自欺守门：长度暴涨/重复率飙升 → 适应度打折(抑制讨好评委的伪信号)。
//   · 全局记忆账本：避雷(年龄衰减)/发扬/重点修正，注入下一卷生成。
import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, openSync, closeSync, unlinkSync, statSync } from "node:fs";
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·atomicWrite] 同目录 rename 原子·防 torn-write 记忆清零(evolve侧·A6避让区由主线补)
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashStr } from "../core/util/rng"; // FNV-1a 先例复用(进化层一切随机决策的确定性来源; 红线: 禁新增 Math.random/Date.now)
import type { LLMProvider } from "../core/services/llm";
import { loadCanon } from "./canon";
import { loadSimFitness } from "./sim-fitness";
import { loadWarmFit } from "./warm-fitness"; // T3 温情专属 fitness(GENTLE 折进基因, 破坍塌; 爽文不读)

// engine = 模拟层旋钮(core 从 props.tuning.* 通用读取; 默认值 = 现状行为, 进化才拨动)。
//   priorWeight 八字/奇门引导强度 · scarcity 资源稀缺度(0自由积累→1零和竞争) · conflictRate 冲突/张力增益
//   eventBias 大事触发倾向 · turnoverRate 登场/陨落代谢率 · nicheWeight 生态位分工加分 · structureGrowth 派系分裂/新生倾向
//   moveBias 自发空间位移偏置(默认0=现状; move 候选无 targetIds 拿不到互动红利 flat+0.3、天生选不中→恒 move=0, 故需评分后偏置破 0; 温情专属经 drama 注入、爽文默认0 逐字节不变)
//   moveBiasAnchor premise 锚(各世界不同: 游历0.20/定居0.15/隐居0.08; 创世时种、跨代不变异)。mutateGenome 每代把 moveBias 朝它收→防 LLM 把所有温情世界收敛到公共0.15、保各自节奏分化(用户选「锚定式」)。
export interface EngineGenes { priorWeight: number; scarcity: number; conflictRate: number; eventBias: number; turnoverRate: number; nicheWeight: number; structureGrowth: number; moveBias: number; moveBiasAnchor: number; elderRetention: number }
export interface Genome {
  // topP=死键[P0-5]: 不在变异空间(mutateGenome 的 clamp 表无它·prompt 不提它·LLM 提议被忽略), 但字段保留——longrun:278 仍把它发给采样接口, 剔字段=top_p 不再下发=爽文采样行为变(违零变红线); 读取向后兼容。
  gen: { temperature: number; topP: number; frequencyPenalty: number; presencePenalty: number };
  engine: EngineGenes;
  generation: number;
  targetStyle?: { tone: string; rhythm: string }; // 本卷 novelty 探索目标(逼填未点亮的风格格)
}
export interface Rubric { freshness: number; pacing: number; dialogue: number; hook: number; coherence: number; character: number }
// [P1-3] avoid 账 v2 条目(只落数据层·不 enforce)。向后兼容: 旧条目仅 {p,age,hits}, v2 字段懒回填。
//   状态机 requested→observe→enforced→retired 中, 本文件只写 requested(入账)与 retired(auditAvoid 连续2窗 textHits=0);
//   observe/enforced 须 W6 人签链(危害界: kernelLen<4 永不 enforced), 永不在此自动写。
export interface AvoidEntry { p: string; age: number; hits?: number; kernel?: string; textHits?: number; llmVotes?: number; status?: "requested" | "observe" | "enforced" | "retired"; guards?: { kernelLen: number; pass: boolean }; zeroWins?: number }
export interface Ledger {
  avoid: AvoidEntry[]; // hits=跨卷再现次数(ExpeL 式投票, 高频=真通用套话)
  amplify: string[];
  directives: string[];
  // win/judged=[P0-6③]两窗驻留遥测(win1=驻留窗·win2 带两窗均值 judged); crit=[P0-3]仅当有采样解析失败时落 {failed:true} 占位(防轨迹暗洞), 全成功不落=schema 同现状
  scores: Array<{ vol: number; gen: number; fitness: number; llm: number; obj: number; cell: string; len: number; slm: number; rep: number; dlg: number; ttr: number; avoidHits: number; win?: 1 | 2; judged?: number; crit?: Array<{ llm: number } | { failed: true }> } & Rubric>;
  bestEngine?: { engine: EngineGenes; sim: number }; // 世界级最优模拟旋钮(按 simFit 单独进化, 与风格格解耦 → 不被风格精英化拖拽、跨 15 格共享)。[P1-5 砍项]判据禁动: trial 上线即退役为遥测。
  pendingWindow?: { gen: number; vol: number; fitness: number }; // [P0-6③] hill 两窗驻留(8→16章): 窗1适应度暂存, 窗2取两窗均值再判
}
export interface Cell { key: string; tone: string; rhythm: string; conflict: string; genome: Genome; fitness: number; at: string }

const G_FILE = (d: string): string => join(d, "genome.json");
const L_FILE = (d: string): string => join(d, "evolution.json");
const A_FILE = (d: string): string => join(d, "archive.json");
// [轴Ⅱ trial 钩子·蓝图§4.2/§4.6] trial 模式三文件: 候选池(evolveOnce append) / 裁决(runner+人写, humanSigned 必须 true) / 采纳状态(按卷号幂等)
const T_CAND = (d: string): string => join(d, "trial-candidates.json");
const T_VERDICT = (d: string): string => join(d, "trial-verdict.json");
const T_STATE = (d: string): string => join(d, "trial-state.json");

const TONES = ["冷峻", "热血", "诙谐", "悲悯", "悬疑"];
const CONFLICTS = ["动作", "权谋", "情感", "解谜", "生存"];
const RHYTHMS = ["急促", "均衡", "绵长"];
// 温情自进化: NOVEL_STYLE=温润 的世界, 自进化奖「温情质感」而非「戏剧密度」——fitness 不奖 simFit、变异守低冲突、simReflect「低张力=健康态」、critique 温情 rubric、pickTarget 只探温情语气。爽文世界 GENTLE=false → 全程逐字节同现状(向后兼容)。与 longrun 同进程同源(process.env)。
const GENTLE = process.env["NOVEL_STYLE"] === "温润";
// [轴Ⅱ trial 钩子] NOVEL_EVOLVE_MODE: "hill"(默认=现状爬山, evolveOnce 直接 saveGenome 上岗子代) / "trial"(子代+死角候选只 append 进 trial-candidates.json,
//   genome.json 唯一写者=adoptVerdict(人签 verdict·按卷号幂等))。hill 默认路径不读 trial 三文件、行为与现状一致。
const EVOLVE_MODE: "hill" | "trial" = process.env["NOVEL_EVOLVE_MODE"] === "trial" ? "trial" : "hill";
// [P1-5·粗档变异 gate·默认关] ="1": conflictRate 落 {0.6,1.0,1.4} 三挡、其余连续键量化到 0.2 网格(步长粗化×2, 挡距≥臂内 σ 检测地板; ±0.15 微调类候选不再生成)。
//   默认关=恒等映射→现状逐字节, 守「爽文 GENTLE=false 行为零变」红线; W7 canary 开窗后再 env 上岗。
const MUT_COARSE = process.env["NOVEL_MUT_COARSE"] === "1";
// [P0-3] critique 采样数: 默认 3=median-of-3 降噪(σ_llm≈÷√3); NOVEL_CRITIQUE_N=1 回退单采样(=现状路径)。token 只作 FYI(≈¥0.1/窗)。
const CRIT_N = Math.max(1, Math.min(5, Math.floor(Number(process.env["NOVEL_CRITIQUE_N"] ?? "3")) || 3));
const FV = 1; // fitness 公式版本戳(P0-8 起头): 候选/裁决跨公式版本不可比, 先盖戳
export const genomeHash = (g: Genome): string => hashStr(JSON.stringify(g)).toString(16); // FNV-1a 基因指纹(本文件写入器字段序稳定→同基因同哈希); runner/verdict 引用
const GENTLE_TONES = ["悲悯", "冷峻"]; // pickTarget 在温情向只在温情亲和语气里探索(排除热血/诙谐/悬疑)
const RHYTHM_HINT: Record<string, string> = { "急促": "本卷明显多用短句与断句、节奏紧促有力", "均衡": "本卷句子明显拉长一档、适度多用复句，节奏放缓但不拖沓", "绵长": "本卷多用舒展长句与复句、从容铺陈" };

export const DEFAULT_GENOME: Genome = {
  gen: { temperature: 1.0, topP: 0.95, frequencyPenalty: 0.4, presencePenalty: 0.3 },
  engine: { priorWeight: 1.0, scarcity: 0, conflictRate: 1.0, eventBias: 1.0, turnoverRate: 1.0, nicheWeight: 0, structureGrowth: 0, moveBias: 0, moveBiasAnchor: 0.15, elderRetention: 0 }, // 全默认 = 现状行为(不破坏在跑世界); moveBiasAnchor 默认 0.15(未种 premise 锚的回退); elderRetention 默认 0=封顶全退(去饱和·L4, 温情经 GENTLE 变异给~0.5)
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
      const myStyle: "温润" | "爽文" = GENTLE ? "温润" : "爽文"; // [P0-7] 取种者风格(本进程env)
      const root = join(d, ".."); // legacy cell 风格判定用来源目录指纹
      const gl = loadGlobal(d); const mine = Object.values(gl.cells ?? {}).filter((c) => cellStyleOf(c, root) === myStyle); // 只看同风格格
      if (intent && mine.length) { // 按意图取目标 niche 种(同风格内)
        const want = `${intent.turnover ?? ""}×${intent.structure ?? ""}`;
        const hit = mine.find((c) => c.key === want || c.key === `${myStyle}|${want}`) ?? mine.find((c) => !!intent.turnover && c.turnoverBin === intent.turnover) ?? null;
        if (hit?.genome) return bf(hit.genome);
      }
      if (gl.genome && gl.genomeStyle === myStyle) return bf(gl.genome); // 兼容顶槽: 只认显式标(legacy未标顶槽=已知毒源·一律跳过走cells兜底——moveBias推断对"moveBias=0温情引擎"是盲区)
      const bestMine = mine.reduce<GlobalCell | null>((a, c) => (!a || c.fitness > a.fitness ? c : a), null);
      return bestMine?.genome ? bf(bestMine.genome) : cloneGenome(DEFAULT_GENOME); // 同风格无种=默认基因(对跨风格读返回null的落地形)
    }
    const p = JSON.parse(readFileSync(G_FILE(d), "utf8")) as Partial<Genome>;
    return { gen: { ...DEFAULT_GENOME.gen, ...(p.gen ?? {}) }, engine: { ...DEFAULT_GENOME.engine, ...(p.engine ?? {}) }, generation: typeof p.generation === "number" ? p.generation : 0 };
  } catch { return cloneGenome(DEFAULT_GENOME); }
}
export function saveGenome(d: string, g: Genome): void { atomicWrite(G_FILE(d), JSON.stringify(g, null, 2)); }
export function loadLedger(d: string): Ledger {
  try {
    if (existsSync(L_FILE(d))) return { ...emptyLedger(), ...JSON.parse(readFileSync(L_FILE(d), "utf8")) };
    return { ...emptyLedger(), avoid: GENTLE ? [] : loadGlobal(d).avoid.map((p) => ({ p, age: 0 })) }; // 新世界播种全局通用避雷(温润不播种: 全局多爽文 ghost, 温润只用自家温情 critique 攒 avoid, 防起步即空转)
  } catch { return emptyLedger(); }
}
export function saveLedger(d: string, l: Ledger): void { atomicWrite(L_FILE(d), JSON.stringify(l, null, 2)); }
// [P1-3] kernel 提取: 去功能字后最长 CJK run 的头 2-4 字(实词内核, 解决括号句/长摘录恒盲)。简单启发, 不求完美。
const kernelOf = (p: string): string => {
  const cleaned = p.replace(/[的了在是和与又也就都而被把对于地得之乎其者所以及个不没这那很太更最从向]/g, " ");
  const runs = cleaned.match(/[一-鿿]{2,}/g) ?? [];
  const longest = runs.reduce((a, r) => (r.length > a.length ? r : a), "");
  if (longest) return longest.slice(0, 4);
  const cjk = p.replace(/[^一-鿿]/g, "");
  return cjk.slice(0, 4) || p.slice(0, 4);
};
// [P1-3] avoid 账 v2 审计(只落数据层·不 enforce·导出给 longrun 在窗边界接, 本文件不接线):
//   对账本每条统计窗内正文出现总次数写 textHits; 连续 2 窗 textHits=0 → status=retired(留条目不删, 防 ghost 复活循环); v2 字段懒回填兼容旧条目。
//   TODO(W6·人签后才做): enforced 删除路径——textHits≥3×连续2窗 且 kernelLen≥4(防「月光」级常用词误删) → 先一窗 observe(只记 would-delete 不删) → 人签 → edit-pass 删除黑名单(每章≤2处上限)。本函数永不写 observe/enforced。
export function auditAvoid(dir: string, recentTexts: string[]): { checked: number; retired: number } {
  const ledger = loadLedger(dir);
  const text = recentTexts.join("\n");
  let retired = 0;
  for (const a of ledger.avoid) {
    if (!a.kernel) { const k = kernelOf(a.p); a.kernel = k; a.guards = { kernelLen: k.length, pass: k.length >= 4 }; }
    if (a.status === undefined) a.status = "requested";
    let hits = 0; if (a.p) { let i = -1; while ((i = text.indexOf(a.p, i + 1)) !== -1) hits++; }
    a.textHits = hits;
    a.zeroWins = hits === 0 ? (a.zeroWins ?? 0) + 1 : 0;
    if (a.zeroWins >= 2 && a.status !== "retired" && a.status !== "enforced") { a.status = "retired"; retired++; }
  }
  saveLedger(dir, ledger);
  return { checked: ledger.avoid.length, retired };
}
export function loadArchive(d: string): Cell[] { try { return existsSync(A_FILE(d)) ? (JSON.parse(readFileSync(A_FILE(d), "utf8")).cells ?? []) : []; } catch { return []; } }
export function saveArchive(d: string, cells: Cell[]): void { atomicWrite(A_FILE(d), JSON.stringify({ cells }, null, 2)); }

// ── 全局传承层: 跨世界通用避雷 + 跨世界 QD 引擎策略存档(按引擎旋钮分 niche, 每 niche 各留最优, 让局部最优如群像引擎不被单一适应度冠军淹没)。core/ 不涉, 纯 app 层。 ──
// 全局 niche cell: 按引擎策略分格(genotype niching, 零新持久化、不依赖未落盘的表型描述符)。
export interface GlobalCell { key: string; turnoverBin: string; structureBin: string; genome: Genome; fitness: number; from: string; at: string; styleTag?: "温润" | "爽文" }
export interface GlobalEvo { avoid: string[]; genome: Genome | null; genomeStyle?: "温润" | "爽文"; from: string[]; bestFitness: number; cells?: Record<string, GlobalCell> }
// [P0-7·styleTag围栏·.audit/20260610-evolution-overhaul] live bug: 兼容槽=温情格(renjian 8.59)→新建无intent爽文世界直接吃进低冲突温情引擎。
//   围栏三层: ①新沉积 cell 带 styleTag 且键加风格前缀(同格不跨风格互吃) ②顶槽派生带 genomeStyle ③loadGenome 取种/兼容槽只在同风格内命中。
//   legacy cell(无tag)按 moveBias>0→温润 推断(只有 GENTLE 变异会抬 moveBias·确定性); 字段忽略即旧行为=可回滚。
const styleTagOfDir = (root: string, d: string): "温润" | "爽文" => (existsSync(join(root, d, "warm-fitness.json")) || existsSync(join(root, d, "gentle-director.json"))) ? "温润" : "爽文"; // 温润专属落盘文件=目录级风格指纹
const cellStyleOf = (c: GlobalCell, root?: string): "温润" | "爽文" => {
  if (c.styleTag) return c.styleTag;
  if (c.key.startsWith("温润|")) return "温润"; if (c.key.startsWith("爽文|")) return "爽文";
  if (root && c.from && c.from !== "(global)") { try { if (existsSync(join(root, c.from))) return styleTagOfDir(root, c.from); } catch { /* fallthrough */ } } // legacy: 按来源目录指纹(归档目录仍留 warm-fitness.json·比 moveBias 推断可靠——moveBias=0 的温情引擎是推断盲区)
  return ((c.genome?.engine?.moveBias ?? 0) > 0 ? "温润" : "爽文"); // 最后兜底
};
const genomeStyleOf = (g: Genome | null): "温润" | "爽文" => ((g?.engine?.moveBias ?? 0) > 0 ? "温润" : "爽文");
const GLOBAL_FILE = (root: string): string => join(root, "global-evolution.json");
// [P0-0·臂目录预防针] exp-runner 实验臂目录(名称 ^ablate-|^exp$|^blind-|.log$, 或目录内含 .exp-arm marker 文件)绝不可被全局传承层摄入(臂数据≠世界数据)。
//   当前 ablate-*/blind-* 目录本就无 evolution/archive(零摄入), 故此为预防针非止血——global-evolution.json 重算 diff 零变。
const isArmDir = (root: string, n: string): boolean => /^ablate-|^exp$|^blind-|\.log$/.test(n) || existsSync(join(root, n, ".exp-arm"));
const isLiveWorldDir = (root: string, n: string): boolean => !/-killed-|-raced$|-archive/.test(n) && n !== "worlds" && !isArmDir(root, n);
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
    const st = styleTagOfDir(root, d); // [P0-7] 来源世界风格指纹
    const n = engineNiche(g); const key = `${st}|${n.key}`; const ex = cells[key];
    if (!ex || champ.fitness > ex.fitness) cells[key] = { key, turnoverBin: n.turnoverBin, structureBin: n.structureBin, genome: g, fitness: champ.fitness, from: d, at: champ.at, styleTag: st };
  } catch { /* ignore */ }
}
// 把单冠军 genome 按其引擎策略归格(旧格式升级 / 兼容投影)。[P0-7] 风格按 moveBias 推断·键带前缀。
function depositGenome(cells: Record<string, GlobalCell>, g: Genome | null, fit: number, from: string): void {
  if (!g) return; const st = genomeStyleOf(g); const n = engineNiche(g); const key = `${st}|${n.key}`; const ex = cells[key];
  if (!ex || fit > ex.fitness) cells[key] = { key, turnoverBin: n.turnoverBin, structureBin: n.structureBin, genome: { ...cloneGenome(g), generation: 0 }, fitness: fit, from, at: "v0", styleTag: st };
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
      const out = JSON.stringify({ avoid, genome: bestGenome, genomeStyle: genomeStyleOf(bestGenome), bestFitness: +Math.max(0, bestFit).toFixed(2), from, cells }, null, 2); // [P0-7] 顶槽带风格
      const tmp = GLOBAL_FILE(root) + ".tmp." + process.pid;
      writeFileSync(tmp, out, "utf8"); renameSync(tmp, GLOBAL_FILE(root)); // X0: 同目录 rename 原子
    } catch { /* ignore */ }
  });
}
// 扫所有在跑世界: ≥2 世界都点过的避雷=跨题材通用套话→全局; 各世界 archive 最优格的基因按引擎策略沉进全局 niche(每 niche 单调留最优)。
export function promoteToGlobal(worldDir: string): void {
  const root = join(worldDir, "..");
  let dirs: string[];
  try { dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && isLiveWorldDir(root, e.name)).map((e) => e.name); } catch { return; }
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
  try { dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== "worlds" && !isArmDir(root, e.name)).map((e) => e.name); } catch { return { added: 0, cells: [] }; } // [P0-0] 引种含 -killed(故不走 isLiveWorldDir), 但臂目录同样排除
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
  const rhythms = GENTLE ? RHYTHMS.filter((r) => r !== "急促") : RHYTHMS; // [Q1·协同审计] 温润剔"急促"节奏轴: targetStyle"急促"与 PENMANSHIP"舒缓"死锁(每段对撞注入·三温润世界 genome 全中)
  for (const r of rhythms) if (!filled.has(`${best.tone}×${r}`)) return { tone: best.tone, rhythm: r }; // 锚定强格语气, 先扫节奏(最连贯)
  for (const t of (GENTLE ? GENTLE_TONES : TONES)) for (const r of rhythms) if (!filled.has(`${t}×${r}`)) return { tone: t, rhythm: r }; // 该语气满→探索相邻语气(温情向只探温情亲和语气)
  return null; // 15 格全满
}
function styleDirective(t: { tone: string; rhythm: string }): string {
  return `【本卷风格探索】本卷有意识地偏向「${t.tone}」的语气基调与「${t.rhythm}」的叙事节奏——${RHYTHM_HINT[t.rhythm] ?? ""}；在不突兀、不违背世界基调的前提下，让这一卷与往卷有可感的风格区别。`;
}

// ── 注入下一卷的进化指引(全局记忆 + 可选 novelty 风格探索) ──
export function buildGuidance(l: Ledger, g?: Genome, globalAvoid: string[] = []): string {
  const parts: string[] = [];
  const localTop = [...l.avoid].sort((a, b) => (b.hits ?? 1) - (a.hits ?? 1)).slice(0, 20).map((a) => a.p); // 高频(ExpeL投票)优先
  const avoid = [...new Set([...localTop, ...(GENTLE ? [] : globalAvoid)])].slice(0, 30); // 本地高频 + 全局通用补足, 去重。温润品类隔离: 全局 avoid 多由爽文世界沉积(热血/打脸/升级套路), 灌进温润=不相干的"空转避雷"→ 温润只用本世界温情 critique 攒的 avoid, 不吃跨世界 ghost
  if (avoid.length) parts.push(`【避免·已被用滥的表达，换新说法勿复用】${avoid.join("、")}`);
  if (l.amplify.length) parts.push(`【发扬·已验证有效的写法】${l.amplify.slice(-6).join("；")}`);
  if (l.directives.length) parts.push(`【本卷重点修正】${l.directives.slice(0, 4).join("；")}`);
  if (g?.targetStyle && !(GENTLE && g.targetStyle.rhythm === "急促")) parts.push(styleDirective(g.targetStyle)); // [Q1] 消费端兜底: 存量 genome 里已选中的"急促"目标在温润不再注入(与 PENMANSHIP 舒缓死锁)
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
// [P0-3] median-of-N 降噪: 同 prompt 串行采样 CRIT_N 次(默认3, σ_llm≈÷√3; NOVEL_CRITIQUE_N=1 回退单采样=现状路径)。
//   分项数值(freshness/pacing/dialogue/hook/coherence/character)各取中位(下中位·确定性; n=3 即真中位, n=2 取低者——不取均值防半分伪精度);
//   类别字段(overused/wins/fixes/tone/conflict)整组取「适应度中位的那次采样」——严禁并集(overused→avoid 账→guidance 注入连爽文也消费, 并集=avoid 流入×3=行为变)。
//   单次解析失败 → 该次记 {failed:true}(samples 占位, evolveOnce 落 scores 防轨迹暗洞); 全失败 → 抛错走现有失败路径(longrun 捕获跳过本窗)。
export async function critique(llm: LLMProvider, sys: string, chapters: Array<{ goal: string; text: string }>): Promise<{ rubric: Rubric; overused: string[]; wins: string[]; fixes: string[]; tone: string; conflict: string; samples: Array<{ llm: number } | { failed: true }> }> {
  const sample = chapters.map((c, i) => `【第${i + 1}章《${c.goal}》】\n${c.text.slice(0, 1300)}`).join("\n\n");
  const prompt = `${sys}\n你现在是严格的文学编辑，审阅最近 ${chapters.length} 章。只输出 JSON(不要解释/代码块)：\n{\n "rubric": {"freshness":1-10,"pacing":1-10,"dialogue":1-10,"hook":1-10,"coherence":1-10,"character":1-10},\n "overused": [3-6 个被用滥的具体词/比喻/句式开头，原样摘录],\n "wins": [2-3 个有效写法],\n "fixes": [2-3 条下一卷可执行修正],\n "tone": 从[${TONES.join("/")}]里选最贴切的一个语气基调,\n "conflict": 从[${CONFLICTS.join("/")}]里选最主导的冲突类型\n}${GENTLE ? "\n【本作为温情/启发向，非爽文：按温情标准评分——freshness=新鲜真切的观察与意境(非情节新奇)、pacing=从容张弛与留白(慢而有味为佳、不催不赶)、hook=章节的余韵回味(非悬念钩子)、dialogue=对白的自然与言外之意、character=人物的真切与人情温度、coherence=气脉连贯。冲突强弱不计分；温润克制、能打动人、有余味者为上品，堆砌煽情或空灵辞藻者打低分。】" : ""}\n评分拉开差距、敢打低分。\n\n${sample}`;
  const num = (x: unknown, d = 5): number => (typeof x === "number" && x >= 0 && x <= 10 ? x : d);
  const strs = (x: unknown, n: number): string[] => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string" && y.length > 0).slice(0, n) : []);
  const pick = (x: unknown, set: string[]): string => (typeof x === "string" && set.includes(x) ? x : (set.find((s) => typeof x === "string" && (x as string).includes(s)) ?? set[0]!));
  type Shot = { rubric: Rubric; overused: string[]; wins: string[]; fixes: string[]; tone: string; conflict: string };
  const shots: Shot[] = []; const samples: Array<{ llm: number } | { failed: true }> = []; let lastErr: unknown = null;
  for (let i = 0; i < CRIT_N; i++) { // 串行 await(不并发轰判官)
    try {
      const raw = await llm.complete(prompt, { thinking: false, temperature: 0.3 });
      const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as Record<string, unknown>;
      const r = (j["rubric"] ?? {}) as Record<string, unknown>;
      const shot: Shot = {
        rubric: { freshness: num(r["freshness"]), pacing: num(r["pacing"]), dialogue: num(r["dialogue"]), hook: num(r["hook"]), coherence: num(r["coherence"]), character: num(r["character"]) },
        overused: strs(j["overused"], 6), wins: strs(j["wins"], 3), fixes: strs(j["fixes"], 3),
        tone: pick(j["tone"], TONES), conflict: pick(j["conflict"], CONFLICTS),
      };
      shots.push(shot); samples.push({ llm: fitnessOf(shot.rubric) });
    } catch (err) { lastErr = err; samples.push({ failed: true }); }
  }
  if (shots.length === 0) throw (lastErr instanceof Error ? lastErr : new Error("critique 全部采样解析失败"));
  const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[(xs.length - 1) >> 1]!;
  const byFit = [...shots].sort((a, b) => fitnessOf(a.rubric) - fitnessOf(b.rubric)); // 稳定排序, 同分按采样序
  const midShot = byFit[(byFit.length - 1) >> 1]!; // 适应度中位的那次采样 → 类别字段整组取自它
  return {
    rubric: { freshness: med(shots.map((s) => s.rubric.freshness)), pacing: med(shots.map((s) => s.rubric.pacing)), dialogue: med(shots.map((s) => s.rubric.dialogue)), hook: med(shots.map((s) => s.rubric.hook)), coherence: med(shots.map((s) => s.rubric.coherence)), character: med(shots.map((s) => s.rubric.character)) },
    overused: midShot.overused, wins: midShot.wins, fixes: midShot.fixes, tone: midShot.tone, conflict: midShot.conflict,
    samples,
  };
}

// ── LLM 提议变异(自由调参，带边界裁剪与确定性兜底) ──
// [P0-5] topP 死键不在本变异空间(clamp 表无它·prompt 不提它, LLM 提议被忽略→子代恒承父值); GENTLE 下 freq/pres 焊为现值常数(不变异, M2 密度阀门不交给梯度噪声)。
// [P1-5] attribution: 调用方可注入四账摘要+draft/revised 差(归因式反思); 默认空=prompt 逐字节同现状, 向后兼容。MUT_COARSE 见 gear/grid。
async function mutateGenome(llm: LLMProvider, parent: Genome, engineBase: EngineGenes, reflection: string, attribution?: string): Promise<Genome> {
  const child = cloneGenome(parent); child.generation = parent.generation + 1;
  child.engine = { ...DEFAULT_GENOME.engine, ...engineBase }; // engine 取世界级最优(解耦于风格父本 → 风格精英化不再拖拽模拟旋钮), 下面只在此基础上微调
  const e = child.engine;
  try {
    const raw = await llm.complete(
      `你在为「小说世界模拟器」调参。两类基因：\n[文笔] temperature=${parent.gen.temperature}, frequencyPenalty=${parent.gen.frequencyPenalty}, presencePenalty=${parent.gen.presencePenalty}\n[模拟] priorWeight=${e.priorWeight}(命理先验引导强度) scarcity=${e.scarcity}(资源稀缺度: 0自由积累→1零和竞争, 催生派系生态/寄生分工) conflictRate=${e.conflictRate}(冲突张力增益) eventBias=${e.eventBias}(大事触发倾向) turnoverRate=${e.turnoverRate}(人物登场/陨落代谢, 偏低则人物更长寿、群像不易坍塌) nicheWeight=${e.nicheWeight}(生态位分工加分: 鼓励派系内角色职能互补) structureGrowth=${e.structureGrowth}(派系分裂/新生倾向)${GENTLE ? ` moveBias=${e.moveBias}(角色自发迁徙/换地频率: 高→多游历、换景遇新人, 低→安土重迁、人来人往)` : ""}\n最近评审：${reflection}${attribution ? `\n【四账归因】${attribution}\n据归因先自问：这分是基因挣的、还是 edit-pass/导演层每章擦出来的——只朝基因真挣分的方向调参, 干预层补偿出的分不追。` : ""}\n${GENTLE ? "据反馈微调(只动 1-2 个键；每个幅度≤0.15)。本世界为温情/启发向：目标是温润质感、人情真切、克制与余韵；模拟旋钮务必守低冲突慢节奏——conflictRate/eventBias 宜偏低(≤0.7)、绝不为提戏剧而升, structureGrowth/scarcity 也宜低。moveBias(自发位移)据场景流动感微调: 久黏同一处可略升、角色乱跑失了温情留白则略降, 守 [0.05,0.22]。" : "据反馈提议小幅调整(只动 1-3 个键；文笔每个幅度≤0.2、模拟每个≤0.25)，目标同时提升文笔质量与「世界涌现的戏剧性/丰富度/群像存活」。"}只回 JSON(只列你要改的键)：{"scarcity":数,"conflictRate":数,...}`,
      { thinking: false, temperature: 0.5 },
    );
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as Record<string, unknown>;
    const clamp = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === "number" && v >= lo && v <= hi ? +v.toFixed(2) : d);
    // [P1-5·粗档] MUT_COARSE 关(默认)=恒等→现状逐字节。开: grid=连续键量化 0.2 网格(步长粗化×2); gear=conflictRate 三挡 {0.6,1.0,1.4}(挡距≥检测地板, 同距取低挡·确定性)。
    //   GENTLE 锚定键(moveBias/moveBiasAnchor/elderRetention)不量化(锚定语义优先); GENTLE 块在其后照常收锚(三挡经 1.05 帽+0.6 锚收成温情挡)。
    const grid = (v: number, lo: number, hi: number): number => (MUT_COARSE ? +Math.min(hi, Math.max(lo, Math.round(v / 0.2) * 0.2)).toFixed(2) : v);
    const gear = (v: number): number => (MUT_COARSE ? [0.6, 1.0, 1.4].reduce((a, g) => (Math.abs(g - v) < Math.abs(a - v) ? g : a), 0.6) : v);
    child.gen.temperature = grid(clamp(j["temperature"], 0.7, 1.5, parent.gen.temperature), 0.7, 1.5);
    child.gen.frequencyPenalty = GENTLE ? parent.gen.frequencyPenalty : grid(clamp(j["frequencyPenalty"], 0, 0.8, parent.gen.frequencyPenalty), 0, 0.8); // [P0-5] GENTLE 焊死
    child.gen.presencePenalty = GENTLE ? parent.gen.presencePenalty : grid(clamp(j["presencePenalty"], 0, 0.7, parent.gen.presencePenalty), 0, 0.7); // [P0-5] GENTLE 焊死
    child.engine.priorWeight = grid(clamp(j["priorWeight"], 0.5, 1.6, e.priorWeight), 0.5, 1.6);
    child.engine.scarcity = grid(clamp(j["scarcity"], 0, 1, e.scarcity), 0, 1);
    child.engine.conflictRate = gear(clamp(j["conflictRate"], 0.5, 1.8, e.conflictRate));
    child.engine.eventBias = grid(clamp(j["eventBias"], 0.5, 2.0, e.eventBias), 0.5, 2.0);
    child.engine.turnoverRate = grid(clamp(j["turnoverRate"], 0.4, 1.6, e.turnoverRate), 0.4, 1.6);
    child.engine.nicheWeight = grid(clamp(j["nicheWeight"], 0, 1, e.nicheWeight), 0, 1);
    child.engine.structureGrowth = grid(clamp(j["structureGrowth"], 0, 1, e.structureGrowth), 0, 1);
    if (GENTLE) { // 温情向: engine 软上限压低 + 每代向温和锚收 10%(破「奖戏剧」棘轮, 即便误升也自然回落到温和)
      const toward = (k: number, a: number, hi: number): number => +Math.min(hi, a + (k - a) * 0.9).toFixed(2);
      child.engine.conflictRate = toward(child.engine.conflictRate, 0.6, 1.05);
      child.engine.eventBias = toward(child.engine.eventBias, 0.7, 1.0);
      child.engine.scarcity = +Math.min(0.4, child.engine.scarcity).toFixed(2);
      child.engine.structureGrowth = +Math.min(0.4, child.engine.structureGrowth).toFixed(2);
      // [M2·降密度] 温情压采样惩罚上限: frequencyPenalty/presencePenalty 高 → 逼模型不复用词 → 不断换新物象/新感官 → 段内信息密度UP(读着累)。压低让模型敢在同一意象停留、行文疏朗。温情本就要"一两件物反复回扣", 方向一致。
      // [P0-5] 上面已焊死为父值(GENTLE 不变异 freq/pres), 此处帽=既有 M2 不变量: min(帽, 父值) 首代收敛后即恒等→真常数。
      child.gen.frequencyPenalty = +Math.min(0.45, child.gen.frequencyPenalty).toFixed(2);
      child.gen.presencePenalty = +Math.min(0.35, child.gen.presencePenalty).toFixed(2);
      // move 节奏【锚定式自进化】(用户选): LLM 仍可提议(界内), 但每代把结果朝本世界 premise 锚 moveBiasAnchor(游历0.20/定居0.15/隐居0.08)收 66%、只留 34% 漂移 → 防 LLM 把所有温情世界收敛到公共0.15、保各世界节奏分化。clamp[0.05,0.22] 防回归move=0 & 防过量稀释。经 engineNiche 落安步/缓行/游历 niche。爽文 !GENTLE 不进此块→moveBias 保持 0→逐字节不变。
      const _mvProp = clamp(j["moveBias"], 0.05, 0.22, e.moveBias > 0 ? e.moveBias : e.moveBiasAnchor);
      child.engine.moveBias = +Math.min(0.22, Math.max(0.05, e.moveBiasAnchor + (_mvProp - e.moveBiasAnchor) * 0.34)).toFixed(2);
      // [去饱和·L4] 温情封顶留场: elderRetention 每代向 0.5 收(温情正需"留得住人"·老者守渡头是 premise 核心, 把跑步机终点从"清空"变"沉淀")。爽文 !GENTLE 不进此块→保持默认0→全退飞升爽感逐字节不变。
      child.engine.elderRetention = +Math.min(0.6, Math.max(0, (e.elderRetention ?? 0) + (0.5 - (e.elderRetention ?? 0)) * 0.5)).toFixed(2);
    }
  } catch {
    child.gen.temperature = Math.max(0.7, Math.min(1.5, +(parent.gen.temperature + 0.05).toFixed(2))); // 兜底微扰
  }
  return child;
}

// MAP-Elites 选父：70% 利用强格(前3确定性选1)，30% 探索(确定性选任意格)
// [P0-6①] Math.random→FNV1a(seedKey=dir:generation:vol)派生: 同输入同父, 进化血统可重放(红线: 进化层零 Math.random)。导出仅为可重放自测。
export function selectParent(archive: Cell[], fallback: Genome, seedKey: string): Genome {
  if (archive.length === 0) return fallback;
  const sorted = [...archive].sort((a, b) => b.fitness - a.fitness); // 稳定排序: 同 fitness 按存档序, 重放一致
  const h = hashStr(seedKey);
  const exploit = h % 100 < 70;
  const cell = exploit ? sorted[(h >>> 8) % Math.min(3, sorted.length)]! : archive[(h >>> 8) % archive.length]!;
  return cell.genome;
}

// ── [轴Ⅱ trial 钩子·蓝图§4.2/§4.6] 候选池 + 裁决采纳 ──
interface TrialCandidate { genome: Genome; origin: string; vol: number; fv: number; hash: string }
// 候选 append(按 vol+hash 幂等去重, 池上限 40 防无界)。trial 模式下 evolveOnce 经此落候选, 不再 saveGenome 上岗。
function appendTrialCandidates(d: string, entries: Array<{ genome: Genome; origin: string; vol: number }>): number {
  let pool: { candidates: TrialCandidate[] } = { candidates: [] };
  try { if (existsSync(T_CAND(d))) pool = { candidates: [], ...(JSON.parse(readFileSync(T_CAND(d), "utf8")) as Partial<{ candidates: TrialCandidate[] }>) }; } catch { /* 坏档重建 */ }
  let added = 0;
  for (const e of entries) {
    const hash = genomeHash(e.genome);
    if (pool.candidates.some((c) => c.vol === e.vol && c.hash === hash)) continue; // 幂等(同卷重跑不重复入池)
    pool.candidates.push({ genome: e.genome, origin: e.origin, vol: e.vol, fv: FV, hash }); added++;
  }
  pool.candidates = pool.candidates.slice(-40);
  atomicWrite(T_CAND(d), JSON.stringify(pool, null, 2));
  return added;
}
// [P0-5·死角强制覆盖] LLM 变异 162 步从未碰过 priorWeight/nicheWeight(死角)→trial 候选池每窗强制 1 个候选只动其一。
//   FNV(dir:vol:deadcorner) 确定性轮换选键与方向(红线: 零 Math.random); 撞边界则反向, 保证真变动; 步长 0.3≥检测地板。
function deadCornerCandidate(dir: string, vol: number, cur: Genome, engineBase: EngineGenes): { genome: Genome; origin: string } {
  const g = cloneGenome(cur); g.generation = cur.generation + 1; delete g.targetStyle;
  g.engine = { ...DEFAULT_GENOME.engine, ...engineBase };
  const h = hashStr(`${dir}:${vol}:deadcorner`);
  const usePrior = (h & 1) === 0; const sign = ((h >>> 1) & 1) === 0 ? 1 : -1;
  const bump = (v: number, step: number, lo: number, hi: number): number => {
    const a = +Math.min(hi, Math.max(lo, v + step * sign)).toFixed(2);
    return a !== +v.toFixed(2) ? a : +Math.min(hi, Math.max(lo, v - step * sign)).toFixed(2);
  };
  if (usePrior) g.engine.priorWeight = bump(g.engine.priorWeight, 0.3, 0.5, 1.6);
  else g.engine.nicheWeight = bump(g.engine.nicheWeight, 0.3, 0, 1);
  return { genome: g, origin: usePrior ? "deadcorner-priorWeight" : "deadcorner-nicheWeight" };
}
// 采纳裁决: 读 dir/trial-verdict.json {vol, winner|winnerGenome|winnerGenomeHash, humanSigned} → humanSigned===true 且该卷未采纳过(trial-state.json adoptedVols 幂等键)才写 genome.json。
// 红线: v1 verdict 必须人签(humanSigned!==true 一律拒); trial 模式下 genome.json 唯一写者=本函数。runner 中死=无 verdict=现任续任(fail-safe)。
export function adoptVerdict(dir: string): { adopted: boolean; vol?: number; reason: string } {
  try {
    if (!existsSync(T_VERDICT(dir))) return { adopted: false, reason: "无 trial-verdict.json" };
    const v = JSON.parse(readFileSync(T_VERDICT(dir), "utf8")) as { vol?: number; winner?: string; winnerGenome?: Partial<Genome>; winnerGenomeHash?: string; humanSigned?: boolean };
    if (v.humanSigned !== true) return { adopted: false, reason: "未人签(humanSigned!==true)·拒采纳" };
    if (typeof v.vol !== "number") return { adopted: false, reason: "verdict 缺 vol" };
    const vvol = v.vol;
    let st: { adoptedVols: number[] } = { adoptedVols: [] };
    try { if (existsSync(T_STATE(dir))) st = { adoptedVols: [], ...(JSON.parse(readFileSync(T_STATE(dir), "utf8")) as Partial<{ adoptedVols: number[] }>) }; } catch { /* 坏档重建 */ }
    if (st.adoptedVols.includes(vvol)) return { adopted: false, vol: vvol, reason: "该卷已采纳过(幂等跳过)" };
    const mark = (): void => { st.adoptedVols = [...st.adoptedVols, vvol].slice(-200); atomicWrite(T_STATE(dir), JSON.stringify(st, null, 2)); };
    if (v.winner === "incumbent") { mark(); return { adopted: false, vol: vvol, reason: "incumbent 续任(已记幂等)" }; }
    let g: Partial<Genome> | null = v.winnerGenome ?? null;
    if (!g) {
      const want = v.winnerGenomeHash ?? v.winner;
      if (!want) return { adopted: false, vol: vvol, reason: "verdict 无 winnerGenome/winnerGenomeHash" };
      try {
        const pool = JSON.parse(readFileSync(T_CAND(dir), "utf8")) as Partial<{ candidates: TrialCandidate[] }>;
        g = (pool.candidates ?? []).find((cd) => (cd.hash ?? genomeHash(cd.genome)) === want)?.genome ?? null;
      } catch { g = null; }
      if (!g) return { adopted: false, vol: vvol, reason: `hash ${String(want).slice(0, 12)} 未命中候选池` };
    }
    const adoptedG: Genome = { gen: { ...DEFAULT_GENOME.gen, ...(g.gen ?? {}) }, engine: { ...DEFAULT_GENOME.engine, ...(g.engine ?? {}) }, generation: typeof g.generation === "number" ? g.generation : 0 };
    if (g.targetStyle) adoptedG.targetStyle = g.targetStyle;
    saveGenome(dir, adoptedG); mark();
    return { adopted: true, vol: vvol, reason: `winner ${genomeHash(adoptedG)} 上岗(人签)` };
  } catch (err) { return { adopted: false, reason: String(err).slice(0, 100) }; }
}

// ── 一次进化：评估(混合) → 放进 MAP-Elites 存档 → 更新账本 → 选父+变异出下卷基因 → 落盘 ──
// [P0-6③] hill 两窗驻留(基因 8→16 章): 窗1只记 pendingWindow+账本遥测(基因不动·不变异·不进档案), 窗2取两窗均值 judged 再判(进档案 EMA、喂变异反思)。
//   轴Ⅱ分流闸·预注册读数规则: P0-8+P1-1 落地后, 干净观察信号(W_clean 趋势/draft-objFit)2-3 窗出可检趋势→trial 候选减半; 仍平趴→轴Ⅱ全量(见蓝图 P0-6③)。
// [轴Ⅱ] EVOLVE_MODE=trial: evolveOnce 降级为「遥测+候选生成」——子代+死角候选 append 进 trial-candidates.json, 不 saveGenome; genome.json 唯一写者=adoptVerdict(人签)。
// [P1-5] attribution 可选注入(四账摘要+draft/revised 差), 调用方后续接; 默认空=向后兼容。
export async function evolveOnce(llm: LLMProvider, sys: string, dir: string, vol: number, chapters: Array<{ goal: string; text: string }>, attribution?: string): Promise<{ genome: Genome; ledger: Ledger; guidance: string; report: string }> {
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
  const antiProxy = (avgLen > 0 && m.len > avgLen * 1.6) || m.repetition > repThreshold || m.dialogueRatio > 0.55 || m.ttr > (GENTLE ? 0.72 : 0.62); // 刷分嫌疑: 长度暴涨/重复飙升/对白堆砌(>55%)/碎句刷词汇多样(ttr>0.62) — 覆盖 obj 的可刷代理指标。[M5] 温情 ttr 阈值上调 0.62→0.72: 实测 ttr>0.62 误罚了 renjian ch-4/147 的松弛好章(温润文词汇本就丰富), 解耦防误伤(此项不降密度、只保质量)
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

  // 账本：避雷增长+衰老；发扬/修正滚动(每窗都记: avoid 增速与现状逐窗持平——P0-3 类别取中位采样非并集, guidance 每窗刷新)
  for (const a of ledger.avoid) a.age += 1;
  const aidx = new Map(ledger.avoid.map((a, i) => [a.p, i]));
  for (const p of c.overused) { // 再现=upvote+复活。[P1-3] v2 入账: 新条目 status=requested; observe/enforced 须 W6 人签链, 此处永不写
    const i = aidx.get(p);
    if (i !== undefined) { const a = ledger.avoid[i]!; a.age = 0; a.hits = (a.hits ?? 1) + 1; a.llmVotes = (a.llmVotes ?? 0) + 1; }
    else { const k = kernelOf(p); ledger.avoid.push({ p, age: 0, hits: 1, kernel: k, llmVotes: 1, status: "requested", guards: { kernelLen: k.length, pass: k.length >= 4 } }); }
  }
  ledger.avoid = ledger.avoid.filter((a) => a.age < 6 + Math.min(8, ((a.hits ?? 1) - 1) * 2)).slice(-50); // 高频套话保留更久
  ledger.amplify = [...ledger.amplify, ...c.wins].slice(-12);
  ledger.directives = c.fixes;
  const critHole = c.samples.some((s) => "failed" in s); // [P0-3] 有采样解析失败 → scores 补 {failed:true} 占位防轨迹暗洞(全成功不落, schema 同现状)
  const baseScore = { vol, gen: cur.generation, fitness, llm: llmFit, obj: objFit, cell: key, len: m.len, slm: +m.sentLenMean.toFixed(1), rep: +m.repetition.toFixed(3), dlg: +m.dialogueRatio.toFixed(3), ttr: +m.ttr.toFixed(3), avoidHits: m.avoidHits, ...c.rubric };

  // [P0-6③] 窗1: 驻留(陈旧/异代 pendingWindow 视同未有)。trial 模式不走驻留(臂内自有配对统计, 每窗都产候选)。
  const trial = EVOLVE_MODE === "trial";
  const pend = ledger.pendingWindow;
  if (!trial && !(pend && pend.gen === cur.generation)) {
    ledger.pendingWindow = { gen: cur.generation, vol, fitness };
    ledger.scores.push({ ...baseScore, win: 1, ...(critHole ? { crit: c.samples } : {}) });
    saveLedger(dir, ledger);
    promoteToGlobal(dir);
    return {
      genome: cur, ledger, guidance: buildGuidance(ledger, cur, loadGlobal(dir).avoid),
      report: `适应度${fitness}(LLM${llmFit}+客观${objFit}+一致${consFit}${simFit !== null ? "+模拟" + simFit : ""}${antiProxy ? "·打折" : ""}) · 驻留窗1/2·基因不动(16章驻留·下窗两窗均值再判) · 避雷${ledger.avoid.length}`,
    };
  }
  const paired = !trial && !!pend && pend.gen === cur.generation;
  const judged = paired && pend ? +(((pend.fitness + fitness) / 2)).toFixed(2) : fitness; // 窗2=两窗均值(σ÷√2); trial=单窗
  if (ledger.pendingWindow) delete ledger.pendingWindow; // 窗2消费 / trial 清陈旧暂存
  ledger.scores.push({ ...baseScore, ...(paired ? { win: 2 as const, judged } : {}), ...(critHole ? { crit: c.samples } : {}) });

  const prev = archive.find((x) => x.key === key);
  let placed: string;
  if (!prev) { archive.push({ key, tone: c.tone, rhythm, conflict: c.conflict, genome: cloneGenome(cur), fitness: judged, at: `v${vol}` }); placed = `★新格 ${key}`; }
  else { // [P0-6②] max 棘轮→EMA-on-revisit(0.7old+0.3new): 格分可降=反赢家诅咒特性(幸运抽样不再被永久封圣); 基因仍择优才换(fitness>old 才动 genome/at)
    const old = prev.fitness;
    prev.fitness = +(0.7 * old + 0.3 * judged).toFixed(2);
    if (judged > old) { prev.genome = cloneGenome(cur); prev.conflict = c.conflict; prev.at = `v${vol}`; }
    placed = `≈EMA ${key}(${old}→${prev.fitness})`;
  }

  // 选父 + 变异 → 下卷基因
  const simReflect = sf
    ? ` 模拟层${sf.total}/10(故事链${sf.sift.score}·派系张力${sf.tension.score}·新颖${(sf.novelty * 10).toFixed(1)}；极化${sf.tension.polarization}/势均${sf.tension.balance}/交锋${sf.tension.directness}/化解${sf.tension.resolution}/在场派系${Object.keys(sf.sift.patterns).length}型戏)。${GENTLE ? "本世界温情/启发向：低张力、戏剧密度低是【健康态】(不是病)——conflictRate/eventBias 宜守低(≤0.7)、绝勿为提戏剧而升；仅冲突/大事过密(张力>6)才略回降。人物自然生老病死即可、不硬造冲突。" : `${sf.tension.score < 4 ? "⚠世界张力低/疑人物坍塌→宜降 turnoverRate、升 structureGrowth/scarcity 让派系活起来；" : ""}${sf.sift.score < 4 ? "戏剧密度低→宜升 conflictRate/eventBias；" : ""}`}`
    : "";
  const reflection = `适应度${judged}${paired ? "(两窗均值)" : ""}(LLM${llmFit}/客观${objFit})。修正：${c.fixes.join("；") || "无"}。客观：重复率${(m.repetition * 100).toFixed(1)}%、对白${(m.dialogueRatio * 100).toFixed(0)}%、词汇多样${(m.ttr * 100).toFixed(0)}%、命中避雷${m.avoidHits}。${simReflect}${antiProxy ? "⚠长度/重复疑似刷分(已打折)" : ""}`;
  const next = await mutateGenome(llm, selectParent(archive, cur, `${dir}:${cur.generation}:${vol}`), ledger.bestEngine?.engine ?? cur.engine, reflection, attribution); // gen 取风格父本(P0-6① FNV 确定性选父)、engine 取世界级最优(解耦)
  const target = pickTarget(archive); if (target) next.targetStyle = target; // novelty: 逼填未点亮的风格格

  if (trial) { // [轴Ⅱ] trial: 子代+死角候选入池, 现任续跑; genome.json 唯一写者=adoptVerdict(人签 verdict)。其余遥测(档案/账本/全局)照常。
    const dc = deadCornerCandidate(dir, vol, cur, ledger.bestEngine?.engine ?? cur.engine);
    const added = appendTrialCandidates(dir, [{ genome: next, origin: MUT_COARSE ? "coarse-mutation" : "llm-mutation", vol }, { genome: dc.genome, origin: dc.origin, vol }]);
    saveArchive(dir, archive); saveLedger(dir, ledger);
    promoteToGlobal(dir);
    return {
      genome: cur, ledger, guidance: buildGuidance(ledger, cur, loadGlobal(dir).avoid),
      report: `适应度${judged}(LLM${llmFit}+客观${objFit}+一致${consFit}${simFit !== null ? "+模拟" + simFit : ""}${antiProxy ? "·打折" : ""}) · ${placed} · trial: 候选+${added}入池·现任续跑(待人签 verdict 经 adoptVerdict 上岗) · 避雷${ledger.avoid.length}`,
    };
  }

  saveGenome(dir, next); saveArchive(dir, archive); saveLedger(dir, ledger);
  promoteToGlobal(dir); // 把本世界新学到的提升进全局传承层(提升整个引擎)
  const tstr = next.targetStyle ? ` · 探索→${next.targetStyle.tone}×${next.targetStyle.rhythm}` : "";
  return {
    genome: next, ledger, guidance: buildGuidance(ledger, next, loadGlobal(dir).avoid),
    report: `适应度${fitness}${paired ? `·两窗判${judged}` : ""}(LLM${llmFit}+客观${objFit}+一致${consFit}${simFit !== null ? "+模拟" + simFit : ""}${antiProxy ? "·打折" : ""}) · ${placed} · 存档${archive.length}/${TONES.length * RHYTHMS.length}格${tstr} · 下卷 temp${next.gen.temperature}/prior${next.engine.priorWeight}/稀缺${next.engine.scarcity}/冲突${next.engine.conflictRate}/代谢${next.engine.turnoverRate}/生态位${next.engine.nicheWeight}/结构${next.engine.structureGrowth}${GENTLE ? "/位移" + next.engine.moveBias : ""} · 避雷${ledger.avoid.length}`,
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
