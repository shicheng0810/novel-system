# patterns.md — 映射到 prose-canvas-first shell 的 UI / data-flow patterns

## Rank 1. 心跳脉络
- What it surfaces: subsystems 1,7,11,12,13
- Where it lives: StatusBar + WritingCanvas 顶部极轻 ambient line
- ASCII sketch:
```
[世界脉搏] 回忆中 → 立骨中 → 成文中 → 自审中 → 入史中   局: 阳遁三局·风动
```
- Why it works: 单一心跳，不是多块仪表盘；把黑箱阶段翻译成叙事动词。 precedents: S04/S27/S05
- Tradeoffs / failure modes: 若过度频闪会烦；必须 300-800ms debounce，长任务只在阶段切换时动。
- Implementation cost: S
- Prose-canvas-first compatibility check: 强兼容：常驻但低高度，不改变画布主体。
- Impact-per-effort rank: 1

## Rank 2. 世界回响
- What it surfaces: subsystems 2,3,4,5,6,8,10,13
- Where it lives: WritingCanvas 右缘或 CodexRail Now 顶部的可折叠事件 feed
- ASCII sketch:
```
┌ 世界回响
│ 04:12 玄霜想通了“避其锋芒”
│ 04:13 CanonGate 拦下血脉矛盾
│ 04:14 3 条记忆入册，图谱更新 2 节点
└ 只显示本章相关；点开进 Runtime trace
```
- Why it works: 事件有时间轴，状态才有意义；世界变化需要回响和落印。 precedents: S13/S17/S25
- Tradeoffs / failure modes: feed 噪声最大；需要 ambient/notable/decision-required 分层和每章摘要。
- Implementation cost: M
- Prose-canvas-first compatibility check: 中高兼容：默认 3 行，可收起；不压正文宽度。
- Impact-per-effort rank: 2

## Rank 3. 入史落印
- What it surfaces: subsystems 3,4,8,10,13
- Where it lives: Confirm-final 后的短 cascade receipt，落在 ChapterCard 下方/Toast + 可回看
- ASCII sketch:
```
终稿已入史 ✓
- 正史分支：cautious#12
- 记忆：+7（伏笔 2 / 称谓 3 / 修订 2）
- 图谱：宗门关系 +1
- Canon：通过，风险 低
```
- Why it works: 世界变化需要回响和落印；复杂级联需 compile feedback。 precedents: S21/S15/S20
- Tradeoffs / failure modes: 如果每次确认都弹大卡片会打断连续写作；应 5 秒收起并入事件流。
- Implementation cost: S
- Prose-canvas-first compatibility check: 高兼容：只在确认后出现，提供信任闭环。
- Impact-per-effort rank: 3

## Rank 4. 六阶段灯轨
- What it surfaces: subsystems 7,3,8,13
- Where it lives: 写续段按钮附近 inline progress + BottomPanel detail
- ASCII sketch:
```
写续段：取材 ▰ 立骨 ▰ 铺场 ▱ 成文 ▱ 自审 ▱ 入史 ▱
当前：读取 18 条记忆，筛掉 4 条低相关
```
- Why it works: 把黑箱阶段翻译成叙事动词；主画布永远是太阳。 precedents: S01/S04/S28
- Tradeoffs / failure modes: 阶段估时不准会反噬；不要显示百分比，只显示当前阶段和最后动作。
- Implementation cost: S
- Prose-canvas-first compatibility check: 极高兼容：只在作者已触发生成时出现。
- Impact-per-effort rank: 4

## Rank 5. 角色低语
- What it surfaces: subsystems 5,6
- Where it lives: CodexRail Now / scene strip hover / selected character chip
- ASCII sketch:
```
玄霜 · 反思：师门之命与私怨冲突
下一步：试探陆沉是否知晓禁术
可信度：CRITIC grounded
```
- Why it works: 内在状态也应有进度与完成回响；多代理要露出谁在行动。 precedents: S03/S09
- Tradeoffs / failure modes: 可能剧透或限制作者想象；应只显示当前场景角色，且可隐藏。
- Implementation cost: M
- Prose-canvas-first compatibility check: 中兼容：放在 Rail/hover，不直接写进正文。
- Impact-per-effort rank: 5

## Rank 6. 天机转场
- What it surfaces: subsystems 12,1,9
- Where it lives: CodexRail Now + Canvas ambient transition
- ASCII sketch:
```
局势：休门 → 生门（气机转暖）
影响：cautious 分支权重 +0.12，rupture 风险 -0.07
```
- Why it works: 周期性与预告形成节奏；状态变化要时间轴化。 precedents: S08/S15
- Tradeoffs / failure modes: 玄学解释若太机械会破坏美感；应以诗性短句 + 可展开数值。
- Implementation cost: S
- Prose-canvas-first compatibility check: 高兼容：只在 qimen pattern 变化时轻提示。
- Impact-per-effort rank: 6

## Rank 7. 正史分岔图
- What it surfaces: subsystems 2,8,9,10
- Where it lives: WritingCanvas 历史线增强 + BottomPanel 推演 timeline
- ASCII sketch:
```
历史线：seed ─ cautious* ─ 扶正✓ ─ chapter draft
              └ rupture ✕ CanonGate: 血脉冲突
```
- Why it works: 事件有时间轴；可回放比可查看更接近生命感。 precedents: S10/S16/S18
- Tradeoffs / failure modes: 图太复杂会变成工程 DAG；MVP 只显示当前章 3-5 个节点。
- Implementation cost: M
- Prose-canvas-first compatibility check: 中兼容：在既有 历史线 switcher 上增强，不新增主面板。
- Impact-per-effort rank: 7

## Rank 8. 源包透镜
- What it surfaces: subsystems 3,4,7,13 (corrected from typo; system only has 14 subsystems)
- Where it lives: LensDrawer / CodexRail Now 显示当前段落 sourcePack
- ASCII sketch:
```
本段取材：
- 记忆：玄霜怕冷铁（S: memory#183）
- 图谱：青岚宗/执法堂
- Canon：禁术不可公开施展
```
- Why it works: 局部雷达优于全量大图；AI 状态绑定当前对象。 precedents: S19/S20/S30
- Tradeoffs / failure modes: 引用太多会降低写作速度；默认 top 5，展开查看全部。
- Implementation cost: M
- Prose-canvas-first compatibility check: 高兼容：只在 LensDrawer/选段时出现。
- Impact-per-effort rank: 8

