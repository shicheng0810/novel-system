# 温情自进化完整蓝图(可施工)
*2026-06-05 · 首席架构师综合 5 路调研(fitness / 度量 / 变异 / 现码 / prior-art) · 落点全在 app 层, 爽文世界字节级零变更*

---

## 一句话结论

renjian 实测 `conflictRate 0.6→1.05` 的根因是**三个梯度同时指向戏剧 + 一个棘轮**(simFit 数值奖冲突 / mutate prompt 文字喊"提升戏剧性" / simReflect 喊"密度低→升冲突" / bestEngine 单调记最戏那卷当父本)。`NOVEL_STYLE=温润` 只改了笔法与节拍(longrun.ts:36/39), **从未触及 fitness/变异/选择**, 所以进化把温情向基因拖回戏剧。修法不是"降权/反向"而是**把这四个梯度整体翻向温情**: ①simFit→warmFit(正向定义温情, 不取戏剧之负); ②warmFit + 偏人物 rubric 双腿承载温情质量; ③符号 warmFit(F 轨, 抗刷分护栏)+ LLM 温情 rubric(R 轨, 软方向)双轨解耦; ④mutate/simReflect 温情版 + engine 软上限 + 锚回拉防漂; ⑤critique 6 键重定义键义(不改结构); ⑥pickTarget 收缩到温情语气格; ⑦统一 `GENTLE` 开关, `GENTLE=false` 全路径逐字保留。**载荷性事实(决定全案成立): 模拟层里 bond 由 `scarcity×conflictRate` 机械侵蚀为负(world-actor.ts:360/464), 故"奖 bond 暖"天然就是"罚高冲突", 闭环在引擎层自洽, 非靠口号。**

---

## ① 问题诊断: 自进化只奖戏剧 → 温情向基因被推回戏剧

### 1.1 三个推力 + 一个棘轮(全部已在码中定位)

| 推力 | 位置 | 现状行为 | 对温情的伤害 |
|---|---|---|---|
| **simFit 度量** | sim-fitness.ts:60-234 | `siftStories` 7 模式全负向(复仇闭环/崛起陨落/派系覆灭/巨变连锁…), `factionTension` 奖极化+正面交锋+兴亡密度 | 温润世界 conflictRate 低→`CharacterFell/FactionDissolved/VengeanceResolved` 变少→`siftScore`+`tension.score` 双塌→simFit 低 |
| **fitness 闭环** | evolve.ts:316-318 | `0.42·llm+0.18·obj+0.12·cons+0.28·simFit`, simFit 占 28% | 爬山 `argmax fitness` 自然选高 simFit=高冲突的基因 |
| **mutate prompt** | evolve.ts:266 | 末句"目标同时提升文笔质量与「世界涌现的**戏剧性/丰富度/群像存活**」" | 变异 LLM 被文字直接导向加冲突 |
| **simReflect** | evolve.ts:340 | `sift.score<4 → "戏剧密度低→宜升 conflictRate/eventBias"`; `tension.score<4 → "升 structureGrowth/scarcity"` | 温情世界 sift/tension 天然偏低=被持续误诊为"病"→反复推高冲突 |
| **棘轮(bestEngine)** | evolve.ts:315 | `simFit > bestEngine.sim` 单调记"最戏那卷"engine, 下卷 mutate 以它为 base(343) | conflictRate 逐卷只升不降, 触顶后在中性区震荡 |
| **rubric 错配** | evolve.ts:206-207 | `freshness 0.28 / hook 0.18` 主导 | freshness=新鲜猎奇、hook=悬念钩, 恰是 GENTLE 章末**明确不要**的(longrun.ts:39 章末要余味非悬念) |
| **pickTarget 探索** | evolve.ts:187 | `for (const t of TONES)` 探索全部语气含热血/诙谐/悬疑 | novelty 主动给温情世界派"本卷偏热血"的 styleDirective, 直接冲突基调 |

### 1.2 关键事实(决定方法论)

- **事件流里 0 个正向事件类型**(events.ts:16-43 全 fall/dissolve/split/vengeance/transcend)→ 温情质量**无法靠"反向 siftStories"度量**, 必须换信号源(bond 账本 + narrativeStress + LLM rubric)。
- **bond 由冲突机械侵蚀**(world-actor.ts:360 `bond -= scarcity·conflictRate·0.4·(1-niche)`; 464-465 宿敌 `bond -= 2`)→ **"奖 bond 暖"= 引擎层"罚高冲突"**, warmFit 是真正的反冲突梯度而非装饰。
- **narrativeStress 严格 `[0,1]`**(world-actor.ts:65 clamp)→ 可直接用"带状"度量"中低位有起伏"。
- **bestEngine 全局污染**: depositWorldArchive(evolve.ts:101-111)按 turnoverRate×structureGrowth 分 niche, 温情 engine(低 turnover/低 structG="低代谢×平")会与爽文世界**抢同格**, loadGenome 无 intent 时取全局 fitness 冠军(64)→ 温情世界联网被爽文 engine 反向拉。

