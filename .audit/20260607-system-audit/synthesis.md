# 系统审计最终报告 — 三批改动整合健康度 + 对抗验证综合

- 日期: 2026-06-07
- 范围: 今天三批改动 = ①温情变化驱动器(gentle-director / sceneShift) · ②叙事推进力(progression-ledger / W_progress) · ③涌现型推进(gentle-emergence / W_emerge)，整合进 warm-fitness 六信号 + longrun 主循环 + evolve 基因折算。
- 方法: 8 维原始审计 → 对抗式逐行复核(recall 模式: 非 REFUTED 全保留) → 本报告做收口裁决。所有结论均经源码逐行 + node 实测核验。
- 核验手段补记(本轮亲自复跑，非转述): node 实测死正则 0/4 命中、substring 正则 4/4 命中、fix 候选 4/4 提取成功；grep 实证 `9.4/9.84` 全仓仅 1 行注释、gentle-director 零 `wf` 引用、三新文件零 `Math.random/Date.now`(仅注释提及禁令)、`computeWarmFit` 全仓唯一调用点(longrun:517)、`gentleEmergence` 唯一消费点(longrun:425, 在 `GENTLE && pledger && weave===""` 块内)。

---

## ① 真实问题清单（按严重度排序）

去重后共 **8 条保留项**（recall）+ 3 条纯 REFUTED（不计入清单，附录列明）。**无阻断级、无高危级**。

### 阻断（Blocker）
**无。** 三批改动整合后无任何阻断级冲突。所有新逻辑严格 GENTLE-gated、无共享可变态污染 core T2 派发、无编译/类型/落盘破坏。

### 高（High）
**无。** 原始 8 维里被标「高」的唯一一条（longrun:425 新颖闸漏判 → 重复播报 faction/pair）经对抗复核后**降级**：其 pair 半部分是死代码（见 C7），faction 半部分触发窗口极窄（见 P1），实际后果是「温情 prose 偶发一句轻微重复」，bounded、不崩、不污染 fitness。故无高危。

### 中（Medium）— 2 条

**M-1 · C7（新发现，原 8 维均漏）· gentle-emergence.ts:23 死正则 → `firstBonds`/`seenPairs` 整条特性死代码**
- 位置: `app/gentle-emergence.ts:23` `const m = id.match(/^(\w+)-ally-(\w+)$/);`
- 问题: 真实 ally 事件 id 格式 = `${char.id}-t${tick}-ally-${other.id}`（`core/actors/character-actor.ts:43` `base = \`${char.id}-t${tick}\``；:85 `id: \`${base}-ally-${other.id}\``），如 `c1-t99-ally-s37`。`^(\w+)` 不跨连字符，遇 `-t99-` 即断 → **对任何真实 id 永不匹配**（node 实测 6 样本 0/4..0/6 全 no-match）。故 :24 `if (m)` 块永假，`firstBonds` 恒空、`seenPairs` 永不写也永不读。
- 触发后果: emerge 摘要里「谁与谁初识」一句永不产出（`renderEmergence`:52 的 firstBonds 分支永空），温情 weave 少一路涌现素材；`seenPairs` 跨章状态白维护。**不崩、不污染 fitness、不影响爽文**，纯属功能缺失（设计承诺的「首次结识」涌现素材从未上线）。
- 为何是「中」: 不是 bug 导致错误输出，而是一整条已写好的温情涌现特性静默失效；属于「实现了但没生效」，比可观测性缺口严重，但远低于会破坏运行/确定性的级别。
- 修复建议（具体改法）: 把正则改为含 `-t\d+-ally-` 的子串提取。推荐
  ```ts
  const m = id.match(/^(\w+)-t\d+-ally-(\w+)$/);
  ```
  （node 实测 4/4 正确提取 `[char, other]`）。或更稳健 `id.split("-ally-")`，左端再剥尾部 `-t\d+`。改后 `firstBonds` 即恢复产出。**注意**: warm-fitness.ts:122 / :68 的 emerge/social 用的是 substring `/-ally-/`（实测 4/4 MATCH），**那两处是对的，不要动**——只有 gentle-emergence.ts:23 这一处用了锚定全匹配才坏。

