# 交接简报 · 给 Fable 模型(2026-06-12 · Opus 审计后)

> 你(Fable)上一轮造了 D20 容器材质漂移检测器 + ledger-scan 分诊 CLI + runbook,判断"容器漂移纯确定性做不到零误杀→撤出逐章管线改人工分诊"。**这个判断和代码都对**(下面有 Opus 的复核证据)。但你的 runbook 有**两个知识盲区**会带来真风险,这份文件给你补齐 + 给全当前系统状态,你据此继续完善。

---

## 0. 一句话:你的 D20 代码通过了 Opus 全部复核,但别按你的 runbook 开 FULLCTX

- **D20 代码安全**:四道真验证全过(见 §2)。撤出逐章管线撤干净了,不污染遥测/gen3/机检。功能真(炊烟 ch119 命中、好章 0 误杀)。
- **⚠ 但你 runbook 推荐的 `NOVEL_FULLCTX=1` 根治开关——本会话早些时候已实验证伪并搁置**(见 §1)。直接开它重开世界,可能治好漂移却请回"套语爆炸"老 bug。

---

## 1. ⚠ 你最需要知道的两个盲区(纠正你的 runbook)

### 盲区①:FULLCTX 已被证伪搁置,不是干净根治
- 你读的是 `.audit/20260609-eval-governance/synthesis.md`,那里 FULLCTX(代号 B2)还是"**待 EXP-3 验收的候选**",gate 默认关。
- **但本会话后续实验裁决**:`NOVEL_FULLCTX=1`(GENTLE 下传全量已写正文 ~6000字)会让**全文上下文变成"短语库"→ d1c 套语爆炸(实测 16-37 对 vs 基线 p95=12)**,防抄袭句压不住 → 已回退到不带 FULLCTX 的 B-arm 配置(现役 gen3 就是)。
- **结论**:FULLCTX 治"事件重复/容器漂移"这类是有效的,但代价是套语层崩。**不能当无副作用的根治直接开。** 要用必须先量 d1c。

### 盲区②:SEG_LEDGER 已被 EXP-2 裁撤为 opt-in
- `NOVEL_SEG_LEDGER`(跨段已写账:covered/人地账/交易账)**默认关**(你 runbook 假设它要手动开是对的,但要知道为什么)。
- EXP-2(6章配对)裁决:它对 D2/tradeReps **无可检效应** + **章长 +30%**(5095→3576)→ 用户人签裁撤,默认改 opt-in(`NOVEL_SEG_LEDGER=1` 可回开)。registry#4/5/6 = DONE-裁撤。
- **但**:它恰是"跨段账"机制,对"分段各取材质"(=容器漂移根)反而沾边。重开它做漂移验证**可以**,但要知道它催肥章长、且 EXP-2 在别的轴上判过它无效——要测就单独测漂移轴,别假设它白开。

---

## 2. Opus 对你 D20 的复核证据(你 sandbox 跳过的)

你在 Linux sandbox 用 `node --experimental-strip-types` 自测——那**只擦类型不查类型**,也不是产线环境。Opus 补全了你跳过的四道:

| 闸 | 结果 |
|---|---|
| esbuild 逐文件(lint-seams + ledger-scan) | ✓ 语法干净 |
| `tsc --noEmit`(真类型检查) | ✓ 两文件零类型错 |
| golden 37 断言(lint-seams 被 longrun 间接 import) | ✓ 全过 |
| **产线 env canary 实跑**(`NOVEL_STYLE=温润` 起真写者 sleep 10 探活) | ✓ 模块加载过 |

**功能复核**:`auditContainerDrift` 对 gen3 ch119(炊烟原稿:同一包茶 @46% 是布、@78% 是纸)正确命中;好章基准 0/9 误杀。管线隔离复核:`d20MaterialDrift` 没被 lintSeams() 调用,`SeamResult.metrics` 无 d20 字段=真没污染。

---

## 3. 🔴 铁律(你这次踩了第①条,务必内化)

