# 核心自进化系统 · 提升与重构蓝图(综合版 v1.1 · 评审后签发稿)

综合者: 本文 = 总设计 v1.0 × 对抗评审裁决 的合并稿。**凡设计与评审冲突处, 一律以评审裁决为准**; 评审提出的 4 项签发前置(证据陈述修正 / 死刑判别轮 / WAL 安全 fork+首批人签 / 排期 ×1.8 与 canary 拆窗)已全部并入正文。
日期: 2026-06-10 · 路径前缀省略 `/Users/chris0810/Documents/Codex/Novel System/`
锚点状态: evolve.ts:92/316/341/353-355/374、longrun.ts:407/598-621/651-657、warm-fitness.ts(bond perCap×2.5 / total 权重行)、core/services/store.ts:163/173 已于签发日实地复核为真。

---

## 一、实证裁决: 系统在学什么 / 没在学什么(E2 数字 + 评审重算修正)

### 1.1 健康度一句话

**齿轮全在, 学习回路在三个串联环节同时坏死**——测错对象(归因污染)× 测量无效力(n=1 + 噪声≥效应)× 没有选择(无条件部署)。任一坏死即足以让选择失效, 三个全坏。系统每 8 章在花一次进化的钱, 买到的是遥测, 不是学习。

### 1.2 在学什么(经评审修正的诚实陈述)

- **mystory(唯一爽文长轨迹, 51 步/血统深度 7)的 obj 客观分呈显著正趋势**: slope +0.016/步, t=2.13, p≈0.033。这是 162 步里唯一的显著改善信号, 且恰发生在 bestEngine 选择唯一活跃(`!GENTLE`)的世界。**但它有混杂解释**(avoid 账老化 / 章长漂移 / 多重比较下的假阳), 无法归因到选择机制——故定性为「**无法归因的收益**」, 不得写成「零收益」, 也不得当作选择有效的证据。它把 §四 死刑分支的先验从"几乎必死"拉回"待判"。
- avoid 账、archive 格、铁律提案在持续产生**数据资产**(账本/格点/提案史), 这些是后续机制的原料, 没有白积累。

### 1.3 没在学什么(核验为真的坏死证据)

| # | 证据(实算) | 含义 |
|---|---|---|
| 1 | 162 个进化步, 全部世界 fitness/llm **零显著正趋势**(p=0.187-0.940) | 主选择信号无方向 |
| 2 | 3 个温情世界 obj **显著退化**(shanju p≈0.000 / renjian-killed p=0.004 / renjian p=0.0001) | 唯一强方向信号是负的 |
| 3 | 每基因 n=1(8 章窗, 从未二测); 同代 σ(评审重算 0.3-0.7, 设计估 0.5-1.9)≥ 全部基因效应, SNR 0.21-1.17 | 每次档案替换判定≈掷硬币 |
| 4 | 档案 max 棘轮: mystory「悲悯×急促」7.27@v2 封格 15-16 卷未刷新(evolve.ts:353-355) | 幸运抽样被永久封圣 |
| 5 | evolve.ts:374 子代**无条件 saveGenome 部署**, 无任何门; :341 `!GENTLE` 致三温情世界 bestEngine=null | "爬山"是误称, 活基因零选择压; GENTLE 世界 engine 纯锚定游走 |
| 6 | :316 selectParent 双 Math.random | 进化血统不可重放 |
| 7 | fitness 权重 75-90% 测的是干预后管线(drama 每章覆写 tuning longrun:407-411 / GD 派景 / edit-pass 删病 / 动态预算夹断) | 基因哪里弱干预层就在哪里当章补偿, 地形被铲平 |
| 8 | warm 量程钉顶: bond=10.0 且 sd=0.0(三世界 100%, perCap×2.5 满分阈≈4)、var≈9.8 sd 0.04、progress 钉死(yunyou 恒 6.5 / shanju 9.96 / renjian 9.65)。**口径修正**: var+bond=0.20+0.25=**45%**, 加 progress 0.10 共 **55%** 总权重近零梯度 | 总分对差异不敏感 |
| 9 | avoid 账抑制效果 3降4升3平≈随机, avoidHits 随时间上升 | 请求式抑制无效 |
| 10 | 收敛点全是约束墙(clamp 顶 / GENTLE 锚 / 硬帽: temp 钉 1.0、topP 死、温情 freq/pres 焊帽)而非学到的最优 | 表面"收敛"是撞墙 |
| 11 | QD 授粉 4 niche 在册仅 1 例真引种(renjian→huolang); **live bug 比设计描述更糟**: global-evolution.json 向后兼容 genome 槽=renjian 8.59 温情格(conflictRate 0.6/eventBias 0.63 温情锚形), 新建无 intent 爽文世界经 loadGenome 兼容路径直接吃进低冲突引擎 | 今天建新爽文世界即中毒 |
| 12 | longrun.ts:651 铁律提案块不受 NOVEL_EVOLVE 门; :655-657 停滞判读 scores.fitness(污染分), 干预铲平→假停滞→48 章兜底成主通道 | 质变层被噪声驱动 |

### 1.4 一处评审降级(措辞诚实)

ablate-full / ablate-noroulette / blind-batch-01 目录内**无** evolution.json/archive.json/genome.json, promoteToGlobal 对它们零摄入——臂目录泄漏目前**没有在传播**。P0-0 从「止血」降级为「**预防针**」(为未来 trial 臂打), 仍列第一批落地。

