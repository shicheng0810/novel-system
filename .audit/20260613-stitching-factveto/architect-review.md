# 架构评审 · stitching-factveto spec(v1)
> 2026-06-13 · architect-review subagent 对抗性评审 · 裁定: **block 现状·refactor first**(2.5/5)
> 方向对(诊断=四段盲写各编一版·已铁证·Lever A 有价值)·但 Lever B 核心赌注被本仓库已有实验否决且 spec 漏引。

## 总评: 可建但不能按 v1 建。三大硬伤
1. **Lever B(后验prompt重生)赌注不自洽**: "软指令失聪→换强注入锁定值就被遵守"无机制支撑·只换措辞强度。**反证: FACT_LEDGER=3 已是强化版"数值/归属/规则不得写冲突值"指令·`opener-prevalence.md` §56 实测"连 v3 都没拦住 5↔3文"**。spec 漏引同目录这条否决。
2. **预定事实表(源头预定)=OFS·已否决靶错层**: 微事实是 in-medias-res 段1现编的涌现值(船资5文/铜钱新的/来历北边)·配置层预定不出 → 对70%天然失灵(`opener-prevalence.md` §56)。
3. **A/B base 测不出**: 前两批 OFS A/B fresh冷启 ch1-8 主靶 factC=0/5、0/13(`opener-prevalence.md` §44 "base太干净")。v1 §4 同款冷启 → 大概率又 inconclusive·采纳门 factC≤B×0.6 永触发不了。**比所有架构问题更前置的可行性疑点。**

## 逐条
1. **机制选型**: inject-forward(段1抽→锁死喂段2-4)远稳远省·后验重生 3×段成本。源头预定靶错层(涌现值预定不出)。spec 主次定反。
2. **重生有效吗**: 不成立。同 prompt 通道同失聪模型·凶措辞无遵从率证据·FACT_LEDGER=3 反证。唯一有牙齿=确定性文本替换(但风险: 误伤"另一笔"数值+留接缝·把赌注全压检测精度)。
3. **检测精度(make-or-break)**: lint-seams **D20 实证"本类无法零误杀·需指代消解=LLM·非gate"**(6593章校准·收紧后仍0.94%/章)。性别(闭集+代词)可检·占10%; 数值(同义词"船资≠过河钱"漏检 / "另付三文"误检)勉强需强结构; 专名/物件按D20不现实。spec"好章0误检"门对专名/数值过乐观。
4. **耦合**: ①重生别塞 line 388 mock-retry(基础设施层·15s退避)·与content-veto(质量层)语义污染→两层独立循环。②检测须在 line 397 `text+=` 之前(否则矛盾段先污染 covered/账)·入账在确认不矛盾之后(spec 把A入账B检测都写"line398后"·B时机错)。③复用 lint-seams 已导出 D5/D11/D18/D20·别平行新建 fact-veto 正则→防两套事实真相新债。
5. **env债**: 第4个 gate 叠 GENTLE·与 FACT_LEDGER/OPENER_FACTS 高度重叠靶(都防"同事实冲突值")·组合爆炸(4×2×2)不可归因(OFS+v3一起开→§56"两个都没拦住"无法归因)。收敛为 `NOVEL_CONSISTENCY=off|ledger|veto` 枚举·退役 FACT_LEDGER v1(已否决)/OPENER_FACTS(靶错层)·别没清前债叠第4个。

## 最该改3件
1. Lever B → inject-forward 为主 + 性别类确定性替换执法 + 数值/专名注入后仍矛盾才重生(封顶1次)。
2. 检测分级按精度分执法通道: 性别→可替换/重生; 数值→强结构才gate其余flag; 专名/物件→只flag/人工分诊(D20)。
3. 解耦 retry(内mock外veto)·检测移 text+=前·复用 lint-seams 不平行新建。

## 推荐最终架构
```
段循环(GENTLE·单env NOVEL_CONSISTENCY=veto):
  for i in beats:
    内层 mock-retry(现状·只管产≥120字合格文本): sec = complete(secPrompt + lockBlock(account))  ←A注入
    hits = detectContradiction(account, extractAssertions(clean))   ←复用lint-seams·在text+=前
    分级执法: 性别→确定性替换(零额外调用) | 数值强结构→外层veto-retry重生1次 | 弱结构→flag交edit-pass
    无hit(或已修)→ text+=clean; 断言入账  ←入账在确认后
```
**还必须**: A/B 改 fork 历史含矛盾态(中段·pro factC=5/20 表达处)·非 fresh 冷启(测不出)。

## 底线: block v1·refactor first(方向对·Lever A 留·B 降级·解决 base 表达性再建)
