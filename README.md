# Novel System

中文修仙小说创作系统 · 世界历史模拟器为核心 + 八字奇门作概率先验 + 章节文本是模拟副产品。

不是"AI 帮你续一段"，是"世界一直在跑、章节按节奏自然产出"的常驻 agent 系统。

## Quickstart

```bash
npm install                       # 根项目依赖
npm run workbench:install         # 前端依赖（workbench/）
npm run workbench:dev             # 启动 → http://127.0.0.1:5173
```

第一次启动会落在 prose canvas（writing studio）。右上角 **AI 设置** 配 DeepSeek key 才解锁完整 LLM 路径；不配也能跑（启发式模式）。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run workbench:dev` | 启动前端 + 集成后端（vite middleware） |
| `npm run workbench:build` | tsc + vite 生产构建 |
| `npm test` | vitest 全套（当前 202 passing） |
| `npm run check` | `tsc --noEmit`，整个仓库类型检查 |
| `npm run demo` / `demo:deepseek` | 命令行 demo |
| `npm run corpus:artifacts` | 跑语料制品 CLI |

## 详细文档

- **运行手册**：[`USAGE.md`](./USAGE.md) —— 配 AI / 世界 Markdown 格式 / daemon 工作流 / 编程接口 / 故障恢复 / 常见操作
- **架构设计**：[`docs/superpowers/`](./docs/superpowers/) —— runtime kernel / persistent daemon / metaphysics 设计 spec
- **前端 plan**：[`docs/plans/memoized-swinging-cocoa.md`](./docs/plans/memoized-swinging-cocoa.md) —— workbench prose-canvas-first 合并方案

## UX 速览

打开后是单一 shell，**prose canvas 常驻主舞台**：

- **Activity Bar**（左）切 mode，但**不换页** —— 只翻右侧 Codex Rail 的 tab（当前/世界/记忆/图谱）或底部 Panel（推演/Runtime）
- **`⌘K`** 命令面板 · **写续段区输入 `/`** 弹 inline 菜单 · **`⌘\\`** 折叠 Codex Rail · **`⌘.`** typewriter · **`F11`** 全屏
- **Status Bar** 右下 **Runtime pill**：`▢ 0/0 ↔ ▶ N/M ticks`
