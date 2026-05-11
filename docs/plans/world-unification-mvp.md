# Plan · World-Unification MVP（让世界变成一个有节奏的生命体）

## Context

合并 6 workspace → prose-canvas-first shell（`6be9d30 Consolidate ...`）已经统一了**布局**。但用户反馈：

> 整个 project 的运行逻辑还是比较分散，感觉不统一。

诊断（详 `.audit/world-unification-research/diagnosis.md`）：项目里有 **14 个 async 子系统**（runtime daemon / simulation runs / memory writes / atlas compiles / character reflections / character plans / 6-stage compose pipeline / canon-gate / branch evals / promotions / pause reasons / qimen modifier shifts / confirm-final cascade / embedding），各自把状态落到自己的容器（SQLite / JSON / store / markdown / trace），UI 看到的是「6 个工具」而不是「一个世界」。

研究（详 `.audit/world-unification-research/`，30 个参考、6 大类、8 条设计原则、8 个 pattern）的核心洞察：**统一感不该来自更大的控制台，而该来自一条更小、更稳定、更文学化的 `WorldEvent` 生命线**。所有子系统继续按现状写自己的容器，只在关键状态转移点 emit 一条事件；StatusBar / WritingCanvas / CodexRail / BottomPanel 消费同一条事件源，只是过滤不同。

---

## 目标日常体验（"打开是什么样"）

1. **生成章节时**作者无需看底栏就能感到「正在取材 → 立骨 → 铺场 → 成文 → 自审 → 入史」，每阶段配最后一次真实动作（"读取 18 条记忆，筛掉 4 条低相关"）
2. **确认终稿后** 5 秒内看到 receipt：「正史分支 cautious#12 · 记忆 +7 · 图谱 +2 · Canon 通过」
3. **离开底栏继续写**仍能感到世界在呼吸（StatusBar 心跳脉络一行）
4. **CanonGate 拦截 / 高风险暂停**作为 decision-required 浮出来，配可点击的「查看冲突 / 接受破例 / 回去改写」
5. **角色反思 / promotion / atlas 重建**作为 ambient 或 notable 事件以一行摘要出现在「世界回响」feed，可折叠可追溯

---

## 改造方案：5 阶段 MVP

研究 patterns.md 给出 8 个 pattern，但 foundation（WorldEvent 契约本身）成本被低估。修正后 MVP 顺序：

| Phase | 内容 | 成本 | 立刻能感受到的改善 |
|---|---|---|---|
| **0** | WorldEvent 契约 + SQLite 表 + 各子系统 emitter scaffolding | M | （内部，作者不直接感知） |
| **1** | 六阶段灯轨（替 pendingAction 单 string） | S | 1-3 分钟等待不再是黑箱 |
| **2** | 入史落印（confirm-final receipt） | S | 终稿确认有"世界接收到了"的回响 |
| **3** | 心跳脉络（StatusBar 阶段动词 + 局气） | S | 离开底栏也能感到世界在呼吸 |
| **4** | 世界回响 v0（3 行可折叠 feed） | M | CanonGate/promotion/agent reflection 可见 |

合计估时 2-3 周，作为一个里程碑。第二里程碑（角色低语 / 天机转场 / 正史分岔图 / 源包透镜）留给后续。

### Phase 0 · WorldEvent 契约 + emitter（核心 5-7 天）

**事件 schema**：

```ts
type WorldEvent = {
  id: string;              // subsystem + runId + phase + sourceRef，幂等 key
  ts: number;              // epoch ms
  chapterId?: string;
  runId?: string;
  sceneId?: string;
  subsystem: "runtime" | "compose" | "memory" | "atlas" | "canon"
           | "character-agent" | "qimen" | "promotion" | "pause";
  severity: "ambient" | "notable" | "decision-required";
  phase?: string;          // 例: "memory-read" / "synthesize" / "verdict"
  verb: string;            // 文学化中文动词: "取材" / "立骨" / "裁决" / "入史"
  subject: string;         // 短主语: "本章" / "玄霜" / "血脉设定"
  summary: string;         // 一行中文摘要，作者可读，避免 ID/JSON
  refs?: {
    runId?: string;
    memoryIds?: string[];
    atlasPaths?: string[];
    canonVerdictId?: string;
    sourcePackId?: string;
    [k: string]: unknown;
  };
  status: "started" | "progress" | "succeeded" | "failed" | "blocked";
  expiresAt?: number;      // ambient 事件 ms 后可被合并/掩埋
};
```

