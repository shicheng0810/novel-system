# 给全员廉价连续心智 — 研究综合(把「持续内心」从 3 抬到 6)

> 4 个并行研究 agent 的综合:生成式智能体记忆+降本杠杆 · 廉价/零-LLM 认知 · 记忆规模化 · 异步批量调度。
> 目标:让**每个角色都有持续、会演化的内心**(记忆累积 + 立场/关系/目标更新),而不只是聚光灯下的 1 个;且**绝不每角色每 tick 一次 LLM**(11~18 角色 × 上千章 × v4-pro 慢且贵)。

---

## 0. 框定:短板在哪

现状:每 tick 只有导演聚光灯轮到的 **1 个**角色被 LLM reflect+plan(产 ~20 字心境+意图),**非焦点角色冻结**(只有确定性心境回落),记忆只留几条显著的 + 一份**每世界**(非每角色)的 canon 摘要。自评「持续内心」**3/10**——这是整套系统离"活"最远的一格。

研究**高度收敛**到同一个答案,可一句话概括:

> **「持续」靠符号常驻(全员每 tick 零 LLM)· 「深度」靠门控的稀有 LLM · 「便宜」靠批量+异步+缓存把调用压到个位数/tick。**

---

## 1. 统一架构:三层认知栈 + 预算可控的 LLM 调度器

```
每 tick 全员       Layer 1  符号心跳(零 LLM)      drive 账本 + appraisal→stress/bond + EMA 心境
按需/登场          Layer 2  廉价快照 + 记忆召回      内态标签 + 分层遗忘 + persona digest + embedding 召回
门控/批量/异步     Layer 3  稀有 LLM 心声/反思       importance 破阈入队 → R tick 批量一次 → 异步写回
```

### Layer 1 · 符号心跳(每 tick,全员,**零 LLM**)—— 根治"冻结"

最直接的范本是 **The Sims** 与 **矮人要塞**:它们用**纯符号**就造出强烈的"内心"错觉。

- **drive 账本(The Sims moodlet/needs + Maslow 需求驱动)**:给每个角色挂一组 0~1 的持续驱动 `渴(资源)/怨(对某人)/慕(对某人)/执(突破/志向)`,每 tick 纯加法:`drive += 漂移 − 衰减·drive + 事件增量`。**八字四轴定个体化**:进取↑→"执"回补快/上限高;相争↑→"怨"增益大;亲和↑→"慕"/bond 积累快;持重↑→所有 drive 波动小(情绪更稳)。最高 drive 决定当前行动倾向与措辞底色。→ 非焦点角色"在场下也持续有想要的东西"。
- **appraisal 写回 stress/bond(OCC / GAMYGDALA / 矮人要塞)**:给每个事件标注"把谁的哪个 drive 推近/推远"。对被卷入者算一次廉价评价:`情绪增量 ≈ drive 权重 × Δ达成度`,经四轴调制后**写回 narrativeStress**(顺意降逆意升;仿 DF `Δstress = strength/divider`,divider 由持重轴决定钝感),指向他者的社会情绪**写回 bond**(受益→bond↑,被害→bond↓ 并可置 avenge)。
- **三个保真细节**:① narrativeStress 用 **EMA 滑动平均**(WASABI/EMA)而非瞬时覆盖 → 情绪有惯性/余韵;② 高强度事件落一条带衰减的记忆标记,日后**偶发重新触发**小 appraisal(DF 记忆回响)→ 旧仇旧情持续回响;③ **同一事件经不同四轴评价出不同情绪** → 全员反应各异不雷同。
- 成本:每角色每 tick 十余次浮点,**零 LLM**,全员每 tick 可跑。

### Layer 2 · 廉价快照 + 记忆召回(符号为主,近零 LLM)