**M-2 · P4（合并 interaction#2 + dim-2#3 + dim-3#2）· occupied 代理不覆盖 pledger weave → 同章「换景硬指令 gdDomain + pledger 推进任务」叠压**
- 位置: `app/longrun.ts:324`（occupied 定义）+ `:363`（gdDomain 落地驱动 outline 硬指令）+ `:420-426`（pledger weave 注入）；gentle-director 内 `:69-70`（occupied 硬抑制 sceneShift）。
- 问题: `occupied = isHard || readFs().some((f) => !f.paid && f.dueCh <= n+1)`。GENTLE plan 恒 `steer:"soft"`（`outline-plan.ts:83`）→ `isHard` 对 GENTLE 恒假 → occupied 退化为「n+1 有伏笔到期」单条件。occupied 只挡 hard-steer + 伏笔到期，**不挡 pledger 的 `nextProgressTask`**（第三条 weave 来源）。当某章 n 既被上一轮派了 sceneShift→gdDomain（换场景域硬指令），又是 pledger 空窗推进章（weave 非空、gap≥8）时，二者同章共存：gdDomain 驱动 outline 硬换景指令，pledger 注入「本章叙事任务·须落实·朝阶段目标挪一小步」。
- 触发后果: **非逻辑冲突**（line 320 设计注明「慢燃主线 + 场景轮换正交叠加」是有意），而是 **prompt 负载冲突**——4 段节拍预算（SECTIONS=4）同时塞「换场景 + 推进 + emerge 素材」，易稀释温情留白；且「occupied 让位」字面承诺与实际「换景+推进同章共存」有口径落差。是否真过载取决于 LLM 实际产出。
- 修复建议（具体改法，可缓做）: 若希望 pledger 推进章也免于被强行换域，给 occupied 补 pledger 维度。最小改法——在 :324 occupied 计算前预判本章是否会落 pledger 任务（`GENTLE && pledger && !已有伏笔到期 && (n - pledger.lastAdvanceCh) >= 8`），若是则视作 occupied=true 让 gentle-director 为 n+1 让位：
  ```ts
  const pledgerWillFire = GENTLE && pledger && (n + 1 - pledger.lastAdvanceCh) >= 8
                          && !readFs().some((f) => !f.paid && f.dueCh <= n + 1);
  const occupied = isHard || pledgerWillFire || readFs().some((f) => !f.paid && f.dueCh <= n + 1);
  ```
  （注意此处判的是 n+1 的 pledger 是否会 fire，与 sceneShift 的 forCh=n+1 对齐）。**若维持现状亦可接受**——设计本就声明叠加正交；建议先观测实际章节是否出现「换景+推进+涌现」三指令挤压温情留白，有证据再改。

### 低（Low）— 5 条

**L-1 · C1（合并 dim-1#1 + interaction#5）· longrun.ts:519 控制台日志漏打第 6 信号 wf.emerge**
- 位置: `app/longrun.ts:519`。
- 问题: line 147 `total` 含 `0.05*wEmerge`，但 :519 `console.log` 只到 `…善了${wf.arc} · 推进${wf.progress}`，**无 emerge**（实测确认）。
- 触发后果: 任一 GENTLE 世界每 8 章。运维 stdout 看不到涌现分，排查「sim 层措辞改动是否被进化反映」时缺可观测量。**纯可观测性缺口**，落盘(warm-fitness.json 含 emerge)/适应度(evolve 读 wf.total 含 emerge)均正确，零行为影响。
- 修复建议: :519 末尾补 `· 涌现${wf.emerge}`。一行改。

