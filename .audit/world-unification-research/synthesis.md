# synthesis.md — 让 novel-system 像一个有节奏的生命体

## TL;DR
TL;DR：问题不是世界没有跑，而是世界的呼吸被拆散到 Runtime、Runs、Memory、Atlas、Agent trace、CanonGate、Pipeline、Qimen 等十几处。统一感的核心不是再加一个总控台，而是把所有后台动作收束成一条可感知的“世界心跳”：默认只给作者听见节奏，重要变化形成世界回响，需要决策才打断。MVP 应先做心跳脉络、六阶段灯轨、入史落印、世界回响四件事，让生成等待、终稿确认、记忆/图谱更新、CanonGate 风险都变成同一个生命体的动作。

## 重新表述用户的 reframing
用户说“整个 project 的运行逻辑还是比较分散，感觉不统一”。这句话的重点不是信息架构太乱，也不只是 UI tab 太多；更精确地说，是作者已经知道 backend/world simulator/LangGraph daemon/DeepSeek pipeline/character agents/memory/canon/atlas 都在工作，但这些工作没有共同的时间感。它们像六七台各自运转的机器：有的写 SQLite，有的吐 JSON，有的更新 store，有的编译 markdown，有的只在 trace 里留下角色心理活动。作者面对 prose canvas 时，只看到结果偶尔出现，过程却没有“一个世界正在活着”的连续感觉。

因此，设计目标应从“把所有子系统都显示出来”改成“把所有子系统翻译成同一个世界节拍”。统一不是中央仪表盘；统一是作者在写作时能自然感到：世界正在回忆，世界正在推演，角色正在起念，规范门正在免疫，终稿正在入史。

## 诊断摘要
Phase 1 将 14 个异步子系统按状态泄漏诊断。最严重的 opacity 集中在六类事件。第一类是长等待：DeepSeek 6-stage pipeline 目前只有“处理中：生成章节”，1-3 分钟内阶段不可见。第二类是世界决策：CanonGate accept/reject/pause、promotion 扶正、branchHistory 这些决定正史的动作只在 JSON 或完全不可见。第三类是角色生命：character reflections/plans 被埋在 SimulationRun trace，导致角色代理没有存在感。第四类是记忆/图谱成长：memory writes 与 atlas compiles 只表现为 tab 计数或树变化，没有“刚刚写入/刚刚重建”的回响。第五类是 daemon/qimen 的心跳：Runtime tick 与奇门 pattern 默认静态或收在 BottomPanel，作者离开底栏就失去呼吸感。第六类是 confirm-final cascade：终稿确认后 memory、atlas、canon 多步级联没有被叙述，缺少落印仪式。

可见性上，branch evaluations 是唯一相对可见的部分：BottomPanel 推演 timeline 与 WritingCanvas 历史线已经让 stage/branch 有了节奏。但它的问题是孤立：推演线没有承接 memory write、agent reflection、CanonGate、promotion、atlas compile 等事件，所以它像“推演工具”而非“世界生命线”。由此可见，真正的缺口是跨子系统事件模型，而不是单个 tab 的美化。

## 设计原则

### 1. 单一心跳，不是多块仪表盘
所有后台动作应先归入同一条世界心跳。借鉴 OpenAI run steps、Telegram typing action、Cursor/Replit agent action status，作者不需要默认看到所有 trace，只需要知道世界此刻处于“回忆/推演/成文/自审/入史/暂停待决策”哪种动词状态。失败模式是把心跳做成另一个 spinner；所以心跳必须显示阶段动词和最后一次真实动作，而不是纯动画。

### 2. 事件有时间轴，状态才有意义
Grafana annotations、Sentry breadcrumbs、Roam daily notes 都说明：静态状态只有被放回时间轴，才解释“为什么现在变成这样”。Memory count +7、Atlas tree 多两个节点、Qimen 从休门到生门，如果没有时间戳和原因，只是数字变化。novel-system 应将异构事件钉到章节/运行时间轴上，形成本章 breadcrumb。

