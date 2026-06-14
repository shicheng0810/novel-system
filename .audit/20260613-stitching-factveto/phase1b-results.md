# Phase 1b 结果: 确定性接地(grounding) A/B
> 2026-06-14 · plan-fable §1b · fact-ground-v1(fork gen3 中段 ch329-338·4臂·单变量=NOVEL_FACT_GROUND·两臂pro+FACT_LEDGER=2)· 判官=Opus subagent

## 0. 一句话
**接地注入机制 benign(d1c不动·零副作用)·但 factC 无可测下降(5=5)**——grounding 唯一能确定性接的「师太法名漂移」这批 0 发生(测不出·同 OFS Phase C 墙)·实际 mid-run factC 全是涌现型身份纠缠+季节+数值(确定性抽取够不着=Phase 2 领地)。

## 1. 三轴
### 主轴·判官 factC 子类(每组 20 章)
| 子类 | 对照 B1+B2 | 接地 A1+A2 | |
|---|---|---|---|
| 称谓/人名漂移 | 1 | 2 | ground 反多(噪声) |
| 性别 | 2 | 0 | ground 少(唯一正向·n=2 噪声级) |
| 数值 | 1 | 0 | 噪声 |
| 属性 | 1 | 2 | 噪声 |
| 规则 | 0 | 1 | 噪声 |
| **factC 总** | **5** | **5** | **持平** |
- 确定性检测器(fact-veto)扫 40 章: 4 臂 nameDrift=0·gender=0(目标类这批 0 发生)。
- 实际 factC 命中类型: 陆先生↔陆若兰(身份+性别纠缠·gen3 base 自带)、谢承志↔谢文渊、苏明轩↔宋明轩(全名漂移)、顾雨桐敌↔友(身份)、ch337 季节秋燥vs端午、ch334 铜板3↔2。**全是涌现型·非"师太=静檀"式配置型**。

### 副轴·确定性(接地是否有害)
- d1c: 对照 4.5/4.0 · 接地 3.9/4.7 = **≈持平(A1 还略低)** → 数据注入 benign·不炸套语(印证 P1 v2 教训)。
- D1-D12: 接地 0.4/0.2 ≤ 对照 0.4(A2 还更好) · 弃章率全0 · rep4g≈ · echo全0。
- 章长cv「否决」(A1 Δ+80%)是 B1 基线异常低(0.155)的假象: **B2-control(对照!)也触发 Δ+62%** → 噪声非接地效应。

## 2. 裁断: 机制 benign 但 deterministic 接地够不着主体
- **接地注入半边证 benign**(Fable"定心丸"的一半: 注入不伤·d1c不动)——这对 Phase 2 有价值(Phase 2 喂更多事实进同一注入通道·已证通道无害)。
- **但确定性抽取半边太窄**: 它只能抽"师太法名/性别"(1a 证 0 误检的清洁类)·而 mid-run 实际 factC 全是涌现型身份纠缠(陆先生/陆若兰、全名漂移、敌友、季节)·**确定性抽取够不着** → 无 factC 下降。同 Phase 1a 天花板(deterministic 只覆盖罕见清洁类)。
- **性别 2→0**: 唯一正向信号但 n=2 噪声级·且接地组的 陆先生/陆若兰 被归为"名漂移(全程他)"=可能锁了(错的)一致性·不构成净胜。

## 3. 处置(交人签)
- **(a) 进 Phase 2(plan 主攻·推荐)**: 接地注入已证 benign → 付 LLM 把抽取从"清洁类"扩到"涌现型主体"(解耦 LLM 逐段抽全部微事实 entity→value → 运行 ground-truth 账 → 钉喂后续段)。先离线在 72 章证抽取精度(只卡抽错率·漏抽无害)·过了 A/B fork 中段验 factC 主体↓。这是唯一能碰 65% 主体的路·1b 已给注入通道吃下定心丸。
- **(b) 停在确定性·落地小片**: name-drift/性别接地默认开(benign·偶尔接住·无害)·factC 主体留 edit-pass 兜底。诚实但对 factC 主体无效。
- **(c) 重估**: 涌现型身份纠缠(陆先生/陆若兰)部分是 gen3 base 自带的脏(cross-chapter)·或许该先洗 base 或换更干净的 fork 点再测。
- **诚实**: 1b 没证伪也没证实"接地降 factC"——它证的是"接地注入不伤"。真正能降 factC 主体的是 Phase 2 的 LLM 抽取·1b 是它的安全前置。

## 4. 资产
- `app/fact-veto.ts` groundingAssertions(确定性抽取·清洁类) + `app/longrun.ts` NOVEL_FACT_GROUND 接地通道(已四道闸·canary 真写2228字0错)。Phase 2 在此通道加 LLM 抽取层。
- 舰队 `exp/fact-ground-v1/`(40 章·判官标注)·spec `specs/fact-ground/`。
