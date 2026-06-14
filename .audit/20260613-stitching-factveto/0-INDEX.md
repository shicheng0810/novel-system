# factC 治本研究线 · 总索引(2026-06-13/14)
> 一致性研究线第二程: 治 factC(同章事实矛盾)主体。起于写手降本实验照出"factC=系统命门"·终于"撞名根治落地+真根=场景重复"。母线索引见 `.audit/20260612-consistency-research/` + 记忆 `novel-consistency-line`。

## 弧线一句话
**写手降本(flash)不采纳→开 factC 治本→确定性 veto/grounding/Phase2 LLM 三试三不成(测不动或证伪)→唯一真落地 win=撞名根治(确定性免费·治60% cast-confusion)→真根照出=场景重复(值factC的症状)→转新线。**

## 时间线 + 档
| 阶段 | 结论 | 档 |
|---|---|---|
| R 写手降本 flash vs pro | 不采纳(开篇factC 10×·混合档中段仍2.7×)·先治stitching | `../20260612-.../R-results.md` |
| spec v1 | veto设计(后被重框) | `spec.md` |
| 架构评审 | block v1·veto撞zero-FP墙·refactor | `architect-review.md` |
| Phase 1a 确定性veto | 离线证精度·0误检但天花板低(数值安全约束下0产出) | `phase1a-results.md` |
| 交接 Fable | 请写Phase2方案 | `HANDOFF-to-fable.md` |
| Fable 方案 | veto→grounding 重框·三阶段 | `plan-fable.md` |
| Phase 1b 确定性接地 | benign但factC无降(目标罕见测不出) | `phase1b-results.md` |
| factC 真实率重估 | **非base假象·real·结构=60%相似名混淆+40%单章盲写** | `factc-reestimate.md` |
| **撞名根治** | **采纳落地·spawnName给定名防撞+姓池16→85·确定性免费·新世界cast-confusion 1% vs gen3 13-15%** | (code: make-pack) |
| Phase 2 抽取精度 | flash收窄抽取~0抽错·关系类排除 | `phase2-extraction-precision.md` |
| Phase 2 LLM值接地 wire+小A/B | inconclusive(靶罕见) | `phase2-results.md` |
| Phase 2 大样本(新世界×50章) | **证伪·值factC控制2 vs 接地4没降·+42%成本·值factC是场景重复症状** | `phase2-bigsample-results.md` |
| 转向 | 真根=场景重复(stateRestate)→新线 | `../20260614-scene-duplication/diagnosis.md` |

## 落地代码(全在 main·HEAD f050d9a)
- `make-pack.ts` spawnName: 给定名防撞(每名只用一次+gap枚举音节扩池)+内置百家姓扩姓池16→85·forbidden守卫防克隆主角。**= 唯一真落地win·确定性·免费·gated无关(直接改生成)。**
- `llm-factory.ts` makeLLM: +NOVEL_DEEPSEEK_MODEL env覆盖 + modelOverride参(写手/抽取器双模型解耦)。infra·默认不设逐字节同现状。
- `fact-veto.ts`: detectContradiction(确定性检测·性别/称谓法名/数值)+groundingAssertions(确定性接地)+extractValueFacts(Phase2 LLM抽取)。**检测端durable·接地端gated默认关。**
- `longrun.ts`: NOVEL_FACT_GROUND=1(确定性接地)/2(+LLM值接地)·**gated默认关·benign·四道闸过·但A/B证不降factC→不采纳·留码。**
- `exp-runner.ts`: chapters cap 12→60(放行大样本)。

## 三条铁律结论(别回头试)
1. **别再试LLM接地降factC**(veto1a/grounding1b/Phase2大样本·三证不成)。
2. **撞名根治是模型: 确定性+免费+可证**(vs LLM接地测不动/证伪)。
3. **真根=场景重复(4段盲写重述同场景)+写时recall名漂移**·非孤立事实错·接地数字靶错层。
