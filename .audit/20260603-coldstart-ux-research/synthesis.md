# 冷启动与世界定义 UX · 竞品研究综合
*2026-06-03 · deep-research(108 agents / 25 源 / 113 claims → 20 验证通过 / 5 驳回 / 12 综合)*

## 一句话结论
**竞品几乎一致把「世界定义」与「起跑」拆成两步、不直接跑默认世界** → 直接背书本系统「待机→定义→起跑」。但有一个关键设计差距:**世界摄入主流是「分槽位的结构化定义」+「关键词触发式 lore」,而非本系统当前的「一个自由文本大框」**。

## 验证通过的关键 finding(均锚定厂商官方文档)

1. **define ≠ run,拆两步**:AI Dungeon「Scenario=可复用模板，点 Play 才转入 Adventure」;Sudowrite「Story Bible=先建后用的人机共享真理源」。[help.aidungeon.com/faq/what-are-scenarios · docs.sudowrite.com]
2. **模板库/示例世界 + Quick Start 击败空白页**,自定义/空白只作嵌套次选。AI Dungeon 首启动是「Quick Start 选 setting/character/name 或从数百个社区 Scenario 点 Play」。
3. **世界摄入=分层槽位,非单一大框**:AI Dungeon 拆成 Prompt(开场) + Plot Essentials(主角+世界 lore,常驻短期记忆) + Author's Note(题材/风格) + AI Instructions + Story Cards(条件触发长期记忆)。
4. **NovelAI Lorebook**:世界拆成离散条目,默认按**关键词/regex 触发**才注入(`/`=regex,`&`=多键 AND),`Always On` 开关让某条无条件常驻 → 按需增量交付,非全量前置。
5. **AI Dungeon Story Cards**:可选、用户写的角色/地点/概念笔记,仅当关键词 Triggers 出现在输入/输出才注入,按新近度/频率只装**约 25% token** 的匹配卡。→ 修仙「关键词召回设定库」直接范本。
6. **AI Dungeon `${...}` 向导式填空**:开局前向用户提问、多处复用同一答案,`${character.name}` 内置字段 → 不离开模板就个性化。
7. **Sudowrite Story Bible** = 8 命名区(Braindump/Genre/Style/Synopsis/Characters/Worldbuilding/Outline/Scenes&Draft),每区可手填或点 Generate;**从最小种子 Braindump 渐进长出**。
8. **Sudowrite Story Engine** = 严格自顶向下 outline→draft(Outline 直接驱动 Scene、Scene 驱动 prose,受 Genre/Synopsis/Characters/Worldbuilding 约束)→ **「严格跟纲(照写)」的工业范本**。
9. **「严格跟纲 vs 涌现」= 一条「服从 vs 创造」连续轴**(Sudowrite Basic 高服从/Excellent 贴纲又能扩写/Muse 优先创造)。**关键:Sudowrite 没有显式 toggle(靠换模型),本系统已有的显式双模式开关反而领先。**
10. **World Anvil**:25+ 模板 + 内嵌 Smart questions,按实体类型分(地点/科技/人物/神系/文化/魔法/怪物)→ 定位为「反空白页脚手架」。
11. **CHI 2025(n=20 实证)**:引导双面权衡(太多→挫败/无聊,太少→不堪重负),**单一固定档位次优,应让用户自选/自适应引导强度** → 背书双模式 + 用户可控。

## 对本系统的具体设计建议(综合,每条锚定上面的 high-confidence 源)
- **(a) 开局待机 + Quick Start 模板库** + 几个示例修仙世界(宗门争锋/重生九零/赛博东京…),保留嵌套的「空白/自定义/贴大纲」入口。
- **(b) 把「世界设定」拆成分层槽位**:① **常驻底座**(世界观一句话 / 修真体系规则 / 主角设定,类 Plot Essentials + Always-On) ② **触发式 lore**(关键词召回的 门派/功法/灵根/地点 设定库,类 Story Cards/Lorebook)。**取代当前单一大框**。
- **(c) 向导式填空**:用占位提问(`${灵根}` 式)降冷启动门槛,反空白页。
- **(d) 双模式做成「服从度旋钮」**:松散底座=Muse 端涌现 / 严格跟纲=Basic 端照写 / **默认取中=Excellent 端**;可逐章或逐角色切换、用户自选。

## 诚实的证据空白 / 待验
- **「常驻世界模拟器、章节是副产品」无直接竞品对标**——AI Dungeon/Sudowrite 都是「章节即主产物」;Hidden Door/Inworld/Showrunner/Fable AI(模拟优先)本轮无幸存 claim,**其冷启动如何做世界定义=证据空白**。
- **中文 lore 召回**:NovelAI/AI Dungeon 是英文关键词/regex 匹配;中文(无空格分词、修仙术语别名多)**关键词够不够、要不要 embedding 语义召回**——未验证。
- **留存哪种最好**(模板库 vs 向导填空 vs Braindump 种子 vs 空白):无品类对照留存数据,只能依 CHI「用户想自选引导强度」间接推断,**需自做 A/B**。
- **服从度旋钮粒度**(全局/逐章/逐角色)最优未定。

## 被驳回(未纳入)
- Sudowrite「Start Chapter 把草稿绑定章纲」:文档未述服从严格度(0-3 驳)。
- 「新手主要靠玩中学、应快速上手少前置 setup」(1-2,与模板库前置定义张力,证据不足)。
- Campfire「18 模块结构化 schema」(1-2,证据不足)。
- 「Sudowrite strict/free 是显式 toggle」(0-3,实为换模型)。

## 源(primary 为主)
AI Dungeon 官方 FAQ(scenarios/story-cards/context/plot-components/getting-started) · NovelAI docs(lorebook) · Sudowrite docs(story-bible/outline/which-model/worldbuilding) · World Anvil(worldbuilding-templates) · CHI 2025 dl.acm.org/10.1145/3706598.3713576 · Hidden Door FAQ · Fable Showrunner。