1. **动 longrun 模块级代码,必须跑产线 env canary 第四道**——esbuild+tsc+golden 三绿仍可能假绿(模块级 `const A` 引用其后定义的 `const B` = TDZ;golden 在非温润 env 导入会短路三元、不执行坏分支)。canary 写法(macOS 无 `timeout` 命令):
   ```bash
   rm -rf .novel-output/tpl-canary
   NOVEL_SAGA_DIR=tpl-canary NOVEL_STYLE=温润 NOVEL_PACK=freeform \
     NOVEL_WORLD_CONFIG=.novel-output/worlds/dukou.json npx tsx app/longrun.ts > /tmp/c.log 2>&1 &
   CPID=$!; sleep 10
   kill -0 $CPID 2>/dev/null && echo "✓加载过" || { echo "✗崩"; grep Error /tmp/c.log; }
   kill $CPID 2>/dev/null; sleep 1; kill -9 $CPID 2>/dev/null
   for pid in $(pgrep -f app/longrun.ts); do ps eww $pid|grep -q tpl-canary && kill -9 $pid; done
   rm -rf .novel-output/tpl-canary
   ```
2. **新检测器必须三语料校准**:命中病例(原稿)+ **好章基准误杀=0**(`renjian-killed-*` 归档)+ 全语料发率抽读。issues 通道=最易遵从的 directive(单 token 换字/删一句);flags 通道=只记日志的结构病(revise 救不了的)。
3. **零 LLM / 确定性 / resume 安全**:检测器禁 `Math.random`/`Date.now`,纯词法。
4. **判"幻觉名"前必查 sim 花名册**(`world_state.snapshot_json` 的 characters):2026-06-12 我误把 sim 真角色(顾小棠/宋青舟,本是名池撞名产物)当写漂,连错两步。canon-only 对照会饿死合法角色。
5. **杀进程**:`dangerouslyDisableSandbox=true` + 逐个单值 kill(zsh `kill $VAR` 多 PID 静默失效);认 `cat <dir>/longrun.lock` 的 PID 或 `for pid in $(pgrep -f app/longrun.ts)` 按 SAGA_DIR 过滤;`lsof world.db` 验零写者再清锁;**绝不 broad pkill**;判野进程必须 PPID 谱系+lsof 反查(`ps eww` 对长 env 会截断→误杀过 runner 包装层)。
6. **绝不 `import` longrun 做测试**(脚本型模块·import 即跑 main → 拉野写者写 `.novel-output/saga`)。要测 prompt 走 golden 的 scratch 模式。
7. **绝不 resume 用户停的世界**;掉了只报不自启。
8. **`.novel-output/` 含 DeepSeek key 已 gitignore,绝不 commit/echo key**。

---

## 4. 当前系统状态(你接手时的真相)

### 在跑世界
- **柳青世界 gen3** = 唯一在跑:`dukou` / :8998 / 温润 / lock=51561 / ch120+
- 启动 env(服务器 spawn 用 `{...process.env}`,加开关即继承):
  ```
  NOVEL_STYLE=温润 NOVEL_PACK=freeform NOVEL_EVOLVE=1 NOVEL_WARMUP=100
  NOVEL_WORLD_CONFIG=.novel-output/worlds/dukou.json
  NOVEL_FIT_DRAFT=1 NOVEL_WCLEAN=1 NOVEL_STAGNATION_SRC=clean
  NOVEL_MUT_COARSE=1 NOVEL_TRIAL=1 NOVEL_EVOLVE_MODE=trial
  ```
- gen1(520章)/gen2(53章·撞名灾)已归档 `dukou-gen{1,2}-archived-*`。其余四世界(huolang/yunyou/renjian/shanju/mystory)用户停,勿自启。

### 检测器全谱(D1a–D20,已 commit 58788a9 + D20 未提交)
| 维 | 治什么 | 通道 |
|---|---|---|
| D1a | 时序倒流(同日时辰只进不退) | flags |
| D1c | 远距套语对(≥8 issues / ≥12 flags) | 双 |
| D2/D8/D12 | 重复相遇 / 角色重引 / 事件签名去重 | flags |
| D3/D6 | 单物过劳 / 市井堆 | issues |
| D4/D9 | 地理矛盾 / 地点重访 | flags |
| D5/D11 | 量词冲突 / 找零算术(亏三文案) | flags |
| D7 | 同物二卖 | flags |
| D10 | 回声(虚词归一·标题闸) | flags |
| **D13** | 整句复写(≥16 directive·dedup 确定性删第二处) | issues |
| **D17** | 那X无先行(空青芝麻案) | flags |
| **D18** | 名字漂移(后两字同+姓异+不在册) | issues |
| **D19** | 同台词复写(三道印案·引号片段归并) | issues |
| **D20** | 容器材质漂移(炊烟案) | **CLI 分诊·非 gate** |