**存储**：`.novel-system/world-events.sqlite`（新文件，与 daemon checkpoint 并列）。append-only 表，含索引 `(chapterId, ts)`、`(runId, ts)`、`(severity, ts)`。后端继续写自己的 store/checkpoint，只在关键节点 `recordWorldEvent(event)` 多写一行。

**前端 derived snapshot API**：`GET /api/world-events?chapterId=&runId=&severity=&limit=`、SSE/poll `GET /api/world-events/stream`。前端衍生 5 个视图：`activePulse` / `recentEchoes` / `decisionQueue` / `chapterBreadcrumbs` / `sourcePackSummary`。

**关键文件**：

| 文件 | 改动 |
|---|---|
| **新** `src/world-events/types.ts` | WorldEvent type、severity、verb 词典 |
| **新** `src/world-events/store.ts` | SQLite emitter, idempotent insert, query helpers |
| **新** `src/world-events/verbs.ts` | pipeline phase → 文学动词映射（memory-read=取材 etc.） |
| `src/orchestration.ts`（写作 6-stage pipeline 编排）| 6 个 stage 切换点各 emit `compose` event with phase + verb |
| `src/canon-gate.ts` | accept/reject/pause-on-risk 各 emit `canon` event with severity routing |
| `src/world-daemon.ts` / `src/persistent-runtime-daemon.ts` | tick start/end emit `runtime` event（ambient）；pause-reason 转 `pause` event（notable/decision-required） |
| `src/memory.ts` | memory write 完成 emit `memory` event with count summary |
| `src/engine.ts` | promotion (`扶正`) emit `promotion` event（notable） |
| `src/character-agent.ts` | reflection/plan 完成 emit `character-agent` event with 1-line summary |
| `src/metaphysics.ts` 或 frame | qimen pattern 切换 emit `qimen` event |
| **新** `workbench/src/server.ts` 中加 `/api/world-events*` 路由 | derived snapshot endpoints |

**验证 Phase 0**：单元测试 ≥ 8 个 `recordWorldEvent` 幂等 + query 正确性。集成测试 1 个：跑完整 compose pipeline → 验证 ≥ 6 个 compose stage events + ≥ 1 个 canon event + ≥ 1 个 memory event 全部入库。

### Phase 1 · 六阶段灯轨（1-2 天）

**位置**：WritingCanvas 写续段 zone 上方（或 canvas-dock 内部）的 inline progress bar。

**ASCII**：

```
写续段：取材 ▰ 立骨 ▰ 铺场 ▱ 成文 ▱ 自审 ▱ 入史 ▱
当前：读取 18 条记忆，筛掉 4 条低相关
```

**关键文件**：

| 文件 | 改动 |
|---|---|
| **新** `workbench/src/components/SixStageProgress.tsx` | 6 灯轨 + 当前阶段最后 summary 一行 |
| `workbench/src/components/WritingCanvas.tsx` | 在 canvas-dock 下、scene-strip 上加 `<SixStageProgress activeRunId={...} />`，仅在有 active compose run 时显示 |
| `workbench/src/store.ts` | 加 `useActiveComposeRun` 钩子，poll `/api/world-events?subsystem=compose&runId=active&severity=ambient,notable` |
| `workbench/src/App.tsx` | `handleCompose` 启动时记下 runId，传给 SixStageProgress；`pendingAction` 字符串保留兼容但不再是主显示 |

**验证 Phase 1**：手动跑一次 compose，画布上 6 灯应依次点亮，最后 summary 文字应是真实 emit 内容（不是 mock）。

### Phase 2 · 入史落印（1-2 天）

**位置**：confirm-final 后，chapter-card 下方 5 秒短 receipt，然后收起进 world-echoes feed。

**ASCII**：

```
终稿已入史 ✓
  ─ 正史分支：cautious#12
  ─ 记忆：+7（伏笔 2 / 称谓 3 / 修订 2）
  ─ 图谱：宗门关系 +1
  ─ Canon：通过，风险 低
[ 5 秒后自动收起，可在世界回响里查看 ]
```

**关键文件**：

| 文件 | 改动 |
|---|---|
| **新** `workbench/src/components/InscriptionReceipt.tsx` | 短 receipt，5 秒 auto-collapse，可由用户手动展开 |
| `workbench/src/components/WritingCanvas.tsx` | `confirm-final` 成功后挂载 receipt，从 derived `/api/world-events?subsystem=memory,atlas,canon,promotion&since=...` 拉聚合 |
| `src/orchestration.ts`（confirm-final 路径） | 终稿确认完成后 emit 一个 `confirm-final-cascade` summary event（status=succeeded），聚合子事件 ids |