---

## ② 温情 fitness 公式

**总纲: 不降 simFit 权重、不反向, 而是 GENTLE 时把 simFit 这一项整项替换为 warmFit, 权重结构 28% 不动。** 理由: 28% 是"世界涌现质量"槽位(好东西), 病在度量内容不在权重; 置零=退回纯作者层=关掉模拟层自进化; 反向(高戏剧扣分)会催生"全推正 bond+零应力"的死水寒暄反极坍塌, 同样模式坍塌。

### 2.1 warmFit(温情密度) —— 全零 LLM, 复用已有但未被度量的正向信号

新增 `computeWarmFitness(snapshot, events, chapters, prevBondSnap, vol, atCh, windowN)`(sim-fitness.ts), 输出与 `SimFitness.total` 同量纲 `0..10`:

| 信号 | 取处 | 定义 | 温情含义 |
|---|---|---|---|
| **W1 联结密度 bondWarmth** | `snapshot.characters[*].props["bond:<id>"]`(minds.ts:18/86 已维护, 正=亲负=怨) | 在场角色对中 `(正bond对数 - 负bond对数)/总对数`, 双向都 ≥2 的成对互认加成 | 人和人之间有没有暖的关系 |
| **W2 联结成长 deepenBand** | 跨窗口比 `prevBondSnap` 同对 bond 的 Δ | `bond:xy` 负转正或显著增正 = 和解/情谊加深(温情弧核心 payoff); 用 `band` 取"有变化"满分 | 关系在积累、在和解 |
| **W3 心境平稳带 calmBand** | `narrativeStress`(已 [0,1]) | `band(avgStress, 0.35, 0.30)`: 中低位满分, 过高(焦灼)与死寂 0 都扣 | 低烈度张力=温情不是零应力 |
| **W4 留存 presenceCont** | 复用 tension 反面 + 在场连续性 | `(1 - volatility) × presenceContinuity`(兴亡越少、存活越连续越好) | 人物长寿、关系能积累 |
| **W5 novelty** | `historicalNovelty`(sim-fitness.ts:194, 原样复用) | 占比与原 simFit 一致 | 防"天天同一场寒暄"停滞 |

**warmFit = 10 × (0.34·bondWarmth + 0.22·deepenBand + 0.18·calmBand + 0.16·(1−volatility)·presenceCont + 0.10·novelty)**

**反 reward-hack 红线**(镜像 sim-fitness.ts:225-229 massacre 折扣): `bondWarmth ≥ 0.95 且 stress 方差 ≈ 0`(人均贴贴、毫无内心起伏)→ `total × 0.75`, 挡"全推正 bond + 零应力"的死水坍塌反极。

> 实现细节: W2 需一份"上窗 bond 快照"做差分。镜像现有 `sim-fitness.json` 写法, 新增 `warm-bond-snap.json`(轻量持久化), longrun 算 warmFit 前读上窗、算后写本窗。仅 GENTLE 世界写, 爽文世界不产生此文件。

### 2.2 温情质量进 fitness: warmFit + 偏人物 rubric 双腿

温情的"好"主要由**人物刻画 + 内在连贯**承载(不是 hook/pacing/freshness)。两条腿:

**腿 A — warmFit 占 0.28**(沿用 simFit 槽位, 结构不动最稳)。
**腿 B — fitnessOf 切温情 rubric 权重**(见 ⑤): character/coherence 主导, hook 压地板。

**fitnessOf_温情 = character·0.26 + freshness·0.22 + coherence·0.16 + dialogue·0.14 + pacing·0.12 + hook·0.10**(和=1.0)

> 注: 两路调研对腿 B 权重略有出入([fitness] 给 `char .26/coh .22/dlg .18/pac .14/fresh .12/hook .08`; [现码] 给 `char .26/fresh .22/coh .16/dlg .14/pac .12/hook .10`)。**采纳 [现码] 版**——理由: ①freshness 0.22 保留"不落套"压力(纯压会让温情滑向陈词), 与 R 轨"避免套路/矫情"同向; ②与 [现码] 的最小 diff 表逐键对齐, 施工一致; ③hook 0.10 已是地板(从 0.18 砍), 足够去悬念化。dialogue 0.14(非 .18)因温情对白少属常态(见 ⑥ objectiveScore), 不必再额外抬。

**合成(GENTLE 分支, 与现状同构只换两内核):**
**fitness_温情 = 0.42·llmFit(温情rubric) + 0.18·objFit + 0.12·consFit + 0.28·warmFit**