**L-2 · P1（dim-2#1 / interaction#3 的 faction 子句，降级）· longrun.ts:425 + gentle-emergence.ts:17-20 · faction 首现闸偶漏判**
- 位置: `app/longrun.ts:425`（emerge 仅 `weave===""` 才调用）+ `app/gentle-emergence.ts:17-20`（faction 首现写 seenFactions）。
- 问题: `gentleEmergence` 只在空窗章被调用、且调用时才把首现 faction 写进 seenFactions。若某 faction 的真正首条 `CharacterEntered`（`core/runtime/world-actor.ts:235`，注意 :233 有 `!snapshot.characters[ch.id]` 守门——**仅 id 首入才发，非每次 spawn 都发**，原报告「每次 spawn 都发」措辞不准）恰落在伏笔章（weave≠""）→ 该 faction 未入 seen → 日后空窗章再有该 faction 新成员入场时被当「新世态」播报。
- 触发后果: 温情 prose 偶发「近来这一带似有 X 派的人往来」轻微重复。**触发被严重削弱**: `FACTIONS` 仅 6 个固定值（`packs/xianxia-bazi/index.ts:319`），warmup+前几章即耗尽全部 6 个进 seen 集，「某 faction 真正首现且恰在伏笔章且此前从无该派露面」的窗口极窄。bounded、不崩、不污染 fitness。
- 修复建议（可缓做）: 若要根治，把 seenFactions 的首现登记从「仅 emerge 调用时」移到「每章无条件扫 newEvs 登记，emerge 仅负责渲染」。即在 :378 算出 newEvs 后无条件 `for (const e of newEvs) if (e.kind==="CharacterEntered") { const f=...; seenFactions.add(f); }`，让 emerge 只读不写。但鉴于触发极罕见，**可不改**。

**L-3 · P2（dim-2#2 / interaction#4 的 faction 子句）· longrun.ts:234 + 425 · resume 后 seen 集重置致 faction 偶被当首现**
- 位置: `app/longrun.ts:234` `const seenFactions = new Set()`（实测不落盘、不从磁盘载）+ :425。
- 问题: seenFactions 每次进程启动为空。重启后凡新 `CharacterEntered` 落入 newEvs（faction ∈ 6 固定集、重启前早已播报过）→ `!seenFactions.has(f)` 真 → 被当首次。缓解: :235 `evCursor=maxSeq` 使 resume 首章 newEvs 空、emerge 暂哑；但其后任一新 `CharacterEntered` 即触发。
- 触发后果: 温情 prose 偶发重复（≤6 次，bounded），不崩、不污染 fitness。:232 注释自认「轻微首章重复，可接受」。属已知取舍。与铁律「禁 random/Date.now 保 resume 确定性」精神有缺口（这是**状态丢失**，非时间/随机源违规）。
- 修复建议（可缓做）: 若要完全 resume 复现，把 seenFactions/seenPairs 落盘（与 gentle-director.json / progression-ledger.json 同款 save/load），进程启动时 load。但当前为有意取舍且影响有限，**可不改**。

**L-4 · P3（合并 interaction#1 + dim-3#1）· W_progress(②) 与 W_emerge(③) 非正交、同批 world-event 双通道驱动**
- 位置: `app/warm-fitness.ts:116-137`（emerge 读 `ProgressionAdvanced`→tierFreq、`-move`→moveRatio）+ `:99-111`（progress 读账本 reachedMilestones/lastAdvanceCh）；账本 lastAdvanceCh 由 `advanceStep`（`progression-ledger.ts:111` `gotNew||moved`）经 LLM 读近 8 章后置（longrun:496-499 每 8 章跑，与 warm-fit 计算 :517 同 `n%8===0` 块、读重叠事件/章窗——**对抗验证已实证此耦合 live**）。
- 问题: 一次 `ProgressionAdvanced` → 抬 emerge.tierFreq **且** LLM 可能判里程碑/道行长进 → reachedMilestones → progress；一次 `-move` → 抬 emerge.moveRatio **且** locationId 变 → LLM 报新 place → moved → lastAdvanceCh → progress.freshScore。两者**正相关（同向）**，非「打架」。文件头注释(:10)只声明 social↔emerge 正交、var↔progress 正交，**从未论证 progress↔emerge 正交**。
- 触发后果: move/破境爆发经两路（0.10 + 0.05 权重）同向放大 total，静止世界两路同向压低。6 信号独立性弱于文档自述；量级小（合计 0.15 权重，且经 LLM 处境判定解耦——move 不直接写 lastAdvanceCh）、非阻断。
- 修复建议（可缓做，多为文档修正）: ①诚实化注释——在 :10/:146 注明「progress 与 emerge 在 move/tier 维度存在弱正相关，非完全正交，二者合计 0.15 权重，重叠影响可接受」。②若要真去耦，可让 emerge 的 moveRatio/tierFreq 改读「与 progress 不同的量」（如只数措辞多样 verbVariety + faction 广度，砍掉 move/tier 两项），但会削弱 emerge 对 sim 层 S2/tier 改动的敏感度——得不偿失。**建议仅改注释**。

