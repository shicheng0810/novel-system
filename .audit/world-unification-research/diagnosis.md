# diagnosis.md — 14 个异步子系统的状态泄漏诊断
研究问题：世界已经在运行，但作者感到“整个 project 的运行逻辑比较分散，不统一”。诊断目标不是再增加一个面板，而是找出哪些状态变化没有被纳入同一条可感知节奏。
可见性定义：visible-default=默认写作画布或常驻栏可感知；visible-on-demand=需要打开 tab/底栏/详情；invisible-default=默认不可见但有边缘入口；fully-invisible= consolidated shell 没有真实入口。
## 1. Runtime daemon ticks
- Subsystem name: Runtime daemon ticks
- What changes when it fires: 每约 1.2 秒轮询一次，刷新 SQLite checkpoint 与 session.runtimeDaemon 快照。
- Where state leak lands today: 状态只落在 StatusBar pill（active 时）与 BottomPanel Runtime tab（展开时）。作者一旦收起底栏，心跳消失。
- Visibility level: invisible-default
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 世界其实在呼吸，但作者默认看不见呼吸，因此会把系统理解成“后台脚本”而不是生命体。
## 2. Simulation runs
- Subsystem name: Simulation runs
- What changes when it fires: 生成 .novel-system/runs/<runId>/ JSON，记录推演批次、推理 trace、分支评估与运行产物。
- Where state leak lands today: 只在 BottomPanel Runtime 的 run list 中出现。
- Visibility level: invisible-default
- Severity of opacity for daily authoring: 4/5
- Pain hypothesis: 每次推演都像掉进档案柜，作者没有“这一轮世界刚刚经历了什么”的即时感。
## 3. Memory writes
- Subsystem name: Memory writes
- What changes when it fires: 写入 facts / expressions / foreshadows / revisions，刷新 store.json 与 index.sqlite。
- Where state leak lands today: CodexRail 记忆 tab 只显示计数或搜索结果；没有“刚写入 N 条”的时间性提示。
- Visibility level: visible-on-demand
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 记忆增长本应像树木长年轮，但现在只是静态数字，作者无法信任系统真的记住了。
## 4. Atlas compiles
- Subsystem name: Atlas compiles
- What changes when it fires: 编译 atlas/ markdown，重建地理、势力、人物、法则等结构化世界索引。
- Where state leak lands today: CodexRail 图谱 tab 能看树；没有 rebuild 指示、差异摘要或失败警报。
- Visibility level: visible-on-demand
- Severity of opacity for daily authoring: 4/5
- Pain hypothesis: 图谱像离线手册，不像会被文本事件触发并更新的活地图。
## 5. Character reflections
- Subsystem name: Character reflections
- What changes when it fires: 每 3 ticks 角色依据 CRITIC grounding 反思处境、欲望、风险与对世界的解释。
- Where state leak lands today: 埋在 SimulationRun reasoning trace； consolidated shell 无 UI。
- Visibility level: fully-invisible
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 角色内心在动，但作者看不到“人物刚刚想通了什么”，所以人物代理显得不存在。
## 6. Character plans
- Subsystem name: Character plans
- What changes when it fires: 角色根据反思形成短期目标、行动候选与对其他角色的预期。
- Where state leak lands today: 同样埋在 reasoning trace；无 UI。
- Visibility level: fully-invisible
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 计划是活人感的核心，完全不可见会让群像推演退化成黑箱随机数。
## 7. DeepSeek 6-stage compose pipeline
- Subsystem name: DeepSeek 6-stage compose pipeline
- What changes when it fires: memory-read → blueprint → scene-expand → synthesize → critique → memory-write，持续 1-3 分钟。
- Where state leak lands today: pendingAction 只有“处理中：生成章节”一个不透明字符串，最后草案突然出现。
- Visibility level: invisible-default
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 长等待没有可感知进度，作者无法判断系统是在读记忆、写蓝图、审稿还是卡住。
## 8. CanonGate decisions
- Subsystem name: CanonGate decisions
- What changes when it fires: accept / reject / pause-on-risk，更新 run record 与 branch.passesConsistencyGate。
- Where state leak lands today: 只在 BottomPanel Run Detail JSON 中出现；没有时间线化的“门刚刚拦下了 X”。
- Visibility level: visible-on-demand
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 规范门是世界一致性的“免疫系统”，但现在免疫反应不可见，拒稿像莫名其妙的失败。
## 9. Branch evaluations
- Subsystem name: Branch evaluations
- What changes when it fires: 每阶段对 surge / cautious / rupture 等候选进行评分与解释。
- Where state leak lands today: BottomPanel 推演 timeline 与 WritingCanvas 历史线 switcher 已可见。
- Visibility level: visible-default
- Severity of opacity for daily authoring: 2/5
- Pain hypothesis: 这是少数有节奏的部分；风险是它孤立成“推演专用 UI”，没和记忆/图谱/角色心跳合拍。
## 10. Promotion events
- Subsystem name: Promotion events
- What changes when it fires: 分支被扶正，写入 session.simulation.branchHistory，影响后续 canon 与记忆。
- Where state leak lands today: consolidated shell 未表面化。
- Visibility level: fully-invisible
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: “哪条可能性成为正史”是叙事宇宙的鼓点，缺席会让世界线变更没有仪式感。
## 11. Pause reasons
- Subsystem name: Pause reasons
- What changes when it fires: runtimeDaemon.pauseReason 标出 high-risk / hard-decision 等暂停原因。
- Where state leak lands today: BottomPanel Backend Runtime card 与 pill 文本可见，但很安静。
- Visibility level: visible-on-demand
- Severity of opacity for daily authoring: 3/5
- Pain hypothesis: 暂停本应召唤作者介入，现在只是小字状态，容易被误解成系统停了。
## 12. Qimen modifier shifts
- Subsystem name: Qimen modifier shifts
- What changes when it fires: 每 tick 更新 branch.qimenContext.pattern 与局势修饰。
- Where state leak lands today: CodexRail Now tab 有“局 X · Y”静态行，缺少 transition narration。
- Visibility level: visible-on-demand
- Severity of opacity for daily authoring: 3/5
- Pain hypothesis: 奇门/八字本是节气和天象节奏，但 UI 把它冻成标签，失去“气机流转”。
## 13. Confirm-final cascade
- Subsystem name: Confirm-final cascade
- What changes when it fires: 最终确认后触发 memory + atlas + canon 多步更新。
- Where state leak lands today: chapter card 翻转、memory/atlas count 变化；但级联过程无叙述。
- Visibility level: invisible-default
- Severity of opacity for daily authoring: 5/5
- Pain hypothesis: 收稿时世界应产生回响：入史、入记忆、入图谱；现在只有结果，没有落印。
## 14. Embedding optional
- Subsystem name: Embedding optional
- What changes when it fires: 向 index.sqlite 写 vector columns 或混合检索索引（默认关）。
- Where state leak lands today: UI 无任何提示。
- Visibility level: fully-invisible
- Severity of opacity for daily authoring: 2/5
- Pain hypothesis: 默认关闭时低风险；开启后若无提示，作者不知搜索质量为何变化。
## Severity-sorted table
| Rank | # | Subsystem | Visibility | Severity | Pain hypothesis |
|---:|---:|---|---|---:|---|
| 1 | 1 | Runtime daemon ticks | invisible-default | 5 | 世界其实在呼吸，但作者默认看不见呼吸，因此会把系统理解成“后台脚本”而不是生命体。 |
| 2 | 3 | Memory writes | visible-on-demand | 5 | 记忆增长本应像树木长年轮，但现在只是静态数字，作者无法信任系统真的记住了。 |
| 3 | 5 | Character reflections | fully-invisible | 5 | 角色内心在动，但作者看不到“人物刚刚想通了什么”，所以人物代理显得不存在。 |
| 4 | 6 | Character plans | fully-invisible | 5 | 计划是活人感的核心，完全不可见会让群像推演退化成黑箱随机数。 |
| 5 | 7 | DeepSeek 6-stage compose pipeline | invisible-default | 5 | 长等待没有可感知进度，作者无法判断系统是在读记忆、写蓝图、审稿还是卡住。 |
| 6 | 8 | CanonGate decisions | visible-on-demand | 5 | 规范门是世界一致性的“免疫系统”，但现在免疫反应不可见，拒稿像莫名其妙的失败。 |
| 7 | 10 | Promotion events | fully-invisible | 5 | “哪条可能性成为正史”是叙事宇宙的鼓点，缺席会让世界线变更没有仪式感。 |
| 8 | 13 | Confirm-final cascade | invisible-default | 5 | 收稿时世界应产生回响：入史、入记忆、入图谱；现在只有结果，没有落印。 |
| 9 | 2 | Simulation runs | invisible-default | 4 | 每次推演都像掉进档案柜，作者没有“这一轮世界刚刚经历了什么”的即时感。 |
| 10 | 4 | Atlas compiles | visible-on-demand | 4 | 图谱像离线手册，不像会被文本事件触发并更新的活地图。 |
| 11 | 11 | Pause reasons | visible-on-demand | 3 | 暂停本应召唤作者介入，现在只是小字状态，容易被误解成系统停了。 |
| 12 | 12 | Qimen modifier shifts | visible-on-demand | 3 | 奇门/八字本是节气和天象节奏，但 UI 把它冻成标签，失去“气机流转”。 |
| 13 | 9 | Branch evaluations | visible-default | 2 | 这是少数有节奏的部分；风险是它孤立成“推演专用 UI”，没和记忆/图谱/角色心跳合拍。 |
| 14 | 14 | Embedding optional | fully-invisible | 2 | 默认关闭时低风险；开启后若无提示，作者不知搜索质量为何变化。 |

## 诊断小结
最高优先级不是再做更多数据浏览器，而是把“时间性事件”从各自 JSON、SQLite、tab、count 中抽出来，成为同一条世界脉搏。最伤害统一感的是：角色反思/计划、6-stage 生成、CanonGate、扶正、confirm-final 级联、memory write。这些都是“世界刚刚做了决定”的事件，却没有被叙述给作者。