> [现码] 另提一版 `0.58·llm + 0.20·obj + 0.12·cons + 0.10·warmFit`(把 simFit 28%→10%、llm 42%→58%)。**不采纳**——理由: 把 warmFit 压到 10% 等于半关模拟层温情进化, warmFit 的"奖 bond 暖=罚高冲突"梯度被削弱 73%, conflictRate 回拉主要只剩 prompt/clamp 在扛, 与"四梯度同翻"原则相悖。**保 28% 同构**是更强的反漂结构。objFit 的 `dialogueRatio≈0.3` 理想对温情略错配但 antiProxy 阈在 0.55, 0.2-0.3 安全, 见 ⑥ 仅微调 objectiveScore 不动权重。

---

## ③ 温情质量度量(F/R 双轨, 抗刷分)

温情**不能**靠单一标量(创意写作 LLM-judge 仅 ~0.51 Spearman / 58% 人一致, 自动评委到不了温情天花板)。唯一可行结构 = **F/R 双轨解耦**:

```
F 轨(符号信号, 廉价, 对生成器盲): = warmFit 的 W1-W5 + 可选文本特征 S1/S4/S7
R 轨(LLM 温情 rubric, 软方向):    = critique 的 character/coherence/dialogue(温情释义)+ 温情五维(可选扩展)
解耦律: R 给进化方向(只 R 的定性反馈进生成提示); F 只算分 + 当反作弊护栏, 绝不进 prompt
采纳判据: R 占优 AND 无 F 信号爆表(Goodhart-veto)
```

### 3.1 F 轨(符号护栏, prior-art 背书)

warmFit 的 W1-W5 即 F 轨主体。可选追加三个**纯文本廉价特征**(读者反应实证正向预测 immersion/liking/empathy, Frontiers 2024):
- **S1 治愈弧**: 章内 sentiment 滑窗拟合 Reagan 六弧, 奖"跌后回升"(man-in-a-hole)/"升跌升"(Cinderella), 罚单调下行(tragedy)。算"结尾相对谷底回升幅度"。
- **S4 慢节奏**: 句长均值偏长+高方差(已有 `sentLenMean`)、描写占比、scene:summary 偏 scene。
- **S7 具体度/valence/TTR**: 平均词具体度 + valence 词典 + 对数 TTR(已有 `ttr`)。

> **S1/S4/S7 暂列为 follow-up, 不进首版 warmFit 公式**——理由: ①需新建 sentiment/concreteness/valence 词典(中文资源工程量大); ②warmFit 的 W1-W5 已是闭环可施工的 F 轨; ③[度量] 明示"任一单独当目标都会被刷穿, 价值全在组合 + 当传感器而非奖励"。首版用 W1-W5, S1/S4/S7 作度量增强留待 T3。

### 3.2 R 轨(LLM 温情 rubric, 改写自 PDS 心理深度五维, 人-人 α=0.72)

首版**复用现有 6 键 critique**(见 ⑤), 经 prompt 释义把 character/coherence/dialogue 打成温情维。**T3 可选升级**为独立温情五维 pairwise 评审:
1. **真切 Authenticity** — 真情实感非套路/矫情
2. **触动 Emotion** — 唤起情绪非廉价煽情
3. **共情 Empathy** — 能否进入角色内心
4. **意境/沉浸 Engagement** — 被氛围裹住(留白与回甘)
5. **留白与人情 Restraint** — 该停的地方停, 关系里有"不言而喻的温度"

### 3.3 抗刷分四道闸(温情自进化最致命的一环)

| 闸 | 机制 | 落点 | prior-art |
|---|---|---|---|
| **A. F/R 严格分离** | 生成 prompt 只得 R 轨定性反馈, **绝不**把 warmFit/W1-W5 数值或公式喂进 prompt; F 由外部纯净代码独立算 | warmFit 算在 sim-fitness.ts(off-prompt), `buildGuidance`(evolve.ts:195)只注 avoid/amplify/directives 文字, **本就不含数值**(已合规) | Hack-Verifiable Environments(pristine external eval code) |
| **B. Goodhart-veto** | R 升但某 F 信号"爆表式"上涨(bondWarmth 突刺/和解事件密度突刺)→ 判刷分、折扣 | warmFit 内 `bondWarmth≥0.95 且 stress 方差≈0 → ×0.75`(已含); antiProxy(evolve.ts:310)继续守长度/重复/对白堆砌 | ODIN(易刷维度只去偏不给奖) |
| **C. 早停/防过优化** | warmFit 是多信号带状奖励(calmBand 中位、deepen 要变化、novelty 防重复、bondWarmth 过载折扣), 非单调"越无冲突越好"→ 避免坍向死水寒暄 | warmFit 公式天然带状(W2/W3 用 `band`) | Goodhart's Law in RL / Scaling Laws for RM Overoptimization |
| **D. 稀疏人审锚定** | 被 B veto 命中 或 每 N 卷采样的章节, 人(作者)二选一/准驳, 回灌锚样本 + 进化记忆(温情避雷/发扬) | 复用现有"议事"+ ledger.avoid/amplify(evolve.ts:332-334), 温情下人审是唯一 ground-truth 注入口 | Picbreeder/qualitative-leap: 纯自评有硬上限会崩 |

