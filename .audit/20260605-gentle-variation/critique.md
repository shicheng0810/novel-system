# 温情变化驱动器 · 三方设计的对抗批评要点(经 ground-truth 复核)

> 复核日期 2026-06-05。所有行号/阈值已对 `app/longrun.ts`、`app/drama.ts`、`app/sim-fitness.ts`、`app/evolve.ts`、`core/runtime/world-actor.ts`、`core/services/store.ts`、`core/domain/events.ts` 实测核对；坍塌实证对 `.novel-output/renjian/chapters/ch-0060…0080.md` + `genome.json` + `sim-fitness.json` 实测核对。
>
> 判定图例：**[MUST]** = 落地必须吸收的批评(否则编译失败 / 本末倒置 / 破温情)；**[SHOULD]** = 强烈建议；**[REAL]** = 设计声称属实、可放心采纳；**[FYI]** = 背景。

---

## 0. 跨三方的共识铁证(先立事实地基)

- **坍塌是真的、且比任一设计假设的更重 [REAL/FYI]**。renjian ch60–80 是**连续 21 章**锁死在同一批静物：青绸/粥沸/旧物/裂纹/碗/铜钱/炉火/姜汤/炭火/瓷/灰/茶烟。设计A假设阈值病态点在「≥3 章」，实测触底 21 章——痛点成立，且现有 GENTLE outline 提示(longrun.ts:166 beatSpec「全章不可困守一处一物」+ :169「本章必须把镜头挪开」)**已在跑且明显失效**，实测背书「敌不过饱和 bible 的牵引」。
- **现有 novelty 指标对 motif 坍塌是盲的 [MUST·决定性]**。renjian `sim-fitness.json` 实测 `novelty=0.992`(近乎满分)，可 21 章肉眼坍塌。原因：`historicalNovelty`(sim-fitness.ts:194)用 **4-gram Jaccard over 全文**——它把「碗→粗陶→瓷响」这类近义词替换当成新颖度，而场景其实冻结。**结论**：① 任何「warmFit/温情筛选」若复用现有 novelty，会被它的盲点骗过，必须新造一个**场景/意象层**的多样性信号(2-gram 名词指纹，而非 4-gram 全文)；② 这也实测证伪了「字面 avoid 词表能拦住」——LLM 已在用近义词规避(ch64「裂纹停在半句」→ch73「裂纹渡来日光」)。
- **温情 engine 基因确实被锚住了 [REAL]**。renjian gen4 `conflictRate=0.6 / eventBias=0.66 / structureGrowth=0.1`——GENTLE 的 evolve 门控(evolve.ts:326)与 drama 门控(drama.ts:42 `heat=gentle?0`)确在生效，世界没被推回戏剧。**所以坍塌不是「世界太冷」的锅，是「叙述取景层」的锅**——这定位了正确的发力层：scene/outline/secPrompt/bible，而非 engine 旋钮。

---

## 1. 设计A(场景与世界生态主动轮换 / gentleDirector)

### [MUST] 编译级 BUG ×2 —— 照抄跑不起来

1. **`crisisInject` 这个变量在 longrun.ts 里根本不存在**。设计 §3.2 写 `if (sh.worldEvent) crisisInject = sh.worldEvent;`、§四写「longrun 把它拼进 `crisisInject`」——实测 longrun.ts 只有 `crisisBase`(:327) 和拼好的 `crisis` 数组(:345)，**无 `crisisInject`**。直接引用 = undefined，编译失败。**修**：要么显式 `let crisisInject=""` 并改 :345 数组纳入；**更应**(见下条 ①)新开独立 `ambience` 字段，不塞进 `crisis`。
2. **`recent[]` 是 in-process、resume 后为空，却被设计 §二列为「检测主信号源」**。实测 longrun.ts:217 `const recent: string[] = []`，仅 :418 push。renjian 这种 80+ 章世界任何重启(本环境常规重启 = `pkill -9`，见 MEMORY)后 `recent=[]`，director 头几章拿不到信号、`sameStreak` 归零——**恰在最需要它的长寿坍塌世界里、重启后失明**。设计自身又说要落盘 `gentle-director.json`，**自相矛盾**。**修**：检测窗口**必须走落盘 `store.readRecentChapters(db, worldId, N)`**(标题+正文都拿得到，store.ts:173 实测可用)，彻底删掉对 `recent[]` 的依赖；`lastMotifs/sameStreak` 落盘。顺手可用 `listChapters`(store.ts:177)回填 `recent[]` 修那个独立 resume bug。