---

## 二、病灶与机会(按证据强度排序)

1. **归因污染(最强·因果主链)**: 干预层替基因领功×4, 基因永远学不会"少制造问题"。唯一解=draft 双轨(修订前草稿评基因)。机会: 爽文天然 draft=成稿(EDIT_PASS 仅 GENTLE)→ 零行为风险先行。
2. **统计无效力(构造性)**: n=1 + 噪声≥效应 + max 棘轮。观察式单点选择不可救药 → 选择必须介入式(同起点配对臂), 搜索粒度粗档化到检测地板之上, 档案 EMA 化。
3. **无选择(一行之差)**: :374 无条件部署。机会: trial 模式下 genome.json 只由 verdict 写, 语义变更集中一处。
4. **QD 授粉断裂 + styleTag live bug(今天就咬人)**: 兼容槽跨风格播毒。0.5 人日围栏即除。修通围栏后才谈证据闸授粉与维度化。
5. **warm 量程钉顶(55% 权重无梯度)**: 重标定先于 W_clean 转正, 否则转进无梯度总分。
6. **avoid 账≈随机 + 老化**: 请求式降级、执行式升级(带危害界), 基因经 W_clean 计费。
7. **铁律触发器读污染分**: 质变层总闸口换去偏数据源。
8. **机会: mystory 无法归因的正趋势**——若 P0 修尺后干净观察信号也出趋势, 说明观察式爬山在干净信号上可能够用, 轴Ⅱ可收缩(见 §三 P0-6③ 分流闸)。

**总处方次序(不变, 评审维持)**: 止血/预防 → 测量诚实(归因) → 统计效力(降噪+粗档) → 选择重造(自消融臂) → 新机制最后。归因优先于一切新机制——在污染信号上叠任何新算法都是给噪声抛光。

---

## 三、路线图(评审裁决后 · 30-38 人日 / 6-8 周)

**总排期修正(评审④)**: 原 18-21 人日/4 周 → **30-38 人日/6-8 周**。P0 批量落地可豁免单变量纪律(几乎全遥测/零行为); **P1 行为件必须在 canary 上串行开窗**(每窗一个行为变量), 或新建专用实验世界作第二 canary(绝不动停着的 shanju、绝不扰 huolang v7)。
canary 次序: renjian 先行 → yunyou 过窗跟进 → 其余。token 只作 FYI 永不作否决轴; 墙钟/读者影响/锁冲突计。

### 3.1 快赢层 W1-W2(P0, ≈8-9 人日)