机检权威态 = `edit-ledger.json` 的 lints dims(`lintSeams(text,names,title)` 手动调是参考)。

### 自进化(已收束,转护栏 + 待命)
- 参数轴(轴Ⅱ):trial1-8 共 9 旋钮全谱 **null**,判别轮 R1/R2 判**参数层免死**(极端基因可检但有害),转低频粗档护栏(每 2-3 卷)。
- 模板轴(P2-2):TPL 四槽(endGentle/secBudgetGentle/penDensity/penRestraint)trial9-13 全 **null**(现任文本四连胜·复测纪律两次拦假阳性),转待命。槽基建留用,新变体只在新证据时开。
- 撞名灾(本日):make-pack.spawnName 姓优先遍历+名池含主角名 → gen2 17人15人共享5名。已修(主角名禁用表+名优先成块遍历)。

### 治理铁律(评测处置 SOP)
- **四分诊**:A 已知症复发=记账 / B 新症=待复现池·优先写检测器不写指令 / C 纹理印象+绝对%=贴现不动 / D 客观硬伤=当天转检测器。
- **n=1 锁**(单章评测不触发代码,新症需 ≥2 章复现)·**绝对%不入决策**·**措辞补丁冻结**(检测器不冻)·**校准永远指 killed 归档**。
- **不计 token**(成本只 FYI)。

---

## 5. B 类待复现池(你可以接着造检测器的真空地带)
这些是评测反复点到、但还没有可靠确定性检测器的硬伤:
1. **沈无尘断线类**(开了一条线[桥洞哭声]后文不收=未闭合伏笔)——三道印案。
2. **瓷瓶/物件归属错乱**(A 拿出的东西后文写成 B 带来的)——空青芝麻案。
3. **嗓子哑/状态语义复述**(同一状态换措辞说两遍·非整句复写=逃过 D13/D19)——空青芝麻案。
4. **铜板枚数守恒**(三枚→两枚→三枚无收付动作)——你已诚实判定纯确定性做不到(子集描述"两枚光亮的"会骗过数枚规则),交生成端。**这个判断对,别硬塞。**
5. **容器材质漂移**(你的 D20)——已做成 CLI 分诊,别再尝试塞回 gate。

造之前先问:这一维 **issues 能给最易遵从的 directive 吗?好章误杀能压到 0 吗?** 压不到 0 就走 flags telemetry 或 CLI 分诊,别污染逐章管线(你这次对 D20 的处置就是范本)。

---

## 6. 容器漂移/枚数这类"账本 bug"的正确根治路径(给你下一步)

你 runbook 的方向(生成端治本)对,但开关选错了。安全验证路径:

**别拿健康的 gen3 去赌"两个都开重开"**(万一套语爆炸=白烧一个世界)。用并行舰队对照(SOP 见 `.novel-output/exp/specs/verify-fresh-01.json`):
- 臂A = `NOVEL_FULLCTX=1 NOVEL_SEG_LEDGER=1` 两开
- 臂B = 现栈(对照)
- 各 8 章 ~40 分钟,量 **d1c(套语爆炸是否复现)+ D20 容器漂移 + D13/D19 复写 + 结构维**
- 判读:臂A d1c 炸(≥16)→ FULLCTX 不采纳(拦住老 bug);臂A 干净且漂移降 → 才放心重开 gen4。

这是"先验证 FULLCTX 副作用、再决定世界命运"的安全顺序,比直接重开既快又不赌。

**更值得做的方向**:与其开会引爆套语的 FULLCTX,不如**精化已有的跨段已写账(SEG_LEDGER)只喂"物件清单+其材质"**(而非全文)——这是窄带的跨段一致性,不会变短语库。这条还没人试过,是真空地带。

---