### 3. 严重度分层：环境、显著、需决策
CK3 notifications、Datadog Watchdog、IntelliJ notifications 的共同点是分层。不是所有事件都该打断作者。daemon tick、qimen 微变、memory 小写入是 ambient；角色顿悟、Atlas rebuild、promotion 是 notable；CanonGate reject、high-risk pause、hard-decision 才 decision-required。没有分层，世界回响会很快退化成噪音。

### 4. 主画布永远是太阳，观测面板只是轨道
Notion AI sidebar、Copilot Chat、VS Code task status 都把 AI/任务状态围绕当前对象组织，而不是把用户拽进另一个控制室。prose-canvas-first invariant 不能被破坏：WritingCanvas 永远 mounted，正文永远主角。状态栏、右侧 Rail、底栏、LensDrawer 都应该服务于“当前章/当前段/当前 run”，而不是各自成为系统入口。

### 5. 把黑箱阶段翻译成叙事动词
LangGraph/LangSmith/Honeycomb 的 trace 能解释工程系统，但直接搬给作者会过重。更合适的做法是把 pipeline stage 翻译成文学动词：memory-read=取材，blueprint=立骨，scene-expand=铺场，synthesize=成文，critique=自审，memory-write=入史。这样等待不再是技术排队，而是世界在完成一套可感知工序。

### 6. 世界变化需要回响和落印
Dwarf Fortress announcements、Scrivener compile feedback、Twitch chat replay 都说明：事件被讲述出来，系统才像活的。Confirm-final 不应只是 chapter card flip；它应产生短 receipt：正史分支、记忆新增、图谱更新、canon verdict。扶正不应只是 branchHistory；它应是“某条可能性成为正史”的仪式。

### 7. 局部雷达优于全量大图
EVE overview、Sudowrite Story Bible、Novelcrafter Codex 都把复杂世界压缩成当前相关集合。作者不需要在主画布看全量 atlas 或所有 memory；他需要知道本段用了哪几条记忆、哪些世界事实正在约束生成、当前角色有什么计划。局部雷达的风险是过滤不透明，因此需要 sourcePack 透镜与可展开详情。

### 8. 可回放比可查看更接近生命感
Honeycomb waterfall、Sentry breadcrumbs、Twitch replay 的共同价值是“事后能重走一遍发生了什么”。novel-system 可以不在 MVP 做完整 run replay，但至少应为每章保留简短世界 breadcrumb：推演何时开始、哪个分支扶正、CanonGate 如何裁决、哪些记忆/图谱入册、草案如何入史。

## Patterns：按 impact-per-effort 排名

### 1. 心跳脉络
位置：StatusBar + WritingCanvas 顶部一行 ambient line。形式：`世界脉搏：回忆中 → 立骨中 → 成文中 → 自审中 → 入史中；局：阳遁三局·风动`。它覆盖 runtime daemon tick、6-stage pipeline、pause reason、qimen shift、confirm cascade。成本 S，收益最大，因为它把“后台有很多东西”统一成一个持续生命体。注意只在阶段切换或显著状态变化时动，避免闪烁。

### 2. 世界回响
位置：WritingCanvas 右缘或 CodexRail Now 顶部的 3 行可折叠 feed。形式：`玄霜想通了避其锋芒`、`CanonGate 拦下血脉矛盾`、`3 条记忆入册，图谱更新 2 节点`。它覆盖 runs、memory、atlas、agent reflection/plan、CanonGate、promotion、confirm cascade。成本 M。它是统一感的核心，因为所有子系统都说同一种“事件语言”。失败模式是噪音，所以必须默认只显示本章相关和 severe/notable 事件。

### 3. 入史落印
位置：confirm-final 后的 chapter card 下方短 receipt + event feed 归档。形式：`终稿已入史 ✓；正史分支 cautious#12；记忆 +7；图谱 +2；Canon 通过`。成本 S。它立刻修复 confirm-final cascade 不被叙述的问题，也增强作者对 memory/atlas/canon 的信任。它应 5 秒后收起，避免每次确认都打断写作。