> **诚实边界(写进蓝图)**: 温情是最主观维度, R 轨相关性(~0.51)远低于一致性/伏笔(可硬验证)→ 温情**必须**比其他维度更依赖人审锚定, 自动分只配"软建议+防刷护栏"。不承诺"自动量化温情"; 承诺的是"符号护栏接住明显造假 + LLM rubric 给软方向 + 人审注入 ground-truth"三者组合(已是 prior-art 天花板)。

---

## ④ 温情变异 steer(mutateGenome / simReflect 温情版 + 基因防漂)

四处推力须**协同翻转**——只改一处会被其余三处中和(这正是当前"震荡"而非"收敛"的机理)。

### 4.1 mutateGenome 温情版(evolve.ts:260-285)

函数加 `gentle: boolean` 形参(GENTLE 透传)。两套目标句 + 旋钮取向:

- **目标句**(替换 266 末句"提升戏剧性"):
  > 这是一个**温情向**世界: 看重低冲突、慢节奏、人情真切、日常微光与克制留白, **不靠堆砌冲突与大事推进**。据反馈提议**更小幅**调整(只动 1-2 键; 文笔每个 ≤0.12、模拟每个 ≤0.15), 目标是**在保持克制基调前提下**提升文笔细腻、人物关系层次、群像长久陪伴。**避免**为制造张力而升 conflictRate/eventBias; 若近期戏剧已偏密, 优先**降** conflictRate/eventBias。priorWeight/nicheWeight/turnoverRate 可微调以丰富人物互动, 但不要把世界推向竞争或动荡。
- **幅度收窄 0.25→0.15 / 0.2→0.12**: 温情区是窄带, 大步变异一脚迈出温情格回不来(正是 renjian 震荡模式)。
- **catch 兜底微扰**(282): GENTLE 时 `+0.05 → +0.03`。

### 4.2 simReflect 温情版(evolve.ts:339-341)

`gentle = GENTLE`。把"单向加压泵"改成"双向稳压阀"——**低张力是温情的健康态, 只有过密才报警往回拉**:

- 替换"密度低→升冲突"(`sift.score<4`):
  > (温情向: 故事链稀疏属常态, 不必强升冲突)保持克制, 以日常细节、关系推进与情绪层次承载叙事; 若戏剧已偏密(conflictRate>1.0 或 eventBias>1.1)反而宜适度**降** conflictRate/eventBias。
- 新增**过密才动**触发: `tension.score>6 || conflictRate>1.1` → `⚠张力偏高于温情基调→宜降 conflictRate/eventBias、降 scarcity`。
- 替换"张力低→升 structureGrowth/scarcity"(`tension.score<4`): 去掉"升 scarcity"(稀缺=零和竞争反温情), 改 `世界平静属正常; 若疑人物坍塌(群像流失)→宜降 turnoverRate 让人物更长寿、可微升 nicheWeight 让角色日常各司其职互相牵绊, 但不要升 scarcity/conflictRate`。

### 4.3 engine 软上限 + 锚回拉(防漂核心, 确定性钳制)

仅 prompt(4.1/4.2)不足以防漂: LLM 偶尔越界 + bestEngine 棘轮会爬顶。必须确定性钳制。

**4.3a 软上限(mutateGenome clamp 的 hi, GENTLE 时换更低值):**

| 旋钮 | 现 clamp | 温情 hi(GENTLE) | 锚/中心 | 依据 |
|---|---|---|---|---|
| conflictRate | 0.5–1.8 | 0.5–**1.05** | 0.85 | renjian 顶在 1.05 震荡=中性区上界默认 1.8; 压到 1.05 让震荡落温情带 |
| eventBias | 0.5–2.0 | 0.5–**1.1** | 0.9 | 大事少 |
| scarcity | 0–1 | 0–**0.3** | 0.1 | 稀缺侵蚀 bond(world-actor.ts:360) |
| structureGrowth | 0–1 | 0–**0.4** | 0.15 | 派系少分裂 |
| turnoverRate | 0.4–1.6 | **0.4–1.0** | 0.8 | 只许慢代谢, 人物长寿 |
| nicheWeight | 0–1 | 0–1(不限) | — | 鼓励日常分工陪伴 |
| priorWeight | 0.5–1.6 | 0.5–1.6(不限) | — | 命理引导与冷暖无关 |

