# 项目提升 + 能力协同 综合蓝图

日期: 2026-06-09 · 综合自六路研究: M1 能力清单 / M2 数据流测绘 / A1 冲突审计 / A2 冗余审计 / A3 孤岛审计 / A4 架构评审。
路径前缀省略 `/Users/chris0810/Documents/Codex/Novel System/`; 行号以各审计实测为准(longrun.ts 595 行版)。

## 总评: 强能力 · 弱配线

- **能力成熟度 ≈ 4.1/5**: 27 项能力中 22 稳定(多世界长期验证)、4 新落地、1 实验性; core 边界纪律教科书级(零上行依赖、题材字面量仅注释); 单写者锁掐死并发竞争; F/R 隔离有意识。
- **协同度 ≈ 2.8/5**: 病不在单个能力, 在能力之间的**配线**。三大病灶族(见下), 一条因果主链贯穿全系统:

> **因果主链**: 生成端两条指令(段配额"约900字" + 物象"贯穿回扣")每天制造修订端的全部工件 → edit-pass 逐章删 → critique 读的是删后的文本 → genome 替 edit-pass 领功 → 基因永远学不会"少制造" → 修订 LLM 成本永久化 → 病最重的章还因 15% 长度地板修不动整体弃用。链上每一环都有快赢解(§三)。

**三大病灶族**(全部审计发现可归并):

| 病灶族 | 成员 | 统一解法 |
|---|---|---|
| **A 干预层替基因考试**(归因断裂×4 同构) | drama 每章覆写 tuning 记功给 genome(A1-d/M2-S5) · gentle-director 换景增益折进 fitness(A1-e) · edit-pass 删减后文本喂 critique(A1-N1/M2-S11/A3-a) · 弃章重试状态棘轮(S10) | 测量层去偏: 干预量随 fitness 落盘、lint 取精修前 draft、慢环用未污染信号 |
| **B prompt 端指令对撞**(生成端自相矛盾) | targetStyle"急促" vs PENMANSHIP"舒缓"(死锁, 3 世界全中) · "约900字" vs "宁短勿堆" · "回扣" vs "拆回指" · "须离开X" vs roster"@X" · 伏笔"悬念"措辞 vs beatSpec"不留悬念" · 指令:叙事=70:30 | 快赢逐个拆弹 + buildSecPrompt 纯函数化让注入冲突**首次可回归测试**(A4) |
| **C 信号/通道无仲裁**(有信号没人收、一信号多人抢) | weave 单通道被伏笔垄断(S4) · novelty 同统计量双计进分(A2-e) · 同一冷信号快慢双控制器(d) · sift 悬链无人收口(H3) · lore 通道 3/4 世界静默死亡(S12) · situation/lint 结果 write-only(H4/a) | 信号注册表(单信号单 owner 单执行器) + weave 双槽位 + 孤岛逐对接线(§二-3) |

---

# 一、能力全景(总表 + 分层图 + 成熟度)

成熟度: **稳定**=多世界长期运行验证 / **新落地**=2026-06-06~08 落地、canary 验证中 / **实验性**=低频或激进、未充分验证。
状态文件在 `.novel-output/<world>/` 下。汇总: **22 稳定 / 4 新落地 / 1 实验性**。

### sim 模拟层(MockLLM 零成本推演)

