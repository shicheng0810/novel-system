# 温情世界「纯生活流·零张力」可落地蓝图（huolang v2ch1 评测退步 45-65%）

> 综合 6 路产出：A1 六章证据对照 + A2 机制溯源 + A3 非冲突张力理论 + A4 检测器实测校准 + D 修法设计 + **R 对抗评审（本蓝图以 R 裁决为准）**。
> **根因一句话**：纯涌现温情世界的**唯一故事祈使通道（weave）四源全灭**（伏笔 ch6 起、T2/T2' 死于 `if (stageGoal)` 门对无 outline 世界永久关闭、emerge 算出即丢、arcHint 陈述与真 db 矛盾的假事实被 LLM 整条丢弃），叠加 **beatSpec 把爽文版因果链整句删除**（= 按结构定义生产可乱序 vignette）与 **persona 无缺点槽**——于是 2713 字里 0 个有代价选择、1 处摩擦、给予的代价被叙述者主动洗掉，纹理层再叠"满而平 + 克制模板超密 + 顶针双写"。叙事层四病是旧 lint 体系完全不覆盖的盲区；**治本在生成端**（beatSpec 补槽 + weave 兜底轮盘 + persona 缺点轴），检测器只有 D7（同物二卖）够格上线。
> 行号基于 2026-06-09 当前文件实读核验（beatSpec=longrun.ts:215-217，weave 门=:498，arcHint=:321）。

病例/对照（全部实读，绝对路径）：
- 病例：`.novel-output/huolang/chapters/ch-0001.md`（v2ch1 杏花村，外评 AI 味 45-65%，**退步**）
- 正样本：`.novel-output/huolang-killed-20260609-202758-v1/chapters/ch-0003.md`（v1ch3 茶亭借道，25-45%，"最像人写"）
- 对照：同目录 ch-0001/0002/0004（v1ch1 30-55%、v1ch2/v1ch4 未单评）
- 校准好章：`.novel-output/renjian/chapters/ch-0104.md`、shanju ch3

---

## 一、问题实证（评测五点逐条验证 + 六轴可计算共性）

评测五点 → 验证结论（A1 全部人工编码 + 脚本实算 `/tmp/a1-analysis.ts`）：

