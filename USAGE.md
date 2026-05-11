# Novel System v2 · 使用指南

> 一个常驻 agent 化的中文修仙小说创作系统：世界历史模拟器为核心 + 八字奇门作概率先验 + 章节文本是模拟的副产品。
>
> 本指南覆盖 W1–W4.5 的所有能力。W5（云部署）/ W6（feed UI）暂未实施。

---

## 1. 一句话定位

**这不是 Sudowrite 那种"AI 帮你续写一段"的工具，是"世界一直在跑、章节按节奏自然产出"的常驻 agent 系统。** 你的角色是**世界的宪法制定者** + 高风险事件的裁决者，不是文本作者。

---

## 2. 启动

### 2.1 装依赖（一次）

```bash
cd "/Users/chris0810/Documents/Codex/Novel System"
npm install                          # 根项目（含 lunar-javascript / better-sqlite3 / langgraph 等）
npm run workbench:install            # 前端（workbench/）
```

### 2.2 跑

```bash
npm run workbench:dev
```

打开 `http://127.0.0.1:5173/`。前端 Vite middleware 调本地 server（embedded in `workbench/src/server.ts`）—— 单一进程，无独立后端。

### 2.3 如果端口占用

`vite` 自动找下一个端口，看终端输出。

### 2.4 前端 UX 速览（合并后的 workbench shell）

```
┌─ Topbar ──────────── provider · model · line · ⌘K · AI 设置 ─┐
│                                                              │
│ A │  ┌─ canvas dock ─ 章节标题 · 字数 · ▶续写 · /提示 · 📐 ─┐ │
│ c │  │                                                    │ │
│ t │  │  WritingCanvas（prose 画布 + lens 折叠抽屉 +       │ │ Codex Rail
│ i │  │  chapter card + 💬 写续段 + 局部重写 + critic）      │ │ ┌─ tabs ──┐
│ v │  │                                                    │ │ │当前/世界│
│ B │  └────────────────────────────────────────────────────┘ │ │ 记忆/图谱│
│ a │  ┌─ BottomPanel（折叠头 / 推演 · Runtime 双 tab）──────┐ │ │ Now: 角色│
│ r │  │  阶段输入 / 阶段时间线 · Runtime 状态 / Runs / 详情  │ │ │ 关系 …  │
│   │  └────────────────────────────────────────────────────┘ │ └──────────┘
└───────────────────── Status Bar · ▢/▶ Runtime pill ─────────┘
```

**核心交互**：
- **主画布常驻** —— 点 Activity Bar 的"世界 / 记 / 图"只翻 Codex Rail 的 tab，画布不被换页吞掉
- **`⌘K`** 命令面板：跳场景 / 切线 / 触发 compose / tick / 切 Codex tab
- **写续段输入 `/`** 弹 inline 菜单：`/续写 /复核 /重写 /tick /切场景 /终稿`
- **`⌘\\`** 折叠 Codex Rail；**`⌘⇧\\`** 折叠 Activity Bar；**`⌘.`** typewriter；**`F11`** 全屏；**`Esc`** 关闭 overlay
- **Runtime pill** 在 Status Bar 右下，点击展开 BottomPanel → Runtime tab
- **localStorage 记上次场景**，刷新后自动恢复

---

## 3. 配 AI 设置（启动 LLM 路径）

不配也能跑——会走启发式 reflect/plan、本地 mock 不调网络。配了之后：
- 角色反思 / 计划用真 LLM (CRITIC-grounded)
- DeepSeek 生成完整章节、critique、scene-card 全开

### 步骤

前端打开后右上角 **AI 设置**（或 POST `/api/settings/ai` JSON）：

```json
{
  "apiKey": "sk-...",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-v4-pro",
  "timeoutMs": 600000,
  "thinkingMode": "disabled",
  "reasoningEffort": "high",
  "contextWindowTokens": 1000000,
  "maxOutputTokens": 384000
}
```

存到 `~/.config/WorldHistoryEngine/studio-config.json`（macOS）或 `%LOCALAPPDATA%\WorldHistoryEngine\studio-config.json`（Windows）。

下次启动时，runtime daemon 自动读这个文件并把 LLM 接进去；无 key 时静默退化为启发式。

