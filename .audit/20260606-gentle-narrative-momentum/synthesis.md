# 温情叙事推进力 · 综合可实施蓝图

> 融合三方设计（A 慢燃主线脊梁 / B 每章推进引擎+进展账本 / C W_progress 适应度）之长，全量吸收对抗批评（详见 `critique.md`）。
> 核验日期 2026-06-06，对照 live `app/` 源码与 `.novel-output/renjian/`（atCh 1093）。所有行号已 live 核验。
> **设计哲学一句话**：给温情世界一条**软的、稀疏的、会随卷推进的人生脊梁**（A），用**机读处境账本**给「推进」做度量回路与防循环（B），再把「会推进的基因」**沉淀进进化**（C）；三层全程**不关 T2、不碰 conflictRate、不进 fitness 直链、容质感呼吸章**。

---

## 〇、问题与北极星（REAL，有度量证据）

`warm-fitness-history.json`（33 条，ch922→1093）：`var` 9.64–9.75 顶死、`bond=10` 满（T1/T2/T3 已根治场景与关系坍塌），但 `social` 3.05↔5.24 抖无趋势、**`arc` 3.21–3.96 平趴、170 章零上升**。`genome.json conflictRate=0.56`。

**这是「场景在换、人生没动 / 白发式重演」的机器可读铁证。**

**验收北极星（四象限同时满足才算成功）**：
1. `arc`（warm-fitness.ts:75 WARM_DONE 占比）跨卷出现**上升趋势**（目标：>200 章窗口内从 ~3.3 抬到 ~5+）；
2. `social` 同向抬升且不再纯抖动；
3. `var ≥ 9.4`（**不因新机制跌破** —— 这是 T2 不被关掉的硬约束）；
4. `conflictRate ∈ [0.5, 0.65]`（守 0.56，不被任何新通道上推）。

---

## 一、最终推荐方案与分层

**推荐方案 = A 为骨（软稀疏人生脊梁）+ B 为度量（处境账本+防拍子循环）+ C 为长效（W_progress 选择压力）**，三层分工：

```
T1 慢燃主线脊梁（A 改）  ── 时间维方向锚：给温情世界一条 obedience=balanced、steer=soft、
                            稀疏覆盖（不抢 T2）的「人生阶段」outline-plan，每章软提示「本阶段走向 X」
                            ↓ 经现成 outlineBeat 软分支（longrun.ts:177）注入，零新管道
T2 每章进展 + 防循环（B） ── 处境维落地：progression-ledger.json 记主角处境/已写拍子签名；
                            仅 weave 空窗章兜底产一句温润推进任务；拍子签名比对历史→命中重复则改写为升级；
                            每 8 章搭 canonStep 同班 LLM 判里程碑达成、写回处境（真 ground truth）
                            ↓ 经现成 weave 通道（longrun.ts:387）+ beatSpec 末尾追加（:174）
T3 进展账本接进化（C）    ── 长效维选择压力：warm-fitness 加第 5 信号 W_progress（近窗里程碑达成 × 处境净位移），
                            权重 0.10，从 W_var 0.40 匀给 → evolveOnce 爬山把「会推进的基因」选出来
                            ↓ 合进 wf.total（warm-fitness.ts:96），evolve.ts:331 不动
```

**为什么三层都要、不能只取一层**（吸收批评第五条）：
- 只有 A（软方向）：批评证明**无度量回路**——`beatForChapter` 纯区间查表，到点自动切 goal 不管前段是否达成 → 复现「文案换了人没动」。必须有 B 的账本做 ground truth。
- 只有 B（账本+任务）：每章施压但进化层看不见 → var 高就够分、适应度永远看不到 arc 停滞，长期会被爬山漂回。必须有 C 让选择压力落到基因。
- 只有 C（fitness）：信号有了但前期 prose 无方向、无防循环，fitness 抬不动。必须有 A+B 先把 prose 写对。

---

## 二、各层集成点（文件:行）+ 伪代码

### 先决修复 P0（吸收批评 第一、三条 —— 阻断级，不修则全盘失效）

**P0-a：style 入 cfg（server 落盘时附加，不污染 LLM SPEC）**

`world-gen.ts` 的 SPEC（:4-21）**不动**（避免污染生成器）。改由 server 在落盘 cfg 后附加：

```ts
// server.ts，cfgPath 落盘 cfg JSON 之处（define-world :255 区 与 new-world :310 区）
// 现状: 只写 generateWorldConfig 产出的 SPEC 字段
const cfg = JSON.parse(cfgJson);
cfg.style = isGentleRequest(p, cfg) ? "温润" : "爽文"; // ← server 附加, 非 LLM 产出
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

// 判定: 建世界请求显式 style 参数 优先, 否则 premise 关键词命中(温情/治愈/启发/日常/烟火/相望相渡…)
function isGentleRequest(p: {style?: string; prompt?: string}, cfg: {bible?: string}): boolean {
  if (p.style) return p.style === "温润";
  const t = `${p.prompt ?? ""} ${cfg.bible ?? ""}`;
  return /温情|治愈|启发|日常|烟火|寻常|相望相渡|微光|慢|淡/.test(t);
}
```

