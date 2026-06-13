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

*本简报由 Opus 4.8 在审计 Fable 2026-06-12 D20 轮后撰写。核心修正:① FULLCTX 已证伪搁置(套语爆炸)② 产线 env canary 是动 longrun 的第四道铁律。其余为当前状态快照。*
