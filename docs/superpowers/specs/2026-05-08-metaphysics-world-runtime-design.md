# Novel System Runtime v2 设计规格

文件沿用原规格路径。本版重写目标是把“术数世界运行时”提升为整个小说系统的核心架构，而不是把奇门、八卦、八字作为写作提示词的装饰层。

## 一句话结论

小说系统应该是一个定制 agent runtime，但它的中心不是通用多 Agent 聊天，而是：

```text
WorldDaemon + SimulationRun + CanonGate + MetaphysicsFrame
```

- `WorldDaemon`：长期运行的世界推演守护进程，负责持续 tick、checkpoint、暂停、恢复、等待作者裁决。
- `SimulationRun`：每次推演的可复盘记录，保存输入、步骤、术数帧、分支、评分、裁决和产物。
- `CanonGate`：正史门，负责把世界硬规则、作者锚点、既有正史和术数压力排出优先级。
- `MetaphysicsFrame`：术数运行时帧，把八字、先天八卦、奇门遁甲转成可追踪的叙事压力。

系统要吸收 Codex CLI、Claude Code、MiroFish、Hermes、OpenClaw、LangGraph、AutoGen、Temporal 等项目的工程经验，但不能退化成“另一个通用 agent 工具”。这个项目的独特性在于：术数不是世界观皮肤，而是文学世界的因果语法。

## 研究摘要

### 外部项目给出的设计启发

| 参考对象 | 可吸收的东西 | 不照搬的东西 | 对小说系统的落点 |
| --- | --- | --- | --- |
| Codex CLI | 本地运行、沙箱、审批模式、`AGENTS.md` 层级指令、subagents、hooks | 以代码编辑为中心的任务模型 | 引入项目级规则、权限、审计、可恢复执行 |
| Claude Code | 记忆层级、权限配置、hooks、subagents 的独立上下文 | 以开发工作流为主的工具调用循环 | 角色 agent 可独立上下文运行，但不能直接改正史 |
| OpenAI Agents SDK | tracing、guardrails、handoffs、custom spans | 通用客服/工具 agent 模式 | 把每次推演做成 traceable workflow |
| LangGraph | checkpoint、thread、human-in-the-loop、time travel | 直接迁移图执行框架 | 学习 durable execution，保持项目内轻量实现 |
| AutoGen AgentChat | team、handoff、human feedback、termination condition | 对话驱动的群聊式 agent 编排 | 作者裁决是显式 handoff，不是隐性 prompt |
| Temporal | 长运行 workflow、失败恢复、重试、可观测状态 | 引入重型 workflow 平台作为首版依赖 | WorldDaemon 的语义应该像 durable workflow |
| MiroFish | 输入材料、知识图谱、agent profiles、simulation artifacts、verdict.json | 社交媒体舆情模拟内核 | 保留“不可变 run 目录 + 机器可读 verdict” |
| Hermes Agent | 多模型 provider routing、CLI 形态 | 终端研究/编码助手定位 | 后续 LLM provider adapter 可参考它的轻量配置 |
| OpenClaw | local-first gateway、daemon、多通道、skills、sandbox、sessions | 个人自动化助手与消息平台中心化 | Workbench 可以有 daemon/gateway，但世界状态优先 |
| 6tail tyme4ts / lunar | TypeScript 历法、干支、节气、八字基础 | 直接采用外部解释体系 | 历法计算可借鉴，解释层必须项目自有 |
| qfdk/qimen | 奇门转盘排盘结构、九宫、八门、九星、八神、值符值使 | 直接让排盘决定剧情 | 奇门只输出时空压力和战术偏向 |
| SEP Yijing / HKO solar terms | 易经变化观、节气天文边界 | 现实预测声明 | 八卦和节气作为文学结构场 |

### 关键研究结论

1. 通用 agent 框架的强项是权限、工具、记忆、tracing、checkpoint 和 handoff。
2. 小说系统的强项应该是世界状态、正史边界、角色命运惯性、叙事张力和术数结构场。
3. 多 Agent 只能作为候选行动、镜头渲染、审校、世界解释的 worker，不能作为正史写入者。
4. 长期运行能力必须被一等建模；世界推演不是每次点按钮重新生成，而是可暂停、可恢复、可审计的 run。
5. 每个术数判断都必须能 trace 到输入，不允许 LLM 凭空发明“命理结论”。

