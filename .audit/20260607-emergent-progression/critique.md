# 对抗批评（独立复核 · 同时审 A 设计与其原批评）— 涌现型叙事推进（情节层 T2'）

> 复核日期 2026-06-06。本批评不复述任一方，而是用**当场重测**的 live 库（`.novel-output/renjian/world.db`，347 commit / 70 章）、控制库（`renjian-killed-20260606-180327`，**1481 commit / 380 章**）、源码（longrun.ts / warm-fitness.ts / progression-ledger.ts / gentle-director.ts / character-actor.ts / packs/xianxia-bazi）逐条裁定。凡两方说法与库不符，以库为准并改判。

---

## 0. 当场重测铁证（先摆数据，后裁定 — 含纠正两方处）

### 0.1 事件计数（live renjian，sqlite 实测）
```
StageCommitted 347 | CharacterEntered 18 | ProgressionAdvanced 38
CharacterFell 4 | CharacterTranscended 2 | VengeanceResolved 4 | FactionDissolved 0
```
- `upsets`(longrun.ts:369) = Fell+FactionDissolved+Vengeance+Transcended = **10 个灾难事件**；ally/entered/advanced 共 **193+** 个温情涌现事件确实不走这条通道。**「upsets 丢弃温情材料」属实（两方一致，成立）。**

### 0.2 候选类型分布（关键 — 同时纠正设计与原批评）
对 347 个 `chosenCandidateId` 抽 `-TYPE-` token：
```
-ally-  137   (58%)
-clash-  58   (25%)
-avenge- 40   (17%)
-move-    0   ← 候选存在(character-actor.ts:134 `${base}-move`)，但 prior 从未选中
-obs-     0   ← 不存在(独修候选无 -obs- 后缀，summary 是「观望蓄势」但 id 无该 token)
-act-     0   ← 不存在
```
**纠正原批评**：原批评称「候选只有 ally/obs/clash/act/avenge」——**库里只有 ally/clash/avenge 被选中**，obs/act 是它脑补的类型名。
**纠正设计**：设计的 `partings.push(sum)`(`/-move\b/`) —— `-move` 候选**确实生成**(character-actor.ts:126-141，kind:"move")，但 **347 commit 里 0 次被选中**（prior 给 move 只 `initiative:0.4`，敌不过 ally 的 harmony:1 / clash 的 discord:1）。所以 partings 的 `-move` 来源**在实践中恒空**——设计的该分支是**事实死代码**，但原因不是「类型不存在」，而是「prior 永不选它」。这点对蓝图的治本方向（改 prior 让 move 可选）有直接价值，两方都没说到。

### 0.3 单模板坍塌（原批评核心，重测后**更严重**，成立）
```
live   : 137 条 ally summary，剥去人名后 100% = 「虚谷论道结善」
control: 545 条 ally summary，剥去人名后 100% = 「虚谷论道结善」  (380 章规模下零变体)
```
源头实锤：`core/actors/character-actor.ts:79` `summary: \`${char.name}与${other.name}论道结善\`` —— **硬编码模板**，只换人名。**原批评「端上桌只会加一条新循环」成立且被放大**：380 章控制世界 545 条全同，正是「换皮循环」的活体证据。

### 0.4 新人名/派系（纠正原批评的「100% 姓陈」）
```
18 个 CharacterEntered: 陈是/柳是/李鹤/张鹤/陈风/柳风/李霜/张霜/陈明/陈笑/陈是/陈风/陈雪/陈明/陈远/陈微/陈之/陈初
姓氏: 陈×13 柳×2 李×2 张×1  → 陈占 72%，非 100%
派系: 幽冥轮回司/青霄道宗/天庭司命府/因果殿/散修盟/红尘庇护堂  → 6 种，确有多样性
```
**纠正原批评**：「18 个新人 100% 姓陈」是错的（72%）；「faction 标签化程序生成」对，但 **faction 本身有 6 种多样性**——这恰恰给蓝图提供了一个**可用的真新颖信号**（faction 首现 / tier 跨越），而**姓名不可用**（templated）。原批评把 faction 也一并否掉，过度。