### [MUST] 本末倒置 —— 把「主因」标成「可选」

设计 §3.3 自己点名 summary 自反馈(rollSummary 把碗/裂纹回灌 bible，再经 bibleEcho→outline→每个 secPrompt 扩散)是**主因**，却把修它标成「可选但强烈建议」。实测链路成立：bible 每 8 章 rollSummary 一次(:435)，沉淀的静物经 `bibleEcho`(:351→:355) 进 outline(:169) 和每段 secPrompt(:190)。**director 只前置派新场景，但 secPrompt 里 bible 仍在念碗/裂纹，两股力对拉，实测 bible 那股更强。** 修：**§3.3 升为「必做的第一性改动」**，且应**单独先上、做 A/B**(1 行改动、动主因、零新机制、零气脉风险)——很可能它单独就能缓解一半。

### [MUST] 气脉过度变化 —— 缺阻尼，会把温润切成走马灯

温润命脉是「气脉相承、连贯不跳」(beatSpec :166 明写)。设计的强制跳场景与之天然张力，三处需阻尼：
- **阈值 S=3 偏激进**。温情散文里 4–5 章在一处院落慢写人情是正常态；S=3 每 3 章强拽出门，反而破坏连贯。**修**：S 提到 **4–5**，且加「软着陆」——首次触发只用最轻干预(推时令 / 加一个路人)，连续仍黏住才升级到换场景域。
- **`timeShift`+`domain`+`worldEvent` 三维同切，变化量过猛**。设计只给 worldEvent 设了递增概率(`p=min(0.6,(streak-S)*0.25)`)，domain/timeShift 却无条件全切。**修**：一次只动一个维度(优先级 时令 < 新面孔 < 换场景域 < worldEvent)，streak 越深才叠加。
- **「确定性轮询 DOMAINS」产生机械感**。固定环 出门→访友→上山→渡口 轮转，长跑后读者会察觉节律，温润最忌机械。**修**：domain 候选先按「从当前 location/在场人物自然能去哪」过滤(去渡口要有由头)，再用 tick 做 tiebreak(保留确定性)。

### [SHOULD] worldEvent 仍带 prose 层戏剧反弹 —— GENTLE 门控管不到

引擎层 worldEvent 确实**结构上不引冲突**(见下 REAL)，但**文案**「渡口新到一船远客，带来异乡的见闻与货物」「远方故人捎书将至」注入后，LLM 在 prose 里极易自发把「远客/故人」升级成冲突源。GENTLE 的 evolve/drama 门控管的是 engine 旋钮，**管不到 crisis 文本语义**。**修**：① worldEvent 文案剔除一切「会与主角互动的新意图体」，只留「世态流动」描述(「街市比平日热闹三分」「谷场上人语喧阗」可，「带来见闻/捎书将至」删)；② worldEvent **不要拼进 `crisis` 槽**(那是「世界大事」标签，LLM 默认按「事件/冲突」理解)，新开 `ambience`(时令风物)字段，在 secPrompt 以「本章风物背景」注入。

### [SHOULD] 开环派场景 —— prose 会抗命，需事后校验闭环

