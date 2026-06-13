# 长跑世界去饱和 · 设计蓝图(4 路综合)

> 调研日期 2026-06-08 · 综合 4 路勘察(renjian/shanju/yunyou/renjian-380 归档 world.db 实证 + character-actor/world-actor/make-pack/drama/evolve/warm-fitness/sim-rules 码层勘验 + 外部长跑 sim 原理映射)。
> 本文为给主 Claude 的实施蓝图。所有行号经本次重读核对(见末尾"码层锚点核对表")。

---

## 〇、一句话结论

**用户感到的「晚期读着饱和」不是「进阶事件占比暴涨」——三路实证一致显示进阶占比晚期并不升(renjian 全程恒 ~1.1%)。真饱和 = 一个结构性恒态:从 ch1 起,世界就只有「升级跑步机」一种高音量事件源,叠加「单主角星型拓扑 + 有限交互词表 + 6 条循环大事 + 白板补员」,把无天花板的「关系/冲突/格局戏」全挤成了背景噪声。** 进阶不是病灶本体,是把「关系网无后果空转 + 大事循环」这两件重复事的重复感**放大**的扩音器。根治路径:把驱动力从"垂直爬升"挪到"水平关系重组"(外部所有长跑 sim 的共识),并修掉让进化对饱和"色盲"的 warm-fitness 公式。

---

# 一、饱和实证(晚期 vs 早期 · 跑步机占比 · roster 代谢 · 拐点章 · worldlog 实样)

## 1.1 反直觉铁证:进阶占比晚期没失控

按 tick=3×章 分桶(ChapterInscribed 实测第 N 章恒落 tick 3N)。PROG(晋阶+归隐+裁决 AuthorRuled/DecisionRequired)vs DRAMA(落定+派系+凶事+大事+登场):

| 阶段 | renjian PROG/DRAMA | shanju PROG/DRAMA |
|---|---|---|
| 早期 ch1-50 | 36.1% / 63.9% | 36.4% / 63.6% |
| 中期 ch51-129 | 41.2% / 58.8% | 40.8% / 59.2% |
| 晚期 ch130+ | **29.3% / 70.7%** | **42.8% / 57.2%** |

→ renjian 晚期 PROG 占比甚至**降了**。"晋阶刷满"是表象。真问题在 DRAMA 内部的**语义同质化** + 大事循环。

## 1.2 全生命周期事件分布(含 380 章归档主铁证)

| 世界 | 章 | ProgressionAdvanced | CharacterTranscended | CharacterEntered | **FactionSplit** | FactionDissolved | CharacterFell | VengeanceResolved | StoryEventTriggered |
|---|---|---|---|---|---|---|---|---|---|
| renjian (live) | 186 | 91 | 14 | 28 | **0** | 0 | 3 | 1 | 34 |
| shanju (live) | 181 | 128 | 22 | 34 | **0** | 0 | 2 | 1 | ~34 |
| yunyou (纯涌现) | 198 | 116 | 23 | 35 | **0** | 0 | 4 | 3 | ~36 |
| **renjian-380 (归档)** | 381 | **199** | 35 | 60 | **0** | 3 | 12 | 5 | ~63 |

晚期窗口(maxtick 后 1/3)逐 100-tick 看 renjian-380:晋阶 9-22 条/窗、归隐 0-6 条、**真戏(裂/并/陨/复仇)合计 0-5 条/100tick(多数 1-2)**。这个分布跨 1500 tick **全程稳定**——饱和是结构性恒态,不是"晚期退化"。

## 1.3 进阶跑步机的节律(renjian-380)

60 个角色爬过阶梯,8 个走完 t0→t6+ 全程;进阶间隔中位数 **98 tick ≈ 33 章/阶**;8 阶 ~260 章走完 = **正好用户喊停窗口**。累计折损率证明匀速空转:ProgressionAdvanced ch50=13→ch100=33→ch150=54(线性);Transcend ch50=0→100=1→150=8→total=14。

## 1.4 真·饱和签名(三路交叉确认)

**签名 A — 交互词表写死的极小集,永不增长。** `character-actor.ts:44-154` 是唯一动作生成器,社交动作宇宙只有 6 种(`act/obs/ally/clash/avenge/move`)。`ally` 措辞已扩到 10 词(`ALLY_VERBS` line 14,已修过一轮),但 `clash`/`avenge` 仍各 **1 句模板**。早→晚交互**类型零增长**,只是 ally 措辞在 10 词里轮转。无机制能造"新交互种类"。
```
renjian 早期: ally=67 obs=43 clash=30 move=8 (4 类)
renjian 晚期: ally=155 obs=109 clash=58 move=48 avenge=22 act=5 (5 类, 比例不变, ally 永远主导)
```

**签名 B — 单主角星型拓扑(关系全经一个 hub)。** `character-actor.ts:72-78`:每个行动者只挑 **1 个** other = `|bond|` 最大者(argmax)。主角最早结识所有人、积累最多 bond → 成为所有人的"最强羁绊对象" → 拓扑被机制强制成星型。早期 99/97=**102%** 配对互动经 c1;晚期 hub 转移到玄朗,worldlog 实样 14 条社交里 **8 条**"与玄朗"。

**签名 B' — 落定大量是"观望蓄势"纯空转 + 无后果 bond++。** renjian 晚期 286 条落定切分:**观望蓄势(`character-actor.ts:62` 零 deltas)= 90 条(31%)** + 移动 14% + 真互动 55%,但真互动全是"两人友好相处一下,bond+1",**无目标、无后果、不结晶成事件**。787 条落定只 250 个 distinct summary。这就是 MEMORY「叙事推进力」笔记的晚期空转。