| # | 能力 | 代码锚 | 状态文件 | gate | 成熟度 |
|---|---|---|---|---|---|
| 1 | 单写者世界引擎(step: plan→drainInputs→agents→gate→commit 单事务) | core/runtime/world-actor.ts | world.db | — | 稳定 |
| 2 | 角色 agent + 八字/奇门概率先验 | core/actors/character-actor.ts | world.db | NOVEL_PACK | 稳定 |
| 3 | 配置驱动世界工厂(WorldConfig=题材) | packs/freeform/make-pack.ts; app/world-gen.ts | worlds/*.json | NOVEL_WORLD_CONFIG 等 | 稳定 |
| 4 | M1 符号心跳(全员 drive 账本+appraisal, 零 LLM) | world-actor.ts:39,60,374-404 | world.db | — | 稳定 |
| 5 | M3 批量反思 + M4 情境指纹缓存 | app/minds.ts(situationFp:17); longrun.ts:491-501 | minds.json | — | 稳定 |
| 6 | T4 混沌边缘导演(冷加注/热收敛) | app/drama.ts(dramaControl:26) | drama.json | GENTLE 分支 | 稳定 |
| 7 | T5 模拟器自创机制(三道闸+影子模拟, CAP=6) | app/sim-rules.ts; longrun.ts:565 | sim-rules.json | — | 实验性 |
| 8 | 去饱和一阶段(gateCurve=exp/elder 留场/W_treadmill) | make-pack.ts:36,74-76; warm-fitness.ts:157-168 | genome.json | gateCurve 默认 linear | 新落地 |
| 9 | T3 涌现底座(资源零和/生态位/派系裂并) | world-actor.ts:217,281-298,363-394 | world.db | 旋钮默认 0 | 稳定 |

### author 作者层(DeepSeek 只写正文)

| # | 能力 | 代码锚 | 状态文件 | gate | 成熟度 |
|---|---|---|---|---|---|
| 10 | 章节编排主循环(多段成章+热切换) | longrun.ts:202-247,307+ | chapters/*.md+db | NOVEL_TARGET 等 | 稳定 |
| 11 | 伏笔账(8-14 章 setup→payoff) | longrun.ts:99-108,437-449 | foreshadows.json | — | 稳定 |
| 12 | 大纲跟纲(obedience×steer) | app/outline-plan.ts(beatObjForChapter:34) | outline-plan.json | 建世界时选 | 稳定 |
| 13 | 叙事推进力(T1 慢燃主线+T2 进展账本) | progression-ledger.ts; longrun.ts:453-461 | progression-ledger.json | 仅 GENTLE | 稳定 |
| 14 | 温情场景驱动器(2-gram 坍塌检测) | app/gentle-director.ts | gentle-director.json | 仅 GENTLE | 稳定 |
| 15 | 涌现际遇摄入(首现闸→weave) | app/gentle-emergence.ts; longrun.ts:262,458-460 | 无(内存) | 仅 GENTLE | 新落地 |
| 16 | lore 触发式召回 | app/lore-lib.ts; longrun.ts:227 | lore.json | freeform | 稳定(但见 S12 死通道) |
| 17 | 一致性三层(canon 软/derive-canon 硬/constraints 铁律) | canon.ts; derive-canon.ts; constraints.ts | canon/constraints.json | autoverdict 默认开 | 稳定 |
| 18 | 预演化+弧线选择(scout+in-medias-res) | longrun.ts:282-296; app/arc-select.ts | 无(瞬态) | NOVEL_WARMUP | 稳定 |
| 19 | 温情笔法(PENMANSHIP+beatSpec+余味) | longrun.ts:42-46,~204 | — | NOVEL_STYLE=温润 | 稳定 |
| 20 | 声口分化(deriveVoice→voiceCard 进段) | app/persona.ts:13-27; longrun.ts:232 | — | 仅 GENTLE | 新落地 |

### edit 修订层

| # | 能力 | 代码锚 | 状态文件 | gate | 成熟度 |
|---|---|---|---|---|---|
| 21 | 章后精修 pass(11 维零 LLM lint→LLM 减法→三道闸) | longrun.ts:181-199,246; app/edit-ledger.ts | edit-ledger.json | NOVEL_EDIT_PASS(GENTLE 默认开) | 新落地 |

### evolve 进化层

| # | 能力 | 代码锚 | 状态文件 | gate | 成熟度 |
|---|---|---|---|---|---|
| 22 | 作者层自进化 v2(MAP-Elites+混合评估+反自欺) | app/evolve.ts; longrun.ts:556 | genome/evolution/archive.json | NOVEL_EVOLVE 默认开 | 稳定 |
| 23 | 三套 fitness(sim 戏剧链/warm 温情六信号/LLM critique) | sim-fitness.ts; warm-fitness.ts; evolve.ts | *-fitness.json/evolution.json | warm 仅 GENTLE | 稳定 |
| 24 | 跨世界 QD niche 存档(bootstrap 引种) | evolve.ts(promoteToGlobal 等) | global-evolution.json | NOVEL_WORLD_INTENT | 稳定 |
| 25 | 规则层进化(铁律提案→永远人裁) | constraints.ts; longrun.ts:568-577 | constraints.json | 人裁瓶颈是故意设计 | 稳定 |

### ui 观察层

| # | 能力 | 代码锚 | 状态文件 | gate | 成熟度 |
|---|---|---|---|---|---|
| 26 | server 观察器+世事流转(零 LLM narrate+SSE+议事) | app/server.ts:66,94,189,310 | manualverdict/paused | PORT/NOVEL_STANDBY 等 | 稳定 |
| 27 | 冷启动 UX(待机→分槽位→模板→起跑) | server.ts; world-gen.ts:30 | llm-config.json | NOVEL_STANDBY | 稳定 |

### 分层数据流(哪层喂哪层)

```
[sim]  world.db 事件流/快照 (MockLLM 零成本)
  world-actor 单写者 ← character-actor(八字+心跳) ← make-pack(题材皮)
  章前注入: drama 覆写 props.tuning(T4) | sim-rules 准入(T5) | minds 反思经 input 队列
      │ events + snapshot
      ▼
[author]  longrun 章循环 (DeepSeek 只在这层烧钱, ≈14k input token/章, 指令:叙事≈70:30)
  章纲: scene+crisis+bible+ros+钩子+gdDomain+weave 单通道+outline 节拍+arcHint
  段 prompt(:232 七层): PENMANSHIP+voiceCard+canonHard+lore+canonInject+conBlock+evoGuidance
      │ 章草稿
      ▼
[edit]  reviseChapter(:181, 仅 GENTLE): lint 11 维 → LLM 只减法 → 三道闸(不过弃用)
      │ 近章正文(=修订后!) + 事件窗
      ▼
[evolve]  每8章: canonStep+sim/warm-fitness → evolveOnce(critique+客观+变异+MAP-Elites)
  genome→author 采样 | engine→sim tuning | avoid/amplify→prompt | 每24章铁律→[ui 人裁]
  跨世界: archive → global-evolution.json QD niche → 新世界引种
      │ SSE / worldlog / 曲线 / pending
      ▼
[ui]  server: narrate 解说+阅读+裁决 → 裁决经 input 队列写回 sim (闭环)
```

四条既有隔离线(红线): ① GENTLE 全 env-gated(爽文逐字节零变); ② F/R 分离(客观指标/critique 词表不进生成提示); ③ core 题材无关; ④ 全链禁 random/时钟(resume 确定性)。

---

# 二、协同度诊断

## 1. 冲突清单(按影响排序 · 行级证据)

| # | 冲突 | 类型 | 证据(行级) | 量级 |
|---|---|---|---|---|
| C1 | **targetStyle"冷峻×急促" vs PENMANSHIP"舒缓有韵" — 死锁级矛盾令** | 真冲突 | evolve.ts:196 pickTarget GENTLE 只滤 tone 不滤 rhythm; :246 rhythmBin<16 字阈把温润白描判"急促"→悲悯行 3 格填满→永远指向冷峻×急促; evoGuidance **每段注入**(longrun.ts:232 无门)。活实锤: renjian/yunyou/shanju 三世界 genome.targetStyle **全部**={冷峻,急促}, 连续多代 | **高**(每段×每章×3 世界×数十代) |
| C2 | **段配额"约900字" vs "宁短勿堆" — 数字赢了形容词** | 真冲突 | longrun.ts:226 perSec=ceil(MINLEN/SECTIONS×1.2)=900; :232 同一行并存两令; 守门只有下限(:236 段<120 重试, :465 章<MINLEN×0.4 弃)**无上限**。活实锤: renjian 近章 5022-5819 字, 超配 40-60%, 用微动/停顿/物象填量 | **高**(症①②④的上游水源) |
| C3 | **三处同构归因断裂: 干预层替基因考试** | 系统性 | ①drama 每章乘性加注(drama.ts:47 ×≤1.6)而 bestEngine 棘轮记 genome 基线(evolve.ts:340)——进化测的 engine 不是世界真跑的 engine(限爽文); ②gentle-director 确定性换景增益折进 fitness 给 genome 记功(evolve.ts:344); ③edit-pass 删完才喂 critique(longrun.ts:470 存修订稿→:543 读回), genome 为编辑功劳领赏, avoid 表学不到被删的 tic——**生成端每章重新制造同样的病, 没有任何回路收敛** | **高**(进化层学不到真东西; edit-pass 成本永久化) |
| C4 | **PENMANSHIP"一两件物贯穿回扣" vs edit-pass"象征过劳≥4 次拆掉"** | 真冲突(阈值互咬)+词库盲区 | longrun.ts:42 要求每段回扣→4 段成章必≥4 次→恰踩 edit-ledger.ts:57 workingObj 阈; 同一修订 prompt :77"拆掉回指"与 :80"克制反复回扣"并存; yunyou 招牌物"搭扣"一章 12 次却不在 STATIC_IMG 15 词表(:30)——**生成端制造、修订端要删却删不到** | **高**(每章每段生效) |
| C5 | **gentle-director lastDomain 永不过期 → 换景每次顶格"须离开X"** | 序冲突(状态机) | gentle-director.ts:92 `lastDomain: domain‖ctrl.lastDomain` 一旦换过永非空; :66 defyStreak 与隔了几章无关→S_TRIGGER=4 期间必爬到≥3→:89 必挂最强令。活实锤: renjian 10/10、yunyou 12/12 **所有**换景都带"须离开", 设计的"单维递进软着陆"从第二次起从未执行 | 中 |
| C6 | **镜头层换景 vs sim 层 roster"@旧地" 同 prompt 互矛盾** | 层分裂 | sceneShift 只动镜头(gentle-director.ts:79-89), roster 仍标"@旧地"(longrun.ts:161)、canonHard 由旧快照派生(:403)——outline"本章须离开X转到Y"与之对撞, 这正是 prose 黏旧场景需 defyStreak 强制令的根源; moveRatio(warm-fitness.ts:134)也测不到这次"流动" | 中 |
| C7 | **删减预算锁死: 病最重的章修订整体弃用** | 序冲突 | 各 directive 累计要求删 1/3 微动+一半段尾缓冲+比喻+回环(edit-ledger.ts:79-80), 而 passesGuards 长度地板只许删 15%(:111)。活实锤: yunyou 4 次弃用全是"长度 0.72-0.81<0.85"——治重病的机制对重病免疫 | 中(弃用率 3% 但全集中最差章) |
| C8 | **weave 单通道被伏笔结构性垄断**(consFit vs W_progress 抢道) | 序冲突 | longrun.ts:440-460 优先级硬编码伏笔回收>埋设>进展; 伏笔每 6 章补满 3 条+回收≈占 26% 章; 进展只在 weave=="" 且 gap≥8 才发声; 涌现 digest 无独立通道; consFit 奖回收→保满账→另一头 W_progress 扣分——**两个适应度项争一个注入口** | 中(慢性, 饱和时显) |
| C9 | **伏笔构思 prompt 戏剧措辞 vs beatSpec"不留悬念"** | 真漏洞 | longrun.ts:446 无 GENTLE 分叉, "悬念/未了之债/预言" vs beatSpec(:205)"绝不靠冲突"; 回收 weave"揭其真相"以硬级注入 vs beatSpec 软级"宜"。当前未失血(活数据伏笔偏温) | 低-中(低概率高伤害) |
| C10 | **sim 冲突词汇全量渗入温情 prompt** | 慢性拉锯 | world-actor.ts:499 自动 avenger 无门控; make-pack.ts:67 显示"找X算清"进 roster; longrun.ts:418-421 avengers/upsets 进 crisis 无 GENTLE 分叉——温情每章同时拿"誓复此仇"素材与"绝不冲突"指令, 是温情漂回戏剧的常开后门 | 低-中 |
| C11 | **novelty 同统计量双计 + dialogue 三处定标** | 评估重叠 | 爽文: objFit.repetition(evolve.ts:237)与 simFit.novelty(sim-fitness.ts:228)是**同一 4-gram 统计两次进分**(有效权重≈0.13 压一轴); ttr 奖多样与 M2 压 freqP/presP 反向; dialogue 三处定标互不一致(critique 主观/objFit 峰值 0.3/edit-pass ±2.5 闸) | 中(爽文进化地形失真) |
| C12 | **L3 裁决收紧 vs W_treadmill 计分口径** | 序冲突嫌疑 | W_treadmill 把 DecisionRequired+AuthorRuled 全计跑步机(warm-fitness.ts:160), L3 只翻 reject 不减提案→收紧越狠信号越差, 进化收到"去饱和无效"假反馈 | 低(置信度低, renjian 8.12 暂健康) |
| C13 | 杂项: S6 resume 内存态丢失(recent/prevHook/revivals 重启清空→覆灭派系永不复兴); S8 fitness 公式非平稳(跨卷不可比却拿来判停滞); S9 W_breath 僵尸信号(算且入史不入 total, 与蓝图漂移); S10 弃章重试 GD/drama 状态棘轮不回滚; S13 outline 与 secPrompt 信息不对称(persona 1188 字只进 outline, 写台词的调用拿不到人物心境) | 各异 | M2-S6/S8/S9/S10/S13 | 低-中 |

## 2. 冗余清单(按影响排序)

A2 总判: **重叠度低——多数"重复"是粒度真分工, 真正的问题是碎片化(互不通气)+一个空洞**。不建议合并任何两套机制。

| # | 冗余/空洞 | 证据 | 判定 |
|---|---|---|---|
| R1 | **症⑤章内段间重复 = 全系统唯一零覆盖层, 两风格共缺** | 段 i 只见 prev.slice(-280)(longrun.ts:232), 段 1 与段 3 互盲; 8 套防重复机制无一管章内段间语义重复; lint 只查封闭词表; metricsOf 测到也只折分不定位。⚠ 另一研究 wllp961fy 在跑症⑤, 补洞前先对齐 | 空洞>冗余, 优先补 |
| R2 | **三本重复账互盲 + masking 互扰** | 同一"灶房旧物"可触发 sceneAvoid(生成前)+crossImgs(生成后)+avoid(8 章后)三处独立账; motifSig 读的是 edit-pass 修订**后**文本(longrun.ts:349)→删意象钝化坍塌指纹→gentle-director 触发被推迟 | 加共享读层, 不合并 |
| R3 | **修订后文本污染上游传感器**(与 C3③同根) | edit-pass 改写的落盘文本同时是 motifSig/W_var/critique/metricsOf 的输入——精修层与度量层未隔离 | 定"度量读 draft 还是成稿"统一约定 |
| R4 | **novelty 轴 4-6 通道进同一标量**(=C11) | freshness/repetition/ttr/novelty/W_var/antiProxy 各算各; 爽文双计最实 | 信号注册表: 单信号单处进分 |
| R5 | **角色内面注入冗余**: innerDrive 三渲染、bond 三渲染且措辞分裂 | roster"善X/争X"(longrun.ts:158) vs personaDigest/canonHard"亲X/仇X"(persona.ts:36; derive-canon.ts:20)——同义异词 LLM 可能读成两组关系; GENTLE 声口双注入(outline+段) | 机制保留, GENTLE-gated 注入瘦身 |
| R6 | **canon 软层无确定性 scrub → 硬事实可双存** | canon.ts:44 只是 prompt 请求, :48 原样 merge; LLM 越权写"金丹修为/已陨落"即入库, 与 canonHard 每段并存直灌矛盾; canon.json 还兼职存 fitness 缓存(:13-14, 概念混居) | 加 ~15 行零 LLM 入库过滤器 |
| R7 | **prompt 层重复注入**: roster 在 outline+4 段重复 5 次(439×5); 末段收束指令与 PENMANSHIP 章末条款重复; evoGuidance 28 条逐字 avoid 短语命中趋零却每段付 851 字; canonInject(1755 字)比 PENMANSHIP 还大且 GENTLE 中段看不见矛盾修正 | M2-§5 实测: GENTLE 中段指令占 70%, 叙事上下文仅 900 字 | prompt 瘦身(中期) |
| R8 | **封闭词表盲区**: STATIC_IMG 15 词、CLASS_RULES 仅 2 条正则 | 新黏住意象(渡口/船桨/茶炉)逃过 crossImgs | 改动态高频统计 |
| R9 | 默认铁律#3"伏笔须兑现"与伏笔账机制+consFit 三处压同一行为 | constraints.ts:23; longrun.ts:435-452,522-525 | 无害, 新世界播种时不种该条即可 |

明确**不合并**: minds/persona/voiceCard(三个代价层)、moveBias/sceneShift(两个实体)、一致性三层(边界清晰)、三套 fitness 计算(三种传感器)、17 JSON→单 store(引入新耦合)。

## 3. 孤岛清单(该通信没通信 · 按机会排序)

| # | 孤岛对 | 证据 | 打通方案 | 复杂度 |
|---|---|---|---|---|
| I1 | **edit-pass lint 11 维 → 进化**(+上游意象提示) | lintChapter 算出 microPerK/settleRatio 等只 console.log 后丢弃(longrun.ts:196); edit-ledger.json 实测仅存 usedImages(278 字节); usedImages 也只喂 lint 不提示生成端——生成后才发现, 触发整章 LLM 修订 | ①draft 的 lint 落盘 lints[](滚动 16 章); ②warm-fitness 加 W_clean **先观察版**(只入史不入 total, breath/emerge 先例), 阶段 2 给 0.08-0.10; ③secPrompt 一行"近 5 章已用意象(章内回扣不限): …"——治症④于上游+断 C3③归因+降 edit-pass 触发率 | S-M(~40 行) |
| I2 | **sim 必叙事件 ↔ edit-pass 误删 + 伏笔回收不校验生死** | passesGuards 唯一一致性闸=canonHard 硬词≥75%(edit-ledger.ts:114-119), 而 canonHard 只列**在场者**(derive-canon.ts:36)——陨落主角恰不在场, 删掉整段陨落叙述不触闸, 正史静默失同步; 伏笔 desc 点名实体(柳如烟/铜钱)回收时无在场校验, 与"逝者不得出场"(derive-canon.ts:42)对撞 | mustKeep=upsets 主语第四闸(~10 行)+伏笔 due 扫非在场人名→GENTLE 改"追忆/遗物/转述"措辞(~12 行)——正史保真双保险 | S+S |
| I3 | **canon 溢出 → lore(盘活死机制)** | renjian/yunyou/shanju **均无 lore.json**(实测)→recallLore 恒""——召回通道在 3/4 活世界死亡(S12); 同时 canon.json 长大(18 人×8 短语+30 事实)超 canonBlock 上限(12×4+8, canon.ts:24-26)→6 人+22 条事实成"已确立但永不可见"暗物质 | canonStep 落盘后溢出条目转 LoreEntry merge 进 lore.json(normalizeLore/saveLore/recallLore 全套现成, 零新 LLM)——千章设定长尾的唯一可扩方案 | M |
| I4 | **sift 悬链无人收口**(sim 看得见的戏 author 写不了) | siftStories 每 8 章产 dangling 含现成中文描述("X陨于Y, 仇未雪", sim-fitness.ts:82), 消费者仅 console.log/drama 标量/反思文本/创世 arc-select——运行中没有任何章被指派收线; 爽文 weave 只有伏笔(作者自造悬念)一种 | 爽文 weave 空窗兜底: 取最老 dangling→"顺势推进这桩悬而未决之事"——预演化成功模式搬进长跑。⚠ 改爽文 prompt **需授权** | S-M |
| I5 | **伏笔账 ↔ outline 主线/进展账本互盲** | 埋设 prompt 只喂 crisis+ros(longrun.ts:446)不知 stageGoal→伏笔随机方向生长; 回收章撞 hard beat 时两个"必须"指令并存互不知情; renjian 实证: m0-m3 四里程碑 ch120 已全达成而 beats 排到 ch1000(advanceStep 不看区间, 剧本提前耗尽) | ①埋设附 stageGoal 一行; ②回收措辞并入主线; ③advanceStep 限当前区间(等 W_progress 再锁死再做) | S/S/M |
| I6 | **progression-ledger.situation 机读处境 write-only** | situation 有真值("浮生镇因果崖下…")唯一消费者是 console.log(longrun.ts:535)——机读 ground truth 不喂生成, bible(LLM 压缩, 会漂)反而独占 | outline 附一行"当前处境(机读): 身在X·被当作Y·近与Z来往"(~40 字, GENTLE-gated) | S(3 行) |
| I7 | **段间互盲(症⑤)的零 LLM 缓解** | 全章节拍单不在段 prompt(longrun.ts:232)——段 i 不知全章骨架与分工, 重复交代/物品漂移主因 | secPrompt 注入全节拍单+"本段写第 i 拍"(~60 字)+prev 窗 280→500; LLM 段后抽取**缓议**(等 wllp961fy 结论) | S |
| I8 | **世事流转 narrate ↔ 章正文: FactionSplit 漏网** | narrate 解说 12 类(server.ts:69-91), 章 crisis 只收 4 类(longrun.ts:412); FactionSplit 是 worldlog/sim-fitness/minds 全认、唯独正文滤掉的最大鱼——读者看到"分立"正文永不叙 | upsets filter 加 "FactionSplit" 一词。⚠ 该行爽文共用, 需 gate 或授权 | S |
| I9 | **QD 跨世界运行中授粉** | intent 取种只在创世分支(evolve.ts:63-70); selectParent 只读本地 | **判定不做**: 与 moveBiasAnchor 防收敛设计意图相悖, 3 温润世界各占 niche 是特性; 留作"停滞救援"备选(仅 n%24 停滞时同 niche 取父本) | — |

---

# 三、提升路线图(三档)

## 快赢档(一天内 · 全 S 复杂度 · 行级)

按 A1 优先修序(N3→c→N2→a→归因)+A3 优先级表合并:

| # | 项 | 改哪(精确) | 解什么 | 红线 |
|---|---|---|---|---|
| Q1 | pickTarget GENTLE 滤"急促"(或温润固定舒缓集)+evoGuidance 写入前 avoid∩amplify 去碰撞 | evolve.ts:196(一行过滤); buildGuidance:204-213 | C1 死锁矛盾令 | GENTLE 分支✅; 去碰撞若动爽文 guidance 需授权 |
| Q2 | 段字数指令改区间"五百至九百字、写到从容即收"+章级软上限(上章>MINLEN×1.8→本章 perSec×0.85, 确定性) | longrun.ts:232(GENTLE 三元分支); :226 | C2 水源(结构性根治=长线 overhaul-B, 此为垫) | GENTLE-gated✅ |
| Q3 | lastDomain 加章龄(距上次派发>3 章视空), defyStreak 只计真抗命 | gentle-director.ts:92,66 | C5 顶格干预 | GENTLE 模块✅ |
| Q4 | PENMANSHIP 数字契约("贯穿回扣以两三次为度")+workingObj 改动态"任意高频名词≥5"(词表留作种子) | longrun.ts:42; edit-ledger.ts:57,30 | C4 阈值互咬+词库盲区(搭扣) | GENTLE✅ |
| Q5 | lint(draft) 落盘 edit-ledger.json 新增 lints[](ch/similePerK/microPerK/settleRatio/pauseBeats/flagged, 滚 16 章)+W_clean 观察版(microPerK≤1.7 满/≥3.0 零; settleRatio 0.12; pauseBeats 6; similePerK 4; **不入 total**) | longrun.ts:196 附近; warm-fitness.ts | I1①②+C3③断归因第一步 | GENTLE✅, F/R 安全(只进分不进提示) |
| Q6 | secPrompt 一行"近 5 章已用静物意象(跨章换载体勿复用; **章内回扣不限**): 铜铃、井绳…"(源 edit-ledger.usedImages) | longrun.ts:232(GENTLE 段) | I1③上游避免, 直降 edit-pass 触发率 | GENTLE-gated✅ |
| Q7 | passesGuards 第四闸 mustKeep(=upsets 主语, 从 :412 newEvs 取; draft 含→revised 必含, 否则弃用修订)+伏笔 due 回收扫 desc 非在场人名→GENTLE 改"追忆/遗物/转述"措辞 | edit-ledger.ts:114-119; longrun.ts:440-444 | I2 正史保真双保险 | 纯加闸(更保守)✅; 伏笔爽文侧仅日志观测或顺延需授权 |
| Q8 | 伏笔埋设 prompt 附 stageGoal 一行"伏笔宜顺主线方向生长"+GENTLE 措辞分叉(牵念/旧物/未竟之约)+回收 weave 并入主线("回收并顺势推进本阶段主线") | longrun.ts:446,440 | I5①②+C9 | GENTLE 分叉✅; stageGoal 若进爽文共用行需授权 |
| Q9 | outline 附处境锚一行"当前处境(机读): …" | longrun.ts:208(GENTLE) | I6 | GENTLE-gated✅ |
| Q10 | secPrompt 注入全章节拍单+"本段写第 i 拍"(~60 字)+prev 窗 280→500 | longrun.ts:232 | I7 症⑤最大头零 LLM 缓解 | GENTLE-gated 实现✅(爽文版等 wllp961fy+授权) |
| Q11 | 弃用修订不回原稿→"降级二次修订"(只修 flagged 第一条)或按 flagged 条数放宽长度地板至 0.80 | longrun.ts:181-200; edit-ledger.ts:111 | C7 重病免疫 | GENTLE✅ |
| Q12 | W_breath 僵尸信号: 要么除名要么注释声明"仅观察"(防观察者据死信号调参) | warm-fitness.ts:176-178 | C13-S9 | GENTLE✅ |

## 中期档(约一周 · M 复杂度 · 含 A4 架构使能层)

| # | 项 | 改哪 | 解什么 |
|---|---|---|---|
| W1 | **writeChapter 13 位置参→ChapterContext 对象**(一次 Edit、调用点一处、零行为变更) | longrun.ts:202 | A4-H2 签名腐烂; 让后续所有接线不再加参 |
| W2 | **props 类型化**: core/domain/world.ts 旁建 EngineProps interface(tuning/dramaFocus/simRules/sceneShift/crisis 全 optional), props 收紧为 `Record<string,unknown> & Partial<EngineProps>` | world.ts:30,36,46+~12 处 `as` 读点 | A4-H1 app↔core 唯一缝硬化(tsc 假绿史的解药之一) |
| W3 | **抽 buildSecPrompt(ctx,i,last)/buildOutlinePrompt(ctx) 纯函数**+注入回归测试(断言"GENTLE 第 2 段含 voiceCard 不含 conBlock"等) | longrun.ts:232,208 搬家 | A4-M4; 病灶族 B 首次可单测; 七层冲突审计有处落笔 |
| W4 | **atomicWrite 助手**(写 .tmp 再 renameSync, 4 行)替换 11 个 save<X> 的裸 writeFileSync | 11 个模块 | A4-M1 torn-write→load 静默回 empty 的记忆清零风险; 护 resume 确定性红线 |
| W5 | **归因去偏三件套**(病灶族 A 统一方案): ①sim-fitness.json 随窗记录 drama eventBias 乘子均值, evolveOnce 更新 bestEngine 时去偏(~15 行); ②W_clean 转正进 warm total(0.08-0.10, 从 social/arc 匀)+lint 量化指标进 objectiveScore(让基因为"少制造"得分); ③wVar 归因注记(gentle-director 干预章打标) | sim-fitness.ts; evolve.ts:340; warm-fitness.ts | C3 全族 |
| W6 | **weave 双槽位+仲裁**: "主任务+一句副点缀", 伏笔不再清零进展/涌现; occupied 检查补 (n+1)%6 埋设章 | longrun.ts:436-461,354 | C8(consFit vs W_progress 抢道) |
| W7 | **重复状态共享读层**(零写零迁移聚合 edit-ledger/gentle-director/evolution 三本账)+定"度量读 draft"统一约定(motifSig/W_var/critique 改读修订前草稿或显式声明读成稿) | 新薄模块+longrun.ts:349,543 | R2/R3 masking 互扰 |
| W8 | **canon 软层入库过滤器**(~15 行零 LLM: 丢弃含 tier 名/陨落飞升在场/派系名短语)+canon.json 的 fitness 缓存迁出(概念分居) | canon.ts:48,13-14 | R6 双存通道(属 bug-fix 性收紧, 仍 canary 先行) |
| W9 | **canon 溢出→lore**(keys 启发式+merge 去重) | canon.ts 落盘后+lore-lib.ts | I3 盘活 3/4 世界死机制 |
| W10 | **sceneShift→sim 薄协调**: 真换域章 enqueue 一条 move-nudge input 或当章临时抬 props.tuning.moveBias(走 drama 既有写点 longrun.ts:339, 零 core 改动); DOMAINS 候选真用 curLocation | gentle-director.ts:79-82; longrun.ts:358 | C6 镜头/世界分裂 |
| W11 | **crisis 温度改写**(GENTLE 下 avenge/upsets 降调: "X与Y有一段未了的旧怨", 不删事实只换温度) | longrun.ts:418-421 | C10 后门收口 |
| W12 | **信号注册表**(一处声明每信号唯一 owner 轴+唯一执行器)+爽文 simFit 折分改 0.5·sift+0.3·tension 剔 novelty 项(novelty 留给 drama/曲线) | evolve.ts:341-346 | C11/R4。⚠ 改爽文行为**需授权+canary** |
| W13 | **resume 内存态落盘**: recent[]/prevHook/revivals[]/seenPairs 入 db 或 json(覆灭派系永不复兴 bug) | longrun.ts | C13-S6 |
| W14 | **GENTLE 注入瘦身**: roster GENTLE 分支省 bonds+innerDrive 后缀(单源归 canonHard+voiceCard); personaBlock 声口后缀删除; evoGuidance 加门控(avoid 命中率<阈即停注) | longrun.ts:158-163; persona.ts:36; evolve.ts:204 | R5/R7 指令:叙事 70:30 |
| W15 | H3 sift 悬链入爽文 weave 空窗兜底+I8 FactionSplit 一词 | longrun.ts:460,412 | I4/I8。⚠ 均碰爽文, **打包请一次授权** |

## 长线档(未落地蓝图待办榜 · 按 ROI 重排, 融合六路新证据)

相对 M1 原榜的调整理由注明:

| 排名 | 待办 | 蓝图 | 调整理由 |
|---|---|---|---|
| 1 | **去饱和二阶段 L1 关系状态机**(partner top-K+relationKind 确定性 hash) | 20260608-desaturation | 维持榜首: hub 集中度 102%→<40% 是长跑可持续根治 |
| 2 | **L6 大事状态触发**(nextStoryEvent 读快照, involve 限相关角色) | 同上 | 维持: 治大事 tick 机械死 |
| 3 | **松 perSec 段配额(overhaul-B 结构性)**+antiProxy 长度阈重标定 | 20260608-overhaul-assessment | **上调**(原 5): A1-N3 证实它是症①②④唯一上游水源, Q2 只是垫 |
| 4 | **L7 温情饱和轻搅动 + L5 补员温情钩子** | 20260608-desaturation | 维持; ⚠ 先解 C12(W_treadmill 口径)再上 L7, 防假反馈 |
| 5 | **进化 H: prompt 模板/rubric 自进化** | 20260531-self-evolution-sota | **上调**(原并列 7): 六路审计证实主要病灶在 prompt 端而非参数端——把进化对象从采样参数抬到模板正中要害; 前置=W3(buildSecPrompt 纯函数化后模板才可作为基因) |
| 6 | **质变窄路完整闭环**(铁律突变子世界 A/B 8 章实证+MCC 存档门+自提多样性轴+铁律跨世界传承) | 20260601-qualitative-leap §5 | 维持: 议事闸门已有, 缺实证环节 |
| 7 | **MAP-Elites 维度化替代标量加权**(novelty/clean/progress 各成存档维而非加权项) | 20260531-self-evolution-sota | **上调**: A2-e 证实标量加权=有效权重失真, W12 注册表是它的过渡台阶 |
| 8 | **continuous-minds M2 余项**(embedding 语义召回+Ebbinghaus 遗忘) | 20260603-continuous-minds | 维持(embedding 基建尚无); 与 lore 中文召回 A/B 合并验证 |
| 9 | **beatSpec 详略/长度权重(overhaul-C)** | 20260608-overhaul-assessment | 维持最低: 明令 A+B 后视效果 |
| 10 | **StyleProfile 第 3 风格预备** | A4-M2 新增 | 62 处 GENTLE 三元撑不到第 3 风格; **现在只做一件**: 新代码把 gentle:boolean 参数改 style:StyleId 命名, 不重构存量 62 处(过早抽象) |
| 11 | 进化 Tier2/3 余项(E 血统树/F 章级 novelty 拒收/G 技能库检索)、global-qd T4 余项、info-density M6、审计可缓做(occupied pledger/seenPairs 落盘/W_var 回归断言)、纯待验 A/B(预演化 N/K 甜点/服从度粒度) | 各原蓝图 | 维持原序 |

**明确不做清单**(避免过度工程/违设计意图): stage 数组可插拔 pipeline 框架(W1+维护班 seam 已够)、17 JSON 归一单 store、现在重构 StyleProfile 62 处、QD 运行中授粉(I9, 留停滞救援)、minds/persona/voiceCard 合并、moveBias/sceneShift 合并、段后 LLM 抽取(等 wllp961fy)。

---

# 四、协同原则(未来加能力的 checklist)

新能力接入"十问", 不全答完不进 longrun(本清单源自六路审计的共病归纳):

1. **状态声明**: 读哪些状态文件/写哪些? 写者唯一吗? 登记进依赖矩阵(M2-§6)。save 用 atomicWrite; load 失败回 empty 必须打日志(防记忆静默清零)。
2. **注入声明**: 进 prompt 吗? 注入点(outline/secPrompt 第几段)、字符预算、注入条件(每段/首末段/门控)写明。**与 PENMANSHIP/beatSpec/canonHard/targetStyle 的措辞冲突逐条核对**——形容词指令必须配数字契约, 否则数字(配额/阈值)会赢。
3. **fitness 声明**: 喂不喂 fitness? 喂则在信号注册表登记**唯一 owner 轴+唯一执行器**; 与既有信号(novelty/dialogue/密度)是否同统计量? 新信号一律先"观察版"(算入史不入 total, breath/emerge/W_clean 先例), 2-3 个 8 章窗验证与人评相关后再转正。
4. **归因声明**: 是章间干预层(drama/GD/edit-pass 式)吗? 是则必须声明对 fitness 测量的污染方式, 并落盘干预量供去偏——**干预层不许替基因考试**。度量读 draft 还是成稿, 显式声明。
5. **门控声明**: GENTLE-gated? env 开关名+默认值? 爽文分支表达式逐字节不动(三元里的 b 分支不许重排)。
6. **确定性声明**: 零 random/零时钟; 任何内存态(窗口/streak/seen 集)要么落盘要么注释声明"重启重建+后果"。
7. **弃章/重试语义**: 守门弃章时本能力的状态回滚吗? 不回滚要注释声明(S10 教训)。
8. **接入点纪律**: 不给 writeChapter 加位置参(进 ChapterContext); 不在 main() 散插(归入维护班/EVOLVE 块既有 seam); 顺序依赖写成代码结构不写注释。
9. **词表纪律**: 新 lint/检测维优先动态统计(高频 n-gram/名词), 封闭词表只作种子(C4 搭扣教训)。
10. **通道仲裁**: 要占 weave/crisis/scene 等共享通道吗? 声明优先级与让位规则(occupied 模式), 不许默认垄断(C8 教训); 产出的信号指定消费者, 不许 write-only(I4/I6 教训)。

附: secPrompt 指令预算红线建议——指令块占比从实测 70% 逐步压向 ≤55%(W14), 新增注入必须等量挤出旧注入。

---

# 五、红线自查

| 红线 | 本蓝图各提案的符合性 |
|---|---|
| **爽文逐字节零变** | 快赢 Q1-Q12 全部 GENTLE-gated 或纯收紧闸(修订弃用更保守=安全方向); 中期 W1-W4 零行为变更(重构/类型/原子写), W5①(drama 去偏)只改 fitness 计算不改 prompt, W8 属 bug-fix 收紧仍 canary 先行。**碰爽文需授权的四件打包**: W15(sift 悬链+FactionSplit)、W12(simFit 剔 novelty)、Q8 的 stageGoal 共用行、Q7 的伏笔爽文侧顺延——未授权前一律 GENTLE-gated 实现或仅日志观测。 |
| **禁随机/时钟(resume 确定性)** | 全部提案确定性: 章龄(Q3)/高频名词阈(Q4)/mustKeep 名单(Q7)/软上限(Q2)均由 db/json 既有状态派生; W4 atomicWrite 与 W13 落盘**加强**该红线(消 torn-write 与内存态丢失两个隐性破口)。 |
| **core 题材无关** | 不往 core 加任何题材逻辑: W2 props 类型化是把现存隐式契约显式化(加固不破坏); W10 move-nudge 走 app 层 enqueue+既有 tuning 写点, 零 core 改动; I2/I5 全在 app 层。 |
| **渐进不推倒** | 不做清单已列(§三末); 所有架构项(W1-W4)单提交可 revert; 新信号先观察版; 过滤器/闸只删 LLM 越权或弃用修订(失败回原稿)。 |
| **附加纪律**(记忆既有) | tsc 假绿→每件落地后 esbuild 逐文件校验+canary 实跑; prompt 串 `${}` 双引号内禁 ASCII 引号(用全角『』); 停止的世界(shanju)绝不自启; 重启用 pkill -9 防串台; F/R 隔离不破(Q5/W5 只进分不进生成提示)。 |

---

# 六、给主 Claude 的第一步落地清单(若用户说"落地")

最小可行集 = **Batch-α 八件**(全 GENTLE-gated 或纯加闸, 爽文零变, 无需授权, 预计半天):

1. **evolve.ts:196** — pickTarget GENTLE 分支: rhythm 候选排除"急促"(只留舒缓类或固定"舒缓")。一行过滤, 解 C1 死锁。
2. **longrun.ts:232** — GENTLE 字数指令三元分支: 『约900字』→『五百至九百字之间，写到从容即收，不为凑字数添物象』; **:226** 公式不动, 加 GENTLE 章级软上限: 读上章总长>MINLEN×1.8 则本章 perSec×0.85(确定性)。解 C2。
3. **gentle-director.ts:92** — lastDomain 存 {domain, ch}; **:66** defyStreak 仅当 (n−lastDomainCh)≤3 且 stuck 才递增, 否则清零。解 C5(10/10 顶格干预)。
4. **longrun.ts:42** — PENMANSHIP 回扣句附『全章回扣以两三次为度』; **edit-ledger.ts:57** workingObj 改"任意名词≥5 次"动态判(15 词表留种子, :30)。解 C4 互咬+搭扣盲区。
5. **edit-ledger.ts:114-119** — passesGuards 加第四闸 mustKeep: 从 longrun.ts:412 newEvs(Fell/Dissolved/Vengeance/Transcended)取主语名, draft 含且 revised 缺任一→弃用修订; **longrun.ts:440-444** 伏笔 due 回收前扫 desc 非在场人名, GENTLE 命中改 weave 措辞为『以追忆/遗物/旁人转述方式回收』。解 I2。
6. **longrun.ts:196 附近** — lint(精修前 draft)指标 push 进 edit-ledger.json 新增 `lints[]`(ch/similePerK/microPerK/settleRatio/pauseBeats/flagged, 滚动 16 章); **warm-fitness.ts** 加 W_clean(阈: microPerK≤1.7 满/≥3.0 零, settleRatio 0.12, pauseBeats 6, similePerK 4), **只入史不入 total**。解 I1①②, 断 C3③。
7. **longrun.ts:232** — GENTLE 段加一行『近5章已用静物意象(跨章换载体勿复用; 章内回扣不限): X、Y…』(源 edit-ledger.usedImages); 同处注入全章节拍单+『本段写第 i 拍』(~60 字), prev 窗 280→500(GENTLE)。解 I1③+I7。
8. **longrun.ts:208** — outline GENTLE 附『当前处境(机读): 身在X·被当作Y·近与Z来往』(源 progression-ledger.situation); **:446** 伏笔构思 GENTLE 措辞分叉(牵念/旧物/未竟之约, 不动爽文行)。解 I6+C9。

**验证流程**(每件必走):
- ① `npx tsc --noEmit`(记假绿史, 不充分) → ② **esbuild 逐文件语法校验**(memory: novel-tsx-syntax-validation) → ③ prompt 串自查: `${}` 双引号内无 ASCII 引号;
- ④ canary=**renjian**: pkill -9 精确匹配该世界进程→确认单写者锁释放→原 env 重启(NOVEL_STYLE=温润等), 跑一个 8 章窗;
- ⑤ 观察指标: genome.targetStyle 下一代是否仍"急促"(Q1 生效证据)、近章字数回 3600-4500 区间(Q2)、换景章"须离开"是否消失(Q3)、edit-pass flagged 数与弃用率(Q4/Q11 前后对比)、edit-ledger.json 出现 lints[](Q5)、W_clean 入史曲线(server);
- ⑥ **shanju 保持停止不动**(memory: 停止的世界别自启), yunyou 等 canary 过一个窗后再部署;
- ⑦ 单提交落盘, 回退=git revert 一次。

**Batch-β(需用户一次性授权后做, 因碰爽文行为)**: W15 sift 悬链入爽文 weave 空窗+FactionSplit 进 upsets(longrun.ts:460,412) · W12 爽文 simFit 折分剔 novelty(evolve.ts:341-346) · Q8 stageGoal 进共用埋设行 · Q7 伏笔爽文侧 dueCh 顺延。

**Batch-γ(中期一周, 架构使能, 零行为变更先行)**: W1 ChapterContext → W3 buildSecPrompt/buildOutlinePrompt 纯函数+注入回归测试 → W2 EngineProps → W4 atomicWrite×11 → 然后 W5 归因三件套与 W6 weave 双槽位在新骨架上做。

---

*六路研究原文: M1 能力清单 / M2 数据流 / A1 冲突 / A2 冗余 / A3 孤岛 / A4 架构(本目录同批产出); 历史蓝图见 .audit/ 各日期目录与 MEMORY.md 索引。*