实测 LLM 已用近义词规避字面 avoid，纯字符串 avoid 拦不住语义同物。**修**：① avoid 给「类」而非「词」——把高频 motif 归到「同一处场景/同一件旧物」语义类，指令改「本章主场景须离开【室内/灶房/同一旧物特写】，转到【户外/人群/路途】」；② 加事后闭环：落盘后检测下一窗 Jaccard 是否真掉到 <0.5，连派 2 章仍未挪开则升级干预(强制把人物物理移出当前 location)。

### [REAL] 设计A 已核验属实、可放心采纳的部分

- **不引戏剧的结构隔离 [REAL]**：director 不调 `step()`、不 emit `WorldEvent`(longrun 唯一 step 入口是 `guardedStep`，director 不在内)→ `computeSimFitness` 输入零变化，simFit 不被污染。worldEvent 走 `crisis` 文本通道、不带 `factionShifts`/`valence`。实测 `CharacterFell` 要 `fallDebt>=1` 且陨落者须 `s`-前缀动态角色(world-actor.ts:471-475)、`FactionDissolved` 要 `factionRelations<=-6`(:412)——worldEvent 两条都不碰，**结构上不可能触发陨落/覆灭**。
- **数据/复用属实 [REAL]**：`store.readRecentChapters`(store.ts:173)、`saveSnapshot` 整存 props 使任意键 round-trip(store.ts:68-72 `JSON.stringify(snap)`)、`gramSig`/`jaccard`(sim-fitness.ts:182/189，行号精确命中、可直接 import 复用)、`withLock` 临界区(longrun.ts:285)可追加写——全部属实。
- **与四道 GENTLE 门控不冲突 [REAL]**：drama `heat=0`(drama.ts:42)、evolve 不奖 simFit(evolve.ts:326)、ledger.avoid 与 director.avoid 两套互不打架、arc-select 仅 `n===0`(longrun.ts:242)与 director 的 `n≥1` 时间不重叠。且设计正确地让 director **不碰 tuning**，不重蹈 MEMORY 记的「drama.ts 每章覆写 tuning 第五梯度」覆辙。
- **不依赖 StageCommitted [REAL]**：critique 原问「是否假设了不存在的 StageCommitted 管线」——设计A 数据依赖是 recent/readRecentChapters/crisis/props，**不碰 StageCommitted**，此指控不成立。

---

## 2. 设计B(温情故事筛选 / warmFit)

### [REAL] 数据声明大体属实 —— 这是 B 最强处

- StageCommitted/Entered/Transcended/Fell 计数取自 renjian(真 GENTLE 世界，非拿戏剧世界冒充)[REAL]。
- `chosenCandidateId` 的 `-ally-/-clash-/-avenge-` 正则信号充足、可用 [REAL]。
- **接入点真实可行 [REAL]**：computeSimFitness 块(longrun.ts:440-445)在 `EVOLVE` 下**无条件**跑(非 GENTLE-gated)，`spf.snapshot` 与 `recentCh` 均在作用域内 → `warmFit`/`saveWarmFit` 可在此处平行 slot，且 evolve.ts 已有 GENTLE 分叉(:326)可接 warmFit 入温情 fitness。

### [MUST] 两条隐藏假设会把温情偷偷推回戏剧

1. **StageCommitted 没有结构化 `scene` 字段 [MUST]**。实测 `StateDelta`(events.ts:9-13)= `{characterId?, set?:Record<string,unknown>, note?}`，StageCommitted payload(events.ts:24)= `{stageNumber, chosenCandidateId, deltas, summary}`——**无专用 scene/location 字段**。可用信号只有 candidate `summary` 文本 + `set` 里的零散键(如 `roleKind`/`narrativeStress`)+ candidate-ID 正则。设计若声称从 `deltas[].set.scene` 读场景，是**假设了不存在的字段**。**修**：warmFit 的场景信号应建在 candidate summary 文本 + chosenCandidateId 正则之上，**与设计A 的 chapter-motif 指纹合流**(见综合 §T2)，而非幻想的结构化 scene。
2. **warmFit 若度量「冲突/张力质量」就背叛温情 [MUST]**。现有 siftStories 的链全是复仇闭环/崛起陨落/巨变连锁/派系覆灭(sim-fitness.ts:60-108)——这是**戏剧链**。warmFit 绝不能复用这套打分，否则进化会把温情世界往「有戏」推。**修**：warmFit 只度量**温情专属的好**：关系升温(bond 正向累积)、人情往来频次、场景/意象多样性、宁静弧的完成度——明确**不含**任何 valence<0 / 兴亡 / 张力项。