### 0.5 适应度（live + control，重测）
```
live  warm-fitness: var 9.84 | bond 10 | social 4.17 | arc 5.22 | progress 9.2 | atCh 321
live  history social: 4.60→4.88→4.90→5.59→4.15→4.22→3.75→4.17  (无趋势，平趴/微降，成立)
live  history progress: 0→7→10→9.6→10→10→9.6→9.2  (m0-m5 全达成后封顶≈9.2，「假高」成立)
control(380章,1481commit) social 全程 3.05–7.68 振荡无趋势; var 9.60–9.92 满; arc 3.2–7.3 振荡
```
- **「social 平趴 + progress 封顶假高」两方一致，成立。**
- **control 的 social 在 1481 commit 上纯振荡无收敛 = 「270 章循环」的定量铁证**，这是蓝图 A/B 的黄金对照基线。
- **progress 假高解剖**（progression-ledger.json 实测 `lastAdvanceCh:48`，`atCh:321`）：`progressMomentum = 0.6·reachedScore + 0.4·freshScore`；reachedScore=min(10, 6×2.5)=**10**（6 里程碑全达成），freshScore=max(0, 10−(321−48)/80×10)=**0**（早该 0）。合成 0.6×10+0.4×0=**6**？但库显示 9.2——说明 `lastBeatCh`（writtenBeats 末项 ch=70）而非 atCh 321 被用作当前章，`sinceAdvance=70−48=22`，freshScore=10−22/80×10≈7.25，合成 0.6×10+0.4×7.25≈**8.9≈9.2**。**这是更精确的诊断：freshScore 用 writtenBeats.ch（停在 70，因 70 章后再没写过拍子？不——是 writtenBeats 只滚动近 12 章，末项 ch 随章涨）**——无论哪种，reachedScore=10 封顶项占 0.6 权重，使 progress 永远≥6，**剧本耗尽即锁高**成立。

### 0.6 outline-plan 真身（关键 — 纠正设计「删剧本」的打靶）
```json
obedience: "balanced",  // 不是 strict/hard
beats: 6 条，全部 "steer": "soft"
末 beat goal: "...受命成为神仙的人间行走，接续传递这点寻常微光"  ← steer:soft
```
**裁定**：设计称 outline 是「奉剧本/写死终点（脑补天庭结局）」——**库实测全 6 beat 是 `steer:soft` 软脊梁 + `obedience:balanced`**，且 longrun.ts:314-318 已落地「仅 `isHard` 的 beat 让位 T2，soft 不抢」的解耦。**原批评「设计打错靶，要拆的旧 strict/hard 剧本早被 steer:soft 取代」完全成立。** 设计的「删 outline-plan」是对一个已不存在的敌人开火。

### 0.7 conflictRate（纠正记忆/设计的「0.56」）
```
.novel-output/renjian/genome.json engine.conflictRate = 0.6  (非 0.56)
targetStyle: 冷峻/急促  (gentle 世界基因竟漂向冷峻——GENTLE_TONES=悲悯/冷峻 的一极)
```
- 命门口径应为 **conflictRate ∈ [0.5, 0.65]（现值 0.6）**，非「守 0.56」。任务书与记忆的「0.56」是 stale 数字。原批评先指出 0.6，成立。

### 0.8 工具/助手存在性（实现可行性体检）
```
jaccard        : app/sim-fitness.ts:189  export ✓ (可复用)
grams2         : ✗ 不存在 (只有 sim-fitness gramSig 是 4-gram; progression-ledger beatSig 是 2-gram 但不导出切分函数)
                 → 设计「复用现成 grams2」是虚构；须从 beatSig 抽 helper 或新写
CharacterTranscended.cause : ✗ events.ts:37 只有 {name, toTier}，无 cause
                 → 设计对 Transcended 读 p.cause 恒 undefined (原批评成立)
CharacterFell.cause        : ✓ events.ts:33 有 cause
beatForChapter / advanceStep / arcMilestonesFromPlan : 均现存，签名见下
```

