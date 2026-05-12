# Novel System v3 · 使用指南

> 单 tick 循环 · WorldEvent 单一真相 · Metaphysics-as-prior · SQLite + SSE · React + Zustand

## 1. 启动

```bash
npm install                          # 根项目（lunar-javascript / better-sqlite3 / zustand 等）
npm run workbench:install            # 前端
npm run workbench:dev                # 打开 http://127.0.0.1:5173
```

如果端口占用，vite 自动找下一个端口。

## 2. 配 AI 设置（可选）

不配 API key 也能跑——所有 LLM 调用 fallback 到 MockLLMProvider（启发式输出）。配了之后：

```bash
curl -X POST http://127.0.0.1:5173/api/settings/ai \
  -H 'content-type: application/json' \
  -d '{
    "apiKey": "sk-...",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-v4-pro",
    "thinkingMode": "enabled",
    "reasoningEffort": "high",
    "maxOutputTokens": 12000
  }'
```

存到 `.novel-system/world.db` 的 `ai_settings` 表里（v3 不再写独立 JSON 文件）。

**注**：Phase 7 时 `/api/settings/ai` 路由还没接，配置直接写 SQLite 或环境变量 `DEEPSEEK_API_KEY` 等暂未实现。

## 3. 跑端到端 demo

```bash
npm run sandbox
```

跑 5 ticks（含 2 个 compose），打印 daemon 状态 + 事件计数（按 subsystem 分桶）+ 章节数 + metaphysics frame 数。

## 4. 输入：世界 Markdown

世界以一段结构化 Markdown 输入。完整范例在 `examples/sample-world.md` + `corpus/`：

```markdown
# 世界设定
题材：东方玄幻/修仙
修炼体系：灵海、化罡、真传
世界规则：
- 玄脉共鸣会放大角色的欲望

# 角色
- 林焰 | description=少年心火盛 | baziRaw=丙午,丙午,丁巳,丁未 | faction=青岳宗 | role=外门弟子 | traits=倔强,护短 | goal=拿到真传名额 | stance=守宗 | resource=赤纹残图

# 单角色锚点
- 林焰 | cannot=提前死亡 | mustTrend=在压力中成长 | stageGoal=接近真传名额
```

字段含义：
- `baziRaw="..."`：4 柱（年/月/日/时），系统按子平派解析；或 `archetypeDraft="水金偏旺、谋定后动"` 跳过真八字
- `cannot` / `mustTrend` / `stageGoal`：硬约束，CanonGate phase 评估锚点违规

**应用世界**：

```bash
curl -X POST http://127.0.0.1:5173/api/world/apply-draft \
  -H 'content-type: application/json' \
  -d '{"worldId":"my-novel","parsed": {/* parsed draft */}}'
```

（前端 `/api/world/apply-draft` 当前接受已 parse 好的对象；Markdown 解析器是 plan 后续追加项。）

## 5. 核心 API

### Daemon

```bash
# 启动 N 步推演
curl -X POST http://127.0.0.1:5173/api/daemon/start \
  -H 'content-type: application/json' \
  -d '{"worldId":"my-novel","threadId":"main","targetTicks":20,"composeEvery":3}'

curl http://127.0.0.1:5173/api/daemon/status
curl -X POST http://127.0.0.1:5173/api/daemon/pause
curl -X POST http://127.0.0.1:5173/api/daemon/resume
curl -X POST http://127.0.0.1:5173/api/daemon/step  # 单步
```

### Events 流（SSE）

```bash
# 长连接，所有事件
curl -N http://127.0.0.1:5173/api/events

# 只看 worldId=my-novel 的 notable + decision-required
curl -N 'http://127.0.0.1:5173/api/events?worldId=my-novel&severity=notable&severity=decision-required'

# 历史查询
curl 'http://127.0.0.1:5173/api/events/query?worldId=my-novel&limit=50'
```

### Memory

```bash
curl -X POST http://127.0.0.1:5173/api/memory/recall \
  -H 'content-type: application/json' \
  -d '{"worldId":"my-novel","lineId":"canon","query":"林焰 真传","limit":10}'
```

### Atlas

```bash
curl 'http://127.0.0.1:5173/api/atlas/tree?worldId=my-novel'
curl 'http://127.0.0.1:5173/api/atlas/file?worldId=my-novel&path=characters/林焰.md'
```

### World snapshot

```bash
curl 'http://127.0.0.1:5173/api/world/snapshot?worldId=my-novel'
```

## 6. 数据位置

| 路径 | 内容 |
|---|---|
| `.novel-system/world.db` | 所有持久化（events / runs / world_state / world_history / memory + FTS5 / atlas / chapters / metaphysics_frames / checkpoints / ai_settings） |
| `.novel-system/world.db-wal`, `.db-shm` | SQLite WAL 文件 |

**重置一切**：`rm -rf .novel-system`。

## 7. 故障恢复

### dev server 启不来
```bash
pkill -f "vite.*Novel System" || true
npm run workbench:dev
```

### SQLite 损坏
```bash
# 备份再删
cp .novel-system/world.db /tmp/world.db.bak
rm .novel-system/world.db*
npm run workbench:dev   # 重新 apply-draft
```

### Daemon 卡死
```bash
curl -X POST http://127.0.0.1:5173/api/daemon/pause
# 重启进程后调 daemon.resumeFromCheckpoint(threadId)
```

## 8. 测试 / 检查

```bash
npm test                # 全部 vitest（90+ tests）
npm run check           # tsc --noEmit
npm --prefix workbench run build
```

## 9. 已知限制

- ❌ 没有云部署
- ❌ Markdown 解析器是 plan 待办（当前 apply-draft 接受 ParsedWorldDraft 对象）
- ❌ AI settings 路由暂未接（直接写 SQLite ai_settings 或测试时用 MockLLMProvider）
- ❌ inline `/` 命令、命令面板 ⌘K、Codex Rail 标签页、Bottom Panel ticks tab 都待 Phase 6.5 接入
- ⚠️ trigram FTS5 对 <3 字查询走 LIKE 兜底
- ⚠️ 单 Daemon 实例 per Db（构造第二个会抛）

每个 Phase 的实施记录在 git log 里，搜 `(Phase N)`。

## 10. 编程接口

```ts
import {
  // Layer 0 + 1
  openDb,
  parsePillars, computeBazi, fateFromBazi,
  buildFrame, scoreCandidate, normalizeWeights,

  // Layer 2
  EventBus, WorldStore, MemoryService, AtlasService,
  MockLLMProvider, DeepSeekProvider, DEFAULT_DEEPSEEK_PROFILE,
  MockEmbeddingProvider, HttpEmbeddingProvider,

  // Layer 3
  Director, AgentRegistry, CharacterAgent,
  runTick,

  // Layer 4
  Daemon,

  // Verifiers
  sanitizeProse, verifyXianxia,

  // Layer 5
  createServer,
} from "world-history-engine"; // 或本仓库 `from "../src/index"`
```

完整 e2e 看 `src/sandbox.ts`。

---

**版本**：v3 (2026-05)
**架构图**：[`docs/architecture.md`](./docs/architecture.md)
**决策记录**：[`docs/decisions.md`](./docs/decisions.md)
