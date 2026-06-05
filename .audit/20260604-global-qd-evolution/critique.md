# 对抗式评审 · 全局 QD 进化升级蓝图

> 评审员把蓝图公式拉到 6 个真实世界数据上实跑, 逐字核对所有代码事实(无伪造)。
> 裁决: **需补 X1-X4 才能施工**(X1/X2/X4 阻塞级)。配套蓝图见 synthesis.md。

---

I have fully verified the blueprint against ground truth. The code-fact claims (line numbers, field names, the wholesale-promote bug, the sim-fitness persistence gap, the dual-writer point, call sites) all check out. But my empirical niche computation across the 6 real worlds surfaced a real flaw the blueprint's "mechanism-level argument" hand-waves past. Here is my adversarial verdict.

---

# 对抗式评审结论: **需补 X 才能施工**(X = 维度 B 分桶塌缩 + 被杀世界 A 维数据缺口 + ⑤的 intent 死接线)

蓝图的代码事实层**经得起逐字核对**——我把它声称的每个行号/字段/铁证都拉了真实数据对过(见末尾"已验证"清单),没有伪造。promoteToGlobal L99 的 wholesale 单冠军病根、global-evolution.json 的 engine 确为全默认+bestFitness 7.53、sim-fitness.json 顶层确无 `present`/`ensemble`(修正 A 属实)、唯一多写者点(longrun.ts:427 saveSimFitness + evolve.ts:104 裸写)、两个 live 写手 PID——全部真实。**架构方向(Multi-task MAP-Elites 搬运)正确,不是过度工程**(见⑤的反驳)。

但有**三个会让"解搁浅"在实测数据上落空或半落空的缺陷**,以及若干实现遗漏。逐条回答你的六问:

---

## ① 真能修好"群像引擎搁浅传不出"吗?——**机制对,但当前阈值下"自动取到它"这一步会断**

顺着蓝图走一遍,用**真实数据**而非直觉:

**A 维(群像规模)有一个致命数据缺口,蓝图自己埋了又没填。** arcsaga 的群像配方实证只存在于 `arcsaga-killed-20260604-181357/`(已 kill)。它的 `sim-fitness.json` 是**冻结的、永不再更新**,且 `has ensemble field? False`(我验证过)。P1 的"自愈"机制(`?? 0` 兜底 + 下次 longrun 补齐)**对死世界永不触发**——死世界没有 longrun 在跑。于是:
- `globalNiche(arcsaga-killed)` 的 A 维 → `present=0` → 落 **`独狼`**,不是 `群像`。
- 而且 promote 的 `isLiveWorldDir` 根本不扫 `-killed-` 目录(我确认 L74 正则),**所以死 arcsaga 的群像 archive 压根进不了 global**,除非 live arcsaga 先把它促进去。

**chicken-and-egg**: live `arcsaga/` 现在只有 `genome.json`(engine `turnoverRate=0.5/structureGrowth=0.7/scarcity=0.9`)+ 一个刚起步的 world.db,**没有 archive.json、没有 sim-fitness.json**(我确认)。要等它自己跑够 8 章 × 数轮、attein `present>=7 且 survivalRatio>=0.4` 才落进 `cells["群像×网状"]`。**这是能成立的**(live arcsaga 的 engine 就是群像配方,跑起来该进群像格)——但蓝图 §8.5 的成功判据写的是"arcsaga 的配方永久在册",给读者的印象是"迁移当天就有",实际是"等 live arcsaga 自己跑出来"。**这不是 bug,是蓝图叙事与施工现实的落差**,会让你验证时扑空。

→ **补丁 X1**: 要么(a)承认 MVP 上线时 `cells` 里**不会**立刻有群像格,验证判据改成"live arcsaga 跑满 N 轮后落进群像格";要么(b)加一次性 **seed 脚本**:从 `arcsaga-killed/archive.json` 取那 6 格冠军基因 + 手算 A 维(开 world.db 数 present,或直接人工标 `群像`),注入 `cells["群像×网状"]` 作初始精英。后者才兑现"立刻在册"的叙事。蓝图 §6.3 说"零停机迁移自动合成 legacy cell"——legacy cell 是**旧的全默认 7.53 文笔冠军**,不是群像配方,合成它对解搁浅毫无帮助。

