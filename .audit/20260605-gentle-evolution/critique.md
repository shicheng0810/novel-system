# 对抗式评审 · 温情自进化蓝图

> 评审亲验6载荷文件, 逮到 drama.ts漏网第五梯度 + bond生产机制缺失。裁决: 需补X(非改用Z)。

---

I now have complete ground truth. The decisive finding: positive bond IS written (`character-actor.ts:88`, the `ally`/结善 candidate, `bond+1`), and `conflictRate` does NOT participate in the ally-vs-clash selection — it only enters at `world-actor.ts:360` (scarcity-gated intra-faction erosion) and `:393` (stress amplification). This materially weakens the blueprint's central thesis. I have everything needed for the adversarial review.

---

# 对抗式评审结论: 温情自进化蓝图

我亲验了全部 6 个载荷文件(evolve.ts / world-actor.ts / sim-fitness.ts / events.ts / longrun.ts / drama.ts + minds.ts / character-actor.ts)。**总评: 方向对、诊断对、绝大多数行号对,但有一个载荷性事实错误 + 一个全章遗漏,二者叠加会让"T1 仅六点即止血"的承诺落空。蓝图整体「需补 X」,不是「改用 Z」。**

下面按你五问给硬结论。

---

## ① 它真把「温情」和「戏剧」分开了吗?——**否,有一个梯度没翻到,这是漏改**

我顺 fitness+变异走了一遍。蓝图翻转的 4 个梯度(simFit→warmFit / mutate prompt / simReflect / bestEngine 棘轮)定位**全部准确**,行号对得上。但有**第五个推力它整章没提**:

**`drama.ts` 的 `dramaControl` 每章把 `tuning` 整体覆写,且它对 `conflictRate` 是单向加压泵,完全绕过 genome。** 证据链:
- `longrun.ts:286-288`: 每章 `dramaControl(...)` → `spd.snapshot.props["tuning"] = {...dc.tuning}`,**每章都写,不止 evolveOnce 那 8 章**。
- `drama.ts:36` 冷判据 `cold = (upheaval<=1 && tension<4.5) || sift<3.5`。温情世界 upheaval 天然≈0、tension 天然<4.5、sift 天然<3.5 → **几乎永远 `cold=true`** → `coldStreak` 爬到封顶 6 → `heat=0.6`。
- `drama.ts:47`: `tuning.conflictRate = base.conflictRate*(1+heat*0.6) = base×1.36`。`drama.ts:46`: `eventBias = base×(1+0.6)=base×1.6`。`drama.ts:48`: 还会主动 `structureGrowth+0.3` 挑派系分裂。
- **`grep -c GENTLE app/drama.ts == 0`**:drama.ts 对温情零感知。

**后果**:即使蓝图把 genome 的 `engine.conflictRate` 锚回拉到 0.85、软上限压到 1.05(改点 6/8 全做对),实际喂进 `world-actor.ts:393` 的是 drama 覆写后的 `0.85×1.36 ≈ 1.16`,**已突破蓝图自己定的 1.05 软上限**;eventBias 实际是 `0.9×1.6=1.44` 而非蓝图想要的 0.9。蓝图 §8.1 的验证判据("conflictRate 收敛 ≤1.05")用 `genome.json` 取数 → 会显示绿,但**世界实际跑的 `props.tuning.conflictRate` 是红的**。这是验证盲区:它量错了变量。

> 结论:温情与戏剧**没有完全分开**,drama 控制器是漏网的第五梯度。改点清单缺一行:**drama.ts 必须 GENTLE 化**(把"太冷→加冲突"改成"温情世界低张力是健康态,冷不加注;仅 hot/人口告急时才 chill/护盘")。这是**必补项,且属 T1**(否则 T1 六点全做对,renjian 的实际 tuning 仍被 drama 顶上去,"立止血"承诺不成立)。

---

