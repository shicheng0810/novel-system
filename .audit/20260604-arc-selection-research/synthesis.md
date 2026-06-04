# 起笔点/弧线选择算法研究综合(C 方案)
*2026-06-04 · deep-research(100 agents / 23 claims·21 个 3-0 / 全 primary 同行评审源)*

## 一句话结论
研究给了**完整可落地的两阶段算法**:**(A) 检测+排序最佳弧线** = story-sifting 模式匹配(结构层,二值) + 评分启发式(本系统 sim-fitness 正是这层,再加 StU 罕见度 + Reagan 情感弧先验);**(B) 定起笔 tick** = 取弧线的 **inciting incident(触发事件)**、用 Labov 反向因果链定边界——**关键陷阱:不能取 sim-fitness 局部峰值起笔(那是高潮、会跳过铺垫、矛盾没来由),峰值是开篇要"建向"的目标。**

## 验证通过的关键 finding(全 primary)

1. **story-sifting 是 part-(a) 的正式定义**[Felt ICIDS19 / Ryan 博论, 3-0]:从大事件流里"选出构成好故事的事件"。Ryan 五段管线:chronicler→chronicle→**story-sifter(核心)**→narrativizer→media。
2. **弧线检测=手写 sifting patterns**[Felt/Winnow, 3-0]:逻辑程序匹配**有序事件子序列**(中间可插无关事件)+ 共享角色绑定(?host/?guest/protagonist)+ 时序/因果约束(ancestor)+ unless-event 排除。Felt 的"违反待客之道"、Winnow 的 arsonRevenge(harm→hatch-revenge→set-fire)就是复仇/背叛闭环。**本系统 sim-fitness 的故事链(复仇闭环/崛起陨落…)正是这些模式。**
3. **🚨架构约束**[3-0]:匹配器(Felt/Winnow)**纯结构、二值(match/no-match)、无任何评分**(无罕见度/因果完整/卷入/情感弧度量)。**排序必须由上层启发式承担——本系统 sim-fitness 正是这个缺失的评分层,要架在匹配器之上。**
4. **StU 罕见度公式(可直接编码)**[Kreminski StU ICIDS, 3-0]:`propertyLikelihood = 该属性出现次数 / 同模式匹配总数`;`match.likelihood = Average(各属性 likelihood)`;**likelihood 越低=越意外=越可讲(tellable)。** 取最低分的若干 match。
5. **起笔点/因果边界算法**[Ryan-Labov, 3-0]:Labov"叙事预构建"——从**最可报事件(most reportable)**出发,**反向**沿因果链回溯到一个**不可报终点(unreportable terminus)**。→ **不可报终点=起笔下界(最晚安全起点、保证承重的前因都在页上);inciting incident=起笔上界(读者一翻开就在矛盾里)。**
6. **Reagan 六情感弧 + 参与度先验**[EPJ Data Science 2016, 3-0]:六形(rise/fall/fall-rise/rise-fall/rise-fall-rise/fall-rise-fall);**含"跌"的复杂弧(Icarus 升-跌 / Oedipus 跌-升-跌 / Man-in-a-hole 跌-升)读者参与度显著更高**→ 给候选弧线加权时**偏向有跌宕的弧、压低单调"升到底/一路爽"**。滑窗情感 → 转成本系统的逐 tick valence 曲线建弧。
7. **DODM 戏剧管理评分模板**[Nelson/Mateas IEEE-CGA06, 3-0]:把故事建模为情节点序列,作者给评分函数评一个序列的质量——可作本系统弧线适应度函数的范式。
8. **高潮检测**[Freytag/Ye, 3-0]:climax = **张力/情感"变化"曲线的局部峰值**。

## 落到本系统的算法草案
预演化(scout N tick)后,事件全在 DB:
1. **检测弧线**:复用 sim-fitness 已有的故事链检测(复仇闭环/崛起陨落/逆袭登顶/覆灭复兴/巨变连锁)——这就是 sifting patterns 的匹配结果。
2. **排序弧线**:`弧线得分 = sim-fitness 结构分 × (1 + StU罕见度权) × Reagan形状先验`。StU 罕见度按"该弧用到的事件类型/角色属性在全轨迹里多不常见"算(越罕见越高);Reagan 先验给"有跌宕"的弧加权、给单调上升的压权。取最高分弧线。
3. **定起笔 tick**:在选中弧线上,
   - 找 **inciting incident** = 恩怨/冲突契机刚成形后的第一个 kernel 事件(起笔**上界**);
   - 用 Labov 反向因果链找承重前因的最早点 = **unreportable terminus**(起笔**下界**);
   - **起笔 tick 取 [terminus, inciting incident] 之间靠近 inciting incident 的点**——读者一开篇就在矛盾里、但承重前因不漏页;
   - **高潮(sim-fitness/张力峰值)留作开篇要建向的目标,绝不在它上起笔。**
4. **从起笔 tick 叙述**:rewind 到该 tick 的世界态(checkpoint 恢复),叙述向前(re-live 这条弧)→ 追到 scout 末尾后世界继续涌现。

## 诚实警示 / 待验
- **最大陷阱(caveats 点名)**:别拿 sim-fitness 局部峰值当起笔点(那是高潮、跳过铺垫)。起笔在"上升段之前、inciting incident 处",峰值是目标。
- 三层评分(sim-fitness 结构 / StU 罕见度 / Reagan 形状)**怎么加权归一成单一排名,文献没给权重,需自调/A-B**。
- 逐 tick"张力/valence"怎么从离散事件流(还没 prose)映射出来,窗口多大,需定。
- StU 已知失效模式:罕见动作+罕见属性共现会被算成"可能"(双重折扣),需校正。
- 多条高分弧线时间上重叠(共享角色)时怎么选一条+一个主角视角,待定。

## 源
Felt(Kreminski ICIDS19) · Winnow(AIIDE21) · StU"Select the Unexpected"(Kreminski ICIDS) · Ryan《Curating Simulated Storyworlds》(UCSC18, Labov) · Reagan 六情感弧(EPJ DS 2016 / arxiv 1606.07772) · Nelson DODM(IEEE-CGA 2006) · Ye Freytag-climax(BMVC)。