**L-5 · P5（dim-1#4）· warm-fitness.ts:146 注释「9.84≫9.4 命门」是纯口头不变量，无代码/测试护栏**
- 位置: `app/warm-fitness.ts:146` 注释。
- 问题: grep 全仓 `9.4`/`9.84` **仅命中本行注释**（实测确认），零代码读取/断言。命门靠「sceneDiversity 函数未改」间接保证；若有人改 :48 的 clamp/系数，无任何断言守住 9.4。
- 触发后果: **无 bug**，是可执行保证缺失的设计风险。
- 修复建议（可缓做）: 加一条最小断言/单测——对固定的多样化样本调 `sceneDiversity` 断言返回 ≥9.4，或在 computeWarmFit 旁加 dev-only `console.assert`。当前无回归证据，**可不改**。

---

## ② 整合健康度结论：三批改动整合后**健康运行，无阻断级冲突**

**结论: 健康运行（PASS），无阻断、无高危。**

- 三批改动（①温情变化驱动器 sceneShift、②叙事推进力 progression-ledger/W_progress、③涌现型推进 gentle-emergence/W_emerge）整合进 warm-fitness 六信号后：
  - 权重和精确 = 1.0：`0.25(var)+0.25(bond)+0.20(social)+0.15(arc)+0.10(progress)+0.05(emerge)`（warm-fitness.ts:147，实测求和=1.0）。
  - `computeWarmFit` 全仓**唯一调用点** longrun.ts:517，传 ROOT，与 saveWarmFit(:518)、progression-ledger 落盘根一致；recentCh(:509) 携 `{goal,text}`。
  - 接口/落盘/history 三处一致：WarmFitness/WarmHistory 含 progress/emerge(:22-23)，save 落整对象(:33) + history 显式 push progress/emerge(:35)，load 整体 parse(:29)。
- **唯一「中」级整合问题**是 C7（③涌现型推进的一条子特性 firstBonds 因死正则未上线）——这是「实现了没生效」，**不影响其余三批改动的正确运行**，emerge 的 faction/move/tier 三路仍活、W_emerge 仍正常折进基因。
- 整合**未引入**任何编译错误、类型错误、落盘破坏、循环 import（progression-ledger 不 import warm-fitness；warm-fitness 仅依赖 sim-fitness/gentle-director/progression-ledger，无环）。

---

## ③ 三系统交互专项结论：**基本不互踩，仅 2 处「同向放大 / 负载叠压」非冲突**

**结论: 三系统不互踩（无逻辑冲突 / 无状态竞争 / 无 core 串台），仅存 2 处设计层耦合（均非 bug）。**

逐项核验（对抗复核已 REFUTED 的「互踩」误报）:
1. **emerge/pledger 不干扰 core T2 派发（REFUTED 误报，实为安全）**: emerge/pledger（longrun:420-426）只读 newEvs + 拼 weave 串、**不写 spd.snapshot、不碰 occupied 输入**，且在 T2 派发（:318-333，与 step 同 withLock）**之后**的独立段执行 → 无共享可变态，无法另路干扰 T2。
2. **advanceStep 里程碑判定与处境差分不冲突（REFUTED 误报）**: `gotNew || moved`（progression-ledger:111）是并集增量叠加，非互斥分支。
3. **soft 脊梁正确不抢 T2 命门（REFUTED 误报）**: gentle plan 恒 `steer:soft`（outline-plan.ts:83）→ isHard 恒假 → soft 不抢 T2 var 不被关。
4. **存活耦合 #1（L-4/P3）**: W_progress ↔ W_emerge 在 move/tier 维度**同向正相关**（非互踩，是奖励轻微重叠，合计 0.15 权重）。
5. **存活耦合 #2（M-2/P4）**: occupied 代理不覆盖 pledger → gdDomain 换景 + pledger 推进可同章共存（**prompt 负载叠压，非逻辑冲突**，设计本声明正交叠加）。
- **关键正交性成立**: var(读 prose 2-gram) ⊥ social(读 events ally比/新面孔) ⊥ emerge(读 events 措辞种类/faction广度) ⊥ progress(读账本)——数据源各自独立；唯 progress↔emerge 在 move/tier 上语义弱重叠（已记 L-4）。