**P0-b：spawn env 显式注入 NOVEL_STYLE（令 GENTLE/isGentle/evolve 同源 —— 顺带修已存在的 bug）**

```ts
// server.ts:266 (define-world) 与 :321 (new-world) 两处 spawn env, 加一个键:
env: { ...process.env, NOVEL_PACK:"freeform", NOVEL_WORLD_CONFIG: cfgPath,
       NOVEL_SAGA_DIR: SAGA, NOVEL_STANDBY:"0", NOVEL_TARGET:"1000",
       NOVEL_SECTIONS:"4", NOVEL_WARMUP: String(warmup),
       NOVEL_STYLE: cfg.style === "温润" ? "温润" : "" }   // ← 新增, longrun GENTLE 由此同源
// :323 观察器 server 的 baseEnv 同样带上(已含 ...baseEnv, 自动继承)
```

> 注：现状 renjian 的 GENTLE 来自外层 shell 继承（批评一已核），此修复让**新建温情世界**也能正确进入 GENTLE。爽文世界 cfg.style="爽文" → NOVEL_STYLE="" → GENTLE=false → **逐字节同现状**。

---

### T1：慢燃主线脊梁（A 改 —— steer:soft 不抢 T2）

**T1-1：`OutlineBeat` 加 `steer` 字段 + `beatObjForChapter` 取 beat 对象**

```ts
// outline-plan.ts:9 — 加可选 steer(向后兼容: 缺省视为 hard, 即旧 strict 跟纲行为不变)
export interface OutlineBeat { vol: number; from: number; to: number; goal: string; steer?: "soft" | "hard" }

// outline-plan.ts:24 旁 — 新增取 beat 对象版(beatForChapter 仍返回 string, 不破现有调用)
export function beatObjForChapter(plan: OutlinePlan | null, n: number): OutlineBeat | null {
  if (!plan || !plan.beats.length) return null;
  for (const b of plan.beats) if (n >= b.from && n <= b.to) return b;
  const last = plan.beats[plan.beats.length - 1];
  return last && n > last.to ? last : null;
}
```

**T1-2：新函数 `generateGentleArcPlan`（outline-plan.ts 末尾，复用 :39-46 解析范式）**

```ts
// 温情世界专用: 从 premise + 人生意图弧派生「人生阶段」软脊梁(obedience 恒 balanced, steer 恒 soft)。
// 与 generateOutlinePlan 区别: 输入 premise+arcSeed(非成品大纲); goal=人生境地(非情节事件); 措辞强制温润零冲突;
// 落点须命中 WARM_DONE 词(团聚/和解/抵达/释怀/了却/相托/安顿…)以接 arc 度量闭环[吸收批评五]。
export async function generateGentleArcPlan(
  premise: string, arcSeed: string, llm: LLMProvider, targetCh = 1000,
): Promise<OutlinePlan> {
  const raw = await llm.complete(
    `你是"温情长篇的人生阶段规划师"。下面是一部温情/启发向小说的设定与主角的人生意图弧。\n` +
    `把这条人生弧拆成 5~7 个**缓慢推进的人生阶段**, 供引擎逐章作【软方向】(世界可自然偏离)。要求:\n` +
    `· 每段覆盖一个连续章节区间(from~to), 段间跨度≥120章、覆盖到约第 ${Math.min(targetCh,1000)} 章, 让日常充分呼吸;\n` +
    `· 每段一句"本阶段主角该走到的人生境地"(≤40字): 写【处境/身份/心境的挪移】, 并尽量落在「了却/相托/安顿/抵达/释怀/接纳/被托付」这类**安稳完成感**的词上(如"从旁观者被乡邻接纳为可托付的人");\n` +
    `· 【铁律】绝不写冲突/争斗/生死/反派/夺宝/危机——推进靠"多识一人/多走一程/道行长进/被人当作不凡/了却一桩牵念", 不靠事件冲突;\n` +
    `· 至少 1~2 段须写【与第二主角的关系该走到哪】(防第二主角原地)[吸收批评五];\n· 段间顺人生弧缓缓递进, 不跳。\n` +
    `只回 JSON:\n{"beats":[{"vol":卷号,"from":起章,"to":止章,"goal":"本阶段人生境地一句"}]}\n\n` +
    `【设定 premise】${premise}\n【人生意图弧】${arcSeed}`,
    { thinking: false, temperature: 0.4 },
  );
  let beats: OutlineBeat[] = [];
  try {
    const j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as { beats?: Array<Record<string, unknown>> };
    beats = (j.beats ?? [])
      .map((b) => ({ vol: Number(b["vol"]) || 1, from: Math.floor(Number(b["from"])) || 0,
                     to: Math.floor(Number(b["to"])) || 0,
                     goal: typeof b["goal"] === "string" ? (b["goal"] as string).slice(0, 60) : "",
                     steer: "soft" as const }))            // ← 恒 soft: 不抢 T2[吸收批评二]
      .filter((b) => b.goal && b.from > 0 && b.to >= b.from)
      .sort((a, b) => a.from - b.from);
  } catch { /* 退化涌现, 不阻断 */ }
  return { beats, source: arcSeed.slice(0, 200), generation: 1, obedience: "balanced" }; // ← 恒 balanced
}

// arcSeed 唯一来源: 从 premise 兜底推(删 cfg.lifeArc 依赖, 它不存在)[吸收批评三]
export async function deriveArcFromPremise(premise: string, llm: LLMProvider): Promise<string> {
  const raw = await llm.complete(
    `下面是一部温情小说的设定。用一句话(≤60字)概括主角贯穿全书的【人生意图弧】——他的处境/身份会缓缓走向哪里(写境地挪移, 不写冲突):\n${premise}`,
    { thinking: false, temperature: 0.3 });
  return raw.trim().slice(0, 120);
}
```