**签名 C — 大事(StoryEvent)只有 6/9 种死循环。** `make-pack.ts:151-158` `nextStoryEvent` 按 `(tick/period) % storyEvents.length` 取,storyEvents 池**恰好 6 条**(world-gen.ts 硬性"恰好 6 个")→ "误得长生/浮生送别/南天试炼…"**每 6 次完整重播一轮**,与世界发生了什么、谁结了仇毫无关系。这是"读着重复"最直接来源:世界大事是 6 首循环 BGM。

**签名 D — 升级跑步机 + 角色克隆 + 名字坍塌。** 最终快照所有 t7 角色全离场:

| | 总角色 | 在场 | 离场 | t7(全部离场) |
|---|---|---|---|---|
| renjian | 32 | 15 | 17 | **14/14 absent** |
| shanju | 38 | 14 | 24 | **22/22 absent** |

t7 是单一最大桶(占曾存角色 44%/58%)。在场全是 t0-t6 新爬坡者,无一在 t7 = spawn→爬→封顶 t7→消失→再 spawn 的跑步机。晚期补员名字坍塌:renjian 晚期 16 个 spawn **100% 姓陈**(陈是/陈风/陈雪/陈鹤/陈霜 各 2 次)→ 近似重名克隆体做同样 ally/clash。根因 `make-pack.ts:123-131` spawnName 用 givenNames 池取模回收(已对 surname 防撞显式名,未防生成内部回收)。

## 1.5 roster 代谢时间线 + 拐点章

在场数被 `longrun.ts:318-324` 钉在 ~16(实测稳 ~12)。
- **ch1-60:创世 12 人,零归隐**(静态爬坡)。
- **拐点 = ch61(renjian)/ ch77(shanju)** —— 首次 CharacterTranscended(tick 183/231),跑步机从此咬合。
- **ch110-150(tick 330-450):归隐加速到 2-3/窗 + 名字坍塌成"陈X"**。用户说的 ch180+ 饱和感活在这段:在场已是一群近同的陈X爬坡者绕着 hub 做同样 6 动作。

## 1.6 worldlog 实样(用户真正看到的 feed)

curl `:8992/api/worldlog` 40 条:**52% 是跑步机**(晋阶/归隐/裁决),社交 14 条里 8 条"与玄朗"。世事流转区被无差别"晋阶·陈X / 归隐·陈Y / 议事已裁·依准"刷满。

## 1.7 三条本该产戏的杠杆"机械性全死"(根因预览)

1. **FactionSplit(structureGrowth)全 0** —— 闸(`world-actor.ts:508-511`)要 `mem.length≥4` 且 ≥2 个 `avgIntra<-1` 离心者。实测所有世界 dissidents=[]、splitDebt=0。因派系内负 bond 只来自 scarcity 竞争(`world-actor.ts:362`),温情 scarcity≈0.05(GENTLE 封顶 0.4),单 tick bond 侵蚀 ≈0.01,要 ~100 tick 同地共处才压一条 bond 到 -1;而 `avgIntra` 对全派系取均值被稀释 → **阈值在温情参数下不可达,分裂路径=死代码**。

2. **凶事折损被 turnoverRate 掐死** —— turnoverRate≈0.4-0.5,fallDebt 累加器(`world-actor.ts:473`)隔 2 次凶事才折损一人;加 eventBias≈0.52 + valence<-0.2 才折损 → CharacterFell 全程 1-4 个。几乎无真生死 → 无立碑、无复仇线点燃。

3. **进化对饱和色盲(最深层因)** —— warm-fitness `total≈8.4`(系统认为"健康"!),因 `var=9.87、bond=10、progress=10`;但真·故事丰富度 `sift.chains=1`(全世界仅 1 条故事链)、`arc=4.3` 是少数项。**优化器在爬一座对跑步机视而不见的山。**(autoverdict 实测 accept/reject ≈ 50/50,奇门凶占半数→reject,进阶被 ~50% 卡;漏点不在闸,在"除跑步机外无同量级事件源"。)

---

# 二、根因链

```
有限 tier 阶梯(8 阶, make-pack TIERS)
  ├─ 进阶门槛线性(make-pack:73-75 (ord+1)*3) ──► 高阶没难多少, 人人 ~33章/阶稳定封顶
  ├─ autoverdict 不分阶位(longrun:378 valence<-0.2→reject) ──► 高阶突破和低阶一样 ~50% 过, 无"越高越难批"
  └─ 登顶 t7 一律清空(world-actor:219-223 present=false) ──► 最有积淀的角色全删, 永远只剩新手爬塔
         │
         ▼
   归隐腾位 ──► 补员喂白板(longrun:318-324 + make-pack:132 零 bond/零钩子/零前史)
         │
         ▼
   新人只会爬塔 ──► 跑步机永动 + 名字池取模回收(make-pack:123-131)→ 晚期克隆体"陈X"
         │
   ┌─────┴─────────────────────────────────────────┐
   ▼                                                 ▼
跑步机刷屏(晋阶/归隐/裁决占 worldlog 52%)      唯一无天花板的关系/冲突/格局戏被挤成噪声
                                                     │
                              ┌──────────────────────┼──────────────────────┐
                              ▼                       ▼                       ▼
                 关系是星型 argmax(actor:72-78)  大事是 6 循环 BGM        派系分裂死代码
                 + 无后果 bond++(actor:84-113)   (make-pack:151-158)     (world-actor:503-527
                 + 31% 观望空转(actor:62)        与局面无关重播           温情参数阈值不可达)
                              │                       │                       │
                              └───────────────────────┴───────────────────────┘
                                                     │
                                                     ▼
   GENTLE 把所有"造新冲突/新结构"旋钮全关死:
     · drama.ts:42 heat=gentle?0 ──► 冷被判健康态、永不加注、structureGrowth 不挑裂(drama:49 !gentle 才挑)
     · evolve.ts:290-295 GENTLE 变异把 conflictRate/eventBias/scarcity/structureGrowth 全压地板
     · simRules 18 条里 14 条 valence≥0(化干戈)──► 连会 fire 的大事净效果都在"抚平"而非"搅动"
                                                     │
                                                     ▼
   warm-fitness.ts:166 total 公式无 treadmill 惩罚, progress 还占 0.10 正权
     ──► 优化器看不见饱和(total≈8.4 健康), 甚至奖励"更多爬坡"──► 自进化把世界推回跑步机
                                                     │
                                                     ▼
                          ★ 晚期读着饱和:跑步机刷屏 + 关系/大事重复空转 ★
```

