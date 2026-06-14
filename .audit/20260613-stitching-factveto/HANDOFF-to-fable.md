# HANDOFF → Fable: 段间事实矛盾(factC)治本·下一阶段方案设计
> 2026-06-13 · Opus 执行了 measure + Phase 1a · 用户请 Fable 据本档写方案 · Opus 再执行
> 全档: `.audit/20260613-stitching-factveto/`(spec.md v2 + architect-review.md + phase1a-results.md)· 母线 `.audit/20260612-consistency-research/`

## 0. 给 Fable 的一句话任务
**确定性 veto 已实测撞天花板(只能安全接住"称谓法名漂移"小片·factC 主体数值35%+语义30%=65% 确定性框架内治不了)。请设计"如何真正降下 factC 主体"的方案**(Phase 2),respecting 下面的铁律与已否决项。Opus 执行你的方案。**别重走已否决的路**(§3),别违喂数据非散文/induction 铁律。

## 1. 问题(factC = 系统分段盲写 bug)
`app/longrun.ts` writeChapter 把一章拆 **4 段"盲写"**(段 i 只见: 前文尾窗 480 字 + ≤20字节拍概要 + 56字段指纹 + 出场名集 + FACT_LEDGER数据条; **对 i-2 正文可见度≈0**)→ 各段独立编造**同一微事实的不同值**: 船资 5↔3文、师太 静檀↔静安、林思齐 他↔她、巷口↔桥头、桂花糕 爹做↔娘给、关系 姐夫↔同窗。判官(Opus subagent·≠写手 DeepSeek)称之"alternate takes stitched together"。
- **不是模型选择能解**: R 写手降本实验(`R-results.md`)实测 **pro 中段 factC=5/20·flash=8/20**——pro 自己也犯·flash 放大。
- **体量**(R 判官 + P2): 开篇 factC 17%·中段 25%(pro)/40%(flash)。类型分布: 数值~35% / 语义(关系·来源)~30% / 称谓~25% / 性别~10%(地点漂移归 transitionGap 另算)。
- **母线**: P0 判官建成(`app/consistency-judge.ts`·5类·已验证 4/4 known + 0/9 好章)· P1 FACT_LEDGER v2 治了**复述**(已采纳上线)· P2 标记 factC 为"真根因·下一研究项"(本线)。

## 2. 已证机理铁律(别回头试·研究+实测双证)
1. **FULLCTX 永久否**: 段间喂逐字旧文 → 触发 induction-head 复制电路 → d1c 套语爆炸(实测峰30·p=0.004)。
2. **喂数据非喂散文**: FACT_LEDGER v1 喂逐字台词指纹→复述+套语双增(否决); v2 喂「实体:属性」数据条→复述腰斩(采纳)。任何注入须是 entity→value 数据·不是原句。
3. **同模型自批改 rewrite 结构 = 注入新漏洞**(永久否)。章后若动须减法/高精度·judge 用 ≠写手模型(防自偏·研究警告同模型自判通过率虚高)。

## 3. 已试已否(本线 + 母线·别重走)
- **FACT_LEDGER v3**(=v2 + 软指令"数值/归属/规则后文不得写冲突值"): **太弱·实测没拦住 5↔3文**(`opener-prevalence.md` §56)。根因=软指令失聪(DeepSeek 无视 prompt 层事实约束)+ light-LLM 模糊抽取漏。
- **OFS 开篇事实底牌**(`app/opener-facts.ts`·配置硬事实 seed ch1): **靶错层·不采纳**——真矛盾是 in-medias-res 段1现编的**涌现**微事实(船资5文/铜钱新的/来历)·配置层预定不出(`opener-prevalence.md` §56)。
- **确定性后验 veto(本线 Phase 1a·`app/fact-veto.ts`)**: 段后零-LLM 正则抽断言→检测矛盾→(拟)硬重生。**离线 72 章判官语料实测**: 称谓法名漂移 0误检/72 命中真例(✅可用但小)· 性别 0误检但紧绑定 0-recall· **数值在护栏 a 安全约束下 0 产出**。
  - **核心发现**: 散文里真数值矛盾几乎总伴交易/变化语境(船资"付了五文…船资三文"·凝皮"摞七八片…又…九片")→ **安全约束(排可消耗/时辰/跨交易)一开·真例全被排; 放开约束→误检催肥改坏好文**。数值类确定性框架**无安全甜点**(同 lint-seams D20"容器漂移零误杀做不到·需指代消解=LLM·6593章校准0.94%/章")。