**Embedding** 同样可选——如要开 W4.5 vector hybrid，把 embedding 模型设进去（OpenAI 兼容 `/embeddings` 接口）。当前 workbench server 默认不开嵌入；要在你的代码里手动构造 `HttpEmbeddingProvider` 传给 `StoryMemoryStore.create({ embedder })`。

---

## 4. 输入：世界 Markdown

世界从一段结构化 Markdown 开始。范例（项目里 `corpus/` 有完整版本）：

```markdown
# 世界设定
题材：东方玄幻/修仙
时间尺度：阶段
修炼体系：灵海、化罡、真传
世界规则：
- 玄脉共鸣会放大角色的欲望与执念
- 宗门资源稀缺时，外门与真传的矛盾会激化

# 势力
- 青岳宗：名门正宗，控制地火丹炉
- 幽潮殿：潜伏北荒，以夺取玄脉为目标

# 地点
- 外门山城：青岳宗外门弟子聚居之地
- 地火丹谷：炼丹重地，失守会引发大乱

# 角色
- 林焰 | description=少年心火盛 | faction=青岳宗 | role=外门弟子 | traits=倔强,护短,求突破 | goal=拿到真传名额 | stance=守宗 | resource=赤纹残图
- 苏雪 | baziRaw=辛巳,癸酉,己亥,乙丑 | description=外冷内热 | faction=青岳宗 | role=丹谷执事 | traits=冷静,克制,重情 | goal=守住丹谷 | stance=守宗 | resource=地火炉令

# 关系
- 林焰 <-> 苏雪 | status=盟友 | history=苏雪曾暗中保下林焰 | tension=信任下的压抑情愫

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额
- 苏雪 | cannot=无因失守底线 | must_trend=守与情之间摇摆 | stage_goal=守住丹谷

# 关系锚点
- 林焰 <-> 苏雪 | boundary=不能无因反目成仇 | trend=盟友走向紧绷
```

**关键字段语义**：

- `baziRaw="辛巳,癸酉,己亥,乙丑"` —— 4 柱（年/月/日/时），系统会按子平派 + 23:00 day-change 解析。或者用 `archetypeDraft="水金偏旺、谋定后动"` 跳过真八字
- `cannot` / `mustTrend` / `stageGoal` —— **硬约束**，CanonGate 会按这些拒绝违反锚点的分支
- `goal` / `stance` —— 软推力，影响角色 agent 的 plan
- `resource` —— 已知法宝/资源（写章节时 xianxia verifier 会查"凭空出现"）

通过前端 **世界 / Apply** 按钮提交。**Apply 是破坏性操作**——会重建整个推演 + 写作上下文（旧的章节草稿不丢，但 lens / 选中分支 / 当前阶段会重置）。

---

## 5. 核心工作流

### 5.1 让世界一直跑（Daemon）

```bash
# 启动后台推演（target=20 阶段）
curl -X POST http://127.0.0.1:5173/api/runtime/start \
  -H "Content-Type: application/json" \
  -d '{"targetTicks":20,"reason":"manual","requestedBy":"author"}'
```

**Director 会自动接管**：
- 5-phase 3-act 节奏（开端/上升/高潮/下降/结尾）—— 比如 20 阶段的 climax 在 stage 13-16
- 焦点轮换（recency penalty 避免连续 3 阶段同一主角）
- Tension EMA 跟踪
- Qimen pattern 按 phase 选（exposition=休门、climax=惊门）

每 3 个 tick 触发**全角色 reflection**（CRITIC-grounded，要求引用具体 memory id）。

后台跑着的状态：

```bash
curl http://127.0.0.1:5173/api/runtime/status
```

返回 `{active, paused, completed, completedTicks/targetTicks, lastStageLabel, runIds, pauseReason}`。

### 5.2 高风险阶段会暂停等你拍板

当 CanonGate 命中 `requireAuthorOnCanonRisk: true` + 强奇门 (strongSituationScore≥3) 或 锚点违反风险，daemon 会自动 `paused`。`pauseReason` 会说明原因。

继续：
```bash
# 如果是高风险但你接受，先在前端选一个分支扶正：
curl -X POST http://127.0.0.1:5173/api/simulation/promote-branch \
  -H "Content-Type: application/json" \
  -d '{"branchId":"stage-3-surge"}'

# 或直接 resume（会从 paused checkpoint 续）：
curl -X POST http://127.0.0.1:5173/api/runtime/resume
```

### 5.3 暂停 / 单步 / 终止

