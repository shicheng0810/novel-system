# 对抗式复核 · 全系统健康报告

> 复核员把报告每个 load-bearing 断言拉回 live 代码/数据核对, 纠了几处误诊。配套报告见 report.md。
> 关键修正: P1-1 eventBias「死接线」是**误报**(实为活线, 在 pack 消费); P0-1 真根因是引擎名池撞名(非 follow 专属、emergent 也不免疫); saga 已停跑; 真问题核定为 5 个。

---

All final checks confirm:
- **2 longrun writers** (94734 mystory, 94735 arcsaga) — exactly one per live world. The multiple PIDs per world are the npm→tsx→node wrapper chain (npm exec → .bin/tsx → node), not duplicate writers. No zombie writers. The single-writer lock is holding. ✓
- **Two server stacks** (77831/8990 mystory + 93859/8991 arcsaga), each also a wrapper chain. ✓
- sim=MockLLM (deterministic world sim), llm=deepseek (prose) — separation confirmed ✓
- **evolution fitness timeline is non-constant** (5.93→6.2→7.27→...→5.81), 19 entries, hill-climbing across varied cells (悲悯×*, 诙谐×*). The QD loop is genuinely running and varying. ✓

I now have comprehensive verification. Note one more nuance on the QD loop: the archive cells span only 2 tones (悲悯, 诙谐) — the report's P2-3 "engineNiche仅4格降维" and the broader concern about style-cell diversity. But that's a separate dimension. The MAP-Elites archive has 6 cells (verified earlier), QD is functioning.

Let me compile the adversarial review. I have verified every load-bearing claim against live code and data. Here is my final assessment.

---

# 对抗式复核裁决 — Novel System 全系统健康报告

我直接读了 `core/`、`app/`、`packs/` 源码与 `.novel-output/` live 数据(SQLite/JSON/进程/端口/锁),逐条核对。结论如下。

## 一、报告结论【确认】的(实锤复核通过)

| 报告结论 | 我的复核证据 |
|---|---|
| 核心引擎事件溯源零腐化 | mystory live: count=distinct_seq=distinct_id=7493, seq 连续 1..7493 零空洞零重复; checkpoints 662==662 distinct tick。**确认**(报告写 7345 是旧快照,现已 7493,世界仍在跑) |
| gate→裁决→commit 账目三层闭合 | live: DecisionRequired=AuthorRuled=207; AuthorRuled accept=120==BranchPromoted=120==ProgressionAdvanced=120; reject=87==BranchArchived=87; other=0。**逐项实锤对平,确认** |
| deepseek 真在写非退 mock | llm-config=deepseek-v4-pro+真 key; ch-0163=16KB、ch-0164=19KB 真实叙事; sim=MockLLM(世界推演)与 llm=deepseek(文笔)分离。**确认** |
| 自进化闭环真在变 | evolution.json 19 条 fitness 非常数(5.93→7.27→…→5.81), 6 格 archive, bestEngine sim6.63。**确认** |
| 跨世界 QD 引种真生效 | global 4 格 3 格 from `-killed` 世界(saga-killed/arcsaga-killed/qunxiang-killed); per-niche 单调留最优。**确认** |
| 铁律闭环(提案→人工裁决→注入) | constraints.json gen3, history 3 条全 approve, active[0] 经 atVol2/4/6 三次 rewrite 累积演化。**确认** |
| 全自动裁决 vs 铁律人类策展物理隔离 | `applyConstraintVerdict` 全仓只被 server.ts:212(网页)调用; autoverdict(longrun:298)只归零普通议事 GRACE,不碰 constraints。**确认** |
| **P0-2 跨世界 QD engine 归错格** | **实锤确认**: mystory bestEngine(turnover0.75/scarcity0.5)在 global 4 格中**查无踪迹**, mystory 对 global cells 贡献=0; depositWorldArchive(evolve.ts:104-107)取 champ.genome(=cloneGenome(cur), 非 bestEngine); mystory champ(悲悯×急促 turnover=1)归"高代谢×平",其 bestEngine 本该归的"低代谢×平"被 saga-pre-fixes 占着。机制与症状双确认 |
| P1-2 evCursor 跨重启冷读 | `let evCursor=0`(longrun:210)不持久化, n 从 listChapters 恢复(164); readEventsSince(db,0)=`seq>0`返回全量; 重启首章会把全史 **46** 桩兴亡(Fell/Dissolved/Vengeance/Transcended)塞进 crisis。**确认** |
| P1-3 global 文件无跨世界锁 | evolve.ts 无 global.lock; 两 live 世界(94734/94735)均 NOVEL_EVOLVE=1 都 promoteToGlobal; tmp+rename 只防撕裂读不防丢更新; 末读合并(:117)缩窗但非互斥。**确认为全系统唯一仍缺互斥的多写者点,最终一致非腐化** |
| P1-4 defining 仅一条复位路径 | server.ts 只有 child.on("error")(:260)+catch(:263)复位; spawn 成功但 longrun 撞锁自爆(longrun:57 exit 0)则 defining 永停 true。**确认**(注释自承"客户端另有超时兜底") |
| warmup×QD intent 正交 | arc-select.ts 零 genome/tuning 引用; warmup 块只设 arcHint+快进、不写 genome。**确认正交** |
| 单写者锁/无僵尸写者 | live 仅 2 个 longrun(每世界 1), 多 PID 是 npm→tsx→node 包装链非重复写者; input drain 单事务(world-actor:568 transaction)单写者。**确认** |
| /state 路由不存在、实为 /api/snapshot | curl /state=404, /api/snapshot 两端口均 200。**确认报告自述无误** |
| P2-7 worldId 硬编码 saga | 确认 longrun:96 `worldId="saga"`,但各世界独立 world.db,**仅"塞同一库"才撞**——报告定性准确(潜在非活跃) |
| P2-9 worlds-registry 端口撞 8990 | registry qunxiang port=8990 与 mystory 实跑 server 撞。**确认潜在冲突** |