## 当前项目状态

现有代码已经有正确的骨架：

- `src/domain.ts` 已有 `CharacterProfile.baziRaw`、`archetypeDraft`、`QimenContext`、`QimenModifier`、`BranchEvaluation`、`TruthEvent` 等字段。
- `src/metaphysics.ts` 已有天干地支到五行的简化映射、八字候选、阶段运势、简化奇门局。
- `src/engine.ts` 已有 `WorldHistoryEngine.runStage`、分支生成、分支评分、`promoteBranch`。
- `src/orchestration.ts` 已有 `WritingJob` checkpoint，但 `SimulationJob` 仍然偏薄。
- `src/memory.ts` 已有 line 隔离、事实同步、表达记忆、Atlas 编译。
- `workbench/src/App.tsx` 已有推演、世界、记忆、Atlas 视图和简化奇门覆写输入。

当前缺口：

- 没有独立 `SimulationRun` 记录，推演过程不可完整复盘。
- 没有抽象出来的 `CanonGate`，正史边界散落在 engine 的评分逻辑里。
- 没有 `WorldDaemon`，长期运行只能靠一次次手动调用。
- 术数层缺少 `MetaphysicsFrame` 和 trace。
- 八卦没有建模，奇门没有九宫，八字没有真实历法 adapter。
- 多 Agent 角色尚未有清晰权限边界。

## 非目标

- 不做商业算命产品。
- 不宣称现实预测。
- 不把外部术数库的解释结果直接写入正史。
- 不在第一版支持所有八字流派、奇门流派、纳甲、六爻、紫微等完整体系。
- 不做一个通用 OpenClaw/MiroFish 复刻。
- 不让 agent 自动永久改变 canon，除非通过 `CanonGate`。
- 不在 Git 元数据损坏的情况下要求自动 commit；设计、实现和验证可以继续，提交需要先修复仓库历史。

## 设计原则

### 1. 正史优先

正史不是 LLM 的输出文本，而是世界状态的唯一可信账本。任何生成内容都必须能回到正史事件、角色状态、关系状态、世界规则和作者锚点。

优先级：

```text
作者锚点
> 已成正史
> 世界硬规则
> 角色/关系连续性
> 术数压力
> LLM 提案
> 文风偏好
```

### 2. 术数是压力，不是判决

八字、先天八卦、奇门遁甲输出的是倾向、压力、机会、阻力、暴露点、延迟点。它们不能直接说“角色必须背叛”，只能说“在此时此局，这个角色更容易被哪种诱惑击中”。

### 3. Agent 是候选生成器

角色 agent、导演 agent、审校 agent、术数解释 agent 都只能提出候选。正史写入必须经过 deterministic evaluator 和 `CanonGate`。

### 4. 所有推演可复盘

每次 run 都要保存输入、模型提案、 deterministic 评分、术数 trace、gate 决策、被拒原因、作者裁决。没有 trace 的推演不能进入 canon。

### 5. 长期运行是一等能力

世界推演需要支持持续运行、定时 tick、失败恢复、暂停等待作者、恢复继续、跨章节压力累积。它不是单次 API 调用。

## 核心架构

```text
Novel Seed / Draft
        |
        v
Parser -> WorldSpec -> Atlas / Memory / TruthKernel
        |
        v
WorldDaemon
        |
        v
SimulationRun
        |
        +--> TemporalFrame
        +--> BaziProfiles
        +--> BaguaSituation
        +--> QimenBoard
        +--> MetaphysicsFrame
        |
        v
Candidate Generation
        |
        +--> deterministic actions
        +--> optional role agents
        +--> optional LLM stage proposal
        |
        v
Branch Simulation
        |
        v
CanonGate
        |
        +--> accept canon
        +--> archive branch
        +--> reject branch
        +--> ask author
        |
        v
Read Models / Workbench / Narrative Pipeline / Memory
```

## 运行时组件

### WorldDaemon

`WorldDaemon` 是常驻世界进程。它不直接写小说文本，而是维护世界随时间推进的压力、分支和正史边界。

职责：

- 加载 canon head、Atlas、memory、world config。
- 按 `tickPolicy` 触发世界推演。
- 为每个 tick 创建 `SimulationRun`。
- 在每个关键阶段 checkpoint。
- 遇到不确定性、冲突、强正史修改时暂停并请求作者裁决。
- 恢复被中断的 run。
- 输出 run artifacts 和 workbench read model。

