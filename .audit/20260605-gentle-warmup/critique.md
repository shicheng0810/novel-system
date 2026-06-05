# 对抗式评审 · 温情预热起笔蓝图

> 裁决: 可施工(T1直接上), T2必补数据缺陷X(人情pattern的bond轨迹该从StageCommitted.deltas重建,非character-actor候选点)。

---

I have everything I need. All evidence confirmed:

- `StageCommitted.deltas` (a `StateDelta[]` with `set: { "bond:<B>": value }`) IS persisted in full via `appendEvent` (no severity gate, full `payload_json` written). So bond pairs + values ARE recoverable from the event stream — but via `StageCommitted`, which the blueprint never names. It instead points T2 at `论道结善`/`character-actor.ts:80` (a non-persisting candidate site) and lists `MemoryRecorded` (single `characterId`, partner only in free text) as the carrier. This is the one real, correctable defect.
- The empty-chain → null → genesis-fallback path is confirmed for pure-gentle worlds.
- Determinism reasoning holds: `pick.tick` only changes fast-forward step count; `step()` inputs are untouched.

I have enough to render the verdict. No need for task tracking on a review deliverable.

---

# 对抗式评审结论:温情预热起笔蓝图

**总裁决: 可施工(T1 直接上),但 T2 必须补一处真实数据缺陷 X(否则 4.2 六个人情 pattern 里至少四个挑不出东西)。** 蓝图引用的 9 个代码锚点我逐行复核,全部属实;问题不在"引用造假",在"T2 去捞数据时捞错了源"。

下面按你六问逐条给裁,真问题用 ⚠️/❌ 标,伪问题明说放行。

---

## ❌ 真问题 1(最严重·必须补):T2 的人情 pattern 捞错了数据源,bond 轨迹其实不在它说的地方

这是全篇唯一的硬伤,且直接决定 T2 成败,所以放第一。

蓝图 §0「关键发现」+ §4.2 + 速查表反复说:人情 pattern 靠**现成遥测** `character-actor.ts:80`(`论道结善`/bond+1)去 sift,`深缘结成 = 同一对 bond:<id> 经 ≥4 次论道结善单调升过阈值`。**但 `pickArcStart`/`siftStories` 只吃 `WorldEventRecord[]`(`readEvents` 出来的事件流),而:**

1. **`bond:<id>` 从不作为事件落盘**——它只是 `StateDelta.set` 里的一个 prop 增量(`character-actor.ts:84-85`)。我 grep 全仓确认 `bond:` 在任何 `evs.push`/事件 kind 里零出现。**`siftStories` 在事件流里根本看不到任何 bond 数值。** 所以"bond 单调升过阈值""bond 曲线峰"(T2 取点用)**在 `siftStories` 这一层不可重建**。
2. **`character-actor.ts:80` 那行(蓝图当"现成信号源")是 candidate 构造点,不是落盘点**——`论道结善` 只有被 commit 后才进事件流,且进的是:
   - `MemoryRecorded`(`world-actor.ts:334`):`characterId` 是**单个 actor**,partner B 只埋在自由文本 `body="<A>与<B>论道结善"` 里。**靠它重建"哪一对"得字符串切名字 → 重名/同名必撞,脆。**
   - `StageCommitted`(`world-actor.ts:327`):`deltas:StateDelta[]`,partner B 的 id 是 `set` 里 `bond:<B>` 的 **key**,bond 后值是它的 value。

**真正干净、结构化、能重建"哪一对 + bond 升到多少"的源是 `StageCommitted.deltas`——蓝图通篇没提它。** 我已确认 `StageCommitted` 经 `appendEvent` 全量落盘(`store.ts` 写路径无 severity 闸门,`payload_json` 整体写入),所以数据**在**,只是蓝图指错了门牌号。

> 影响面:6 个人情 pattern 里,**深缘结成 / 生死相托 / 陪伴终老**(全靠 bond 高位/单调升)直接受影响;§4.5 T2 取点("bond 曲线峰""升前肩 = bond 刚萌芽")同样受影响。**恩义两清 / 重逢 / 传承**靠 `VengeanceResolved`/`CharacterEntered`/`CharacterFell`,这几个是真事件、不受影响——所以不是全崩,是一半崩。

