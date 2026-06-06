# 温情变化驱动器 · 可实施综合蓝图(融合 A/B + 吸收批评)

> 日期 2026-06-05。所有行号对 `app/longrun.ts`(485 行)、`app/drama.ts`、`app/sim-fitness.ts`、`app/evolve.ts`、`core/runtime/world-actor.ts`、`core/services/store.ts`、`core/domain/events.ts` 实测核对。坍塌实证 = renjian ch60–80 连续 21 章锁死碗/姜汤/裂纹/炭火/铜钱(gen4，conflictRate=0.6 已锚住，`novelty=0.992` 却肉眼坍塌)。批评要点见同目录 `critique.md`，下文以 **[Cxx]** 引。

---

## 一、最终推荐方案(一句话)

**以「场景轮换」为骨、「温情筛选」为驱、分三层时间尺度协同**：
- **T1 快速兜底(逐章·即刻·零新机制)**——延伸已落地的 3 处 GENTLE 小修，先钝化坍塌的**主因**(bible 自反馈)并加一个**符号 motif 检测 + scene 硬指令**的最小闭环。**最高杠杆、最低风险、可单独先上做 A/B**。[C3]
- **T2 温情故事筛选驱动器(逐章·`gentleDirector`)**——把设计A 的场景轮换 + 设计B 的「温情信号检测」合一为一个纯符号 director：用**2-gram 名词指纹**(而非现有盲眼 4-gram novelty)检测场景坍塌 → 单维递进派「时令 / 新面孔 / 场景域 / 风物」，写入独立 `ambience` 字段(**不碰 crisis**)，并**事后 Jaccard 校验闭环**。承载设计A 主体，但按批评全面加阻尼与改 BUG。[C1 C2 C5 C6 C7 C11]
- **T3 warmFit 接入进化(慢回路·根治)**——新增**温情专属** fitness(关系升温 / 人情往来 / **场景·意象多样性** / 宁静弧完成度，**零冲突项**)，在 longrun.ts:440-445 平行 slot 计算落盘，经 evolve.ts:326 GENTLE 分叉折进温情 fitness，让进化**长期偏好多样**、把 T2 的逐章纠偏沉淀进基因。[C4 C8 C9 C10]

三层是**时间尺度互补**，不是三选一：T3 慢回路治不了当前 21 章逐章坍塌(C10)，必须 T1/T2 前置；T1/T2 治标，T3 治本让世界自己学会不坍。

---

## 二、为什么这样分层(决定性依据)

1. **坍塌不是 engine 太冷的锅**。renjian gen4 `conflictRate=0.6/eventBias=0.66` 已被 GENTLE 锚住(evolve.ts:326 + drama.ts:42)，世界没被推回戏剧——**坍塌发生在叙述取景层**(scene/outline/secPrompt/bible)。所以发力点是这四处，不是旋钮。
2. **现有 novelty 对 motif 坍塌全盲**[C4·决定性]。renjian `novelty=0.992` 满分，21 章却坍塌。`historicalNovelty`(sim-fitness.ts:194)用 4-gram Jaccard over 全文，把「碗→粗陶→瓷响」近义替换当新颖。**任何检测/warmFit 必须新造 2-gram 名词指纹**，否则被骗。这也证伪了「字面 avoid 能拦」——LLM 已在用近义词规避。
3. **主因在 bible 自反馈**[C3]。rollSummary(:435)每 8 章把碗/裂纹回灌 bible，经 `bibleEcho`(:351→:355)→outline(:169)→每段 secPrompt(:190)扩散。不钝化它，T2 派的新场景会被 secPrompt 里的 bible 拗回去(实测现有 :169 硬话已失效)。**故 T1 第一刀就砍这里**。

---

## 三、T1 · 快速兜底(逐章 · 即刻上 · 单独可 A/B)

> 三个改动，全在 GENTLE 门内、纯文案/符号、零新机制。**建议先上①单独跑 8–16 章 A/B**，再叠 ②③。

### T1-① 钝化 bible 自反馈(第一性，砍主因)[C3]

**集成点**：`app/longrun.ts:158`(rollSummary 签名) + `:435`(调用)。