**T1-3：server 自动生成分支（server.ts:262 与 :316 现有 outline 生成点之后加 GENTLE else 分支）**

```ts
// 现状(:262/:316): 仅用户给成品大纲+mode 才生成 plan
if ((p.outlineMode==="balanced"||p.outlineMode==="strict") && p.outline?.trim()) {
  try { const plan = await generateOutlinePlan(p.outline, llm, 1000); plan.obedience = p.outlineMode;
        if (plan.beats.length) saveOutlinePlan(WDIR, plan); } catch {}
}
// 新增: 温情世界(cfg.style==="温润")且无成品大纲 → 自动派生 balanced/soft 人生阶段脊梁
else if (cfg.style === "温润" && !loadOutlinePlan(WDIR)) {
  try {
    const premise = String(cfg.bible ?? "");
    const arcSeed = (p.lifeArc?.trim()) || await deriveArcFromPremise(premise, llm); // 删 cfg.lifeArc[批评三]
    const plan = await generateGentleArcPlan(premise, arcSeed, llm, 1000);
    if (plan.beats.length) saveOutlinePlan(WDIR, plan);
  } catch { /* 退化纯涌现, 不阻断 */ }
}
```

**T1-4：occupied 解耦 —— soft beat 不关 T2（longrun.ts:312，吸收批评二·命门）**

```ts
// 现状 :312: const occupied = !!beatForChapter(outlinePlan, n+1) || readFs().some(伏笔到期);
// 改为: 只有 hard steer 的 beat 才让位; 温情软脊梁(steer:soft)不抢 T2 → 慢燃主线与场景轮换正交叠加
const nextBeat = beatObjForChapter(outlinePlan, n + 1);
const occupied = !!(nextBeat && nextBeat.steer === "hard") || readFs().some((f) => !f.paid && f.dueCh <= n + 1);
//                          ↑ soft 不计入 → gentleDirect 照常派 sceneShift, var=9.75 不被关掉
```

> 向后兼容：用户手动 strict 跟纲世界的 plan 无 steer 字段 → `nextBeat.steer==="hard"` 为 false？**否** —— 需保证旧 strict plan 仍让位。修正：`const isHard = !nextBeat ? false : (nextBeat.steer ?? "hard") === "hard";`（缺省 steer 视为 hard，仅 generateGentleArcPlan 显式标 soft）。这样旧跟纲世界行为不变、只有温情软脊梁不抢 T2。

**T1-5：温情 beatSpec 末尾追加温润前进要求（longrun.ts:174，吸收批评四·去强否定）**

```ts
// 现状 :174 温情分支(节选): ...${outlineBeat ? "顺着上述主线、" : ""}末拍以一个安静的画面或一点余味收束...
// 改为: outlineBeat 存在时, 锚到「阶段」而非「章」、容呼吸章、加不靠冲突自检
${outlineBeat ? "本阶段内主角处境宜较阶段开端有所挪移(多识一人、多走一程、道行或心境长进一分、近一桩牵念)、顺着这条人生主线缓缓向前；不必每章都动、容得下纯质感的呼吸章；这一步绝不靠任何冲突/争斗/危机/失去来体现、" : ""}末拍以一个安静的画面或一点余味收束、不必留悬念。
```

