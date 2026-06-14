# P2 实施规格 · 开篇事实底牌(OFS) + 章内矛盾守卫 + 判官扩类
> 2026-06-12 · 交接 Claude CLI(Opus 4.8)执行 · 承接 synthesis.md / P0-results.md
> 触发评测: gen4 ch3《一篙撑不开的雾》——船钱 1→3文矛盾、"上月两文 vs 独条船"设定矛盾、柳青舟从茶楼瞬移。**确定性栈实扫该章 0 命中**(flags/issues/D20 全空), FACT_LEDGER v2(防复述)也不治——这三个 bug 在**矛盾(contradiction)+转场(transition)轴**, 与已上线的复述轴正交。

## 0. 机理(已代码验证·别再论证, 直接据此做)
- 预热(scout 100tick 挑弧线 in-medias-res)暖的是**sim 世界态**(挑哪条弧/从哪个 tick 切/谁对谁), 戏剧定位好——**不暖散文级事实账本**。
- **开篇是事实一致性最难的一章, 不是最易**: ① gen4 写到 ch4 时 `dukou/canon.json` 文件**尚不存在**(文本派生 canon 在开篇=空); ② `canonHard`(longrun.ts:139)派生自 sim 快照只带"境界/派系/生死/恩怨", **不带散文级微事实**(船钱=X文 / 渡口几条船 / 谁此刻在哪); ③ in-medias-res 把**最多的首次确立事实**塞进 ch1, 4 段盲写各编一版 → 矛盾温床。中段轻因多在复用已立事实。
- **但这些硬事实世界配置里本就有**: `worlds/<saga>.json` = protagonists(名+faction) + locations(规范名)。**只是开篇没人喂给写手。** → 核心修法 = 把它们提前 seed 进 ch1。

## 1. 目标与边界
- **目标**: 降开篇(ch1–5)的事实矛盾 + 转场缺失, 不伤文风(数据型注入, 非散文→避 induction-head)。
- **不做**: FULLCTX(永久否); 同模型自批改 rewrite; 为它改世界配置的内容; 碰在跑的 gen4(用 fresh 舰队)。
- **纪律**: env-gated 默认关 · GENTLE-only · resume-safe · 空则注入自坍缩(golden 逐字节同) · 动 longrun 必跑产线 env canary · 三语料校准(开篇病例命中 + 好章误杀0 + 全语料发率) · 判官用**非写章模型**(防自偏) · 先量后采纳(同 FACT_LEDGER v1/v2 流程)。

---

## Phase A — 先量(measure-first·不先建生成端)
**A1. 判官扩两类**(`app/consistency-judge.ts` 的分类 + 证据链 schema):
- `factualContradiction`: 同章/跨章对**同一事实给出冲突值**(数值: 船钱1↔3文; 世界规则: "独条船"↔"上月坐别家船"; 属性)。证据=两处引文 + 冲突点。
- `transitionGap`(又名 unestablishedPresence): 角色**未经建立移动/进入即出现在某地**(柳青舟"从听雨茶楼出来"而前文无其入场)。证据=出现处引文 + "前文无 X 入场/移动"。
- 保守二元·宁漏勿误·好章必 0(同 stateRestate 标准)。

**A2. 量开篇专项发率**(judge 跑, Opus subagent):
- 扫: gen3(archived)+gen4+各 killed 世界的 **ch1–5**, 分别出 `factualContradiction` / `transitionGap` 的**逐章发率**; 另抽中段(ch50+)同量做对照。
- 关键判据: **ch1–5 发率 vs 中段发率**。预期 ch1–5 显著更高(机理预测)。
- 落 `.audit/20260612-consistency-research/opener-prevalence.md`。
- **投资门槛(开篇加权)**: ch1–5 任一类 ≥ ~8%(开篇按重要性加权·每世界唯一·最多人读, 门槛低于中段 3%) → 进 Phase B; 否则停在判官 CLI 分诊。

---

## Phase B — 开篇事实底牌 OFS(若 A2 过门槛)
**B1. OFS 生成器** `app/opener-facts.ts`(新·零随机·确定性为主):
- 输入: `worlds/<saga>.json` + scout 选弧产物(主角/起笔情境/起点地点)。
- 输出紧凑 schema(数据条, 非散文):
  ```
  【本世界既定事实·须遵守(勿改名/勿换数/勿与之矛盾)】
  角色: 柳青舟=摆渡门·渡口船家; 苏小棠=杏林堂·药师; 陆云归=酒剑游侠; 沈无尘=烟雨楼
  地点(规范名·勿造异名): 渡口/听雨茶楼/杏林堂/水月庵/石梁古桥/长街集市/运河码头
  起笔情境: <scout 情境一句>
  ```