---

## ④ 爽文回归专项结论：**GENTLE 门控完整，爽文逐字节安全**

**结论: 爽文（NOVEL_STYLE≠温润，GENTLE=false）逐字节安全，三批改动零侵入。**

- **GENTLE 门控完整性（实测逐点确认）**:
  - `GENTLE = process.env["NOVEL_STYLE"] === "温润"`（longrun:43）。
  - ②叙事推进力: `pledger = GENTLE ? loadPL(ROOT) : null`（longrun:57）→ 爽文 pledger=null。三处消费 :420 `if(GENTLE && pledger && weave==="")`、:438 `if(GENTLE && pledger)`、:496 `if(GENTLE && pledger && n%8===0)` 全双闸。爽文一律短路。
  - ③涌现型推进: `gentleEmergence`/`renderEmergence` 唯一消费点 longrun:425，位于 `if(GENTLE && pledger && weave==="")` 块内（实测 awk 确认块边界）→ 爽文永不进入。
  - ①温情变化驱动器: sceneShift 派发块 longrun:318 `if(GENTLE && gdir)`；消费 :361 `if(GENTLE)`；arrived 差分 :367 `(GENTLE && prevPresent.size>0) ? … : undefined` → 爽文 arrived=undefined、roster 零变更。
  - warm-fitness 整体: longrun:516 `if(GENTLE)` 才算 wf；evolve.ts:326 `const wf = GENTLE ? loadWarmFit(dir) : null`，:328 `simFit!==null && !GENTLE` 走戏剧分支，:330 `GENTLE && wf` 才折 warmFit → 爽文适应度公式 = `0.42*llmFit + 0.18*objFit + 0.12*consFit + 0.28*simFit`（:329），**与三批改动无关**。
- **core S1/S2 对爽文的影响**: S1（ally 措辞库化）/S2（move 可选启用）是 core/packs 层改动，**对爽文非零侵入但安全**：
  - S2 move（character-actor.ts:142-149）只加 `harmony`(去结新缘) + `initiative`、**零 discord**（:143 注释明示「守 conflictRate，不推高 clash」）→ 爽文戏剧密度不被削。move 是「久居思动」用 acts 计数确定性触发、无 random。
  - S1 ally 措辞库（allyVerb）是 summary 文案多样化，爽文照常生成 engage 候选，不改 valence/不改派发逻辑。
  - 两者经引擎现有钩子消费，爽文 simFit/sift/tension 计算路径不变。
  - 注: S1/S2 属 core 通用进化产物（非今日三批 app 层改动），其「对爽文非零但安全」是既有结论；今日三批（warm-fitness/emergence/pledger）则是**纯 app 层 GENTLE-gated、对爽文逐字节零侵入**。
- **drama.ts 第五梯度（记忆笔记点名的隐藏覆写）**: dramaControl 每章覆写 tuning，但 GENTLE 分支已正确闸住——`heat = gentle ? 0`（drama.ts:42）、conflictRate 不被 heat 上推（:47）、structureGrowth skip `if(!gentle…)`（:48）→ GENTLE 下 drama 写 base 基因、不挑冲突。爽文（gentle=false）则正常加注，**与今日改动无交叉**。

---

## ⑤ resume / 确定性专项结论：**确定性达标，仅 emerge seen 集一处已知状态丢失（低危、有意取舍）**