建议接口：

```ts
type WorldDaemonConfig = {
  worldId: string;
  tickPolicy: {
    mode: "manual" | "interval" | "chapter-progress" | "pressure-threshold";
    intervalMs?: number;
    maxTicksPerRun: number;
  };
  autonomy: {
    autoPromote: "never" | "safe-only" | "author-approved";
    requireAuthorOnCanonRisk: boolean;
    requireAuthorOnHardDecision: boolean;
  };
  storage: {
    runRoot: string;
    checkpointEveryStep: boolean;
  };
};

type WorldTickInput = {
  directive?: StageDirective;
  reason: "manual" | "scheduled" | "pressure" | "resume";
  requestedBy: "author" | "daemon" | "test";
};

type WorldTickResult = {
  runId: string;
  status: "completed" | "paused" | "failed";
  canonDecision?: CanonGateDecision;
  nextWake?: string;
};
```

### SimulationRun

`SimulationRun` 是不可变 run 记录。它不是日志文件，而是推演的事实包。

建议目录：

```text
data/runs/<runId>/
  manifest.json
  input/
    directive.json
    canon-head.json
    atlas-slice.json
    memory-slice.json
  metaphysics/
    temporal-frame.json
    bazi-profiles.json
    bagua-situation.json
    qimen-board.json
    metaphysics-frame.json
    trace.jsonl
  simulation/
    activated-entities.json
    action-candidates.jsonl
    branch-events.jsonl
    branch-evaluations.json
  gate/
    decision.json
    rejected-reasons.jsonl
    author-handoff.json
  output/
    read-model.json
    report.md
```

建议类型：

```ts
type SimulationRun = {
  runId: string;
  worldId: string;
  lineId: string;
  baseCanonStageId?: string;
  status: "running" | "paused" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  directive: StageDirective;
  steps: SimulationStep[];
  artifacts: SimulationArtifacts;
};

type SimulationStep = {
  stepId: string;
  kind:
    | "load-context"
    | "metaphysics-frame"
    | "activate-entities"
    | "generate-candidates"
    | "simulate-branches"
    | "evaluate-branches"
    | "canon-gate"
    | "memory-sync"
    | "read-model";
  status: "started" | "completed" | "failed" | "paused";
  startedAt: string;
  endedAt?: string;
  inputRefs: string[];
  outputRefs: string[];
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
};
```

### CanonGate

`CanonGate` 是正史门。它要从 `WorldHistoryEngine` 里抽出来，成为可测试、可解释、可扩展的独立模块。

职责：

- 检查作者锚点。
- 检查已成正史是否被推翻。
- 检查世界硬规则。
- 检查角色人格与关系连续性。
- 检查死亡、背叛、结盟、核心物品转移等高风险事件。
- 比较术数压力和叙事收益，但不让它们越权。
- 决定 accept、reject、archive-only、ask-author。

建议类型：

```ts
type CanonGateDecision = {
  decisionId: string;
  runId: string;
  branchId: string;
  result: "accept-canon" | "archive-only" | "reject" | "ask-author";
  riskLevel: "low" | "medium" | "high" | "fatal";
  score: CanonGateScore;
  reasons: CanonGateReason[];
  requiredAuthorActions: AuthorActionRequest[];
};

type CanonGateScore = {
  anchorCompliance: number;
  canonContinuity: number;
  worldRuleCompliance: number;
  characterContinuity: number;
  relationshipContinuity: number;
  metaphysicsFit: number;
  narrativeYield: number;
};

type CanonGateReason = {
  code:
    | "anchor-violation"
    | "canon-contradiction"
    | "world-rule-violation"
    | "character-break"
    | "relationship-break"
    | "metaphysics-support"
    | "metaphysics-pressure"
    | "narrative-payoff"
    | "requires-author";
  severity: "info" | "warning" | "blocker";
  message: string;
  refs: TruthEventRef[];
};
```

判定规则：

```text
fatal blocker -> reject
high risk + author-required -> ask-author
valid but not selected -> archive-only
valid and selected -> accept-canon
```

### MetaphysicsFrame

`MetaphysicsFrame` 是术数在某次推演中的统一输入，不是散落在角色、阶段和 prompt 里的文本标签。