**补丁 X(改 §0/§4.2/§4.5 + 速查表)**:
- 把人情 pattern 的数据契约从「捞 `论道结善`/`bond:<id>` 现成遥测」改为「**从 `StageCommitted.deltas` 重建 per-pair bond 轨迹**」。具体:`siftStories` 里新加一个预处理,扫 `StageCommitted`,对每条 delta 的 `set` 取所有 `^bond:` 键 → 得到 `(actorId, partnerId, tick, newBondValue)` 四元组序列 → 在此之上才能写"同一对 ≥4 次单调升""bond 峰 tick=P"等规则。
- §4.2 表头那句"全用现有事件"要改成"全用现有事件 **+ StageCommitted.deltas 重建的 bond 轨迹**",否则施工者按字面去 grep `MemoryRecorded` 会发现凑不齐 pair。
- §367「现成信号源」那两行(`character-actor.ts:80`/`world-actor.ts:448`)**保留 `world-actor.ts:448`(恩怨释怀是真 `VengeanceResolved` 事件,属实可捞),删掉/改写 `character-actor.ts:80`**——它不是落盘点,会误导施工。补一行:`StageCommitted.deltas`(bond:<id> 增量)= 关系轨迹的真源。
- §4.1「物哀形状先验取代 StU 罕见度」和 §4.5「bond 曲线峰」要标注:这些都依赖上面这个 bond 轨迹重建,属于 T2 的**新建数据管线**,不是"捞现成",T2 工作量被蓝图低估了一档。

---

## 你六问的逐条裁决

### ① 温情起笔真不跳冲突峰值吗?——**结构上跳不了,但前提是 T2 落地;T1 有真空洞** ⚠️

把改后的 arc-select 走一遍:
- **T1 在混合世界(有少量死亡/复仇)**:`siftStories` 仍只产 7 个冲突 pattern,`REAGAN_GENTLE` 只是把 `复仇闭环/崛起陨落` 从 1.2 压到 0.8、把 `逆袭登顶` 从 0.85 抬到 1.25。问题:**温情世界的事件流里"逆袭登顶"几乎不触发**(它要 `CharacterTranscended` + ≥2 次 `ProgressionAdvanced`,这是爽文修仙信号,不是人间行走信号)。结果排序里**实际有货的还是复仇/崛起陨落那几个**,`REAGAN_GENTLE` 把它们压低但**没有别的弧顶上来填空** → 很可能仍挑到一个被压权的冲突弧,起笔点经 `incite=atTick−span` 仍落在引爆点前夜。**T1 阶段"挑到温情时刻而非复仇闭环峰值"——不保证,大概率仍挑到复仇闭环、只是分低。** 蓝图 §261 自己承认了"纯温情世界 T1 退创世",但**没承认"混合世界 T1 仍会挑出冲突弧"**这个更隐蔽的失败模式。这点要补进 §6 T1 风险。
- **T2 落地后**:`siftStories` 真产出人情链 + 取点改肩部 + `pick.tick !== pick.arc.atTick` 断言(V3)。此时**结构上确实跳不到峰值**——升前肩(meet 后第一个平静 tick)在因果上必早于 bond 峰 P。这条成立。

> 结论:**①只在 T2 成立。蓝图"T1 可立刻上线且解决基调"的卖点过强**——T1 解的是 arcHint 文案打架(根因 C,真解了),不是"挑到温情弧"(根因 A/B,T1 在混合世界也没真解)。建议把 T1 的宣传从"缓解 B"降级为"仅缓解 arcHint,选弧仍偏冲突",诚实标注。

### ② 预热对温情【真有用】吗?——**论证站得住,但有一处过度外推** ✅(附 ⚠️)

"温情更该预热、攒包浆而非火药"逻辑自洽,且蓝图 §117 自己打了诚实补丁("Smallville/StoryBox 的关系=社交图连通性,≠羁绊质量;预热是必要不充分")。这个自我设限我认可,放行。

⚠️ 一处外推过头:§110「允许预热内某些 NPC 完整老去/逝去一轮,让故人有重量」。问题:**预热期 NPC 要"老去/逝去",得有衰老/寿命机制在 `step()` 里跑。** 我没在本次核验范围看到寿命系统(`CharacterFell` 由 story event 触发,非自然老死)。**若世界没有"自然老去"动力学,预热再久也只攒出"互相认识",攒不出"看着他从壮年到衰老"**——而后者正是蓝图 §103 吹的"长生母题天作之合"的全部分量。**这是 ②论证里最性感的一句,恰恰可能没有机制支撑。** 需补一句核验:`spawn-character` 进来的 NPC 有没有年龄/寿命衰减?没有的话,"时间厚度"是 prompt 层假装的,不是预热模拟出来的,§103 那张表要降级。

### ③ 改 REAGAN/换 patterns 后 story-sifting 还挑得出东西吗?——**T1 在纯温情世界挑无可挑(蓝图已认),混合世界挑得出但偏;T2 挑得出但依赖补丁 X** ⚠️