## ② 温情质量度量抗刷分吗?符号信号选对了吗?——**抗刷分框架对,但 W1 信号建立在一个错误事实上**

**抗刷分四道闸(F/R 分离 / Goodhart-veto / 带状奖励 / 人审锚定)设计正确**,prior-art 引用站得住,F/R 解耦律("只 R 进 prompt,F 只算分")与 `buildGuidance`(evolve.ts:195 本就不含数值)确实已合规。这一层我没有异议——LLM 温情 rubric 会被煽情/空灵辞藻骗,但 warmFit 的符号 W1-W5 对生成器盲、当传感器而非奖励,加 bondWarmth 突刺折扣,是接得住明显造假的。

**但载荷性事实错了,且恰恰是 W1(bondWarmth)的根基。** 蓝图反复强调(摘要 + §正文 + 文件清单三处):

> "bond 由 `scarcity×conflictRate` 机械侵蚀为负(world-actor.ts:360),宿敌再 bond-=2(464-465)…events.ts 0 个正向类型…所以'奖 bond 暖=罚高冲突',闭环在引擎层自洽。"

**我全仓 grep 了所有 `bond:` 写回点。这句话是假的:**

- **存在正向 bond 写回**:`core/actors/character-actor.ts:88`,`ally`/「论道结善」候选 `{ [bondK]: bond + 1 }`(双向 +1)。这是每个登场角色每 tick 都会产出的候选之一。蓝图自己的文件清单写"events.ts 确认 0 正向事件类型 → 温情质量须走 bond+stress+rubric",但**它没看 character-actor.ts,漏掉了正 bond 的唯一来源**。
- **关键**:`bond+1` 的 ally 候选与 `clash`/复仇候选一起进 `world-actor.ts:275` 的 `scored.map`,由 `pack.priorSystem.scoreCandidate` 按 harmony/discord 轴 + 命理生克打分、argmax 选中。**`conflictRate` 根本不参与这个选择**(grep 确认 conflictRate 只在 world-actor.ts:360 和 393 出现,前者被 `scarcity` 门控、后者只放大 stress)。
- 所以正确的因果是:**降 conflictRate 并不直接增加正 bond**。正 bond 由 prior 的 harmony 打分决定;conflictRate 只在 `scarcity>0` 且同派系拥挤时侵蚀 bond(360 行有 `scarcity×conflictRate` 双因子,scarcity=0 时整项为 0)。蓝图把"奖 bond 暖 = 罚高冲突"当作引擎层恒等式,**实际只在 scarcity>0 时部分成立**。

**这对全案的影响(诚实评估,不夸大)**:
- **不推翻 warmFit 的可行性**——bond 能正能负(W1 有真实信号源),avgStress 有 clamp[0,1](world-actor.ts:65 verified ✓),volatility/novelty 都在。warmFit 仍可算、仍是合理的 F 轨。
- **但推翻"闭环在引擎层自洽、非靠口号"这个卖点**。真实闭环要靠**降 scarcity(锚 0.1,改点 4.3a 已含 ✓)+ 让 prior 多选 ally**。后者蓝图完全没碰——而 ally vs clash 的选择权在 `pack.priorSystem.scoreCandidate`(命理生克,冻结形状)。**温情世界若想 bond 真的转正,需要 prior 在 harmony 轴加权,或在 world-actor 给 ally 候选一个 GENTLE 亲和加成**。这是蓝图的**第二个遗漏改点**:warmFit 度量到了 bondWarmth,但没有任何机制去**生产**正 bond;只压负向侵蚀(scarcity↓),正 bond 仍听天由命于命理打分。度量得到、产生不出来 = W1 长期低位 = warmFit 主要靠 W3 calmBand(低 stress)和 W5 novelty 撑,**bondWarmth 形同虚设**。