**一句话根因:有限 tier + 稳定进阶(门槛线性+autoverdict 无阶位门槛)+ 补员喂白板跑步机 → 封顶刷屏,挤掉无天花板的关系/冲突/格局戏;而 GENTLE 又把激活这些戏的旋钮全关死、warm-fitness 对此色盲,形成自锁。**

---

# 三、去饱和杠杆清单

> 通用安全前提(贯穿全清单):app 层旋钮改动走 `EngineGenes`/`tuning`(core 只读通用数值);爽文 `GENTLE=false` 分支**逐字节不变**(所有新逻辑包 `if(GENTLE)`/`if(gentle)` 或读默认值=现状的旋钮/WorldConfig 可选字段默认 off);改 core 必 `npx tsc -p tsconfig.core.json --noEmit`(基线:仅 `sim-fitness.ts` 一条无害 pre-existing unused 警告,不应新增)+ `node_modules/.bin/esbuild` 校验。

### L1 — 关系状态机:破星型 + 关系"质变"产新交互种类(治本·最高 ROI)
- **机理**:`character-actor.ts:72-78` partner = `argmax|bond|` → 星型拓扑;`:84-113` bond 只改 ±1 标量 → 无关系"质变"(无背叛/负债/师徒/姻亲/世仇继承)。无天花板的关系维被压成匿名 +1。
- **改法**:① partner 从 argmax 改 **top-K(K=3)按 |bond| 加权确定性采样**(复用现有 char-sum hash,**禁 random/Date.now → resume 完全复现**)→ 破星型。② 给 bond 配 `relationKind` 标签(存 `char.props["rel:<id>"]`),当 |bond| 跨阈值且 kind 满足时解锁**新交互候选**(bond>5 且 kind 空 → "收为弟子";bond<-3 且 kind="debt" → "清算旧账";重逢/托付身后事/和解)。每个新 kind = 一种**永不重复**的交互。
- **改哪文件:行**:`core/actors/character-actor.ts:72-78`(partner 采样)、`:84-113`(交互候选 + relationKind 解锁)。
- **GENTLE/爽文安全**:partner top-K 采样**对两路都安全且有益**(都破星型),但默认参数 K 经 tuning 旋钮控、默认=现状(argmax)→ 不改在跑世界轨迹;新交互里**温情系**(收徒/和解/重逢/托付)高权,**冲突系**(清算/世仇)受 `conflictRate≤0.7` 门控、晚期才微开;爽文逐字节不变(新逻辑读默认旋钮)。
- **风险**:中。改 partner 选择会改既有轨迹 → 必旋钮默认现状 + 只对 renjian/shanju **重开新世界**生效;新 props 状态须各读取处一致。
- **外部映射**:DF/RimWorld 的 grudge/love/trauma 状态机(事件改关系边的**类型**而非标量);CK 的世仇/联姻/继承(冲突跨代继承)。

### L2 — 高阶突破门槛指数化(封顶稀有化)
- **机理**:`make-pack.ts:73-75` 门槛 `actCount<6` + `resource<(ord+1)*3` **线性**递增,高阶没难多少 → 人人 ~33章/阶稳定封顶 → 稳定吐归隐。
- **改法**:resource 门槛改指数 `3*Math.pow(GATE_BASE, ord)`(GATE_BASE≈1.7,t0→3/t3→15/t6→60);actCount 门槛随阶抬 `6+ord*2`。t6→t7 变"几十章才够一次",归隐成稀有大事而非流水线。
- **改哪文件:行**:`packs/freeform/make-pack.ts:73-75` + WorldConfig 加可选 `gateCurve?: "linear"|"exp"` 字段。
- **GENTLE/爽文安全**:这是 pack 数据层、对爽文同样生效——但爽文要的就是稳定爬塔爽感,**不该套此杠杆**。安全做法:`gateCurve` 默认 linear(爽文/旧世界逐字节不变),仅温情世界 server 建世界时写 exp。
- **风险**:低。门槛过陡致高阶冻结 → GATE_BASE≤1.8 + actCount 仍能累积兜。
- **外部映射**:所有长跑系统"power 是配菜不是主菜"——升级系统天生有限会饱和,须稀有化。