> 关键差异 vs 设计 A 原文：删「**不可与近章停在同一境地**」强否定（批评四：强否定最易被 LLM 用「造小事件」逃逸）；改「阶段内宜挪移、容呼吸章」（锚阶段不锚章）；加「不靠冲突体现」与 NEG_MARK 同语义自检。**只在 outlineBeat 存在时加，无 plan 的纯涌现温情世界不受影响。**

---

### T2：进展账本 + 防拍子循环（B —— 仅 weave 空窗兜底）

**T2-1：新文件 `app/progression-ledger.ts`（镜像 gentle-director.ts 全部纪律：load/save + <name>.json + forCh/turn 守门 + 禁 random/Date.now）**

```ts
// app/progression-ledger.ts
interface Milestone { id: string; goal: string; reached: boolean; atCh?: number }
interface WrittenBeat { sig: string[]; ch: number }            // sig = 处境/动作/关系 2-gram 指纹(防循环本体)
export interface ProgressLedger {
  situation: { place: string; role: string; nearPerson: string }; // 主角当前处境(机读 ground truth)
  reachedMilestones: string[];      // 已达里程碑 id(对账 outline-plan 阶段)
  writtenBeats: WrittenBeat[];      // 滚动历史拍子签名(取近 ~12 章)
  lastAdvanceCh: number;            // 上次处境真挪移的章号(产任务的间隔依据)
  turn: number;                     // 自增计数器(替代 random/Date.now, resume 确定性)
}
const F = (d: string) => join(d, "progression-ledger.json");
export function loadPL(d: string): ProgressLedger { /* existsSync ? parse : 初始空; catch 兜底 同 gentle-director */ }
export function savePL(d: string, p: ProgressLedger): void { /* writeFileSync, 非关键 try */ }

// 拍子签名: 从近章标题+末拍取处境/动作 2-gram(复用 gentle-director motifSig 思路, 但取动词/关系而非静物)
export function beatSig(title: string, hook: string): string[] { /* 2-gram, 去人名停用集 */ }

// 核心: weave 空窗时产一句温润推进任务 + 防循环改写
// 入参: ledger, 本章 n, 候选拍子签名(由近章推断), 当前阶段 goal(来自 outline-plan), 上一阶段落点
export function nextProgressTask(pl: ProgressLedger, n: number, stageGoal: string, prevStageGoal: string): string {
  const gap = n - pl.lastAdvanceCh;
  // 间隔太短(刚推过, gap < 8) → 不施压, 让日常呼吸[吸收批评四/七: 锚阶段容呼吸]
  if (gap < 8) return "";
  // 防循环: 候选拍子签名与近 12 章历史高重复 → 把任务从「重复」改写为「升级新发展」
  const recentSigs = pl.writtenBeats.slice(-12).flatMap((b) => b.sig);
  const stale = /* 候选与 recentSigs Jaccard > 0.5 ? */ false;
  const fromTo = prevStageGoal ? `已从「${prevStageGoal}」起步，` : "";
  return stale
    ? `${fromTo}近来情形与前几章太相似了——本章宜有一处**新的**人生进展(识一个从未出现的人、走一段没去过的路、把那桩牵念再推近一步)，朝「${stageGoal}」缓缓挪动；仍温润、不靠冲突。`
    : `${fromTo}本章宜让主角处境朝「${stageGoal}」缓缓挪一小步(多识一人/多走一程/心境长进一分/近一桩牵念)；温润收束、不靠冲突。`;
}

// 每 8 章: 搭 canonStep 同班 LLM 读近 8 章判里程碑达成、写回处境(真 ground truth)[吸收批评五]
export async function advanceStep(pl: ProgressLedger, recentChapters: Array<{goal:string;text:string}>,
  arcMilestones: Array<{id:string;goal:string}>, n: number, llm: LLMProvider): Promise<ProgressLedger> {
  const raw = await llm.complete(
    `读下面近 8 章, 只回 JSON。判断主角当前【处境】, 以及下列人生里程碑里【哪些已真正达成】(看正文事实, 不看是否提过):\n` +
    `里程碑:${JSON.stringify(arcMilestones.map(m=>({id:m.id,goal:m.goal})))}\n` +
    `{"place":"现在身处/身份一句","role":"被旁人当作什么","nearPerson":"最近正与谁来往","reached":["已达成里程碑id"]}\n\n` +
    recentChapters.map((c,i)=>`【${i+1}】${c.goal}\n${c.text.slice(0,600)}`).join("\n\n"),
    { thinking: false, temperature: 0.2 });
  // 解析 → 写回 pl.situation; 新增 reached 进 pl.reachedMilestones; 若有新达成 → pl.lastAdvanceCh = n
  // turn++; 严禁 random/Date.now
  return pl;
}
```