| # | 项(裁决) | 改哪 / 骨架 | 成本 | 验收(机检) | 回滚 |
|---|---|---|---|---|---|
| **P0-7** | **QD styleTag 围栏(过·第一优先, live bug)** | app/evolve.ts: `GlobalCell` 加 `styleTag:"温润"\|"爽文"`; depositWorldArchive/promoteToGlobal 写入; loadGenome 取种、逐格比较、**及向后兼容顶层 genome 槽**全部只在同 styleTag 内命中(兼容槽改为 per-styleTag 或对跨风格读返回 null) | 0.5 | 模拟新建无 intent 爽文世界: 取种不再命中 renjian 8.59 温情格/温情锚形 engine | 字段忽略即旧行为 |
| **P0-0** | **臂目录预防针(改: 止血→预防)** | evolve.ts:92 isLiveWorldDir 追加排除 `^ablate-\|^exp$\|^blind-\|\.log$`; trend-watch 跳过含 `.exp-arm` marker 目录 | 0.1 | global-evolution.json 重算 diff 零变(当前本就零摄入, 断言保持) | 单行 revert |
| **P0-1** | **干预四账(过+退休条款)** | longrun.ts:407 处随窗记 dramaMult 均值入 sim-fitness.json; gentle-director.json 加 dispatchLog[{ch,domain,escalation}]; edit-ledger 补 revisedDelta; 每章 clampEvents 入账。**预注册退休条款: 任一账 2 卷无消费者即停写**(防三个月后成下一个待审计注入堆) | 1 | 新字段按 ch 键确定性; 爽文 GENTLE=false diff 零变 | 字段只增不删, revert 即停写 |
| **P0-2** | **草稿落盘+三缺失 gate(过+金测试)** | reviseChapter 前草稿以 `draft:<n>` 键与章同事务写 db; 新 env NOVEL_DRAMA/NOVEL_GD/NOVEL_DYN_BUDGET(各 4-8 行,"照算照 log 不写"模式, 默认=现状)。**注意**: core/services/store.ts:173 readRecentChapters 有 `prefix="saga-ch-"` 天然隔离 draft 行, 但 :163 readChapters **无前缀过滤**且 resume 章号源是 db | 2 | ①gate=默认全路径 diff 零变(爽文金测试) ②**resume 章号金测试: 写入 draft 行后 resume 章号不变**(评审新增) ③draft 行可读 | gate 删除即原状 |
| **P0-3** | **critique 降噪 median-of-3(改: 钉死类别字段)** | evolve.ts critique 同 prompt 三采样, 分项数值取中位; **类别字段(overused/wins/tone/conflict)整组取「适应度为中位的那次采样」**——禁止并集(overused 入 avoid 账→guidance 注入连爽文也消费, 并集=avoid 流入×3=行为变); 解析失败写 {failed:true} 占位入 scores(补轨迹暗洞) | 0.5 | σ_llm 估计减≈√3(归档世界重放对比); scores 无缺窗; avoid 账增速与单采样持平 | env NOVEL_CRITIQUE_N=1 |
| **P0-5** | **基因组瘦身+播种修复(过)** | mutateGenome: 剔 topP(死键, clamp 表确无 topP); GENTLE 下 freq/pres 移出变异空间(焊帽=常数); moveBiasAnchor 进 loadGenome/gen-world 默认播种; 候选生成强制覆盖死角键(每 trial ≥1 候选动 priorWeight/nicheWeight 之一) | 0.5 | 变异 JSON 不再含死键; 新建测试世界 genome 含 anchor | revert |
| **P0-6** | **选择统计修复(过·③升格分流闸)** | ① :316 selectParent `Math.random`→FNV(worldId+gen+vol) ② :353-355 档案格 max→**EMA-on-revisit**(0.7old+0.3new, 注释声明"格分可降=反赢家诅咒特性") ③ 未上 trial 世界基因驻留 8→16 章(两窗均值再判)。**③升格为「轴Ⅱ分流闸」非弃子过渡, 预注册读数规则**: P0-8+P1-1 落地后, 若干净观察信号(W_clean 趋势/draft-objFit)2-3 个窗内出可检趋势→轴Ⅱ收缩(候选数减半); 仍平趴→轴Ⅱ全量建。trial 上线后③与 trial 并存于未上 trial 世界 | 0.5 | 同输入两次 evolveOnce 选同父(可重放); mystory 重放: 7.27 封格在 EMA 下可被刷新 | 各自独立 revert |
| **P0-8** | **warm 量程重标定(过·重放选型)** | warm-fitness.ts bond perCap 满分阈 4→8 或对数压缩(`Math.log1p(perCap)/Math.log1p(8)*10`); var 幂放大高段; progress 冻结态在 server 曲线标注; ledger.scores 加 **fv 公式版本戳**。**变换选型必须以 yunyou 归档数据重放出 σ>0.3 真梯度为准**(评审: 不许拍脑袋选式) | 0.5 | yunyou 重放 bond/var σ>0.3; fv 戳齐 | fv 回退+公式 revert |
| **P0-9** | **signal-registry.json 声明版(过)** | 新 `app/signal-registry.json`: 每信号 {name, reads: draft/revised/events/snapshot/file, measures: genome/intervention/mixed/pipeline, consumers, pollution, fv}; 初始 24 行; lint 脚本查双计(C11 爽文 simFit novelty×objFit rep 双计→**列入授权批不先动**) | 0.5 | registry 过自 lint; 双计报告产出 | 纯声明零行为 |
| **P0-10** | **铁律提案 gate 显式化(过)** | longrun.ts:651 块受新 env NOVEL_CONSTRAINT_PROPOSE 控制(默认=NOVEL_EVOLVE 值) | 0.1 | 关 EVOLVE 后不再发提案 | env 删 |
| ~~P0-4~~ | **影子 sim(缓→P1 可选)** | 见 3.2 P1-8 | — | — | — |

**P0 验收门(W2 末)**: esbuild 逐文件零错; renjian canary 一窗四账+draft 行入史; 爽文 GENTLE=false 全路径 diff 零变 + resume 章号金测试过; registry 24 信号在册; yunyou 过窗跟进。

### 3.2 重构层 W3-W6(P1 + 档C, ≈14-18 人日; 行为件串行开窗)