### L3 — autoverdict 对高阶突破降通过率/延宽限(让封顶难)
- **机理**:`longrun.ts:378` 自动裁决 `valence<-0.2→reject 否则 accept`,**不分阶位**。高阶突破和低阶一样 ~50% 过。
- **改法**:读 pending 决议对应角色当前 tier,高阶(tierIdx≥5)收紧:accept 条件改 `valence>0.3`(只大吉才批)而非 `≥-0.2`;或对高阶延长 GRACE_TICKS(更久悬而未决,期间做别的戏)。
- **改哪文件:行**:`app/longrun.ts:374-380` 自动裁决循环(需在此 load 快照查 `characters[charId].progressionTier`)。
- **GENTLE/爽文安全**:`if(GENTLE && tierIdx>=5)` 才收紧,爽文/低阶走原逻辑 → 爽文逐字节不变。
- **风险**:中。高阶卡批太死 → 角色永不归隐、roster 老龄化堆顶(须配 L6 elder 消化)。
- **外部映射**:"飞升"从背景音变成罕见大事件。

### L4 — 封顶者部分留场当 elder(生传承/冲突戏,而非全退·高价值)
- **机理**:`world-actor.ts:219-223` 登顶 t7 **一律 `present=false` 归隐** = 饱和最大音量源(归隐事件 + 腾位补员 + 新人再爬三连击),且把世界里最有积淀的角色全清走,永远只剩新手爬塔。
- **改法**:引入旋钮 `elderRetention`(tuning,默认 0=现状全退)。登顶时 `if(rng < elderRetention)` 则**不退场,挂 `props["elder"]=true`**:不再进阶(canAdvance 对 elder 返 false),但留场成传承钩子(后辈拜师/请益)、矛盾源(德高望重者旧怨被晚辈翻出)、稀缺资源持有者(elder powerOf 高、晚辈争其庇护)。配套 make-pack canAdvance 对 elder gate;加 elder 上限(≤4,超额仍归隐)。
- **改哪文件:行**:`core/runtime/world-actor.ts:219-223` + `app/evolve.ts:21/52`(EngineGenes+DEFAULT_GENOME 加 `elderRetention:0`)+ `make-pack.ts:72-77`(canAdvance 对 elder 返 false)。
- **GENTLE/爽文安全**:旋钮默认 0 → world-actor `if` 不进 → **所有现存世界(含爽文/yunyou/旧库)逐字节不变**;温情经 evolve GENTLE 变异给 0.4-0.6(温情正需"留得住人",老者守渡头是 premise 核心),爽文不变异此项(保留全退飞升爽感)。
- **风险**:中。新 props 须各读取处一致(prior/roster/persona 读 elder);elder 堆积致 roster 老化爬不动 → elder 上限兜。
- **外部映射**:DF 传奇矮人不消失→要塞历史/贵族;CK 君主死了→王朝/世仇/继承留下。**"个体达到顶点"转成"世界结构的新约束/新关系",而非删除腾位。**这是把"跑步机终点"从"清空"改成"沉淀"的关键杠杆,直接对应温情 premise。

### L5 — 补员带关系/前史钩子,而非纯爬塔白板(高价值)
- **机理**:`make-pack.ts:132-137` spawnCharacter 造纯白板(随机派系/地块/tier,**零 bond/零恩怨/零钩子**)→ 落地只会爬塔;`longrun.ts:318-325` 每 5 章补到 16 人,喂的全是白板 = 跑步机永动燃料。
- **改法**:① `make-pack.ts:132` spawnCharacter 加可选 hook 参数,概率给新人种 `bond:<某在场者>` 负值(带旧怨)、`props["seekingTeacher"]=<某 elder>`(求师)、或 `avenge`(为已陨者复仇)。② `longrun.ts:318-325` 补员入队前据快照算钩子:有 elder→求师;近期 CharacterFell 且无 avenger→复仇;派系≥2→对头号者竞争 bond。落地即 bond≠0、立刻能产 clash/avenge/和解,不必先爬。
- **改哪文件:行**:`packs/freeform/make-pack.ts:132`(spawnCharacter hook 参)、`app/longrun.ts:318-325`(补员钩子计算,包 `if(GENTLE)`)。
- **GENTLE/爽文安全**:hook 默认不传 → 爽文/预演化补员逐字节不变;温情**绝不给 avenge**(暴烈),只给"未了旧约/求医/寻亲/拜师"(yunyou bible 满是"旧诺/旧约/故人"= 天然素材);复用 gentle-emergence seenPairs 节流(~30% 概率)防钩子过密成新饱和。
- **风险**:中低。钩子过密 = 另一种饱和 → 低概率 + gap 节流。
- **外部映射**:RimWorld 新殖民者带 backstory/特质/关系(非白板);Qud 派系动态生成新仇新盟。**补员若是白板=只增不育。**

### L6 — 世界大事由"关系/格局涌现"而非循环点播(治签名 C·高 ROI)
- **机理**:`make-pack.ts:151-158` `nextStoryEvent` = `tick%period` 定时 + 固定 6 池取模 → 大事 6 首循环 BGM,与世界状态无关。这是"读着重复"最刺眼来源。
- **改法**:当 `factionRelations` 某对势力 delta 跌破阈值、或某 bond 累积到极值(恩/仇满)、或某 location 人口/资源失衡时,**合成一条针对当前局面的大事**(`involve` 限定相关角色,而非 `involve:"all"`)。固定 6 条降级为冷场兜底。把唯一无天花板冲突通道**从循环变成函数(关系→大事)**。
- **改哪文件:行**:`packs/freeform/make-pack.ts:151-162`(nextStoryEvent 改状态触发);可选 `app/sim-rules.ts:112-115` prompt 给温情保底要求 ≥1 条"代际/新势力"结构向机制(纠 14/18 释怀偏向)。
- **GENTLE/爽文安全**:simRules 注入路径已是 props.simRules、core 中立,爽文不受影响;温情合成的大事须"人情事件"(故人携旧物叩门/雪夜释仇/驿亭交市,valence 温和但带 factionShifts),爽文走原循环或自己的状态触发。
- **风险**:中。负向机制可能被 shadowSim 闸毙(人口坍/派系爆)→ 须 valence -0.3 而非 -1、stressDelta 小。
- **外部映射**:RimWorld raid points 由殖民地财富/人口**自适应缩放** + Randy 0.5-1.5× 随机打散(不可预测性=资产),长期阻止系统化难度爬升 treadmill。本项目 storyEvents 是"预定曲线最坏形态"(tick%period 循环)。