```bash
curl -X POST http://127.0.0.1:5173/api/runtime/pause     # 优雅暂停（当前 tick 跑完后停）
curl -X POST http://127.0.0.1:5173/api/runtime/tick      # 单步推一阶段
```

LangGraph SqliteSaver 持久化在 `.novel-system/runtime-daemon.sqlite`——**进程被 kill -9 也能从最后一个 tick 续**。

### 5.4 写章节

Daemon 推世界，**章节是单独触发的**（写作不在 daemon 主路径上）：

```bash
curl -X POST http://127.0.0.1:5173/api/writing/compose \
  -H "Content-Type: application/json" \
  -d '{
    "focusCharacterIds": ["苏雪","林焰"],
    "stageId": "stage-2",
    "chapterGoal": "推进核心冲突，让苏雪做不可逆的选择",
    "sceneCount": 5,
    "targetLength": [2800, 3300],
    "factConstraint": "medium-expansion"
  }'
```

**6 段流水线**会跑（每段都有 checkpoint）：
```
memory-read   → 从 SQLite-FTS5 + vector hybrid 拉相关记忆
   ↓
blueprint     → 章节蓝图（goal / scene 列表 / 语调）
   ↓
scene-expand  → 5 个 SceneCard
   ↓
synthesize    → 完整正文（DeepSeek，2800–3300 字）
   ↓
critique      → ReviewReport + anti-slop 检测 + xianxia verifier
   ↓
memory-write  → 通过 critique 的场景写入 expressions（下一章可复用）
```

W4 检测会自动跑——critique 后的 review 里会有：
- `[anti-slop:simile-overuse] 比喻词使用过密：8 处（每千字 4.5）...`
- `[xianxia:realm-regression] 林焰 境界从 "化罡" 退回到 "灵海"`
- `slop-score=4.3/10`

不过 critique 即使报警告，章节仍会进 expressions 记忆，除非有 xianxia **blocker**（境界回退、五行严重冲突）。

### 5.5 检查记忆（搜索 + 排名）

```bash
curl http://127.0.0.1:5173/api/memory
```

返回 `{facts, expressions, foreshadows, revisions}`。

要做相关性搜索，调 `StoryMemoryStore.recall()` 或 `recallHybrid()`（API 还没暴露——下方编程接口部分有用法）。

### 5.6 加新角色（动态扩张）

不必修改 Markdown 重新 Apply。直接在代码里：

```ts
import { synthesizeCharacter, WorldHistoryEngine } from "@core/index";

const engine = /* current engine instance */;
const synth = synthesizeCharacter({
  name: "韩煜",
  hint: { faction: "天炎门", role: "护法" },
  introducedBy: { id: "苏雪", name: "苏雪" },
});
engine.addCharacter(synth);
// 接下来 daemon tick 时 Director 会自动把 韩煜 纳入焦点池
```

未来下一个 stage 焦点选择会自动考虑 `韩煜`（recency 长期未见 + anchor pressure 都给加分）。Director 用 callback `parsed: () => engine.getParsedWorld()` 读最新角色集。

---

## 6. 数据存储位置

| 路径 | 内容 | 可删？ |
|---|---|---|
| `memory/store.json` | **源真相**：facts/expressions/foreshadows/revisions（JSON）| ❌ 千万不要 |
| `memory/index.sqlite{,-wal,-shm}` | FTS5 + vector 索引（可重建） | ✅ 删后重启会自动 rebuild |
| `.novel-system/runtime-daemon.sqlite{,-wal,-shm}` | LangGraph daemon 状态 + checkpoint | ⚠️ 删后丢"daemon 跑到第几个 tick"信息但不丢世界状态 |
| `.novel-system/runs/` | 每次 simulation run 的 artifact（reasoning trace、context pack 等） | ✅ 删可，但失去回看能力 |
| `.novel-system/checkpoints/` | 写作流水线 checkpoint | ✅ 删可，影响写作恢复 |
| `~/.config/WorldHistoryEngine/studio-config.json` | AI 设置（含 API key） | ⚠️ 删等于退出 LLM 模式 |

---

## 7. 编程接口（自己写脚本）

