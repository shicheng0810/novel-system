# Novel System v3 · Architecture Decision Records

短记录每条关键架构决策的 why。详细 plan 在 `/root/.claude/plans/system-reminder-you-re-running-in-buzzing-kitten.md`。

## ADR-001: Single SQLite, no LangGraph

**Decided**: 所有持久化走一个 `.novel-system/world.db`（12 张表 + FTS5 trigram + 触发器同步）。删除 v2 的 `@langchain/langgraph` + `@langchain/langgraph-checkpoint-sqlite` 依赖。

**Why**: v2 把 events 写自己的 sqlite，runs 写 JSON 目录，memory 写 store.json，atlas 写 markdown 文件，daemon checkpoint 写 LangGraph SqliteSaver——14 个 async 子系统各写自己的容器，难以调试和回滚。一个 SQLite + 一组 SQL 视图能 SQL 查询全部状态，备份/恢复就是 cp 文件。LangGraph 的 checkpoint 价值不抵其依赖体积。

## ADR-002: Single tick loop with composable phases

**Decided**: 一个 tick = phases 序列（frame → agents → branches → gate → commit → (compose? memory-read → blueprint → scene-cards → synthesize → review → inscribe)）。compose 是 phase，不是独立 pipeline。

**Why**: 原始愿景是「世界一直在跑、章节是模拟的副产品」。v2 把 `WorldDaemon.tick()` 和 `compose chapter` 写成两条独立流水线，违背了愿景。统一到一条流水线让 Director 可以一个决策点同时管"推世界"和"写章节"，让 SSE 上一条事件流就能呈现完整 6 阶段灯轨。

## ADR-003: Metaphysics as probability prior, not decoration

**Decided**: `metaphysics/prior.ts.scoreCandidate(candidate, frame)` 把 frame.influences 真投射到候选 action 上，输出 0..1 权重 + per-axis breakdown，引擎用它选 top-K 分支。

**Why**: v2 frame.ts 输出 influences 但 engine.ts 实际只用 `qimenModifier.timingShift` 一个字符串做条件判断——metaphysics 只是装饰。Phase 3 让八字（character 层）、奇门（location 层）、八卦（branch 层）真正进入决策，UI 能显示「为什么这个分支胜出」的 breakdown。

## ADR-004: Single SSE stream, no polling

**Decided**: 后端 `GET /api/events` 是单一 SSE 长连接；前端 useEventStore 订阅；所有 UI 派生（StatusBar heartbeat / WorldEchoes feed / DecisionInbox queue / runtime pill）都从这一个流走。

**Why**: v2 前端用 1.2s 轮询 `/api/runtime/status` 加上每个 surface 自己的 fetch。SSE 一条流就解决：服务端 push、前端零额外轮询、连接断开时 SSE 客户端自动重连。SQLite 触发器 + Node EventEmitter pubsub 即够，不引 Redis/MQ。

## ADR-005: Zustand stores split by concern, no prop drilling

**Decided**: 前端用 zustand。四个 store：useEventStore（500 事件 ring buffer + bySubsystem 桶 + decisions 队列 + latestPulse）、useSessionStore、useDaemonStore、useUIStore。

**Why**: v2 `App.tsx` 721 行 + `server.ts` 1936 行，几乎纯 prop drilling。组件直接从 store select 后，每个 surface 只重渲染自己关心的 slice。zustand 比 redux 轻、比 context API 性能好；不引第二个状态库。

## ADR-006: 6 sub-phases of compose emit individual events

**Decided**: 把 memory-read / blueprint / scene-cards / synthesize / review / inscribe 拆成 6 个 emit 点。

**Why**: 用户感知"成文中"不再是 1-3 分钟的黑箱。前端 6 阶段灯轨 (`SixStageProgress`，Phase 6.5 接入) 能依次点亮，每阶段配最后一次真实动作。

## ADR-007: Trigram FTS5 with LIKE fallback for short CJK queries

**Decided**: memory_fts 用 `tokenize='trigram'`；memory-service 对 <3 字查询 fall back 到 `LIKE %query%`。

**Why**: SQLite FTS5 默认 unicode61 tokenizer 不分词中文，导致 "苏雪" 完全匹配不上。trigram 处理 ≥3 字查询很好，<3 字（如人物 2 字名）走 LIKE 仍能命中。混合方案不引外部分词器。

## ADR-008: One Daemon per Db (singleton-ish)

**Decided**: 构造第二个 Daemon 实例针对同一 Db 时抛错。

**Why**: 两个 daemon 抢 SQLite 写 + 抢 WorldStore 状态会撞车。WeakMap 锁可在测试中独立 db 时绕开，对生产环境强制单实例。

## ADR-009: Domain-pure Markdown world parser

**Decided**: `src/domain/parse-world.ts` 实现 `parseWorldMarkdown(md): ParsedWorldDraft`，只用 `String.prototype.split` + 简单正则，不引 marked / unified / remark / micromark 任何 Markdown 库。

**Why**: 世界 Markdown 是受控的 KV 格式（`# 角色` + `- {id} | k=v | k=v`），不是任意 CommonMark。引完整 parser 会把构建产物体积翻倍且无任何对应收益。手写解析器 < 200 行，在 `examples/sample-world.md` 上有 fixture 测试覆盖，11 case 全过。layer-isolation 测试自动拒绝 domain/ → services/engine/* 的导入，所以这个文件留在 domain/ 永远是纯函数。

## ADR-010: ai_settings as runtime-mutable LLM/embedder source

**Decided**: `createServer()` 在 boot 时 `AiSettingsStore.load()`，按行内容实例化 `DeepSeekProvider` / `HttpEmbeddingProvider` 或 fallback 到 Mock。POST `/api/settings/ai` 后服务**就地重建** llm + embedder（`deps.rebuildAi(next)`），引擎下一 tick 自动用新 provider。

**Why**: v2 把 DeepSeek key 写 `studio-config.json`，每次改 key 都要重启 node。把状态全部塞 SQLite 单文件后（ADR-001）这条也该跟进。`MemoryService.setEmbedder(e)` 是为了不重建整个 MemoryService 让向量召回平滑切换。env-var fallback (`DEEPSEEK_API_KEY`) 在 SQLite 行为空时生效，首次部署不用 SQL。

## 备忘

- 不做云部署 / multi-user / auth（单机工具定位）
- 不引 tRPC / GraphQL（type-safety 走共享 types.ts 已够）
- 不动 `corpus/`（世界 Markdown 范例语料）
- v3.0 → v3.1 schema 升级只加列、不改表结构；`migrate()` 内嵌 ALTER TABLE ladder，老 db 自动升