---

## ④ niche 维度样本过稀 / 存档空洞 / 不正交——**B 维当前会塌成 2 桶,正交性不成立(实测)**

这是我最硬的发现。蓝图 §2.2 用"机制级论证"声称文笔冠军落 `(独狼,线性)`、群像落 `(群像,网状)`,**四象限都真实**。我把 §4.1 给的 `structureScore` 公式跑在**全部 6 个有 sim-fitness 的真实世界**上:

```
arcsaga-killed   pol=0.065 chainRatio=1.00 npat=3 => ss=0.453 网状
mystory          pol=0.103 chainRatio=0.50 npat=2 => ss=0.281 多线
qunxiang-killed  pol=0.144 chainRatio=0.71 npat=6 => ss=0.484 网状
saga-pre-fixes   pol=0.089 chainRatio=0.71 npat=5 => ss=0.458 网状
saga-prenamefix  pol=0.107 chainRatio=0.75 npat=3 => ss=0.398 多线
saga-ruined      pol=0.133 chainRatio=0.71 npat=4 => ss=0.441 多线
```

**B 维 6 个世界全部落进 `{网状:3, 多线:3}`,零个 `线性`。** 而且 `polarization` 真实跨度只有 **0.065–0.144**(占 ss 权重 0.5,但变化幅度 < 0.04,几乎是常数),`structureScore` 几乎**完全由 `chainTypeRatio` 单独决定**。这暴露三个问题:

1. **存档空洞**: `线性` 桶在真实数据上**永远空**。9 格里至少 3 格(独狼/小队/群像 × 线性)结构性死格。蓝图 §2.0 修正 B 自己警告"15 格常年填不满",却没意识到**自己选的 B 维阈值会先验排除一整列**。
2. **B 维不正交于"它想区分的东西"**: `chainTypeRatio` 的分母是 `Σ sift.patterns`,而几乎所有世界都有复仇闭环/崛起陨落,`chainTypes` 名单里 4 个有 3 个是高频模式 → 比值天然偏高 → 大家都 ≥0.4。它**没在区分"网状 vs 线性"**,在区分"patterns 字典里恰好命中我列的 4 个名字的比例",这是测量伪影。
3. **关键:文笔冠军和群像冠军在 B 维可能落同一桶。** 蓝图断言文笔冠军 `structureGrowth≈0` → "连锁少" → 线性。但 `chainTypeRatio` 算的是**已成链的 patterns 占比**,跟 `structureGrowth` 旋钮**没有直接因果**——一个低 structureGrowth 的文笔世界照样会有复仇闭环(只要有人陨落+雪恨),`chainRatio` 照样高。**§2.2 第 1 点"文笔冠军 → B=线性"这个机制链在数据上断裂**:mystory(turnover=1 风格的世界,present 低)算出来是 `多线`,不是 `线性`。

→ 这直接**威胁解搁浅的核心契约**:如果文笔冠军和群像冠军在 (A,B) 空间落进**同一个 cell**(例如都 `小队×多线` 或都 `群像×网状`),那"不同 cell 不可互覆盖"就保护不了群像配方——高 fitness 文笔冠军照样把它顶掉。蓝图把全部赌注押在 A 维拉开二者,但 A 维又有 X1 的数据缺口。

→ **补丁 X2**(二选一,推荐都做):
- **(a) 重定 B 维阈值用分位自适应**,别用固定 0.2/0.45。复刻 L161 `rhythmBin` 的 34/67 分位法(蓝图 §2.1 自己提了"阈值用历史分位"却在 §4.1 代码里写死了固定值——**代码与设计自相矛盾**)。但分位法要求有历史样本分布,冷启动仍回退。
- **(b) 换 B 维测量**为对 `structureGrowth`/`scarcity` 旋钮真敏感的量:用 `tension.directness`(派系成员间真实负 bond 占比,sim-fitness L153 已算且落盘)+ `liveFactions`(活派系数,需同 A 维一起持久化)替代 `chainTypeRatio`。`directness`/活派系数才是 `structureGrowth` 的直接可观测投影,`chainTypeRatio` 是 story-sifting 的副产品、与引擎旋钮隔了两层。