**T2-2：longrun.ts 接入（5 处，全在 GENTLE 分支内，爽文 null 零变更）**

```ts
// (1) import (longrun.ts:17 旁)
import { loadPL, savePL, nextProgressTask, beatSig, advanceStep, type ProgressLedger } from "./progression-ledger";
// (2) 状态初始化 (:54 旁, 与 gdir 并列)
let pledger: ProgressLedger | null = GENTLE ? loadPL(ROOT) : null;
// (3) weave 空窗兜底 (:387-402 之间, 伏笔逻辑之后) —— 仅当 weave==="" 时账本兜底, 核心施压点
//     现状: weave 在无伏笔到期且未到埋设章时为 ""
if (GENTLE && pledger && weave === "") {
  const stageGoal = beatForChapter(outlinePlan, n);
  const prevStage = /* outline-plan 上一段 goal, 由 beatObjForChapter(plan, b.from-1) 取 */ "";
  if (stageGoal) weave = nextProgressTask(pledger, n, stageGoal, prevStage); // 经现成 weave→:177 注入
}
// (4) beatSpec 末尾追加: 见 T1-5(已在 :174 改, 与 outlineBeat 共生)
// (5) 每 8 章里程碑判定 (:450 的 n%8===0 块内, 搭 canonStep 同班 LLM)
if (GENTLE && pledger && n % 8 === 0) {
  const rc = store.readRecentChapters(db, worldId, 8);
  pledger = await advanceStep(pledger, rc.map(c=>({goal:c.goal,text:c.text})), arcMilestonesFromPlan(outlinePlan), n, llm);
  savePL(ROOT, pledger);
}
// 写完每章后追加拍子签名(防循环历史)
if (GENTLE && pledger) { pledger.writtenBeats.push({ sig: beatSig(ch.goal, ch.hook), ch: n });
  pledger.writtenBeats = pledger.writtenBeats.slice(-12); pledger.turn++; savePL(ROOT, pledger); }
```

> **为何只在 weave 空窗兜底**（不每章硬塞）：吸收批评四/七——weave 已被伏笔（回收/埋设）占用时不抢；只在「无伏笔可写」的空窗才由账本补一句推进，密度天然稀疏、容质感呼吸章。且 weave 经 longrun.ts:177 `【本章叙事任务·须落实】` 注入，与 outlineBeat 软方向**互补**（一个给阶段方向、一个给本章具体一小步）。

---

### T3：进展账本接进化（C —— W_progress 选择压力）

**T3-1：warm-fitness.ts 加第 5 信号（:91 computeWarmFit 内 + :96 权重重配）**

```ts
// warm-fitness.ts:18 — 接口加 progress 维
export interface WarmFitness { total:number; var:number; bond:number; social:number; arc:number; progress:number; atCh:number }

// :91 旁 — 新信号 ⑤ W_progress: 读 progression-ledger.json 的近窗里程碑达成数 + 处境净位移(0..10)
function progressMomentum(dir: string, recentCh: Array<{goal:string;text:string}>): number {
  const pl = loadPL(dir); if (!pl) return 5;                       // 无账本→中性
  const reached = pl.reachedMilestones.length;                    // 累计达成里程碑
  const fresh = pl.lastAdvanceCh;                                 // 最近挪移章
  // 评分 = 里程碑达成进度(累计/应有) × 近窗是否有挪移(lastAdvanceCh 距当前越近越高)
  // 纯进度信号, 绝不测冲突 → 与 bond/social/arc 并列、不与 var 语义重叠
  return /* 0..10 合成 */ 5;
}

// :96 — 权重: 从 W_var 0.40 匀 0.10 给 progress(var 仍 0.30 最高, 不破场景施压主力)
const wProg = progressMomentum(dir, recentCh);
const total = +(0.30*wVar + 0.25*wBond + 0.20*wSocial + 0.15*wArc + 0.10*wProg).toFixed(2);
return { total, var:wVar, bond:wBond, social:wSocial, arc:wArc, progress:wProg, atCh: snapshot.tick ?? 0 };
```

> `computeWarmFit` 需多收一个 `dir` 入参（读账本）；longrun.ts:475 区调用处补传 ROOT。history 落盘（:31）加 progress 字段。

**T3-2：evolve.ts 不动（C 合进 wf.total）**

```ts
// evolve.ts:331 GENTLE fold 保持原样: 0.45*llmFit + 0.15*objFit + 0.10*consFit + 0.30*wf.total
// W_progress 已在 warm-fitness.ts 内合进 wf.total → evolve 零改动、零回归风险
```