- 纯温情世界:`siftStories` 六个 for 循环全 keyed 在 `fell/dissolved/split/transc/stories`,无死亡无派系灭 → `chains=[]` → `pickArcStart` line 18 `return null` → 退回创世起笔。**我独立确认了这条空集路径属实。** 蓝图诚实标注了,且 T2(补丁 X 后)真能产人情链填空 → 解。
- **回退安全性 ✅**:`pick=null` 时 `arcHint=""`,但 `GENTLE` beatSpec(`:166`)/`PENMANSHIP`(`:37`)仍生效 → 开篇仍温润,只是没弧框。这个 graceful degradation 是对的,不会崩。
- **隐患**:T2 给人情链定 quality 时,`PATTERN_BASE_GENTLE`(0.85~1.0)× completeness × spanFactor × rarity。温情世界事件稀疏,`rarity` 里的 `typeRarity=1/√typeCount` 在样本少时方差极大,**可能出现"全世界就 1 条深缘链,rarity 拉满,quality 虚高"** → 挑出来的不是"最动人"而是"最孤例"。蓝图 §117 提了"动人靠 continuous-minds 填"但没提这个**稀疏样本下 quality 估计不稳**的统计问题。建议 T2 给人情 pattern 加最小样本/平滑(如 `typeCount<2` 时 rarity 封顶 0.7),写进 V3 验证。

### ④ arcHint 温情框法与温润笔法/温情节拍真一致不打架吗?——**一致,这块是蓝图最扎实的部分** ✅

我核验了三处咬合对象的真实原文:
- `:166` GENTLE beatSpec:「首拍由上章余韵自然承接…不必每拍生新冲突…末拍安静画面/余味收束、不必留悬念」。
- `:37` PENMANSHIP 温润:「舒缓有韵…避免'仿佛/似乎/宛如'」。
- `:190` 段末:GENTLE 走「安静画面/余味收束」。

蓝图温情版 arcHint(§204)用"从容写起/人情与气息/徐徐展开",**确实回避了 `:37` 明令禁的"仿佛/似乎/宛如",且与"不必生新冲突"同向**。原版 arcHint(`:244`"一翻开就在矛盾/张力里")与 `:166`"不必生新冲突"**确实是同一 outline prompt(`:169` 注入)内的直接矛盾**——根因 C 是真的,不是臆造。**这块放行,文案设计到位。**

唯一吹毛:§169 让 `directness` 在 gentle 下"负 bond 越多越扣分",但 `directness`(`sim-fitness.ts:152-153`)算的是**最敌对一对**的 cross-bond,温情世界根本没有敌对派系对 → `hostile.length=0` → `directness=0` 恒成立 → 这条反向加权**在纯温情世界是死代码**(改了也没数据触发)。不是 bug,是"改了个用不上的旋钮"。可在 §4.3 标注"directness 反转仅对混合世界有效"。

### ⑤ 确定性(scout/真世界同 seed)有没有被破?——**没破,§7 论证正确** ✅

我顺着 `longrun.ts:228-252` 核验:
- 三处改动均在 `step()` **之后**作为纯函数读事件流(`pickArcStart`/`siftStories`),不回灌 `enqueueInput`,不改 `step()` 输入——**确认属实**。
- `arcHint` 只注入 ch1 LLM prompt(`:169`),与状态机无关——属实。
- `GENTLE` 改的只是 `pick` 的**选择结果**(选哪条弧、哪 tick),`T=min(pick.tick, WARMUP−1)` 只改快进步数,每步 `step()` 仍同 seed 确定性——属实。
- **§296 标注的 T2 唯一回归点是对的且关键**:`computeSimFitness`(`:209`)调 `siftStories(events)`,若 T2 给 `siftStories` 加 tone 参而此处不显式传 → fitness 度量在爽文世界被误切 tone。我确认 `siftStories(` 全仓 **2 处**调用点(`arc-select.ts:17`、`sim-fitness.ts:209`),蓝图点名要逐一定 tone——**正确,且我建议加一条:tone 必须来自该世界 `genome.toneProfile`,不能两处各读各的 env,否则 scout(读 env)与 fitness(读 genome)可能 tone 不一致 → 同世界两套排序逻辑。** 写死成"两处都从 genome 取"。

放行,但把上面这条"两处同源取 tone"补进 §7。

### ⑥ 过度工程?更简方案?——**T1 不过度;但"toneProfile 旋钮"和 T2 取点改造有过度工程嫌疑** ⚠️