### [MUST] 对场景坍缩的疗效被高估

warmFit 是**慢回路**(每 8 章 evolveOnce 折进基因)，而坍塌是**逐章 prose 现象**。即便 warmFit 把「场景多样性」纳入适应度，它影响的是**下一卷采样参数**，对**当前 21 章的逐章取景**毫无即时约束力。**修**：warmFit 是 T3 根治(让进化长期偏好多样)，**必须**配 T1/T2 的逐章前置干预(scene 指令 + motif 检测)，单靠 warmFit 治不了坍塌。**这条决定了三层分工**：T1 兜底逐章、T2 检测+派场景逐章、T3 warmFit 慢回路根治。

---

## 3. 设计「I」(ground-truth 自陈 / 三方共用的事实底座)

[REAL] 该底座的关键断言全部复核通过：`step()` 经 `saveSnapshot` 整存 `snapshot.props`、任意 app 写的 prop 存活；`crisis` sticky(仅 story/faction 事件覆写)；`recent[]` in-process 携近章标题但 **resume 为空**(此点被 I 一笔带过、被批评 1 揪出，见 1.MUST-BUG2)；GENTLE 管线 / `tuning` 通道 / `scene` 注入点均确认存在。**唯一须警惕**：I 把 `recent[]` 当稳态信号源陈述，掩盖了 resume 盲点——综合方案不得沿用。

---

## 4. 必须吸收的批评点清单(给综合蓝图打钩用)

| # | 批评点 | 级别 | 落到综合哪层 |
|---|---|---|---|
| C1 | `crisisInject` 不存在 → 新开 `ambience` 字段 | MUST | T1+T2 消费侧 |
| C2 | `recent[]` resume 为空 → 检测改走 `readRecentChapters`，状态落盘 | MUST | T2 检测 |
| C3 | bible 自反馈是主因 → 钝化 rollSummary 升为「第一性、单独先上、A/B」 | MUST | T1(第一刀) |
| C4 | 现有 novelty(4-gram)对 motif 坍塌盲 → warmFit/检测须用 2-gram 名词指纹 | MUST·决定性 | T2+T3 |
| C5 | 字面 avoid 拦不住近义词 → avoid 给「类」+ 事后 Jaccard 闭环 | MUST | T2 |
| C6 | worldEvent 文案带 prose 戏剧反弹 → 剔除「新意图体」+ 不入 crisis 槽 | SHOULD→MUST | T2 |
| C7 | 气脉过度变化 → S=4–5 + 单维递进 + 软着陆 + 候选按 location 过滤 | MUST | T2 |
| C8 | StageCommitted 无结构化 scene 字段 → 信号建在 summary+candidateId+chapter-motif | MUST | T2+T3 |
| C9 | warmFit 不得复用戏剧 siftStories；只度量温情专属好 | MUST | T3 |
| C10 | warmFit 是慢回路，治不了逐章坍塌 → 必须配 T1/T2 前置干预 | MUST | 分层依据 |
| C11 | director 不碰 tuning(避第五梯度) / 物理隔离冲突源(不写 factionShifts/负 valence/Fell) | REAL·保持 | T2 全程 |
| C12 | 只在 GENTLE 启用，爽文零变更 | REAL·保持 | 全层 |