> 结论:符号信号**选型对、事实根基错**。需补:(a) 改正"bond 仅被侵蚀为负"的认知;(b) 补一个正 bond 生产机制(GENTLE 时给 `world-actor.ts:275` 的 ally 候选加亲和权重,或 pack 层 harmony 加权),否则 W1 不工作。

---

## ③ 爽文世界真零变更吗?——**基本成立,但有一处不是字节级,需收紧**

`GENTLE = process.env["NOVEL_STYLE"]==="温润"`,12 改点全 `GENTLE ? 新 : 旧`,env 未设→`false`→旧路径。**逻辑等价性成立**,我逐点核对了改点 1/2/3/5(常量/fitnessOf/pickTarget/objectiveScore)确实 `false` 时逐字回退。这部分可信。

**但有两个"零变更"漏洞**:

1. **改点 10(styleBin 第三维 + 跨风格不比 fitness)不是字节级零变更,它改的是全局共享文件的 schema。** `engineNiche`(evolve.ts:92)加 styleBin → `GlobalCell.key` 形状变 → `global-evolution.json` 是**所有世界共写的单一文件**(evolve.ts:85,跨世界锁 withGlobalLock)。爽文世界 `promoteToGlobal` 时,新 key 格式与旧 cells 混存。蓝图说"global niche 按引擎旋钮分→改点 1 不污染",但**改点 10 本身就在动 niche key**。需明确:styleBin 默认值必须让爽文世界落到与现状**同一个 key 字符串**(即 `styleBin` 缺省段不拼进 key,或缺省="戏剧"且戏剧世界 key 保持旧三段格式),否则首次升级后爽文世界的 global cells 会因 key 不匹配而"找不到旧精英"→ 退化重学。**这点蓝图没给出向后兼容的 key 构造细节,需补。**

2. **改点 9 的 `Genome.steer?:"warm"` 字段进 `genome.json`**:`loadGenome`(evolve.ts:67)用 `{...DEFAULT, ...p}` 反序列化,旧文件无该字段→undefined,安全 ✓。但 `saveGenome` 之后爽文世界的 genome.json 也会因 `cloneGenome` 是否透传该字段而可能多/少一个 key。蓝图说"默认 undefined",但 `JSON.stringify` 对 `undefined` 字段会**省略**,所以爽文 genome.json 字节不变 ✓(这点其实安全,确认一下即可)。

> 结论:**作者层(evolve.ts 输出的 genome/evolution.json)爽文字节级零变更,可信**;但**全局层(global-evolution.json,改点 10)需补一条向后兼容的 key 构造**,否则升级瞬间所有在跑爽文世界丢全局精英继承。降级为"需补 X"。

---

## ④ 有没有更简等效方案?——**你提的简化方案在当前码上 *不* 等效,且蓝图已正确驳回了它的近亲;但有一个真正更简的中间档**

你的提议:"只把温情向的 simFit 权重置零 + mutation 不升 conflict,不必整套 warmFit rubric"。我验了,**不等效**,原因正是 ① 和 ② 揭示的:

- **simFit 权重置零(0.28→0)≠ 止住 conflictRate 上行**。因为推高 conflictRate 的不止 simFit 的 argmax。即使 fitness 不含 simFit,(a) mutate prompt 仍喊"提升戏剧性"(除非也改,那你已经在做改点 6 了);(b) **drama.ts 每章 ×1.36 覆写 conflictRate**(① 的发现,与 fitness 完全无关)。**simFit 置零对 drama 这条路零作用**。所以"只置零 simFit"会留下 drama 这个最大的活跃推手。
- **"mutation 不升 conflict"** = 改点 6 的子集,本来就要做。

蓝图其实已经在 §②正确地**驳回了一个更激进的简化**(它内部记作"[现码] 版:simFit 28%→10%、llm 42%→58%"),理由是"把 warmFit 压到 10% 削弱反冲突梯度 73%"。**这个驳回逻辑本身有瑕疵**——它假设 warmFit 的反冲突梯度走引擎层闭环,而 ② 已证该闭环只在 scarcity>0 时部分成立。但结论方向对:不该半关。