**4.3b 锚回拉(比软上限更关键, 破棘轮):** 每次 mutateGenome 后, GENTLE 对 conflictRate/eventBias/scarcity/structureGrowth 做 `k = anchor + (k - anchor)×0.9`(向锚收 10%)。LLM 不主动调时旋钮自然缓慢回落温情锚, 而非永停历史最高。10% 幅度小, 不压制有依据的真上调, 只抵消噪声驱动的单调漂移。

**4.3c bestEngine 入库钳制(evolve.ts:315):** 写 bestEngine 前, GENTLE 对存入 engine 按 4.3a 上限 clamp 一遍。保证"世界级最优旋钮"本身在温情带内, 否则 4.3a/4.3b 钳了变异/回拉但棘轮仍存越界 engine 当父本。

### 4.4 基因防漂 + 全局传承隔离(关键, 否则白改)

- **steer 字段**: `Genome.steer?: "warm"`(顶层可选, 默认 undefined=现状零破坏)。`loadGenome` 在 `intent.tone==="温情"` 时给起步基因打 `steer:"warm"`; `cloneGenome`/`mutateGenome` 透传(精英化/变异不丢)。冗余: `composeProfile.toneTags` 含温情/治愈/人情/悲悯任一也置 warm(两路取或)。
- **styleBin 第三维**(engineNiche, evolve.ts:92): 增 `styleBin∈{温情,戏剧}`(由 steer 或 conflictRate 阈值判定)。温情 engine 自占格, 永不与戏剧 engine 互相覆盖。
- **跨风格不比 fitness**: warmFit 与 simFit 量纲不同、方向相反, 不可跨风格比。`depositWorldArchive` 写入带 style 标签; `loadGenome` 起新温情世界只从温情格取种(扩 intent 的 `style`/`tone` 字段, evolve.ts:54-64)。

> 信号来源统一: longrun.ts:75-78 的 `NOVEL_WORLD_INTENT` 增别名"温情"/"人间"→ `intent.tone="温情"`(类比现有"群像/爽文")。`NOVEL_STYLE=温润`(longrun.ts:36/39 已读)是笔法开关。**两者建议合一**: GENTLE 世界应同时设 `NOVEL_STYLE=温润`(管笔法/节拍/fitness/变异)。见 ⑦ 单开关。

---

## ⑤ critique 温情 rubric(重定义 6 键义, 不改结构)

**`interface Rubric` 保持 6 键不变**(freshness/pacing/dialogue/hook/coherence/character, evolve.ts:25)。改键名会破坏历史 evolution.json 反序列化(旧卷 scores 缺新键)、server 曲线(server.ts:199 透传 l.scores)、跨卷比较。**"重定义"= 同一键在 GENTLE 下经 critique prompt 释义打成温情维 + 经 fitnessOf 权重重分, 键名/键数/JSON 形状恒定。**

### 5.1 6 键温情释义(critique prompt, evolve.ts:244)

| 键 | 爽文隐义 | 温情重定义 |
|---|---|---|
| **freshness** | 新鲜猎奇 | 表达是否新鲜不落套(防陈词矫情) |
| **pacing** | 推进爽利(越快越高) | 节奏是否从容有张弛(**非越快越高**) |
| **dialogue** | 推动情节 | 对白是否自然含蓄(寒暄/欲言又止/言外之意) |
| **hook** | 悬念钩子 | **章末余味与牵引**(非悬念) |
| **coherence** | 连贯 | 气脉相承、连贯不跳(对应 GENTLE"前后气脉相承") |
| **character** | 人物可信 | 人物层次与可信(温情命脉) |

prompt 三处 GENTLE 三元化(头/释义/尾), JSON schema 6 键名**一字不改**, `pick/num/strs`(249-251)、返回对象(252-256)全不动:
- 评审人设(244): `GENTLE ? "你现在是重意境、人物与余味的文学编辑" : "你现在是严格的文学编辑"`
- rubric 行加键义括注(仅 GENTLE)
- 末句: `GENTLE ? "评分看重余味、人物层次、细节真切与情感可信, 而非情节爽利度。" : "评分拉开差距、敢打低分。"`
- `tone`/`conflict` 候选集: 见下 5.2。

### 5.2 TONES/CONFLICTS/RHYTHM_HINT 温情化(evolve.ts:39-42)

`GENTLE ? [温情集] : [现状集]`, 现状数组**逐字保留**, 长度都保 5/5/3(网格仍 5×3=15, 报告串 `TONES.length*RHYTHMS.length` 不变):
- `TONES = GENTLE ? ["温润","怅惘","诙谐","悲悯","澄明"] : ["冷峻","热血","诙谐","悲悯","悬疑"]`
- `CONFLICTS = GENTLE ? ["羁绊","抉择","情感","成长","和解"] : ["动作","权谋","情感","解谜","生存"]`
- `RHYTHMS` **不变**(急促/均衡/绵长在温情都成立; rhythmBin 按本世界句长分位自适应, 轴名不变让 server 曲线/分箱零改)。
- `RHYTHM_HINT` GENTLE 版改"急促=情绪略快句凝练但不失温度 / 均衡=句舒展从容铺陈心绪 / 绵长=舒展长句留白意境绵延"。

