# 对抗批评要点（必须吸收清单）

> 来源：三方设计（A 慢燃主线脊梁 / B 每章推进引擎+进展账本 / C W_progress 适应度）+ 对抗式审查。
> 本文件只收**经 live 代码与运行态核验过的批评结论**，标注 REAL（真）/ FLAWED（设计有洞）。综合蓝图在 `synthesis.md`。
> 核验日期 2026-06-06，对照 `.novel-output/renjian/`（atCh 1093）与 `app/` live 源码。

---

## 〇、问题立论：REAL（有度量证据，必须保留为北极星）

`warm-fitness-history.json`（33 条，ch922→1093）的可测签名：

| 信号 | 权重(warm-fitness.ts:96) | ch922→1093 表现 | 含义 |
|---|---|---|---|
| var（场景多样） | 0.40（最高） | 9.64–9.75 顶死 | T1/T2/T3 已根治场景坍塌 |
| bond（关系暖） | 0.25 | =10 满 | 关系网已暖满 |
| social（人情往来） | 0.20 | 3.05↔5.24 抖、无趋势 | 结盟/新面孔无累积 |
| arc（善了完成） | 0.15 | **3.21–3.96 平趴、170 章零上升** | **人生处境原地不动** |

`genome.json conflictRate=0.56`（要守的值）。**结论：「场景在换、人生没动」是真问题，arc/social 平趴是「原地循环 / 白发式重演」的机器可读铁证。** 任何方案的成败以「arc/social 出现跨卷上升趋势、且 var 不跌破 ~9.4、conflictRate 不离 ~0.56」为准。

---

## 一、【必吸收·阻断级】NOVEL_STYLE 不在 spawn env → server `isGentle` 与 longrun `GENTLE` 结构性脱钩

**判定：FLAWED（A1 整条分支的前置缺口，load-bearing，非兜底）。已 live 核验。**

- `server.ts:266`（define-world）与 `:321`（new world）两处 spawn env **均无 `NOVEL_STYLE`**：
  ```
  env: { ...process.env, NOVEL_PACK:"freeform", NOVEL_WORLD_CONFIG, NOVEL_SAGA_DIR, NOVEL_STANDBY:"0", NOVEL_TARGET, NOVEL_SECTIONS, NOVEL_WARMUP }
  ```
- `longrun.ts:41` `const GENTLE = process.env["NOVEL_STYLE"]==="温润";` 与 `evolve.ts:44` 同源——二者都只认**进程级 env**。
- 运行中的 renjian 之所以 GENTLE=true，是它从**起 server 的外层 shell** 继承了 `NOVEL_STYLE=温润`，**不是 per-world 配置**。设计 A 原文「该 env 已在某处注入，沿用即可」是**未核验的乐观假设**——新建温情世界根本传不进。
- 后果：若 A1 用 per-world `isGentle(cfg)` 决定生成 plan，会出现「世界被存了 balanced 温情阶段 plan，但 spawn 时进程无 NOVEL_STYLE → longrun GENTLE=false → 走爽文 beatSpec（longrun.ts:175 要求生新事件/冲突/留悬念）」——**温情零冲突 plan 灌进爽文管道，两头不到岸**。

**必须修复**：让 style 成为世界一等公民并贯通 生成→落盘→spawn：
1. cfg 落盘时写入 `style` 字段（server 据 premise 关键词或显式参数判定，世界生成器 SPEC 可不动——见下条）；
2. **spawn env 显式注入**：`server.ts:266` 与 `:321` 两处都加 `NOVEL_STYLE: cfg.style==="温润" ? "温润" : ""`，令 longrun `GENTLE`、evolve `GENTLE`、server `isGentle` **同源于 cfg**。
3. 这同时修了一个**已存在的潜在 bug**（现状新建温情世界传不进 NOVEL_STYLE）。

---