## 6b. 🔬 舰队验证结果(2026-06-12 · Opus 跑完,直接回答上面两件事)

从 gen3 ch100 成熟态 fork,3 臂 ×8 章(A=FULLCTX+SEG_LEDGER 两开 / B=对照 / C=仅 SEG_LEDGER):

| 臂 | d1c 均/峰 | 容器漂移 | D13复写 | 章均字 | flags均 |
|---|---|---|---|---|---|
| **A** 两开 | **11.9 / 30** | 0 | 3 | 3657(+18%) | 0.88 |
| B 对照 | 4.8 / 11 | 0 | 0 | 3075 | 0 |
| C 仅账 | 4.1 / 7 | 0 | 0 | 3265 | 0 |

**裁断①:FULLCTX 否决(套语爆炸坐实)。** A 臂 d1c 均 11.9 = 对照 2.5×、**峰值 30 落在历史爆炸区 16-37**、D13 复写 3 vs 0、章长 +18%、配对 p=0.004。你 runbook 的"开 FULLCTX 根治"会确凿地把套语泛滥请回来。**别用。** 真要用必须配 d1c 实时监控且当 tradeoff 不当 fix。

**裁断②:窄带物件账本——别写(不是因为不安全,是因为目标 bug 太罕见)。**
- 关键数据:**容器材质漂移在 ~700 章(gen1 520 + gen2 53 + gen3 129)只触发 2 次 = 0.3% 发率**(gen1 ch82 + gen3 ch119)。炊烟那篇是罕见离群,不是系统病。
- SEG_LEDGER 单开(C 臂)benign:d1c 4.1 ≈ 对照,无套语代价——所以窄带账本"安全"没问题。但**为 0.3% 的 bug 加一套常驻生成端机器(prompt 预算/复杂度/章长)不划算**。你已经造好的 **D20 CLI 分诊就是这个罕见度的正确投资**——按需扫、人工核,不建常驻系统。
- 这正是"测量先于建造"的兑现:量了,量出来"别建"。

**给你的下一轮真建议**:容器漂移这条到此为止(D20 CLI 够了)。回 §5 的 B 类待复现池挑**发率更高**的真空地带——优先 **②瓷瓶/物件归属错乱** 和 **③状态语义复述**(这俩在评测里反复出现,大概率比 0.3% 常见得多;先用类似 auditContainerDrift 的离线扫法量一下三代发率,过 ~3% 再考虑做检测器,< 1% 就也只配 CLI 分诊)。**先量发率,再决定投资档位**——这是这套系统每个检测器该走的第一步。

---

## 7. 你交付物的归属(已确认无需改)
- `app/lint-seams.ts` D20 段(+44行)= 保留,独立导出正确。
- `app/ledger-scan.ts` = 保留(CLI 分诊)。
- `.audit/20260612-ledger-checker/` = 保留(审计+runbook),但 **runbook 第2步的 FULLCTX 命令需加注本文件 §1 的套语风险警告**。
- 这三件**尚未 commit**(Opus 上次 push 到 58788a9 是你这轮之前的状态)。要不要连同 D20 一起提交,等用户定。

---

## 8. SOTA 深研结论 + 下一步从 P0 起(2026-06-12·Fable 深研后追加)
> 全文: `.audit/20260612-consistency-research/synthesis.md`(5 路并行检索+交叉核验·带引用)。一句话: **"长篇结构一致性能否系统性解决"= 能, 且文献逐条印证本会话手做出的判断。**

**研究三条主轴(都印证了已知的)**
1. **FULLCTX 是机理性死路**, 不只是实测套语爆炸: 喂回自己逐字旧文激活 induction-head 复制电路→套语爆炸是被预测的必然(Lost-in-the-Middle / NoLiMa「长度本身即因果退化·mask 无关也救不了」/ Olsson induction heads)。**§6b 裁断①被发表工作确认。**
2. **窄带结构化状态(实体/物件表·非全文)是唯一有验证的预防路**: DOME 上下文冲突减 87.61% / DOC 连贯+22.5% 且趣味性升(不伤文风)/ MNEME 实体记忆相对+57%。**同质化只由"回喂生成的散文"引起(Padmakumar-He), 数据型状态按构造避开。**
3. **检测只能做"高精度/半召回"外部尺子, 非零误杀闸**: coref 书级仅~36F1、NLI~74%, 零误杀+全召回数学不可达; 但专用判官(ConStory-Checker)88%精度、比职业标注者还准(人漏~83%)。**"D20 降 CLI 分诊 + revise 禁动情节时空"被证明对。**