**结论: resume 确定性达标，无随机/时间源违规；唯一缺口是 emerge 的 seenFactions/seenPairs 不落盘（L-3，bounded 低危）。**

- **随机/时间源（铁律）**: 三新文件 warm-fitness.ts / gentle-emergence.ts / progression-ledger.ts **零 `Math.random`/`Date.now`**（实测：仅 progression-ledger 注释 3 处提及禁令，无实际调用）。progression-ledger 选择全基于 `pl.turn` 自增计数器（:113）。gentle-director 概率挂风物用 `turn` 低位确定性（:84-86）。S2 move 用 acts 计数。
- **落盘/重建确定性**:
  - progression-ledger.json 落盘（含 situation/reachedMilestones/writtenBeats/lastAdvanceCh/turn）→ ②叙事推进力 resume 完全复现。
  - gentle-director.json 落盘 → ①温情驱动器 resume 复现。
  - warm-fitness 是纯函数（读 events + snapshot + 账本 + recentCh 现算），无状态、天然 resume 安全。
  - evCursor resume 安全: :235 已有章节则设 maxSeq，免首章把全史当近时变故重灌 LLM。
  - prevPresent resume 安全: 启动空集，arrived 被 `prevPresent.size>0` 守门 → 首章 arrived=undefined，无「新到此地」误刷。
- **唯一缺口（L-3）**: seenFactions/seenPairs（longrun:234）不落盘、进程启动重建空集 → resume 后 faction 首现判定基准漂移，偶发 ≤6 次「近来似有 X 派往来」重复。**这是状态丢失而非随机/时间违规**，:232 注释明示为有意取舍（「轻微首章重复，可接受」），且 pair 通道因死正则(C7)本就不产出。bounded、不污染 fitness。
- **loadPL 健壮性（R2 死分支）**: loadPL（progression-ledger.ts:27-30）三路径永返非 null（命中 `{...EMPTY(),...JSON.parse}`、不存在 `EMPTY()`、异常 `EMPTY()`），故 warm-fitness.ts:102 `if(!pl||…)` 的 `!pl` 是死防御、**零功能后果**（后半 `reachedMilestones.length===0 && writtenBeats.length===0 && lastAdvanceCh===0` 正等价 EMPTY 中性判定）。不影响确定性。

---

## ⑥ 修复清单

### 立即修复清单（阻断/高危）
**无阻断、无高危 → 无立即必修项。** 系统当前可继续运行。

### 可缓做清单（中/低，按建议优先级）

| 优先 | 项 | 文件:行 | 改法 | 工作量 |
|---|---|---|---|---|
| 建议尽早 | **M-1/C7** firstBonds 死正则 | `app/gentle-emergence.ts:23` | 正则改 `/^(\w+)-t\d+-ally-(\w+)$/`（实测 4/4 提取正确）；勿动 warm-fitness 的 substring `/-ally-/` | 1 行 |
| 低成本即收益 | **L-1/C1** 日志漏 emerge | `app/longrun.ts:519` | 末尾补 `· 涌现${wf.emerge}` | 1 行 |
| 评估后决定 | **M-2/P4** occupied 不覆盖 pledger | `app/longrun.ts:324` | 给 occupied 补 `pledgerWillFire` 维度（见 M-2 代码块）；或维持现状(设计声明正交叠加)——先观测三指令是否挤压留白 | 中 / 或不改 |
| 仅文档 | **L-4/P3** progress↔emerge 弱正交 | `app/warm-fitness.ts:10,146` | 注释诚实化：注明 move/tier 维度弱正相关、合计 0.15 权重可接受；勿砍 emerge 的 move/tier(会削敏感度) | 注释 |
| 可不改 | **L-2/P1** faction 首现偶漏 | `app/longrun.ts:378` | 若根治：每章无条件登记 seenFactions、emerge 只读；触发极罕见，可不改 | 中 / 或不改 |
| 可不改 | **L-3/P2** seen 集 resume 重置 | `app/longrun.ts:234` | 若要完全复现：seenFactions/seenPairs 落盘+启动 load；有意取舍、bounded，可不改 | 中 / 或不改 |
| 可不改 | **L-5/P5** 9.4 命门无护栏 | `app/warm-fitness.ts:48,146` | 加 dev-only 断言/单测守 sceneDiversity≥9.4；无回归证据可不改 | 小 / 或不改 |
| 清理 | **R2** loadPL `!pl` 死分支 | `app/warm-fitness.ts:102` | 删 `!pl ||`（冗余防御）；零功能后果，纯整洁 | 1 行 / 或不改 |

