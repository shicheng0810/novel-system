# Phase 2 大样本 A/B 终裁(新世界·fg-llm-new-v1)
> 2026-06-14 · 4 新世界冷启 ch1-50(2 LLM接地 NOVEL_FACT_GROUND=2 + 2 对照)= 200章 · 两臂pro · 判官=4 Opus subagent(各读50章) · 用户'开新世界做这个'+'跑大样本'

## 0. 一句话
**Phase 2 LLM值接地大样本证伪(不降值factC·控制2 vs 接地4)。值factC几乎全是"场景重复(stateRestate)"的症状(重述场景重编数字)·接地数字治不了根。撞名根治新世界验证有效(精确撞名全消·cast-confusion 1% vs gen3 13-15%)·但写时名漂移残留。**

## 1. factC 子类(每组100章)
| 子类 | 对照B1+B2 | 接地A1+A2 | |
|---|---|---|---|
| 数值(Phase2靶) | 1 | 2 | ground反多 |
| 属性/季节(靶) | 1 | 2 | ground反多 |
| 位置(靶) | 0 | 0 | |
| **值小计(靶)** | **2** | **4** | 🔴 接地没降·反略多(噪声级) |
| 人名漂移 | 2 | 0 | 都低 |
| 性别 | 0 | 0 | |
| **总** | 4(4%) | 4(4%) | 持平 |
- 值factC命中: B2 ch7(漕帮遭遇重述·两枚↔三枚)·A2 ch10(数铜钱4+5+1=10但写九枚还差一枚)·A1 ch1(渡资两枚↔三枚)·A1 ch24/ch40(三月↔小寒季节)。
- **判官共识: 值factC几乎全在"同一场景被写两遍"的重述里**(ch7漕帮遭遇两版·数字各编)。接地喂"渡资两枚"但重述场景整段重编→拦不住。**值factC=stateRestate(场景重复)的症状·非孤立数字错。**

## 2. 成本
- 墙钟: 对照 297/287min vs 接地 411/418min = **+42%**(LLM抽取~4 flash/章·50章)。
- d1c benign(前批已证)。

## 3. 撞名根治验证(新世界 vs gen3 fork)
- 新世界(修好spawnName): 人名漂移2(B1 ch30/47 陆文渊误·熊文渊串)·性别0 → cast-confusion **1%(2/200)**。**精确撞名(4个若兰式)全消**(判官未见任何同给定名撞)。
- gen3 fork(旧spawnName撞名): cast-confusion ~13-15%(人名漂移/性别 5-6/40章)。
- **→ 撞名根治新世界生效·精确撞名根除。** 但**写时名漂移残留**(熊文渊→陆文渊·净慧→净尘·柳青舟ch21=她·冯若兰生死)——这是写者随时间写串名(recall error)·非spawn撞名·spawn修治不了(需canon名接地·另一机制)。

## 4. 最大发现: 值factC与cast-confusion都是更深问题的症状
- **值factC的根 = 场景重复(stateRestate)**: 判官实测新世界stateRestate极重(~14-40/臂·最普遍结构病)·值矛盾几乎全发生在重述的场景里。治值factC要治场景重复(4段盲写重述同场景)·非接地数字。
- **残留cast-confusion的根 = 写时名漂移(recall error)**: 非spawn撞名·需canon名接地(deriveCanon已注派系/境界但不注名消歧)。
- 两者都指向: **4段盲写重述场景 + 写者跨段/跨章recall漂移** = stitching-coherence线的更深层(FACT_LEDGER v2治复述但实测stateRestate仍重·没治住)。

## 5. VERDICT(人签)
- **Phase 2 LLM值接地: 不采纳**(大样本证伪·不降值factC·+42%成本·值factC是场景重复症状·接地数字靶错层)。码gated留档benign。
- **撞名根治: 采纳已落地**(确定性·免费·精确撞名根除·新世界cast-confusion 1% vs gen3 13-15%)。
- **真根(下一项if继续): 场景重复(stateRestate)** = 值factC + 部分cast-confusion的共同根。FACT_LEDGER v2没治住。属stitching-coherence线深层·非本程轻量解。
- **诚实**: 折腾一整条线·确定性免费的撞名根治是唯一真落地win; LLM接地(veto/grounding/Phase2)三试三不成(测不出或证伪)·因factC各子类要么太罕见测不动·要么是更深场景重复的症状。