## 二、【必吸收·阻断级】连续无缝 plan → `occupied` 恒真 → **永久关闭 T2**（拉垮 var=9.75）

**判定：FLAWED（A 方案最大盲区，会反噬最高权重指标）。已 live 核验。**

- `longrun.ts:312`：`const occupied = !!beatForChapter(outlinePlan, n+1) || readFs().some(伏笔到期);`
- `gentle-director.ts:69`：`if (occupied || sameStreak < S_TRIGGER) return { sceneShift: null, ... };`——**occupied=true 时 T2 不派任何场景轮换。**
- `beatForChapter`（outline-plan.ts:26-28）对**区间内每一章**返回非空，且超末尾返回末段 goal → 若 plan 覆盖 ch1–1000 连续无缝，**`occupied` 对每章恒真 → T2 全程失效。**
- T2（gentle-director）正是把 `var` 顶到 9.75、根治灶房/旧碗循环的主力引擎，var 在 warmFit 权重 0.40（最高）。**用「加一条主线」的代价把「防场景坍塌」的主力全程关掉 → var 极可能掉回坍塌区、总分不升反降、场景层换汤不换药卷土重来。**
- 设计 A §1.1 用「150–200 章/段」疏松——但**疏松的是 goal 切换频率，不是覆盖率**；覆盖率仍 100%，occupied 仍恒真。这是设计未识别的结构性错误。

**必须修复（二选一，推荐 a）**：
- **(a) 解耦让位——beat 加 `steer` 标志**：`OutlineBeat` 增 `steer?: "soft"|"hard"`，温情阶段 plan 全标 `soft`；`longrun.ts:312` 改为
  `occupied = (() => { const b = beatObjForChapter(plan, n+1); return !!(b && b.steer==="hard"); })() || 伏笔到期;`
  软方向 beat **不抢占** T2 → 慢燃主线（时间维）与场景轮换（空间维）**正交叠加**，每章既有人生方向又有场景流动。
- (b) plan 留呼吸缝：阶段只在其前 1/3 章生效、后 2/3 区间留空 → 呼吸区间 `beatForChapter` 返空 → occupied=false。
- 任一修法后**回归验证 var 不跌破 ~9.4**。

---

## 三、【必吸收·阻断级】cfg.gentle / cfg.lifeArc / cfg.style 字段不存在（隐藏假设管线）

**判定：FLAWED（数据不存在）。已 live 核验 world-gen.ts:4-21 与落盘 renjian.json。**

- `world-gen.ts` 的 `SPEC` 是**封闭字段清单**：displayName / bible / protagonists / factions / locations / tierNames / goalMap / storyEvents / arcs / composePrompt / spawnNames / lore。**无 gentle、无 lifeArc、无 style。** `WorldSlots`（:23）只有 `rules`/`protagonists`。
- 落盘 `worlds/renjian.json` 确实**无** gentle/lifeArc/style（bible **有**）。
- 故设计 A 的 `(cfg as {lifeArc?:string}).lifeArc`、`isGentle(cfg)` 读 cfg.gentle —— **全部恒 undefined/false**。「generateWorldConfig 可顺带产 lifeArc」被写成可选，实为整条 A1 的 load-bearing 前置。

**必须修复**：
1. `style` 不必塞进 LLM SPEC（避免污染生成器）；改由 **server 在落盘 cfg 时附加**（据 premise 关键词或建世界请求显式 style 参数写 `cfg.style`）。`isGentle(cfg)` 读这个 server 写入的字段。
2. **`lifeArc` 只走 `deriveArcFromPremise(cfg.bible)`**（一次额外 LLM，bible 现成可读）作唯一来源，**删除对 cfg.lifeArc 的依赖**。renjian 用写死 arcSeed 验证。

---

## 四、【必吸收】§A2「每章强制挪移」+「不可与近章停在同一境地」=强否定逃逸 → LLM 用「制造小事件/小冲突」最省力满足（破温情风险）

