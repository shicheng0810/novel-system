# sources.md — comparable systems survey
Accessed date: 2026-05-11. Fetch rule: each URL was attempted up to two times; failed fetches are retained as public-source pointers with error metadata in sources.json and treated as lower-confidence anchors.

## Agent frameworks
### S01 · LangGraph Studio (OK)
- URL: https://docs.langchain.com/langgraph-platform/langgraph-studio
- Fetch note: LangSmith Studio - Docs by LangChain
- Visual pattern: 把 agent graph 的节点、状态和运行路径可视化，强调从图结构理解后台推理。
- Cognitive principle: 可观测性应贴近真实执行模型：节点、边、状态变更，而不是抽象成一个 spinner。
- Why it works: 让黑箱拆成阶段化 trace；失败时节点定位清楚。
- Why it sometimes fails: 如果每个节点都全量展示，会把作者变成运维人员。
- Applicability: 可映射到 6-stage pipeline 的轻量阶段条，不把完整 graph 塞进主画布。

### S02 · LangSmith traces (OK)
- URL: https://docs.smith.langchain.com/observability
- Fetch note: LangSmith Observability - Docs by LangChain
- Visual pattern: 以 trace tree / spans 展示 LLM 调用、工具调用、延迟和输入输出。
- Cognitive principle: 异步复杂系统需要统一 trace id 与 span 层级。
- Why it works: 跨组件追踪同一 run，适合 debug。
- Why it sometimes fails: 默认视图太工程化，不适合作家日常。
- Applicability: 后台保留 trace，前台只抽取“世界事件摘要”。

### S03 · Microsoft AutoGen Studio (OK)
- URL: https://microsoft.github.io/autogen/stable/user-guide/autogenstudio-user-guide/index.html
- Fetch note: AutoGen Studio &#8212; AutoGen
- Visual pattern: 用低代码 UI 搭建 multi-agent workflow，并查看 agent 消息/运行。
- Cognitive principle: 多智能体系统要暴露“谁在说话/思考/行动”。
- Why it works: agent 间对话让系统显得有社会性。
- Why it sometimes fails: 对非技术作者可能过多强调聊天记录。
- Applicability: 角色代理反思/计划可做成“角色低语”而非完整日志。

### S04 · OpenAI Assistants / Threads docs (OK)
- URL: https://platform.openai.com/docs/assistants/overview
- Fetch note: Assistants migration guide | OpenAI API
- Visual pattern: thread/run/step 模型把长任务拆成 run steps 与 status。
- Cognitive principle: 长任务状态要有可恢复的生命周期与可解释中间状态。
- Why it works: 用户知道当前是 queued/in_progress/requires_action/completed。
- Why it sometimes fails: 状态名若过于技术化，会变成另一层黑话。
- Applicability: 写作 pipeline 可暴露“读记忆/定蓝图/扩场/合成/审稿/落记忆”。

### S05 · Cursor Agent interface (OK)
- URL: https://docs.cursor.com/chat/agent
- Fetch note: Cursor Docs — Agent, Rules, MCP, Skills &amp; CLI
- Visual pattern: IDE agent 展示正在读文件、改文件、运行命令，用户可中断。
- Cognitive principle: 自主代理要把动作动词化：正在读、正在写、正在验证。
- Why it works: 减少等待焦虑并支持介入。
- Why it sometimes fails: 太多文件级动作会干扰创作心流。
- Applicability: 把世界动作压成“世界正在回忆/推演/入史”。

### S06 · Replit Agent (OK)
- URL: https://docs.replit.com/replitai/agent
- Fetch note: Replit Docs
- Visual pattern: Agent 以步骤计划、操作和结果组织软件生成过程。
- Cognitive principle: 计划-执行-反馈循环可以形成任务节奏。
- Why it works: 适合让用户看见进度与下一步。
- Why it sometimes fails: 对小说系统不应呈现为施工工地。
- Applicability: 底栏 Runtime 可承载详细 steps，画布只显示短促回响。

## MMO + idle/incremental games
### S07 · EVE Online overview (OK)
- URL: https://wiki.eveuniversity.org/Overview
- Fetch note: Overview - EVE University Wiki
- Visual pattern: Overview 把巨大宇宙压缩成可过滤、可排序、持续更新的战术列表。
- Cognitive principle: 复杂世界需要一个按相关性过滤的“雷达”。
- Why it works: 实时、可扫视、默认支持行动。
- Why it sometimes fails: 过滤错误会让玩家错过关键威胁。
- Applicability: CodexRail Now 可变成 author radar：只显示当前章节相关世界事件。