| # | 项(裁决) | 设计要点(评审修正后) | 成本 | 验收 | 回滚 |
|---|---|---|---|---|---|
| **档C** | **三件真债(过, W3 先行)** | ①W1+W2+W3 模板可测化: ChapterContext 收编 13 位置参→EngineProps 类型化(app↔core 唯一缝)→buildSecPrompt/buildOutlinePrompt 纯函数+golden 注入回归断言("GENTLE 第 2 段含 voiceCard 不含 conBlock"类) ②atomicWrite×11(tmp+rename)+内存态落盘(recent/prevHook/revivals/seenPairs) ③治理执行件轻量版: echo-lint/D11-D12 进 lint-seams、trend-watch 读 registry pending | **6-8**(评审上修) | golden 断言上线且 GENTLE=false diff 零变 | 每件单提交 revert |
| **P1-6** | **exp-runner(改·本层核心)** | 完整规格见 §四。评审三修: ①主论据=**轴Ⅰ治理积压执行器**(fix-registry 已立案 EXP-2 已写账/v2栈消融、EXP-3 B2 验收、轮盘第二轮事实化——每个手搓≈2h 不可持续), 轴Ⅱ genome trial 是第二客户(参数层判死也不搁浅 runner) ②**v1 verdict 人签**(前 2-3 个 trial 人签后再自动化) ③**WAL 安全 fork 写死进 spec**(见 §四.3) | **8-10**(评审上修) | runner 复刻 EXP-1 得同判(不同判不上岗); 第一单=EXP-2 | runner 独立进程, 不跑即无 |
| **P1-1** | **测量换轨 draft 双轨(过·最高杠杆, W5 单独开窗)** | gate NOVEL_FIT_DRAFT: critique/metricsOf/avoidHits 读 draft(P0-2 已落盘); motifSig/GD 等导演用仍读成稿(按 registry consumers); 爽文 draft=成稿天然零变。副作用预声明: avoid 表开始收录被删 tic→guidance 内容变=行为变→registry#16 更新+canary | 2 | GENTLE canary 一窗: avoidHits(draft)>avoidHits(revised) 出正差; 爽文 guidance 逐字节同 | gate 关 |
| **P1-2** | **W_clean 转正(过, W6 与 P1-4 同窗前后半)** | 前置=P0-8 去饱和。warm-fitness.ts total 行入 0.08-0.10(从 social/arc 匀); 宪法③核查≥2 窗方向一致(n=10 r(clean,llmFit)=+0.65 已半足, 补一窗) | 0.25 | fv 升版; corr(clean,total) 转正 | fv 回退 |
| **P1-3** | **avoid 账 v2(改·危害界加固)** | schema: {phrase, kernel(内核词·解决括号句恒盲), textHits(draft 侧), llmVotes, status}; 入账验证=窗内正文真实出现≥2 次; 连续 2 窗 textHits=0 自动退休。**升级链(评审加固)**: textHits≥3×连续 2 窗 **且 kernel 字长≥4**(防"月光"级常用词全书面误删) → **首次升级先走一窗 observe(只记 would-delete 不删)或人签** → 转正后进 edit-pass 删除黑名单(数据), **edit-pass 消费侧加每章删除上限(≤2 处/章)**, 同时从 prompt 注入退场。基因经 W_clean(draft 侧)计费 | 1.5 | 账本条目数降且 textHits>0 占比升; observe 窗 would-delete 报告人查无误杀后才放行; registry 留痕单条可退 | schema 兼容旧条目; 黑名单单删 |
| **P1-4** | **质变层总闸口换源(过)** | longrun.ts:655-657 停滞判数据源: scores.fitness → 去偏列(W_clean 趋势 + draft-objFit, 同 fv 内比较; simFit_genome 仅 P1-8 建成才用); 48 章强制兜底保留; 提案附"触发依据"字段 | 0.5 | 停滞触发率变化入案 | 数据源参数化切回 |
| **P1-5** | **变异升级(改·砍 bestEngine 改造)** | 保留: 粗档预设 conflictRate∈{0.6,1.0,1.4} 等三挡制(挡距≥臂内 σ 实测检测地板); 变异 prompt 注入四账摘要+draft/revised 差("这分是基因挣的还是 edit-pass 擦的"归因式反思); engineBase 仍用基因原值。**砍: bestEngine 影子轨判据改造**——该机制 §四 trial 上线即退役为遥测, 为一周后退役的机制改判据=废动作; 且影子轨有 train/deploy 错位(影子跑裸基因, 部署环境每章被 drama 调制, 裸最优≠调制最优) | 1 | 变异输出落在挡位上; 归因反思出现在 mutate prompt | gate NOVEL_MUT_COARSE |
| ~~P1-7~~ | **fitness 总线(砍→残留件)** | **不搬权重读取路径**(纯风险换整洁)。只留: ①三个 fitness 写入点全部盖 fv 戳(P0-8 已起头) ②声明对照 lint: registry 声明的权重/reads 与源码常数比对, 不一致报警 | 0.5 | lint 对当前源码零报警; 故意改一处权重→报警 | lint 删除 |
| **P1-8** | **影子 sim 观察版(原 P0-4, 缓·可选)** | 仅 P1 有余力才做。卷首 fork 快照入 `:memory:` 纯基因 tuning 步进, MockLLM 确定性→simFit_genome 落盘只观察, gate NOVEL_SHADOW_SIM。**两条诚实声明**: ①scout 先例(longrun:346)是 tick0 起跑非中途 fork, 事件表/simRules lastFired/seenPairs 等快照外状态须逐项审计才能兑现逐字节验收 ②train/deploy 错位→产出只作遥测, 永不作部署判据 | 2(评审上修) | 同 seed 两次 simFit_genome 逐字节同; 墙钟<10s/卷 | gate 关 |

**P1 串行开窗表(评审④, 单 canary renjian)**: W5=P1-1 draft 轨(唯一行为变量) → W6 前半=P1-4+P1-2(fitness 计算侧, 协同蓝图先例可并) → W6 后半=P1-3 observe 窗 → W7=P1-5 粗档变异 + 轴Ⅱ首 trial(人签) → P1-3 转正(若 observe 干净)。每窗过后 yunyou 跟进上一窗内容。若墙钟压不下, 以 gen-world 新建专用实验世界作第二 canary, 不动任何停着的世界。

### 3.3 战略层 W7+ (P2, 缓·按触发条件维持)

| # | 项 | 触发条件 | 要点(评审修正) |
|---|---|---|---|
| **P2-1** | **死刑分支判定(改·加判别轮)** | 见 §四.8 | **签发前必须过「干预冻结判别轮」**, 与治理"无差→改形跑第二轮, 两轮皆无差才裁"条款对齐 |
| **P2-2** | 模板层进化(GEPA 实现谱) | 档C W3 纯函数化完成 + 若死刑签发则加急 | buildSecPrompt/buildOutlinePrompt 注入块组合作"模板基因"走同一 runner 臂; 变异范围显式排除检测器/fitness 模块; 每变体=registry 一条 |
| **P2-3** | 档案维度化(混合 BD+Pareto 格栅) | P0-7 围栏稳定 + P1 信号干净 | 温情 tone 轴退化→确定性行为轴(dlg/1k 分箱×场景域熵); MCC 最小准则门替贪婪替换; 旧格一次性迁移 |
| **P2-4** | 证据闸授粉 | P1-6 就绪 | 每 K 卷: 同 styleTag 最优格 fitness − 本世界近 3 窗均值>1.0(同 fv)→外源 engine 进轴Ⅱ候选池(origin=pollination) |
| **P2-5** | 第二判官(非 DeepSeek) | eval-governance 已立则 | observe 起步, 双判官 divergence 遥测≥2 窗→中位合成转正 |
| **P2-6** | 跨世界 norms 传承 | 铁律库≥5 条人批后 | 传"被批准铁律+账本条目"非传参数, 与 QD 基因传承并行 |
| **P2-7** | OMNI 趣味选格 | 顺手项 | pickTarget→LLM 按"对本书读者最有趣"排序未点亮格(1 调用/卷) |