职责：

- 把 `TemporalFrame`、角色 `BaziProfile`、`BaguaSituation`、`QimenBoard` 组合成推演压力。
- 输出对角色行动、关系张力、空间焦点、事件类型、分支风险的影响。
- 提供 trace，解释每个影响来自哪一条规则。

建议类型：

```ts
type MetaphysicsFrame = {
  frameId: string;
  runId: string;
  temporalFrame: TemporalFrame;
  characterProfiles: BaziProfile[];
  baguaSituation: BaguaSituation;
  qimenBoard: QimenBoard;
  influences: MetaphysicsInfluence[];
  trace: MetaphysicsTrace[];
};

type MetaphysicsInfluence = {
  influenceId: string;
  target:
    | { kind: "character"; characterId: string }
    | { kind: "relationship"; relationshipId: string }
    | { kind: "location"; locationId: string }
    | { kind: "branch"; branchKey: string };
  axis:
    | "initiative"
    | "discipline"
    | "opportunism"
    | "volatility"
    | "attachment"
    | "exposure"
    | "delay"
    | "rupture"
    | "reconciliation"
    | "hidden-threat";
  weight: number;
  source: "bazi" | "fortune" | "bagua" | "qimen";
  explanation: string;
  confidence: "exact" | "derived" | "inferred";
};

type MetaphysicsTrace = {
  traceId: string;
  source: "calendar" | "bazi" | "bagua" | "qimen" | "canon-gate";
  ruleId: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  explanation: string;
};
```

## 术数分层

### TemporalFrame

每个世界 tick 必须有时间帧。

```ts
type TemporalFrame = {
  calendarMode: "fictional-cycle" | "real-calendar" | "manual-ganzhi";
  solarDateTime?: string;
  timezone?: string;
  solarTerm?: string;
  solarTermIndex?: number;
  yearGanzhi: string;
  monthGanzhi: string;
  dayGanzhi: string;
  hourGanzhi: string;
  seasonPolarity: "yang-dun" | "yin-dun" | "neutral";
  source: "tyme4ts" | "lunar-javascript" | "manual" | "fictional";
  confidence: "exact" | "derived" | "inferred";
};
```

规则：

- 真实日历模式优先用 TypeScript 可用库做 adapter。
- 架空世界默认用 `fictional-cycle`，把章节阶段映射到虚构节气和干支循环。
- 作者手动输入四柱或奇门局时，`source` 为 `manual`，并保存输入 trace。

### BaziProfile

八字负责角色本命，也就是“压力下的默认反应”。

```ts
type BaziProfile = {
  characterId: string;
  sourceMode: "exact-birth-time" | "raw-pillars" | "archetype" | "inferred";
  pillars?: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  dominantElements: string[];
  weakElements: string[];
  fateTraits: FateTraits;
  dramaticHooks: string[];
  confidence: "exact" | "derived" | "inferred";
};

type FateTraits = {
  initiative: number;
  discipline: number;
  opportunism: number;
  attachment: number;
  volatility: number;
  pressureResponse: string;
  relationshipStyle: string;
  temptationPattern: string;
  failureMode: string;
};
```

解释规则：

- 火旺：主动、暴露、冲撞、情绪推动。
- 水金旺：隐忍、潜伏、借势、试探。
- 土旺：守序、承压、拖延、稳定。
- 木旺：成长、扩张、修复、突破。

### BaguaSituation

先天八卦负责深层结构，不负责具体战术。

```ts
type BaguaSituation = {
  situationId: string;
  internalTrigram: BaguaTrigram;
  externalTrigram: BaguaTrigram;
  opposition?: {
    left: string;
    right: string;
    pressure: string;
  };
  changingLines: number[];
  structuralTags: string[];
  narrativeEffect: string;
};

type BaguaTrigram =
  | "乾"
  | "坤"
  | "震"
  | "巽"
  | "坎"
  | "离"
  | "艮"
  | "兑";
```

建议映射：