### S08 · Stardew Valley calendar and clock (OK)
- URL: https://stardewvalleywiki.com/Calendar
- Fetch note: Calendar - Stardew Valley Wiki
- Visual pattern: 日历/时钟把季节、生日、节日和每日节奏连成可预期循环。
- Cognitive principle: 节奏来自周期性与预告，而不只是事件流。
- Why it works: 让玩家感到世界按自己的时间运转。
- Why it sometimes fails: 过强日程会压迫自由创作。
- Applicability: daemon tick / qimen pattern 可转译成“世界时辰/气机”。

### S09 · Disco Elysium Thought Cabinet (FETCH-LIMITED)
- URL: https://discoelysium.fandom.com/wiki/Thought_Cabinet
- Fetch note: HTTPError: HTTP Error 403: Forbidden
- Visual pattern: Thought Cabinet 把内心思想当作可孵化、可完成、可改变属性的对象。
- Cognitive principle: 内在状态也应有进度、代价与完成回响。
- Why it works: 抽象心理过程变成可感知系统。
- Why it sometimes fails: 游戏化过度会削弱文学感。
- Applicability: 角色反思可显示为“心念孵化/顿悟”，不是 debug log。

### S10 · Crusader Kings III notifications (OK)
- URL: https://ck3.paradoxwikis.com/Interface
- Fetch note: Client Challenge
- Visual pattern: 以消息、弹窗、右侧提示、日志组织王朝事件和紧急决策。
- Cognitive principle: 事件严重度分层：必须处理、建议查看、可归档。
- Why it works: 玩家能从宏观历史流里抓住关键选择。
- Why it sometimes fails: 通知过载会导致麻木。
- Applicability: CanonGate / pause / promotion 需要 severity routing。

### S11 · Universal Paperclips (OK)
- URL: https://www.decisionproblem.com/paperclips/
- Fetch note: 
- Visual pattern: 极简数值面板通过解锁、计数增长和阶段变化制造系统生命感。
- Cognitive principle: 统一感可来自少量核心指标的持续变化。
- Why it works: 无需复杂动画也能让玩家感到机器在运转。
- Why it sometimes fails: 纯数字会牺牲叙事质感。
- Applicability: Memory/Atlas counts 可配合“刚增长”与阶段性解锁。

### S12 · Factorio production statistics (FETCH-LIMITED)
- URL: https://wiki.factorio.com/Production_statistics
- Fetch note: TimeoutError: The read operation timed out
- Visual pattern: 生产图用时间窗口显示输入/输出速率与瓶颈。
- Cognitive principle: 系统节奏可以用速率与趋势呈现，而不是静态总量。
- Why it works: 适合发现异常和建立节拍感。
- Why it sometimes fails: 对创作 UI 太工业化。
- Applicability: Runtime tab 可有 world throughput；主画布只展示轻量心跳。

### S13 · Dwarf Fortress announcements/reports (OK)
- URL: https://dwarffortresswiki.org/index.php/Announcements
- Fetch note: Announcement - Dwarf Fortress Wiki
- Visual pattern: 矮人堡垒用 announcements/reports 把模拟世界事件不断吐出。
- Cognitive principle: 模拟世界需要“编年史式事件流”。
- Why it works: 事件文本让随机模拟变成故事。
- Why it sometimes fails: 重要/琐碎混杂时可读性下降。
- Applicability: 世界回响 feed 应可折叠、可过滤、可汇总。

## Observability
### S14 · Datadog Watchdog (OK)
- URL: https://docs.datadoghq.com/watchdog/
- Fetch note: 
- Visual pattern: Watchdog 自动检测异常并给出提示，减少用户主动查图。
- Cognitive principle: 可观测性要从 pull 变成 push：异常主动浮出。
- Why it works: 降低发现问题成本。
- Why it sometimes fails: 自动诊断若误报会损害信任。
- Applicability: CanonGate high-risk 与 daemon pause 应主动浮出但可静音。

### S15 · Grafana annotations (OK)
- URL: https://grafana.com/docs/grafana/latest/dashboards/annotations/
- Fetch note: Annotate visualizations | Grafana documentation
- Visual pattern: Annotations 在图表时间线上标记部署、事件、告警。
- Cognitive principle: 事件需要被钉到时间轴，解释指标变化。
- Why it works: 把“发生过什么”与“数值怎么变”合并。
- Why it sometimes fails: 手工/噪声注释会污染图。
- Applicability: 历史线可叠加 memory/atlas/gate/promotion marks。

