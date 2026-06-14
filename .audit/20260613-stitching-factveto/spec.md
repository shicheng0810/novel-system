# 段间微事实断言账 + 矛盾硬否决 · 治本 spec
> 2026-06-13 · 开线动机: flash 降本实验照出"中段 factC 是系统分段盲写 bug·pro 也犯(5/20)·非选模型能解"(`.audit/20260612-consistency-research/R-results.md` §8-9)。这是 P2 标记的"真根因·下一研究项"、stitching-coherence 线(`.audit/20260609-stitching/`)的生成端治本延伸。
> 同纪律: measure-first(已测·见 §1)· spec→build→四道闸→A/B→人签 · 喂数据非散文(避 induction)· GENTLE-gated 默认关 · 不碰活世界。

## 0. 一句话与赌注
开篇/中段 factualContradiction 的根 = `writeChapter` 把一章拆 4 段盲写, **每段独立编造同一微事实的不同值**(船资 5↔3 文、师太 静檀↔静安、林思齐 他↔她、巷口↔桥头、桂花糕 爹做↔娘给)。现役防线 FACT_LEDGER v3 = **软指令"勿写冲突值"(失聪) + 模糊 light-LLM 抽取(漏)**,实测拦不住。赌注: 用**确定性断言账 + 段后矛盾检测 + 硬重生**给它装牙齿 → factC 腰斩,且 pro/flash 都受益(治完才有资格复测 flash 解锁 /12 降本)。

## 1. 根因诊断(机制级·已读码 longrun.ts:345-424)
**4 段盲写的段间通道**(段 i 能看见段 0..i-1 的):① 尾窗 `prev.slice(-480)`(只末 480 字)② 节拍全景(≤20 字 plot 概要·非内容)③ covered 段指纹(首 32+尾 24 字)④ metNames/seenPlaces 集 ⑤ statedLines(FACT_LEDGER)。**段 i 对段 i-2 的正文可见度≈0** → 各段自由发挥微事实。

**FACT_V2/V3 为何拦不住(三弱点)**:
1. **软指令失聪**: 注入"数值/归属/规则后文不得写成冲突的值"是 prompt 劝告·DeepSeek 无视(同 FULLCTX"指令防御实证失聪")。
2. **抽取漏**: light-LLM prompt 明令"不抽动作过程/对话内容"→ 漏掉对话里的船资; "最多6条/≤10字"→ 多了掉; 模糊判断不稳。
3. **零执法**: 即便"船资:5文"在账·也没有检测段2写"3文"、更无重生 → 纯劝告。

**判官实证的 factC 类型分布**(R 实验 36 命中 + P2): 数值(船资/凝皮/绳长/时辰)≈35%·专名(师太名/角色名)≈25%·性别(他↔她)≈10%·地点(巷口↔桥头)≈15%·关系/来源(姐夫↔同窗/爹↔娘)≈15%。**前三类(数值/专名/性别·占 70%)确定性可检** → Phase 1 主靶。

## 2. 设计: 双 lever(捕获升级 + 硬否决)
### Lever A — 确定性断言账(替/补 v2 模糊抽取)
段后零-LLM 抽**结构化断言** `entity → value`,入**章内断言账**(不滑窗丢硬事实·按 entity dedup):
- **数值断言**: 正则抽「名词+数值+量词」对(船资/钱/文/两、X尺Y寸、X片/条/枚、时辰)。键=邻近名词内核·值=数量。
- **专名断言**: 角色/称谓(师太/掌柜/大夫…)→ 绑定的专名。键=称谓·值=名字; 同称谓出现第二个名=矛盾候选。
- **性别断言**: 每个已知名 → 首次出现的 他/她。键=名·值=代词; 后段同名换代词=矛盾。
- **地点在场**(Phase 1.5): 名 → 当前所在地(承 metNames/seenPlaces); 无移动交代的瞬移=矛盾(已有 transitionGap 雏形)。
- 语义类(关系/来源)留给升级版 light-LLM 抽取(Phase 2)·或暂软注入。

