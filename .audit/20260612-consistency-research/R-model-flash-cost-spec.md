# R 实验规格 · 写手模型降本 deepseek-v4-flash+thinking vs v4-pro
> 2026-06-14 · 交接 Claude CLI(Opus 4.8)执行 · 动机: v4-pro 太贵
> 同纪律: measure-first · A/B 舰队 · 四道 canary · 不碰 gen3/gen4 · 人签采纳 · 判官用独立模型(本就 Opus subagent·与写手模型无关→零自偏)

## 0. 一句话与赌注
现役写手 = `deepseek-v4-pro` + thinking(reasoning_effort=high)。测 **`deepseek-v4-flash` + thinking** 能否在结构/文风轴扛住。**成本赌注极大: Flash ≈ Pro 的 1/12**(输入 $0.14 vs $1.74、输出 $0.28 vs $3.48 每 1M token·2026-06)。扛住 = 直接省一个数量级。

## 1. 单变量设计(干净)
- 现役 thinking 已开(`cfg.thinking ?? true`); thinking 模式下 DeepSeek **忽略 temperature/top_p/penalty**(`core/services/llm.ts:88`)→ 两臂采样一致, **唯一变量 = model**。
- 臂A = `deepseek-v4-flash` + thinking · 臂B = `deepseek-v4-pro` + thinking(对照=现役)。
- ⚠ 先核 API 实际接受的 model id 串(配置现用 `deepseek-v4-pro`·flash 串假定 `deepseek-v4-flash`·跑前 1 次真调用验证不报 400)。

## 2. 使能(per-arm 模型并行·需小改)
`llm-config.json` 是全局单文件、且 `readLLMConfig` 文件优先于 env(`app/llm-factory.ts:34`)→ 两臂没法靠全局文件同时跑不同模型。最小改:
- 在 `makeLLM`/`readLLMConfig` 加一行 **env 覆盖**: `model: process.env["NOVEL_DEEPSEEK_MODEL"] ?? cfg.model`(env 存在则盖过文件·仅实验用·默认不设=零生产影响)。每个舰队臂进程带各自 `NOVEL_DEEPSEEK_MODEL` → 同时跑不同模型、互不干扰。
- 动 llm-factory → **四道闸**(esbuild + tsc + golden + 产线 env canary)。不设 env 时 `?? cfg.model` 逐字节同现状。
- 备选(免改码): 顺序跑——先全局设 flash 跑臂A、再设 pro 跑臂B·fresh 目录各一·接受时间分离(但同栈同配置·可信度尚可)。优先 env 覆盖法。

## 3. 舰队(不碰 gen3/gen4)
fresh 冷启双臂·同 `worlds/dukou.json`·`NOVEL_WARMUP=100`·各 ch1–8·≥2 批(trial 复测纪律·防小 n 运气):
```
臂A: NOVEL_DEEPSEEK_MODEL=deepseek-v4-flash NOVEL_STYLE=温润 NOVEL_PACK=freeform \
     NOVEL_WORLD_CONFIG=.novel-output/worlds/dukou.json NOVEL_SAGA_DIR=flash-armA \
     NOVEL_FACT_LEDGER=2 NOVEL_WARMUP=100 NOVEL_TARGET=8 npx tsx app/longrun.ts
臂B: NOVEL_DEEPSEEK_MODEL=deepseek-v4-pro  …(其余同)… NOVEL_SAGA_DIR=pro-armB
```
(FACT_LEDGER=2 两臂都带=与现役生产态一致·只比模型)

## 4. 量三轴
**① 质量(主·能否扛住)**
- 判官 5 类发率(objAttribution/stateRestate/foreshadowUnclosed/factualContradiction/transitionGap·Opus subagent)——尤其**结构微事实**这块 flash 最可能掉。
- 确定性 D 系 flags + d1c 套语 + edit-pass 喻/k + 密度(warm-fitness)。
- **人读 2–3 章/臂**(结构轴判官兜底·文风/韵味只能人读)。
**② 成本(主动机·量真账)**
- 抓每章 token usage: 现 `core/services/llm.ts` 只取 content **丢了 usage**→ Opus 需在 DeepSeek 响应里读 `usage`(prompt_tokens/completion_tokens)落日志; 或退而用 prompt+completion 字数估 token。
- × 现价(Flash $0.14/$0.28·Pro $1.74/$3.48 每 1M)→ **¥/章** 对比。
**③ 延迟**: s/章(落章日志已有 `(254s)`)。Flash 单 token 快、但 thinking 加思考延迟→净延迟是实证问题·须量。

## 5. 判据(成本主导·质量设容差)
- **采纳 Flash**: 判官结构类发率 A ≤ B×1.3(不显著恶化)且 d1c 不炸 且人读文风可接受 → 凭 ~12× 降本**强烈建议切**。
- **混合档(若 Flash 中段扛住、开篇掉)**: 开篇 ch1–N 用 Pro(最难章·已知 factC 17%)、中段用 Flash——捕获绝大部分省钱又护住最难章。`longrun` 可按 `n<=OPENER_CH` 切 model(同 OPENER_FACTS 的章号 gate 思路)。
- **不采纳**: Flash 结构/文风明显塌 且 thinking 补不回 → 留 Pro·记档。
- 采纳须**人签**后改生产 `llm-config.json` model(或设混合档的章号 gate)。

## 6. 永久不做 / 边界
- 不在 gen3/gen4 活世界上直接换模型试(用 fresh 舰队)。
- thinking 关掉那条不测(用户要的是 flash+thinking·且非思考下采样参数才生效=另一变量·别混)。
- 诚实预期: flash 作为 cost-effective 档·flagship reasoning 弱于 pro→**最可能在"开篇微事实一致性"和"温润文风韵味"两处掉**·这两处正是本项目难点·所以质量量测重点压在判官结构类 + 人读韵味, 不能只看"读着通顺"。

## 7. 来源(定价·2026-06)
OpenRouter / devtk.ai / cloudzero 等: Flash $0.14 in / $0.28 out、Pro $1.74 in / $3.48 out(每 1M token)·Flash 支持 thinking/非 thinking。跑前以 platform.deepseek.com 官方价为准。