### 3.4 关键 schema / 骨架草稿

```jsonc
// app/signal-registry.json 行示例
{ "name": "objFit.repetition", "reads": "revised", "measures": "mixed",
  "consumers": ["evolveOnce.fitness"], "pollution": "high", "fv": 3 }
// pollution=high 者不得作 bestEngine/铁律停滞判/QD 沉积依据(三禁规则)

// avoid 账 v2 条目
{ "phrase": "指尖摩挲过粗陶碗沿", "kernel": "摩挲", "textHits": 4, "llmVotes": 3,
  "status": "observe",   // requested → observe(would-delete 记账) → enforced(人签/observe窗干净) → retired
  "guards": { "kernelLen": 2, "pass": false } }  // kernelLen<4 永不 enforced

// trial-request.json(写者在卷边界落, 持锁时同步导出 fork 基底)
{ "vol": 17, "incumbent": "<genomeHash>", "forkBase": "exp/v17/base.db",  // VACUUM INTO 产物
  "candidatePool": [ { "genome": {...}, "origin": "coarse-mutation" } ],
  "preregistered": { "primary": ["lintsPerCh_draft","dlg1k"], "guards": ["D1-D12","弃章率","章长cv","rep4g","echo"] } }

// trial-verdict.json(v1 由人签字段把关)
{ "vol": 17, "winner": "incumbent" | "<candidateHash>", "humanSigned": true,
  "evidence": "exp/v17/exp-report.json", "decision": "paired-sign-test primary 向好且 guards 无>20%恶化" }
```

```ts
// P0-6① FNV 选父(替换 evolve.ts:316 两处 Math.random)
const h = fnv1a(`${worldId}:${gen}:${vol}`);          // 已有 FNV 先例, 复用
const exploit = (h % 100) < 70;
const idx = exploit ? (h >> 8) % Math.min(3, sorted.length) : (h >> 8) % archive.length;

// P0-6② EMA-on-revisit(替换 :353-355 max 分支)
else { const old = prev.fitness; prev.fitness = +(0.7 * old + 0.3 * fitness).toFixed(2);
  if (fitness > old) { prev.genome = cloneGenome(cur); prev.at = `v${vol}`; } // 基因仍择优, 分数 EMA 防棘轮
  placed = `≈EMA ${key}(${old}→${prev.fitness})`; }
```

---

## 四、自消融进化(评审放行·修正后完整机制规格)+ 质变接线

### 4.1 定位(评审重写的主论据)

`app/exp-runner.ts`(~250-350 行)= **治理 EXP 框架的执行器**。**第一客户是轴Ⅰ治理积压**: fix-registry 已立案的 EXP-2(已写账/v2 栈消融)、EXP-3(B2 验收)、轮盘"无差先事实化再判第二轮"全部排队待跑, 每个手搓≈2h 人肉×每卷×4 世界不可持续——runner 的存在性论证到此已闭合。**轴Ⅱ(genome trial)是第二客户**: 即便四周后参数层被判死, runner 转身服务模板层(P2-2)/铁律证据臂(§4.9)/轴Ⅲ结构猜想, 不存在"白做"分支。本周手搓 EXP-1(ablate 双臂, ¥1.2/35min 定轮盘生死)是流程可行性先例与校准基准。

### 4.2 触发与节律(双进程解耦)

- **写者进程零阻塞**: 卷边界(n%25==0)落盘后写 trial-request.json(**含 forkBase 导出, 见 4.3**), 继续用现任写下一卷; 下个卷边界读 trial-verdict.json 按卷号键幂等原子采纳。主世界永不等待、臂永不发表、读者零影响(在产哨兵章维持否决)。
- **runner 独立进程**: 消费 request→建臂→并行跑(`spawn tsx app/longrun.ts` 臂专属 env, NOVEL_TARGET=6-8)→机检收数→exp-report.json; **v1 阶段 verdict 由人签**(前 2-3 个 trial), 同判率确立后再自动写 verdict。臂目录带 `.exp-arm` marker, trend-watch 绝不 resume(臂跑完退出是正常态, 尊重"停止的世界别自启")。
- **候选池**: NOVEL_EVOLVE_MODE=trial 时 8 章 evolveOnce 降级为"遥测+候选生成"(saveGenome 改 append 候选池); 来源=粗档变异(P1-5)+死角强制覆盖(P0-5)+授粉候选(P2-4)。

### 4.3 WAL 安全 fork(评审签发前置③, 写死进 spec)