> **为何匀 0.10 而非更多**：W_var=0.40 是 T2 防场景坍塌的施压主力，动太多会松绑 var；进度信号 0.10 足以让爬山「在 var 持平时偏好会推进的基因」，又不夺 var 的主导。这是 C 的最小侵入实现。

---

## 三、验证度量（北极星的可操作化）

| 度量 | 数据源 | 现状基线(ch1093) | 成功阈值 | 采集 |
|---|---|---|---|---|
| **主线推进度** | warm-fitness `arc` | 3.27（170 章平趴） | >200 章窗内升到 ~5+ 且有正斜率 | warm-fitness-history.json 滚动 |
| **主线推进度·硬证** | progression-ledger `reachedMilestones` | 0（无账本） | 每 ~150 章 +1 里程碑达成（机读，非自评） | progression-ledger.json |
| **拍子重复率↓** | progression-ledger `writtenBeats` 近 12 章 Jaccard | 高（白发式重演） | 近窗签名 Jaccard 均值下降、stale 改写触发后回落 | 账本计算 + 日志计数 |
| **虚谷处境随卷变化** | progression-ledger `situation`（place/role/nearPerson） | 静态（无账本） | place/role 跨卷可见挪移（旁观者→被接纳→被托付→半个神仙→窥天庭） | advanceStep 每 8 章写回，跨卷 diff |
| **第二主角不原地** | 阶段 goal 含柳如烟栏 + situation.nearPerson | 未覆盖 | 柳如烟相关里程碑至少 1 个达成 | plan 校验 + 账本 |
| **温情不破·var** | warm-fitness `var` | 9.75 | **≥ 9.4**（T2 未被关掉的硬约束） | 回归必检 |
| **温情不破·social** | warm-fitness `social` | 3.73 抖 | 同向抬升、不纯抖动 | history |
| **不引戏剧·cr** | genome `conflictRate` | 0.56 | ∈ [0.5, 0.65] | genome.json 每卷 |
| **不引戏剧·warmFit总** | warm-fitness `total` | 7.64 | 不下降（理想升） | history |

**关键回归实验**：renjian 可不重建——手写一份 `outline-plan.json`（obedience:"balanced"、每段 steer:"soft"、6 段含柳如烟栏、落点用 WARM_DONE 词）放进 `.novel-output/renjian/`，下一章 `loadOutlinePlan`（longrun.ts:229）即读到。**A/B 对照**：连续跑 ~80 章，比对 `var`（必须仍 ≥9.4 → 证 T2 未被关）、`arc/social`（应抬 → 证推进生效）、`conflictRate`（应守 0.56 → 证不引戏剧）。

---

## 四、风险与「不破温情 / 不引戏剧 / 不压涌现」保证

| 风险 | 触发条件 | 保证机制（对应批评修正） |
|---|---|---|
| **永久关闭 T2、var 崩** | plan 连续覆盖 + occupied 恒真 | **T1-4**：soft beat 不计入 occupied（仅 hard 让位），慢燃主线与场景轮换正交叠加；回归必检 var≥9.4。【批评二·命门】 |
| **温情→爽文管道串台** | isGentle(cfg) 与 GENTLE 不同源 | **P0**：style 入 cfg + spawn env 显式注入 NOVEL_STYLE，三处同源。【批评一·阻断】 |
| **触发分支恒不进** | 依赖不存在的 cfg.lifeArc/gentle | **P0+T1-3**：style 由 server 写，lifeArc 只用 deriveArcFromPremise(bible)。【批评三·阻断】 |
| **LLM 用造小冲突逃逸「挪移」** | 强否定「不可停同境」 | **T1-5**：删强否定、锚阶段容呼吸章、加「不靠冲突体现」自检；推进措辞全 WARM_DONE 语义、零 NEG_MARK。【批评四】 |
| **文案换了人没动 / 第二主角原地** | beatForChapter 纯查表不校验达成 | **T2 advanceStep**：每 8 章机读判里程碑达成写回 situation（真 ground truth）；落点命中 WARM_DONE 接 arc 闭环；plan 含柳如烟栏。【批评五】 |
| **slice-of-life 变 KPI 打卡** | 每章硬塞推进 | **T2-2(3)**：仅 weave 空窗兜底 + gap<8 不施压；obedience 恒 balanced 软分支可偏离。【批评七】 |
| **conflictRate 被上推（破温情）** | 新通道误碰 tuning/crisis/drama | 三层**全程不写 tuning、不入 crisis、不碰 drama**（GENTLE drama heat=0）；outline/weave/account 只经 prose 指令层；warmFit 不读 plan（batch 验证）→ fitness 不被 outline 污染；conflictRate 每代 toward(0.6,1.05) 锚回。【批评六·已核安全】 |
| **进化层回归** | 改 evolve fitness fold | **T3-2**：W_progress 合进 wf.total，evolve.ts:331 **零改动**；W_var 仍 0.30 最高、只匀 0.10。 |
| **resume 串账** | 账本用 random/Date.now | progression-ledger 复刻 gentle-director：纯 turn 计数器、forCh 守门、禁 random/Date.now → 断点续跑确定性复现。 |