**判定：FLAWED（措辞层逃逸）。**

- outline beat 在结构上碰不到 conflictRate（warmFit 不读 plan，evolve.ts:326/331 经核实——见第六条），**但 prose 层有逃逸**：「不可与近章停在同一境地」是**强否定式**，LLM（DeepSeek）满足「可见变化」最省力的方式是**生一个小冲突/小麻烦**（冲突是最廉价的可见变化），恰是 cr=0.56 想压住的。
- 「每章都要挪一步」与 var（场景多样，权重 0.40）**竞争 LLM 注意力**却无连接。

**必须修复**：
1. 删「不可与近章停在同一境地」强否定；
2. 推进力**锚到阶段、不锚到章**：「**本阶段内**主角处境宜较**阶段开端**有所挪移（多识一人/多走一程/心境长进/近一桩牵念），**不必每章都动、容得下纯质感的呼吸章**」——与 gentle-director `S_TRIGGER=4`（容温情合理停留）的节奏哲学对齐；
3. 加与 `NEG_MARK`（warm-fitness.ts:76）一致的负向自检句：「这一步**不靠**任何冲突/争斗/危机/失去来体现」。

---

## 五、【必吸收】无「处境」机读账本 → 「较上章挪移」无 ground truth、阶段切换不校验达成 → 复现「文案换了人没动」的新循环；且柳如烟未覆盖

**判定：FLAWED（机制缺度量回路）。已核 writeChapter 入参。**

- `writeChapter`（longrun.ts:171/404）只拿到 `recent`（**仅章节标题**，:447 `第${n}章「${ch.goal}」`）、`prevHook`（上章末拍串）、`bible`（200 字滚动摘要）。**无任何结构化「虚谷当前处境/身份/已了牵念」**。
- 后果：①「较上章挪移」只能 LLM 拿标题+摘要自评、无 ground truth；②`beatForChapter` 纯区间查表，到 ch161 自动切下一段 goal、**不管前段是否真达成** → 会复现新循环：plan 在卷区间上推进，prose 里人原地，只是 outline 文案换了；③ §1.1 阶段表全是虚谷，**柳如烟（第二主角）的重演风险完全没覆盖** → 第二主角必然原地。

**必须修复**：
1. **接已有 arc 信号做闭环**：把每段 goal 的「可观测落点」改写成能命中 `WARM_DONE`（团聚/和解/抵达/释怀/了却/相托/安顿…，warm-fitness.ts:75）的境地词 → 阶段达成与否**自动反映在 arc 分数**上，给「无度量」的推进一个**已存在的**反馈表盘（零新管道）。
2. **轻量「处境游标」**（不必新状态机）：注入 beat 时附「**上一阶段落点：{prevStageGoal}**」，让 LLM 知「从哪挪到哪」而非只知「现在该到 X」，把区间查表升级成带 from→to 的位移。
3. **阶段 goal 留一栏写「与柳如烟的关系/她的处境该走到哪」**，否则第二主角原地。
4. （进阶，对应方案 B/C）若上 `progression-ledger.json`：每 8 章搭 `canonStep` 同班 LLM（longrun.ts:450 区，`temperature:0.2` JSON）读近 8 章判里程碑达成、写回 situation，**才是真正的处境账本**——但须严守 forCh/turn 纪律、禁 random/Date.now（复刻 gentle-director）。

---

## 六、【已核·无冲突，可放心】warmFit / evolve / conflictRate 锚 / foreshadow / 双模式 obedience

**判定：REAL 无冲突（这些是安全边界，蓝图须保持不破）。已逐一 live 核验。**