```ts
// :158 — 加一个可选 avoid 参数(GENTLE 下由 T2 的 motif 集合传入; 无则空)
async function rollSummary(prev: string, recentGoals: string[], dropMotifs: string[] = []): Promise<string> {
  const drop = dropMotifs.length
    ? `\n【压缩须剔除】近章反复出现的具体静物/场景词(${dropMotifs.slice(0,8).join("、")})——只保留人物关系/势力/未了伏笔/境界/恩怨等结构性线索，勿把器物特写写进纲要(它们会回灌后续每章导致镜头锁死)。`
    : "";
  const p = `${sys}\n长篇连载【前情纲要】(保住人物关系/势力/未了伏笔/当前境界/已发生的大事)：\n${prev}\n新增：${recentGoals.join("；")}${drop}\n压缩重写为不超过200字的新纲要，只留对后续连贯最关键的线索，只输出纲要。`;
  return (await llm.complete(p, { thinking: false, temperature: 0.6 })).replace(/\s+/g, " ").slice(0, 320);
}
// :435 — GENTLE 下把 T2 算出的 motif 传进去(T2 未上时传 [] 即纯①, 可独立 A/B)
bible = await rollSummary(bible, recent.slice(-8), GENTLE ? gdLastMotifs : []);
```

> 即便 T2/T3 一行不写，这一刀单独就动了主因；A/B 看 ch+8 起标题是否从碗/裂纹散开。

### T1-② scene 从「背景标签」升为「本章场景指令」并入 secPrompt[设计A §5 最高杠杆]

**集成点**：`app/longrun.ts:271`(scene 计算) + `:190`(secPrompt)。现状 secPrompt 只有 `情境：${scene}` 一句被上文结尾盖过。

```ts
// :271 — scene 改 let, 留出 T2 覆盖位(T2 未上时退化为原 sceneFor, 无行为变更)
let scene = sceneFor(n);
let ambience = "";   // T2 写入: 时令/风物背景(独立于 crisis) [C1 C6]
let sceneAvoid = ""; // T2 写入: 须避开的场景「类」(非字面词) [C5]
```

```ts
// :190 secPrompt — 把 scene 升为指令、把 ambience/avoid 注入每段(让续写阶段也被牵, 不只靠上文惯性)
const secPrompt = `${sys}\n【第${n}章《${goal}》·第${vol}卷·情境：${scene}】`
  + (GENTLE && ambience ? `\n【本章风物背景】${ambience}` : "")
  + `\n【当前世界大事】${crisis || "暂无"}\n…(原样)…`
  + (GENTLE && sceneAvoid ? `\n本段须把镜头放在新场景里的人来人往，勿回到【${sceneAvoid}】。` : "")
  + /* …原 PENMANSHIP/canon/lore… */ "";
```

### T1-③ outline 硬指令带「场景类」avoid(替换泛提示)[C5]

**集成点**：`app/longrun.ts:166-169`(GENTLE beatSpec + outline GENTLE 段)。把现有 :169「本章必须把镜头挪开」(实测已失效)升级为**确定性硬指令 + 场景类 avoid**：

```ts
// :169 GENTLE 段 — 当 T2 给出 sceneAvoid/domain 时(occupied=false), 用强指令替换泛提示
${GENTLE && gdDomain ? `\n【本章场景·须切换·要紧】本章主场景须离开【${sceneAvoid}】(同一处室内/同一旧物特写)，转到【${gdDomain}】：把镜头挪到那里的人事往来与世态人情。节拍仍温润连贯、章末留余味，只换舞台不跳冲突。` : /* 退化为原泛提示 */ ""}
```

**T1 三刀单独效力**：①动主因、②③把 scene 从弱标签变强指令。即便不上 T2/T3，已远强于现状。

---

## 四、T2 · 温情故事筛选驱动器 `gentleDirector`(逐章 · 新文件)

> 设计A 主体 + 设计B 的「温情检测」合流。**只在 GENTLE 启用；不调 step()、不 emit 事件、不写 tuning/factionShifts/负 valence/Fell — 结构上不引冲突**[C11 C12]。新文件 `app/gentle-director.ts`，与 drama.ts/sim-fitness.ts 同层，core/packs 零改。