```ts
import {
  // W0 / W2 D2: 世界
  WorldHistoryEngine, parseWorldDraft, synthesizeCharacter,

  // W1: 命理 + 记忆 + Daemon
  computeBaziFromBirth, parseBaziSpec,
  StoryMemoryStore,
  GraphRuntimeDaemon, NovelRuntimeKernel, SimulationRunStore,

  // W2 D1: Director
  Director,

  // W3: Per-character agents
  AgentRegistry, CharacterAgent,

  // W3.5: LLM-driven reflect/plan
  HttpAgentLLMProvider, MockAgentLLMProvider, buildLLMAgentFns,

  // W4: 写作时检测
  sanitizeProse, verifyXianxia,

  // W4.5: Vector embedding
  HttpEmbeddingProvider, MockEmbeddingProvider,
} from "@core/index"; // workbench tsconfig 的 path alias，或自行调整

// === 1. 世界 + 引擎 ===
const md = `# 世界设定 ... (你的世界 Markdown)`;
const parsed = parseWorldDraft(md);
const engine = new WorldHistoryEngine(parsed);

// === 2. 记忆 + 索引 (with optional vector embedder) ===
const embedder = process.env.OPENAI_API_KEY
  ? new HttpEmbeddingProvider({
      apiKey: process.env.OPENAI_API_KEY!,
      baseUrl: "https://api.openai.com/v1",
      model: "text-embedding-3-small",
    })
  : new MockEmbeddingProvider({ dim: 64 }); // 或 undefined

const memoryStore = await StoryMemoryStore.create({
  rootDir: "./.novel-system",
  embedder,
});

// hybrid recall:
const hits = await memoryStore.recallHybrid({
  lineId: "canon",
  q: "苏雪 丹谷 封锁",
  characterIds: ["苏雪"],
  limit: 10,
});
// hits[i].scores = { relevance, recency, importance, semantic, total }

// === 3. Director + per-character agents ===
const director = new Director({
  parsed: () => engine.getParsedWorld(),  // 用 callback 才能跟上动态角色
  totalStages: 30,                         // 用于 phase 映射
});
const agentRegistry = new AgentRegistry({
  parsed: () => engine.getParsedWorld(),
});

// === 4. LLM-backed reflect/plan (CRITIC-grounded) ===
const llm = new HttpAgentLLMProvider({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
});
const { reflectFn, planFn } = buildLLMAgentFns(llm);

// === 5. 常驻 daemon ===
const runStore = new SimulationRunStore({ rootDir: "./.novel-system" });
const kernel = new NovelRuntimeKernel({
  engine, runStore,
  config: {
    worldId: "my-novel",
    tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
    autonomy: {
      autoPromote: "never",
      requireAuthorOnCanonRisk: true,
      requireAuthorOnHardDecision: true,
    },
    storage: { runRoot: "./.novel-system", checkpointEveryStep: true },
  },
});

const daemon = new GraphRuntimeDaemon({
  kernel, engine, director, agentRegistry,
  reflectEveryNTicks: 3,
  reflectFn, planFn,
  defaultDirective: { stageLabel: "auto", focusCharacterIds: [parsed.characters[0].id] },
  checkpointPath: "./.novel-system/runtime-daemon.sqlite",
  threadId: "my-novel-main",
  onTickResult: async (result) => {
    console.log("tick:", result.runId, result.status);
  },
});

daemon.start({
  targetTicks: 30,
  reason: "scheduled",
  requestedBy: "author",
});

// 异步等完
const final = await daemon.waitForIdle();
console.log("daemon final:", final);

// === 6. 跨进程恢复 ===
// 进程被 kill 后再次启动，daemon 会从 checkpoint 续:
const daemonReborn = new GraphRuntimeDaemon({/* 同样的 config */});
const snapshot = await daemonReborn.loadFromCheckpoint();
if (snapshot && !snapshot.completed) {
  await daemonReborn.resumeFromCheckpoint();
}

// === 7. 章节后处理 (写作 pipeline 自动跑了，这是手动版) ===
const slop = sanitizeProse(myChapterText);
console.log("slop score:", slop.slopScore, slop.issues);

const xx = verifyXianxia({
  text: myChapterText,
  parsed: engine.getParsedWorld(),
  knownTreasures: [{ characterId: "苏雪", names: ["地火炉令"] }],
});
console.log("xianxia issues:", xx.violations);