**禁止对在写的 world.db 做文件级 cp**(WAL/-shm 在写, 文件拷贝=撕裂基底→臂不可复现且可能损坏; ablate 目录实查有 shm/wal 残留为戒)。两条合法路径, 取其一:
1. **首选: 写者侧导出**——写者进程在卷边界落 trial-request 时**自己持锁同步执行** `VACUUM INTO 'exp/v<vol>/base.db'`(或 sqlite backup API), 这是唯一安全点; runner 只消费导出物。
2. 备选: runner 经 sqlite backup API 在线备份(仍需写者锁协调, 复杂度高, 不推荐 v1)。
state jsons(genome/evolution/archive/drama/constraints 等)在同一持锁窗口内一并快照。

### 4.4 臂配置矩阵

| 轴 | 臂构成 | 频率 | 产出流向 |
|---|---|---|---|
| **轴Ⅰ·消融(第一客户)** | {全栈, 关干预X}(X 轮换 fix-registry 在册项, 用 P0-2 三 gate) | 每 2-3 卷一项; **首单=EXP-2** | 因果效应量写回 fix-registry 疗效字段; 干预退休=人签代码变更, 证据自动生成 |
| **轴Ⅱ·选择(第二客户)** | 现任 G0 + 2-4 候选基因(全臂 NOVEL_EVOLVE=0 冻基因, 6-8 章) | 每卷(canary)→稳定后每 2 卷/世界错峰; **规模受 P0-6③ 分流闸读数调节**(干净观察信号出趋势→候选减半) | verdict 写 genome.json(唯一写权; v1 人签) |
| **轴Ⅲ·结构(猜想)** | B1 单次长生成等, 人工预注册才跑 | 按需 | 报告供人裁, 不自动转正 |

**配对紧度分级**: prompt 侧干预(edit-pass/GD/动态预算: 不写 tuning, sim 轨迹臂间逐 tick 同一)→同事件同纲要紧配对只差 prose, 功效最高; tuning 侧(drama/基因: sim 必分叉)→分叉即处理效应本身, 同章位分布比较+守门双轨。**runner 上岗门=复刻 EXP-1 配置得出与手搓相同判决**, 同时验证此分类。

### 4.5 预注册 schema 与判读

```
.novel-output/exp/<expId>/exp-spec.json (跑前写死)
{ id, axis, baseWorld, forkVol, forkBase, arms: [{name, env, genome}], chapters: 6-8,
  primary: 1-2 个, guards: ["D1-D12","弃章率","章长cv","rep4g","echo"],
  decision: "paired-sign-test primary 向好 且 guards 无>20%恶化", replicates: 1-2, fv }
```
- 守门(任一恶化>20% 否决): D1-D12 seams、弃章率、章长 cv、4-gram rep、echo-lint。
- 主指标: draft 侧 lints/章、dlg/1k、microPerK、settleRatio、干净 warm 子集(arc/social-allyRatio/emerge)。全取检测器层(宪法①), 终点权重不可进化, 定期用人工锚定集(eval-governance 认证好章留出集)校准防 Goodhart。
- 统计: 同章位配对符号检验 n=6-8/臂; 机检终点 σ≈2-3 实测→可检 Δ≈2.3-3.4, **粗档化保证候选效应≥地板**(±0.15 微调类候选不再生成)。功效不足: 臂内重复/臂 2→4/章 6→8(只花 token 与并行墙钟)。盲测仅作主指标矛盾时的升级仲裁。

### 4.6 接受准则语义变更

| 旧 | 新(trial 模式) |
|---|---|
| :374 子代每 8 章无条件上岗 | genome.json 只由 trial-verdict 写(v1 人签); 卷间现任不动 |
| 15 格 max 棘轮 + bestEngine simFit 棘轮 | 同起点配对臂裁决; 档案 EMA 化降级为父本库+遥测; **bestEngine 退役为遥测**(故 P1-5 不为它改判据) |
| fitness 标量比大小 | 标量只作遥测; 判据=预注册主指标配对检验+守门否决 |
| 评估 on-policy(下 8 章, 与干预/漂移混杂) | 评估 off-policy(冻基因冻干预平行臂, fork 同起点消混杂) |

### 4.7 确定性与成本(诚实声明)

fork 同快照+同 seed→臂 sim 可复现; 候选生成 FNV 化→血统可重放。**DeepSeek prose 是真随机源**——配对控制章位与 sim 轨迹, 不假装臂逐字节; 靠 n≥6+守门双轨+臂内重复。成本: 每 trial 3-5 臂×6-8 章≈1.5-2.5h 并行墙钟, ¥3-8 token(FYI); 磁盘~50MB/trial 用后压缩; canary 单世界先行, 稳定后每 2 卷错峰。隔离: 臂独立锁、isLiveWorldDir 排除(P0-0)、`.exp-arm` marker、verdict 单向回流幂等、runner 中死=无 verdict=现任续任(fail-safe)。

### 4.8 失败模式与停手规则(预注册·评审签发前置②已并入)