### 4.1 检测信号(吸收 C2/C4/C5)

- **数据源走落盘**[C2]：`store.readRecentChapters(db, worldId, 4)`(store.ts:173，标题+正文都拿得到)，**彻底不依赖 in-process `recent[]`**(它 resume 为空)。状态落盘 `gentle-director.json`(`sameStreak/lastMotifs/lastDomain/turn`)，resume 安全。
- **指纹用 2-gram 名词、不用 4-gram novelty**[C4]：现有 `gramSig`(sim-fitness.ts:182)是 4-gram、对 motif 坍塌盲；T2 自带一个 **2-gram 高频静物指纹** `motifSig()`，复用 `jaccard`(sim-fitness.ts:189)算窗间相似度。Jaccard≥0.5 ⇒ 镜头黏在同一批器物 ⇒ `sameStreak++`；挪开则归零。
- **avoid 给「类」不给「词」**[C5]：把 top motif 归到语义类(室内静物/灶房/同一旧物/饮食器具…)，outline/secPrompt 用类约束，堵近义词规避。

### 4.2 单维递进 + 软着陆(吸收 C7) —— 不破温润气脉

**阈值 S=4**(非 3)；**一次只动一个维度**，streak 越深才叠加：

| sameStreak | 干预维度(累进) | 强度 |
|---|---|---|
| < 4 | 观望(温情合理停留) | 无 |
| 4 | 仅推**时令**(节气/晴雨/晨昏) | 最轻·软着陆 |
| 5 | + 一个**新面孔**自然进入(行脚僧/求医人/归乡客) | 轻 |
| 6 | + 换**场景域**(候选先按当前 location 可达性过滤) | 中 |
| ≥7 | + 概率挂**温情风物**(集市/节庆/农事，写入 `ambience`) | 偏强 |

- **场景域候选按 location 过滤**[C7]：从当前在场 location 出发「自然能去哪」先过滤，再用 `turn` 做确定性 tiebreak(保 resume 复现、去机械感)。
- **换景后 `sameStreak` 归零**，给新场景喘息，避免每章被拽。

### 4.3 输出走独立 `ambience` 字段(吸收 C1/C6) —— 不碰 crisis

**绝不写 `crisis`**(那是「世界大事」标签，LLM 按冲突理解)。director 写两处 props：
- `props["sceneShift"]` = `{forCh, domain, timeShift, avoidClass, ambience}`(`forCh===n+1` 守门，防 resume 串旧章)。
- 风物事件写进 `ambience` 文本(在 secPrompt 以「本章风物背景」注入，§T1-②)，文案**剔除一切「会与主角互动的新意图体」**[C6]：`GENTLE_AMBIENCE = ["街市比平日热闹三分，人语喧阗","谷场上农事正忙，新谷的香气漫过田垄","社树下乡邻分胙饮酒，孩童绕场","渡口泊了远来的船，卸货声一直到晚黄昏"]`——只描「世态流动」，无「带来见闻/捎书将至」类外部变量。

### 4.4 事后校验闭环(吸收 C5) —— 治 prose 抗命

director 落盘后记 `pendingDomain`；下一章检测时若**新窗 Jaccard 仍 ≥0.5**(说明 prose 抗命没真换)，则升级：强制写一条「本章开篇人物须**物理离开**当前 location(出门/启程)」进 ambience，且把该 location 名加入 avoidClass。连续 2 章抗命才升级，避免过激。

### 4.5 集成点表(T2)