### 0.9 集成点签名（确认设计 stale，原批评成立）
```
longrun.ts:410-414 已落地: nextProgressTask(pledger, n, stageGoal, prevStage)   ← 4 参
longrun.ts:487     已落地: advanceStep(pledger, rc..., arcMilestonesFromPlan(outlinePlan), n, llm)
progression-ledger.ts:52  现签名: nextProgressTask(pl, n, stageGoal, prevStageGoal)
progression-ledger.ts:68  现签名: advanceStep(pl, recentChapters, arcMilestones, n, llm)
```
**设计写的 3 参 `nextProgressTask(pledger, n, emerge)`、删 arcMilestones 的 advanceStep —— 全是对 db176dd 之前代码的版本，套用即编译错。原批评「集成点对 db176dd 已 stale」成立。**

---

## 1. 逐轴裁定（吸收原批评 + 我的纠正）

### ① 是否偷偷变回奉剧本？ — **机制 REAL / 「删 outline」FLAWED（成立，且我加重）**
- 机制本体清白：施压只说「该有新发展 + 世界刚冒这几桩」，不指令「必发生 X」，方向来自真 sim 事件。Wiggins「换概念空间非奔点」成立。**这半边 REAL。**
- 「删 outline-plan / emerge 替代 stageGoal」**FLAWED**：(a) 删 outline → `arcMilestonesFromPlan` 空 → advanceStep 无里程碑可判 → progressMomentum reachedScore=0，**刚 ship 的 C 层选择压力直接死**；(b) outline 实测是 `steer:soft+balanced` 软脊梁（0.6 节），打错靶。**必删「删 outline」整条**。emerge 应作 stageGoal 的**素材补充**，二者方向×素材分工，非二选一。

### ② 真防循环还是反加循环？ — **FLAWED（成立，且被 control 545 条放大为铁证）**
- 端上桌的 ally 材料**本身是 137/545 条单模板「与虚谷论道结善」**。renderEmergence 逐窗吐「新结的善缘：陈是与虚谷相熟相善；柳是与虚谷相熟相善…」=**给 prompt 注入一条新的「…与虚谷…」重复向量**。control 380 章 545 条全同 = 活体反例。
- 虚谷已 100% 章节饱和（writtenBeats ch59/63/67/69 实测含「虚谷」），再注入更多虚谷素材 = **强化既有单一文化**，与防循环反向。
- 设计假设「sim 在产新东西只是被丢」——**实测 sim 在用 ally/clash/avenge 三模板轮播（且 move 永不选中），ally summary 硬编码一句**。**药方与现实脱节，净效应≤0。**

### ③ 可实现性？ — **MOSTLY REAL（数据在；3 处具体缺陷，全部成立 + 我精化）**
- 数据在：CharacterEntered.name/faction ✓、StageCommitted.summary/chosenCandidateId ✓、ProgressionAdvanced ✓、newEvs 零额外读库 ✓、gentle-emergence.ts 可新建 ✓。
- **死代码（精化）**：`-move` partings——候选**存在但 prior 永不选中**（0/347），实践恒空。治本须改 prior（0.4 节），非删分支。
- **字段错**：Transcended 无 cause（events.ts:37），`p.cause` 恒 undefined。成立。
- **集成点 stale**：3 参 vs 现 4 参，套用编译错。成立。
- **虚构助手**：`grams2` 不存在，须抽 helper。设计「复用现成 grams2」失实。

