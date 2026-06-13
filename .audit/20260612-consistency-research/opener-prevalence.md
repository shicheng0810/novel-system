# 开篇矛盾/转场 发率基线(P2 Phase A · measure-first)
> 2026-06-13 · Opus 执行 P2-opener-facts-spec §Phase A · 判官=Opus subagent(扩两类后)

## 0. 一句话
**开篇(ch1-5)factualContradiction ≈17%(中段 0%·好章 0%)= 远过 8% 开篇门槛 → Phase B 放行。** transitionGap 开篇 ≈8%(至门槛)。判官扩两类验收过(gen4 ch3 三 bug 全中·好章 0 误杀)。

## 1. 判官扩两类验收(A1)
`consistency-judge.ts` JUDGE_CLASSES + schema 加 `factualContradiction`(同章同一事实冲突值: 数值/规则/属性)+ `transitionGap`(角色未经移动/入场即现身某地)。esbuild/tsc 绿。
- **验证(gen4 ch3《一篙撑不开的雾》·已知三 bug)**: factualContradiction×2(「一个铜板」↔「三文」船钱·「就我一条船」↔「上月坐的别家船」)+ transitionGap×1(「柳青舟从听雨茶楼出来」·前文柳一直在渡口撑船、上茶楼的是陆云归)。**3/3 全中。**
- **误杀控制(renjian-killed 好章 ch1-3)**: 两类 0/3。✓ 干净判别器(同 stateRestate 标准)。

## 2. 开篇专项发率(A2·judge 抽样)
| 语料段 | n | factualContradiction | transitionGap |
|---|---|---|---|
| **开篇 ch1-5**(gen4 ch1-4 + gen3 ch1-5 + gen1 ch1-3) | 12 | **2(17%)** | 1(8%) |
| 中段对照(gen3 ch50-52) | 3 | 0(0%) | 0(0%) |
| 好章基准(renjian-killed ch1-3) | 3 | 0(0%) | 0(0%) |

**命中明细**:
- factualContradiction: gen4 ch3(船钱+独条船)、gen3 ch1(「歪脖子老槐」↔「歪脖子柳树」=同一渡口地标树先槐后柳·属性矛盾)。
- transitionGap: gen4 ch3(柳青舟瞬移)。
- **gen3 ch1 是新发现的独立实例**(非 gen4 ch3 单点)·且是不同型(树种属性 vs 数值)→ 证开篇矛盾是模式非偶发。

## 3. 裁断
- **开篇 factualContradiction 17% >> 8% 门槛**·中段 0%·好章 0% → **clean signal + 开篇专属 + 过门槛 → Phase B 放行**(机理印证: 开篇是事实一致性最难章·canon.json 开篇尚空·in-medias-res 把最多首次确立事实塞 ch1)。
- transitionGap 8% 至门槛·随 B3 转场守卫一并接(复用现机制·成本低)。
- **B 靶心**: OFS 开篇事实底牌(配置 worlds/<saga>.json 既有硬事实→seed ch1·数据型避套语)主治"改名/换数/角色错位/瞬移";B3 章内矛盾守卫(扩 FACT_LEDGER 数值/规则轨)接"同章被推翻"(1→3文)。
- **诚实边界**: 涌现型新规则矛盾("独条船"非配置已有·ch1 现编)只 B3 章内守卫接其"同章推翻"部分·真预防需选配世界规则抽取(A2 未显示规则型占多·暂不上)。

## 4. 下一步 = Phase B(OFS + 矛盾守卫·动 longrun→四道 canary + A/B 舰队·不碰 gen4·人签采纳)