| 动作 | 文件:行 | 改动 |
|---|---|---|
| 新建 director | `app/gentle-director.ts`(新) | `loadGD/saveGD`(镜像 drama.ts:17-21) + `gentleDirect(forCh, recentTitles, recentBodies, ctrl, occupied, location)` → `{sceneShift, ctrl, log}`；自带 `motifSig`(2-gram)，复用 sim-fitness.ts:189 `jaccard` [C4] |
| import | `app/longrun.ts:22` 旁 | `import { loadGD, saveGD, gentleDirect, classifyMotif, type SceneShift } from "./gentle-director";` |
| 加载 | `app/longrun.ts:81` 旁 | `let gdir = GENTLE ? loadGD(ROOT) : null; let gdLastMotifs: string[] = []; let gdDomain = ""; ` |
| 算 sceneShift + 写 props | `app/longrun.ts:285-300` 的 `withLock` 块内追加(与 step 互斥，防竞态) | GENTLE 下：读 `readRecentChapters(db,worldId,4)`；`const occupied = !!(weave) || !!(beatForChapter(outlinePlan,n+1));`(让位大纲/伏笔[C11])；`const gd = gentleDirect(n+1, titles, bodies, gdir!, occupied, curLocation); gdir=gd.ctrl; saveGD(ROOT,gdir); gdLastMotifs=gd.motifs; spd.snapshot.props["sceneShift"]=gd.sceneShift;`(同一 saveSnapshot 落盘，不新增写) |
| 读 sceneShift → 覆盖 scene | `app/longrun.ts:271`(§T1-② 的 let 块后) | `if (GENTLE){ const sh=snap.snapshot.props["sceneShift"] as SceneShift|undefined; if(sh&&sh.forCh===n){ gdDomain=sh.domain; scene=`${sh.timeShift}。${sceneFor(n)}`; ambience=sh.ambience; sceneAvoid=sh.avoidClass; } }` |
| outline 硬指令 | `app/longrun.ts:169` | §T1-③(gdDomain/sceneAvoid 驱动) |
| secPrompt 注入 | `app/longrun.ts:190` | §T1-②(ambience/sceneAvoid 注入每段) |
| bible 钝化喂 motif | `app/longrun.ts:435` | §T1-①(传 gdLastMotifs) |

**core/ 0 行，packs/ 0 行，LLM 调用 0(纯符号)**。

### 4.6 伪代码(`app/gentle-director.ts` 主体)