## 二、报告结论【需修正】的

**1. P1-1「eventBias 是 core 端死接线/进化空转」——报告错了(过度报警 + 误诊)。正确结论: eventBias 完全活线,在跑生效。**
- 报告只 `grep core/` 得零命中就判死接线。但 eventBias 在 **pack** 里被读: `packs/freeform/make-pack.ts:151-153`(mystory 的活动 pack, NOVEL_PACK=freeform)与 `packs/xianxia-bazi/index.ts:393-394`,控制 `nextStoryEvent` 周期 `period=max(6,round(20/eventBias))`——eventBias=1.25 → 周期 20→16,大事更频。drama.ts:46 写它、pack 消费它,**闭环活的**。
- 故 global cells 的 eventBias=1.2/1.25 **不是空转**,reflection 教 LLM 拨它也**不是断头旋钮**。这是报告把"引擎逻辑在 pack 不在 world-actor"看漏导致的假阳性 P1。**应从问题清单删除。**

**2. P0-1「follow/strict 名册三方分裂」——症状确认(mystory consistency=2/10 实锤),但根因误诊 + "emergent 免疫"过度乐观。**
- 症状真: mystory canon.json lastConsistency=2/10、6 矛盾, ch163 正文实见"顾书同""雷兴旺"(引擎硬事实无此名)。**坐实。**
- 但**根因主要是引擎自身名池碰撞,与 follow/strict 无关**: spawnNames 显式含「萧斩/林书同/黄雨晴」,而组合生成器(make-pack:121-124 `surnames×givenNames`)会产出「萧曦/林舒雅/黄舒雅」——萧∈surnames、曦∈givenNames → 必然撞出近重名,LLM 把萧斩/萧曦混写。被 flag 的矛盾全是这类引擎内近重名,**不是报告说的大纲专名(老陈/阿福)泄漏**(老陈/阿福根本没进矛盾列表)。
- **"emergent(saga)免疫"过度乐观**: arcsaga(emergent、无 outline-plan)consistency=4/10、4 矛盾(云御风生死翻转、纳兰映雪/云御风境界写错)——**同类一致性病(prose 漂离引擎硬事实),只是较轻**。报告称 emergent"已接近合理且正确的理想态"言过其实。
- 正确结论: 这是**跨模式的通病(LLM 正文漂离 derive-canon 硬事实)**,mystory 因"组合名池撞名 + 主角退场(c1 present=false)"而更重; 修法应是(a)去掉组合生成器与显式 spawnNames 的姓/名碎片重叠,(b)给硬事实↔正文做强校验回灌,而非报告主张的"follow 灌全大纲专名"。

**3. P2-1 / P1-5 「pendingImp 达 35-44 / arcsaga force=11 切里程碑角色」——逻辑隐患在,但 live 数字现已不成立(过度报警的时点取样)。**
- live: mystory minds.json `pendingImp:{}`(空,ch164 全反思完)、force=["s130"](1 个); arcsaga force=["c1"](1 个)。报告的"35-44""force=11"是历史高水位快照,**当前查无**。
- 代码隐患**确属真**: selectQueue `[...forced,...].slice(0,K_MAX=8)`,若 forced>8(屠杀 tick 可能)则 forced 尾部被切——**逻辑 bug 成立但稀有**。应改 P1-5/P2-1 定性为"罕发逻辑隐患",而非"live 在发"。

**4. 报告头部「三世界实跑(mystory/arcsaga/saga)」——saga 实为停跑。**
- saga 末章 ch-0007 停在 Jun3 21:12,lock 空、无写者进程。真正 live 的是 **mystory + arcsaga 两世界**。报告正文表格只验了这两个,但头部与"saga 接近理想态"的措辞把已停世界当在跑,**需修正**。