**⚠ 与 §6b 的对齐(别误读成矛盾)**
- §6b 裁断②"别写窄带账本"是**针对容器漂移这一个 0.3% 的 bug**——正确, 为单个罕见 bug 上常驻机制不划算。
- 研究 Part B 把窄带账本列 **P1 主攻**, 指的是它作为**通用预防杠杆**覆盖**全部结构 bug 类的聚合**(可数/重复初遇/时序/地理/伏笔不收…), 而非只为容器漂移。
- **两者不冲突, 纪律一致**: 先做 **P0**(造外部判官尺子)→ 量**聚合**结构 bug 发率 → **只有聚合发率过门槛才上 P1**。不能拿 0.3% 容器漂移单点否掉 P1, 也不能不量就上。

**给下一个执行者(Opus CLI)的起点 = P0, 不是 P1**
1. **P0 先造"与人眼对齐的外部一致性判官"**(ConStory-Checker 范式·离线逐章·高精度/半召回·**用与写章不同的模型防自偏**, 别用写章的 DeepSeek 自判)。
2. 用它扫 gen1+gen2+gen3 + killed 归档, 给每类结构 bug 出**逐章发率基线表**(同 D20 量容器漂移 0.3% 的做法, 覆盖全类)。
3. 据发率定档: 过~3% → 进 P1 窄带账本候选(双轴 A/B: 一致性↓ 且 d1c 不炸才采纳); <1% → 只配 CLI 分诊(如 D20)。
4. **四个永久不做**(研究确认): FULLCTX / 同模型自批改 rewrite 结构 / coref 类零误杀闸 / 为<1%发率上重机制。

**B 类池(§5)排序更新**: ②物件归属错乱 / ③状态语义复述, 现在有了 P0 判官就能**先量发率再决定**, 不必凭印象写检测器——这就是 P0 解锁的价值: 让"测量先于建造"对每一类 bug 都可执行。

---

---

## 8b. P0 已执行(2026-06-12·Opus·结果 → P1 该建,靶心改了)
> 全文 `.audit/20260612-consistency-research/P0-results.md`。

**判官造好且验收过**:Opus subagent(≠写章 DeepSeek·零自偏)逐章 ConStory 判定三类(物件归属/状态复述/伏笔不收)。4/4 已知评测正例全中且 findings 与人工一致(瓷瓶归属/嗓子哑/苏小棠苏知秋/沈无尘断线),**好章基准 0/9 误杀**(与 D13 好章 55% over-fire 相反=干净判别器)。代码:`app/consistency-judge.ts`(prompt 模板+schema)+ `app/struct-prevalence.ts`(确定性类穷扫)。

**全类发率量完(先量后投资·已量)**:
- 确定性类(D1-D20 穷扫):gen3 干净信号类全 **≤1.4%**,无一过 3% 门槛——确定性轴已处理好。
- LLM-only(判官抽样):**状态语义复述 ~31% live / 0% 好章 = 唯一过门槛的结构 bug**;物件归属/伏笔不收随机~0%(只在已知坏章现)=罕见。

**P1 裁断更新(修正 §6b)**:§6b「别写窄带账本」是只看容器漂移 0.3% 的单点结论;按研究坚持的**聚合**一量——**状态复述 31% 就是值得建的**。所以:
- **P1 窄带账本 = 该建**,但**靶心从「物件材质」改为「已陈述事实/状态复述」**(账本在事实层去重,逐字+语义两形态通吃;确定性现只接 1.4-5%,留 ~26% 未接)。
- 物件归属/伏笔不收 = 判官 CLI 按需分诊,不建常驻。
- **P1 仍须**:四道 canary + A/B 舰队双轴(判官复述率↓ 且 d1c 不炸才采纳)+ 不赌 gen3 + 先出设计人签。