```ts
// app/gentle-director.ts — 温情变化驱动器(T2): 场景与世界生态主动轮换 + 温情坍塌检测。
// drama.ts 温情对位: 纯符号无 LLM, 每章一次, 读落盘近章标题/正文 → 2-gram 名词指纹测坍塌 → 单维递进派场景。
// 只在 GENTLE; 绝不写 factionShifts/负valence/Fell/crisis/tuning, 结构上不引冲突。core/packs 不涉。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { jaccard } from "./sim-fitness"; // 复用现成 Jaccard(但指纹自带 2-gram, 不用盲眼 4-gram novelty)

export interface SceneShift { forCh: number; domain: string; timeShift: string; avoidClass: string; ambience: string }
export interface GDCtrl { sameStreak: number; lastMotifs: string[]; lastDomain: string; turn: number; defyStreak: number }

const S_TRIGGER = 4;                       // [C7] 提到4, 容温情合理停留
const SEASONS = ["立春乍暖·清晨","谷雨润物·向午","小满麦黄·晌午","夏至蝉长·薄暮","白露凉起·清晨","秋分桂香·向晚","霜降叶染·黄昏","小雪初寒·入夜","冬至围炉·夜深","雨水冰解·拂晓"];
const DOMAINS = ["出门赶集","访友叙旧","上山访庵","下山归途","渡口候船","田间水边","市集庙会","别人家中","归乡省亲","远行途中"];
const NEWFACE = ["一个行脚僧叩门借宿","一位求医人寻上门","邻家孩童跑来玩耍","一位归乡的旧邻路过","一个远来的货郎歇脚"];
// [C6] 风物——只描世态流动, 无"带来见闻/捎书将至"类外部意图体
const AMBIENCE = ["街市比平日热闹三分，人语喧阗","谷场上农事正忙，新谷香气漫过田垄","社树下乡邻分胙饮酒、孩童绕场","渡口泊了远来的船，卸货声到黄昏"];
// [C5] motif → 场景"类"(非字面词), 用于 avoidClass
const CLASS_RULES: Array<[RegExp,string]> = [
  [/碗|姜汤|粥|药|茶|铜钱|瓷|陶|炉|炭|灶|裂纹|旧物|灯/, "室内灶房·同一旧物特写"],
  [/院|门|窗|墙|檐/, "宅院内同一处"],
];
export function classifyMotif(motifs: string[]): string {
  for (const [re, name] of CLASS_RULES) if (motifs.some(m => re.test(m))) return name;
  return "近章反复的同一处场景";
}

const F = (d: string) => join(d, "gentle-director.json");
export function loadGD(d: string): GDCtrl {
  try { return existsSync(F(d)) ? { sameStreak:0,lastMotifs:[],lastDomain:"",turn:0,defyStreak:0, ...JSON.parse(readFileSync(F(d),"utf8")) } : { sameStreak:0,lastMotifs:[],lastDomain:"",turn:0,defyStreak:0 }; }
  catch { return { sameStreak:0,lastMotifs:[],lastDomain:"",turn:0,defyStreak:0 }; }
}
export function saveGD(d: string, c: GDCtrl): void { try { writeFileSync(F(d), JSON.stringify(c)); } catch {} }

// [C4] 2-gram 高频中文静物指纹(对 motif 坍塌敏感; 不用盲眼 4-gram)
function motifSig(titles: string[], bodies: string[], k = 8): string[] {
  const text = (titles.join("　") + "　" + bodies.map(b => b.slice(0,240)).join("　")).replace(/\s+/g,"");
  const freq: Record<string,number> = {};
  for (let i=0;i+2<=text.length;i++){ const g=text.slice(i,i+2); if(/^[一-龥]{2}$/.test(g)) freq[g]=(freq[g]??0)+1; }
  return Object.entries(freq).filter(([,v])=>v>=2).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([g])=>g);
}

export function gentleDirect(
  forCh: number, titles: string[], bodies: string[], ctrl: GDCtrl,
  occupied: boolean,   // [C11] 本章被大纲/伏笔占用 → 让位
  location: string,    // [C7] 当前在场 location, 用于候选可达性过滤
): { sceneShift: SceneShift | null; ctrl: GDCtrl; motifs: string[]; log: string } {
  const motifs = motifSig(titles, bodies);
  const stuck = jaccard(new Set(motifs), new Set(ctrl.lastMotifs)) >= 0.5;  // [C4] 镜头黏住?
  let sameStreak = stuck ? ctrl.sameStreak + 1 : 0;
  // [C5/4.4] 事后闭环: 上章派了场景却仍黏住 = prose 抗命
  const defyStreak = (ctrl.lastDomain && stuck) ? ctrl.defyStreak + 1 : 0;
  let next: GDCtrl = { ...ctrl, sameStreak, lastMotifs: motifs, defyStreak };

  if (occupied || sameStreak < S_TRIGGER) {
    return { sceneShift: null, ctrl: next, motifs, log: `温情观望(streak${sameStreak}${occupied?"·让位大纲":""})` };
  }
  const avoidClass = classifyMotif(motifs);
  // [C7] 单维递进 + 软着陆: 按 streak 决定动几个维度
  const timeShift = SEASONS[next.turn % SEASONS.length]!;
  let domain = ""; let ambience = "";
  if (sameStreak >= 5) { // 加新面孔
    ambience = NEWFACE[next.turn % NEWFACE.length]!;
  }
  if (sameStreak >= 6 || defyStreak >= 1) { // 换场景域(候选按 location 可达过滤——示意: 简化为跳过上次域)
    let di = next.turn % DOMAINS.length;
    if (DOMAINS[di] === ctrl.lastDomain) di = (di + 1) % DOMAINS.length;
    domain = DOMAINS[di]!;
  }
  if (sameStreak >= 7) { // 概率挂风物(确定性: 用 turn 低位, resume 复现)
    const p = Math.min(0.6, (sameStreak - 7 + 1) * 0.25);
    if (((next.turn * 7 + sameStreak) % 100) / 100 < p) ambience = AMBIENCE[next.turn % AMBIENCE.length]!;
  }
  // [4.4] prose 抗命升级: 强制物理离开当前 location
  if (defyStreak >= 2 && location) ambience = `本章开篇须离开${location}(出门/启程)，把人事挪到别处。` + ambience;

  next = { ...next, lastDomain: domain || ctrl.lastDomain, turn: next.turn + 1, sameStreak: 0, defyStreak: domain ? 0 : defyStreak };
  const shift: SceneShift = { forCh, domain: domain || "(原处·仅推时令/添新面孔)", timeShift, avoidClass, ambience };
  return { sceneShift: shift, ctrl: next, motifs,
    log: `🍃${domain?`换景→【${domain}】`:"软调"}·${timeShift}${ambience?"·"+ambience.slice(0,8)+"…":""}(避:${avoidClass})` };
}
```

