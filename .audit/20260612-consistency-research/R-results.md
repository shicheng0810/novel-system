# R 写手降本 A/B 结果 · deepseek-v4-flash+thinking vs v4-pro+thinking
> 2026-06-13 · Opus 4.8 执行 R-model-flash-cost-spec · 同纪律: measure-first · 四道 canary · 不碰 gen4 · 人签采纳 · 判官=Opus subagent(与写手模型无关→零自偏)
> 状态: **舰队运行中**(flash-cost-v1·4臂×8章)·本档随结果更新

## 0. 一句话
Pro 太贵 → 测 flash+thinking 能否在结构/文风扛住。**成本赌注 >12×**(价差 12× + thinking 推理 token flash 更省·见 §2)。扛住=省一个数量级。

## 1. 使能(已落·四道闸全绿)
`app/llm-factory.ts` makeLLM 加一行 env 覆盖:
```ts
const model = process.env["NOVEL_DEEPSEEK_MODEL"] ?? cfg.model ?? "deepseek-chat";
```
- 默认不设 env = `?? cfg.model` **逐字节同现状**(gen4 等活世界零影响)。每臂带各自 `NOVEL_DEEPSEEK_MODEL` → 同时跑不同模型互不干扰。
- 闸1 esbuild 绿 · 闸2 tsc 绿 · 闸3 golden 37/37 逐字节(prompt 路径未动) · 闸4 canary 真调用(§2)。

## 2. canary: model-id 验证 + 真 usage(成本铁证)
两 model 串真调用(thinking 模式·prompt"用一个汉字回复:好"):
| model | HTTP | 延迟 | completion_tokens | 其中 reasoning_tokens |
|---|---|---|---|---|
| deepseek-v4-pro | 200 | 0.4s | 80 | **78** |
| deepseek-v4-flash | 200 | 0.3s | 25 | **23** |

- **flash model-id 有效**(200·非 400)→ env 覆盖可用。
- **成本洞察(关键)**: thinking 的 reasoning_token **算 output 计费**。Pro 同一 2 字任务烧 78 推理 token vs flash 23 → **flash 不只单价 1/12·每任务还少烧 ~3× 推理 token** → 实际成本差 **>12×**。⚠ 但"思考少"可能=质量低·正是本实验要测的张力。
- 价(2026-06·platform.deepseek.com 为准): flash $0.14 in/$0.28 out · pro $1.74 in/$3.48 out(每 1M)。

## 3. 现役 Pro 基线(gen4·31 章真数据)
- **均 2978 字/章** · **均延迟 259s/章**(最近稳态 ch28-31: 1840-2909 字)。
- 注: gen4 14:33 写完 ch31 后余额耗尽→402→FallbackLLM→Mock 46字占位→质量闸"疑似生成失败弃重试"正确挡下(没污染正文)→空转 4.5h。**14:xx 充值后自愈·已续写 ch32**(余额一回·重试即成功)。