### S16 · Honeycomb trace waterfall (FETCH-LIMITED)
- URL: https://docs.honeycomb.io/investigate/traces/
- Fetch note: HTTPError: HTTP Error 404: Not Found
- Visual pattern: Trace waterfall 按时间展示 spans、层级和延迟。
- Cognitive principle: 复杂请求的统一视角是同一个时间轴下的嵌套工作。
- Why it works: 找慢点和失败点极强。
- Why it sometimes fails: 完整 waterfall 对作者太重。
- Applicability: BottomPanel Runtime detail 可用；主界面只抽象成 6-stage tempo。

### S17 · Sentry breadcrumbs (OK)
- URL: https://docs.sentry.io/product/issues/issue-details/breadcrumbs/
- Fetch note: Using Breadcrumbs
- Visual pattern: Breadcrumbs 记录错误前的一串用户/系统事件。
- Cognitive principle: 事后解释需要前因后果的小面包屑。
- Why it works: debug 和叙事复盘都需要上下文。
- Why it sometimes fails: 只在出错后出现会错过日常节奏价值。
- Applicability: 每章生成可保留“世界刚才发生了什么”的 breadcrumb。

### S18 · Linear Cycles (FETCH-LIMITED)
- URL: https://linear.app/docs/cycles
- Fetch note: HTTPError: HTTP Error 404: Not Found
- Visual pattern: Cycles 把工作组织进固定时间盒与进度视图。
- Cognitive principle: 周期容器让持续工作有节奏与归属。
- Why it works: 减少散乱任务感。
- Why it sometimes fails: 周期不适合所有创造性流程。
- Applicability: 章节/阶段可成为 tempo container，承载推演与写作事件。

## Writing tools
### S19 · Sudowrite Story Bible (FETCH-LIMITED)
- URL: https://docs.sudowrite.com/using-sudowrite/story-bible
- Fetch note: HTTPError: HTTP Error 500: Internal Server Error
- Visual pattern: Story Bible 将角色、世界、概要作为生成上下文来源。
- Cognitive principle: 写作 AI 需要显式展示哪些 canon 被用于生成。
- Why it works: 提高作者对上下文注入的信任。
- Why it sometimes fails: 如果自动引用不透明，仍会产生漂移恐惧。
- Applicability: Now tab 应显示 sourcePack derived 的“本段引用了哪些世界事实”。

### S20 · Novelcrafter Codex (OK)
- URL: https://docs.novelcrafter.com/en/articles/8671137-the-codex
- Fetch note: Need Help? - Novelcrafter Help
- Visual pattern: Codex 管理人物、地点、物品等，并可被写作过程引用。
- Cognitive principle: 知识库不是仓库，而是生成时的上下文供应。
- Why it works: 统一 story bible 与生成。
- Why it sometimes fails: 过度手工维护会拖慢写作。
- Applicability: 记忆/图谱变化需反向告诉画布：本次写作新增了什么 canon。

### S21 · Scrivener compile (OK)
- URL: https://scrivener.tenderapp.com/help/kb/features-and-usage/what-is-compile
- Fetch note: Features and Usage / FAQs - Literature and Latte Support
- Visual pattern: Compile 把草稿、结构和格式规则合成为输出文档。
- Cognitive principle: 复杂级联操作需要明确“预览—执行—完成”反馈。
- Why it works: 降低最终导出焦虑。
- Why it sometimes fails: 编译错误信息可能太技术化。
- Applicability: confirm-final cascade 可借鉴 compile feedback。

### S22 · Obsidian Graph view (OK)
- URL: https://help.obsidian.md/plugins/graph
- Fetch note: Graph view - Obsidian Help
- Visual pattern: Graph view 让笔记之间的链接形成可视网络。
- Cognitive principle: 关联结构能增强“世界整体性”的感受。
- Why it works: 直观展示局部与全局关联。
- Why it sometimes fails: 大图容易变成漂亮但不可用的星云。
- Applicability: Atlas tab 适合局部图谱，不宜占主画布。