| 卦 | 结构意义 | 推演压力 |
| --- | --- | --- |
| 乾 | 权威、创始、强势推进 | 权力压迫、上位者行动 |
| 坤 | 承载、群众、母体 | 群体承压、资源供给 |
| 震 | 发动、惊动、起义 | 突发事件、主动破局 |
| 巽 | 渗透、传播、影响 | 暗线扩散、柔性侵入 |
| 坎 | 危险、深渊、隐秘 | 陷阱、旧债、身份风险 |
| 离 | 显现、附着、文明 | 暴露、名声、证据 |
| 艮 | 停止、门槛、阻隔 | 守关、拖延、试炼 |
| 兑 | 交换、言说、裂口 | 谈判、诱惑、关系裂缝 |

### QimenBoard

奇门负责阶段战术局：此时、此地、此门、此宫怎样推动或扭曲事件。

```ts
type QimenBoard = {
  boardId: string;
  temporalFrame: TemporalFrame;
  school: "turntable" | "manual-lite";
  dun: "yang" | "yin";
  juNumber: number;
  yuan: "upper" | "middle" | "lower";
  palaces: QimenPalace[];
  valueChief: string;
  valueEnvoy: string;
  activePalace: number;
  focusPalaces: number[];
  hardDecisionAllowed: boolean;
};

type QimenPalace = {
  palace: number;
  direction: string;
  door: string;
  star: string;
  deity: string;
  heavenStem?: string;
  earthStem?: string;
  tags: string[];
};
```

第一版可以保留 `manual-lite`：

- `开门`：提前、打开机会、主动推进。
- `休门`：延缓、观察、修复。
- `伤门`：消耗、受损、拉扯。
- `惊门`：突发、暴露、反转。
- `杜门`：阻断、隐藏、隔绝。
- `景门`：显名、传播、舞台化。
- `死门`：封死、代价、不可逆风险。
- `生门`：资源、生路、恢复。

## Agent 分工

Agent 分工必须服从正史门。

| Agent | 输入 | 输出 | 权限 |
| --- | --- | --- | --- |
| DirectorAgent | canon summary、run goal、market/节奏偏好 | directive proposal | 不能写 canon |
| WorldBuilderAgent | Atlas slice、world rules、locations | world pressure proposal | 不能改硬规则 |
| CharacterAgent | character profile、bazi、memory、current pressure | action candidates | 只能代表角色提出选择 |
| MetaphysicsAgent | MetaphysicsFrame trace | explanation/report | 只能解释已计算结果 |
| CriticAgent | branch events、draft、gate reasons | critique/rewrite advice | 不能覆盖 gate |
| WriterAgent | selected canon facts、scene cards | prose draft | 只能写表达层 |

角色 agent 的输出格式：

```ts
type CharacterActionCandidate = {
  candidateId: string;
  characterId: string;
  action: string;
  intent: string;
  expectedGain: string;
  expectedCost: string;
  riskTags: string[];
  supportingInfluences: string[];
  violatesKnownAnchor: boolean;
};
```

## 数据流

### 手动推演

```text
author directive
-> create SimulationRun
-> load canon / atlas / memory
-> build MetaphysicsFrame
-> activate characters and relationships
-> generate action candidates
-> simulate canon candidate + branches
-> evaluate branches
-> CanonGate decision
-> update read model
-> author sees report
```

### 长期运行

```text
WorldDaemon wake
-> inspect canon pressure
-> choose tick reason
-> create SimulationRun
-> checkpoint after every step
-> pause if author needed
-> resume when author responds
-> archive all branches and traces
```

### 写作管线

```text
accepted canon / selected branch
-> narrative source pack
-> scene plan
-> scene cards
-> draft
-> critique
-> memory write
```

写作层只消费正史和已选择分支，不直接改变世界状态。

## Workbench 设计

Workbench 应新增或强化五个视图。

### 1. Daemon

显示：

- 当前 daemon 状态：idle、running、paused、failed。
- 下一次 wake 原因和时间。
- 最近 run。
- 当前需要作者处理的 handoff。

操作：

- Start manual tick。
- Resume paused run。
- Stop after current checkpoint。
- Change autonomy mode。

### 2. Simulation Runs

显示：

- run 列表。
- 每个 run 的 steps。
- artifacts 路径。
- branch evaluations。
- gate decision。

操作：

- Export report。
- Reopen run。
- Replay from checkpoint。

### 3. Canon Gate

显示：

- 通过原因。
- 拒绝原因。
- 需要作者裁决的风险。
- 正史、锚点、术数压力之间的冲突。

操作：

- Accept branch。
- Archive only。
- Reject。
- Approve high-risk change with author note。