**总评**: 三批改动整合**健康、可上线运行**。建议优先修 M-1(C7 死正则，让 firstBonds 涌现特性真正上线)与 L-1(补日志)两条一行改；M-2 先观测再定；其余 L 级与 R2 为可选整洁/文档项，无运行风险。

---

## 附录 · 纯 REFUTED（不计入问题清单）
- **R1**: dim-2/interaction 各发现里依赖 seenPairs/firstBonds 的 **pair 子句**全 REFUTED——机制不存在（死正则 C7）。但 C7 本身作为「死特性」新 bug 已列 M-1。
- **R3**: 权重和=1.0 / computeWarmFit 唯一调用点 / 接口一致 / var 命门(权重侧) / emerge-social-var 三源正交——全部 REFUTED（验证为真，无问题）。
- **R4**: emerge/pledger 不干扰 core T2 派发 / advanceStep 双逻辑并集 / soft 脊梁不抢 T2——REFUTED（验证为真，无冲突）。

## 附录 · 去重映射
- dim-1#1 ≡ interaction#5 → L-1/C1
- dim-2#1 ≡ interaction#3 → R1(pair 死码) + L-2/P1(faction 子句)
- dim-2#2 ≡ interaction#4 → R1(pair 死码) + L-3/P2(faction resume)
- interaction#1 ≡ dim-3#1 → L-4/P3
- interaction#2 ≡ dim-2#3 ≡ dim-3#2 → M-2/P4
- 新增 → M-1/C7（原 8 维均漏）
- evolve.ts:330 注释口径过时（dim-1#4 末半）→ 并入 L-4 文档项（注释诚实化）

## 附录 · 相关源码绝对路径
- /Users/chris0810/Documents/Codex/Novel System/app/warm-fitness.ts （六信号合成 :147 权重和=1.0、:102 死分支、:146 命门注释、:116-137 emerge、:99-111 progress）
- /Users/chris0810/Documents/Codex/Novel System/app/gentle-emergence.ts （:23 死正则=C7、:17-20 faction 闸、:52 firstBonds 渲染）
- /Users/chris0810/Documents/Codex/Novel System/app/longrun.ts （:43 GENTLE、:57 pledger gate、:234 seen 不落盘、:324 occupied、:363 gdDomain、:420-426 pledger/emerge weave、:496-519 每8章块、:519 漏日志）
- /Users/chris0810/Documents/Codex/Novel System/app/progression-ledger.ts （:27-30 loadPL 永非空、:62-79 nextProgressTask、:111 gotNew||moved、:113 turn）
- /Users/chris0810/Documents/Codex/Novel System/app/gentle-director.ts （:63 stuck、:69-70 occupied 硬抑制、:84-86 turn 确定性、零 wf 引用）
- /Users/chris0810/Documents/Codex/Novel System/app/outline-plan.ts （:83 steer 恒 soft、:87 obedience 恒 balanced）
- /Users/chris0810/Documents/Codex/Novel System/app/evolve.ts （:326 wf 守门、:328-332 GENTLE 适应度分支）
- /Users/chris0810/Documents/Codex/Novel System/app/drama.ts （:42 gentle heat=0、:47-48 GENTLE 不挑冲突=第五梯度已闸）
- /Users/chris0810/Documents/Codex/Novel System/core/actors/character-actor.ts （:43 base 带 -t{tick}、:85 ally id、:142-149 move id+零 discord）
- /Users/chris0810/Documents/Codex/Novel System/core/runtime/world-actor.ts （:233-235 CharacterEntered 仅 id 首入才发）
- /Users/chris0810/Documents/Codex/Novel System/packs/xianxia-bazi/index.ts （:319 FACTIONS 6 固定值）
