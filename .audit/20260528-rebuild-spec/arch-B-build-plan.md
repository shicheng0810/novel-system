# Phase 3 施工计划 · 架构 B(Actor / 监督运行时)

**生成** 2026-05-29 · 选定架构见 `arch-decision.md` · 规格见 `spec-v0.md`(v0.1)
**执行方式** 待用户定(本地起 M0 / 先修 hermes 走 long-task 远程 / 先 review)。hermes one-shot 当前坏,远程 long-task 路径需先修。

---

## 1. 最终架构(B + 嫁接安全网)

**运行时(单进程、单线程、可重放)**:
- **Scheduler**:TS-native job loop(`setTimeout` 自调度 + **generation 号**防并发双 step);step 进度持久化到 SQLite。
- **WorldActor(单写者)**:唯一持有 world 表写权;`step(gen)` = 一轮消息;`drainInputs → frame → agents → branches → gate → commit → maybe(compose) → saveStep(单事务)`。
- **Domain actor**:`CharacterActor`(N 个,lazy-instantiate;perceive→reflect→plan→act,产 `CandidateAction` 投入队列,**不直接改世界**);`CompactedCharacter`(远景塌缩,被点名 rehydrate)。
- **Supervisor/service actor**:`DirectorActor`(注入 beat / 张力预算 / author-pause)、`MetaphysicsActor`(纯函数 frame + scoreCandidate)、`CanonActor`(gate 仲裁 + KG 写)、`ComposeActor`(6-phase,**异步 startOperation,不阻塞 step**)、`MemoryActor`(串行写队列 + 背景 embed)。
- **铁律(消灭旧"各写各容器"腐败)**:world 表只 WorldActor 写、KG 只 CanonActor 写、memory 只 MemoryActor 写;三者写 + emit 全在 `saveStep` **同一 SQLite 事务**;SSE 在 commit 后推。

**通信**:一切改世界的意图(AI candidate / Director beat / **作者裁决**)都 `enqueueInput`,走同一 `inputHandler`(抄 ai-town:人与 agent 同一种 input)。

**引擎 ↔ 内容包(§2.7)**:引擎零 `修仙/八字` 字样;`ContentPack` 注入 prior/progression/anti-slop/storylets/traitAxes。
```ts
interface ContentPack {
  id: string;                                   // "xianxia-bazi" | "scifi-station" ...
  seedWorld(spec): WorldSnapshot;
  priorSystem?: PriorSystem;                    // 可 null = 纯涌现包
  progression: ProgressionSystem;               // tiers + 瓶颈/心魔(修仙=境界)
  composeProfile: { blueprintPrompt; sanitizer: AntiSlopFilter; lexicon };
  storylets: Storylet[];                        // NL-storylet(自然语言触发)
  traitAxes: TraitAxisDef[];                    // trait-violation 张力用
}
interface PriorSystem {                          // 八字奇门只是一个实现
  buildFrame(snapshot, clock): PriorFrame;       // deterministic,LLM 不算
  scoreCandidate(c, f: PriorFrame): ScoredCandidate;  // ← 形状冻结,沿用 v3 prior.ts
  explainInfluence?(inf, ctx): Promise<string>;  // LLM 只解释
}
```

**嫁接安全网**:① 静态守卫测试(见 M0);② v3 `metaphysics/{bazi,qimen,bagua,frame,prior}` + `verify/{xianxia,slop}` 纯函数零改搬进 `packs/xianxia-bazi/`;③ `scoreCandidate` 形参类型从 `MetaphysicsFrame` 重命名 opaque `PriorFrame`(引擎不解构)。

**SQLite schema(单 world.db)**:`events`(append-only,幂等 id,subsystem 自由 TEXT)· `world_state` · `runs` · `checkpoints`(启用!存 actor 状态)· `memory_entries`+FTS5(trigram,CJK code-point)· `chapters` · `kg_nodes`/`kg_edges`(canon 图,edge 带 stage_id 支持 retroactive)· `metaphysics_frames` · `director_beats`。

---

## 2. 里程碑(依赖序;M2 出章、M4 出完整一部)

| M | 内容 | 验收 |
|---|---|---|
| **M0** | actor 骨架:Scheduler + WorldActor + input-queue + inputHandler + SQLite schema + event bus + 同事务 saveStep + 静态守卫测试。CharacterActor 用**启发式 plan(无 LLM)**。 | `npm run sandbox` 跑 30 tick:事件按 subsystem 分桶、snapshot 演化、零半提交;架构测试绿 |
| **M1** | 单 agent 认知 + prior:CharacterActor 接 DeepSeek(reflect/plan);`xianxia-bazi` 包 `scoreCandidate` 接入 branches;MetaphysicsActor frame。 | 分流事件带 breakdown;同 seed 可重放 |
| **M2** ⭐ | compose 闭环:ComposeActor 6-phase **异步 operation** + sanitizer;章节落 chapters + inscribe memory;CanonActor KG。 | 跑 N tick 产 ≥5 章**连贯**草稿,compose 不阻塞、分步进度可见(F10) |
| **M3** | 作者裁决闭环 + 多 actor checkpoint:`POST /input` verdict → promote/archive/revise;CouncilCard;杀进程重启不丢 Director 状态。 | [依准]真影响正史(P3);重启 Director 张力连续 |
| **M4** ⭐ | 戏剧 + 长程:Director beat 注入 + trait-violation 张力 + storylet;进阶状态机 + 瓶颈/心魔;plan-decay watchdog + author-pause。 | 跑完一条 arc 产**首尾完整**一部;无战力崩坏 |
| **M5** | 不难用:React Router v7(URL 恢复)+ SSE 派生 + 撤销 + ErrorBoundary;前端整块。 | spec §5 验收项过 |
| **M6** | 跑一部完整小说(修仙包,10–15 角色,daemon 自走 + author-pause)。 | **头号验收:首尾完整、连贯不崩** |
| **M7** | 非修仙包冒烟(`scifi-station`)起最小世界。 | 换包 runtime 一行不改(验证 §2.7) |