**真正更简的等效中间档(我的建议,比蓝图全案省 ~40% 工程量)**:

> **跳过 warmFit(改点 8/11/12 全免),fitness 在 GENTLE 时直接退回纯作者层公式 `0.6·llm + 0.25·obj + 0.15·cons`(simFit 那支不算,即把 simFit 视作 null 走 evolve.ts:318 的现成分支),配合改点 6(mutate steer)+ 改点 7(simReflect 双向阀)+ 改点 4(critique 温情 rubric)+ 改点 A/1/2/3 + 新增 drama GENTLE 化。**

为什么够:
- 止血的本质是"让 conflictRate 不再被任何梯度单调推高"。fitness 不含 simFit + mutate 不推 + simReflect 不诊断为病 + **drama 不加注**,四路全断,conflictRate 由锚回拉(4.3b)自然回落。**这四路里 drama 是蓝图漏的、warmFit 是蓝图多的**。
- 温情**质量**怎么保:靠改点 4 的 critique 温情 rubric(R 轨)+ objFit/consFit(已有客观信号)。蓝图 §③自己承认"温情是最主观维度,自动分只配软建议 + 人审是唯一 ground-truth"。既然如此,**warmFit 的边际价值主要是 bondWarmth/calmBand 两个符号护栏**,而 ② 证明 bondWarmth 在没有正 bond 生产机制时形同虚设,calmBand 不过是 `1-avgStress` 的带状版——**用 objFit 现有信号 + critique 已足够给软方向**。warmFit 在首版是过度工程。

> 结论:**改用 Z(更简档)**:首版砍掉 warmFit(改点 8/11/12),fitness 走"GENTLE→纯作者层"。warmFit 列为 T3 可选,且**必须先补正 bond 生产机制**再上,否则 W1 无意义。这样 T1 的"止血"反而更干净(少一个量纲不同的 28% 槽位在搅局),也回避了 ③ 改点 10 的全局 schema 风险(没有 warmFit 就没有"跨风格不比 fitness"的刚需,styleBin 可延后)。

---

## ⑤ 过度工程 / 遗漏改点清单

**遗漏(必补,按优先级)**:
| # | 遗漏项 | 影响 | 归属 |
|---|---|---|---|
| **R1** | **drama.ts 零 GENTLE 化**(每章 ×1.36 覆写 conflictRate、×1.6 covwrite eventBias、挑派系分裂,完全绕过 genome) | **致命**:T1 六点全做对,世界实跑 tuning 仍被顶上去,"止血"不成立 | **T1 必补** |
| **R2** | **无正 bond 生产机制**(warmFit 度量 bondWarmth,但正 bond 只来自 character-actor.ts:88 的 ally 候选,由命理 prior 打分,GENTLE 无加权) | W1 长期低位,warmFit 名不副实 | T2(若保 warmFit) |
| **R3** | **改点 10 全局 key 无向后兼容构造**(styleBin 改 engineNiche key,爽文世界升级后丢全局精英) | 爽文非零变更 | T2.5 必补或延后 |
| **R4** | **§8 验证量错变量**(用 genome.json 的 conflictRate,但世界实跑的是 drama 覆写后的 props.tuning) | 验证会假绿 | 验证必补:监控 `props.tuning.conflictRate` 而非 genome |

**事实错误(必改认知)**:
- "bond 仅被 scarcity×conflictRate 侵蚀为负 / events 无正向 / 奖 bond 暖=罚高冲突引擎层自洽" —— **假**。正 bond 存在(character-actor.ts:88);该等式仅 scarcity>0 时部分成立。摘要、§②、文件清单三处都要改。