### 5.3 fitnessOf(evolve.ts:206-208)

签名 `(r:Rubric):number` 不变(调用点 303 零改动), 体内按 GENTLE 选权重组:
```
GENTLE ? character·0.26 + freshness·0.22 + coherence·0.16 + dialogue·0.14 + pacing·0.12 + hook·0.10
       : freshness·0.28 + hook·0.18 + character·0.16 + pacing·0.14 + dialogue·0.12 + coherence·0.12
```
(两组和均=1.0, 量纲一致, 跨卷比较安全。)

---

## ⑥ pickTarget / targetStyle 温情约束(evolve.ts:182-192)

**pickTarget 收缩 TONES 探索集到温情亲和语气**(消除第三推力源)。签名 `pickTarget(archive, gentle=false)`:

```
const toneSet = gentle ? ["悲悯", "怅惘", "温润"] : TONES;  // 从已 GENTLE 化的 TONES 取温情子集
```
- **温情亲和子集**: 悲悯(正中心) + 怅惘/温润(克制留白, 相容慢节奏)。**排除** 热血(高燃反克制)、诙谐(插科打诨稀释人情重量)、悬疑/澄明若偏离则不选。

> [变异] 调研给的子集是 `["悲悯","冷峻"]`(基于现状 TONES)。但 ⑤ 已把 GENTLE 的 TONES 换成温情集(无冷峻), 故**采纳 GENTLE-TONES 内的 `["悲悯","怅惘","温润"]`**——与 ⑤ 的 TONES 改动一致, 不引外部语气。冷峻在温情世界已不在候选集。

两处替换:
- 第二段 `for (const t of TONES)` → `for (const t of toneSet)`。
- 第一段锚定 `best.tone` 扫节奏保留, 但 gentle 且 `best.tone` 不在 toneSet 时(历史遗留强格)改锚 `"悲悯"` 起扫, 避免锚在反温情强格。
- **RHYTHM 不限制**: 节奏轴是温情世界唯一安全的多样性来源(克制短句/从容长句都温情), 保留满探索防风格僵化。

效果: 温情世界 MAP-Elites 从 5×3=15 格收缩为有效 3×3=9 格(悲悯/怅惘/温润 × 三节奏), novelty 只在温情语气带内找未点亮格。styleDirective(190)GENTLE 时追加 `保持温情基调, 以此语气微调质感而非改变世界冷暖`。

调用点(evolveOnce:344): `pickTarget(archive, GENTLE)`。

---

## ⑦ GENTLE 标志接入 + 每处最小 diff(爽文世界零变更)

### 7.1 单一开关(直读 env, 不加 evolveOnce 参数)

**结论: evolve.ts 顶层直读 `const GENTLE = process.env["NOVEL_STYLE"] === "温润"`(与 longrun.ts:36/39 同源同进程)。** 证据: longrun.ts:444 的 `evolveOnce` 与 longrun.ts:39 的 GENTLE **同一 Node 进程**(longrun.ts:20 直接 import 非子进程); evolve.ts 已有直读 env 先例(362/365); `evolveOnce` 被 2 处引用(longrun:444 + CLI:368), 直读 env=0 调用点改动 + CLI 同样能经 `NOVEL_STYLE=温润` 触发; env 未设→`false`→完全走现状。

放在 evolve.ts L42 `RHYTHM_HINT` 后:
```ts
// 笔法风格门(与 longrun.ts:36/39 同源同进程; 温情向把"戏剧性最大化"目标改写为"余味/人物/意境")
const GENTLE = process.env["NOVEL_STYLE"] === "温润";
```

> warmFit 的开关同理直读: longrun.ts:440 算 warmFit 前判 GENTLE(line 39 已有), `computeSimFitness` 与 `computeWarmFitness` 二选一调用。

### 7.2 最小 diff 清单(每处 `GENTLE ? 新 : 旧`, GENTLE=false 逐字保留)