**「不压涌现」的三道护栏**（保留设计 A 做对的部分）：
1. `obedience:"balanced"` 软分支（longrun.ts:177「世界若自发涌现变数，可顺其自然地偏离，不必硬贴」）——绝不用 strict（strict「必须服务推进、不可跑偏」会杀死 slice-of-life）；
2. 阶段 goal 写**境地**（接纳/被托付/窥见门径）非**事件**——身份挪移非情节升级；
3. 稀疏施压（soft 不抢 T2 + weave 空窗兜底 + gap<8 不动）——推进密度从「每章」降到「阶段内偶尔」，容质感呼吸章。

---

## 五、必须吸收的批评点（标注，详见 critique.md）

| # | 批评 | 判定 | 蓝图落点 | 阻断级 |
|---|---|---|---|---|
| 一 | NOVEL_STYLE 不在 spawn env，isGentle/GENTLE 脱钩 | FLAWED | **P0-b** spawn env 注入 | ★阻断 |
| 二 | 连续覆盖→occupied 恒真→永久关 T2、崩 var | FLAWED | **T1-4** steer:soft 不计 occupied | ★阻断 |
| 三 | cfg.gentle/lifeArc/style 字段不存在 | FLAWED | **P0-a** style 由 server 写 + **T1-3** lifeArc 用 deriveArcFromPremise | ★阻断 |
| 四 | §A2 强否定「不可停同境」→冲突逃逸 | FLAWED | **T1-5** 删强否定、锚阶段、加不靠冲突自检 | 是 |
| 五 | 无处境账本→文案换人没动；柳如烟未覆盖 | FLAWED | **T2** advanceStep 机读写回 + 落点命中 WARM_DONE + plan 含柳如烟栏 | 是 |
| 六 | warmFit/evolve/foreshadow/双模式 无冲突 | REAL | 保持不破（安全边界，全程不碰 fitness 直链/conflictRate） | — |
| 七 | 过度约束涌现→生硬 KPI | 现状 REAL | **T2** weave 空窗+gap<8 稀疏 + obedience balanced | 是 |

---

## 六、与已落地温情变化驱动器 T1/T2/T3 的关系（正交/协同）

> 注意命名：**本蓝图的 T1/T2/T3** 指上文新增三层（脊梁/账本/W_progress）。**已落地的温情变化驱动器**在 memory 里也叫 T1/T2/T3（T1 钝化 bible 自反馈、T2 gentle-director 场景轮换、T3 warm-fitness）。下表用「已落地-Tx」区分。

| 已落地驱动器 | 治什么（维度） | 与本蓝图关系 | 协同/正交点 |
|---|---|---|---|
| **已落地-T1**（longrun.ts:163-164 钝化 bible，剔近章静物词） | 镜头锁死（自反馈维） | **正交** | 二者都不动 bible 摘要管线；本蓝图经 outlineBeat/weave 独立通道，不碰 dropMotifs |
| **已落地-T2**（gentle-director 场景轮换，把 var 顶 9.75） | 场景坍塌（**空间**维） | **协同（命门）** | 本蓝图治**时间/处境**维，与 T2 空间维**正交叠加**；经 **T1-4 steer:soft** 保证软脊梁**不抢 occupied**→T2 全程照常轮换；非推进章场景轮换、推进章方向叠加，两条独立通道（sceneShift vs outlineBeat/weave）在 longrun.ts:177 早已共存 |
| **已落地-T3**（warm-fitness 4 信号 + evolve GENTLE fold） | 进化选择压力（**长效**维） | **协同（同向扩展）** | 本蓝图 **T3 加第 5 信号 W_progress**，是对已落地-T3 的**同向延伸**：原 4 信号看不见停滞（var 高就够分），W_progress 补上「会推进」的选择压力；W_var 仍 0.30 最高、只匀 0.10，**不夺已有信号主导**；evolve.ts:331 零改动 |

