# Novel System · v3

中文修仙小说创作系统 · 世界模拟器为核心 + 八字奇门作为概率先验 + 章节是模拟的副产品。

不是"AI 帮你续一段"，是"世界一直在跑、章节按节奏自然产出"的常驻 agent 系统。

## 架构

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

## Quickstart

```bash
npm install                       # 根项目依赖
npm run workbench:install         # 前端依赖
npm run workbench:dev             # 启动 → http://127.0.0.1:5173
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run workbench:dev` | 启动前端 + 集成后端（vite middleware） |
| `npm run workbench:build` | tsc + vite 生产构建 |
| `npm test` | vitest 全套 |
| `npm run check` | `tsc --noEmit` 类型检查 |
| `npm run sandbox` | 跑端到端 demo：装世界 → 5 ticks → 打印 events/chapters/frames |

## 核心概念

**WorldEvent 是唯一真相** —— 所有子系统改 world 状态之前都先 emit。前端从 SSE 单流取，状态栏 + Codex Rail + 决策箱都从同一流派生。

**单 tick 循环** —— "推世界"和"写章节"不是两条流水线，是同一 tick 的 phase 序列。Director 决定本 tick 要不要 compose。

**Metaphysics-as-prior** —— 八字 / 奇门 / 八卦 通过 `metaphysics/frame.ts` 输出 Influence 列表，`metaphysics/prior.ts` 的 `scoreCandidate` 把 Influence 投射到候选 action，输出 0..1 概率权重 + 可解释打分。Branches phase 用它选 top-K；UI 显示"为什么这个分支胜出"。

## Phase 状态

| Phase | What | Status |
|---|---|---|
| 0–6 | Layered v3 rewrite (data / domain / services / engine / daemon / server / frontend) | ✅ |
| 6.5 | Frontend completion (Codex Rail tabs / Bottom Panel / 6-stage 灯轨 / `/` & ⌘K / chapter view / draft uploader / settings modal) | ✅ |
| 7 | Markdown world parser · `/api/settings/ai` & `/api/chapters/*` · DeepSeek auto-wire from `ai_settings` · v3.1 schema migration · 2 bug fixes · dead v2 code removed · docs refresh | ✅ |

## 详细文档

- **架构设计**：[`docs/architecture.md`](./docs/architecture.md)
- **设计决策**：[`docs/decisions.md`](./docs/decisions.md)
- **运行手册**：[`USAGE.md`](./USAGE.md)
- **重写 plan**：本次 v3 重写的 plan 在 `/root/.claude/plans/`，可作历史记录

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