### L7 — 晚期提 structureGrowth/scarcity(关系/格局维),不抬 conflictRate
- **机理**:`drama.ts:42` 温情 `heat=0` 恒定 → 冷被判健康态、永不加注;`:49` 只 `!gentle` 才挑裂 → 温情 structureGrowth 永远死。冷判据(`drama.ts:36`)分不清"温情该静"和"跑步机空转"。
- **改法**:给温情一个**正交的"饱和探测器"**(非 heat):读近窗 `(ProgressionAdvanced+CharacterTranscended)/总事件`,> 阈值(如近 18tick 进阶占比 >40%)→ 判"跑步机饱和",**温情专属地**轻抬 `structureGrowth`(+0.15,封顶守 GENTLE 上限 0.35,让封顶者派系生**理念分歧型** split,新派系交恶设 -1 而非 -4 避免血战)和 `scarcity`(+0.05,让 elder 资源争浮现),**绝不抬 conflictRate/eventBias**。用"结构/资源"维替代"暴力"维。
- **改哪文件:行**:`app/drama.ts:25-49`(加温情饱和率探测块);**依赖 L1+L4 先到位**(否则 structureGrowth 仍死、elder 不存在)+ L1 让派系内真有负 bond 才裂得动。
- **GENTLE/爽文安全**:爽文 `gentle=false` 不进此块;温情新块用饱和率触发,与现有 heat=0 不冲突。
- **风险**:中高(最微妙)。抬 scarcity 有破"温润留白"险 → 小步、短时、张力回升即退;**建议最后上**。
- **外部映射**:RimWorld Cassandra 按叙事弧形状调度而非刺激密度;但温情要把"挑战"维度从暴力换成结构/代际。

### L8 — warm-fitness 加 W_treadmill 惩罚(修进化色盲·锚·建议并行)
- **机理**:`warm-fitness.ts:166` total = `0.25var+0.25bond+0.20social+0.15arc+0.10progress+0.05emerge`,**无 treadmill 惩罚,progress 还占 0.10 正权** → 优化器看不见饱和(total≈8.4 健康)、甚至奖励"更多爬坡" → 自进化把 L1-L7 拉回跑步机。
- **改法**:`computeWarmFit` 读 events 算近窗 `(ProgressionAdvanced+CharacterTranscended)/总事件`,高则扣分,加 `W_treadmill` 项权重 ~0.10(从 var 0.25 匀 0.05 + emerge 匀 0.05)。这是让 L1-L7 不被自进化拉回的**锚**。
- **改哪文件:行**:`app/warm-fitness.ts:166`(total 公式)+ 新增 treadmillPenalty 函数。
- **GENTLE/爽文安全**:warm-fitness 仅 GENTLE 读(爽文用 sim-fitness),爽文零触及。
- **风险**:低。纯打分项不进生成提示(F/R 分离,不刷分)。
- **外部映射**:QDAIF/MAP-Elites 多样性存档须有正确的 fitness 信号才不模式坍塌(MEMORY 自进化 SOTA 蓝图已立)。

### L9 — 名字反坍塌(治签名 D 末端)
- **机理**:`make-pack.ts:123-131` givenNames 池取模回收 → 晚期全"陈X"克隆。
- **改法**:givenNames 用过即排除(加 used-set,类比 `:119` 对 surname 的做法),池耗尽再回收。
- **改哪文件:行**:`packs/freeform/make-pack.ts:123-131`。
- **GENTLE/爽文安全**:两路都受益、都安全(纯命名层)。
- **风险**:低。
- **外部映射**:换血带身份(非重名单位)。

---

# 四、推荐方案(分梯度 · 温情/爽文/yunyou 分别处理 · 具体取值)

> 落地序:先治"音量配比"(降跑步机)→ 再"沉淀化"(elder)→ 再"育补员"(钩子)→ 再"治大事循环"→ 最后"轻搅动"。每梯度独立可验、出问题单独回退。**L8(进化色盲修)建议与 T1 并行**(否则后续都被自进化拉回)。

## T0(并行·锚)— 修进化色盲 [L8]
- 改 `warm-fitness.ts:166` 加 `W_treadmill` ~0.10(var 匀 0.05 + emerge 匀 0.05)。
- 风险低,先上,守住后续梯度不被自进化拉回。

## T1(最小改先验·立竿见影)— 降跑步机音量 [L2 + L3]
- `make-pack.ts:73-75` 加 WorldConfig `gateCurve`,温情写 `exp`(GATE_BASE=**1.7**,actCount 门槛 `6+ord*2`);`longrun.ts:374-380` 自动裁决加 `if(GENTLE && tierIdx>=5)` 收紧 accept 至 `valence>0.3`。
- **安全**:默认 linear/原逻辑 → 爽文+旧世界逐字节不变;仅温情新世界(或重启时 server 写 exp)生效。
- **取值**:GATE_BASE 1.7(t6→60 resource ≈ 现状 4-5 倍时长);高阶 accept 阈 valence>0.3。
- **验证**:跑 30 tick 影子 sim,ProgressionAdvanced 频率降 ~50-60%;warm/sim-fitness 不掉(sift/arc 应微升)。