### 4. Metaphysics Trace

显示：

- 时间帧。
- 角色八字/原型。
- 八卦结构场。
- 奇门九宫或 manual-lite 局。
- 每条 influence 的来源和权重。

操作：

- Toggle exact / inferred layers。
- Override temporal frame。
- Override qimen pattern。
- Save author note。

### 5. World Atlas

显示：

- canon facts。
- branch-only facts。
- character states。
- relationships。
- foreshadows。

操作：

- Compile atlas。
- Inspect fact provenance。
- Compare canon vs branch。

## 存储策略

第一版保持文件系统 JSON 存储，不引入数据库。

推荐路径：

```text
.novel-system/
  runs/
  checkpoints/
  daemon/
  atlas/
  memory/
```

规则：

- run artifacts 不可原地修改；修正时创建新 run 或追加 decision。
- checkpoint 可以覆盖同一 run 的 step 状态，但每次恢复必须追加 resume event。
- canon line 仍由现有 engine 管理，后续可逐步迁移到 append-only truth store。

## 错误处理

| 错误 | 处理 |
| --- | --- |
| LLM provider 失败 | 保存 step failure，允许 resume 或 fallback 到 deterministic |
| CanonGate fatal | reject branch，写入 rejected reason |
| 高风险但可写 | pause run，生成 author handoff |
| 术数 adapter 失败 | 降级到 manual-lite 或 fictional-cycle，并记录 confidence |
| Atlas 路径越界 | 拒绝读取，记录 security reason |
| daemon 中断 | 从最近 checkpoint 恢复 |
| Git 元数据损坏 | 不执行 commit，把验证结果写入最终汇报 |

## 测试策略

### 单元测试

- `MetaphysicsFrame` 能把八字、八卦、奇门转成稳定 influences。
- `CanonGate` 能拒绝锚点破坏、无因背叛、无因死亡、硬规则冲突。
- `SimulationRunStore` 能保存、加载、恢复 step。
- `WorldDaemon` 能 manual tick、pause、resume、fail and recover。

### 集成测试

- 从 sample world 创建 run，生成分支，CanonGate 给出可解释 decision。
- 高风险奇门 hard decision 必须进入 author handoff。
- 写作 job 只能从 accepted canon 或 selected branch 生成 source pack。
- Workbench handlers 能列出 runs、读取 trace、执行 promote。

### 回归测试

- 现有 45 个测试必须继续通过。
- 任意 parsed world 不能依赖样例角色名。
- Atlas file API 必须限制在 atlas root 下。
- checkpoint resume 必须恢复 plan/cards/draft/review。

## 渐进实现路线

### Phase 0：仓库卫生

目标：确认当前工作区源码可验证，并处理 Git 元数据损坏。

动作：

- 保留当前文件状态。
- 导出当前源码快照。
- 修复或重建 Git refs 后再提交。
- 在 Git 修复前不执行 destructive git 操作。

### Phase 1：SimulationRun

目标：把每次推演落成可复盘 artifact。

新增：

- `src/simulation-run.ts`
- `src/run-store.ts`
- `tests/simulation-run.test.ts`

接入：

- `SimulationJob` 创建 run。
- 每步写 checkpoint。
- Workbench 能列出 run summary。

### Phase 2：CanonGate

目标：把正史门从 engine 评分逻辑里抽出来。

新增：

- `src/canon-gate.ts`
- `tests/canon-gate.test.ts`

接入：

- `WorldHistoryEngine.runStage` 使用 gate decision。
- `promoteBranch` 必须携带 gate decision 或作者 override。

### Phase 3：MetaphysicsFrame

目标：术数层统一成可 trace 的运行时帧。

新增：

- `src/metaphysics/frame.ts`
- `src/metaphysics/bagua.ts`
- `src/metaphysics/qimen-board.ts`
- `tests/metaphysics-frame.test.ts`

接入：

- 保留现有 `src/metaphysics.ts` public API，内部逐步委托给新模块。
- Workbench 展示 trace。

### Phase 4：WorldDaemon

目标：支持长期运行、暂停、恢复。

新增：

- `src/world-daemon.ts`
- `tests/world-daemon.test.ts`

接入：

- Workbench 新增 daemon handlers。
- CLI 或 server 可触发 manual tick。
- paused run 可恢复。

### Phase 5：Workbench v2

