# Novel System

中文小说世界模拟器 · 常驻世界为核心 + 内容包先验 + 章节是模拟的副产品。

不是"AI 帮你续一段"，是"世界一直在跑、章节按节奏自然产出"的常驻 agent 系统。

仓库里保留两条可运行路径：

- `src/` + `workbench/`：v3 分层运行时与 React workbench。
- `core/` + `packs/` + `app/`：genre-neutral actor core，内容包可插拔；`xianxia-bazi` 是旗舰包，`scifi-station`/`modern-city`/`freeform` 用来证明引擎不绑定修仙。

## 架构

### v3 Workbench

```
Layer 0 · Data       ── 单 SQLite (.novel-system/world.db)
Layer 1 · Domain     ── 纯类型 + 无 IO 函数
Layer 2 · Services   ── EventBus / WorldStore / Memory / Atlas / LLM / Embedding
Layer 3 · Engine     ── 单 tick 循环 (frame → agents → branches → gate →
                          commit → maybe(compose: memory-read → blueprint →
                          scene-cards → synthesize → review → inscribe))
Layer 4 · Daemon     ── 单循环跑家
Layer 5 · Server     ── HTTP actions + SSE 事件流
Layer 6 · Frontend   ── React + Zustand stores + SSE 订阅
```

详见 [`docs/architecture.md`](./docs/architecture.md)。

### Actor Core

```
core/domain      ── genre-neutral 类型与事件契约
core/services    ── SQLite store、LLM 抽象、内容包注册
core/runtime     ── 单写者 world actor + scheduler
core/actors      ── character / director / compose actors
packs/           ── 内容包：先验、进阶、文风、动态登场、剧情事件
app/             ── sandbox、server、longrun、novella 等 composition roots
tests/core       ── 架构守卫 + actor/runtime/content-pack 验证
```

## Quickstart

```bash
npm install                       # 根项目依赖
npm run workbench:install         # 前端依赖
npm run workbench:dev             # 启动 → http://127.0.0.1:5173
```

Actor core:

```bash
npm run check:core
npm run test:core
npm run sandbox:core
npm run serve:core                # http://127.0.0.1:8990
```

默认使用 `MockLLM`，无需 API key。需要真实模型时复制 `.env.example` 并设置 `NOVEL_LIVE_LLM=deepseek` + `DEEPSEEK_API_KEY`，或设置 Hermes SSH 相关变量。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run workbench:dev` | 启动前端 + 集成后端（vite middleware） |
| `npm run workbench:build` | tsc + vite 生产构建 |
| `npm test` | vitest 全套 |
| `npm run check` | `tsc --noEmit` 类型检查 |
| `npm run sandbox` | 跑端到端 demo：装世界 → 5 ticks → 打印 events/chapters/frames |
| `npm run check:core` | actor core strict 类型检查 |
| `npm run test:core` | actor core 测试 |
| `npm run sandbox:core` | mock LLM 下跑 30 tick 冒烟 |
| `npm run live:smoke` | 按 `.env`/环境变量测试 live LLM 路径 |
| `npm run live:chapter` | live/mock LLM 出一章端到端样章 |
| `npm run novella` | 跑 8 章短篇生成 |
| `npm run longrun` | 长篇长跑生成，输出到 `.novel-output/` |

## 核心概念

**WorldEvent 是唯一真相** —— 所有子系统改 world 状态之前都先 emit。前端从 SSE 单流取，状态栏 + Codex Rail + 决策箱都从同一流派生。

**单 tick 循环** —— "推世界"和"写章节"不是两条流水线，是同一 tick 的 phase 序列。Director 决定本 tick 要不要 compose。

**Metaphysics-as-prior / Prior-as-pack** —— v3 里八字 / 奇门 / 八卦通过 `src/metaphysics/*` 输出 Influence；actor core 里先验系统被提升为 `ContentPack.priorSystem`，引擎只认 `PriorFrame` 和 `scoreCandidate` 形状，不内嵌具体 genre。

**引擎 ↔ 内容包分离** —— `core/` 不允许出现 `bazi/qimen/cultivation/境界` 字面量，也不允许 import `packs/`。这由 `tests/core/architecture.test.ts` 机器强制。

## Phase 状态

| Phase | What | Status |
|---|---|---|
| 0–6 | Layered v3 rewrite (data / domain / services / engine / daemon / server / frontend) | ✅ |
| 6.5 | Frontend completion (Codex Rail tabs / Bottom Panel / 6-stage 灯轨 / `/` & ⌘K / chapter view / draft uploader / settings modal) | ✅ |
| 7 | Markdown world parser · `/api/settings/ai` & `/api/chapters/*` · DeepSeek auto-wire from `ai_settings` · v3.1 schema migration · 2 bug fixes · dead v2 code removed · docs refresh | ✅ |
| Actor Core M0–M7 | genre-neutral actor runtime · content packs · prior/认知/叙事/经济深化 · longrun/server | ✅ |

## 详细文档

- **架构设计**：[`docs/architecture.md`](./docs/architecture.md)
- **设计决策**：[`docs/decisions.md`](./docs/decisions.md)
- **运行手册**：[`USAGE.md`](./USAGE.md)
- **环境变量模板**： [`.env.example`](./.env.example)

## 目录说明

| 路径 | 内容 |
|---|---|
| `src/` | v3 分层后端/runtime |
| `workbench/` | React + Zustand workbench |
| `core/` | genre-neutral actor core |
| `packs/` | 可插拔内容包 |
| `app/` | core composition roots、server、longrun、live demos |
| `tests/` | v3 测试 |
| `tests/core/` | actor core 测试 |
| `corpus/` | 公版语料与派生阅读资料 |
| `.novel-system/` | v3 本地运行数据库，忽略不提交 |
| `.novel-output/` | 长跑生成结果和 live 配置，忽略不提交 |

## UX 速览

```
┌─ Topbar · Novel System · v3 ────────────────────────────────┐
│                                                              │
│  WritingCanvas                       │   CodexRail           │
│   - canvas dock (stage # / phase)     │   - WorldEchoes      │
│   - 续段 textarea                      │      (notable +      │
│   - 启动 daemon 按钮                   │       decision)      │
│                                       │   - DecisionInbox    │
│                                       │                       │
├─ Bottom Panel (可选) ──────────────────────────────────────┤
└─ StatusBar · SSE • heartbeat · ▶/▢/⏸ Runtime pill ────────┘
```