## T2(中等·治本核心)— 封顶者沉淀为 elder [L4]
- `world-actor.ts:219-223` 加 `elderRetention`(默认 0);`evolve.ts:21/52` EngineGenes+DEFAULT_GENOME 加 `elderRetention:0`,GENTLE 变异给 **0.4-0.6**、爽文不变异;make-pack canAdvance 对 `props.elder` 返 false;elder 上限 **≤4**(超额仍归隐)。
- **安全**:旋钮 0 → world-actor `if` 不进 → 全世界(爽文/yunyou/旧库)逐字节不变;**必跑 `tsc -p tsconfig.core.json`**。
- **取值**:elderRetention 温情 0.5、上限 4。
- **验证**:温情跑 60 tick,CharacterTranscended 降、present 出现 elder 标记;persona/roster 渲染 elder 不报错;canon 一致性不掉。

## T3(中等·育而非填)— 补员带温情钩子 [L5]
- `make-pack.ts:132` spawnCharacter 加 hook 参(seekingTeacher/旧约 bond/寻亲,**温情绝不给 avenge**);`longrun.ts:318-325` 补员前据快照算钩子(有 elder→求师,派系≥2→竞争 bond),包 `if(GENTLE)`;复用 seenPairs 节流(**~30%** 概率)。
- **安全**:hook 默认不传 → 爽文/预演化补员逐字节不变。
- **取值**:钩子注入概率 ~30%。
- **验证**:新人入场后 roster bond/钩子非空,warm-fitness W_social/W_emerge 升;世事流转出现"拜师/还约"类解说。

## T4(根治·最微妙·最后上)— 大事状态触发 + 饱和探测轻搅动 + 代际张力 [L6 + L7 + L1]
- `make-pack.ts:151-162` nextStoryEvent 改关系/格局状态触发(`involve` 限相关角色);`drama.ts:25-49` 加温情饱和率探测(近窗进阶占比 >40% → structureGrowth+0.15/scarcity+0.05,**不抬 conflictRate**,封顶守 GENTLE 上限 0.35/0.4);`sim-rules.ts:112` prompt 给温情保底 ≥1 条结构/代际向机制;`character-actor.ts:72-113` 上 L1 关系状态机(top-K + relationKind)。
- **依赖**:T4 须 T1+T2 先到位(否则 structureGrowth 仍死、elder 不存在);代际是新 core → tsc 校验 + 不破 yunyou(yunyou 无 elder 则天然不触发)。
- **安全**:爽文 gentle=false 不进;代际 story-event 经 shadowSim 闸 + yunyou 无 elder 天然兼容。
- **取值**:饱和阈 40%;structureGrowth +0.15 封顶 0.35;新派系交恶 -1(非 -4);代际机制 valence -0.3(非 -1)。
- **验证**:饱和态下 FactionSplit 从 0 变正;sim-fitness sift.chains 从 1 升;人工读章确认是"道争/代际/聚散"而非暴力;温情 PENMANSHIP/edit-pass 不被破。

## 三类世界分别处理
- **温情(NOVEL_STYLE=温润,renjian/shanju)**:全梯度 T0-T4。gateCurve=exp、elderRetention=0.5、补员温情钩子、大事人情化、饱和轻搅动只走结构/资源维。这是本蓝图主战场。
- **爽文(GENTLE=false,arcsaga 等)**:**逐字节不变**。所有新旋钮默认值=现状、所有 GENTLE 块不进、gateCurve 默认 linear(爽文要稳定爬塔爽感)。唯一可选:若爽文也现饱和,可单独评估开 elderRetention(让大佬留场当门派长老)——但默认不动。
- **yunyou(纯涌现,无 outline-plan)**:T0-T4 对它**要么不触发**(elder/代际:它若不进化出 elderRetention 则=0;大事状态触发它本就该走涌现)**要么只是旋钮**(它自进化决定),**不强加**。L1 partner top-K 对 yunyou 也安全(破星型,纯涌现更该如此),但默认参数=现状。确认 yunyou 走 freeform spawn 但自进化路径独立即可。

---

# 五、温情特化

## 5.1 进阶降权
进阶事件占比从当前主旋律(worldlog 52%)压到 **<20%**:gateCurve=exp 拉长每阶(T1)+ 高阶 accept 收紧(T1)+ elderRetention 让少数走到顶的**留场**而非刷归隐(T2)+ W_treadmill 惩罚让进化不再奖爬坡(T0)。进阶退居背景(瓶颈期、收徒、闭关)。

## 5.2 关系/世代戏上位
- 在场 ~12 人不该全围一个 hub,而是 **3-4 个关系簇**(各有核心 dyad),簇间偶有往来(L1 top-K 破星型)。
- **elder 成为关系/传承锚**:后辈拜师、旧识重逢、未了旧约在 elder 处收束;"旧债檐下重泡,她终于说药不苦"这类 payoff 是晚期主菜。
- **代际/聚散张力替代爬塔张力**:新人带"旧诺/寻亲/求医"钩子入场(无天花板,L5),与 elder 和在场者重组关系网;偶有温和"道不同"分歧(structureGrowth 轻启,L7)而非暴力派系战。
- **大事是"人情事件"不是"危机"**:simRules/nextStoryEvent 多产"故人携旧物叩门/雪夜释仇/驿亭交市"这类带 factionShifts 或代际涉入、valence 温和的事(L6)。