> det 选择全基于 `turn`，无 `Math.random`，**resume 完全复现**。每次输出一行 `🍃` log，与 `🎭`(drama)/`🧠`(minds) 并列可观测。

---

## 五、T3 · warmFit 接入进化(慢回路 · 根治)

> 让进化**长期偏好场景多样、人情丰沛**，把 T2 的逐章纠偏沉淀进基因。**温情专属、零冲突项**[C9]。

### 5.1 warmFit 度量什么(吸收 C8/C9) —— 与戏剧 siftStories 彻底分开

新文件 `app/warm-fitness.ts`(与 sim-fitness.ts 同层)，**绝不复用 siftStories 的戏剧链**(那是复仇/陨落/巨变，sim-fitness.ts:60-108)。warmFit 四信号(0..10)：

1. **场景·意象多样性 W_var(权重最高)**[C4·C8]：对近窗章正文跑 **2-gram 名词指纹**(同 T2 `motifSig`)，算**逐章指纹的两两 Jaccard 均值**→ 多样性 = `1 - 均相似`。**这才是现有 `novelty`(4-gram，renjian 0.992 却坍塌)看不见的维度**。直接惩罚 motif 坍塌。
2. **关系升温 W_bond**：近窗 `bond:` 正向增量累计 / 在场人数(关系网越暖越高)。信号源 = 快照 `c.props["bond:*"]`(roster 已在读，longrun.ts:145-148)。
3. **人情往来 W_social**：StageCommitted candidate 中 `-ally-`/相聚类 chosenCandidateId 占比(events.ts:24 的 `chosenCandidateId` 正则)+ 新面孔登场频次。**信号建在 candidateId + candidate summary 文本**，不依赖不存在的 scene 字段[C8]。
4. **宁静弧完成度 W_arc**：温情「小事善了」(一次相聚/一桩心结化开/一程行脚抵达)的闭合率——从 StageCommitted summary 文本匹配温情完成词(团聚/和解/抵达/释怀)，**不含任何 valence<0 / 兴亡项**[C9]。

`warmTotal = +(0.40*W_var + 0.25*W_bond + 0.20*W_social + 0.15*W_arc).toFixed(2)`。W_var 权重最高 = 直接对坍塌施压。

### 5.2 集成点(T3)

| 动作 | 文件:行 | 改动 |
|---|---|---|
| 新建 warmFit | `app/warm-fitness.ts`(新) | `computeWarmFit(events, snapshot, recentCh) → WarmFitness{total,var,bond,social,arc}`；`loadWarmFit/saveWarmFit`(镜像 sim-fitness.ts:37-49) |
| 平行计算落盘 | `app/longrun.ts:440-445`(computeSimFitness 块内，**GENTLE 分支**) | `if (GENTLE && spf){ const wf = computeWarmFit(store.readRecentEvents(db,worldId,800), spf.snapshot, recentCh); saveWarmFit(ROOT, wf); console.log(\`  🌿 温情层${wf.total}/10 · 场景多样${wf.var} · 关系暖${wf.bond} · 人情${wf.social} · 善了${wf.arc}\`); }` —— 与 simFit 同处算，`spf.snapshot`/`recentCh` 已在作用域(实测 longrun.ts:440/438) |
| 折进温情 fitness | `app/evolve.ts:323-328`(GENTLE 分叉处) | GENTLE 时读 warmFit 折进：`const wf = GENTLE ? loadWarmFit(dir) : null;` 然后 GENTLE 分支 fitness 改 `+(0.45*llmFit + 0.15*objFit + 0.10*consFit + 0.30*(wf?.total ?? 5)).toFixed(2)`(把 simFit 的 28% 位置让给 warmFit·30%)。**爽文分支(`!GENTLE`)一字不动** |
| engine 偏好(可选) | `app/evolve.ts:325` 旁 | GENTLE 下可按 `wf.var` 单独记 `bestWarmEngine`，让 mutate 偏好「让世界多产生人情往来/场景流动」的旋钮(structureGrowth 生长侧)，但**绝不升 conflictRate**[C11] |