- **结论**: deterministic veto 是真但小的工具·**factC 主体(数值+语义 65%)确定性治不了**。

## 4. 桌上 3 选项(架构评审 + 实测的判断)
- **(a) 落地小而安全**: name-drift→确定性替换上线·性别松绑定试·数值/语义→只 flag 交章后 edit-pass(`reviseChapter`已有)。诚实·立即可交·但对 factC 主体影响小。
- **(b) Phase 2 = LLM 对数据账矛盾检查**: 段后 light-LLM 拿"本段断言"对"已立数据账(entity→value)"判矛盾(喂数据非散文)→ **唯一能碰数值/语义主体的路**·但重引 LLM 成本 + 需 ≠写手判官防自偏 + 须自证精度(judge警告同模型自判虚高)。架构评审与实测都指向: 主体非确定性能解。
- **(c) 重新想架构层**: 不在检测/veto 加码·回到"4 段盲写"本身。但注意: FULLCTX(喂全文)已否·同模型章后 rewrite 已否——架构改的安全空间窄。

## 5. 给 Fable 设计时的几颗种子(非规定·你判)
- **(b) 的关键设计问题**: ①数据账怎么抽全(段1的涌现微事实全抽成 entity→value·v2 只抽6条≤10字太少)? ②矛盾判官用什么模型(≠写手·light 还是 Opus subagent·成本/精度权衡)? ③判出矛盾后执法(重生 vs flag vs 确定性替换)? ④怎么证精度(离线对 72 章判官语料·0 误检门·像 Phase 1a)? ⑤induction 风险(LLM 读段+账·喂数据非散文怎么保证)?
- **inject-forward 变体**(评审推荐·未试): 段1写完→LLM抽全部微事实成数据账→锁死喂段2-4 当 **ground-truth**(不是软"勿矛盾"·是"这些就是已定事实·用它")。比 v3 强在"强数据注入"而非"软劝告"·比后验重生省在零重生。**但赌注=强数据注入是否被遵守(v3 的软注入被无视·这个未测)**——值得 A/B 验。
- **measure-first**: 任何方案先在 72 章判官标注语料上离线证精度(0误检门)·再接生成端·再 fork 中段 A/B(`exp-runner` + `NOVEL_FACT_VETO`/新 env)·判官 factC ≤ B×0.6 才人签。

## 6. 铁律/约束(方案必须 respect)
GENTLE-gated 默认关(爽文零变)· 四道闸(esbuild+tsc+golden逐字节+产线env canary)· 不碰活世界(fresh/fork 舰队·gen4 在跑别动)· 喂数据非散文· judge≠写手· 措辞补丁冻结(别加新软劝告指令)· n=1锁· 绝对%不入决策· 不计token(成本只FYI)· A/B 用 fork 中段(冷启开篇 base 太干净测不出·`opener-prevalence.md`§44)。

## 7. 可复用资产
- `app/fact-veto.ts`: 确定性检测端(性别名↔代词绑定 + 称谓法名漂移 + 数值·已证精度·name-drift 干净)。Phase 2 可在此加 LLM 检查层。
- `app/consistency-judge.ts`: P0 判官 prompt(5类·固化·Opus subagent 驱动)。
- **72 章判官标注语料**: `.novel-output/exp/flash-cost-v1/`(开篇32)+`flash-hybrid-v1/`(中段40)·全有 judge ground-truth(本档 §3 + R-results)·离线证精度的金标准集。
- `app/exp-runner.ts`: A/B 舰队(fork 用 VACUUM INTO 静态导出·`exp/bases/gen3vac.db` 已备·gen3 328章中段基底)。
- `app/longrun.ts:345-424`: writeChapter 段循环(line 388 mock-retry·397 text+=·416-422 FACT_V2抽取·339-340 buildSecPrompt注入装配)。

## 8. 交付物期望(Fable → Opus)
一份 Phase 2 方案: 选 (a)/(b)/(c) 或组合·给出 ①机制设计 ②为何不重蹈 v3/OFS/FULLCTX ③离线证精度方案(对 72 章) ④A/B 设计(fork中段) ⑤四道闸/gated/铁律落点 ⑥诚实的 payoff 预期与失败兜底。Opus 据此执行 measure→build→证精度→A/B→人签。