**A 维同样要验证不塌**:蓝图给的 `群像` 阈值 `present>=7 且 survivalRatio>=0.4`,但 §1.2 自己引的 mystory 实测是 `present=10 / entered=39 = survivalRatio 0.26` → mystory 落 **独狼**(survival<0.25?不,0.26>0.25 → 小队)。而要进 `群像` 需 survival≥0.4,mystory 的 0.26 进不去。**问题**:有没有任何真实世界能达到 survival≥0.4 且 present≥7?现有数据里**一个都没有**(present/survival 全没落盘,无法验证)。这意味着 `群像` 桶**可能和 `线性` 桶一样先验为空**——那群像配方连自己的格都进不去。**这是必须在 T2 落盘后立刻用真实数据验证的头号风险**,蓝图 §8 的 fixture 用的是**人造的 `present:9,survivalRatio:0.5`**,绕过了"真实世界够不够得着这个阈值"的拷问。

---

## ② 单调性(清世界不丢)在 QD 存档下真保持吗?——**保持,这部分设计是对的**

`cells = {...prev.cells}` 基底 + 逐 niche `champ.fitness > ex.fitness` + 派生 bestFitness 从 `max(prev.bestFitness, cells...)` 取 → **C1/C2 成立**。被杀世界的精英靠 prev.cells 留存(这正是它比现状强的地方:现状 L99 也以 prev 为基底,但只有 1 个槽,新冠军会顶掉旧的;新方案 9 个槽分别单调,严格更优)。**确认无反例**。唯一注意:派生 `bestFitness` 用 `+bestFit.toFixed(2)`,而 cells 内 fitness 不截断,二者口径要一致否则面板曲线会和 cell 值对不上——小事,记一笔。

---

## ③ 向后兼容 + 并发落盘——**兼容性 OK;并发有一个蓝图没说的残余窗口**

**兼容性**: 我确认 `loadGlobal` 是 global-evolution.json 的**唯一 reader**(server.ts:198、longrun.ts:70、evolve.ts 内部),无第三方解析器。保留 `genome`/`bestFitness` 派生 + `cells:{}` 兜底 → 旧文件零迁移可读、server `/api/evolution` 透传不破。**确认无破坏点**。

**并发**: T0 原子写(tmp+rename 同目录)消灭半截读,对。但蓝图 §6.2 A3 的论证有个**漏洞**:它说"后写者覆盖的是已含对方贡献的超集 → 单调不破"。这只在**后写者的 `loadGlobal(prev)` 读到了前写者已 rename 完成的文件**时成立。两写者**各每 8 章异步**触发(我确认 cadence),存在经典 read-modify-write 竞态:
- W1 读 prev(无 W2 贡献)→ 算 → 
- W2 读 prev(无 W1 贡献)→ 算 → W2 rename 落盘(含 W2)
- W1 rename 落盘(含 W1,**不含 W2**)→ **W2 的本轮 niche 贡献丢失**

不会 crash、不会半截,但**会丢一次 promote 的增量**(下一轮 W2 再 promote 时,只要它的世界 archive 冠军没变,会重新带上 → **最终一致,但有最长一个 cadence(~1-2h)的窗口期某 niche 退化**)。蓝图说"原子写+prev 基底已足够,加锁延后到 T4"——**对 MVP 可接受**(丢的增量下轮补回),但**§6.2 把它说成"单调不破"是不准确的**,应改为"最终单调,瞬时可丢一轮增量"。若要严格单调,T4 的 `O_EXCL` 锁不是可选而是必需。

→ **补丁 X3**(轻量,可不上锁): promote 落盘前**再 load 一次**做 last-mile merge(`final = mergeNiche(freshLoad().cells, myCells)`),把 read-modify-write 窗口从"整个 promote 计算时长"压到"load+merge 几 ms"。比全局锁简单,消掉绝大部分竞态。

---

## ⑤ 过度工程?有没有更简等效方案?——**不是过度工程;但你提的 per-knob 方案确实是更好的踏脚石,蓝图漏了**

你点名的"engine 各旋钮独立取全局最优(per-knob)不上完整 QD 也能解搁浅"——**这个直觉很准,而且蓝图完全没讨论它,是个真空白**。