## 5.3 不破留白慢节奏与 edit-pass
- 所有改动在**模拟层(事件/旋钮)**,不碰 `composePrompt`/PENMANSHIP/edit-ledger;章后精修 pass(`longrun.reviseChapter`)仍是最后守门(删比喻过密/情绪过释/意象复读)。
- T4 抬 scarcity 须小步、短时、张力回升即退(防把资源争写成戏剧、破温润留白)。
- 不动 `frequencyPenalty/presencePenalty` 的温情压低(那是 M2 降密度,与去饱和正交)。

## 5.4 温情版"新鲜"长啥样
不是"更多爽点",而是**关系图的持续重组 + 大事由当前关系状态触发**。世事流转区从"晋阶·陈X / 归隐·陈Y / 议事已裁·依准"刷屏,变成"某携稚子还信物 / 某守渡头三年终见故人 / 山下村邻为新规起分歧 / 某拜某为师"——**人物有名有事、关系在动**。这正是温情 premise「相望相渡」本应是的样子。

---

# 六、红线(别破)

1. **温情大师笔法**:不碰 `composePrompt`/PENMANSHIP/beatSpec/章末留余味;全部改动在模拟层。章后 edit-pass 仍是最后守门。
2. **纯涌现(yunyou)**:T0-T4 对 yunyou 要么不触发要么只是它自进化决定的旋钮,**不强加** elder/代际/exp 门槛。确认 yunyou 自进化路径独立。
3. **moveBias 锚(moveBiasAnchor)**:`evolve.ts:20/299-301` 的锚定式自进化(游历0.20/定居0.15/隐居0.08,跨代向锚收 66%)是用户选定、防温情世界收敛到公共值——**新旋钮(elderRetention/gateCurve)勿干扰此机制**,各世界节奏分化要保。
4. **爽文逐字节不变**:所有新旋钮默认值=现状 + 所有 GENTLE 块 `if(GENTLE)`/`if(gentle)` 门控 + WorldConfig 可选字段默认 off。gateCurve 默认 linear(爽文要稳定爬塔)。
5. **yunyou 不碰**:见 2/3。
6. **改 sim 必校验**:改 core(T2 world-actor、T4 代际)必 `npx tsc -p tsconfig.core.json --noEmit`(基线仅 sim-fitness.ts 一条无害警告,不应新增)+ `node_modules/.bin/esbuild` 通过。
7. **resume 复现铁律**:L1 partner 采样禁 random/Date.now,只用 char-sum hash(同 ALLY_VERBS 做法),否则破 resume 复现。

---

# 七、落地与验证

## 7.1 去饱和验证指标(改后重开 renjian #N 从 ch1 跑到 ch180,对照本次停掉旧库 before/after)
- **晚期事件分布·戏占比 ↑**:worldlog feed 跑步机(晋阶/归隐/裁决)占比从 52% → **<35%**;DRAMA 内真戏(裂/并/陨/复仇/关系里程碑)/100tick 从 0-5 → 明显升。
- **晋阶·归隐占比 ↓**:ProgressionAdvanced 占总事件从 ~1.1% 维持或降;CharacterTranscended 频率降(elder 留场);t7 占曾存角色比从 44%/58% → **<30%**。
- **hub 集中度 ↓**:配对互动经单一 hub 从 102% → **<40%**(L1 top-K 生效)。
- **交互类型数 ↑**:从恒 6 类 → **>6 且随时间增**(L1 relationKind 解锁)。
- **FactionSplit 从 0 变正**(L7+L1 激活);**sift.chains 从 1 升 ≥3**(出现 ≥3 种关系弧,不止"逆袭登顶")。
- **worldlog 变丰富**:实样出现"拜师/还约/重逢/道争"类解说,而非无差别"陈X晋阶"。
- **抽读没破温情**:人工读 ch150/ch180,确认是"道争/代际/聚散"而非暴力,PENMANSHIP/留白/edit-pass 守住。
- **warm-fitness 不再色盲**:加 W_treadmill 后,饱和世界 total 应明显低于去饱和世界(当前 8.4 应区分开)。

## 7.2 用户停掉的 renjian/shanju 怎么处理(关键决策)
**推荐:带新机制 reopen 从 ch1(而非 resume,也非只给未来世界)。** 理由:
- **不能 resume**:L1/L2/L4 改的是角色/进阶/拓扑的**生成逻辑**,旧库 32/38 角色已是星型+全 t7 离场的饱和终态,resume 续写无法回填关系簇与 elder,且 L1 改 partner 会改既有轨迹(破复现)。
- **不能只给未来世界**:用户明确在意 renjian/shanju 这两个 premise(相望相渡),只给未来世界等于放弃验证主战场。
- **做法**:把旧 renjian/shanju 库**归档对照**(如 `renjian-killed-…`,已有先例),用同 bible + 新机制(gateCurve=exp/elderRetention=0.5/补员钩子/大事状态触发/W_treadmill)**重开 renjian #N、shanju #N 从 ch1**,跑到 ch180 复测 7.1 全部签名,与归档旧库 before/after 对照。这也复用了 MEMORY「叙事推进力」里"重开世界从 ch1 验证、旧循环世界归档对照"的成熟做法。

---

# 八、给主 Claude:第一步落地清单(最高 ROI 先做)

> 按 ROI/风险排序。前两步可并行,先把"锚"和"音量配比"立住,再上治本的 elder。