**给 Fable**:你可以接 P1——窄带「已陈述事实账本」(每段后零 LLM 抽本段陈述的人物状态/物件事实→紧凑 schema→下段 prompt 边缘提示"已交代勿复述")。这是你 runbook 原方向(生成端治本)的**正确靶心版**:不喂全文(FULLCTX 否决)、不喂物件材质(0.3% 不值),喂"已陈述事实"治那个 31% 的复述。

---

## 8c. P1 v1 已试并否决(2026-06-13·Opus·机理反证)
P0 量出状态复述 31% → 建 P1 v1「已陈述事实账本」(NOVEL_FACT_LEDGER·zero-LLM·段后抽台词指纹→下段注入"勿复述")。**A/B 舰队(fact-on vs 对照·各8章)双轴皆败**:复述率 A 5/8 > B 3/8(更差)、d1c A 6.0 = B 3.3 的 1.8×(套语更差)。
**机理(研究早预测·此实证)**: 喂回逐字台词(哪怕"勿说"否定框)= 递 induction-head 复制模板 → 同时放大复述与套语(FULLCTX 的小号)。**铁证: 喂数据非喂散文。** `NOVEL_FACT_LEDGER` 保持默认关(gated 记账)。
**P1 路径修正**: v1(逐字注入)死路; v2(若做)= light-LLM 抽 `实体→{状态/计数/材质}` 数据型 schema(非散文)·研究 Phase1 本意; **当前建议暂搁 P1**——复述 31% 里 egregious 逐字 dedup 已接、判官当 CLI 分诊按需抓、语义复述交 revise-pass; 不为 31% 上常驻机器(测量先于建造)。**给 Fable: 别再走喂句子的路(v1 已证死); 要做 P1 就 v2 数据型抽取, 且先 A/B 双轴(判官复述率↓ 且 d1c 不炸)才采纳。**

---

## 8d. 下一条轴: 开篇矛盾/转场 → P2 spec(2026-06-12·Fable 追加)
> 详: `.audit/20260612-consistency-research/P2-opener-facts-spec.md`(可执行规格·分阶段·落文件行号)。

**复述轴已闭环**: P1 v2(数据型「实体:属性」账本·`NOVEL_FACT_LEDGER=2`)A/B 成功(复述 6/8→3/8·d1c 仅 1.4× 不炸), 用户签字采纳, gen3 生产确认 ch317-324 复述 2/8。详 P0-results.md §7。

**新评测开了正交的下一轴**: gen4 ch3《一篙撑不开的雾》——船钱 1↔3文 / "独条船↔上月两文" / 柳青舟从茶楼瞬移。**确定性栈实扫该章 0 命中, FACT_LEDGER v2(防复述)也不治**——这是**矛盾(contradiction)+转场(transition)轴**, 与复述轴正交。

**已代码验证的机理**(别再论证): 预热暖 sim 世界态、不暖散文事实账本; **开篇是事实一致性最难章**(canon.json 开篇尚不存在 / canonHard 只带 sim 事实不带散文微事实 / in-medias-res 把最多首次确立事实塞进 ch1·4 段盲写各编一版)。而硬事实 `worlds/*.json` 本就有, 只是没 seed 进 ch1。

**P2 落地三步(已成 spec·交 Opus)**: A 判官扩两类(factualContradiction/transitionGap)+ 量开篇 ch1–5 发率(先量·门槛开篇加权~8%); B 开篇事实底牌 OFS(配置→ch1 注入·数据型避套语)+ 章内矛盾守卫(扩 FACT_LEDGER 防"换数")+ 转场反向守卫; C fresh 双臂 A/B(不碰 gen4·主轴矛盾↓ 副轴 d1c 不炸)。**全程同纪律: 先量后建、数据非散文、四道 canary、人签采纳。**

---

*本简报由 Opus 4.8 撰写; §8 Fable 追加; §8b/§8c Opus 执行 P0/P1 后追加; §8d Fable 追加(开篇矛盾/转场轴+P2 spec 指针)。核心:① FULLCTX 证伪 ② canary 第四道铁律 ③ 复述轴 P1 v2 已闭环上线(喂数据非散文) ④ **下一轴=开篇矛盾/转场, 按 P2-opener-facts-spec.md 先量后建**。*