### ④ 与现架构冲突？ — **FLAWED（成立，且我补一条结构性致命）**
- **W_progress 语义打架**：设计「W_progress 改奖处境新颖度」与刚 ship 的「里程碑×净位移」语义冲突，且「新颖度」与 **W_var(0.30, 场景多样, 已 9.84)语义重叠**——warm-fitness.ts:9 注释明令各信号不重叠。**不要动 W_progress**。
- **【结构性致命 — 通道/度量错位】**：真问题是 social 平趴。但 `socialWarmth`(warm-fitness.ts:62) **直接读 StageCommitted ally 比 + CharacterEntered 频次**——emerge 是**纯 prose 注入，根本不改这些 sim 事件**。所以 emerge 哪怕丰富了正文，**适应度针(social) 纹丝不动 → 进化爬山看不见它 → 自进化无法选择它**。设计想接进化却走 prose 通道、度量 sim 事件——**通道与度量永久错位**。这是全方案最深的洞，原批评点到，我用 socialWarmth=0.7×allyRatio×10≈0.7×0.58×10≈4.06 的算式**坐实**：social≈4.17 = ally 比 58% 的直接函数，**只有改 ally/clash 比例（sim 层）才动得了它**。
- **与 T2(var≥9.4/steer:soft)**：emerge 走 weave→叙事任务，不碰 sceneShift/occupied（longrun.ts:312-318，occupied 在 :318 已基于 outline+伏笔判完，emerge 在 :410 后才算，时序上不影响让位）——**正交，REAL，安全**。
- **与 cr0.6**：emerge 不写 conflictRate/tuning/crisis——**直接通道不冲突 REAL**；但见⑤ prose 逃逸隐患。

### ⑤ 破温情 / 事件轰炸？ — **FLAWED（成立，两处硬伤）**
- **违反 T2 铁律**：设计 `partings` 主动抽 `CharacterFell/CharacterTranscended` 渲染「X 离了此地」端上叙述桌。gentle-director.ts:3 写死「绝不写…Fell/crisis…」，warm-fitness NEG_MARK 把 Fell/Transcended 划戏剧层排除。即便 reframe「作别远行」，cause（「南天试炼/因果崖会」）本是戏剧弧残留（sim-fitness 复仇/巨变链节点）。**把温情/戏剧分离架构刚隔开的兴亡事件温情化粉饰后回灌——正是要防的。partings 必须完全剔除 Fell/Transcended。**
- **prose 逃逸雷区**（前审计 critique 已警告）：emerge 施压语 + roster「本章新到」标注 + nextProgressTask stale 改写语「近来情形与前几章太相似了——本章须有新进展」**三路叠加 = 强变化指令密度从阶段级推到每章级**。DeepSeek 满足「可见变化」最省力的方式 = **生一个小冲突/小麻烦**（冲突是最廉价的可见变化），恰是 cr0.6 要压的。**事件轰炸风险真实。**
- **轰炸频率**：renjian 每 3 tick 必产 ally，**几乎每章 weave 都被 emerge 占满**→ 永远在「介绍新人/新善缘」→ 留白呼吸章被挤掉。

---

## 2. 总判定表

| 轴 | 裁定 | 一句话（含我对原批评的纠正） |
|---|---|---|
| ① 奉剧本 | 机制 REAL / 删 outline FLAWED | 机制不写死✓；删 outline 废掉 C 层 + 打错靶（outline 是 steer:soft 软脊梁，非剧本）|
| ② 防循环 | **FLAWED** | 素材 137/545 条单模板「与虚谷论道结善」，注入反加循环；control 545 条全同=铁证 |
| ③ 可实现 | MOSTLY REAL | 数据在✓；`-move` 实践死（prior 永不选）、Transcended 无 cause、3 参 stale、grams2 虚构 |
| ④ 架构冲突 | **FLAWED** | W_progress 撞 W_var；**prose 通道改不动 socialWarmth 的 sim 度量→进化看不见**（结构性致命）|
| ⑤ 破温情/轰炸 | **FLAWED** | partings 复用 Fell/Transcended 违 T2 铁律；三路施压叠加踩 prose 逃逸 |

**纠正原批评 4 处**：(a)「-move 类型不存在」→应为「存在但 prior 永不选中」；(b)「obs/act 候选存在」→不存在；(c)「新人 100% 姓陈」→ 72%，且 faction 有 6 种多样性（可用作真新颖信号）；(d) progress 假高的精确算式（reachedScore 封顶占 0.6 权重锁高，非单纯 freshScore）。

---

## 3. 必吸收的批评点（蓝图 MUST 项 — 钉死）