**第 1 步(锚·最低风险)— L8 修进化色盲** `app/warm-fitness.ts:166`
- total 公式加 `W_treadmill` 项(权重 ~0.10,从 var 0.25→0.20 + emerge 0.05→保留并新增惩罚位):新增函数读 events 算近窗 `(ProgressionAdvanced+CharacterTranscended)/总事件`,占比高则扣分。
- **为何先做**:不立这个锚,后续 T1-T4 都会被自进化拉回跑步机(当前 total=8.4 对饱和色盲)。纯打分、零生成影响、爽文零触及。

**第 2 步(立竿见影)— L2+L3 降跑步机音量** `packs/freeform/make-pack.ts:73-75` + `app/longrun.ts:374-380`
- make-pack 加 WorldConfig 可选 `gateCurve?:"linear"|"exp"`,exp 时门槛 `3*1.7^ord` + actCount `6+ord*2`;默认 linear(爽文/旧库逐字节不变)。
- longrun 自动裁决加 `if(GENTLE && tierIdx>=5)` 收紧 accept 至 valence>0.3(需在此 load 快照查 tier)。
- **为何**:最小改面、不碰 core、立即把"33章/阶稳定封顶"拉长 ~4-5 倍,归隐刷屏立降。`esbuild` 校验即可(不涉 core)。

**第 3 步(治本核心)— L4 封顶者沉淀为 elder** `core/runtime/world-actor.ts:219-223` + `app/evolve.ts:21/52` + `make-pack.ts:72-77`
- world-actor 登顶处加 `elderRetention`(默认 0)旋钮:`if(rng<elderRetention)` 挂 `props.elder=true` 不退场,否则原逻辑归隐;elder 上限 ≤4。
- evolve EngineGenes/DEFAULT_GENOME 加 `elderRetention:0`,GENTLE 变异给 0.5、爽文不变异;make-pack canAdvance 对 elder 返 false。
- **为何**:这是把"跑步机终点=清空"改成"沉淀"的关键杠杆,直接对应温情 premise(老者守渡头),且是 L5(补员求师钩子)/L7(elder 资源争)的前置。**必跑 `npx tsc -p tsconfig.core.json --noEmit`**(基线仅 sim-fitness.ts 一条无害警告)。

**第 4 步(验证前置)— 重开 renjian #N / shanju #N 从 ch1**
- 归档旧 renjian/shanju 库(`…-killed-…` 命名),用同 bible + 上述新机制重开,跑到 ch180,复测第七节 7.1 全部签名,与归档旧库 before/after 对照。

**第 1 阶段不做(留 T3/T4)**:L1 关系状态机(top-K + relationKind)、L6 大事状态触发、L7 饱和探测——这些是治本第二波,**依赖第 3 步 elder 先落地 + 第 1 步锚守住**,且 L1 改 partner 须谨慎复现验证,放第二轮专项做。

---

## 附:码层锚点核对表(本次重读确认,均绝对路径)

| 杠杆 | 文件 | 行 | 现状(已核) |
|---|---|---|---|
| L1 关系状态机 | `core/actors/character-actor.ts` | 72-78 / 84-113 / 14(ALLY_VERBS)/ 62(obs 空转) | partner=argmax\|bond\|;bond 只 ±1 标量;obs 零 deltas;ally 已 10 词 |
| L2 门槛指数化 | `packs/freeform/make-pack.ts` | 73-75 | 线性 `(Math.max(0,ord)+1)*3` + actCount<6 |
| L3 autoverdict 分阶 | `app/longrun.ts` | 374-380(378) | `valence<-0.2→reject`,不分阶位;GRACE_TICKS 默认 0(全自动) |
| L4 elder 沉淀 | `core/runtime/world-actor.ts` | 219-223 | 登顶 `curIdx+1===tiers.length-1` → `present=false`+CharacterTranscended |
| L5 补员钩子 | `packs/freeform/make-pack.ts` / `app/longrun.ts` | 132-137 / 318-325 | spawnCharacter 纯白板;每 5 章补到 16 |
| L6 大事状态触发 | `packs/freeform/make-pack.ts` | 151-162 | `(tick/period)%storyEvents.length` 循环 6 池;involve:"all" |
| L7 饱和探测 | `app/drama.ts` | 25-49(42 heat / 49 挑裂) | `heat=gentle?0`;`!gentle && coldStreak≥2` 才挑裂 |
| L7 死代码确认 | `core/runtime/world-actor.ts` | 503-527(508-511) | FactionSplit 要 mem≥4 + ≥2 个 avgIntra<-1;温情 scarcity≈0.05 阈值不可达 |
| L8 进化色盲 | `app/warm-fitness.ts` | 166 | total=0.25var+0.25bond+0.20social+0.15arc+0.10progress+0.05emerge;无 treadmill 惩罚 |
| L9 名字坍塌 | `packs/freeform/make-pack.ts` | 119-131 | surname 防撞显式名,givenNames 取模回收未防 |
| GENTLE 变异锚 | `app/evolve.ts` | 21 / 52 / 290-302 | EngineGenes 形状;GENTLE 把 conflictRate/eventBias/scarcity/structureGrowth 压地板 |

**实证数据**(均绝对路径):
- 主铁证(381 章全生命周期):`/Users/chris0810/Documents/Codex/Novel System/.novel-output/renjian-killed-20260606-180327/world.db`
- live 对照:`/Users/chris0810/Documents/Codex/Novel System/.novel-output/{renjian,shanju,yunyou}/world.db`
- 用户标"好章"参照(对照温情笔法):`renjian-killed-…224023` ch1(见 MEMORY info-density 笔记)