**验证 Phase 2**：手动 confirm 一个场景，receipt 应在 1 秒内出现，列表 4 行（分支/记忆/图谱/canon），5 秒后收起。

### Phase 3 · 心跳脉络（1 天）

**位置**：StatusBar 左侧 / 中段（pill 之前）。

**ASCII**：

```
世界脉搏：成文中 · 刚取用 18 条记忆     局: 阳遁三局·风动
```

**关键文件**：

| 文件 | 改动 |
|---|---|
| `workbench/src/components/StatusBar.tsx` | 左侧加 `<Heartbeat />`，consume `/api/world-events?severity=ambient,notable&limit=1`（最新 active 事件）+ 当前 qimen modifier |
| **新** `workbench/src/components/Heartbeat.tsx` | 300-800ms debounce、阶段切换 / qimen pattern 变化才更新 |

**验证 Phase 3**：daemon 跑起来时 StatusBar 显示 "推演中"；compose 时显示 "成文中"；idle 时显示 "静观"。

### Phase 4 · 世界回响 v0（3-5 天）

**位置**：CodexRail Now tab 顶部 3 行可折叠 feed（默认显示本章相关 + severity notable/decision-required）。

**ASCII**：

```
┌ 世界回响  [显示本章 · 折叠]
│ 04:12  notable      玄霜想通了"避其锋芒"
│ 04:13  decision-req CanonGate 拦下血脉矛盾  [查看]
│ 04:14  notable      3 条记忆入册，图谱更新 2 节点
└ 还有 5 条 ambient 已合并  [全部]
```

**关键文件**：

| 文件 | 改动 |
|---|---|
| **新** `workbench/src/components/WorldEchoes.tsx` | 3 行 feed，severity icon、verb 高亮、点 row 展开 refs |
| `workbench/src/components/codex/NowTab.tsx` | 顶部插入 `<WorldEchoes />`，下方保持现有 sourcePack 角色 / 关系 / qimen 卡 |
| **新** `workbench/src/components/DecisionInbox.tsx` | severity=decision-required 事件单独排队，BottomPanel 左下角小红点 + 点击展开决策列表 |
| `workbench/src/components/BottomPanel.tsx` | 加 `decisions` tab（仅当队列非空时显示），列出所有未处理 decision-required 事件 |

**验证 Phase 4**：手动 trigger 一次 CanonGate reject（用故意破坏世界规则的输入），feed 顶部应 1 秒内出现 decision-required 行，BottomPanel decisions tab 应出现红点。

---

## 不做的事（明确不改）

1. **不动 backend domain logic** —— `WorldHistoryEngine` 业务规则、CanonGate 决策、Director 计划逻辑、Anti-slop 检测器、写作 pipeline 6 阶段本身 —— 全部保留。Phase 0 只是**在关键转移点加 emit**，不改业务。
2. **不重写 memory store / atlas / canon line** —— 它们继续按现状写自己的容器。WorldEvent 是**复制**重要变化为可感知事件，不是迁移。
3. **不引 redux/zustand** —— 现有 `useState` + props 已经够用，本里程碑不增加状态管理库。
4. **不引 SSE / WebSocket（除非必须）** —— Phase 4 之前都用 1.2-2s 轮询（已有 daemon polling 机制）。如 Phase 4 feed 闪烁问题大，再加 SSE。
5. **不在 MVP 做完整 run replay / sourcePack 透镜 / 正史 DAG / 角色低语 / 天机转场** —— 这些留给第二里程碑。
6. **不重排 layout** —— 主画布 / Rail / BottomPanel / StatusBar 的几何关系不变。所有新组件都挂在现有 surface 上。

---

## Hard invariants

- **prose-canvas-first**：WritingCanvas 始终 mounted，所有事件流相关 UI 只能挂在 StatusBar / CodexRail / BottomPanel / 现有 WritingCanvas 内的辅助 zone。**正文区不被任何回响/通知压缩或遮挡。**
- **失败隔离**：emit 失败（SQLite 写不进去）绝不能让业务路径失败。`recordWorldEvent` 全部 fire-and-forget + try/catch + 一行 console.warn。
- **null-safe**：所有新组件接收 `events: []` 或 `null` 必须渲染为空态而不是崩溃。

---

## 验证

| 检查 | 期望 |
|---|---|
| `npm run check`（tsc）| 0 error |
| `npm test`（vitest）| 现有 202 全过 + Phase 0 新增 8-12 个 world-events 测试 |
| `npm --prefix workbench run build` | 0 error |
| 手动验收脚本 | 见每个 Phase 末尾 |