分析: 当前 `bestEngine`(evolve.ts:31/241)已经是**世界内** engine 单点爬山、与风格格解耦。最小改动是把它**提升到全局**:global 存一份 `bestEngineGlobal`,promote 时按 `simFit` 取所有世界 `ledger.bestEngine` 的最大者,loadGenome 新世界用它起步。**这比完整 2 维 QD 少写 ~80% 代码,且不需要 A/B 维持久化、不需要分桶、没有空洞/正交问题。**

**但它解不了搁浅**——而且理由正是蓝图 §1.3 的核心:`bestEngine` 是**单标量 simFit 单点最优**,文笔冠军的 simFit 若 > 群像配方的 simFit,群像 engine 照样被丢。per-knob(每个旋钮独立取全局最优)更糟:它会把 `turnoverRate` 取自某世界、`structureGrowth` 取自另一世界,**拼出一个从未在任何世界共同验证过的弗兰肯基因**,破坏配方的内部一致性(群像配方是"低 turnover + 高 structureGrowth + 高 conflict"的**联合**,拆开各取最优会失配)。

**结论**: per-knob 不是等效替代(解不了搁浅 + 破坏配方完整性),但 **per-engine-genome 全局化是有价值的 T0.5 踏脚石**——它零新维度就能让"被验证的整份 engine 配方"跨世界传,虽然仍是单冠军(不解搁浅),但能**先验证"跨世界传 engine"这条管线通不通**,再上 QD 分桶。蓝图应把它列为 T1 之前的 sanity 踏脚石。**不上完整 QD 解不了搁浅这一点,蓝图论证正确,不是过度工程。**

---

## ⑥ 实现路径有无遗漏改点——**有 3 个**

1. **`loadGenome` 的 `intent` 是死接线(dead wire)**。我确认**唯一**会因 `!existsSync(genome.json)` 走进"取全局基因"分支的调用点是 `longrun.ts:69 evoGenome = loadGenome(ROOT)`。而 §⑦ T3 说"给新世界创建处传 intent"——但 longrun.ts:69 **拿不到任何意图**(ROOT 只是个目录名,longrun 不知道这是不是群像世界)。蓝图 §附表说改 longrun.ts L69-70 传 intent,**但没说 intent 从哪来**。真实来源只能是:(a)worlds 注册时写进某个 config(冷启动 UX 的槽位),longrun 启动时读;(b)环境变量 `NOVEL_WORLD_INTENT`。**蓝图 §5.2 把 intent 当成"调用方自然就有"的东西,实际整条 intent 数据链不存在,要从 worlds 注册 → config 文件 → longrun 读取 全程新建**。这是 T3 真正的工作量,被一笔带过。→ **补丁 X4**: T3 必须包含"intent 持久化到世界 config + longrun 启动读取"的完整链路,否则 `intent` 永远是 `undefined`,退化成 D1,**传承闭环永不闭合**。

2. **`globalNiche(D)` 对每个 live 世界要读 `loadSimFitness(D)`,但 sim-fitness.json 是按 ROOT 单写者落盘的**——promote 在世界 X 的进程里跑,要读世界 Y 的 sim-fitness.json。这是**跨世界纯文件读**(不是读 db),无 wal 一致性问题(蓝图 P1 正确规避了 P2 的开别人 db),但要注意:Y 若正在被自己的写手 rename sim-fitness.json,X 可能读到旧版——可接受(niche 是慢变量)。**蓝图没明说 globalNiche 是跨世界读别人的 sim-fitness**,读者可能误以为只读自己的。记一笔即可,非阻塞。

3. **`computeSimFitness` 加 `ensemble` 字段会改 `SimFitness` 接口,server.ts:198 透传 `sim: sf ? {...}`** 是白名单字段(只挑 total/sift/tension/novelty),**不会自动带出 ensemble**——P1 落盘没问题,但若想在面板看 ensemble 要额外加。非阻塞,提一句。

4. **`at: champ.at` 可能 undefined**: §4.1 代码 `at: champ.at`,但 `champ` 是 `worldCells.reduce(...)` 取的 Cell,Cell.at 存在(L33),OK。但 legacy cell 写 `at:"v0"` 而 GlobalCell.at 是 string,一致。无问题。

---

## 已验证的事实清单(逐字核对,无伪造)