// === 8. 动态加角色 ===
const synth = synthesizeCharacter({
  name: "韩煜",
  introducedBy: { id: "苏雪", name: "苏雪" },
});
engine.addCharacter(synth);
// 下一个 director.plan() 会把韩煜纳入焦点池
```

---

## 8. 故障恢复

### 8.1 dev server 启不来 / 端口冲突

```bash
pkill -f "vite.*Novel System" || true
pkill -f "vite --host 127.0.0.1" || true
npm run workbench:dev
```

### 8.2 SQLite 索引/checkpoint 损坏

```bash
# 安全：删索引 + checkpoint，重启会从 store.json 重建
rm -f memory/index.sqlite*
rm -f .novel-system/runtime-daemon.sqlite*
# 不要删 memory/store.json — 那是源真相
```

### 8.3 Daemon 卡死 / 被 kill -9

启动新 daemon 调 `loadFromCheckpoint() / resumeFromCheckpoint()` 即可，看上面编程接口示例 6。

### 8.4 想完全重置世界

```bash
rm -rf memory .novel-system
# 然后重新 Apply 世界 Markdown
```

---

## 9. 跑测试 / 验证

```bash
cd "/Users/chris0810/Documents/Codex/Novel System"
npm test  # 跑 vitest 全套，目前 202 passing
```

要看具体某层：
```bash
npx vitest run tests/lunar-bazi.test.ts        # 八字
npx vitest run tests/memory-index.test.ts      # 记忆索引
npx vitest run tests/embedding-and-hybrid.test.ts  # vector
npx vitest run tests/director.test.ts          # 节奏
npx vitest run tests/character-agent.test.ts   # 角色 agents
npx vitest run tests/agent-llm-bridge.test.ts  # LLM bridge
npx vitest run tests/anti-slop-and-verifier.test.ts  # W4 检测
```

---

## 10. 已知限制 / 未实现

留作 W5 / W6 的事：
- ❌ **没有云部署** —— 现在仍是本地 dev server。Cloudflare Pages + Workers 路径已在 synthesis 里规划，未实施
- ❌ **没有 feed 风格 UI** —— 当前 workbench 是 prose-canvas-first shell（Sudowrite × Novelcrafter × VS Code 混合），没有"agent 这一天产出了什么"timeline feed
- ⚠️ **memory mirrorIndex 全量 rebuild** —— 每次写都全量重建索引，数据多了会慢；增量 upsert 是已知 known-debt
- ⚠️ **Engine 状态本身不持久化** —— Daemon checkpoint 只保存"跑到第几个 tick"，engine 内部 canonLine 状态如果想跨真进程恢复，需要从 simulation runs 重放
- ⚠️ **Embedding 默认不开** —— Workbench server 默认不构造 embedder。要在你自己的代码里手动接
- ⚠️ **写续段输入区还不是 prose 编辑器** —— 当前是用来触发 `/` 命令的占位 textarea；真正的可编辑 prose canvas（带 tiptap-style inline AI 续写）是下一里程碑

每层的诚实标记都在源文件 docstring 顶部，搜 "Honesty:" 看完整列表。

---

## 11. 一周内可能用到的常见操作

| 想做的事 | 怎么做 |
|---|---|
| 让世界跑一晚 | `curl -X POST .../api/runtime/start -d '{"targetTicks":50,...}'` |
| 看世界跑到哪了 | `curl .../api/runtime/status` |
| 写下一章 | `curl -X POST .../api/writing/compose -d '{...lens...}'` |
| 接受一个高风险分支 | 前端 simulation tab 找到分支 → 扶正 |
| 加新角色 | `synthesizeCharacter() + engine.addCharacter()` |
| 想暂时不让世界跑 | `pause` |
| 想从某个 stage 开始重写 | 修改世界 Markdown → Apply（清当前推演 + 写作上下文，5 秒撤销可点 toast） |
| 想看记忆系统状态 | `curl .../api/memory` 或 `sqlite3 memory/index.sqlite "SELECT count(*) FROM memory_entries"` |
| 想关闭 LLM | `~/.config/WorldHistoryEngine/studio-config.json` 改 `apiKey: ""` |

---

**版本**: W1–W4.5 + workbench prose-canvas-first shell（2026-05-11）  
**测试**: 202 passing · `npm run check` clean · `npm run workbench:build` clean  
**完成文档**: `.audit/20260510-rebuild/W1-W4-completion.md`（本地，未入 git）  
**调研基础**: `.audit/20260510-deep-research/synthesis.md`（本地，未入 git）  
**前端合并 plan**: `docs/plans/memoized-swinging-cocoa.md`（已提交）