### 4. 六阶段灯轨
位置：写续段 zone / InlineSlashMenu 附近。形式：`取材 ▰ 立骨 ▰ 铺场 ▱ 成文 ▱ 自审 ▱ 入史 ▱；当前：读取 18 条记忆，筛掉 4 条低相关`。成本 S。它直接替代 pendingAction 的 opaque string，是最明显的等待体验改良。不要显示百分比，避免估时不准；显示阶段和最后动作即可。

### 5. 角色低语
位置：CodexRail Now、scene strip hover、角色 chip。形式：`玄霜 · 反思：师门之命与私怨冲突；下一步：试探陆沉是否知晓禁术；可信度：CRITIC grounded`。成本 M。它让 character agents 从 trace 里走出来，但应限制在当前场景角色，默认诗性摘要，不暴露完整 chain-of-thought。

### 6. 天机转场
位置：CodexRail Now + Canvas ambient transition。形式：`局势：休门 → 生门（气机转暖）；影响：cautious +0.12，rupture 风险 -0.07`。成本 S。它让 qimen/bazi 不只是静态标签，而成为世界 tempo 的节气层。展开时可见数值，默认只给诗性短句。

### 7. 正史分岔图
位置：现有 WritingCanvas 历史线增强 + BottomPanel 推演 timeline。形式：`seed ─ cautious* ─ 扶正✓ ─ draft；rupture ✕ CanonGate: 血脉冲突`。成本 M。它把 branch evaluations、CanonGate、promotion、draft 串成同一条历史线。MVP 只显示当前章 3-5 个节点，不做全局 DAG。

### 8. 源包透镜
位置：LensDrawer / CodexRail Now。形式：当前段落取材 top 5：记忆、图谱、Canon、角色计划、qimen modifier。成本 M。它解决“AI 到底用了哪些世界事实”的信任问题，并让 sourcePack-derived Now tab 更像局部雷达。

## Phased roadmap

### MVP：让等待和落印先统一
第一阶段建议只做四件事：心跳脉络、六阶段灯轨、入史落印、世界回响的最小版本。数据层只需要一个 append-only `WorldEvent` stream：`id, ts, runId, chapterId, subsystem, severity, verb, subject, summary, refs, status`。各子系统不需要直接耦合 UI，只要在关键点 emit event。UI 默认消费最近 3 条本章相关事件；StatusBar 消费最新 active event；BottomPanel 可显示完整列表。MVP 的成功标准：生成章节时作者能看到 6-stage 进展；确认终稿时能看到 memory/atlas/canon receipt；CanonGate reject 能以 decision-required 形式浮出；角色 reflection 至少能以一行摘要出现。

### 第二阶段：把推演、角色、奇门接入同一节奏
在 MVP 稳定后，扩展角色低语、天机转场、正史分岔图。这里重点不是新增视觉复杂度，而是把已有 Branch timeline 与 agent/qimen/canon/promotion events 合流。当前历史线已经是最接近“世界生命线”的资产，应成为统一事件的主干。

### 第三阶段：sourcePack 透镜和回放
最后做源包透镜与每章 replay。它们对信任很重要，但实现依赖事件 refs、sourcePack provenance、memory/atlas/canon IDs 的稳定。先让事件模型跑起来，再做可展开证据链，风险更低。

## 数据流建议：用 WorldEvent 做最小统一层
统一感最好不要从组件树开始做，而要从事件协议开始做。建议增加一个非常薄的 WorldEvent append-only 层，不要求所有子系统重构，只要求在关键状态转移处发出统一事件。事件字段可以保持朴素：`ts` 表示发生时间，`runId/chapterId/sceneId` 绑定当前写作对象，`subsystem` 标出来源，`severity` 使用 ambient/notable/decision-required，`verb` 使用面向作者的动词，`summary` 是一行中文摘要，`refs` 指向 run JSON、memory id、atlas node、canon verdict 或 pipeline span，`status` 表示 started/progress/succeeded/failed/blocked。这样 UI 不需要分别订阅十几个 store；StatusBar、世界回响、BottomPanel Runtime、CodexRail Now 都消费同一条事件流，只是过滤条件不同。