**过度工程(建议砍/降级)**:
- **warmFit 整套(改点 8/11/12)在首版过度**。理由见 ④:bondWarmth 无生产机制、calmBand≈objFit 可替代、温情质量蓝图自承靠人审。**降为 T3,且以 R2 为前置。**
- **改点 10(styleBin + 跨风格不比 fitness)**:没有 warmFit 就无量纲冲突,刚需消失。**与 warmFit 一起延后。**
- **§3.1 的 S1/S4/S7 文本特征**:蓝图自己已正确列为 T3 follow-up,无异议。
- **TONES/CONFLICTS 双套 5/5(改点 1)**:为保 server 曲线兼容而硬凑 5 个温情语气("澄明""怅惘"),工程可接受但收益低——温情世界 ⑥ 又把探索集收到 3 个(悲悯/怅惘/温润)。**可简化**:CONFLICTS 不必 GENTLE 化(它只喂 critique 的 conflict 字段,不进 fitness,不影响行为),省一处。

---

## 一句话总裁决

**可施工,但需补 R1(drama GENTLE 化,T1 必补,否则止血失败)+ 改正 bond 事实错误;并改用更简档:首版砍 warmFit/改点 10,fitness 走「GENTLE→纯作者层 + critique 温情 rubric」,warmFit 留 T3 且须先补正 bond 生产机制(R2)。** 蓝图的 mutate/simReflect/critique/pickTarget steer(改点 4/6/7 + ⑤⑥)和 F/R 抗刷分框架是扎实的、可直接施工的核心;warmFit 闭环卖点建立在一个错误事实上,是全案最弱的一环。

**具体补丁(最小)**:

1. **R1 — drama.ts:25 加 gentle 形参,改 cold 分支**(longrun.ts:286 传 `GENTLE`):
```
// dramaControl 内, heat 计算前:
const heat = gentle ? 0 : Math.min(0.6, coldStreak*0.15);  // 温情: 冷不加注(低张力=健康态)
// hot/chill 保留(滥杀/人口告急仍要收), structureGrowth 挑裂那行(48)加 `&& !gentle`
```

2. **R2(若上 warmFit)— world-actor.ts:275 给 ally 候选 GENTLE 亲和加成**,或在 character-actor 的 ally deltas 把 `bond+1`→ GENTLE 时 `bond+1.5`。无 prior 改动版:在 `scored.map` 里 `if (gentle && c.summary.includes("结善")) w = min(1, w+0.15)`(需把 gentle 经 props.tuning 传入,引擎中立可用一个 `tnum(tune,"harmonyBias",0)` 旋钮,GENTLE 时 drama/longrun 写 0.15)。

3. **R4 — 验证脚本**:监控 `props.tuning.conflictRate`(从 world.db 快照取),不是 genome.json。A/B 判据改为"温润组 **实跑 tuning** conflictRate 中位 ≤1.05"。

4. **更简档 fitness(替代改点 8)**:evolve.ts:316,`const useSim = simFit!==null && !GENTLE;` 然后 `useSim ? 0.42·llm+...+0.28·simFit : 0.6·llm+0.25·obj+0.15·cons`。一行,免 warmFit/computeWarmFitness/改点 10/11/12。

**相关文件(绝对路径)**:
- 漏改点:`/Users/chris0810/Documents/Codex/Novel System/app/drama.ts`(R1,零 GENTLE)
- 事实错误源:`/Users/chris0810/Documents/Codex/Novel System/core/actors/character-actor.ts:88`(正 bond `bond+1`,蓝图未见)
- 误判等式:`/Users/chris0810/Documents/Codex/Novel System/core/runtime/world-actor.ts:360`(`scarcity×conflictRate` 双因子,scarcity=0 时整项为 0)、`:393`(conflictRate 仅放大 stress)
- 蓝图:`/Users/chris0810/Documents/Codex/Novel System/.audit/20260605-gentle-evolution/synthesis.md`(摘要/§②/文件清单三处"bond 仅侵蚀为负"需改;改点清单需加 drama;§8 验证需改取数变量)