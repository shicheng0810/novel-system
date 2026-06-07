# S2 move 抑制研究 — 综合报告

> 核验日期 2026-06-07。独立复跑 4 路调研 + 实读 live 源码 + 实测 `.novel-output/renjian/world.db`(496 tick, atTick 495)。
> 4 路调研结论在「根因」「量化缺口」上高度一致且与 DB 实测逐项吻合; 本综合在此之上**纠正一处关键事实错误**(评分文件路径)并据此重排干预方案。

---

## 0. 先纠一处会带偏落地的事实错误(必读)

**调研#1 把 live 评分路径定位到 `packs/xianxia-bazi/index.ts:244/248` — 这是错的文件。**

live `renjian` 世界**跑的是 freeform 包**, 不是 xianxia 包。三重铁证:
1. `app/pack-select.ts:11-15`: `PACK = pick(xianxia, modern, freeform)`, 由 `NOVEL_PACK` 选; `=== "freeform"` 才取 freeform。
2. live DB `FrameDerived.packId = "mortal-eternity"`(实测)。xianxia 的 `buildFrame` **硬编码** `packId: "xianxia-bazi"`(index.ts:218); freeform 的 `buildFrame` 用 `packId: cfg.id`(make-pack.ts:192) — `mortal-eternity` 是 freeform 加载的自定义 WorldConfig 的 `id`(经 `NOVEL_WORLD_CONFIG` 注入)。只有 freeform 能产出 `mortal-eternity`。
3. 前一审计已落实记录: `.audit/20260606-gentle-narrative-momentum/critique.md:30` 明文 renjian 的 spawn env = `NOVEL_PACK:"freeform", NOVEL_WORLD_CONFIG, ...`。

**为何结论仍成立**: freeform 包是从 xianxia 包派生的, 两者 `scoreCandidate` 数学**逐行同构**(同 `+0.3` flat 互动加成、同 `0.5+influence`)。所以调研#1 的「根因机制」对; 但**diff 必须落到 `packs/freeform/make-pack.ts`(或 pack 无关的 `core/runtime/world-actor.ts`), 改 xianxia 文件对 live 世界零效果**。调研#2/#3/#4 定位 freeform 正确。