- **内态标签**:取最高 drive + 触发事件 → 一个无需 LLM 的标签(如"怨·因某人夺先"),叙事/动作/对白语气直接读它 + 四轴用**模板**渲染。
- **分层遗忘+巩固(MemoryBank Ebbinghaus + Mem0 去重)**:记忆按 importance 三档治理——**显著(≥0.6,已有阈值)留原始细节**;**琐碎(<0.6)挂强度 S 按 `R=e^(-t/S)` 衰减,被召回则 `S+=1,t←0`(回忆即强化)**,R 跌破阈则压成一句进 digest;再久 digest 分层升抽象。**对 importance≥0.6 关闭衰减**防误忘关键伏笔。
- **每角色 persona digest(CharacterGLM-CPT + 把每世界 canon 扩成每角色)**:每隔 N 章(对齐现有每 8 章 canon 抽取,**合并同一次 LLM 调用、边际成本≈0**)把该角色近期事件流压成定长 `{心路, 恩怨账, 当前执念, 已知秘密}`;下次登场前情只注入这一段。
- **登场自动"想起旧账"(Smallville 三因子 + 复用 sim-fitness embedding,零额外 LLM)**:角色 A 与 B 同框时,纯向量召回:`score = w_rel·cos(场景,记忆) + w_imp·importance + w_rec·0.995^(Δ章数)`,**硬过滤 participants 含 B**,取 top-3 注入。recency 的"游戏小时"换成"章数差";召回空则回退只用 digest、不强编。

### Layer 3 · 稀有 LLM 心声/反思(门控 + 批量 + 异步)

- **importance 门控入队(Smallville >150 范式)**:每角色维护标量 `pending_importance`,事件按卷入深度给增量(**这步零 LLM**);破阈才把**该角色**入"待反思队列",清零。平静的人靠 Layer 1 维持,不烧 LLM。
- **批量反思(TopoSim 代表者共享 + OpenCity 共享前缀蒸馏 + BatchPrompt)**:每隔 **R=3~5 tick**,用**一次** LLM 调用把队列里 **K≤8** 个角色 + 各自一句处境塞进一个 prompt,JSON 数组一次性产出每人一句"内心更新/立场变化"。世界背景做**共享前缀**只编码一次。串味防护:每人显式编号+独立小节、立场对立者分批(防 position bias 抹平弱势者)。
- **异步 + 单写者铁律(AI Town input 模式)**:batch-reflect 的 LLM 跑在 **off-critical-path 后台**,**不进当前 tick 的 SQLite 事务**;结果塞回 `pending_reflection` 输入队列;**下一 tick** 开头 WorldActor 在自己单事务里消费写入 → **"只有 WorldActor 写世界"的铁律不破**。反思滞后 1~2 tick 落地(慢变量,可接受)。
- **策略缓存兜底(AGA Lifestyle Policy)**:例行处境(巡逻/日常寒暄)首次 LLM 产出缓存为可复用策略,命中即 0 调用;仅当处境显著偏离才重调。AGA 实测可压到基线 3.4~42.7% token。

---

## 2. 预算估算

| 方案 | LLM 调用/tick |
|---|---|
| 朴素"全员每 tick 想" | ~N(20) |
| 本架构(focus 1 + 批量 0.25,R=4/K≤8 + 事件门控) | **~1.25** |

→ **省约 94%**,且全员都有持续(慢变)认知更新。persona digest 与现有 canon 合并调用 → 边际≈0;登场召回复用 sim-fitness 已有 embedding → 零额外 LLM。

---

## 3. 映射到我们的真实代码

| 研究机制 | 落到哪 |
|---|---|
| drive 账本 + 四轴调制 | `core/world-actor.ts` 非焦点循环(现仅心境回落)扩成 drive 更新;字段挂 `CharacterState.props` |
| appraisal→stress/bond | 事件处理处(story event / commit)对被卷入者算情绪增量,EMA 写 `narrativeStress` + `bond:` |
| importance 门控 | 复用已有 `importance`(MemoryRecorded);加 `pending_importance` 累加器 |
| persona digest | `app/canon.ts` 扩出每角色 digest,与 `canonStep` 合并调用 |
| 登场召回 | 复用 `app/sim-fitness.ts` 的 embedding;新增轻量每角色向量召回 |
| 批量反思阶段 | tick 循环 `commit` 后插一个 batch-reflect;走 `app/` 新模块 `minds.ts` |
| 异步写回 | 经 `store.enqueueInput` 投 `pending_reflection`,下 tick `drainInputs` 消费(现成机制!) |

**core 仍 genre 中立**:drive/appraisal 用通用字段与四轴(pack 已声明的 traitAxes),不引入 genre 字面量;心声 prompt 措辞走 pack.agentProfile。

---

## 4. 诚实评估