### 集成 e2e 场景

| 场景 | 期望 |
|---|---|
| 跑 compose | 灯轨依次点亮 6 阶段；StatusBar 心跳从"取材中"→"立骨中"→…→"入史中"；完成后 receipt 出现 |
| Confirm-final | receipt 1 秒内出现含 4 行（分支/记忆/图谱/canon），5 秒后收起，可在 NowTab 世界回响里查到 |
| 触发 CanonGate reject | decision-required 事件 1 秒内出现在 feed 顶 + BottomPanel decisions tab 红点 |
| 跑 daemon 多 tick | StatusBar 心跳显示"推演中"；NowTab 世界回响出现 promotion/qimen 等 ambient 行 |
| 关 BottomPanel + 关 Rail（⌘⇧\\ + ⌘\\） | StatusBar 心跳仍可见，作者仍能感到世界在跑 |

---

## 关键文件清单（按改动顺序）

### Phase 0 — 7 个文件改 + 3 个新
1. **新** `src/world-events/types.ts`
2. **新** `src/world-events/store.ts`
3. **新** `src/world-events/verbs.ts`
4. `src/orchestration.ts` —— 6 个 stage 切换点 emit
5. `src/canon-gate.ts` —— verdict emit
6. `src/world-daemon.ts` + `src/persistent-runtime-daemon.ts` —— tick / pause emit
7. `src/memory.ts` —— write summary emit
8. `src/engine.ts` —— promotion emit
9. `src/character-agent.ts` —— reflection/plan emit
10. `workbench/src/server.ts` —— `/api/world-events*` 路由

### Phase 1
11. **新** `workbench/src/components/SixStageProgress.tsx`
12. `workbench/src/components/WritingCanvas.tsx` —— 挂载 SixStageProgress
13. `workbench/src/store.ts` —— `useActiveComposeRun` 钩子

### Phase 2
14. **新** `workbench/src/components/InscriptionReceipt.tsx`
15. `workbench/src/components/WritingCanvas.tsx` —— 挂载 InscriptionReceipt
16. `src/orchestration.ts` —— confirm-final-cascade summary event

### Phase 3
17. **新** `workbench/src/components/Heartbeat.tsx`
18. `workbench/src/components/StatusBar.tsx` —— 挂载 Heartbeat

### Phase 4
19. **新** `workbench/src/components/WorldEchoes.tsx`
20. **新** `workbench/src/components/DecisionInbox.tsx`
21. `workbench/src/components/codex/NowTab.tsx` —— 挂载 WorldEchoes
22. `workbench/src/components/BottomPanel.tsx` —— 加 decisions tab

### 测试
23. **新** `tests/world-events-store.test.ts` —— 幂等性 + query
24. **新** `tests/world-events-integration.test.ts` —— compose pipeline emit 完整性
25. 现有 `tests/workbench-server.test.ts` —— 加 /api/world-events* 路由测试

---

## 估时 + 回滚

| Phase | 估时 |
|---|---|
| 0 · WorldEvent 契约 + emitter | 5-7 天 |
| 1 · 六阶段灯轨 | 1-2 天 |
| 2 · 入史落印 | 1-2 天 |
| 3 · 心跳脉络 | 1 天 |
| 4 · 世界回响 v0 | 3-5 天 |
| **合计** | **2-3 周** |

每个 Phase 一个 commit。Phase 0 出问题 → `git revert` 该 commit，所有 emit 调用消失，业务路径仍然完整（因为 emit 是 fire-and-forget try/catch）。Phase 1-4 增量叠加，可独立回滚。

---

## Memory promotion（完成后）

- `project_world_event_foundation.md` —— 记录 WorldEvent schema + storage 决策（`.novel-system/world-events.sqlite`），future 调试和扩展用
- `feedback_emit_failure_isolated.md` —— 记录 fire-and-forget + try/catch 的硬约束，避免 future 改动里把 emit 失败传播成业务失败

---

## Research provenance

研究输出全文在 `.audit/world-unification-research/`：

- `synthesis.md`（5224 中文字）—— 主文档
- `diagnosis.md` —— 14 个 async 子系统逐项诊断 + severity 排序
- `patterns.md` —— 8 个 pattern 详细规格（本计划只取前 4 + foundation）
- `principles.md` —— 8 条设计原则
- `sources.md` + `sources.json` —— 30 个参考（agent / game / observability / writing / livestream / IDE 六类）