这个层的关键价值在于“松耦合统一”。Runtime daemon 继续写 checkpoint，memory 继续写 SQLite/FTS，atlas 继续编译 markdown，CanonGate 继续产出 verdict，DeepSeek pipeline 继续分六阶段运行；但是每一次对作者有意义的变化，都被复制成一条轻量事件。对后端来说，这是最小侵入；对前端来说，这是最大统一。它还能自然支持回放：本章从推演到成文到入史的过程，不再需要从多个 JSON 和 SQLite 表里拼，而是直接按 WorldEvent 时间排序。

## 视觉语言建议：少动画，多语义
这个系统的气质是中文 xianxia 写作，不是云监控 dashboard。视觉上应避免过多工业化图表和跑马灯。心跳脉络可以用轻微呼吸点、短横线、阶段动词；世界回响可以像史官旁注，不像系统通知；入史落印可以像印章 receipt，不像 CI build summary；角色低语可以像人物小传中的“念头”，不应像聊天气泡轰炸正文。颜色也应承担严重度：ambient 用低对比灰蓝或墨色，notable 用温和金/青，decision-required 才用赤色或高亮。这样做的目的不是装饰，而是让作者在余光中分辨：这是背景气机、这是值得看一眼、这是必须介入。

同时，所有模式都应有“静音但可追溯”的出口。作者进入连续写作时，可以只保留 StatusBar 心跳；需要检查时，展开世界回响；需要 debug 时，再进 BottomPanel Runtime detail。这个三层结构对应日常创作、轻量审阅、工程排错三种心智，不把它们混在一个界面里。

## MVP 验收场景
建议用三个真实场景验收 MVP，而不是只看组件是否渲染。场景一：作者点击“写续段”，系统进入取材、立骨、铺场、成文、自审、入史，作者无需打开底栏也知道当前阶段；如果卡住，最后动作能说明卡在读取记忆、模型返回还是 CanonGate。场景二：作者确认终稿，界面出现短落印：哪条分支成为正史，新增几条记忆，图谱更新哪些节点，CanonGate 是否通过；五秒后收起进世界回响。场景三：CanonGate 拒绝一个高风险设定，系统不是突然失败，而是以 decision-required 事件解释矛盾、关联章节和可选动作。若这三个场景成立，用户会第一次感觉“世界在同一套节奏中回应我”。

## 迁移风险与缓解
最大风险是把统一层做成另一套庞大状态管理，反而增加复杂度。缓解方式是从只写不读开始：各子系统先 emit 事件，UI 只消费摘要，不要求事件反向驱动业务。第二个风险是摘要质量不稳定，尤其角色低语和 CanonGate 解释容易过度发挥。缓解方式是所有摘要都带 refs，默认只陈述已经存在的 structured state，不让摘要生成新 canon。第三个风险是通知疲劳。缓解方式是强制 severity budget：主画布最多三条回响，ambient 自动合并，notable 可折叠，decision-required 才显式暂停。第四个风险是 sourcePack provenance 不完整；可以先让源包透镜只展示已有 memory/atlas/canon id，不追求完整解释链。

## 与 prose-canvas-first 的关系
这些建议都围绕一个前提：主画布不是仪表盘容器，而是世界发生的舞台。统一感不是把更多面板堆到画布周围，而是让每个后台系统在必要时以同一种语法向画布轻声报告。作者写正文时，心跳脉络提供最低限度的“世界仍在运行”；作者等待生成时，六阶段灯轨解释时间去向；作者确认终稿时，入史落印证明文本已经进入世界；作者回顾本章时，世界回响提供编年史。也就是说，画布仍然是太阳，事件流只是大气层：它让太阳看起来在一个活的世界里，而不是漂浮在工具真空中。