- 选配(一次性·世界创建时·light-LLM 抽 3–5 条硬不变量, 缓存进 worlds json): 如物价基准/谁住哪/渡口规模。**默认不开, A2 若显示"规则型矛盾"多再加。**

**B2. 注入** `app/longrun.ts`:
- gate: `const OPENER_FACTS = GENTLE && process.env["NOVEL_OPENER_FACTS"]==="1"`(:58 区, 默认关)。
- 仅 `n <= Number(process.env["NOVEL_OPENER_CH"] ?? 5)` **或** canon.json 未满(`loadCanon` 角色<阈)时注入——开篇专用, 文本 canon 起来后自动让位, 不与 canonHard 重复。
- 注入点: buildSecPrompt(:335)加 `openerFacts` 块, 放 prompt **边缘**(贴 canonHard 后), 每段都带(4 段共享同一真相源)。空则整块坍缩。

**B3. 章内矛盾守卫**(扩 FACT_LEDGER v2·非新机制):
- 现 `statedLines`(:374)只记"已说台词"防复述。加一条**数值/规则事实轨**: 段后零 LLM 抽 `(船钱|价|文|枚|两|里|条|个)` 量化断言 + 其绑定名词, 记入 `statedFacts`。
- 下段注入由"勿复述"扩成"**已交代 X=数值/规则, 后文不得写成冲突值**"(防 1→3 文)。仍数据型。
- 转场守卫: 复用已有"已到过/已出场"块(:335 GENTLE 段), **加反向条**: 角色首次出现在某地点须经移动/入场动词, 不得直接"从<未入场地>出来"。

---

## Phase C — 验证(A/B 舰队·不碰 gen4)
fresh 双臂各起新世界, 各写 ch1–8(开篇区为主):
- 臂A = `NOVEL_OPENER_FACTS=1` + 矛盾守卫 / 臂B = 对照(现栈, 即现含 FACT_LEDGER=2)。
- **主轴**: 判官(扩类后)测 ch1–5 的 factualContradiction + transitionGap 发率, A 须显著 < B。
- **副作用轴(必量·防新退化)**: d1c 套语率(OFS 是数据应 benign·须证)、节律均质度、章长。
- **采纳门槛**: 矛盾/转场↓ 且 d1c 不炸(A≤B×1.3 且峰<16)→ 递人签设默认。否则改 schema 或搁置(同 v1 留档)。
- 四道闸: esbuild + tsc + golden(未开 gate 逐字节同) + **产线 env canary**(`NOVEL_OPENER_FACTS=1 NOVEL_STYLE=温润 …longrun.ts` sleep10 探活)。

---

## 投资优先级(本增量内)
| 项 | 档 | 依据 |
|---|---|---|
| A1 判官扩两类 + A2 量开篇发率 | **P0 必做** | measure-first·解锁判断·低成本 |
| B OFS seed(配置→ch1 注入) | **主攻(若 A2 过)** | 机理最对位·数据型避套语·配置现成 |
| B3 章内矛盾守卫(扩 FACT_LEDGER) | 主攻 | 复用现机制·治 1→3文/瞬移 |
| 选配 light-LLM 世界规则抽取 | 可选 | 仅当 A2 显示规则型矛盾多 |
| 开篇专属解耦 verify pass(P2 研究项) | 待定 | 最难章性价比高, 但加成本, B 不够再上 |

## 永久不做(研究确认·别回头试)
FULLCTX 全上下文 / 同模型自批改 rewrite 结构 / coref 类零误杀确定性闸 / 为<门槛发率上常驻机制 / 把开篇 noise 当中段病去调风格。

## 诚实边界
- OFS 治"改名/换数/角色错位/瞬移"很对位, 但**涌现型新规则矛盾**("独条船"这种非配置已有、是 ch1 现编的规则)只能靠 B3 章内守卫接住其"同章被推翻"的部分; 真要预防需选配的世界规则抽取。
- 判官扩类后须自测: 开篇病例(gen4 ch3 三 bug)命中、好章 ch1 不误杀, 再用于量发率。
- 一切先过 Phase A 发率门槛再投 Phase B——别因单章 gen4 ch3(n=1·in-medias-res 最吵)直接建。