| # | 位置(行) | 函数 | 改法 | 风险 |
|---|---|---|---|---|
| A | 新增 ~L43 | (module) | `const GENTLE = process.env["NOVEL_STYLE"]==="温润"` | 极低 |
| 1 | 39-42 | 常量 | TONES/CONFLICTS/RHYTHM_HINT 三元(保 5/5/3 长度), RHYTHMS 不动 | 低 |
| 2 | 206-208 | fitnessOf | 加 GENTLE 权重组(和=1); 签名不变 | 低 |
| 3 | 182-192 | pickTarget/styleDirective | 加 gentle 参 + toneSet 收缩 + 锚 fallback; 调用点 344 传 GENTLE | 低 |
| 4 | 244 | critique | prompt 头/释义/尾三元 + tone/conflict 继承常量; 键名/解析不动 | 中(prompt) |
| 5 | 229 | objectiveScore | 对白理想 `0.3 → GENTLE?0.2`; metricsOf 不改(F/R 分离) | 低 |
| 6 | 260-285 | mutateGenome | 加 gentle 参 + 目标句 + 幅度收窄 + clamp 上界三元 + 锚回拉(4.3b) + 兜底微扰 | 中 |
| 7 | 339-341 | simReflect | GENTLE 换 push-conflict 为双向稳压阀(4.2) | 中 |
| 8 | 315-318 | fitness + bestEngine | GENTLE 用 warmFit 替 simFit(28% 不变) + bestEngine 入库钳制(4.3c) | 中 |
| 9 | 19/50/54-64 | Genome/clone/loadGenome | `steer?:"warm"` 字段 + 透传 + intent.tone | 低 |
| 10 | 92-111 | engineNiche/deposit | styleBin 第三维 + 跨风格不比 fitness(全局隔离) | 中 |
| 11 | sim-fitness.ts | 新增 computeWarmFitness | 复用 bond/stress/volatility/novelty + warm-bond-snap 持久化 | 中 |
| 12 | longrun.ts:75-78,440 | intent + 调用 | NOVEL_WORLD_INTENT 别名"温情/人间" + GENTLE 时调 computeWarmFitness | 低 |

**向后兼容保证**: 每点 `GENTLE ? 新 : 旧`, env 未设/非"温润"时执行路径与字面**完全等同现状**, 爽文世界字节级零变更。archive 世界本地(A_FILE) + NOVEL_STYLE 世界级固定→单世界不混风格。global-evolution.json niche 按引擎旋钮分(不碰 tone/conflict 字符串)→ 改点 1 不污染全局; styleBin 第三维进一步隔离温情/爽文 fitness 不同量纲在偶发同 niche 的失真。

---

## ⑧ 验证法(证温情向世界 conflictRate 不再被推高、温情质量在升)

### 8.1 反漂验证(conflictRate 不再被推高)

| 指标 | 数据源 | 通过判据 |
|---|---|---|
| **conflictRate 轨迹** | genome.json 逐卷 `engine.conflictRate`(或 evolution.json scores) | GENTLE 世界跨 ≥10 卷, conflictRate **不再单调上行**, 收敛带落在 ≤1.05(软上限), 中位 ≈0.85(锚)。对照: 关 GENTLE 重跑同种子应复现 0.6→1.05 上行 |
| **bestEngine 轨迹** | evolution.json `bestEngine.engine.conflictRate` | 不超 1.05(4.3c 钳制生效) |
| **棘轮 vs 锚** | 连续卷 conflictRate Δ | LLM 不调时每卷向锚收 ~10%(4.3b), 无单调正漂 |
| **A/B 对照** | 同种子两进程: `NOVEL_STYLE=温润` vs 不设 | 温润组 conflictRate 收敛低位; 爽文组字节级同现状(回归测试: diff genome.json/evolution.json 应仅温润组变化) |

### 8.2 温情质量在升(F 轨)

| 指标 | 数据源 | 通过判据 |
|---|---|---|
| **warmFit 总分** | sim-fitness.json `total`(GENTLE=warmFit) | 跨卷上行或稳在高位; 不被 Goodhart-veto 频繁折扣(折扣率 <10%) |
| **bondWarmth(W1)** | warmFit 分项 | 上行(正 bond 对增多); 但**不**触顶 0.95+零方差(否则 veto=死水) |
| **calmBand(W3)** | warmFit 分项 + avgStress | avgStress 收敛中低位(~0.35 带内), 非 0(死寂)非高(焦灼) |
| **deepenBand(W2)** | warm-bond-snap 差分 | 有持续的 bond 负转正/增正事件(和解在发生) |
| **conflictRate↓ 与 bondWarmth↑ 相关** | 两序列 | 负相关显著(验证 world-actor.ts:360 机制: 降冲突→bond 不被侵蚀→暖↑), 即闭环在引擎层自洽 |

### 8.3 温情质量在升(R 轨 + 人审)

| 指标 | 数据源 | 通过判据 |
|---|---|---|
| **character/coherence rubric** | evolution.json scores | GENTLE 世界 character/coherence 上行(温情命脉); hook 不再被优化(因权重 0.10) |
| **fitness 主驱动翻转** | scores `llm` vs `fitness` 分解 | llmFit(温情 rubric)主导且与 warmFit 同向, 无"engine 选温情但 rubric 仍偏冲突"内耗 |
| **人审锚定** | 议事准驳记录 + ledger.amplify/avoid | 每 N 卷采样章节人审"是否温情", 通过率上行; veto 命中章人审确认非误杀 |
| **诚实边界监控** | R 轨与人审一致率 | 周期核对 R(~0.51 相关)是否还对得上人; 背离即人审权重上调(温情比其他维度更依赖人审) |