**其余事实差异**(均以 DB 实测为准, 已逐项复算吻合):
- live `conflictRate = 0.56`(非任务前提/调研#1 说的 0.6); priorWeight=1.1 ✓; nicheWeight=0.35 ✓。**任务前提「cr0.6 偏好 harmony/discord/caution」是误归因**: 全仓 grep 证实 `conflictRate` 不进候选评分(只在 world-actor 内斗/大事处用), 调 cr 救不了 move。
- tick 计数 489/493/496 之差 = 世界 live 推进的快照时点差; 现 **496**。结论(move=0)跨时点稳定。

---

## ① 根因: move 系统性低分的精确机制

### 评分代码链(live, 已实读全程)

```
core/actors/character-actor.ts:135-153   产 move 候选(kind:"move", 无 targetIds)
        ↓ candidates
core/runtime/world-actor.ts:275-294       打分→priorWeight/nicheWeight 微调→argmax
        ↓ 每候选调
packs/freeform/make-pack.ts:194-239       scoreCandidate(唯一打分函数)
```

### 失分的唯一系数(file:line + 精确数值)

**`packs/freeform/make-pack.ts:194-239` `scoreCandidate`**:
- L199 逐 influence 累加: `influence += axisHints[axis] × polarity × magnitude × confidence × 0.25`
- **L213-214(决定性)**: `if (harmonious && axisHints["harmony"]>0) influence += 0.3` — 五行相生 flat +0.3
- **L217-218(决定性)**: `if (conflicting && axisHints["discord"]>0) influence += 0.3` — 五行相克 flat +0.3
- L228-234: 派系结盟/交恶再 flat `+min(0.3, |r|·0.1)`(至多再 +0.3)
- **L206**: `const target = candidate.targetIds?.[0]` — **L206-235 整段 flat 加成被 `if(target)` 门控**
- L238: `total = clamp01(0.5 + influence)`

**`world-actor.ts:277`**(priorWeight=1.1): `w = clamp01(s.weight + 0.1·influence)` — 只放大 influence。

### move 为何拿不到这些分

`character-actor.ts:146-152` 产的 move 候选:
- `kind: "move"`, `axisHints: { initiative: 0.4+restless, harmony: 0.2 }`(L151)
- payload.deltas 只 set `{ locationId, lastMoveAct }`(L152) — **无 `targetIds`**

→ make-pack.ts:206 `target` 为 `undefined` → **L206-235 全部 flat 互动/派系加成对 move 整段跳过**。move 唯一发动机是 L199 那条 `×0.25` 缩放的轴累加, 且只有 `initiative` 轴有像样的 influence 源(qimen-day mag0.3/conf0.5 全局 + bazi-pattern mag≤0.8/conf0.6 targeted), `harmony:0.2` 轴对 init 命格角色几乎无源。

**算术铁律**: ally/clash 单笔拿到的 flat **+0.3**, 已 > move 全部 influence 预算。move 实测 influence 峰值仅 ≈0.20(把分推到 0.70); ally 的 0.3 flat 还没算命格 harmony 项就已碾压。

### 第二重抑制: restless 加力管线**几乎不点火**(实测新增铁证)

`character-actor.ts:144-145`:
```
sinceMove = actCount − lastMoveAct
restless  = sinceMove > 6 ? min(0.8, (sinceMove−6)×0.1) : 0
```
因 move 从不中选 → `lastMoveAct` 永远停在初值 0 → `sinceMove = actCount`。

**live 实测全员 actCount 峰值 = 6**(c1=6, c2=6, s85=6, 余 3-5)。条件是 `sinceMove > 6`(严格大于)→ **当前快照下 restless 对几乎所有角色 = 0**, 只有历史上某角色 actCount 短暂越 6 时才给过一点点(故 move_max 才 0.6996)。要 restless 顶满 0.8 需 actCount≥14, **无一角色接近**(焦点轮转使单角色 actCount 增长极慢)。

→ 即「久居思动」补偿器结构性饿死: move 输了 → lastMoveAct 不动 → 但 actCount 也涨得慢 → sinceMove 长期 ≤6 → restless≈0 → move 更输。**死循环。**

**一句话根因**: move 无 `targetIds`, 故被 `make-pack.ts:206` 的 `if(target)` 门控挡在 L213/L217 的 `influence += 0.3` 之外, 天生拿不到 ally/clash 的 flat 互动红利; 其唯一补偿器 restless 又因 actCount 长期 ≤6 而几乎不点火 → move 分天花板 ≈0.70, 恒低于带红利者的 0.83-1.0。与 conflictRate / priorWeight **无因果关系**。

---

## ② 量化缺口: move 候选实得分 vs 当选者

实测 `.novel-output/renjian/world.db`(496 个 CandidatesScored, **每 tick 都含 move 候选**, move 生成端无问题):

| 指标 | 值 |
|---|---|
| chosen 分布 | ally **234** / clash **208** / avenge **30** / obs **15** / act **9** / **move 0** |
| move 自身分 | min 0.4813 / mean **0.5851** / max **0.6996**(史上最高) |
| 胜者分 | mean **0.886**(clash 段 0.94, avenge 1.00) |
| gap = 胜者−move | min **0.0478** / **median 0.3150** / mean 0.3017 / max 0.4700 |
| move 排名 | rank1 **0 次** / rank2 21 / rank3 242 / rank4 233(96% 落后半区) |
| 最接近一次 | gap 0.0478(史上唯一 <0.05; 其余全是「差一大截」) |

**不是差 0.1, 是系统性差 ~0.30(中位 0.315)**。move 史上最高 0.6996 仍 < 胜者均值 0.886。

**补力需多大**(在 move **最终 weight** 维度, 要把 move 比抬进蓝图 5-15% 区间):

| 目标 move 比 | 需给 move 最终分加 |
|---|---|
| ~5% | +0.11 |
| **~10%** | **+0.145** |
| ~15% | +0.17 |
| ~30%(过量, 不要) | +0.27 |

**结论: 补 +0.11 ~ +0.17 即达 5-15% move 比。** 取中点 **≈+0.15**。

**跨世界稳定复现**(确证结构性、非某代参数偶然):
- live renjian(gen7, cr0.56/pw1.1): 496 tick, move_chosen **0**。
- `renjian-killed-20260607-001711`(gen4, cr0.6/pw1.0): 362 tick, move_chosen **0**。
- 另 3 个 renjian-killed(30/238/451 tick): 均 move_chosen **0**。
- (唯一例外 `renjian-killed-20260606-180327` 1505 tick move=7, 占比 0.46% — 仍≈0, 不破结论。)

---

## ③ 最小干预方案(排序)

判据: 爽文逐字节不变 / 改动面 / 隔离方式 / 风险 / 工作量 / 能否真破 move=0。

---

### 🥇【首选】方向 A: `world-actor` 评分后给 move 类加 `moveBias` 偏置(走现有 props.tuning 通道)

> 唯一同时满足「爽文逐字节零侵入 + 改动最小(~6 行) + 确定起效 + 走现成进化通道 + 不触发裁决」。

**改哪 file:line**(4 处, 全是加法, 不删改任何现有行):
1. `app/evolve.ts:19` `EngineGenes` 接口加一维 `moveBias: number`。
2. `app/evolve.ts:50` `DEFAULT_GENOME.engine` 加 `moveBias: 0`(**这一条是爽文零侵入的命门**: 默认 0 = 现状)。
3. `core/runtime/world-actor.ts:273` 旁加一行读取: `const moveBias = clamp01(tnum(tune, "moveBias", 0));`(复用现成 `tnum`/`clamp01`, 零新机制)。
4. `world-actor.ts:291` 那行 `return` 之前(即 `scored.map` 回调内、`scored.sort` 之前)插入:
   ```ts
   if (moveBias > 0 && c.kind === "move") w = Math.min(1, w + moveBias);
   ```
   `c.kind === "move"` 已由 character-actor.ts:149 打好, 无需新字段。

**温情侧注入**(让偏置只在温情世界生效, 双保险):
- 在 `app/drama.ts:dramaControl` 内, `gentle` 为真时给 `tuning.moveBias`(如 0.15); `gentle=false` 不设 → 爽文连 key 都没有。
  - 注意: `tuning: EngineGenes = { ...base }`(drama.ts) 会自动带上 base 里的 moveBias; 故第 ①②步把 moveBias 纳入 `EngineGenes` 是**必需的**(否则 `{...base}` 与 `longrun.ts:309 {...dc.tuning}` 两次 spread 会因类型/缺键丢掉它)。
- 或更省: 直接在温情世界的 `genome.json.engine.moveBias` 填 0.15 → 经 `evoGenome.engine`(longrun) → drama `{...base}` → `props.tuning` → world-actor `tnum` 读到。

**爽文是否逐字节不变**: **是, 严格逐字节**。mystory 爽文 ① `GENTLE=false` → drama 不写 moveBias; ② 其 genome.json 无该 key → `tnum` 回退 0; ③ `if (0>0)` 整条不进, `w` 一字不改, 排序输入完全一致。char-actor / 候选生成 / frameHash 全不碰 → 重放安全。

**风险**: 低。① move 不是 risky-kind(gate 仅 `act`/`engage`+canBreak, world-actor.ts:307) → moveBias 加在「argmax 后、gate 前」**不触发裁决、不污染议事**。② 唯一注意: moveBias 过高会让 move 反压 ally → 取 0.15(±0.03)即落 5-15%, 别上 0.27。③ 偏置作用于「同 tick 内 move vs 其它」, 对 var(场景多样性 9.4)只增益不损(move 中选 = 去新地 = 新场景源, 利 var)。

**工作量**: ~6 行(2 行接口/默认 + 1 行读 + 1 个 if + drama 1 行 or genome 1 值)。不碰 char-actor、不碰 pack 冻结签名。

**破 move=0**: 直接、可调、确定。moveBias=0.15 把 move 均值 0.585→0.735, 配 restless 偶发峰值在多数 tick 越过 ally(~0.83 起步仍需配合, 但 move 中位排名会从 rank3/4 升到 rank2/1 的边界, 实测目标 5-15% 在 0.13-0.17 区间可调出)。

---

### 🥈 方向 E: 把 A 的 moveBias 交给 `mutateGenome` 自进化(A 的升级版, 同一落点)

与 A **完全同一处落点**, 仅多让自进化自调配比。在 A 之上加:
- `app/evolve.ts:284` 旁加 `child.engine.moveBias = clamp(j["moveBias"], 0, 0.3, e.moveBias);`(仿现有 7 条 clamp)。
- `evolve.ts:270` LLM 调参 prompt 加一句解释 moveBias 语义。

**爽文逐字节不变**: 是(默认 0, 且爽文 GENTLE-gated 不进化 move)。**工作量**: 比 A 多 ~3 行。
**取舍**: 先 A(温情固定开 0.15、值稳可控、好验收), 验证 move 比落 5-15% 后再决定是否升 E。
**额外风险**: QD niche 按 `turnoverRate×structureGrowth` 分格(evolve.ts), moveBias 进化**不扰动 niche 归格**(不在分格键里), 安全; 但会进 genome 传承, 需确认温情 niche 种子带它。**建议 A 先行, E 待观察。**

---

### 🥉 方向 P: 在 freeform pack `scoreCandidate` 给 move 类一个 config 化 floor

**改哪**: `packs/freeform/make-pack.ts:238`(`total = clamp01(0.5+influence)`)前, 对 move 类加底。
**障碍**: `scoreCandidate(candidate, frame)` 签名**不带 snapshot/tuning**(`core/domain/pack.ts` 冻结形状), pack 读不到 `props.tuning`。须在 `buildFrame`(make-pack.ts:172) 把 `snapshot.props.tuning.moveBias` 塞进 `frame.ext.moveBias`, scoreCandidate 再读 `frame.ext`。
**爽文逐字节不变**: 是(默认 0 → total 不变; frameHash 由 `influences.length` 算(L192), 加 ext 不改 hash → 重放安全)。
**劣于 A**: 要动 pack(freeform 是 core 邻接的通用包, 改动面更敏感)+ 绕签名冻结; A 在 world-actor 更外层、更隔离。仅当想让偏置进 `explain` 可解释文案时才选 P。**工作量**: ~6 行。

---

### 方向 H: 改 char-actor 的 move axisHints 读 config —— 不推荐(治标 + 波及面大)

`character-actor.ts:151` 的 `initiative: 0.4+restless` 改读外部阈值。
**致命问题**: ① char-actor 是 core/genre-neutral/**零 GENTLE 引用**(grep 实证), `reflectAndPlan` 签名不带 config → 改它要动签名或从 snapshot 取, 爽文 mystory 走同一函数, 逐字节不变需极小心。② 即便抬 init hint, **仍被 make-pack.ts:199 的 `×0.25×confidence` 缩压**, 边际收益被 0.25 吃掉, 要抬很大才追平 +0.3 flat, 易过冲。**比 A 绕远且事倍功半。**

### 方向 R: 调 restless 上限/曲线 —— 否决(core, 波及爽文)

`character-actor.ts:145` 抬上限直接改 core 公式, 爽文同享 → 非逐字节不变。退化成 config 化即方向 H 子集, 同受 0.25 缩压。**否决。**

### 反模式: 调 conflictRate / priorWeight —— 无效或更糟

cr 不进候选评分(救不了)。priorWeight 只乘 influence(world-actor.ts:277): move 的 influence 本就小, 放大 0.1·influence 对 move 仅 +0.02, 对 ally(influence~0.33)却 +0.033 → **越调 gap 越宽**。

---

## ④ premise 判断: 该不该补 / 健康 move 比 / 边际收益 / 副作用

**该不该补: 该补, 但只补到「偶发」, 不补成「常态」。**

- **健康 move 比**: 蓝图区间 **5-15%**。理由: move = 角色去新地→喂 E1 newcomer/faction 首现(make-pack.ts 注释明示其设计目的是「制造真去新地遇新人」的物理来源)。当前 0% = 这条涌现供给管线**完全断流**, 所有「新面孔/新场景」只能靠 director 凭空砸或 spawn, 缺了「角色自发流动制造遭遇」这一最自然的涌现源。5-15% 足以让地图活起来又不喧宾夺主。

- **对 W_emerge 的边际收益: 正且可观。** move 是 freeform 世界唯一的「自发空间流动」原子。0%→8% 意味着每 ~12 章就有角色主动迁徙, 直接喂养:
  - 温情侧需要的「换一处地点(出门赶集/访友/上山下山/渡口/市集庙会)」(longrun.ts:182 温情场景流动 prompt 当前**靠纯 prompt 硬推, 无世界状态支撑**) → moveBias 让 `locationId` 真改变 → 场景流动有了 ground truth 底座, var(9.4)只增不减。
  - E1 newcomer / faction 首现的物理触发位点变多。

- **对温情留白 / 慢燃脊梁的副作用: 几乎无, 且需守一条边界。**
  - 留白: move 是「转往某地」的安静位移, 零 discord(char-actor.ts 注释明示 move 只加 harmony+initiative、不推 conflictRate) → **不伤温情留白、不推高戏剧**。✓
  - 慢燃脊梁(T1 主线): moveBias 是「同 tick 内 move vs 其它行为」的权重微调, **不碰** progression-ledger 的主线里程碑机制(longrun.ts:18) → 脊梁不受影响。✓
  - **唯一边界**: moveBias 过高(>0.2)会让角色频繁迁徙、关系互动(ally/clash)被挤压 → 反而稀释温情的「人与人流连」。故**钉死 0.13-0.17, 让 move 偶发而非泛滥**, 守住 ally 仍是主旋律(温情世界 ally 47.5% 是健康的, 不该被 move 大幅侵蚀)。

**净判断: 补。move 0% 是 bug 级断流(设计本意是偶发流动, 实际从未发生), 补到 5-15% 对 W_emerge 是纯增益、对温情三支柱(留白/慢燃/场景流动)是助力或中性, 唯一风险(过量稀释关系)用上限钉死即可规避。**

---

## ⑤ 给主 Claude 的最终建议

### 补 or 不补: **补。** 走【方向 A】, 一次性最小 diff, 爽文逐字节零侵入。

### 可直接落地的最小 diff 思路(4 处加法, 全部向后兼容)

```
1) app/evolve.ts:19   EngineGenes 接口尾部加:  moveBias: number
2) app/evolve.ts:50   DEFAULT_GENOME.engine 加:  moveBias: 0      // ← 爽文零侵入命门
3) core/runtime/world-actor.ts:~273  加读取(挨着现有 6 个 tnum):
      const moveBias = clamp01(tnum(tune, "moveBias", 0));
4) core/runtime/world-actor.ts:~291  scored.map 回调内、return 前、sort 前插:
      if (moveBias > 0 && c.kind === "move") w = Math.min(1, w + moveBias);

温情注入(二选一):
  (a) app/drama.ts dramaControl 内 gentle 分支: tuning.moveBias = 0.15;
  (b) 温情 world 的 genome.json.engine.moveBias = 0.15
```

> 起始值取 **0.15**(对应缺口中点 +0.15 → 目标 ~10% move 比); 若实测偏低调到 0.17, 偏高调到 0.13。

### 验证法(三关全过才算成)

**关 1 — 温情 move 比落入 5-15%**(目标达成):
```bash
# 重开温情世界跑 ≥100 tick 后:
sqlite3 .novel-output/<temperate>/world.db "
WITH cs AS (SELECT json_extract(payload_json,'\$.chosenId') c FROM events
            WHERE kind='CandidatesScored' AND json_extract(payload_json,'\$.chosenId') IS NOT NULL)
SELECT SUM(c LIKE '%-move')*1.0/COUNT(*) AS move_ratio FROM cs;"
# 期望: 0.05 ≤ move_ratio ≤ 0.15
```

**关 2 — 爽文逐字节不变**(零侵入铁证):
```bash
# 对 mystory(GENTLE=false)同一 seed/同段 tick 跑 diff:
#  a) 不设 NOVEL_STYLE、genome 无 moveBias key → 改前/改后两次 build 产同一批 CandidatesScored
#  b) 断言: 改后 mystory 的 chosenId 序列与改前 byte-for-byte 相同
sqlite3 .novel-output/mystory/world.db \
 "SELECT json_extract(payload_json,'\$.chosenId') FROM events WHERE kind='CandidatesScored' ORDER BY seq" \
 > /tmp/mystory_after.txt
diff /tmp/mystory_before.txt /tmp/mystory_after.txt   # 期望: 空(无任何行差)
# 机理保证: tnum 回退 0 → if(0>0) 不进 → 完全等价
```

**关 3 — var 守 9.4**(温情场景多样性不退化, 只增不减):
```bash
# 用现有 var/单一感度量(场景维)对比改前后温情世界:
#  期望 var ≥ 9.4(move 中选→locationId 真变→场景源变多, 利 var)
#  额外断言: ally 比仍 ≥ ~40%(move 未过量侵蚀关系互动 → 温情主旋律守住)
```

### 一句话给主 Claude

**走方向 A: `EngineGenes`/`DEFAULT_GENOME.engine` 各加 `moveBias`(默认 0), `world-actor.ts:273` 旁 `tnum(tune,"moveBias",0)`, 评分 `scored.map` 内对 `c.kind==="move"` 加 `w=min(1,w+moveBias)`, 温情侧 drama/genome 填 0.15。** 默认 0 → 爽文(mystory)逐字节不变(那行 if 不进、排序输入零变化、frameHash 不动、重放安全); 走现成 `props.tuning` 通道(longrun.ts:309 写 / world-actor tnum 读), 不碰 char-actor、不碰 pack 冻结签名、不触发 gate 裁决; 约 6 行; 把 move 从 0.585 抬 +0.15 直接破 0、落 5-15% 目标区间。**切记 diff 落 freeform/world-actor, 勿落 xianxia(那是死文件)。** 验证后若要自进化自调配比, 把该 key 交给 `mutateGenome`(evolve.ts:284 加一条 clamp)即升级方向 E。

---

## 附: 关键 file:line 索引(全部实读核验)

| 位置 | 作用 |
|---|---|
| `app/pack-select.ts:11-15` | `PACK=pick(xianxia,modern,freeform)`; live=freeform(`NOVEL_PACK="freeform"`) |
| `packs/freeform/make-pack.ts:194-239` | **live 评分函数**; L199 轴累加×0.25; **L206 `if(target)` 门控**; **L213/L217 flat +0.3**; L238 `0.5+influence` |
| `packs/xianxia-bazi/index.ts:218,219-280` | 同构但**非 live**(packId 硬编码 xianxia-bazi); 调研#1 误定位于此 |
| `core/actors/character-actor.ts:146-152` | move 候选(`kind:"move"` L149, **无 targetIds**, axisHints L151) |
| `core/actors/character-actor.ts:144-145` | restless 公式; live actCount 峰值 6 → restless≈0 |
| `core/runtime/world-actor.ts:267-273` | 6 个 `tnum` 读 tuning(moveBias 读取注入点) |
| `core/runtime/world-actor.ts:275-294` | 打分→argmax; **L277 pw 只乘 influence**(放大对手优势); **L291 moveBias if 注入点**; L293 sort |
| `core/runtime/world-actor.ts:307` | risky 门控仅 `act`/`engage`+canBreak → **move 不被 gate**(偏置安全) |
| `app/drama.ts:dramaControl` | GENTLE-gated tuning 写入器; `heat=gentle?0`; `tuning={...base}`(须含 moveBias key) |
| `app/longrun.ts:307,309` | `dramaControl(...,GENTLE)` → `props["tuning"]={...dc.tuning}`(tuning 入快照) |
| `app/evolve.ts:19,50` | `EngineGenes` 接口 + `DEFAULT_GENOME.engine`(加 moveBias 两处) |
| `app/evolve.ts:264-290` | `mutateGenome` 逐 gene clamp(方向 E 加 moveBias clamp 于 L284) |

## 附: 实测数据出处(可复核)

- DB: `.novel-output/renjian/world.db`(496 tick); tuning `{priorWeight:1.1, conflictRate:0.56, nicheWeight:0.35, eventBias:0.66, turnoverRate:0.4, structureGrowth:0.05}`(= genome.json.engine)。
- chosen: ally 234 / clash 208 / avenge 30 / obs 15 / act 9 / **move 0**。
- move weight: min 0.4813 / mean 0.5851 / max 0.6996。 gap: min 0.0478 / median 0.3150 / mean 0.3017 / max 0.4700。 move rank: 0/21/242/233(rank1-4)。
- actCount 峰值 6(c1/c2/s85) → restless 当前快照 ≈0。
- 对照: renjian-killed ×5 + arcsaga-killed ×4 中 renjian-killed move_chosen 全 0(1505-tick 例外仅 7=0.46%)。