目标：让作者能看懂推演，而不是只看结果。

改造：

- `workbench/src/App.tsx`
- `workbench/src/server.ts`
- `workbench/src/contracts.ts`
- `workbench/src/api.ts`

新增视图：

- Daemon 状态。
- Runs 列表。
- CanonGate 面板。
- Metaphysics Trace 面板。

### Phase 6：Agent adapters

目标：把多 Agent 放在正确位置。

新增：

- `src/agents/role-agent.ts`
- `src/agents/director-agent.ts`
- `src/agents/critic-agent.ts`
- `src/agents/provider.ts`

规则：

- Agent 输出 candidate，不写 canon。
- 所有 agent 输出进入 run artifacts。
- CanonGate 仍是唯一正史入口。

## 首版成功标准

一个成功的 v2 首版应满足：

1. 作者可以启动一次 `SimulationRun`，看到完整 artifacts。
2. 每个 branch 的通过/拒绝原因可解释。
3. 八字、八卦、奇门对行动的影响可 trace。
4. 高风险变化会暂停并请求作者裁决。
5. daemon 中断后能从 checkpoint 恢复。
6. 写作层只能消费 gate 后的事实。
7. 现有测试继续通过，并新增 runtime/gate/metaphysics 测试。

## 关键取舍

推荐路线：轻量自研 runtime，外部项目只做参考或 adapter。

不推荐直接引入 LangGraph/Temporal 作为首版核心。它们解决的是 durable workflow，但本项目更需要先固定小说领域模型。如果过早引入重型框架，复杂度会压过领域设计。

不推荐把所有角色都做成长驻 LLM agent。角色长期状态应在 truth/memory/atlas 中，LLM 只在需要候选行动或表达时被唤醒。

不推荐把八字、奇门做成最终裁判。术数层最适合做“压力系统”，CanonGate 才是裁判。

## 资料来源

- Codex CLI 官方文档：https://developers.openai.com/codex/cli
- Codex `AGENTS.md` 官方文档：https://developers.openai.com/codex/guides/agents-md
- Codex subagents 官方文档：https://developers.openai.com/codex/subagents
- Codex hooks 官方文档：https://developers.openai.com/codex/hooks
- Claude Code overview：https://code.claude.com/docs/en/overview
- Claude Code memory：https://docs.claude.com/en/docs/claude-code/memory
- Claude Code hooks：https://docs.claude.com/en/docs/claude-code/hooks
- Claude Code subagents：https://docs.claude.com/en/docs/claude-code/sub-agents
- OpenAI Agents SDK tracing：https://openai.github.io/openai-agents-js/guides/tracing/
- OpenAI Agents SDK guardrails：https://openai.github.io/openai-agents-js/guides/guardrails/
- LangGraph durable execution：https://docs.langchain.com/oss/javascript/langgraph/durable-execution
- LangGraph persistence：https://docs.langchain.com/oss/javascript/langgraph/persistence
- AutoGen human-in-the-loop：https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html
- AutoGen AgentChat：https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/index.html
- Temporal long-running workflows：https://temporal.io/
- MiroFish CLI：https://github.com/amadad/mirofish-cli
- Hermes Agent：https://huggingface.co/docs/inference-providers/main/en/integrations/hermes-agent
- OpenClaw GitHub：https://github.com/openclaw/openclaw
- 香港天文台二十四节气：https://www.weather.gov.hk/en/gts/time/24solarterms.htm
- 香港天文台节气时间资料：https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm
- SEP Chinese Philosophy of Change：https://plato.stanford.edu/archives/sum2024/entries/chinese-change/
- 6tail tyme4ts：https://github.com/6tail/tyme4ts
- 6tail lunar-javascript：https://github.com/6tail/lunar-javascript
- qfdk/qimen：https://github.com/qfdk/qimen

## 自查结果

- 没有把术数降级为 prompt 标签；术数输出统一进入 `MetaphysicsFrame`。
- 没有让多 Agent 直接写正史；所有正史写入都经过 `CanonGate`。
- 长期运行被建模为 `WorldDaemon`，并包含 checkpoint、pause、resume。
- 每次推演都有 `SimulationRun` artifacts，支持复盘和审计。
- 首版范围保持在文件系统 JSON、现有 engine、现有 workbench 内，没有引入重型外部 workflow 平台。