> computeSimFitness 块(longrun.ts:440-445)实测在 `EVOLVE` 下无条件跑(非 GENTLE-gated)，warmFit 平行 slot 真实可行。evolve.ts:326 已有 GENTLE 分叉，接 warmFit 入温情 fitness 是最小改动。

### 5.3 为什么 T3 不够、必须配 T1/T2[C10]

warmFit 每 8 章经 evolveOnce 折进基因，影响的是**下一卷采样参数**——对**当前 21 章逐章取景零即时约束**。T3 是「让世界长期学会不坍」，T1/T2 是「这一章就别坍」。三层缺一不可。

---

## 六、验证度量(四维)

> 实盘对象：renjian(现成 21 章坍塌铁证)。接上后从 ch81 起跑 ~16 章对比。

| 维度 | 指标 | 工具/来源 | 目标 |
|---|---|---|---|
| **① 连续同场景章数↓** | `sameStreak` 峰值 + 「连续 N 章共享 top-motif」 | T2 的 `gentle-director.json` + 对 ch 标题跑 `motifSig` Jaccard 链 | 从 21 → **≤2**(温情允许 1-2 章停留) |
| **② 场景多样性↑** | warmFit `W_var`(2-gram 名词指纹两两 Jaccard 均值的补) | `warm-fitness.json` | ch81-96 `W_var` 较 ch65-80 **显著上升**；且与现有 `novelty`(4-gram)**脱钩对照**——证明测到了 novelty 看不见的坍塌 |
| **③ warmFit↑、且不靠冲突** | `warmTotal` 及四分量；**同时** `sim-fitness.json` 的 `tension/sift` **不上升** | warm-fitness.json + sim-fitness.json | warmTotal↑ 而 tension≤4.5/sift≤2 **保持低位**(证明涨的是温情、不是戏剧) |
| **④ 温润气脉不破** | a. `CharacterFell`/`FactionDissolved` 计数**不增**；b. 章末「留余味不留悬念」保持；c. 节拍连贯(无突兀跳切) | 事件流 grep + 人读 ch81-96 抽样 | Fell/Dissolved 计数 **0 增量**；抽样人评「换了舞台但仍温润、未变赶行程/未引冲突」 |

**关键对照实验**：度量②要把 `W_var`(2-gram 场景指纹)与现有 `novelty`(4-gram 全文)**并排画**——renjian 现状是 novelty=0.992 而 W_var 应很低；接上后 W_var 升而 novelty 仍高，**这条曲线分叉本身就是「治到了 novelty 盲点」的铁证**。

**消融**：先单独上 T1-①(钝化 bible)跑 ch81-88 A/B，看是否单独缓解一半(C3 预测)；再叠 T2、T3。

---

## 七、风险与「不破温情 / 不引戏剧」的保证(逐条)