**会抬升的**:
- ✅ 「持续内心」3 → **6**:全员符号心跳常驻(不再冻结)+ 事件驱动的稀有 LLM 深度 + 终身记忆/登场想起旧账。这是 ALife 谱系里"矮人要塞级全员连续内态 + Smallville 级关键深度"的现实档位。
- ✅ 副作用红利:非焦点角色有了 drive/记忆,**派系分裂/复仇/结盟的前提(bond 演化)会更真**——直接喂 T3/T4 的涌现底座。

**不会抬升的**:
- ⚠️ **意识仍是 0**:这是更细的提线木偶,不是有"谁"在体验。
- ⚠️ 纯符号层会**机械/重复**(情绪种类有限)→ 靠四轴个体化 + 事件多样 + 定期 LLM"提神"缓解,但不根除。

**风险**:
- 批量**串味/position bias**(K≤8 + 编号小节 + 对立分批);
- 记忆巩固**丢细节/灾难性遗忘**(importance≥0.6 不衰减 + 去重 merge 而非覆盖);
- 异步反思**滞后 1~2 tick**(慢变量可接受,别用于硬决策);
- drive/appraisal **调参负担**(阈值、衰减率、divider)——需在真实世界上校准(像 sim-fitness 那样先 probe)。

---

## 5. 分级落地路线

| 阶段 | 内容 | LLM 成本 | 价值 |
|---|---|---|---|
| **M1 符号心跳** | drive 账本(四轴调制)+ appraisal 写回 stress/bond + EMA 心境 + 内态标签 | **零** | 全员解冻,立刻见效,改动集中在 world-actor 非焦点循环 |
| **M2 终身记忆** | importance 三档遗忘 + 每角色 persona digest(并入 canon 调用)+ 登场 embedding 召回 | 边际≈0 | 角色记得自己的一生、登场想起旧账 |
| **M3 批量异步反思** | pending_importance 门控入队 + R-tick 批量一次 LLM + 异步经 input 队列写回 | ~+0.25/tick | 稀有但真实的"心声/立场质变",深度上来 |
| **M4 策略缓存** | 例行处境缓存复用 | 负成本 | 进一步省 token |

**推荐**:M1 先落地(零 LLM、改动小、立刻解冻全员、还反哺 T3/T4 的 bond 演化)→ M2(复用 canon+embedding,边际≈0)→ M3(真正把"深度"加上,但要先 probe 校准阈值/预算)→ M4 加固。

---

## 6. 主要来源

**记忆+降本**:Generative Agents/Smallville (arXiv:2304.03442, importance>150 门控反思 + recency×importance×relevance) · AI Town (tick/LLM 解耦 + input 模式 + embedding hash 去重) · Project Sid/PIANO (arXiv:2411.00114, 反射符号/快 + 推理 LLM/慢 + CC 瓶颈) · AgentSociety (arXiv:2502.08691, 万 agent 异步并发) · Concordia (arXiv:2312.03664, GM 集中裁决)
**廉价认知**:The Sims moodlet/needs · 矮人要塞 thought strength/divider + personality 评价 + 记忆回响 · GAMYGDALA/OCC (IEEE T-AC 2014, 情绪=目标效用×Δ达成概率) · EMA/WASABI (mood=评价滑动平均 + PAD) · Maslow 需求驱动 agent (SpringerPlus 2013) · 设备端小模型 (NVIDIA Nemotron-4 4B)
**记忆规模化**:MemoryBank/SiliconFriend (AAAI 2024, Ebbinghaus R=e^(-t/S) + 回忆强化 + 分层画像) · Mem0 (arXiv:2504.19413, 抽取-巩固省 ~90% token) · MemGPT/Letta · A-MEM (NeurIPS 2025) · RAPTOR/HippoRAG · CharacterGLM-CPT(逐章重建 persona) · 综述 arXiv:2505.00675(Consolidation 最重要却最少实现)
**异步批量调度**:OpenCity (arXiv:2410.21286, 聚类+蒸馏, LLM 降 70%/token 降 50%) · TopoSim (代表者共享, token 降 43~92%) · BatchPrompt (batch 100 精度 ±2pp) · Affordable Generative Agents (arXiv:2402.02053, 策略缓存压到 3.4~42.7%) · Lyfe Agents