| 蓝图声称 | 核对结果 |
|---|---|
| promoteToGlobal L99 跨所有世界所有 cell 取全局 max、wholesale | ✅ evolve.ts:99 确如此 |
| global-evolution.json engine 全默认 + bestFitness 7.53 | ✅ 真实文件确认 |
| arcsaga-killed 6 格群像配方 turnover=0.5/structG=0.5-0.75/conflict=1.0-1.45 | ✅ 全部数值精确匹配 |
| sim-fitness.json 顶层无 present/ensemble(修正 A) | ✅ keys=['atCh','novelty','sift','tension','total','vol'],无 ensemble |
| present/survivalRatio 在 computeSimFitness 算了但没落盘 | ✅ factionTension L130 算 present,未进 SimFitness 接口 |
| slm 在 evolution.json.scores[](维度 C 可直接取) | ✅ evolve.ts:262 确实写 slm |
| 唯一多写者落盘点 = 裸 writeFileSync global | ✅ evolve.ts:104 裸写,per-world 有 longrun.lock(longrun.ts:49) |
| 两 live 写手 | ✅ PID **79591**(mystory,05:45)+ **93837**(arcsaga,18:14)。注:蓝图 §6.1 说 mystory 5:45/arcsaga 6:14 起,与 ps 一致 |
| loadGlobal 是 global 文件唯一 reader | ✅ 仅 server/longrun/evolve 内部 |
| server.ts:198 /state 透传 loadGlobal | ✅ 确认,且 sim 是白名单透传 |

---

## 最终裁决

**需补 X 才能施工**,X = 下列 4 个补丁,其中 X1+X2 是**阻塞级**(不补则"解搁浅"在真实数据上落空):

- **X1(阻塞)**: 被杀世界 A 维数据永不落盘 → 群像配方进不了 global 或落错桶。要么改验证判据为"等 live arcsaga 跑出来",要么写一次性 seed 脚本从 arcsaga-killed 注入 `cells["群像×网状"]`。
- **X2(阻塞)**: B 维固定阈值在 6 个真实世界上塌成 `{网状,多线}` 两桶、`线性` 先验空、`chainTypeRatio` 与 `structureGrowth` 旋钮无因果。改用分位自适应阈值(§2.1 自己提了但 §4.1 代码写死,自相矛盾)+ 换测量为 `directness`+活派系数。**并在 T2 落盘后立刻用真实 present/survival 验证 `群像` 桶不是空桶**(现有数据 mystory survival=0.26 够不到 0.4 阈值,高度可疑)。
- **X3(建议)**: promote 落盘前 last-mile re-load merge,消掉 read-modify-write 竞态(§6.2 "单调不破"言过其实,实为最终一致+瞬时丢一轮)。
- **X4(阻塞 T3)**: `intent` 数据链不存在。longrun.ts:69 拿不到意图,必须新建"worlds 注册→config→longrun 读取"全链路,否则传承闭环永不闭合,T3 退化成 D1。

**T0(原子写)可立即无条件施工**,零风险。**T1(双格式兼容+legacy 合成)可施工**但要知道 legacy cell 是文笔冠军、对解搁浅无贡献。**T2/T3 必须先补 X1/X2/X4**。

架构方向(Multi-task MAP-Elites)正确,不是过度工程,per-knob 替代解不了搁浅——这三点蓝图判断无误。问题全部出在**把"机制级论证"当成了"已验证",而真实数据(6 个世界的 niche 分布、被杀世界的冻结数据、intent 的空数据链)在三个关键处不支持那套论证**。补齐 X1/X2/X4 后可施工。

相关文件: `/Users/chris0810/Documents/Codex/Novel System/app/evolve.ts`(L72/75/80-105/53-59)、`/Users/chris0810/Documents/Codex/Novel System/app/sim-fitness.ts`(L24-31 接口/L130 present/L208 computeSimFitness)、`/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts`(L69 intent 死接线/L426-427 sim 落盘)、`/Users/chris0810/Documents/Codex/Novel System/.novel-output/arcsaga-killed-20260604-181357/`(群像数据源,sim-fitness 已冻结无 ensemble)、`/Users/chris0810/Documents/Codex/Novel System/.audit/20260604-global-qd-evolution/synthesis.md`(蓝图)。