## 4. 舰队设计(flash-cost-v1·单变量=model)
4 臂 fresh 冷启 ch1-8(开篇=结构一致性最难章·flash 最可能掉·见 R-spec §6):
| 臂 | 角色 | model | 其余 env |
|---|---|---|---|
| B1-pro | 基线(arms[0]·现役) | pro | FACT_LEDGER=2·WARMUP=100 |
| A1-flash | 候选·复本1 | flash | 同 |
| A2-flash | 候选·复本2 | flash | 同 |
| B2-pro | 第二基线=噪声底 | pro | 同 |
- exp-runner 自动设 STYLE=温润/PACK=freeform/WORLD_CONFIG=dukou/**EVOLVE=0**(genome 冻结)/STANDBY=0。
- **单变量**: thinking 下 DeepSeek 忽略 temperature/top_p/penalty(llm.ts:88)→ 两臂采样一致·唯一差=model。冷启 loadGenome 取「同风格最高 fitness cell」(确定性·无随机)→ 4 臂同 genome·无混淆。
- **B2-pro vs B1-pro = 同模型噪声底**: flash 效应须超过此本底才算真(防 d1c paired 把噪声读成信号)。
- 2 flash 复本 = 内置"≥2批防小n运气"(更狠复测纪律)。

## 5. 三轴结果(舰队 4臂×8/8章·2026-06-13)
### ① 质量·判官 5 类(主轴·Opus subagent·每组 16 章)
| 类(低=好) | pro 合计(B1+B2) | flash 合计(A1+A2) | flash/pro |
|---|---|---|---|
| **factualContradiction 事实矛盾** | 1 (B1=1·B2=0) | **10** (A1=4·A2=6) | **🔴 10×** |
| **stateRestate 状态复述** | 2 (1·1) | **10** (5·5) | **5×** |
| objAttribution | 1 (1·0) | 0 | 0.5×(噪声) |
| foreshadowUnclosed | 0 | 0 | — |
| transitionGap | 2 (2·0) | 1 (1·0) | 0.5×(噪声) |
| **结构总命中** | **6** (B1=5·B2=1) | **21** (A1=10·A2=11) | **🔴 3.5×** |
- 判官发现 flash 章=「**alternate takes stitched together**」: 同场摆渡/相遇写 2-3 遍·**每遍微事实各编一版**(船资5↔3文·关系姐夫↔同窗·桂花糕爹做↔娘给·船票"运河东渡"↔"临安济宁"·时辰酉时↔辰时)。正是 P2 命门(四段盲写各编一版)被 flash 弱推理放大 ~10×。
- 噪声底: pro 两臂 5 vs 1(小n世界差)·但 flash(10,11)稳超两臂 → 信号robust。
- **章分布**: flash factC 偏前(A1 集中 ch1-4·ch5-8清; A2 拖到 ch6·ch7-8清)→ 向后收敛·混合档线索(见 §6)。

### ② 确定性轴(exp-runner·同向恶化)
- d1c 套语: pro 3.75/5.5 · flash 7.5/8.5 = **1.7-2.3×↑** | D1-D12: pro 0.25/0.375 · flash 1.5/1.125 = **3-6×↑** | rep4g(噪声底=0): pro 0.057 · flash 0.094/0.074 = **1.3-1.65×↑** | 弃章率全0(没崩)。

### ③ 成本 & 延迟
- **成本**: flash 输出长度 3678/3765 字 ≈ pro 3349/3733(输入同·输出量相当)→ **¥/章 flash ≈ pro/12**(+ canary 实测 flash 推理 token 1/3 → 实际 >12×)。成本赢面巨大且确立。
- **延迟**: flash **反更慢**(A1 44min/A2 43min vs pro B1 35min/B2 38min·8章)→ thinking 净延迟 flash 略高·**无速度优势**。

## 6. VERDICT(2026-06-13·待人签)
**不采纳 flash 整盘替换(wholesale)。** 12× 降本是真·但 flash 在**主轴判官**塌得离谱(factC 10× pro·结构总 3.5× pro·远超 ≤1.3× 容差),且塌在**系统命门**(开篇微事实一致性=整条研究线 P0-P2 一直在打的最难问题)。确定性轴同向(d1c/D系/rep4g 全劣),延迟也无优势。成本省一个数量级 ≠ 值得用命门质量换——温润产品的核心就是这些一致性。
- **幸存假设 = 混合档(开篇 Pro·中段 Flash)**: flash factC 集中开篇 ch1-4 并向 ch7-8 收敛 → 成熟世界中段 flash 或可扛(章号 gate·同 OPENER_CH 思路·可 §2 的 >12× 省在中段 95% 章上)。**但本批只测 ch1-8 全开篇·"中段"未测** → 需独立跟进实验: fork 成熟世界(如 gen4 ch31+)→ flash 写中段 N 章 → 判官扫·与 pro 中段对照。不在本批证。
- **处置选项(交人签)**: (a) 就此结案——pro 留任·flash wholesale 不采纳·混合档存档待后测; (b) 立即跑混合档跟进实验(fork 成熟世界测中段 flash)看能否捞回 12× 降本; (c) 其它。
- **使能码改处置**: `NOVEL_DEEPSEEK_MODEL` env 覆盖默认关·逐字节同现状·无害 → 留作 infra(混合档若上需要它)。

## 7. 资产
- spec: `.novel-output/exp/specs/flash-cost-v1.json` + `flash-hybrid/exp-spec.json` | 报告: `exp/flash-cost-v1/` + `exp/flash-hybrid-v1/exp-report.{json,md}` | base: `exp/bases/gen3vac.db`(gen3 VACUUM 导出)
- 使能: `app/llm-factory.ts` makeLLM `NOVEL_DEEPSEEK_MODEL` 覆盖(四道闸绿·待 verdict 人签后随处置一并提交)

## 8. 混合档跟进(flash-hybrid-v1·fork gen3 中段 ch329-338·2026-06-13)
fork 已归档停跑 gen3(328章·VACUUM INTO 导出·铁律合规)→ 4臂同 ch329 基态续写中段·单变量=model。
### 判官 5 类(每组 20 章)
| 类 | pro(B1+B2) | flash(A1+A2) | flash/pro | vs 开篇 |
|---|---|---|---|---|
| **factualContradiction** | 5 (2+3) | 8 (4+4) | **1.6×** | 🟢 开篇 10× → **暴跌** |
| **stateRestate** | 4 (1+3) | 14 (4+10) | **3.5×** | ≈开篇(没改善) |
| objAttribution/foreshadow/transitionGap | 1/0/0 | 2/1/2 | 噪声 | — |
| **结构总** | **10** | **27** | **2.7×** | 开篇 3.5× → 略降 |
- 确定性: d1c pro 5.8/4.0 · flash 6.3/8.7 = ~1.5×(开篇 1.7-2.3× → 轻); D1-D12 A1=0.9近pro/A2=1.9; rep4g ~1.2-1.3×。弃章率全0。延迟 flash 仍略慢。
- 章长 flash ≈ pro(成本仍 /12)。

### 两大发现
1. **flash factC 灾难是「开篇病」**: 中段 10×→1.6×。328章既立 canon 让 flash 守事实好得多 → 混合档在 factC 轴**成立**。
2. **pro 中段自己也有 factC(5/20)**: 判官把两模型中段章都叫「stitched-together drafts」(静檀↔静安名/巷口↔桥头/林思齐他↔她/绳头来源)。**"四段盲写各编一版"是系统级 bug(分段盲写·见 novel-stitching-coherence),非 flash 独有**; flash 放大它 1.6-2.7×。⚠ 注: 基底 gen3 是晚期饱和世界(ch329)·绝对率或被饱和抬高·但 flash/pro 比(同基态)仍可信。

## 9. 最终 VERDICT(2026-06-13·待人签)
**flash 整盘不采纳(已定)。混合档=边际·不清晰过门。**
- 混合档把 flash 最毒的开篇 factC 从 10× 降到中段 1.6×(成熟世界救回大半)·但 flash 中段**仍全面超 ≤1.3× 容差**: factC 1.6×·stateRestate 3.5×(整场景复述·flash 顽疾)·结构总 2.7×·d1c 1.5×。12× 降本巨大·但 flash 中段仍**多产 2.7× 结构不一致 + 1.5× 套语**·砸在温润产品的核心质量轴上。
- **真问题被照出来**: 中段 factC 是**系统分段盲写 bug**(pro 也犯·5/20)·非模型选择能单独解。**正确投资 = 先治 stitching(段间微事实账+矛盾否决·helps 两个模型)·治完 flash 相对penalty 或缩到 ≤1.3× → 再 flash 复测**。
- **处置选项(人签)**: (a) 结案——pro 留任·flash 整线退休·使能码改留 infra·治 stitching 后再议; (b) 仍上混合档——认 2.7× 中段质量降换 12× 降本(若成本是硬约束); (c) 先投 stitching 研究线(段间账)·治完回头 flash 复测(最有原则·但工期长)。
- 推荐 **(a) 或 (c)**: flash 现状换不来"不伤命门"的降本; 真要 flash 省钱·先把系统 stitching 治了(它本就是 P2 真根因的未竟项·治了 pro 也受益)。