lazy-instantiate / PIANO 演进 / procedural-memory(Q6)全部推到 M6 之后。

---

## 3. M0 详细任务(file-level)

> 目标:**无 LLM 的可跑骨架**,证明"input→step→事件→snapshot 演化 + 单写者同事务 + 包注入 + 静态守卫"。新代码新布局;v3 留作 git 参照,可复用的纯函数按需搬进 pack。

- [ ] `core/runtime/scheduler.ts` —— job loop + generation 号 + step 进度持久化
- [ ] `core/runtime/world-actor.ts` —— `step(gen)`:drainInputs→(frame stub→agents→branches→gate→commit)→saveStep(单事务);load/save snapshot
- [ ] `core/runtime/input-queue.ts` + `input-handler.ts` —— `enqueueInput` / 统一处理(candidate / director-beat / author-verdict 三型)
- [ ] `core/domain/events.ts` —— DomainEvent 判别联合 + WorldEvent 派生(subsystem 词典从 pack 取)
- [ ] `core/domain/pack.ts` —— `ContentPack` / `PriorSystem` / `ProgressionSystem` 接口(纯类型)
- [ ] `core/services/event-log.ts` —— append-only + 幂等 id + 同事务批写
- [ ] `core/services/pack-registry.ts` —— 加载/校验 pack,暴露 contributors
- [ ] `core/actors/character-actor.ts` —— **启发式** perceive→plan(产 2+ candidate,无 LLM)
- [ ] `core/actors/director-actor.ts` —— 最小 plan(arc + focus,无 beat)
- [ ] `packs/xianxia-bazi/index.ts` —— 最小包:seedWorld + 占位 priorSystem(均匀权重)+ 2 级 progression
- [ ] `data/schema.sql` —— 上述表;`better-sqlite3` + WAL
- [ ] `tests/architecture.test.ts` —— **静态守卫**:`core/**` 不得出现 `bazi|qimen|cultivation|境界` 字面量(grep 断言);+ 层 import 方向
- [ ] `sandbox.ts` + `npm run sandbox` —— 装最小世界 → 跑 30 tick → 打印 events(按 subsystem)/snapshot diff;断言零半提交
- [ ] `tests/world-actor.test.ts` —— step 确定性(同 seed 同结果)+ generation 防双 step

**M0 完成定义**:`npm run sandbox` 跑通 30 tick、`npm test` 绿、`tsc --noEmit` 过、静态守卫测试绿。

---

## 4. Runbook(machine-ingestible · 供 `/ecc:long-task` ingest)

```yaml
task_id_slug: novel-system-rebuild-m0
objective: 落地架构 B 的无 LLM actor 骨架(scheduler/WorldActor/input-queue/事件/包注入/静态守卫),sandbox 跑通 30 tick
scope:
  host: local machine(hermes one-shot 当前坏,远程执行禁用直到修复)
  paths: ["/Users/chris0810/Documents/Codex/Novel System/core/", ".../packs/", ".../data/", ".../tests/", ".../sandbox.ts"]
  services: []
stop_condition:
  success: "npm run sandbox 跑 30 tick 无半提交 + npm test 绿 + tsc --noEmit 过 + 静态守卫测试绿"
  failure: "schema/事件代数返工 >2 次同因,或单写者同事务无法保证"
  timeout: 本地分阶段,无硬超时
checkpoint_plan:
  interval: 每完成一个 file-level 任务
  path: progress.md(项目根)+ .audit/20260528-rebuild-spec/
verification:
  check: "cd 'Novel System' && npm test && npx tsc --noEmit && npm run sandbox"
  pass_criteria: exit 0 + sandbox 打印 30 tick 的 events/snapshot
risk_boundary:
  allowed: [新建 core/ packs/ data/ tests/ 文件, 改 package.json scripts, 从 v3 src 复制纯函数到 pack]
  requires_confirmation: [删除/覆盖 v3 src/, 改动 .git, 推送远程]
notification_rule:
  telegram_when: never(hermes 坏;本地执行)
```

**注**:hermes 修好前,本 Runbook 走**本地执行**(我直接写代码 + 上述 verification),而非 VPS ltworker。修好后可 `longtask_new` 注册做远程/durable。

---

## 5. 执行方式(待用户定)
1. **本地起 M0**(推荐):我现在直接按 §3 写 M0 代码,跑通 verification。无 hermes 依赖。
2. **先修 hermes** 再 `/ecc:long-task` ingest 远程跑:先 SSH 诊断 `hermes -z`,修好后远程/durable 执行。
3. **先 review 本 plan** 再定。