### S23 · Roam daily notes (OK)
- URL: https://roamresearch.com/#/app/help/page/Vu1MmjinS
- Fetch note: Roam Research – A note taking tool for networked thought.
- Visual pattern: Daily notes 以日期为默认入口，将零散想法汇入时间流。
- Cognitive principle: 时间流可统一异构信息。
- Why it works: 降低归档摩擦。
- Why it sometimes fails: 长期会产生流水账。
- Applicability: 世界事件流可按“本章/今日推演”自动归档。

### S24 · Notion AI sidebar (FETCH-LIMITED)
- URL: https://www.notion.com/help/notion-ai
- Fetch note: HTTPError: HTTP Error 404: Not Found
- Visual pattern: AI 作为侧边助手嵌入文档，围绕当前页面提供操作。
- Cognitive principle: AI 功能应贴近主对象，而非把用户带离文档。
- Why it works: 保持文档中心性。
- Why it sometimes fails: 侧栏过强会分裂注意力。
- Applicability: 符合 prose-canvas-first：所有提示以画布为中心、详情在 Rail。

## Livestream + chat
### S25 · Twitch chat replay (OK)
- URL: https://help.twitch.tv/s/article/video-on-demand?language=en_US
- Fetch note: On-Demand Content on Twitch
- Visual pattern: 回放时聊天按原始时间戳同步出现。
- Cognitive principle: 旁路事件流与主内容同频，形成现场感。
- Why it works: 让观看者知道当时发生的社会反应。
- Why it sometimes fails: 聊天噪声可能遮蔽内容。
- Applicability: 写作画布旁可有低噪“世界回响”，按章节时间同步。

### S26 · Slack threads (OK)
- URL: https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions
- Fetch note: Use threads to organize discussions | Slack
- Visual pattern: 线程把相关讨论收束到一个父消息下，避免污染频道主流。
- Cognitive principle: 事件细节应可钻取但不淹没主流。
- Why it works: 主流保持清爽，细节可追溯。
- Why it sometimes fails: 过多线程可能割裂上下文。
- Applicability: 每个世界事件一行，点击展开 run/canon/memory details。

### S27 · Telegram sendChatAction (OK)
- URL: https://core.telegram.org/bots/api#sendchataction
- Fetch note: Telegram Bot API
- Visual pattern: typing/uploading 等短状态告诉对方“对端正在行动”。
- Cognitive principle: 微状态能缓解等待且无需完整解释。
- Why it works: 简单、低成本、强即时感。
- Why it sometimes fails: 状态太泛会失去信息量。
- Applicability: StatusBar 可显示“世界正在回忆/推演/落印”。

## IDEs
### S28 · VS Code Tasks (OK)
- URL: https://code.visualstudio.com/docs/debugtest/tasks
- Fetch note: Integrate with External Tools via Tasks
- Visual pattern: 后台任务有输出、问题匹配、状态栏与终端集成。
- Cognitive principle: 长任务要有可查看详情的后台通道和简短状态入口。
- Why it works: 兼顾专注与可追溯。
- Why it sometimes fails: 输出终端不适合非工程用户。
- Applicability: BottomPanel Runtime 是详情；StatusBar 是入口。

### S29 · IntelliJ Event Log / Notifications (OK)
- URL: https://www.jetbrains.com/help/idea/notifications.html
- Fetch note: Notifications | IntelliJ&nbsp;IDEA Documentation
- Visual pattern: IDE 用通知气泡、事件日志和严重度管理后台事件。
- Cognitive principle: 通知需要可读、可回看、可按严重度控制。
- Why it works: 既不打断所有事，也不丢重要事。
- Why it sometimes fails: 通知疲劳。
- Applicability: 世界事件分级：ambient / notable / decision-required。

### S30 · GitHub Copilot Chat status (OK)
- URL: https://docs.github.com/en/copilot/using-github-copilot/copilot-chat/asking-github-copilot-questions-in-your-ide
- Fetch note: Asking GitHub Copilot questions in your IDE - GitHub Docs
- Visual pattern: IDE 内 Copilot Chat 围绕当前文件/选择上下文回答并显示进行状态。
- Cognitive principle: AI 状态应绑定当前工作对象。
- Why it works: 用户理解 AI 正在处理“这一段/这一章”。
- Why it sometimes fails: 上下文不明时易误用。
- Applicability: 局部重写与写续段应显示本段 sourcePack 与 pipeline stage。

## Open sourcing notes
No category below two sources; several individual pages may still be fetch-limited and should be revisited if the design becomes product-critical.