- **warmFit 不读 outline-plan**：`computeWarmFit`（warm-fitness.ts:91）入参仅 events/snapshot/recentCh → outline beat **碰不到 fitness 信号**，只经「写出的 prose」间接影响。✅ 进化层零直接污染。
- **evolve GENTLE fold**（evolve.ts:331）：`0.45·llmFit + 0.15·objFit + 0.10·consFit + 0.30·wf.total`，读 warmFit 不读 simFit（:326-328）；conflictRate 每代 `toward(·,0.6,1.05)`（:287）锚回温和、`drama.ts` GENTLE heat=0 只下拉不上推。✅ 戏剧层已中性化，outline 影响不进 fitness、不动 conflictRate。
- **foreshadow / 让位**：伏笔到期与 outline 共用同一条 `occupied` 让位闸（longrun.ts:312），二者天然互斥不打架。✅
- **双模式 obedience**：strict/balanced 互斥取值，本方案恒 balanced（绝不可 strict——strict 分支「必须服务推进、不可跑偏」会杀死 slice-of-life），与用户手动 strict 跟纲世界不冲突。✅
- **隐藏第五梯度**（据 memory 温情向条目）：`drama.ts` 每章覆写 tuning——本方案只走 outlineBeat、不写 tuning，故不被覆写、也不覆写它。✅

---

## 七、【必吸收】过度约束涌现 → slice-of-life 变生硬 KPI 打卡

**判定：现状设计 REAL 风险 / 改后可控。**

- 两放大器叠加（§1.1 覆盖率 100% + §A2 每章强制位移）= 给 slice-of-life 装每章往前拽的链条，把「寻常微光、相望相渡」压成「每章打卡推进人生 KPI」。canon.json 虚谷 8 条纯质感（豁口朝向自己、橘皮拢得轻轻的）正是世界灵魂，过密推进锚会挤掉留白。
- 护栏对的部分（**保留**）：obedience=balanced 软分支（longrun.ts:177「世界若自发涌现变数，可顺其自然地偏离，不必硬贴」）是好的涌现护栏；阶段 goal 写**境地**（接纳/被托付/窥见门径）非**事件**，「身份挪移非情节升级」这条设计做对了。

**必须修复**：采纳第二条稀疏化（steer:soft 不抢 T2 或留呼吸缝）+ 第四条锚到阶段容质感章 → 推进密度从「每章」降到「阶段内偶尔」。

---

## 汇总表（六条阻断级 / 必吸收）

| # | 轴 | 判定 | 阻断级? | 核心修正 |
|---|---|---|---|---|
| 一 | NOVEL_STYLE 不在 spawn env | FLAWED | **是** | style 入 cfg（server 写）+ spawn env 显式注入 NOVEL_STYLE，令 GENTLE/isGentle 同源 |
| 二 | 连续覆盖→occupied 恒真→永久关 T2 | FLAWED | **是** | beat 加 `steer:"soft"`，occupied 只认 hard；或 plan 留呼吸缝；回归验 var≥9.4 |
| 三 | cfg.gentle/lifeArc/style 不存在 | FLAWED | **是** | style 由 server 落盘附加（不入 LLM SPEC）；lifeArc 只用 deriveArcFromPremise(bible)，删 cfg.lifeArc 依赖 |
| 四 | §A2 强否定→冲突逃逸 | FLAWED | 是 | 删「不可停同境」；锚到阶段、容呼吸章；加「不靠冲突体现」自检 |
| 五 | 无处境账本→文案换人没动；柳如烟未覆盖 | FLAWED | 是 | 落点改写命中 WARM_DONE 闭环 arc；注入「上一阶段落点」给位移；补柳如烟线；进阶上 progression-ledger |
| 六 | warmFit/evolve/foreshadow/双模式 | REAL 无冲突 | — | 保持不破（安全边界） |
| 七 | 过度约束涌现 | 现状 REAL / 修后可控 | 是 | 稀疏化 + 容质感章 + obedience 恒 balanced |

**最关键两条（决定方案能否成立）**：① **第一条**（NOVEL_STYLE 同源）是触发前置；② **第二条**（steer:soft 不关 T2）是不反噬 var 的命门。二者不修，A 方案净效应可能为负。