1. **保留 outline 软脊梁，不动 W_progress**。删「删 outline-plan」「emerge 替代 stageGoal」整条。emerge 作 stageGoal 第 4 类素材补充。
2. **emerge 绝不渲染原始 summary 串**（防注入「与虚谷」重复向量）；只抽**带新颖闸的结构事实**（首次结识对象、faction 多样性、tier 跨越）。
3. **emerge 绝不含 Fell/Transcended**（守 T2 铁律）；温情「作别」另起符号（长期未互动者自然淡出），不复用兴亡事件。
4. **emerge 与 nextProgressTask 同章二选一 + gap 节流（gap<8 静默）+ 邀请式措辞**（「世间近来有这些动静，可拾一二自然融入」非「必须有新进展」）；roster 差分仅作素材、不单独成施压标注。**最多一路施压/章。**
5. **rebase 到现 4 参签名**；emerge 作可选第 5 参附加，不替换 stageGoal。删 `-move` partings（或改 prior 后再启）；Transcended 单独处理（不读 cause）。
6. **【治本】真正的防循环力在 sim 层**：ally summary 不该只「与虚谷论道」（character-actor.ts:79 模板化措辞）、move 候选要可被选中（character-actor.ts:134 prior 权重）、newcomer 命名多样化（packs spawnName）。**叙述层 T2' 只是放大器，源头不修则放大重复。**
7. **接进化必须走 sim 度量**：要让进化看见 T2'，新颖度信号须读**事件层**（ally 模板多样性 / faction 首现率 / move 占比），不能只测 prose。否则 fitness 针不动，自进化选不出。

---

## 4. 对蓝图的硬约束（守门红线）
- conflictRate ∈ **[0.5, 0.65]**（现 0.6），任何改动不得推高 ally→clash 转化（不靠加冲突造「新颖」）。
- W_var ≥ **9.4**（现 9.84），权重 0.30 不动，T2 gentle-director 一字不改。
- 爽文（GENTLE=false）**逐字节零变更**，全部门控 `if (GENTLE)`。
- core/packs 改动须独立灰度、可回退、resume 确定性（禁 Math.random/Date.now，用既有 `rng()` seed 或 turn 计数器）。
- A/B 必须对照 control `renjian-killed-20260606-180327`（380 章 / social 振荡无趋势 / 545 条单模板）证「明显不循环」。

---

## 相关文件（绝对路径，复核锚点）
- `/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts`（:147 roster、:312-318 occupied 解耦、:368 upsets、:393-414 weave 空窗、:483-489 advanceStep 调用）
- `/Users/chris0810/Documents/Codex/Novel System/app/warm-fitness.ts`（:40 W_var、:62 socialWarmth、:94-108 progressMomentum）
- `/Users/chris0810/Documents/Codex/Novel System/app/progression-ledger.ts`（:40 beatSig、:52 nextProgressTask(4参)、:68 advanceStep、:97 arcMilestonesFromPlan）
- `/Users/chris0810/Documents/Codex/Novel System/app/gentle-director.ts`（:3 铁律、:44 motifSig、:189←jaccard from sim-fitness）
- `/Users/chris0810/Documents/Codex/Novel System/core/actors/character-actor.ts`（**:79 ally 硬编码「论道结善」**、:91 clash、:108 avenge、**:126-141 move 候选(prior 永不选)**）
- `/Users/chris0810/Documents/Codex/Novel System/core/domain/events.ts`（:33 Fell 有 cause、:37 Transcended 无 cause）
- `/Users/chris0810/Documents/Codex/Novel System/packs/xianxia-bazi/index.ts`（:310-318 spawnName 名字池）
- `/Users/chris0810/Documents/Codex/Novel System/app/evolve.ts`（:19 EngineGenes、:44 GENTLE、loadWarmFit 折进基因）
- 证据：`.novel-output/renjian/{world.db,warm-fitness.json,warm-fitness-history.json,outline-plan.json,progression-ledger.json,genome.json}`、`.novel-output/renjian-killed-20260606-180327/{world.db,warm-fitness-history.json}`（control）