### Lever B — 段后矛盾硬否决(真牙齿·复用 line 388 重试环)
段 i 写完 → 抽其断言 → 与账**确定性比对**:
- **命中硬矛盾**(数值/专名/性别·高精度): **拒该段·重生**,重生 prompt 顶部钉死锁定值(`【锁定·本段若写到下列必须用此值·违即废重写】师太=静檀·船资=5文·林思齐=男`)。
- 重生**封顶 2 次**(同 mock 重试纪律)·仍矛盾则**接受+日志flag**(交 edit-pass·不死循环)。
- 高精度是命: 误检→无谓重生(烧 token+可能改坏好文)→ 检测器须**宁漏勿误**(同判官标准·好章 0 误检为验收门)。

**为何这比 v3 强**: v3=模糊抽取+软劝告(0 牙齿); 本案=确定性抽取(稳)+段后检测(看得见)+硬重生(改得动)。把"指令失聪"换成"检测-否决"闭环(同 <120 字 mock 重试已验证有效的范式)。

## 3. 实现(四道闸·GENTLE-gated 默认关)
- env 开关 `NOVEL_FACT_VETO=1`(默认关·关时逐字节同现状=golden 绿)。与 FACT_LEDGER 正交(账复述轴)或合并为 FACT_LEDGER=4(待定·建议独立 env 先 A/B)。
- 新文件 `app/fact-veto.ts`: `extractAssertions(text, knownNames): Assertion[]` + `detectContradiction(prev: Ledger, cur: Assertion[]): Hit[]` + `lockBlock(hits): string`。纯函数·零随机·可 golden。
- `longrun.ts` writeChapter 段循环: 段写成功后(line 398 后)抽断言入账; 段 prompt 构建前查账→有锁注入 lockBlock; 段写完检测矛盾→命中则 attempt 循环重生(改 line 388 环·加 veto 触发的 retry)。
- 闸: esbuild 逐文件 + tsc + golden(默认关逐字节·开 veto 的新 fixture 验注入) + 产线 env canary(NOVEL_FACT_VETO=1 真写 1 章不崩+真触发重生)。

## 4. A/B(exp-runner·开篇最毒处压测)
fresh 冷启双臂(开篇 ch1-8·factC 17% 最高): 臂A=`NOVEL_FACT_VETO=1 FACT_LEDGER=2`·臂B=对照 `FACT_LEDGER=2`。**两臂都 pro**(治的是系统 bug 非模型)。≥2 复本(4 臂)。
- 主轴: 判官 factC(A vs B·目标腰斩)。副: stateRestate(顺带降?)·d1c(不炸)·章长(veto 重生勿催肥)·**重生率**(新遥测·veto 触发频率·太高=检测器误检或问题真严重)。
- 中段复测: fork gen3(同 R 实验)验中段 factC 也降。

## 5. 判据(人签)
- **采纳**: 判官 factC A ≤ B×0.6(显著降·腰斩)且 d1c/章长不炸且重生率合理(<30%)且好章 0 误检 → 转正(默认开?待定·先 GENTLE-gated)。
- **部分采纳**: 只某类(如数值)有效 → 留该类·关其余。
- **不采纳**: factC 没降或副作用大(误检催肥/重生失控)→ 留档·记真因。
- 采纳后 → **复测 flash**(R 线遗留): factC penalty 或缩进 ≤1.3× → 解锁混合档 12× 降本。

## 6. 边界 / 永久不做
- **不 FULLCTX**(喂逐字旧文→induction 复制→d1c 爆·永久否)。断言账喂**结构化数据**(entity→value)非散文。
- 检测器**高精度优先**(误检的代价=改坏好文+烧 token·比漏检毒)。语义类(关系/来源)难确定性检·Phase 2 才碰·别硬上正则误伤。
- 重生**有上限**(2 次·防死循环)·仍矛盾接受+flag(edit-pass 兜底)。
- 不碰爽文(GENTLE-gated)·不碰活世界(fresh/fork 舰队)。

## 7. 关联 / 谱系
P2 真根因(`novel-consistency-line` §P2)→ 本线治本。stitching-coherence(`.audit/20260609-stitching/`·检测端已建·本线补生成端否决)。FACT_LEDGER v2(复述轴·已采纳·正交)。R 写手降本(`R-results.md`·本线治完才复测 flash)。

---