### 8.4 不坍塌验证(防两极)

| 反极 | 检测 | 护栏 |
|---|---|---|
| **回戏剧**(原病) | conflictRate 上行 + warmFit 跌 | ④ 四梯度翻转 + 软上限 + 锚回拉 |
| **死水寒暄**(反极) | bondWarmth≥0.95 且 stress 方差≈0 + novelty 跌 | warmFit ×0.75 折扣 + W2 要变化 + W5 novelty + calmBand 罚死寂 |
| **风格僵化** | archive 温情格长期只点亮 1-2 格 | ⑥ pickTarget 在 9 格(3 语气×3 节奏)内 novelty 探索, RHYTHM 满探索 |

### 8.5 验证执行

```bash
# 起一个温情世界(同时设笔法+intent), 跑 ≥10 卷(每卷 25 章, evolveOnce 每 8 章)
NOVEL_STYLE=温润 NOVEL_WORLD_INTENT=温情 NOVEL_SAGA_DIR=renjian npm run longrun
# 监控: genome.json 的 conflictRate 轨迹 + sim-fitness.json 的 warmFit/bondWarmth/avgStress + evolution.json scores
# A/B 回归: 不设 NOVEL_STYLE 跑爽文世界, diff 确认 evolve.ts 输出字节级同现状
```

---

## 落地顺序(风险从低到高, T1→T3)

- **T1 反漂(最高杠杆, 立止血)**: 改点 A/1/2/3/6/7 + steer 字段(9) —— mutate/simReflect/clamp/锚回拉/pickTarget/rubric 权重。**仅此六点即可让 renjian 的 conflictRate 停止上行**, 因为四梯度已翻转、软上限+锚回拉已钳住棘轮。无需 warmFit 也能止血(此时 fitness 仍含 simFit 但变异 prompt/clamp 不再推冲突)。
- **T2 温情质量进 fitness**: 改点 8(fitness 用 warmFit)+ 11(computeWarmFitness)+ 12(longrun 接入)+ 5(objectiveScore)—— warmFit 让 bond 暖正向进 fitness, 闭环完整翻向温情。
- **T2.5 全局隔离**: 改点 10(styleBin + 跨风格不比 fitness)—— 温情世界联网不被爽文冠军拉回。
- **T3 度量增强(可选)**: R 轨升级温情五维 pairwise(3.2)+ F 轨加 S1/S4/S7 文本特征(3.1)+ 人审锚定常态化(3.3D)。

---

## 核心相关文件(绝对路径)

- `/Users/chris0810/Documents/Codex/Novel System/app/evolve.ts` — 改点 A/1-10(fitness 316-318、fitnessOf 206、bestEngine 315、mutate 266、simReflect 340、pickTarget 182、critique 244、engineNiche 92、loadGenome 54、steer 字段 19)
- `/Users/chris0810/Documents/Codex/Novel System/app/sim-fitness.ts` — 新增 computeWarmFitness(simFit 全反温情, 并列加 warmFit; 复用 historicalNovelty 194 / band 174)
- `/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts` — GENTLE 36/39、intent 75-78、computeSimFitness/saveSimFitness 440-441、evolveOnce 444
- `/Users/chris0810/Documents/Codex/Novel System/app/minds.ts` — bond 账本来源(18/86), warmFit W1/W2 取此
- `/Users/chris0810/Documents/Codex/Novel System/core/runtime/world-actor.ts` — **载荷机制**: bond 由 `scarcity×conflictRate` 侵蚀(360)、宿敌 bond-2(464-465)、narrativeStress clamp[0,1](65) → "奖 bond 暖=罚高冲突"在引擎层自洽
- `/Users/chris0810/Documents/Codex/Novel System/core/domain/events.ts` — 确认 0 正向事件类型(16-43), 故温情质量须走 bond+stress+rubric 而非 symbolic 事件
- `/Users/chris0810/Documents/Codex/Novel System/core/domain/pack.ts` — toneTags(95)冗余判定来源

## 串联本地蓝图

- `.audit/20260531-self-evolution-sota/synthesis.md` — MAP-Elites/QDAIF + F/R 解耦红线
- `.audit/20260601-qualitative-leap-research/synthesis.md` — 议事人审破天花板(温情尤需)
- `.audit/20260531-world-simulator-evolution/synthesis.md` — story-sifting fitness + LLM 仅 tie-break
- `.audit/20260604-arc-selection-research/synthesis.md` — Reagan 弧(S1 治愈弧来源)
- `.audit/20260604-global-qd-evolution/` — engineNiche/styleBin 全局传承隔离上下文