- **T1(6 行级 + arcHint 二分支)= 恰当,甚至偏保守**,爽文 `gentle=false` 逐字节不变,V0 单测 `pickArcStart(e)===pickArcStart(e,false)` 能守住。不过度。**你提的"温情向干脆 warmup + arcHint 只改框法不改选弧"——这恰好≈蓝图的 T1。** 蓝图 T1 已经是"只改框法(arcHint)+轻调 REAGAN,不改 arc-select 取点逻辑"。所以你这个更简方案蓝图已采纳为 T1,没问题。
- **真正该质疑的是:是否需要 T2 的"取点改肩部"?** §4.5 T2 要逐 tick bond/stress 曲线定肩部,而(见问题 1)bond 轨迹得从 `StageCommitted.deltas` 现建管线,θ 阈值"需自调、文献无值"。**投入产出比存疑**:温情起笔"停在平静处"的目标,**T1 的 arcHint 文案 + GENTLE beatSpec(首拍承余韵/不生冲突)+ `incite=atTick−span` 把 inciting 语义重定义为"缘起"** 已经能在 prompt 层逼出"从人情当口起笔"。**"肩部取点"是在 tick 级做 arcHint 在 prompt 级已经在做的事,边际收益可能很小,却要新建 bond 轨迹管线 + 调 θ。**
  > **改用 Z 建议**:T2 砍掉"arc-select 取点改肩部"(§4.5 T2 那段 + 速查表 `arc-select.ts:22` 改点),**只做"扩人情 pattern 解空集"(这是根因 A,非做不可)+ spanPen 反转(便宜)**。取点继续沿用 `incite=atTick−span`,但因为人情 pattern 的 `atTick` 现在是 bond 峰/farewell(不是死亡),`atTick−span` 自然落在"缘起",**复用现有取点逻辑就够,不必新建肩部算法**。把省下的精力投到补丁 X(bond 轨迹重建)和 ③的稀疏 quality 平滑——那两个是真卡脖子的。
- **`genome.toneProfile` 旋钮**:方向对(收敛散落 env 判断),但属于 nice-to-have。建议 T1/T2 先用一个 `GENTLE`(已存在,`longrun.ts:39`)显式入参跑通,**toneProfile 旋钮挪到 T3**,别让它阻塞 T2 落地。蓝图把它塞 T2 是轻度过度工程。

---

## 给施工的最终清单

**可施工:T1 直接上**(6 行改动,V0 单测守爽文零回归)。我核验 `arc-select.ts:10/15/22/24/25/26`、`longrun.ts:39/242/244`、`:166`/`:37`/`:190` 全部属实,T1 改点行号准确,爽文 `gentle=false` 分支逐字节不变可保证。

**T2 需补 X / 改用 Z 才能施工:**
1. **❌ 必补 X(数据源)**:人情 pattern 的 bond 轨迹改从 **`StageCommitted.deltas`** 重建(`set` 里 `^bond:` 键),**不是** `论道结善`/`character-actor.ts:80`(非落盘点)、**不是** `MemoryRecorded`(partner 仅在自由文本)。改 §0/§4.2 表头/§4.5/§367 速查表。`world-actor.ts:448`(恩怨释怀 → 真 `VengeanceResolved` 事件)保留,属实可捞。
2. **⚠️ 改用 Z(砍取点)**:T2 删"arc-select 取点改肩部",复用 `incite=atTick−span`(人情 pattern 的 atTick 已是 bond 峰/farewell,自然落缘起)。只保留"扩 pattern 解空集 + spanPen 反转"。
3. **⚠️ 补 ③稀疏平滑**:人情 pattern 在事件稀疏世界 `rarity` 方差大 → `typeCount<2` 时 rarity 封顶,防"孤例伪高分"。
4. **⚠️ 补 ②机制核验**:确认 spawn 的 NPC 有无寿命/衰老动力学;无则 §103「看着他衰老」降级为"prompt 层假装",别当预热产物吹。
5. **⚠️ 补 ①诚实标注**:T1 在**混合世界**仍可能挑出(被压权的)冲突弧、起笔仍在引爆点;T1 真解的只有根因 C(arcHint 打架),非 A/B。
6. **✅ 确定性**:§7 正确,仅追加"两处 `siftStories(` 调用的 tone 都从 `genome.toneProfile` 取,不各读 env"。

**伪/可放行**:④文案咬合(扎实)、⑤确定性(未破)、回退安全性(graceful)、T1 工程量(恰当)。

**一句话**:蓝图诊断(四根因+优先级)准确、爽文零回归设计可靠、arcHint 文案咬合扎实;唯一硬伤是 **T2 去捞关系数据时指错了源(应捞 `StageCommitted.deltas` 而非 `论道结善`/`MemoryRecorded`),且 T2 的"肩部取点"是对 prompt 层已做之事的过度工程**——补 X、砍 Z 后 T2 可施工。