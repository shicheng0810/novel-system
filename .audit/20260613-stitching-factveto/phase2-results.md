# Phase 2 LLM 值接地 A/B 结果(fact-ground-llm-v1)
> 2026-06-14 · fork gen3 中段 ch329-338 · 4臂(2 LLM接地 NOVEL_FACT_GROUND=2 + 2 对照)· 两臂pro · 判官=Opus subagent

## 0. 一句话
**LLM 值接地 benign(d1c不动)·但 +~45%墙钟成本·主轴(值factC)inconclusive(靶太罕见测不出·数值control1→ground0仅n=1)。同OFS/Phase1b"base太干净测不出靶"墙。**

## 1. 三轴
### 主轴·判官 factualContradiction 子类(每组20章)
| 子类 | 对照B1+B2 | 接地A1+A2 | |
|---|---|---|---|
| **数值**(Phase2靶) | 1(粽子count) | **0** | ground少·但n=1 |
| **位置**(靶) | 0 | 0 | 都没发生 |
| **属性**(靶) | 0 | 0 | 都没发生 |
| 人名漂移(非靶·cast-confusion) | 0 | 3(陆云归/陆先生·沈文渊) | ground多(噪声) |
| 性别(非靶) | 2 | 1 | |
| **factC总** | 3 | 4 | 持平 |
- Phase2 LLM抽取靶=数值/位置/属性·这批 control 仅 1 数值(粽子)·接地组 0·但 n=1 无统计意义。位置/属性两组皆 0(没发生)。
- 实际 factC 主体=人名漂移+性别(cast-confusion·gen3 fork继承存量撞名)·非 Phase2 靶(spawn修治)·接地组反多3(噪声·LLM抽取已收窄排除实体关系故不影响cast-confusion)。

### 副轴·成本+benign
- d1c: control 3.8/6.2 · 接地 4.7/5.3(在对照噪声带内·benign·接地注入不炸套语)。
- **成本: 墙钟 control 56/50min vs 接地 80/74min = +~45%**(LLM抽取~12 flash/章·~2.4min/章)。flash token便宜但延迟+45%是真。
- 章长/cv/弃章率/D系: 噪声级·无害。

## 2. 裁断: inconclusive·不建议上(成本真·收益未证)
- **副轴benign+主轴测不出+成本+45%** → Phase2 LLM值接地**机制成立但收益不可证**(靶子类太罕见·10章×2臂测不出·数值1→0仅n=1 directional hint)。
- **根本问题(全consistency线通病)**: factC各子类个体太罕见(~1/20章)·10章×2臂批量**测不出任一子类的降幅**(OFS/Phase1b/Phase2三次同墙)。要测得动需 ≥50章/臂 或 更脏base。
- **对比**: 撞名根治(cast-confusion 60%)是**确定性证明**(no两个若兰→无从混·非A/B)·零成本。Phase2(值40%)只能A/B但**测不动**·且+45%成本。
- **诚实推荐**: **不上 Phase 2**(成本真·收益不可证·spawn修已免费拿下60%大头)。Phase2码gated留档(benign)·若日后值factC成实测优先项+愿跑大样本(50章/臂)再验。

## 3. 处置选项(人签)
- (a) **不上Phase2·留码gated**(推荐): 撞名根治(确定性·免费·60%)是真win·Phase2收益不可证+45%成本不值。值factC留edit-pass兜底。
- (b) 跑大样本验(50章/臂·或fork更脏base)证值factC降幅: 严谨但贵(数小时×多世界)+成本+45%。
- (c) 凭机制+n=1 directional hint上Phase2: 违"无证不采纳"纪律·不建议。
