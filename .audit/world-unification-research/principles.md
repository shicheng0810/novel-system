# principles.md — 统一系统节奏的设计原则

## 1. 单一心跳，不是多块仪表盘
- Plain-language statement: 所有后台动作先归入同一条“世界心跳”：正在回忆、正在推演、正在裁决、正在落印。细节可以钻取，但默认只感到一个生命体在呼吸。
- Supporting precedents: S04, S15, S27
- Counter-example / failure mode: 如果心跳只剩一个 spinner，就会重演 pendingAction 的问题：统一了，却不解释。
- Applicability score to 14-subsystem scatter: 14/14

## 2. 事件有时间轴，状态才有意义
- Plain-language statement: memory count、atlas tree、qimen pattern 这些静态状态必须被标记到“刚刚发生”的时间线上，作者才会理解变化来源。
- Supporting precedents: S15, S17, S23
- Counter-example / failure mode: 流水账过多会稀释重点，必须支持严重度与折叠。
- Applicability score to 14-subsystem scatter: 13/14

## 3. 严重度分层：环境、显著、需决策
- Plain-language statement: 不是所有世界事件都应该打断写作。ambient 用微光/短句，notable 入 feed，decision-required 才弹出或暂停。
- Supporting precedents: S10, S14, S29
- Counter-example / failure mode: 分级错误会导致重要 CanonGate 被忽略或琐事轰炸作者。
- Applicability score to 14-subsystem scatter: 14/14

## 4. 主画布永远是太阳，观测面板只是轨道
- Plain-language statement: prose-canvas-first 不意味着看不见系统，而是所有系统提示都围绕当前段落/章节服务，详情退到 Rail/BottomPanel。
- Supporting precedents: S24, S30, S28
- Counter-example / failure mode: 侧栏若抢戏，会把写作重新撕裂成工具操作。
- Applicability score to 14-subsystem scatter: 12/14

## 5. 把黑箱阶段翻译成叙事动词
- Plain-language statement: 不要展示 pipeline jargon；展示“取材/立骨/铺场/成文/自审/入史”。动词让等待有方向。
- Supporting precedents: S01, S04, S05
- Counter-example / failure mode: 过度拟人化可能遮蔽真实错误，需要 hover/detail 保留工程 trace。
- Applicability score to 14-subsystem scatter: 14/14

## 6. 世界变化需要回响和落印
- Plain-language statement: 确认终稿、扶正分支、记忆写入、图谱编译都应有小型仪式：哪条可能性成正史，哪些记忆入册，哪些地图更新。
- Supporting precedents: S13, S21, S25
- Counter-example / failure mode: 仪式过重会拖慢高频写作，必须可批量合并。
- Applicability score to 14-subsystem scatter: 12/14

## 7. 局部雷达优于全量大图
- Plain-language statement: 作者需要知道“与当前章相关的三件事”，不是全宇宙所有 JSON。相关性过滤是统一感的基础。
- Supporting precedents: S07, S19, S20
- Counter-example / failure mode: 过滤依据不透明会引发“是不是漏了”的焦虑。
- Applicability score to 14-subsystem scatter: 11/14

## 8. 可回放比可查看更接近生命感
- Plain-language statement: 系统不只要能查状态，还要能重放本章世界如何从推演到成文到入史。
- Supporting precedents: S16, S17, S25
- Counter-example / failure mode: 完整回放成本高；MVP 可以只存摘要 breadcrumb。
- Applicability score to 14-subsystem scatter: 10/14