| 风险 | 保证机制 | 依据 |
|---|---|---|
| **偷偷引戏剧(引擎层)** | director 不调 `step()`、不 emit `WorldEvent`、不写 `factionShifts`/负 `valence`/`Fell`/`crisis`；warmFit 零冲突项、不复用 siftStories | `CharacterFell` 需 `fallDebt>=1`+`s`-前缀角色(world-actor.ts:471-475)、`FactionDissolved` 需 `factionRelations<=-6`(:412)，T2/T3 两条都不碰 → **结构上不可能** [C11] |
| **偷偷引戏剧(prose 层反弹)** | ambience 文案剔除一切「会与主角互动的新意图体」(无「带来见闻/捎书将至」)；走独立 `ambience` 字段、**不进 crisis**(避免 LLM 按「世界大事」戏剧化) | [C1 C6]·新增 §4.3 词表已审 |
| **过度变化、破温润气脉** | S=4 起；单维递进(时令<新面孔<场景域<风物)；换景后 streak 归零;场景域候选按 location 可达过滤;beatSpec 温情节拍(:166)与章末留余味(:190)原样保留——只换舞台不换气脉 | [C7] |
| **prose 抗命、派了不换** | 事后 Jaccard 闭环：连续 2 章仍黏住 → 升级强制物理离开 location | [C5]·§4.4 |
| **近义词规避字面 avoid** | avoid 给「场景类」(室内灶房/同一旧物特写)而非字面词；warmFit 用 2-gram 名词指纹整体施压 | [C4 C5] |
| **bible 回灌锁死镜头(主因)** | T1-① 钝化 rollSummary，剔除静物词、只留结构线索 | [C3] |
| **resume 失明/串章** | 检测走落盘 `readRecentChapters`、状态落盘 `gentle-director.json`；`sceneShift.forCh===n` 守门；写 props 在 `withLock` 内防竞态 | [C2]·store.ts:173/68 |
| **误伤爽文世界** | 全部包在 `if (GENTLE)`；T3 evolve 改动仅 GENTLE 分支，`!GENTLE` 一字不动；爽文零回归 | [C12]·evolve.ts:326/328 |
| **重蹈「第五梯度」(drama 每章覆写 tuning)** | director **不碰 tuning**，只写 sceneShift/ambience 新槽；warmFit 不进 dramaControl | [C11]·MEMORY 已记 |

---

## 八、必须吸收的批评点(落地核对清单)

- [x] **C1** `crisisInject` 不存在 → 新开 `ambience` 字段(T1-② / T2-§4.3)
- [x] **C2** `recent[]` resume 为空 → 检测走 `readRecentChapters` + 状态落盘(T2-§4.1)
- [x] **C3** bible 自反馈是主因 → T1-① 第一刀、单独 A/B
- [x] **C4·决定性** 现有 novelty 对 motif 坍塌盲 → 2-gram 名词指纹(T2 检测 + T3 W_var)
- [x] **C5** 字面 avoid 拦不住近义词 → avoid 给「类」+ 事后 Jaccard 闭环(T2-§4.1/4.4)
- [x] **C6** worldEvent prose 戏剧反弹 → 剔除「新意图体」+ 不入 crisis(T2-§4.3)
- [x] **C7** 气脉过度变化 → S=4 + 单维递进 + 软着陆 + location 过滤(T2-§4.2)
- [x] **C8** StageCommitted 无结构化 scene 字段 → 信号建在 summary+candidateId+chapter-motif(T3-§5.1)
- [x] **C9** warmFit 不复用戏剧 siftStories、只度量温情专属好(T3-§5.1)
- [x] **C10** warmFit 慢回路治不了逐章坍塌 → 三层时间尺度分工(§一/§二)
- [x] **C11** director 不碰 tuning / 物理隔离冲突源(§七)
- [x] **C12** 只 GENTLE 启用、爽文零变更(§七)

---

## 九、落地优先级与成本

| 阶段 | 内容 | 文件 | 成本 | 风险 |
|---|---|---|---|---|
| **P0**(先做·A/B) | T1-① 钝化 rollSummary | longrun.ts:158/435 | ~6 行 | 极低·动主因零新机制 |
| **P1** | T1-②③ scene 升指令 + outline 硬 avoid | longrun.ts:166/169/190/271 | ~15 行 | 低·GENTLE 门内文案 |
| **P2** | T2 gentleDirector(检测+递进+ambience+闭环) | gentle-director.ts(新~110 行) + longrun.ts 6 处接线 | ~110+25 行 | 低·旁路 sim、props 守门、withLock |
| **P3** | T3 warmFit 接入进化 | warm-fitness.ts(新~90 行) + longrun.ts:440 + evolve.ts:323-328 | ~90+10 行 | 低·仅 GENTLE 分支、爽文零改 |

**总计**：~3 个新文件叶子层 + longrun/evolve 局部接线；core/ 0 行、packs/ 0 行；**LLM 调用 0**(T1-① 复用已有 rollSummary 调用、T2/T3 纯符号)。约 1 天工作量。
