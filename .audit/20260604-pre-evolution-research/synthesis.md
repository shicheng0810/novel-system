# 世界预演化(先模拟后叙述)研究综合
*2026-06-04 · deep-research(103 agents / 5 角度 / 25 源 / 验证 20+ / 驳回 7)*

## 一句话结论
**应该插入一段"静默世界预演化"(起跑前先跑 N tick、不出章),证据方向明确支持——但最强、最一致的结论其实是一条警示:模拟≠故事,预演化产出的是"编年史",必须靠 story-sifting 挑起笔点(本系统的 sim-fitness 正是这一步)。**

## 验证通过的关键 finding

1. **StoryBox(AAAI-26)直接对照实验**[arxiv 2510.11618, 3-0]:故事长度固定下,**先模拟越久→人物塑造(Character Development)与冲突质量(Conflict Quality)越好**;Overall 从 1 天→7 天显著提升、之后**收益递减**,过长模拟"压垮模型综合信息的能力";作者荐 **7 天(≈168 tick 量级)**为默认甜点。架构是 strictly non-interleaved——全部模拟先于叙述。
2. **Smallville 预热效应可量化**[arxiv 2304.03442, 3-0]:25 agent 自由跑 2 天,社交网络密度 **0.167→0.74(≈4×)**、消息知晓率 **4%→52%**——**跑世界本身就累积关系与派系雏形,无需作者编写**。
3. **🚨 硬约束(James Ryan 博士论文《Curating Simulated Storyworlds》, 3 处 3-0,全研究最确定)**:模拟一个世界**本身不产生故事**——原始 trace"几乎总是缺乏故事结构",是"包含许多故事的堆积";单一模拟日志打印出来是"编年史(无头无尾无中段结构)"。**所以预演化后必须有 curation/story-sifting 挑起笔时刻,不能照着模拟日志开写。**
4. **Shepherd(AIIDE 2024)增量 sifting**[3-0]:边生成边筛比事后筛更能给故事结构(牺牲随机性换连贯)——与"静默预演化后再叙述"有张力。本系统的戏剧导演已是这一路。
5. **反例 Caves of Qud**[high]:刻意不做完整历史模拟,"先生成离散事件再事后合理化"也能造丰富历史——深度预演化非唯一路径,但仍是 generate-then-select。

## 对本系统的具体建议(综合)
在「待机→定义→**[静默预演化]**→起跑」之间插入预演化相位:
- **静默跑 N≈100-200 tick(注:见下方警示,网文尺度宜更保守)+ 进化 K≈1-3 轮,不落章**,让关系/派系/首死/恩怨/分裂自然成形。
- **用现有 sim-fitness(story-sifting)在预热轨迹上挑一个高张力时刻**(第一桩死亡/恩怨成形/派系分裂之后,或 sim-fitness 局部峰值 tick)作为**第一章起笔点**——in-medias-res 入场,而非创世 tick-1 开写。
- 起笔后用 **T3 lore 库 / canon 渐进交代前情**,避免一次性倾倒。

## 诚实的证据边界 / 警示
- 核心量化结论(预热提质、7 天甜点、过长过载)**仅来自 StoryBox 一篇**(单一自评基准、LLM-as-judge、无复现、**故事仅 12k 字** ≪ 中文网文 10 万字+,规模外推有差距);168 tick 是按"每小时一步"的推断。
- Smallville 的"关系"度量是**互相知晓(图连通性)**,不是好感/恩怨/世仇——真正的情感账要靠本系统已有的 **continuous-minds(stress/bond 八字四轴)**单独承担。
- **最确定的是负向警示**(模拟≠故事、必须 sifting),比"预热提质"更硬。
- ⚠️ **过载风险**:本系统每章=3 tick,168 tick≈**56 章的世界历史**——直接照搬恐让读者/模型过载(正是 StoryBox 警告的过长)。**网文尺度宜先保守:N≈30-60 tick(≈10-20 章历史)、K≈1-2 轮**,再实验调。
- 没有任何来源给出"最佳起笔=第 X 桩死亡后"的可照搬阈值——**需自做 A/B**。

## 系统侧事实(本地代码核对)
当前 `app/longrun.ts` tick 0 `seedWorld` 后**立即进章节循环**(每章 3 tick + 即时 compose),即**第 1 章就是创世 tick-1 边跑边写、无任何静默预演化相位**——正是要改的现状。但所需齿轮全在:sim-fitness(story-sifting)、MAP-Elites 进化、continuous-minds、戏剧导演、结构生长。改动 = **新增一个"起跑前静默跑 N tick + 用 sim-fitness 选起笔 tick、不落章"的前置阶段,把第一章 compose 锚到选中的成熟快照**。

## 待验(openQuestions)
①起笔点用 sim-fitness 怎么定(局部峰值 vs 首死后 1-2 tick)。②N/K 在网文尺度的真甜点(168 不可照搬)。③"过载"压垮的是模型(素材太多)还是读者(前情太多)——临界点与缓解不同。④已有"边跑边写+导演"(类 Shepherd 增量 sifting)与新"静默预演化"(类 StoryBox)并存还是二选一。

## 源
StoryBox AAAI-26 arxiv 2510.11618 · Stanford Generative Agents arxiv 2304.03442 · James Ryan《Curating Simulated Storyworlds》escholarship 1340j5h2 · Shepherd AIIDE 2024 · Caves of Qud / Dwarf Fortress legends · AI Town。