**5. P0-2 措辞偏重(结论对,归因略夸)。**
- "风格父本**旧/冻结** engine、与 bestEngine 无关"不够准: cell 存 cloneGenome(cur),而 cur.engine 自 mutate(evolve:243-244)起是 `{...bestEngine}`+微扰,**带 bestEngine 血缘只是逐代漂移**(实测 cur turnover0.5 vs bestEngine0.75 已分叉)。bug 实质=**沉积按 champ-genome 归格而非 bestEngine,且 bestEngine 永不进 global**——这点确认; 但它更像"缺特性"而非"用了无关的冻结 engine"。结论成立,归因宜收敛。

## 三、报告【漏报】的(补上)

**A.（漏报·补 P1 级）arcsaga(emergent live 世界)一致性 = 4/10、4 处境界/生死矛盾。** 报告把一致性问题框定为 follow 专属、断言 emergent 免疫,**漏了 live emergent 世界同样在腐化设定一致性**(LLM 正文写错境界/把死人写活)。这是比 P0-1 更普适的"prose↔引擎硬事实漂离"缺口,只在 mystory 上被名池碰撞放大。**应单列。**

**B.（漏报·名池设计缺陷,P1 根因）组合名生成器与显式 spawnNames 姓/名碎片重叠 → 必然撞近重名。** make-pack:121-124 与 cfg.spawnNames 共用 surnames/givenNames 字符,导致 萧斩/萧曦、林书同/林舒雅 同世界并存。这是 P0-1 的**真根因**,报告未点出(它归到 follow+模板补血)。

**C.（漏报·无害但与报告"账平"措辞冲突）CharacterEntered=45 ≠ Fell17+Transcended18=35。** 报告称"CharacterEntered44==spawn44(生死账平)"——entered 不等于退场数(幸存者仍在场),措辞"账平"不成立(也无需成立)。无害,但属报告自造的伪不变量。

**D.（漏报·非缺陷,纠报告悲观）global cells 的 eventBias/structureGrowth 演化值是真被消费的。** 既然 eventBias 活线(见修正 1),structureGrowth/turnoverRate/scarcity 等也都在 world-actor.ts:269-273 + pack 被读——报告"进化空转一维"是唯一被误判的维度,其余维度健康,这点报告反而没给足正面信用。

## 四、过度乐观 / 过度报警 汇总

- **过度乐观**: ①"emergent(saga)免疫名册问题/接近理想态"(arcsaga emergent live=4/10 矛盾, 且 saga 已停跑); ②把 CharacterEntered 当"生死账平"。
- **过度报警**: ①P1-1 eventBias 死接线(实为活线,假阳性,应删); ②P2-1/P1-5 的 live 数字(35-44 / force=11 当前不成立,隐患真但非在发)。
- **基本准确**: P0-2、P1-2、P1-3、P1-4、P2-7、P2-9、核心引擎/账目/铁律/QD 引种/deepseek 全部经得起实锤。

## 五、最终一句话裁决

**系统健康、可继续运行,但报告需修正——真问题应核定为 5 个(而非报告的 2 P0+5 应修):P0-1 一致性漂离(根因是引擎名池撞名+prose 漂离硬事实,且跨 emergent/follow 两模式,非 follow 专属)、P0-2 跨世界 bestEngine 永不进 global cells、P1-2 evCursor 跨重启冷读、P1-3 global 文件无跨世界锁、P1-4 defining 黑洞;同时必须撤销报告的 P1-1(eventBias 死接线为假阳性,实为活线)、下调 P2-1/P1-5 为罕发隐患、并纠正"saga 在跑/emergent 免疫"的过度乐观——无致命缺陷,无数据腐化,核心引擎与多写者契约是真健全的。**

**关键文件定位**(均绝对路径):
- P0-1 根因: `/Users/chris0810/Documents/Codex/Novel System/packs/freeform/make-pack.ts:119-127`(名池碰撞)+ `/Users/chris0810/Documents/Codex/Novel System/app/derive-canon.ts`(硬事实)+ `/Users/chris0810/Documents/Codex/Novel System/app/canon.ts`(软层); live 证据 `.novel-output/mystory/canon.json`、`.novel-output/arcsaga/canon.json`
- P0-2: `/Users/chris0810/Documents/Codex/Novel System/app/evolve.ts:104-107`(deposit 取 champ.genome)、`:306-307`(cell 存 cloneGenome(cur))、`:324`(mutate 正确用 bestEngine); live 证据 `.novel-output/global-evolution.json` + `.novel-output/mystory/evolution.json`
- P1-1 反证(eventBias 活线): `/Users/chris0810/Documents/Codex/Novel System/packs/freeform/make-pack.ts:151-153`、`/Users/chris0810/Documents/Codex/Novel System/packs/xianxia-bazi/index.ts:393-394`、`/Users/chris0810/Documents/Codex/Novel System/app/drama.ts:46`
- P1-2: `/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts:210,322` + `/Users/chris0810/Documents/Codex/Novel System/core/services/store.ts:51-53`
- P1-3: `/Users/chris0810/Documents/Codex/Novel System/app/evolve.ts:116-147`
- P1-4: `/Users/chris0810/Documents/Codex/Novel System/app/server.ts:250-263` + `/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts:50-57`