# v2 修订(据双评审·2026-06-13·`architect-review.md` + 用户 4 精度护栏)
> 两评审收敛: **先离线证精度·再接重生**。诊断(§1)与 Lever A(确定性断言账)保留; Lever B 从"后验 prompt 重生(全类)"改为**分级执法**(执法手段按类的可检精度选)。

## v2-§A 核心修订: 执法分级(替 v1 §2 Lever B 的"全类硬重生")
| factC 类 | 占比 | 执法手段 | 为何 |
|---|---|---|---|
| **性别** 他↔她 | 10% | **确定性文本替换**(闭集·单字·零额外调用) | 评审: 闭集高精度可替换; 护栏c: 就近同位高置信绑定才动 |
| **数值** | 35% | **重生1次**·靶收窄到"同场景刚报过的固定量·几句内被写成另一值" | 护栏a(头号误检源): **排除可消耗计数(凝皮7→5合法)/时辰推进/跨笔交易价钱**; 评审: 强结构才gate |
| **称谓/专名** | 25% | 就近同位高置信→重生1次; 模糊→**只flag** | 护栏c + 评审 D20"零误杀做不到·需指代消解=LLM·非gate" |
| **地点/在场** | 15% | **不进等值否决** | 护栏b: 地点最易变·"在两处"多半是移动; 真bug=transitionGap(另一规则·别混硬重生) |
| 关系/来源(语义) | 15% | Phase 2(暂软注入或不碰) | 确定性检不了·别硬上误伤 |

## v2-§B 实现纪律(据评审 §4)
- **解耦 retry 两层**: 内层=现状 line 388 mock-retry(只管产 ≥120 字合格文本·15s 退避·**不碰**); 外层=veto-retry(拿合格文本→抽断言→检测→不过带 lockBlock 重跑内层·封顶**1**次·仍矛盾接受+flag)。
- **检测在 `text+=`(line 397)之前·入账在确认不矛盾之后**(否则矛盾段先污染 covered/账)。
- **复用 lint-seams 导出函数**(D5/D11/D18/D20)·不平行新建正则→防两套事实真相。fact-veto.ts 只做"段内断言抽取 + 账比对 + 分级执法路由"·检测器调 lint-seams。
- **重生后再核一次**"真解决了没"(别只换个矛盾)·配**重生率遥测**(护栏小条 + 评审)。
- **env 独立于已上线 FACT_LEDGER=2**(护栏小条·别回归复述战果): 实验期 `NOVEL_FACT_VETO=1` 独立 gate 跑干净单变量 A/B; env 收敛(`NOVEL_CONSISTENCY` 枚举·退役 v1/OFS·评审 §5 债)留作 veto 证成后的偿债步·不与未证特性耦合。

## v2-§C 建设序(先离线证精度·护栏d)
**Phase 1a(本步·零生成 token)**: 建 `fact-veto.ts` 的 `extractAssertions`+`detectContradiction`(纯函数·性别/收紧数值/高置信称谓)→ 在**已有 72 章判官标注语料**(R 实验 4 臂: 开篇 32 + 中段 40·全有 judge ground-truth)上跑·算 **precision/recall vs judge**。门: **好章/judge判干净的章 0 误检**(同 D20/struct-prevalence 离线范式·零成本卡死精度)。
**Phase 1b(过门才接)**: 把分级执法(替换/重生)接进段循环 → 四道闸 → A/B(**fork gen3 中段**·factC 表达处·非 fresh 冷启[评审: 前两批冷启测不出])·臂A veto-on / 臂B 对照·两臂 pro·判官 factC 目标 ≤ B×0.6。
**判据**(v1 §5 不变): factC 腰斩且 d1c/章长不炸且重生率<30%且好章0误检 → 人签 → 复测 flash。

## v2-§D A/B 可行性前置(评审最前置疑点)
v1 §4 用 fresh 冷启 ch1-8·**前两批 OFS A/B 实测 base 不产 factC**(0/5、0/13·`opener-prevalence.md` §44)→ 改 **fork gen3 中段**(R 实验已证 pro 中段 factC=5/20 表达·有降的空间可测)。开篇 factC 虽 17% 但 fresh 冷启复现不稳·中段 fork 是可测靶。