## Open questions
1. 角色反思/计划摘要能否在不泄露 chain-of-thought 的前提下稳定生成？建议只展示结果性 state：欲望、顾虑、下一步、grounding 来源。
2. CanonGate reject 应默认暂停还是只提示？这取决于 reject 的可恢复性；高风险硬矛盾应 decision-required，轻微风格/伏笔风险可进入 world echo。
3. Qimen modifier 的数值影响是否足够稳定？若算法还在变，默认展示诗性 transition，数值放 hover，避免作者误以为玄学层完全确定。
4. WorldEvent stream 放 SQLite 还是 session state？若 daemon 已有 persistent SQLite checkpoint，建议事件持久化也落 SQLite，并向 UI 提供 derived snapshot，避免刷新丢失。
5. Feed 的噪声阈值需要真实写作测试。Phase 2 precedents 显示 event log 很容易失败在通知疲劳，因此必须从 3 行摘要开始，而不是全量 timeline。

## Artifact pointers
- diagnosis.md：14 个子系统逐项状态泄漏与 severity 排序。
- sources.json：30 个可机器读取来源卡片，含 fetch metadata。
- sources.md：按 Agent/MMO/Observability/Writing/Livestream/IDE 分组的人类可读调研笔记。
- principles.md：8 条统一系统节奏设计原则。
- patterns.md：8 个 workbench shell pattern，含 ASCII sketch、成本、兼容性与排序。

## 实施细化：先统一事件语义，再统一界面

要避免“又多做一个面板”，实现顺序应当从事件语义开始，而不是从组件开始。建议定义一个很薄的 `WorldEvent` 契约，让 runtime daemon、simulation run、memory store、atlas compiler、character agents、compose pipeline、canon gate、qimen modifier 都只做一件事：在关键节点 emit 一个可归档、可筛选、可转译的事件。这个事件不需要包含完整 debug payload；它只需要包含作者可理解的层：谁在行动、正在做什么、为什么重要、是否需要作者决策、可以在哪里追溯证据。工程 payload 可以通过 refs 指向 runId、memoryId、atlasPath、canonDecisionId、sourcePackId，而不是直接塞进主 UI。

最小字段可以是：`ts, chapterId, runId, subsystem, severity, phase, verb, subject, summary, refs, expiresAt, status`。`subsystem` 让工程侧能追踪来源，`severity` 决定 UI 是否打断，`phase/verb` 决定文学化显示，`refs` 保证可回溯。比如 6-stage pipeline 的 memory-read 可以发出：`severity=ambient, verb=取材, subject=本章, summary=读取 18 条记忆，筛掉 4 条低相关`；CanonGate reject 则发出：`severity=decision-required, verb=裁决, subject=血脉设定, summary=与第 12 章正史冲突，需要改写或确认破例`。同一条事件在 StatusBar 可显示成“世界正在取材”，在世界回响 feed 可显示成一行，在 BottomPanel 可展开为 refs 与原始 trace。

这个模型的关键收益是解耦。当前分散感来自每个子系统各自把状态落到自己的容器：SQLite checkpoint、run JSON、memory count、atlas markdown、trace、branchHistory。若 UI 继续分别读取这些容器，就会永远得到多个器官。若每个器官都把“可被作者感知的变化”转译成事件，UI 就能从同一条生命线上消费。StatusBar 不再需要知道 atlas 如何编译；它只需要知道最新 active/notable event。CodexRail Now 不再需要同时理解 memory、qimen、sourcePack、agent plan 的内部结构；它只需要展示当前章相关事件和 refs。

## 交互细节：低噪默认，强证据可展开

prose-canvas-first 的底线是：任何统一感都不能牺牲正文中心性。因此默认层应极轻。StatusBar 或画布顶部只显示一个短句，类似“世界脉搏：成文中 · 刚取用 18 条记忆”。它不滚动长日志，不展示技术 ID，不闪烁。世界回响 feed 默认三行，并且优先显示本章、本段、当前角色相关事件；旧事件折叠为“刚才还有 5 条世界变化”。当事件严重度升高时，UI 才逐级增强：notable 进入 feed 顶部，decision-required 触发底栏或轻弹层，并给出明确行动按钮，例如“查看冲突”“接受破例”“回到改写”。