**协同总图**：
```
         空间维(已落地-T2 gentle-director) ──→ sceneShift ──┐
                                                            ├─→ longrun.ts:177 prompt(早已共存, 互不抢)
时间/处境维(本蓝图 T1脊梁+T2账本) ──→ outlineBeat + weave ──┘
                                                            ↓ 写出 prose
长效维(已落地-T3 warmFit 4信号 + 本蓝图 W_progress) ←── computeWarmFit ←── 落盘章节
                                                            ↓ wf.total
                                              evolve.ts:331 GENTLE fold(沉淀进基因)
```
- **正交保证**：已落地-T2 经 `occupied` 让位闸（T1-4 让 soft 不触发它）→ 空间轮换与时间推进**永不互斥关闭**，这是设计 A 原版（连续覆盖恒关 T2）的致命修复。
- **协同保证**：三维都汇进 warmFit、再沉淀进进化；W_progress 让「会推进的基因」与「场景多样/关系暖」的基因**一起被爬山选中**，长期纠偏「var 高就躺平」。

---

## 七、实现成本与落地顺序

| 阶段 | 改动 | 文件:行 | 量级 | 风险 |
|---|---|---|---|---|
| **P0**（先决，阻断级） | style 入 cfg + spawn env 注入 NOVEL_STYLE | server.ts:255/266/310/321 + isGentleRequest | ~20 行 | 低（爽文 style="爽文"→NOVEL_STYLE=""→同现状） |
| **T1**（骨） | OutlineBeat.steer + beatObjForChapter + generateGentleArcPlan + deriveArcFromPremise + server 分支 + occupied 解耦 + beatSpec 追加 | outline-plan.ts(末尾+:9+:24) / server.ts:262/316 / longrun.ts:174/312 | ~70 行 | 中（occupied 改动须验 var≥9.4） |
| **T2**（度量） | progression-ledger.ts 新文件 + longrun 5 处接入 | 新文件 ~120 行 + longrun.ts:17/54/387/450 | ~150 行 | 中（新叶子模块，复刻 gentle-director 纪律） |
| **T3**（长效） | warm-fitness W_progress 信号 + 权重重配 + 接口/history/调用补 dir | warm-fitness.ts:18/91/96/31 + longrun.ts:475 调用补 ROOT | ~30 行 | 中（触进化层，须验 conflictRate/total 不退） |

**落地顺序**：P0 →（renjian 手写 outline-plan.json 验 T1 的 occupied/beatSpec 不破 var）→ T1 全量 → T2 → T3。**爽文世界（cfg.style≠"温润" → GENTLE=false）全程逐字节同现状、零回归**。`core/` 全程不涉，无新增对 core 的依赖。

---

## 关键文件索引（全部 live 核验，行号准）

- `app/outline-plan.ts` — :9 OutlineBeat(加 steer)；:11 OutlinePlan.obedience；:24 beatForChapter(加 beatObjForChapter)；:32-47 generateOutlinePlan 解析范式(复用)；**末尾新增 generateGentleArcPlan + deriveArcFromPremise**
- `app/server.ts` — :262/:316 现有 outline-plan 生成点(**加 GENTLE 自动生成分支**)；:255/:310 cfg 落盘处(**附加 style**)；:266/:321 spawn env(**注入 NOVEL_STYLE**)
- `app/longrun.ts` — :41 GENTLE 定义(同源于注入的 NOVEL_STYLE)；:54 gdir 初始化旁(加 pledger)；:174 温情 beatSpec(**追加阶段挪移**)；:177 outlineBeat 软分支 + weave 注入汇流(现成)；:229 loadOutlinePlan(现成)；:312 occupied(**改 steer:soft 不计**)；:387-402 weave 逻辑(**空窗兜底 nextProgressTask**)；:404 beatForChapter 传入(现成)；:450 n%8 canonStep 班车(**搭 advanceStep**)；:475 computeWarmFit 调用(**补 ROOT 入参**)
- `app/progression-ledger.ts` — **新文件**（镜像 gentle-director.ts：load/save/forCh/turn/禁 random）
- `app/warm-fitness.ts` — :18 接口(加 progress)；:75-76 WARM_DONE/NEG_MARK(plan 落点须命中前者)；:91 computeWarmFit(**加 progressMomentum + dir 入参**)；:96 权重(**0.30·var+0.25·bond+0.20·social+0.15·arc+0.10·progress**)
- `app/evolve.ts` — :326-331 GENTLE fold(**不动**，W_progress 已在 wf.total)；:287 conflictRate toward(0.6,1.05) 锚(安全边界)
- `app/gentle-director.ts` — :12 S_TRIGGER=4(容停留哲学，对齐 gap<8)；:52-95 gentleDirect/occupied 让位(正交通道，**勿动**，仅经 T1-4 让 soft 不触发)
- `app/world-gen.ts` — :4-21 SPEC 封闭字段(**不动**，style 由 server 写不入 LLM)
- 实证：`.novel-output/renjian/warm-fitness-history.json`(33 条 ch922→1093，arc 平趴铁证)；`warm-fitness.json`(var9.75/bond10/social3.73/arc3.27@1093)；`genome.json`(conflictRate0.56)；无 `outline-plan.json`(纯涌现确证)