1. **死刑分支(改)**: 轴Ⅱ连续 2-3 卷全候选无可检差 → **不得直接判死**。必须先过**干预冻结判别轮**: 用 P0-2 三 gate 在**两臂同关** NOVEL_DRAMA/NOVEL_GD/NOVEL_DYN_BUDGET 下重跑一组候选——关栈有差而开栈无差→判「**干预掩蔽**」, 火力转向干预退休(轴Ⅰ), 基因**不**冻结; 两轮皆无差(与治理"无差→改形跑第二轮, 两轮皆无差才裁"条款对齐)→ 合法签发**参数层死刑**: 冻 preset、停候选生成(avoid 账独立保留视 P1-3 疗效)、进化预算转模板层(P2-2 加急)+铁律层(证据臂每提案必跑)。死刑判决书是合法交付而非失败——前提是判别轮先排除了掩蔽假说。
2. runner 判决与人工 EXP-1 复刻不一致 → 不上岗, 修到一致。
3. 守门指标所有臂同步恶化 → 嫌疑=世界态退化(去饱和问题)非基因问题, 报告标注、不采纳任何候选。
4. 臂目录泄漏 → P0-0 已堵, lint 每周扫。
5. (新增, 对应 P0-1 退休条款)任何遥测 2 卷无消费者 → 停写并在 registry 标 retired。

### 4.9 质变窄路接线(评审整体放行·原样)

**三红线不可僭越**: 铁律永远等人点; 一条 pending 堵死后续提案(故意的人类策展瓶颈=质变杠杆); 进化之手不碰 constraints.json 的 accept 路径。
1. **提案生成器升级**: proposeConstraintMutation 注入 verdict history 驳回案例+rationale 作 few-shot 负例(ExpeL 式)+ 去偏遥测(archive 空格/饱和征兆/sift 悬链/W_clean 趋势); 触发源换去偏信号(P1-4)。
2. **证据臂(复用 runner 轴Ⅲ)**: 人批前跑铁律开/关一对臂(8 章), exp-report 附议事卡——人类策展从"凭 rationale 点"升级为"看证据点"; 证据臂超时未归, 议事卡照常呈递标注"无实证"(人不等实验)。
3. **裁决回流只取弱形式**: 通过率/驳回理由进提案 prompt 负例池+遥测面板; **永不作数值 fitness 记功**(防在唯一留给人类品味的通道上注入谄媚压力)。

---

## 五、全项目重构裁决(评审维持原判)

**不做全项目重构。** 规模实查 app=4192 行+core=1575 行; 系统真资产=调好的常数/prompt 文本/状态文件/红线纪律, 重写最先毁掉这三样; "爽文逐字节零变"在重写定义下不可满足(逻辑封死)。一周三事(B2 结构修失败/措辞冻结/162 步平趴)指向的全是特定器官(选择/测量/模板可测性), 无一指向模块边界——器官移植≠全身重建。**档C 只偿三债**(§3.2, 6-8 人日, 全零行为变更, W3 先行)。

```
决策树(每里程碑评估一次):
默认 → 不全重构, 只偿档C三债。
├─ 升级①: 参数死刑签发(含判别轮) 且 W3 后仍有 ≥2 处注入对撞无法回归测试
│   → 扩大纯函数化至 outline/weave 全链(仍是器官级)
├─ 升级②: 第三风格真实立项 → style-profile 对象化(此前 YAGNI:
│   62 处三元是被逐字节核验过的丑, 重构=重新核验全部爽文路径, 成本>收益)
├─ 升级③: exp-runner fork 频率实测击穿文件态(锁冲突/IO 有数据)
│   → 仅此时重审状态 store(17json 归一在此之前=自盲)
├─ 升级④: core 需新增题材无关原语(如制度涌现 T2.3) → core 小步扩展, 非重写
└─ 永不: writeChapter stage 框架化 / core 重写 / 为重构而重构(零证据)
```

---

## 六、红线自查

| 红线 | 本蓝图合规点 |
|---|---|
| **sim 层确定性 / resume 逐字节** | selectParent FNV 化(P0-6①); 进化层一切随机源 FNV; draft 行金测试保 resume 章号不变(P0-2, readChapters:163 无前缀过滤已知); verdict 按卷号键幂等; **WAL 安全 fork 仅在写者持锁点导出**(§4.3); atomicWrite×11(档C②) |
| **爽文逐字节零变** | 全部行为件 GENTLE-gated; P0-2/P1-1 爽文天然 draft=成稿; 三 gate 默认=现状; P0-3 类别字段取中位采样防 avoid 流入×3; 每批附爽文金 diff; 行为级爽文影响(guidance 内容/novelty 剔除 C11)全列一次性授权批, 未授权不动 |
| **core 题材无关** | 本路线图零 core 改动(EngineProps 类型化是 app↔core 缝的类型硬化, 不改语义); 升级④才小步扩展 |
| **治理一致** | 死刑判据与"两轮皆无差才裁"对齐(§4.8-1); runner v1 verdict 人签; avoid 自动升级加危害界+首升 observe/人签; 进化之手永不碰评分/检测器代码(fitness 权重人工编辑+fv 戳); 新信号 observe 起步≥2 窗; 预注册 schema; 检测器与指令分离; 遥测退休条款预注册 |
| **铁律三红线** | 永远等人 / pending 堵死 / 不碰 accept——逐字保留(§4.9) |
| **v7 勿扰 / 停止世界不自启** | huolang 不碰; shanju 停着不动; 臂目录 `.exp-arm` + isLiveWorldDir 排除 + trend-watch 跳过; 臂跑完退出=正常态只报不自启; 第二 canary 只新建不复活 |
| **tsx 假绿** | 每件 esbuild 逐文件 + canary 实跑, 无一豁免 |
| **token 不计成本** | 只作 FYI(median-of-3 ≈¥0.1/窗、trial ¥3-8/卷), 永不作否决轴; 墙钟/读者/锁冲突计 |

