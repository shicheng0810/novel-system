# Compose 慢的根因分析

## 一次 `/api/writing/compose` 调多少 LLM？

代码路径：`workbench/server.ts compose()` → `WritingJob` 6 阶段全跑。但 6 阶段里只有 4 个真的调 DeepSeek：

| 阶段 | DeepSeek 调用 | workload | thinkingMode 实际值 | 备注 |
|---|---|---|---|---|
| memory-read | 0 | — | — | 本地 JSON 检索 |
| **blueprint** | 1 × `requestStructuredTool` | structured | **disabled**（强制） | 用 tool-calling，已被代码强制关 thinking |
| **scene-expand** | 1 × `requestStructuredTool` | structured | **disabled**（强制） | 同上 |
| **synthesize** | 1 + 最多 3 × `requestPlainText` | prose | **你配的 enabled** | **最慢的一环**，长度修复循环最多再加 3 次 |
| **critique** | 1 × `requestStructuredTool` | structured | **disabled**（强制） | tool-calling |
| memory-write | 0 | — | — | 本地写文件 |

**最坏情况 = 1 plan + 1 expand + 4 synthesize + 1 critique = 7 次串行 HTTP**。
**典型情况 = 4 次**（synthesize 一次过）。

## 每一次 DeepSeek 调用的耗时来源

源码 `src/deepseek.ts:316-415 executeRequest`：

```
requestBody.thinking = { type: "enabled" }
requestBody.reasoning_effort = "high"     ← 你当前配置
requestBody.stream = false                ← 关键 #1：UI 必须等完整响应
requestBody.max_tokens = 4200 (prose workload)
timeoutMs = 600_000  ← 关键 #2：单次最长允许 10 分钟
maxRetries = 默认 3                       ← 关键 #3：失败重试不打折
```

**Thinking + reasoning_effort=high 在 DeepSeek v4-pro 上**：
- 模型先输出 thinking trace（几千到几万 token）
- 再输出最终答案
- 全程**不流式**，必须等模型把整段 thinking + 答案吐完才回 HTTP
- 公开 benchmark：单次调用 30-120s，长度敏感

## 预估端到端耗时

| Stage | 单次耗时（thinking disabled） | 单次耗时（thinking enabled · high） | 调用次数 |
|---|---|---|---|
| blueprint (structured) | 5-15s | — | 1 |
| scene-expand (structured) | 5-15s | — | 1 |
| synthesize (prose) | — | **30-120s** | 1-4 |
| critique (structured) | 5-15s | — | 1 |

**乐观估计**：5+5+30+5 = **45 秒**
**真实估计（synthesize 一次过 + thinking）**：10+10+90+10 = **2 分钟**
**最坏（长度修 3 次）**：10+10+(90×4)+10 = **6 分 30 秒**

如果用户感觉"几分钟"——完全在预期范围。如果"十几分钟"——长度修复循环每次都触发了。

## 你当前配置（已确认）

```
thinkingMode: "enabled"
reasoningEffort: "high"
timeoutMs: 600000  (10min/call)
maxOutputTokens: 384000
contextWindowTokens: 1000000
```

## 5 个真因（排序按"修了立刻见效"）

### 1️⃣ thinkingMode=enabled 让 synthesize 走 thinking 路径

最大一刀。看 `deepseek.ts:351-353`：
```ts
const requestThinkingMode =
  input.workload === "structured" || input.promptVersion === "writer.composer-length.deepseek.v1"
    ? "disabled"
    : config.thinkingMode;
```

只有 `structured` workload + 长度修复 prompt 自动关 thinking。**主 synthesize 调用** workload="prose" → 沿用你的 enabled → 多花 60-90s/章。

**修法**：设置里把 thinkingMode 改 `disabled`。Chapter 质量稍降，速度立刻 3-5×。

### 2️⃣ 流式没接

`requestBody.stream = false` 在 `executeRequest` 写死。
- 模型即使 5s 就开始吐字，UI 也要等整段才显示
- 主观速度感差，用户觉得"卡住了"
- DeepSeek API **支持** SSE streaming

**修法**：把 `stream: true` 接上，前端用 SSE 渲染。**真耗时不变，但主观感觉减半**。

### 3️⃣ 长度修复循环 (`MAX_LENGTH_REPAIR_ATTEMPTS = 3`)

`deepseek.ts:44` 写死 3 次。每次失败就再调一次 LLM。如果你的 `targetLength: [2800, 3300]` 太严，模型每次都偏 200 字，就要修 3 次 = 多 3 次 LLM 调用。

**修法**：
- 把范围放宽到 [2500, 3500]（更宽容）
- 或降到 `MAX_LENGTH_REPAIR_ATTEMPTS = 1`
- 或纯做客户端 hardFit（已存在 `hardFitOverlongChapter` 函数）跳过 LLM 修复

### 4️⃣ 串行 pipeline，4-7 次顺序调用

`WritingJob.executeStage` 是严格串行：blueprint → scene-expand → synthesize → critique。

实际可并行的：
- **plan 完成后 sceneCards 才能展**——这条强依赖
- **plan + memoryRead** 可并行（一个跑 LLM 一个读 JSON）
- **critique 可异步**——compose 不等 critic 完成就返回，前端单独 poll

**修法**：把 critique 独立成"复核"按钮，compose 默认跳过。立刻省 1 个 LLM 调用 = -10s 体感。

### 5️⃣ timeoutMs=600000 让失败感受拉长

`config.timeoutMs = 600_000` + `Math.max(config.timeoutMs, 150_000)` ≈ 10 分钟单次。
若 DeepSeek 卡了，得等 10 分钟才 abort，再加 maxRetries=3 次重试 → 最坏 **40 分钟**纯网络坏运气。

**修法**：把 timeoutMs 降到 180000 (3 分钟)，重试 1 次。失败更快，恢复更快。

## 顺序推荐（按 cost-benefit）

| 优先级 | 改动 | 工作量 | 预期提速 |
|---|---|---|---|
| **现在就改** | settings.thinkingMode → "disabled" | 5 秒（UI 改一下） | **3-5×** |
| **现在就改** | targetLength 范围放宽到 [2500, 3500] | 5 秒（lens 表单） | 跳过修复循环 |
| 小重构 | 把 critique 拆出 compose | 30 分钟 | -10s 体感 |
| 小重构 | stream:true + 前端 SSE | 2 小时 | 主观速度 2-3× |
| 配置 | timeoutMs 降到 180000 | 5 秒 | 失败更快 |