| 评测点 | 判定 | 铁证 |
|---|---|---|
| ② 无目标无摩擦纯生活流 | **成立·最重** | v2ch1 有代价选择=0、摩擦=1（唯一未遂交易=王婆婆拒头油）、欲望-阻碍结构=无；v1ch3 是 5/7/清晰 |
| ④ 主角好得太标准 | **成立** | 16 项行为清单：利他 6、中性 9、**利己 0、缺点 0**；叙述者两次替他洗成本（混两块整糖不说、"碎冰糖不值钱搁着也是化了"）；唯一犹豫(#7)推到章前由他人化解 |
| ③ 顶针交易写两遍 | **成立** | 同一需求线两套完整仪式（招呼→问顶针→翻布包/油纸包→拣一枚试合→数文钱→温情收尾），零递进零差异；"顶针"×7/2713 字（好章 1-2 次）；且"开篇老妇买顶针"是发生器级套拍（v1ch1/v1ch3/v2ch1 三章同位开场）、"塞鸡蛋"×3 章 |
| ① 细节太均匀太满 | **成立** | 段级密度均值 4.34（v1ch3 的 1.8 倍）、密度 CV 0.64（v1ch3 1.21 的一半）、零密度素段 14%（v1ch3 45%）、段长 CV 0.54 最齐——"满"与"匀"双轴同证 |
| ⑤ 克制模板高频 | **成立** | 全 family 4.42/千字（v1ch3 2.66）；评测点名的微笑+嘴角正形族 1.47/千字 = v1ch3 的 3.1 倍（v1 各章均 ≤0.52，唯 v2ch1 越线） |

**六条独立可算轴在三个有评分章上全部与 AI 味同序**（35%→42.5%→55%）：

| 轴 | v1ch3(35%) | v1ch1(42.5%) | v2ch1(55%) | 方向 |
|---|---|---|---|---|
| 有代价选择 | 5 | 1 | 0 | 反向单调 |
| 摩擦（被拒/受挫/自悔） | 7 | 4 | 1 | 反向单调 |
| 主角纯给予拍/千字 | 0 | 0.25 | 1.11 | 正向单调 |
| 克制族/千字 | 2.66 | 4.17 | 4.42 | 正向单调 |
| 段级密度 CV | 1.21 | 1.28 | 0.64 | 反向 |
| 零密度素段占比 | 45% | 45% | 14% | 反向 |

最锋利的差异是**给予的代价反转**：v1ch3 每次给予都带代价（白棉布"是他备着给主顾裹瓷器的，从没拆过"、红枣糕自己舍不得吃还先被拒收）；v2ch1 的叙述主动消解代价——给予被写成零损失，于是既无选择也无摩擦。理论锚（A3）：张力≠冲突，Sternberg 三种阅读张力（悬念/好奇/重着色）与汪曾祺式"欲望与人情的微观力学"全部无需对抗；正样本的全部优点（撒谎→"太多了"自悔→折返→受恩别扭"你话真多"）可在零危险张力源里复刻——**温情红线无需破**。

---

## 二、机制根因（为什么 ch1 滚成生活流）

**先校正假前提（A2 颠覆性事实）**：v1/v2 的 sim 层是逐字节孪生（确定性 seed，scout 选弧日志逐字相同），"v1 接住了 arcHint、v2 没接住"为假——两版 ch1 对 arcHint 的沈知/茶山提及都是 0；v1ch1 的柳萱线来自 **crisis**（"柳萱受伤遭同门误解，货郎卷入门派纠葛"，tick60 起两版同在）。同料不同 roll：temp 0.9 的 outline 在**无任何叙事祈使**时，取不取张力素材纯属掷硬币。修法目标 = 把掷硬币换成有任务源。

**1. 叙事任务源四源全灭（其中两源对纯涌现世界永久死）**——weave 链 longrun.ts:466-499，注入点 :219【本章叙事任务·须落实】是全 prompt 唯一故事祈使通道：

| 源 | ch1 状态 | 根因 |
|---|---|---|
| 伏笔回收 | 死 | foreshadows.json 不存在，首笔 ch6 |
| 伏笔埋设 | 死 | `n%6===0` 最早 ch6 |
| T2 进展任务 | **永久死** | :498 `if (stageGoal)`——huolang 纯涌现世界无 outline-plan.json → beatForChapter 恒返 ""，**整个世界生涯进不去** |
| T2' 涌现际遇 | **永久死** | :497 emerge 每章被算出后直接丢弃（只作 nextProgressTask 第 5 参在死门内消费） |

**2. beatSpec 过度矫正（longrun.ts:216）**：最大过矫 = 把爽文版"每拍须是前一拍的直接后果（因→果→再生变）"**整句删除而非温润化**——因果≠冲突，删它等于按结构定义生产四拍可互换的 vignette（顶针交易出现两次的结构根源）；节拍菜单全是非事件单元（相遇/心境/行脚），没有"一个选择/一桩为难/一次小代价"的槽位；"多写观察与细微的触动"把主角钉成摄像机；"不必留悬念"连软钩（未尽之事/将至之客）也一并禁了——每章成密封气泡，不欠债不传债。

**3. arcHint 框对冲料 + 陈述假事实（:321）**：90 字温情框（寻常当口/不在冲突里）是祈使句、11 字弧线本体是从句；更硬的是真世界 db 至 tick112 **零灾变事件、沈知活着在场 bond+6**，scout 里杀死他的 story-80 在真世界从未触发——arcHint 给 ch1 注入了与同 prompt 内 roster+canonHard 相矛盾的假事实，LLM 合理地丢弃了它（v1/v2 皆然）。

**4. persona 无缺点槽（persona.ts:28-45）**：digest 槽位 = attrs+历练+inner+牵系+avenge+mind，没有"短处"；sim 侧 innerDrive 全员 ambition（drives 只长 ambition）→ 全员"执念在心；语气直、少寒暄"近乎单腔；sim 里现成可映射缺点的状态（narrativeStress 0.54-0.68、resource 周拾安 10 vs 沈念卿 76、负 bond）全未被映射。PENMANSHIP 的"容瑕疵"只授权文句节奏瑕疵，不授权人格瑕疵。

**5. 量化总账**：ch1 outline prompt 指向张力的素材 ≈35 字（全陈述、0 祈使），指向温情舒缓 ≈520 字（几乎全祈使、3 处"要紧"）——**质量比 1:15、祈使句 0:20**。sim 在 ch1 前夜产了正合用的中频戏料（tick80-82 托付/道争交锋 StageCommitted），但 :442 upsets 滤镜只收灾变级、gentleEmergence 自禁 clash——**呈现是全有或全无：灾变（被温情禁）或空白；中频带正是 sim 在产、作者层在丢的那段**。

---

## 三、修法清单（经 R 评审裁决后的最终版）

> 全部 app 层、不动 core/sim；全部 GENTLE-gated，爽文逐字节零变。新增 prompt 文本内引号一律全角『』（）（tsx 假绿教训）。零 Math.random / 零 Date.now，全部 n 取模或命格/c.id 散列，resume 安全。
> **评审裁决要点已并入**：1b 加 n%4 呼吸跳章（摩擦总预算，防"处处硌牙"的新均匀病）；修2 每格双措辞 c.id 散列**现在就落**+『勿照搬字句』句+声口卡毛病限 heat 前 2 人；修4 整体缓行至第二波（canary 触发）；4b(iii) 删除并入声口卡头；token 自报数失实已重算（见五·A/B 决策）。

### 修1 · 叙事最低限机制（治评测②·最大杠杆）

**1a · beatSpec 补槽** — `app/longrun.ts:216` GENTLE 分支整串替换（:217 爽文串不动）：

```ts
    ? `列出本章 ${SECTIONS} 个叙事节拍(每个≤20字)：首拍由上章余韵自然承接；节拍可是一次相遇或对话的展开、一段心境或回忆的流转、一程行脚或一桩寻常事的经过、一桩小为难或一个要付一点小代价的选择，前后气脉相承、连贯不跳，不必每拍生新冲突；但每拍过后须留下一样带得走的东西（一句应承、一份欠情、一桩新知道的事、一个没说出口的念头），后拍须用到前拍留下的东西——节拍打乱重排便不成立，才算连贯；${SECTIONS} 拍中至少一拍须有一点不顺：一样想要而未全得的东西、一次小失手（话多半句、礼数错一着）、一回不对等的人情推让、一笔叫人心疼的小账——温情的张力来自人心微澜与人情推拉，不来自打斗危机，其余拍照旧温润；同类小事（同一货品的买卖、同样的赠收）一章至多一回，若再现，第二回必须出岔子或变了意思，不得原样重演；但全章不可困守一处一物——须有人事、场景或时令的自然流动（一次出门、一个来客、一段路、一场天时之变都好），少让主角独对同一件旧物反复出神；多写人来人往与世态人情、人物自己的小算盘与取舍，而非只作旁观；${outlineBeat ? "本阶段内主角处境宜较阶段开端有所挪移(多识一人、多走一程、道行或心境长进一分、近一桩牵念)、顺这条人生主线缓缓向前；不必每章都动、容得下纯质感的呼吸章；这一步绝不靠任何冲突/争斗/危机/失去来体现、" : ""}末拍以一个安静的画面或一点余味收束、不必留硬悬念，但容得下一桩未尽之事、一位将至之客、一句没说完的话作余韵的软钩。全章须有一处稍密或稍疾的段落(一段世俗白描信息密些、或一句短促的话、一桩骤来的小事)与通篇舒缓相对位、勿全程一个速度。只列 ${SECTIONS} 行节拍。`
```

六处改动：①菜单加"小为难/小代价选择"一席 ②残留律+乱序测试=温润化恢复被删因果链（因果≠冲突） ③"至少一拍不顺"= A1 最强反向单调轴的直接处方（措辞全走 A3 词族：岔子/不顺/推让/心疼/没赶上） ④同类小事至多一回（评测③ outline 层防线） ⑤"观察"→"小算盘与取舍，而非只作旁观" ⑥只禁硬悬念、放行软钩。

**1b · weave 空窗确定性轮盘（评审版·带呼吸预算）** — `app/longrun.ts`。:46（EDIT_PASS 行）后插：

```ts
const MICRO_TENSION_ON = GENTLE && process.env["NOVEL_MICRO_TENSION"] !== "0"; // 修1b: 纯涌现世界 weave 兜底轮盘(默认开)
// 日常张力轮盘(A3 十源 taxonomy): 纯涌现世界(无 outline-plan→stageGoal 恒空→T2/T2' 永久死)的 weave 兜底。
//   按 n 确定性轮换(禁随机/时钟, resume 安全); 措辞回避冲突词族, 与 beatSpec『绝不靠冲突』共存; 仅 GENTLE。
//   评审裁决: n%4===0 章跳过(呼吸章·摩擦总预算)——否则每章固定多源强制摩擦=把『处处圆润』换成『处处硌牙』, 同样是均匀病。
const MICRO_TENSION = [
  "给主角一桩具体的小想头（一样物、一口吃食、一句想听的话），本章想要而未全得——或得了，却晚了一步、贵了一截",
  "凡赠与收受须有一来一回的推让且有人『输』——收下的人记下一笔，或回敬一样不对等的东西；勿一递即收、一谢即完",
  "安排一桩在场者彼此心知却都不说破的小事，对话全在别处打转——不许任何人把它点明",
  "本章须有一次小失手：话多了半句、礼数错了一着、借口当场被人看穿——写当事人自己的窘，不写旁人的谅解",
  "钱要见数目（几文、几升、抹掉的零头）；给出去的东西先疼一下再给；白送须有不白送的理由",
  "让营生带来一次轻慢（被压价、被当下人使唤、被玩笑学舌），主角受了、赔笑或回一句软中带硬的话——不愤怒、不升级、也不指望对方悔悟",
  "给本章一只看不见的钟（天黑、落雨、收市、糕要凉），让至少一件事赶上或没赶上它",
  "让主角揣一件不能说的小事，章内至少两次差点被问到——他岔开了，本章不揭穿",
  "主角今天有一件想办成的具体小事（一句话说得清、当天见分晓），章内须不顺手一次，章末见分晓——成了、没成、或成了一半",
  "好意不许顺利落地：受的人先挡一下，或受了之后别扭地还一手（一句不领情的话、一样硬塞的回礼）",
];
```

:498 改为 if/else：

```ts
      if (stageGoal) weave = nextProgressTask(pledger, n, stageGoal, prevStage, emerge);
      else if (MICRO_TENSION_ON && n % 4 !== 0) weave = `${MICRO_TENSION[n % MICRO_TENSION.length]!}${emerge ? `。世间近来有这些动静，可拾一二自然融入：${emerge}` : ""}`; // 纯涌现世界兜底: stageGoal 恒空+emerge 算出即丢——一并接活; n%4===0 留呼吸章
```

只在 stageGoal 为空（纯涌现世界）触发——**renjian/yunyou 跟纲世界零变**（评审实证：beatForChapter 超计划末返回 last.goal 非空，else 永不触发；gap<8 呼吸章继续留空）；伏笔章 weave 已占不触发；weave 经 :219 outline + :253 第 2 段"本段须自然落实"双注入。回滚：`NOVEL_MICRO_TENSION=0`。

**1c · arcHint 措辞修正** — `app/longrun.ts:321` GENTLE 分支（:322 爽文不动）：

```ts
      ? `世界已暗中走过一程、结下些人情旧识。本章从眼下一个寻常而有人情味的当口徐徐写起——读者一翻开就在人情与气息里、不在打斗或危机里，但正当主角一桩小为难、一个要不要伸手的当口；从容入场、不急着交代前情，前事留待后文细补。眼下牵系（若它与下方在场人事、生死事实相左，则以在场事实为准，只取其情味与方向）：${pick.arc.desc}`
```

治"框对冲料"（不在冲突里→不在打斗里但正当为难当口）+ 假事实免疫（自带降级条款，arc 与 canonHard 矛盾时 LLM 不再整条丢弃而是取情味方向）。c-full（真 db 校验弧线事实 + 中频 StageCommitted 新通道）评审同意**缓行 Batch-δ**。

**Gate/token/风险**：三处全 GENTLE 分支。token：beatSpec +289（×1）+ 轮盘 ~110×2 注入（3/4 章触发）+ 1c +30 ≈ **+480-540 字/章**。风险：漂向苦情——floor 是微澜级 +"其余拍照旧温润"，sim 层 conflictRate/tuning/drama 零接触；轮盘模板化——十型异质周期 10 + n%4 跳章 + env 退路。

### 修2 · 人物小缺点轴（治评测④·评审节食版）

**2a · `app/persona.ts`**。顶部（:5 `import type { Canon }` 后）加 `import { natalLabel } from "./pack-select";`（已核验无环：pack-select 只 import packs+core 类型；freeform 包复用 xianxia 十神，huolang 命中无歧义）。:25（deriveVoice 末）后插：

```ts
// 小毛病轴(评测④『好得太标准』治本): 命格十神→随身小毛病。缺点=美德的影子(同源律, A3): 务实的影子是心疼钱、自立的影子是嘴硬——人物不裂。
//   胎记式跨章稳定(同一缺点换处境重现>每章换新毛病); 另按 narrativeStress/resource 叠状态毛病(疲惫/拮据), 随 sim 起伏=露法天然轮换。
//   每格 2 措辞按 c.id 字符和散列选(评审: 成品文案单串会被 LLM 逐字搬运成 prompt 回声=新 tic); 确定性零 LLM、resume 安全; 仅 GENTLE 消费。
const PATTERN_FLAW: Array<[string, [string, string]]> = [
  ["比肩", ["嘴硬不肯受人帮衬，担子再沉也说不沉", "逞强，累了伤了也不肯让人搭手"]],
  ["劫财", ["见不得同行俏，嘴上不说、暗暗较劲", "好胜，听人夸别家手艺就不自在"]],
  ["食神", ["贪一口嘴，能拖则拖", "嘴馋手散漫，捎带的吃食总想先尝一口"]],
  ["伤官", ["忍不住点破人短处，话到嘴边收不住", "眼尖嘴快，见活计粗糙就要说，不留情面"]],
  ["偏财", ["轻诺，应承下来转头银钱不凑手", "大手大脚记不住账，月底对不上数"]],
  ["正财", ["心疼钱，白给了东西半天还在心里拨那几文", "抠细账，抹个零头也肉疼"]],
  ["七杀", ["急性子，对磨叽的人应声一声比一声短", "性急等不得人，话没听完就接茬"]],
  ["正官", ["规矩大过人情，多收一文也非找回去不可", "古板认死理，人情面前不肯通融"]],
  ["偏印", ["多心，小账记得很久", "疑心重，旁人一句闲话琢磨一路"]],
  ["正印", ["心软不会拒绝，回头又怪自己", "耳根软，明知吃亏也驳不开情面"]],
];
function flawSeed(id: string): number { let h = 0; for (const ch of id) h = (h + ch.charCodeAt(0)) & 0xffff; return h; }
function deriveFlaw(c: CharacterState): string {
  const natal = natalLabel(c);
  const cell = PATTERN_FLAW.find(([p]) => natal.includes(p))?.[1];
  const base = cell ? cell[flawSeed(c.id) % 2]! : "";
  const stress = typeof c.narrativeStress === "number" ? c.narrativeStress : 0;
  const res = numOf(c, "resource");
  const overlay = stress >= 0.6 ? "近来乏得很，耐心比平日短" : res > 0 && res <= 12 ? "手头紧，一文钱掰着花" : "";
  return [base, overlay].filter(Boolean).join("；");
}
```

**2b · 两点注入**：
- voiceCardBlock（:68-73 整函数替换，secPrompt 通道——A3 关键协同"该接话处接什么"，缺点轴顶掉克制套语；**评审节食：毛病只给 heat 前 2 人**；头部并入原 4b(iii) 授权 + 防回声句）：

```ts
export function voiceCardBlock(snap: WorldSnapshot, limit = 4): string {
  const present = Object.values(snap.characters).filter((c) => c.present);
  const top = [...present].sort((a, b) => charHeat(b) - charHeat(a)).slice(0, limit);
  const lines = top.map((c, k) => {
    const v = deriveVoice(c);
    const f = k < 2 ? deriveFlaw(c) : ""; // 评审节食: 毛病只给 heat 前2人(token)
    const seg = [v, f ? `小毛病：${f}` : ""].filter(Boolean).join("；");
    return seg ? `${c.name}：${seg}` : "";
  }).filter(Boolean);
  return lines.length ? `【在场者声口与小毛病·对白随各人声气变、勿千人一腔；毛病全章合计只漏两三处、半句话级，漏完即收：不解释、不找补、不让旁人夸『其实心好』、叙述者不替他把代价洗掉；勿照搬此处字句，须换措辞换场合露】\n${lines.join("\n")}` : "";
}
```

- personaDigest（:41-42，outline 通道）——**仅 token 方案 B 批准时落**：:41 后加 `const flaw = gentle ? deriveFlaw(c) : "";`，:42 parts 数组在 av 与 voice 之间插 `flaw ? "小毛病：" + flaw : ""`。方案 A 则跳过此点（评测④只治一半）。

**Gate/token/风险**：deriveFlaw 只被 gentle=true 的 digest 与 voiceCardBlock（仅 longrun:463 GENTLE 路径调用）消费，爽文恒""。token：声口卡版 ≈+350 字/章，+digest ≈+480（B）。风险：同一毛病跨章重现是设计意图（胎记）；防 tic 三重=双措辞散列+状态 overlay 随 sim 起伏+头部防照搬句；canary 若仍见同句式复读 → 升每格 3 措辞。innerDrive 全员 ambition 的 sim 侧单调被命格轴绕开（pattern 随生辰种子分布）。

### 修3 · 同类事件去重（治评测③·A4 已校准，评审"过"）

**3a · `app/lint-seams.ts` 新增 D7 + tradeAskedItems**（A4 草稿逐字落地，879 章 0 误杀 1 真阳，不重写不微调）。插在 :192（d6Trades 末）与 :194（主入口注释）之间：

```ts
// ── D7 同类交易重复(评测症③: 顶针交易短篇幅出现两次——AI抓住「货郎卖顶针」元素又写一遍) ──
// 校准: 879章扫描命中1=唯一真阳性(huolang-v2 ch1 顶针×2)·假阳性0; v1ch3两次递药(递进无求购锚)/v1ch1桂花转赠链/renjian104单次赠物均静默。
// 结构病(revise只删不增救不了同物二卖·与0.85长度地板互斥)→ flags-only; 治本=生成端跨段已写账(tradeAskedItems)。
const T_FUNC = /[你我他她它您谁这那是的了么吗呢不没有可到些什何甚多少上回去来过就也都又被把和与在个两要带还问说想能买起搁]/;
const T_STOP = new Set(["东西", "动静", "声音", "声响", "响动", "影子", "人影", "一下", "工夫", "时辰", "法子", "消息", "缘故", "动作"]);
const T_ASK = /(可有|可曾有|有没有|有(?![什甚])[一-龥]{1,4}[么吗](?=[。？！”…\s]|$)|上回[^。！？\n]{0,3}[说托][^。！？\n]{0,4}的?|托[你我][^。！？\n]{0,2}[带捎问]|能配的|想买|要买|给我[来带]|缺(?![什甚])[一-龥]{1,4}[么吗](?=[。？！”…\s]|$))/g;
const T_CORROB = /(递|搁|拣|摸出|翻出|掏出|拿出|接过|塞|收了|收进|铜板|铜钱|[一二两三四五六七八九十]文|多少钱|价钱)/;
function tradeGrams(s: string, names: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of s.match(/[一-龥]+/g) ?? []) for (const L of [2, 3]) for (let i = 0; i + L <= r.length; i++) {
    const g = r.slice(i, i + L);
    if (T_FUNC.test(g) || T_STOP.has(g) || names.some((n) => n.includes(g) || g.includes(n))) continue;
    out.add(g);
  }
  return out;
}
function d7TradeRepeat(body: string, names: string[], len: number): { hits: string[]; clusters: number } {
  type TW = { at: number; items: Set<string>; snip: string };
  const raw: TW[] = [];
  for (const m of body.matchAll(T_ASK)) {
    const at = m.index ?? 0;
    const rest = body.slice(at, at + 42);
    const e = rest.search(/[。！？\n]/);
    const win = e < 0 ? rest : rest.slice(0, e + 1);
    if (!T_CORROB.test(body.slice(Math.max(0, at - 220), at + 260))) continue;
    raw.push({ at, items: tradeGrams(win, names), snip: win.replace(/\s/g, "").slice(0, 16) });
  }
  raw.sort((a, b) => a.at - b.at);
  const cl: TW[] = [];
  for (const w of raw) { const last = cl[cl.length - 1]; if (last && w.at - last.at <= 300) { w.items.forEach((g) => last.items.add(g)); continue; } cl.push(w); }
  const hits: string[] = []; const seen = new Set<string>();
  for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
    if (cl[j]!.at - cl[i]!.at < 500) continue;
    for (const g of cl[i]!.items) if (cl[j]!.items.has(g)) {
      if ([...seen].some((s) => s.includes(g) || g.includes(s))) continue;
      seen.add(g);
      hits.push(`同物二卖: 「${g}」@${(cl[i]!.at / len * 100) | 0}%(${cl[i]!.snip}…)已被点名求购/成交, @${(cl[j]!.at / len * 100) | 0}%(${cl[j]!.snip}…)又一次求购/配卖`);
    }
  }
  return { hits, clusters: cl.length };
}
// 生成端已写账助手(longrun 段循环注入 covered): 只取求购句±220字语境出现≥2次的"真被经手"物品, 每段至多3件防prompt膨胀。
// 实测: v2ch1段1→[顶针]·段4→[顶针](段4 prompt 带"已售过顶针"禁令=直接掐死本病例); v1ch1/shanju3→[]零噪声。
export function tradeAskedItems(text: string, names: string[] = []): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(T_ASK)) {
    const at = m.index ?? 0;
    const rest = text.slice(at, at + 42);
    const e = rest.search(/[。！？\n]/);
    const win = e < 0 ? rest : rest.slice(0, e + 1);
    const ctx = text.slice(Math.max(0, at - 220), at + 260);
    if (!T_CORROB.test(ctx)) continue;
    for (const r of win.match(/[一-龥]+/g) ?? []) for (const L of [3, 2]) for (let i = 0; i + L <= r.length; i++) {
      const g = r.slice(i, i + L);
      if (T_FUNC.test(g) || T_STOP.has(g) || names.some((n) => n.includes(g) || g.includes(n))) continue;
      if ((ctx.split(g).length - 1) >= 2 && !out.some((c) => c.includes(g) || g.includes(c))) out.push(g);
    }
  }
  return out.slice(0, 3);
}
```

接线：:13 `SeamResult.metrics` 加 `tradeReps: number;`；lintSeams 内（:205 d6 行后）加 `const d7 = d7TradeRepeat(body, names, len);`；:210 flags 行追加 `...d7.hits`（**flags-only 是评审独立复核后的唯一正确分流**：二次成交≈全章 11% 与 0.85 长度地板互斥，入 issues 只会造无效精修循环）；:213 return metrics 加 `tradeReps: d7.hits.length`。

**3b · 生成端已写账（治本）** — `app/longrun.ts` GENTLE covered 块内（:269 metNames 累积行后）：

```ts
      for (const it of tradeAskedItems(clean, knownNames)) if (!covered.some((c) => c.includes(`【${it}】`)))
        covered.push(`已点名求购/售卖过【${it}】——后文段落不得再写它的第二次完整成交；若必须再现，须出岔子或变了意思（被嫌贵、尺寸不对、赊了账），不得原样重演求购—翻找—试合—付钱的节拍；上文若有一桩尚未收尾的交易，照常写完不算重演`);
```

两处对 A4 草稿的有意偏差（D 设计、评审认可）：①人名滤表用 knownNames（roster 全集）滤得更全；②禁令从硬禁放宽为"禁原样重演、再现须变味"——对齐 A3#9 正解（v1ch4 阿九两次拦路是"重复但递进"，不毛病）；尾句"未收尾照常写完"= 评审建议的跨段交易护栏。

**日志（评审必修小项）**：longrun.ts:193 条件 `if (seams.metrics.d1cPairs > 0)` → `if (seams.metrics.d1cPairs > 0 || seams.metrics.tradeReps > 0)`，串尾追加 `${seams.metrics.tradeReps ? " 同物二卖=" + seams.metrics.tradeReps : ""}`。

**Gate/token/风险**：lintSeams 只在 EDIT_PASS（GENTLE-only）路径跑；tradeAskedItems 在 `if (GENTLE)` 块内，爽文 covered 恒空=零变。token 摊销 ≈+60 字/章。已知召回缺口（单字货品糖/盐不跟踪）是精度优先的有意取舍（朴素版在好章上 18-50 处误杀的反面教训）；beatSpec④ 在 outline 层补同一防线。

### 修4 · 详略势利+扎手+容粗+微表情（治评测①⑤）——**评审裁决：整体缓行至第二波**

触发条件：canary 盲测后评测①（均匀太满/无锋利）仍被点名，或⑤残留（克制全族≥4/k 或 smilePerK≥1）。理由：正样本茶亭借道产自旧纹理代码——"像人"来自故事形状非详略 prompt 工程；修4 最贵（仅它 +8-9% prompt）、A4 已证无机检疗效仪表、tic 新风险最多；且 4b(ii) 原版与既有【过场要快·详略有别】同轴重叠=注水。第二波落地时用以下**改写式并入版**：

- **4b(i)** 微表情禁令（净增 ≤80 字）：PENMANSHIP（longrun.ts:43）【克制从内容来】句尾 `…其余处让人物直接动、直接答。` 后接：`『笑了一下／笑了笑／嘴角弯了一下／看了两眼没说话／点了点头』这类微表情同属此类模板——全章合计两三处为度且不重样，人物高兴就让他说一句具体的话、做一件具体的事。`
- **4b(ii)** 改写既有【过场要快·详略有别】块吸收容粗/记账式（净增 ≤120 字）：原块整段替换为 `【过场要快·详略势利】递物收物、拨火添柴这类过场点到即止、能略则略，不把一个小动作分解成『伸手—碰—停—搁』四拍；全章只挑两三处下重笔细写（贴着此刻最要紧的人与事），其余过场用一两句白话记账式带过（『一上午只开张三回，都是小钱』即可）、不配感官细节；容得下一两段不加修饰的短陈述句，段尾不缓冲、接得硬些也不要紧；笔墨集中到这一章真正要紧的一两件事上，过场快、核心慢——忌每一处都磨得一样圆润，处处圆润即处处平庸。`
- **4b(iii)** 【人无完人】独立块**删除**（授权已并入修2 声口卡头，双份=注水）。
- **4a** 扎手轮换（带评审两守卫）：模块级 `const SHARP_KINDS = ["一句不客气的实话（有人抢白、戳破、煞风景，说完不圆场）", "一个不合时宜的细节（好景致里一样不体面的实物：补丁、价钱、馊味）", "主角心里闪过的一个不厚道或自顾的小念头（写出即收，不解释）"];`；段循环内 `const sharpHere = GENTLE && beats.length > 1 && n % 3 !== 2 && i === (n % (beats.length - 1)) ? SHARP_KINDS[n % SHARP_KINDS.length]! : "";`（**评审修正：beats.length>1 防 SECTIONS=1 落末段 bug；n%3!==2 跳章=2/3 覆盖，让"有无锋利"本身成为章间方差**）；secPrompt（:253）recentImgs 块后插 `${sharpHere ? `\n【本段藏一处扎手·全章只此一处】${sharpHere}——写出即收，不解释、不找补、不让任何人（包括叙述者）替它圆场；其余处照旧温润。` : ""}`。**watch 项**：伤官毛病（点破人短处）与扎手第 0 型同章双触发=双份"戳破"，canary 见到则给扎手轮换跳开型 0。
- **4c** 修订保护令（随 4a 同批）：`app/edit-ledger.ts:99` buildRevisePrompt"必须保住这四样"句尾追加 `；⑤句中带刺处（一句不客气的实话、一个不合时宜的细节、一闪而过的不厚道小念头）与记账式粗笔段（短陈述句直接交代、不加修饰、段尾不缓冲）——它们是有意的取舍与锋利，不得删除、不得补润饰、不得给它们加缓冲或圆场`（防精修端磨平生成端立的锋利——工序梯度互搏是 yunyou 四症已证常态）。

### 修5 · 观察信号——**不进 warm-fitness，只进 lints 记账**（评审"过"·必须维持）

`app/edit-ledger.ts` :39 RESTRAINT 旁加（A4 草稿逐字）：

```ts
const GESTURE_TPL = /(笑了一下|笑了笑|笑了一声|微微一笑|嘴角[一-龥]{0,3}[弯扯翘]|看了[一两]眼|点了?点头|摇了?摇头|应了一声|嗯了一声)/g; // 微表情族(metrics-only: 全族认证好章1.7/k vs 病例2.6/k分不开, 不设闸)
const SMILE_TPL = /(笑了一下|笑了笑|笑了一声|微微一笑|嘴角[一-龥]{0,3}[弯扯翘])/g; // 笑亚族(病例1.47/k vs 全语料≤0.52·n=1 先观察; 转正条件: 攒≥3个高AI味样本且阈值仍分得开才升 directive(议1.2/k+≥4次), 永不直接入 warm-fitness total)
const GIVE_TPL = /(塞给|塞进|塞过来|递过去|递给|分给|送[给了]|往外送|不收钱|不要钱|白给|帮[一-龥]{0,2}[忙着]|给[他她你您它])/g; // 给予密度(病例3.7/k=兄弟章2-4倍·测频率非代价·『给[他]』噪声大, 不设闸)
```

lintChapter（:69 restraint 行后）加三计算，metrics（:88）与 LintResult 接口（:44）同步加 `gestureTpl/smilePerK/givePerK`；EditLedger.lints 类型（:11）加可选 `smilePerK?: number; givePerK?: number`（旧账 JSON 向后兼容，cleanSignal 只读自家四维不受影响）；longrun.ts:190 落盘行带上两字段。

---

## 四、检测器裁决（A4 实测 + R 复核）

| 候选 | 裁决 | 依据（实测数字） |
|---|---|---|
| **D1 同类交易复写（D7）** | **上**（flags+metrics+生成端已写账） | 求购锚定版：884 章扫描、含交易簇章 246、命中 1=唯一真阳（v2ch1 顶针）、**误杀 0**（评审复跑确认）；朴素共现版在好章 18-50 处灾难性误杀（递进施药/转赠链），被求购锚天然排除。n=1 真阳=召回未证，但 flags-only 下漏报零成本 |
| 克制模板 family 扩词 | **不上闸**·metrics 观察 | 全族/k：病例 4.1 ≈ 更好的 v1ch1 4.2 ≈ 认证好章 shanju 3.7——任何阈值抓病例必杀好章；看了X眼/没急着是 house style。唯一可分亚信号=笑亚族 1.47/k vs 全语料 ≤0.52，但最 AI 的三章也是 0（测的是特定 tell 非 AI 味本身）且 n=1 → 按"n=1 校准=过拟合"纪律只进 metrics |
| 密度均匀度（W_texture） | **放弃** | 任务假设反向：病例感官 CV 0.531 全场**最高**、认证好章 0.281-0.308 最低（好文笔是均匀地感官丰润）；5 个代理（感官CV/微动CV/句长CV/抛光段/素段）在 6 点盲测阶梯无一单调——"太均匀"是叙事注意力层，词面统计摸不到，免重蹈 W_breath 覆辙（warm-fitness.ts:141 先例） |
| 利他无代价比率（W_stakes） | **不上** | 比率会冤杀：更好的 v1ch1=7.0 是病例 2.50 的 2.8 倍、shanju=3.0 也高于病例（代价词不分归属+好章分母为零爆表）。真信号只有给予密度本身（病例 3.7/k=兄弟章 2-4 倍）→ givePerK 进 metrics 观察，治本=修2 缺点轴 |

A1 六轴中"有代价选择/摩擦拍"需人工或 LLM 编码，不做机检闸——canary 用 A1 口径人工复评。

---

## 五、推荐落地序（评审最终版）

**前置决策（须用户拍板，两项）**：
1. **token 预算**：评审实测全案 +2950 字/章=+13-15% prompt 侧（设计自报 5% 失实），任何裁剪都到不了 3% 红线。二选一：(A) 守 3% → 修1+修3+修5+修2声口卡版（≈+900 字，评测④只治一半）；**(B·评审推荐) 批准放宽到 ~6% 上限** → 第一波加修2全量（digest+声口卡），第二波 4b(i)(ii) 改写版落地时仍在 6% 内。
2. **canary 授权**：huolang 是**活世界**（评审时 PID 98661 心跳新鲜、已写至 ch12+）——重开 v3 = 杀活写者，按家规（停止的世界别自启/单写者锁/yunyou 部署先例）**必须用户显式授权，不得自批**。

落地序（每步独立可 revert）：
1. **修5 + 修3**（零行为仪表 + 已校准检测器先上，让 canary 有表可读；:193 日志条件同改；落后复跑 `/tmp/a4-calib4.ts` 须仍为 884 章/1 真阳/0 误杀量级）
2. **修1a + 1b（含 n%4 呼吸跳章）+ 1c**（治本主杠杆）
3. **修2**（每格双措辞散列现在落 + 勿照搬字句句 + 声口卡毛病限 heat 前 2 人；digest 注入按前置决策 A/B）
4. esbuild 逐文件冒烟 4 个改动文件 → **取得用户授权后**杀 huolang 重开 v3 跑 4 章 canary → 复跑 `/tmp/a1-analysis.ts` 六轴对照 + 送同一外部评测者盲测。明示局限：4 章 n=1、LLM 采样非确定，"孪生"只对 sim 层成立；机检硬指标只看 **有代价选择≥1/章（A1 口径人工编码）、tradeReps=0、克制全族<4/k**，smilePerK/givePerK 作软观察。yunyou/renjian/shanju 不动（停着的绝不自启）
5. **修4（4b(i)(ii) 改写式并入版 + 4a 带双守卫 + 4c 保护令）**——仅当 canary 后评测①仍被点名（或⑤残留超标）才上；4b(iii) 已删除
6. Batch-δ 遗留：c-full（arc 事实 db 校验+中频 StageCommitted 温润通道）、笑亚族 directive 转正评审、PATTERN_FLAW 升 3 措辞（若 canary 见复读）

---

## 六、红线自查

- **温情红线不破**：全部新增措辞回避冲突/危机/争斗/失去词族（用岔子/不顺/推让/心疼/没赶上）；"至少一拍不顺"以从属句衔接"不必每拍生新冲突"非对撞；扎手（抢白/不体面细节/不厚道念头）是摩擦非冲突；sim 层 conflictRate/tuning/drama 零接触。**摩擦总预算**（评审增设）：轮盘 n%4 跳章 + 扎手 n%3 跳章 + 修4 缓行，防"处处硌牙"的换向均匀病。
- **爽文零变**：修1a/1c=GENTLE 三元分支另一臂不动；1b=`GENTLE && pledger` 块内+MICRO_TENSION_ON；修2=gentle 形参/GENTLE-only 调用点（爽文 personaDigest gentle=false→flaw 恒""）；修3=EDIT_PASS 路径+`if (GENTLE)` covered 块（爽文 covered 恒空）；修4=温润 PENMANSHIP 串+GENTLE 条件；修5=lintChapter 仅 EDIT_PASS 跑。爽文路径无一行为变化、无一字节串改动。
- **零随机零时钟**：轮盘 n%10、跳章 n%4 / n%3、扎手落段 n%(beats.length-1)、deriveFlaw=命格/c.id 字符和/sim 状态纯函数；resume 安全（章内一致即可，章是原子写入）。
- **不动 core/sim**：只读 narrativeStress/resource/命格，全部落 app 层叶子模块。
- **指令对撞矩阵**：软钩只解禁"硬悬念"、与 :253 段尾余味菜单同向；残留律容呼吸章（念头也算带得走）；轮盘与 nextProgressTask 互斥分流（stageGoal 有无）、与 gentle-director 场景轮换正交；4b(ii) 改写式并入（非追加）消除与既有详略块的同轴重叠；容粗与 settleRatio lint 同向（无缓冲收尾恰降 settleRatio）；4c 保护令让锋利/粗笔与 edit-pass 休战。
- **跨章重演已知缺口**："开篇老妇买顶针"三章同位开场是发生器级套拍，D7 只管章内——跨章维度暂由 forbid（最近章节标题禁雷同）+ recentImgs 部分覆盖，记 Batch-δ。
- **运维红线**：token 超 3% 须人批（前置决策 1）；杀活世界须人批（前置决策 2）；写者死/世界停绝不自动 resume。

---

## 七、验证法

1. **语法**：`npx esbuild --bundle=false --format=esm --outfile=/dev/null` 逐文件过 longrun.ts / persona.ts / edit-ledger.ts / lint-seams.ts（tsc --noEmit 有假绿史，esbuild 才是真闸）；再 tsc 看 core 零新错。
2. **校准断言**：复跑 `/tmp/a4-calib4.ts`（及 a4-calib*.ts）——接线后须仍为 ~884 章 / 命中 1（仅 v2ch1）/ 误杀 0；v1ch3 递药、v1ch1 转赠链、renjian104、shanju3 静默。
3. **轮盘/缺点轴确定性 spot-check**：同一 n/c.id 重复调用输出逐字节相同（无随机/时钟 API）。
4. **canary（须授权）**：huolang v3 跑 4 章（同 seed sim 逐字节孪生，唯一变量是 prompt），复跑 `/tmp/a1-analysis.ts` 六轴对照 v2ch1 基线。硬指标：有代价选择≥1/章、tradeReps=0、克制全族<4/k；软观察：纯给予/k 较 1.11 下降、smilePerK<1、givePerK 回到兄弟章 0.8-1.7 带、密度 CV 与素段占比向 v1 好章方向移动（仅诊断不设闸——A4 已证词面纹理代理不可靠）。
5. **盲测**：canary 章送同一外部评测者；预期 ch1 级章节从 45-65% 回到 30-50%（第一波·叙事层四轴是与 AI 味最强相关的轴），若选择/摩擦/给予三轴全达标应逼近 25-45% 带（v1ch3 水平）；第二波（修4）冲纹理残余。
6. **回滚**：NOVEL_MICRO_TENSION=0 关轮盘；各 diff 独立 revert；修5 纯记账无行为。

---

## 八、给主 Claude 的第一步落地清单（精确到行·按落地序）

**第 0 步（开工前）**：向用户提出两项前置决策——token 方案 A(3%)/B(~6%·评审推荐 B) 与 canary 杀活世界授权；huolang 行动前先查锁心跳与 db 章数（resume 章号源是 db 非 .md 计数），绝不自杀自启。

**第 1 步 · 修5+修3（零行为仪表+检测器）**：
1. `app/lint-seams.ts:13`——metrics 类型加 `tradeReps: number;`
2. `app/lint-seams.ts:192/194 之间`——插入三·修3a 的 D7 全块（T_FUNC/T_STOP/T_ASK/T_CORROB/tradeGrams/d7TradeRepeat/export tradeAskedItems，逐字）
3. `app/lint-seams.ts` lintSeams 内（现 :205 `const d6 = …` 后）加 `const d7 = d7TradeRepeat(body, names, len);`；现 :210 flags 数组追加 `...d7.hits`；现 :213 return metrics 加 `tradeReps: d7.hits.length`
4. `app/longrun.ts:34`——import 改 `import { lintSeams, tradeAskedItems } from "./lint-seams";`
5. `app/longrun.ts:193`——条件改 `if (seams.metrics.d1cPairs > 0 || seams.metrics.tradeReps > 0)`，日志串尾加 `${seams.metrics.tradeReps ? " 同物二卖=" + seams.metrics.tradeReps : ""}`
6. `app/longrun.ts:269 后`（`if (GENTLE)` covered 块内、metNames 累积行后）——插三·修3b 的 tradeAskedItems push（含跨段去重 guard 与"未收尾照常写完"尾句）
7. `app/edit-ledger.ts:39 后`——加 GESTURE_TPL/SMILE_TPL/GIVE_TPL 三正则（三·修5 逐字含注释）
8. `app/edit-ledger.ts:44`——LintResult.metrics 加 `gestureTpl: number; smilePerK: number; givePerK: number`；:69 后加三计算；:88 return metrics 补三字段
9. `app/edit-ledger.ts:11`——lints 数组元素类型加 `smilePerK?: number; givePerK?: number`
10. `app/longrun.ts:190`——lints 落盘对象加 `smilePerK: lint.metrics.smilePerK, givePerK: lint.metrics.givePerK`
11. 验证：esbuild 两文件冒烟 → 复跑 `/tmp/a4-calib4.ts` 断言 884/1/0 量级

**第 2 步 · 修1**：
12. `app/longrun.ts:216`——GENTLE beatSpec 整串替换（三·修1a，:217 爽文串一字不动）
13. `app/longrun.ts:46 后`——插 MICRO_TENSION_ON + MICRO_TENSION（三·修1b）
14. `app/longrun.ts:498`——改 if/else：`else if (MICRO_TENSION_ON && n % 4 !== 0) weave = …`（三·修1b 第二块）
15. `app/longrun.ts:321`——GENTLE arcHint 整串替换（三·修1c，:322 爽文不动）

**第 3 步 · 修2**：
16. `app/persona.ts:5 后`——加 `import { natalLabel } from "./pack-select";`
17. `app/persona.ts:25 后`——插 PATTERN_FLAW（每格双措辞）+ flawSeed + deriveFlaw（三·修2a 逐字）
18. `app/persona.ts:68-73`——voiceCardBlock 整函数替换（三·修2b，毛病限 top2 + 防照搬头）
19. （仅方案 B）`app/persona.ts:41-42`——digest 加 flaw 行与 parts 插槽
20. 验证：esbuild persona.ts 冒烟；spot-check 同 c.id 输出确定性

**第 4 步 · canary**（须已获授权）：杀 huolang（pkill -9，SIGTERM 杀不净）→ 归档 → v3 重开跑 4 章 → 复跑 a1 六轴 + 盲测 → 按七·5 阈值决定修4 是否上（修4 代码草稿在三·修4，含评审双守卫与 4c 保护令）。

关键文件绝对路径：`/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts`、`app/persona.ts`、`app/edit-ledger.ts`、`app/lint-seams.ts`；校准脚本 `/tmp/a4-calib*.ts`、`/tmp/a1-analysis.ts`、`/tmp/a4-helper-test.ts`。