---

## 七、验证法(每阶段验收·机检优先)

| 周 | 交付 | 验收门(机检) |
|---|---|---|
| **W1** | P0-7/P0-0/P0-9/P0-10/P0-1/P0-6(遥测批) | esbuild 零错; 新建无 intent 测试世界取种零温情命中; registry 自 lint 过; 同输入 evolveOnce 选父可重放 |
| **W2** | P0-2/P0-3/P0-5/P0-8 + renjian canary 窗 | 爽文 GENTLE=false 全路径 diff 零变; **resume 章号金测试过**; yunyou 重放出 σ>0.3 梯度; 四账+draft 入史 |
| **W3** | 档C 三件 | golden 注入断言上线且 GENTLE=false diff 零变; atomicWrite 回归过 |
| **W3-W4** | exp-runner + 校准 + 首单 | **runner 复刻 EXP-1 同判**(不同判不上岗); EXP-2(轴Ⅰ)报告落盘, fix-registry 获首个因果效应量 |
| **W5** | P1-1 draft 轨(单变量窗) | avoidHits(draft)>avoidHits(revised) 正差; 爽文 guidance 逐字节同 |
| **W6** | P1-4+P1-2(前半)/P1-3 observe(后半) | fv 升版且 corr(clean,total) 转正; would-delete 报告零误杀才放行 enforced |
| **W7** | P1-5 + 轴Ⅱ首 trial(人签) + 分流闸首读 | 第一份介入式选择 verdict(人签)落盘; 变异落挡位; 分流闸读数入案(趋势→候选减半/平趴→全量) |
| **W8** | 轴Ⅰ第二项 + 铁律证据臂 + 复盘 | 议事卡首次附实证; runner 自动 verdict 转正评估(人签同判率); **死刑判别轮预案演练**(仅当轴Ⅱ已连续无差才实跑) |

全程纪律: P0 批量豁免(遥测/零行为); P1 行为件单 canary 串行开窗, 每窗只动一个行为变量, fv 戳保跨窗可比; 每项单提交可 revert + env gate。

---

## 八、给主 Claude 的第一步落地清单(精确到文件·最小可行集先行)

**最小可行四件(评审钦定, 若只能做这些)**:

1. **P0-7 styleTag 围栏**(0.5 日, 今天就咬人的 live bug) — `app/evolve.ts`: GlobalCell 加 styleTag; promoteToGlobal/depositWorldArchive 写入; loadGenome 取种+逐格比较+**向后兼容顶层 genome 槽**全部同 styleTag 内命中。验收: 模拟新建无 intent 爽文世界, 不再吃 renjian 8.59 温情格。
2. **P0-2 + P1-1 draft 双轨地基**(~3 日, 因果主链唯一解) — `app/longrun.ts` reviseChapter 前草稿 `draft:<n>` 同事务落盘 + NOVEL_DRAMA/NOVEL_GD/NOVEL_DYN_BUDGET 三 gate(默认=现状); 金测试两条: 爽文 GENTLE=false 全路径 diff 零变、draft 行不改 resume 章号(`core/services/store.ts:163` readChapters 无前缀过滤是已知风险点)。P1-1 换轨等 W5 单独开窗。
3. **exp-runner 薄版**(~5 日) — 新 `app/exp-runner.ts`: 写者侧 `VACUUM INTO` fork 基底(持锁点导出, 禁文件级 cp 活 WAL 库)+开臂(`spawn tsx app/longrun.ts` 臂 env)+收数(lint-seams/edit-ledger/warm 分项)+exp-report; **verdict 人签**; 上岗门=复刻 EXP-1 同判; **第一单=fix-registry 在册 EXP-2(轴Ⅰ消融), 轴Ⅱ genome trial 第二**。
4. **P0-6①③**(0.5 日) — `app/evolve.ts:316` Math.random→FNV(worldId+gen+vol); 未上 trial 世界基因驻留 8→16 章双窗均值, 并预注册其「轴Ⅱ分流闸」读数规则。

**随后按 §三 顺序**: P0-0(evolve.ts:92 正则)→P0-1(四账+退休条款)→P0-3(median-of-3·类别字段取中位采样)→P0-5/P0-8(yunyou 重放选型)→P0-9(app/signal-registry.json)→P0-10(longrun.ts:651 提案门)→档C→P1 串行窗。
**禁手清单**: 不搬 fitness 权重读取路径(P1-7 已砍); 不为 bestEngine 改判据(P1-5 砍项); 不自动 enforce avoid 黑名单(先 observe/人签); 不直接判参数死刑(先干预冻结判别轮); 不碰 C11 双计(授权批); 不动 shanju/huolang。

**一句话总判(修正版)**: 系统不缺齿轮, 缺三样咬合件——诚实的尺(draft 轨+四账+registry)、够粗的刻度(粗档+EMA+median-of-3+16 章驻留)、真正的裁判(自消融臂, 首单还治理积压的债)。先围栏止毒、再修尺、再造裁判、最后才谈新机制; 全项目不推倒; 人裁红线一寸不让但递上证据; 若裁判经判别轮宣判参数层死刑——那份判决书连同火力转向模板与铁律层, 是本蓝图最有价值的可能交付; 而 mystory 那条无法归因的正趋势提醒我们: 判决书未签之前, 先验仍是开放的。