可展开层必须服务信任而不是炫技。作者点击“记忆 +7”时，不应看到裸 JSON；应看到新增记忆的类型分布、关联段落、是否来自本次确认、是否进入检索索引。点击 CanonGate reject 时，应看到冲突对象、冲突出处、建议改法和原始 run 引用。点击角色低语时，应看到结果性状态：欲望、顾虑、下一步、grounding 来源；不要暴露完整思维链。这样既让世界显得活，又不把作者拖进调试台。

## 数据流建议：由后台发事件，由前台派生视图

推荐把事件流持久化在 daemon 已经使用的 SQLite 旁边，或同一个 checkpoint DB 中的独立表。后台每个 subsystem 在成功、失败、暂停、阶段切换、确认级联时写入事件；前端订阅一个 derived snapshot：`activePulse`、`recentEchoes`、`decisionQueue`、`chapterBreadcrumbs`、`sourcePackSummary`。这样前端不必轮询十几个源，也不必把业务规则散落在组件里。若 daemon 仍以 1.2 秒 tick 轮询，tick 只需要拉取最近事件和 active run 状态，生成稳定快照即可。

为了避免事件重复，event id 应由 subsystem + runId + phase + source ref 形成幂等 key。例如 confirm-final cascade 可能写 memory、atlas、canon 三类事件，但最终还应有一个 summary receipt event，聚合为“终稿已入史”。UI 默认显示聚合 receipt，展开才看子事件。这样既保留真实多步级联，又让作者感到“一个动作完成了”。

## 验收标准：统一感必须可被体验验证

这个研究的验收不应只看组件是否实现，而应看作者是否能回答五个体验问题。第一，生成章节等待时，作者能否说出系统正在取材、立骨、铺场、成文、自审还是入史？第二，终稿确认后，作者能否知道哪些记忆、图谱、canon 被改变？第三，角色代理运行后，作者能否感到角色“刚刚有了内心变化”，而不是只能在 trace 里查？第四，CanonGate 拦截时，作者能否理解这是世界免疫反应而不是系统失败？第五，收起 BottomPanel 后，作者是否仍能感到世界在同一个节奏里呼吸？若这五个问题成立，哪怕界面很克制，统一感也会显著提升。

## 风险与迁移注意事项

迁移时最大的风险是把统一事件流误做成“全系统日志”。日志追求完整，生命线追求可感知；两者应分层。底层仍可保存完整 trace、run JSON、memory diff、atlas compile output，但进入 WorldEvent 的必须是作者能理解的状态变化。第二个风险是过度拟人化：如果系统把每个技术动作都写成诗句，错误会被柔化，作者反而不知道哪里坏了。因此每条文学化摘要都要保留 refs，展开后能回到真实工程证据。第三个风险是通知疲劳：世界回响一旦超过三行，作者会学会忽略它。默认视图必须严格克制，把 ambient 事件合并，把 notable 事件摘要化，把 decision-required 事件单独排队。第四个风险是跨子系统时序不一致：memory、atlas、canon 的级联可能异步完成，receipt 应区分“正在入史”“部分完成”“入史完成”，不要在最后一个子任务未结束时提前宣称成功。

迁移路线可以从最少侵入开始。先不重构各子系统，只在现有关键点包一层 event emitter：pipeline stage switch、CanonGate verdict、memory write complete、atlas compile complete、promotion append、pause reason update。前端先用 mock/real 混合的 derived snapshot 接入心跳脉络和六阶段灯轨；等事件稳定后，再接世界回响、入史落印、角色低语。这样可以在不触碰核心写作链路的前提下验证体验收益，也便于回滚：如果事件流出问题，写作本体仍然按原路径运行。

## 结论
novel-system 的统一感不应来自一个更大的控制台，而应来自一条更小、更稳定、更文学化的生命线。把后台异步系统统一为 WorldEvent stream，再让 StatusBar、WritingCanvas、CodexRail、BottomPanel 各自消费同一条事件源，系统就会从“六个工具”变成“一个世界”：它会呼吸，会记忆，会犹豫，会裁决，会入史。作者不需要随时看见所有器官；作者只需要在写作时确信，这个世界正在同一个身体里运转。
