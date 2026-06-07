# 蓝图：涌现型叙事推进（情节层 T2'）— 三方融合 · 防循环不奉剧本

> 复核日期 2026-06-06。基于当场重测 live(`renjian` 347commit/70章) + control(`renjian-killed-20260606-180327` 1481commit/380章) + 源码。
> 同目录 `critique.md` 为独立对抗复核（已纠正原批评 4 处），本蓝图**全量吸收其 7 条 MUST**。

---

## 0. 一句话最终推荐（A 为骨 / B-C 供材料 / 重框 W_progress 奖新颖 / 但治本下沉 sim 层）

**A 涌现新颖压力为骨架**（检测处境停滞→施压「该有新发展涌现」、内容不写死）；
**B/C 供涌现材料**——但材料**不是原始 summary 串**（那是 137/545 条单模板「与虚谷论道结善」，注入反加循环），而是**带新颖闸的结构事实**（首次结识对象 / faction 多样性 / tier 跨越）；
**重框 W_progress**：不推倒、不改语义、不撞 W_var——而是**新增第 6 信号 W_emerge 读事件层涌现多样性**（让进化看得见，破「prose 通道改不动 sim 度量」死穴）；
**治本下沉**：A 是放大器，**真防循环力在 sim 层**——把 character-actor.ts:79 的硬编码「论道结善」措辞库化 + 让 move 候选可被 prior 选中 + newcomer 命名多样化。源头出真新颖，T2' 才放大真新颖。
**outline-plan 软脊梁保留**（实测 `steer:soft+balanced`，非剧本，删它会废掉刚 ship 的 C 层）。

```
┌─ 空间维(已落地) ── gentle-director(T2): 场景/季候/新面孔轮换 ── 守 W_var≥9.4
│
├─ 情节维(本蓝图) ── T2' 涌现推进 = 进展账本的升级:
│     源头(sim/core)  : ally措辞库 + move可选 + 命名多样  ← 治本(产真新颖)
│     度量(warm-fit)  : +W_emerge 读事件层涌现多样性     ← 接进化(可被选)
│     检测(账本)      : 处境语义差分 + 拍子 Jaccard       ← 防停滞(已有)
│     施压(weave)     : emerge 结构事实, 邀请式, 单路/章   ← 不奉剧本
│     方向(outline)   : steer:soft 软脊梁(保留)            ← 不奔死终点
│
└─ 进度账本(已落地) ←──── T2' 是它的升级: 把「奔里程碑」改为「持续长新处境+新涌现」
```

---

## 1. 为什么这样能「真防循环 · 不奉剧本 · 不破温情 · 不引戏剧」

| 维度 | 旧(奉剧本/换皮循环) | 新(本蓝图) |
|---|---|---|
| 推进信号源 | `arcMilestones` 手写 beats（达成即锁高 9.2 假高）| outline 软脊梁(方向) + sim 涌现(素材) + 处境语义差分(达标) |
| 涌现材料 | 137 条单模板「与虚谷论道结善」（control 545 条全同）| **结构事实**(首次结识/faction 首现/tier 跨越) + sim 层措辞库化产真变体 |
| 停滞判定 | 无 | situation 2-gram Jaccard<0.6 + writtenBeats 2-gram Jaccard>0.5（已有）|
| 施压 | 「朝『成神仙』终点挪」+ 三路叠加强指令 | 「世间有这些动静，可拾一二自然融入」邀请式，**单路/章 + gap 节流** |
| 进化可见性 | social=ally比函数，prose 注入改不动→进化看不见 | **W_emerge 读事件层多样性**，sim 措辞库化真改 ally 模板→针动 |
| 防循环力来源 | 无 | **真实涌现缺口(检测器) + 真实涌现多样性(sim 源头)**，两端非人写死 |

**关键**：防循环的力来自 (1) sim 源头真产多样（措辞库 + move 可选 + 命名多样），(2) W_emerge 让进化把「会产多样」的基因选出来，(3) 检测器逮停滞、施压只「邀请」不「指令」。outline 软脊梁只给「人生方向」（steer:soft），从不给「必达终点」。**这是 Wiggins「换概念空间而非奔预设点」的完整实现**：缺口、材料、方向三端都不是剧本。

---

## 2. 改动清单（按灰度顺序 · 含删除项）

| # | 层 | 改动 | 文件:行 | 风险 | 灰度阶段 |
|---|---|---|---|---|---|
| **S1** | core | ally summary 措辞库化（破单模板，治本）| character-actor.ts:79 | 中 | P1（先上，立断 545 条全同）|
| **S2** | core | move 候选可被 prior 选中（破「只在原地」）| character-actor.ts:126-141 + 打分 | 中 | P3 |
| **S3** | pack | newcomer 命名多样化（破姓陈堆叠）| xianxia-bazi:310-318 / gentle 命名路径 | 低 | P3 |
| **E1** | app | 新建 `gentle-emergence.ts`：抽**结构事实**(非 summary 串)，含新颖闸 | 新文件 ~70 行 | 低 | P2 |
| **E2** | app | emerge 注入 weave（**单路/章 + gap 节流 + 邀请式**，rebase 4 参）| longrun.ts:410-414 | 低 | P2 |
| **E3** | app | roster「本章新到」差分**仅作素材**（不单独施压标注）| longrun.ts:147/228/359 | 低 | P2 |
| **F1** | app | 新增 **W_emerge**（第 6 信号，读事件层涌现多样性，接进化）| warm-fitness.ts | 中 | P2 |
| **F2** | app | progressMomentum 修 freshScore 真实化（reachedScore 降权，不删）| warm-fitness.ts:97-108 | 低 | P2 |
| **C1** | app | advanceStep 加处境语义差分（处境长新即推进，**保留** arcMilestones）| progression-ledger.ts:68-94 | 中 | P2 |
| **C2** | app | nextProgressTask 加 emerge 第 5 参（**保留** stageGoal）| progression-ledger.ts:52 | 低 | P2 |

**删除项（吸收批评①）**：
- ❌ **不删 outline-plan**（实测 steer:soft 软脊梁，删它废 C 层 + 打错靶）。
- ❌ **不删 stageGoal**（emerge 作补充，非替代）。
- ❌ **不改 W_progress 语义为「新颖度」**（撞 W_var；改走新增 W_emerge）。
- ✅ **删 design 的 `-move` partings 分支**（prior 永不选→实践死代码；S2 让 move 可选后，move 改入 `advances`/`partings` 走结构事实，不渲染 summary）。
- ✅ **删 design 的 Fell/Transcended → partings**（违 T2 铁律）。
- ✅ **删 design 的「renderEmergence 渲染原始 summary 串」**（注入「与虚谷」重复向量）。

---

## 3. 集成点（file:line）+ 伪代码

### S1【治本·破单模板】ally summary 措辞库化 — `core/actors/character-actor.ts:79`

现状（实测硬编码，137/545 条全同）：
```ts
summary: `${char.name}与${other.name}论道结善`,
```
改为**确定性措辞库**（按双方 id/element/bond 选词，禁 random，resume 复现）：
```ts
// character-actor.ts 顶部加(纯符号, 与现有 rng 无关, 用 hash 确定性选词):
const ALLY_VERBS = ["论道结善","煮茶夜话","结伴同行","互赠所学","对弈消闲","共渡一程","援手解困","闲话桑麻","切磋印证","托付一事"];
function allyVerb(aId: string, bId: string, tick: number): string {
  // hashStr 已在 pack 用; core 若无则用简易 char-sum, 确定性即可
  const h = (aId + "|" + bId + "|" + (tick >> 3)) // >>3: 每~8tick 可换措辞, 同一对短期内稳定
    .split("").reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return ALLY_VERBS[h % ALLY_VERBS.length]!;
}
// :79 改:
summary: `${char.name}与${other.name}${allyVerb(char.id, other.id, tick)}`,
```
> 注：`tick` 须在 decideCharacter 作用域可得（snapshot.tick 或传入）。若不可得，用 `acts`（actCount）替代做漂移源。**爽文同样受益但不破坏**（措辞库是温情中性词，戏剧世界 clash/avenge 不动）。
> **效果**：ally 从「100% 一句」→ 10 词轮替，W_emerge（见 F1）立刻读到多样性上升；warm-fitness arcWarmth 的 WARM_DONE 正则已含「论道/结善」，须扩词表匹配新动词（见 F1 附带）。

### S2【治本·破原地】move 候选可被 prior 选中 — `character-actor.ts:126-141`

现状：move 候选 `axisHints: { initiative: 0.4 }`，敌不过 ally(harmony:1)/clash(discord:1)，**347 commit 选中 0 次**。
治本（仅 GENTLE 倾向、或全局微调）：当角色**近 N tick 未移动**且**在场人数过密**时，抬 move 权重；并给 move 一个温情语义（遭遇驱动）：
```ts
// :133 move 候选 axisHints 改 + 新增"久居思动"信号:
const sinceMove = acts - (num(char.props["lastMoveAct"]) || 0); // 距上次移动的行动数
const restless = sinceMove > 6 ? Math.min(0.8, (sinceMove - 6) * 0.1) : 0; // 久居→渐增 initiative
candidates.push({
  id: `${base}-move`,
  characterId: char.id, kind: "move",
  summary: `${char.name}转往${snapshot.locations[dest]?.name ?? dest}`,
  axisHints: { initiative: 0.4 + restless, harmony: 0.2 }, // +harmony: 移动=「去结新缘」非冲突, 温情不减暖
  payload: { deltas: [{ characterId: char.id, set: { locationId: dest, lastMoveAct: acts + 1 } }] as StateDelta[], reflection },
});
```
> **效果**：主角/配角偶尔真的「走一段没去过的路」，制造**新遭遇**（到新 location 遇新人）→ 喂 E1 的 newcomer/faction-首现，而非永远同一拨人在同一处 ally。这才是「处境真挪移」的物理来源。**守 cr**：move 加的是 harmony+initiative，零 discord，不推高 clash。

### S3【治本·破姓陈】newcomer 命名多样化 — `packs/xianxia-bazi/index.ts:310-318`（及 gentle 命名路径）

现状：xianxia `spawnName` 名字池 12 个用尽后 `XSUR×XGIV` 组合（已较丰富）；但 renjian 温情世界的 18 个新人 72% 姓陈（来自 gentle 专属命名/LLM 路径，**不在此池**）。
- **定位待办**：grep 确认温情世界 CharacterEntered 的命名来源（疑在 server 侧 gentle spawn 或 reviveFaction 模板）。若是固定姓氏数组，扩为多姓池：
```ts
// gentle 命名路径(疑 server.ts / longrun reviveFaction): 若现为 ["陈"+给定名], 改:
const GSUR = ["陈","柳","李","张","苏","沈","顾","周","郑","秦","许","何","韩","冯"]; // 14 姓
const GGIV = ["是","风","明","笑","雪","远","微","之","初","禾","朗","安","和","守","拙","闲"];
function gentleName(seed: number): string { return GSUR[seed % GSUR.length]! + GGIV[(seed >> 4) % GGIV.length]!; }
```
> **效果**：18 个新人姓氏从 4 种→14 种，E1 的 newcomer 多样性信号真有料；W_emerge 的 faceVariety 项可读出。**确定性**：seed 用 spawn index/hash，禁 random。

### E1【放大器·材料】新建 `app/gentle-emergence.ts`（抽**结构事实**，非 summary 串）

**新文件**（镜像 gentle-director/warm-fitness 叶子层：纯 app、纯符号、零 LLM、resume 安全；**绝不渲染原始 summary**，**绝不含 Fell/Transcended**）：
```ts
// app/gentle-emergence.ts — 涌现际遇摄入(T2' 情节维): 从 newEvs 抽【带新颖闸的结构事实】,
//   渲染成温润"近来世间"一句供 weave 注入。吸收批评: 不渲染原始 summary(防注入"与虚谷"重复向量),
//   不含 Fell/Transcended(守 gentle-director 铁律), 只取首次结识/faction首现/tier跨越/移动遭遇。
import type { WorldEventRecord } from "../core/domain/events";
import type { WorldSnapshot } from "../core/domain/world";

export interface EmergeDigest { newcomers: string[]; firstBonds: string[]; advances: string[]; arrivals: string[]; any: boolean }

// seenFactions/seenPairs: 跨章累积状态(longrun 主循环持有, 传入), 实现"首次"闸。
export function gentleEmergence(
  newEvs: WorldEventRecord[], snap: WorldSnapshot,
  seenFactions: Set<string>, seenPairs: Set<string>,
): EmergeDigest {
  const newcomers: string[] = [], firstBonds: string[] = [], advances: string[] = [], arrivals: string[] = [];
  for (const e of newEvs) {
    if (e.kind === "CharacterEntered") {
      const p = e.payload as { name?: string; faction?: string };
      // 新颖闸: 仅当 faction 此前未见(首现) → 才算"新世态", 否则跳过(防"又一个某派的人")
      if (p.faction && !seenFactions.has(p.faction)) { newcomers.push(p.faction); seenFactions.add(p.faction); }
    } else if (e.kind === "StageCommitted") {
      const id = (e.payload as { chosenCandidateId?: string }).chosenCandidateId ?? "";
      const m = id.match(/^(\w+)-ally-(\w+)$/);
      if (m) { // 新颖闸: 仅"首次结识"的对子才入(关系对此前未出现)
        const pair = [m[1], m[2]].sort().join("~");
        if (!seenPairs.has(pair)) {
          seenPairs.add(pair);
          const a = snap.characters[m[1]!]?.name, b = snap.characters[m[2]!]?.name;
          if (a && b) firstBonds.push(`${a}与${b}`); // 只给"谁与谁初识", 措辞留给 LLM
        }
      } else if (/-move\b/.test(id)) { // S2 启用后 move 才有事件; 移动=遭遇契机(非作别/非兴亡)
        const a = (e.payload as { summary?: string }).summary ?? "";
        if (a) arrivals.push(a.replace(/^.*转往/, "有人正动身前往")); // 去人名, 只留"有人远行"
      }
    } else if (e.kind === "ProgressionAdvanced") {
      const p = e.payload as { characterId?: string; toTier?: string };
      const nm = p.characterId ? snap.characters[p.characterId]?.name : undefined;
      if (nm) advances.push(`${nm}近来心境/道行有所长进`); // tier 跨越=真处境变化
    }
    // ❌ 绝不取 CharacterFell/CharacterTranscended/avenge/clash(守 T2 铁律, 不引戏剧)
  }
  const uniq = (a: string[], n: number) => [...new Set(a)].slice(-n);
  const d = { newcomers: uniq(newcomers, 2), firstBonds: uniq(firstBonds, 2), advances: uniq(advances, 2), arrivals: uniq(arrivals, 1) };
  return { ...d, any: d.newcomers.length + d.firstBonds.length + d.advances.length + d.arrivals.length > 0 };
}

// 渲染: 邀请式、温润、只陈述"世间冒出这些", 不指令"必写谁"(吸收批评④)。
export function renderEmergence(d: EmergeDigest): string {
  if (!d.any) return "";
  const parts: string[] = [];
  if (d.newcomers.length) parts.push(`近来这一带似有${d.newcomers.join("、")}的人往来`);
  if (d.firstBonds.length) parts.push(`${d.firstBonds.join("、")}初初相识`);
  if (d.arrivals.length) parts.push(d.arrivals.join("、"));
  if (d.advances.length) parts.push(d.advances.join("、"));
  return parts.join("；") + "。";
}
```

### E2【放大器·注入】emerge 进 weave（单路/章 + gap 节流 + 邀请式 + rebase 4 参）— `longrun.ts:410-414`

现状（4 参，已落地）：
```ts
if (GENTLE && pledger && weave === "") {
  const stageGoal = beatForChapter(outlinePlan, n);
  const curBeat = beatObjForChapter(outlinePlan, n);
  const prevStage = curBeat ? beatForChapter(outlinePlan, curBeat.from - 1) : "";
  if (stageGoal) weave = nextProgressTask(pledger, n, stageGoal, prevStage);
}
```
改为（emerge 作 nextProgressTask 第 5 参；节流由 nextProgressTask 内 gap<8 统一守；**单路**——emerge 只在 nextProgressTask 决定施压时附带，不另开通道）：
```ts
// longrun.ts import 区加:
import { gentleEmergence, renderEmergence } from "./gentle-emergence";
// 主循环状态(longrun.ts:56 附近, 与 pledger 同级, 跨重启可不持久——seen 集合可由 progression-ledger 落盘或每次重建):
let seenFactions = new Set<string>(); let seenPairs = new Set<string>();

// :410-414 改:
if (GENTLE && pledger && weave === "") {
  const stageGoal = beatForChapter(outlinePlan, n);
  const curBeat = beatObjForChapter(outlinePlan, n);
  const prevStage = curBeat ? beatForChapter(outlinePlan, curBeat.from - 1) : "";
  const emerge = renderEmergence(gentleEmergence(newEvs, snap.snapshot, seenFactions, seenPairs)); // 同份 newEvs, 零额外读库
  if (stageGoal) weave = nextProgressTask(pledger, n, stageGoal, prevStage, emerge); // ← 第5参, 见 C2
}
```
> **单路保证**：emerge 只在 `weave===""`（伏笔空窗）且 nextProgressTask 判定施压（gap≥8）时进入，且**附在同一句**里，不新开 prompt 块——彻底避免「三路施压叠加」。
> **seen 集合**：若要 resume 严格复现，可把 `seenFactions/seenPairs` 序列化进 progression-ledger.json（加 2 字段）；否则每次重启重建（轻微首章重复，可接受）。推荐落盘（见 C1 附带）。

### E3【放大器·标注】roster「本章新到」**仅作素材** — `longrun.ts:147/228/359`

吸收批评④「roster 差分仅作素材、不单独成施压标注」——给新到者缀温润标，让 LLM 当「新际遇」写，但**不在 weave 加「本章须写新人」指令**：
```ts
// :228 附近(prevHook 旁)加状态:
let prevPresent = new Set<string>();
// :359 改:
const presentIds = new Set(Object.values(snap.snapshot.characters).filter((c) => c.present).map((c) => c.id));
const arrived = (GENTLE && prevPresent.size > 0) ? new Set([...presentIds].filter((id) => !prevPresent.has(id))) : undefined;
const ros = roster(snap.snapshot, arrived);
prevPresent = presentIds;
// :147 roster 签名加可选参, 命中者缀「·新到此地」(纯标注, 不施压):
function roster(snap: WorldSnapshot, arrivedIds?: Set<string>): string {
  return Object.values(snap.characters).filter((c) => c.present).map((c) => {
    /* ...现有 bonds/fac/loc/gl/inner 拼装不变... */
    const fresh = arrivedIds?.has(c.id) ? "·新到此地" : "";
    return `${c.name}(${natalLabel(c)}·${tierName(c.progressionTier)}${gl?"·"+gl:""}${inner?"·"+inner:""}${fac}${loc?"@"+loc:""}${bonds?"，"+bonds:""}${fresh})`;
  }).join("、");
}
```
> 爽文 `arrivedIds=undefined`→零变更。

### F1【接进化·命门】新增第 6 信号 **W_emerge** — `warm-fitness.ts`

**核心修死穴**（批评④结构性致命）：emerge 走 prose 通道改不动 socialWarmth 的 sim 度量→进化看不见。解法：**新增 W_emerge 直接读事件层涌现多样性**——这样 S1（ally 措辞库）/S2（move 可选）/S3（命名多样）一旦生效，**W_emerge 立刻升**，进化把「会产多样」的基因选出来。
```ts
// warm-fitness.ts: WarmFitness 加 emerge 字段; 权重从 var 再匀 0.05(var 0.30→0.25, 仍最高):
export interface WarmFitness { total: number; var: number; bond: number; social: number; arc: number; progress: number; emerge: number; atCh: number }

// ⑥ 涌现多样性 W_emerge(0..10): 读【事件层】——ally summary 措辞多样性 + faction 首现广度 + move 占比 + tier 跨越频次。
//    纯事件度量(非 prose), 故 sim 层措辞库化/命名多样/move可选 一改即反映 → 进化可见。与 W_social(测 ally 比/暖度)正交: social 测"暖不暖", emerge 测"新不新"。
function emergeDiversity(events: WorldEventRecord[]): number {
  const allySummaries: string[] = []; const factions = new Set<string>(); let moves = 0; let engage = 0; let tierJumps = 0;
  for (const e of events) {
    if (e.kind === "StageCommitted") {
      const id = (e.payload as { chosenCandidateId?: string }).chosenCandidateId ?? "";
      const s = (e.payload as { summary?: string }).summary ?? "";
      if (/-ally-/.test(id)) { allySummaries.push(s.replace(/[一-龥]{2,4}与[一-龥]{2,4}/, "")); engage++; } // 去人名, 留动词
      else if (/-clash-|-avenge-/.test(id)) engage++;
      else if (/-move\b/.test(id)) { moves++; engage++; }
    } else if (e.kind === "CharacterEntered") { const f = (e.payload as { faction?: string }).faction; if (f) factions.add(f); }
    else if (e.kind === "ProgressionAdvanced") tierJumps++;
  }
  // ① ally 措辞多样: 不同动词种类 / ally 总数(单模板→趋 0; 10 词轮替→趋 1)
  const verbVariety = allySummaries.length ? new Set(allySummaries).size / Math.min(allySummaries.length, 10) : 0.5;
  // ② faction 首现广度: 窗内出现的不同 faction 数 / 6(目标多样)
  const facVariety = Math.min(1, factions.size / 6);
  // ③ move 占比: 有移动=处境真挪(0→趋 0; 越多越高, 封顶在 ~15% 即满, 不鼓励满世界乱跑)
  const moveRatio = engage ? Math.min(1, (moves / engage) / 0.15) : 0;
  // ④ tier 跨越频次: 窗内 ProgressionAdvanced 数 / 4
  const tierFreq = Math.min(1, tierJumps / 4);
  return +Math.max(0, Math.min(10, 10 * (0.4 * verbVariety + 0.25 * facVariety + 0.2 * moveRatio + 0.15 * tierFreq))).toFixed(2);
}

// computeWarmFit 改: 加 wEmerge, 重配权重(var 0.30→0.25, 余不变, emerge 0.05):
const wEmerge = emergeDiversity(events);
const total = +(0.25*wVar + 0.25*wBond + 0.20*wSocial + 0.15*wArc + 0.10*wProg + 0.05*wEmerge).toFixed(2);
return { total, var: wVar, bond: wBond, social: wSocial, arc: wArc, progress: wProg, emerge: wEmerge, atCh: snapshot.tick ?? 0 };
```
> **附带**：arcWarmth 的 WARM_DONE 正则须加 S1 新动词（煮茶|夜话|结伴|对弈|切磋|援手|闲话）避免新措辞被误判非完成。saveWarmFit 的 history push 加 emerge 字段。
> **为何 var 0.30→0.25 而非动 social/progress**：var 已 9.84 满到顶，匀 0.05 给 emerge 不损 W_var 施压主力（仍 0.25 并列最高），且**绝不动 W_progress/W_social 语义**（守批评④）。**W_var≥9.4 命门**：var 权重虽降，但 gentle-director 一字不改、var 绝对值不变，9.84≫9.4 安全。

### F2【真实化】progressMomentum freshScore 修正（不删 reachedScore，降权）— `warm-fitness.ts:97-108`

现状假高（实测 reachedScore=10 占 0.6 权重锁高 ≈9.2）。修正：降 reachedScore 权重、抬 freshScore，让「持续长新处境」才持续给分，「剧本耗尽躺平」掉分：
```ts
function progressMomentum(dir: string): number {
  const pl = loadPL(dir);
  if (!pl || (pl.reachedMilestones.length === 0 && pl.writtenBeats.length === 0 && pl.lastAdvanceCh === 0)) return 5;
  const reachedScore = Math.min(10, pl.reachedMilestones.length * 2.5);
  // 新鲜分: 当前章(取 writtenBeats 末 ch)距上次处境真挪移; ≥60 章未挪→0(收紧 80→60, 更敏感)
  const lastBeatCh = pl.writtenBeats.length ? pl.writtenBeats[pl.writtenBeats.length-1]!.ch : pl.lastAdvanceCh;
  const sinceAdvance = Math.max(0, lastBeatCh - pl.lastAdvanceCh);
  const freshScore = pl.lastAdvanceCh > 0 ? Math.max(0, 10 - (sinceAdvance / 60) * 10) : 3;
  // 权重翻转: 0.35·达成(脊梁在走) + 0.65·新鲜(近期真挪移) → 剧本耗尽不再锁高, 须持续长新才高
  return +Math.max(0, Math.min(10, 0.35 * reachedScore + 0.65 * freshScore)).toFixed(2);
}
```
> 调用点 :115 去 `recentCh` 参（不再需要）。**效果**：renjian 现 lastAdvanceCh:48 距 writtenBeats 末 ch≈70 → freshScore≈10−22/60×10≈6.3 → progress=0.35×10+0.65×6.3≈7.6（仍偏高因 writtenBeats.ch 跟随章涨）。**真正的真实化靠 C1**：让 lastAdvanceCh 随处境语义差分刷新，则停滞时 sinceAdvance 真涨、freshScore 真掉。F2 只是降权使其敏感。

### C1【处境真挪移】advanceStep 加语义差分（**保留** arcMilestones）— `progression-ledger.ts:68-94`

吸收批评①「保留 arcMilestones」——**不删 milestone 判定**，**增量**加处境语义差分：里程碑达成 OR 处境语义真变，都刷 lastAdvanceCh：
```ts
export async function advanceStep(
  pl: ProgressLedger, recentChapters: Array<{ goal: string; text: string }>,
  arcMilestones: Array<{ id: string; goal: string }>, n: number, llm: LLMProvider,
): Promise<ProgressLedger> {
  const out: ProgressLedger = { ...pl, situation: { ...pl.situation }, reachedMilestones: [...pl.reachedMilestones], writtenBeats: pl.writtenBeats };
  try {
    const raw = await llm.complete(/* ...现有 prompt 不变, 仍判 place/role/nearPerson/reached... */);
    const j = JSON.parse(/* ... */) as { place?: string; role?: string; nearPerson?: string; reached?: unknown };
    // [新增] 处境语义差分: 新报 place/role/nearPerson 与旧值 2-gram Jaccard<0.6 → 处境真挪移
    const moved = (["place","role","nearPerson"] as const).some((k) => {
      const nv = (j as Record<string, unknown>)[k], ov = (out.situation as Record<string, string>)[k];
      if (typeof nv !== "string" || !nv.trim()) return false;
      return !ov || jaccard(grams2(nv), grams2(ov)) < 0.6; // grams2: 从 beatSig 抽的 2-gram helper(见下)
    });
    if (typeof j.place === "string" && j.place.trim()) out.situation.place = j.place.slice(0,60);
    if (typeof j.role === "string" && j.role.trim()) out.situation.role = j.role.slice(0,60);
    if (typeof j.nearPerson === "string" && j.nearPerson.trim()) out.situation.nearPerson = j.nearPerson.slice(0,60);
    // 里程碑达成(保留现逻辑)
    const validIds = new Set(arcMilestones.map((m) => m.id));
    const reached = Array.isArray(j.reached) ? j.reached.filter((x): x is string => typeof x === "string" && validIds.has(x)) : [];
    let gotNew = false;
    for (const id of reached) if (!out.reachedMilestones.includes(id)) { out.reachedMilestones.push(id); gotNew = true; }
    if (gotNew || moved) out.lastAdvanceCh = n; // ← 里程碑达成 OR 处境语义真变, 都算推进(关键改动)
  } catch { /* 保持原样 */ }
  out.turn++;
  return out;
}
// progression-ledger.ts 新增导出 helper(从 beatSig 切分逻辑抽; warm-fitness/advanceStep 共用):
export function grams2(s: string): Set<string> {
  const t = (s ?? "").replace(/\s+/g, ""); const out = new Set<string>();
  for (let i = 0; i + 2 <= t.length; i++) { const g = t.slice(i, i + 2); if (/^[一-龥]{2}$/.test(g) && isContentGram(g)) out.add(g); }
  return out;
}
```
> **效果**：剧本 6 里程碑达成后，**处境仍能因「去新地/识新人」刷新 lastAdvanceCh** → progress 不再锁死，跟随真实涌现起伏（这正是方案生效信号：progress 曲线从「锁 9.2」变「随涌现呼吸」）。
> **resume**：仍基于 turn/章号确定性；处境差分由 LLM（temp 0.2）判，有 try/catch 兜底。
> **附带**：可在 ProgressLedger 加 `seenFactions?: string[]; seenPairs?: string[]` 持久化 E1 的 seen 集合（advanceStep 顺手写回），实现严格 resume。

### C2【施压·邀请式】nextProgressTask 加 emerge 第 5 参（**保留** stageGoal）— `progression-ledger.ts:52`

```ts
export function nextProgressTask(pl: ProgressLedger, n: number, stageGoal: string, prevStageGoal: string, emerge = ""): string {
  const gap = n - pl.lastAdvanceCh;
  if (gap < 8) return "";                              // gap 节流(单路+静默, 不变)
  const recent = pl.writtenBeats.slice(-12);
  const candidate = new Set(recent.length ? recent[recent.length-1]!.sig : []);
  const history = new Set(recent.flatMap((b) => b.sig));
  const stale = candidate.size > 0 && jaccard(candidate, history) > 0.5;
  const fromTo = prevStageGoal ? `已从「${prevStageGoal}」起步，` : "";
  // emerge 素材作"邀请式"补充(吸收批评④⑤): "世间有这些动静, 可拾一二自然融入", 非"必须写谁"
  const seed = emerge ? `——世间近来有这些动静，可拾一二自然融入：${emerge}（与新来的人结识、送一程远行者、应一桩寻常求助、把一段交情推近都好，由眼前情形自然生发，不必奔向什么结局）` : "（识一个从未出现的人、走一段没去过的路、把那桩牵念再推近一步）";
  return stale
    ? `${fromTo}近来情形与前几章太相似了——本章宜有一处**新的**人生际遇自然涌现${seed}，朝「${stageGoal}」缓缓挪动；仍温润、不靠冲突。`
    : `${fromTo}本章宜让主角处境朝「${stageGoal}」缓缓挪一小步${seed}；温润收束、不靠冲突。`;
}
```
> **保留 stageGoal**（outline 软脊梁方向锚）+ emerge（素材）分工。措辞**邀请式**「可拾一二」「不必奔向结局」——守批评⑤防 prose 逃逸。**单路**：emerge 只此一处入 prompt。

---

## 4. 验证度量（处境持续长新 / 拍子不重演 / 不奔死终点 / 守命门 / 对照不循环）

| 目标 | 度量 | 通过线 | 数据源 |
|---|---|---|---|
| **处境持续长新（不冻）** | progression-ledger `lastAdvanceCh` 是否随章推进；`atCh − lastAdvanceCh` gap | gap 长期 < 30（旧 live：321−48=**273**，冻死）| progression-ledger.json |
| **拍子不重演** | writtenBeats 近 8 拍两两 2-gram Jaccard 均值 | < 0.35（control 实测虚谷在 ch59/63/67/69 反复→高）| progression-ledger.json |
| **不奔写死终点** | outline 末 beat「成神仙」是否提前达成并锁死；progress 是否封顶不动 | progress 不再恒≥9（应随涌现起伏 5–9）| warm-fitness-history.json |
| **W_var ≥ 9.4 命门** | warm-fitness.var | ≥ 9.4（现 9.84，权重降 0.05 后须复测仍 ≥9.4）| warm-fitness.json |
| **conflictRate 守 [0.5,0.65]** | genome.engine.conflictRate；clash+avenge 占 engage 比 | cr ∈ [0.5,0.65]（现 0.6）；clash 比不升（现 25%）| genome.json + 事件计数 |
| **涌现多样性真升（治本生效）** | **W_emerge**；ally summary 去名后 unique 种类数 | W_emerge ≥ 6（旧≈2：ally 单模板+faction 已 6 但 move=0/tier 稀）；ally 动词 ≥ 5 种（旧 **1**）| warm-fitness.json + sqlite |
| **move 真发生** | StageCommitted `-move` 计数 / engage | move 比 5–15%（旧 **0%**）| sqlite |
| **social 真动（结构问题解）** | warm-fitness.social 趋势 | 上行或稳 ≥ 5（旧 4.60→4.17 平趴；control 振荡无趋势）| warm-fitness-history.json |
| **对照旧循环明显不循环** | 新世界 #4 vs control：ally 模板种类、faction 广度、move 比、social 趋势、处境 gap | 全维显著优于 control（见 §6）| 两库对比 |

**生效信号锚点（最关键一条）**：上 C1+F2 后，renjian progress 曲线应从「锁 9.2」**立刻反映真实**（lastAdvanceCh:48 vs atCh:321 → freshScore 真跌），随后随章节真正端进新人/新处境（S1/S2/S3 供料）而**回升并起伏**——这条「从锁死→跟随涌现」的曲线即方案生效证据。W_emerge 应从 ≈2 → ≥6。

---

## 5. 风险与保证（六重红线，逐条钉死）

| 红线 | 风险 | 保证 |
|---|---|---|
| **真防循环（非换皮）** | 端单模板材料反加循环 | E1 抽**结构事实**非 summary 串 + **首次闸**（faction 首现/对子首识）；**S1 措辞库 + S2 move 可选 + S3 命名多样**从源头产真变体；W_emerge 让进化选「会产多样」基因。**三层防换皮**。 |
| **不奉剧本** | 删 outline 废 C 层 / emerge 指令化 | **保留 outline 软脊梁 + stageGoal**；emerge 作素材补充、**邀请式**「可拾一二/不必奔结局」；方向(soft)≠终点。 |
| **不破温情** | 措辞硬、留白被挤 | 走 weave→叙事任务通道（非 crisis）；措辞温润；**gap<8 静默 + 单路/章** 容呼吸章；ally 措辞库全温情中性词。 |
| **不引戏剧** | partings 含 Fell/Transcended / move 推冲突 | E1 **绝不取 Fell/Transcended/clash/avenge**（守 gentle-director.ts:3 铁律）；S2 move 加 harmony+initiative **零 discord**；W_emerge 不奖 clash。 |
| **不与场景层 T2 冲突** | 抢 var / 撞 occupied | gentle-director **一字不改**；T2 管「在哪演」(空间)、T2' 管「演什么新事」(情节) **正交**；emerge 在 :410 算（occupied :318 已判完）→ 不影响让位；var 权重 0.30→0.25 但绝对值不变、9.84≫9.4。 |
| **保涌现呼吸** | 每章施压把模拟变叙述附庸 | sim 源头(S1/S2/S3)只**扩措辞/抬权重/扩名池**，决策仍由 prior 自然涌现（非脚本指定谁结谁）；施压只「邀请」、检测器只逮「停滞」；core 改动确定性（hash/turn，禁 random）→ resume 复现。 |

**附加风险（吸收批评的实现缺陷）**：
- ⚠️ **S1 `tick` 作用域**：decideCharacter 须能拿到 tick；若不可得，用 `acts` 作漂移源（已在 payload 用）。落地前 grep 确认。
- ⚠️ **S3 命名路径定位**：温情世界 18 个新人的姓陈来源不在 xianxia spawnName 池——须先 grep 定位（疑 server gentle spawn / reviveFaction）再改。**未定位前 S3 不上**。
- ⚠️ **W_emerge 权重移动须复测 var**：var 0.30→0.25 后跑一窗确认 W_var 绝对值仍 ≥9.4（理论不变，但落盘复测）。
- ⚠️ **seen 集合 resume**：推荐落盘进 progression-ledger.json（C1 附带），否则重启首章轻微重复。

---

## 6. A/B 验证法（重开世界 #4 验，control 对照）

**对照基线**：`renjian-killed-20260606-180327`（**380 章 / 1481 commit**，实测 ally 545 条 100% 单模板、move 0、social 3.05–7.68 振荡无趋势、faction 命名堆叠）——**这是「270 章循环」的活体 control**。

**实验组**：重开世界 **#4**（NOVEL_STYLE=温润，NOVEL_BIBLE 同温情 premise），全量上 S1+S2+S3+E1-3+F1-2+C1-2。

**灰度内对照（同一世界纵向）**：
1. **P1（仅 S1 ally 措辞库）**：跑 ~50 章 → 测 W_emerge 的 verbVariety 是否从 ≈0.1→≥0.5、ally 去名 unique 是否 1→≥5。**断点验证：单模板是否破。**
2. **P2（+E1-3+F1-2+C1-2）**：再跑 ~50 章 → 测 progress 是否解锁（不再锁 9.2、随涌现起伏）、处境 gap 是否 <30、weave 是否单路不轰炸（每章 prompt 仅 ≤1 施压块）、W_var 仍 ≥9.4。
3. **P3（+S2 move 可选 +S3 命名多样）**：再跑 ~50 章 → 测 move 比 0→5-15%、faction 广度、social 是否上行。

**跨世界对照（#4 vs control，横向，~150 章对齐）**：
| 指标 | control(旧循环) | #4 目标 | sqlite/json 命令 |
|---|---|---|---|
| ally summary 去名 unique 种类 | **1** | ≥ 5 | `SELECT summary... LIKE '%-ally-%'` 剥名 uniq |
| move 占 engage 比 | **0%** | 5–15% | grep `-move-` / total engage |
| faction 首现广度 | 堆叠少 | ≥ 6 | `SELECT DISTINCT faction FROM CharacterEntered` |
| social 趋势(150 章窗) | 振荡无趋势 | 上行/稳 ≥5 | warm-fitness-history 线性拟合斜率 ≥0 |
| 处境 gap(atCh−lastAdvanceCh) | 大(冻) | < 30 | progression-ledger.json |
| W_emerge | ≈2(估) | ≥ 6 | warm-fitness.json |
| W_var | 9.6–9.92 | ≥ 9.4 | warm-fitness.json |

**判定「明显不循环」**：#4 在 ally 种类、move 比、faction 广度、处境 gap、W_emerge **五维全显著优于 control**，且 social 出现非零正斜率，W_var 守 9.4。任一维不达 → 回退该阶段改动复盘。

**统计严谨**：每阶段跑 ≥3 个 8 章窗取 warm-fitness 均值±范围（对齐 evolve 落盘节奏），避免单窗噪声（control 实测 social 单窗可 3.05–7.68 跳）。

---

## 7. 与场景层温情驱动器（空间维）/ 进展账本的关系

### 7.1 与 gentle-director（T2 空间维）— **正交叠加，非互斥**
- **分工**：gentle-director 管**「在哪演」**（场景/季候/新面孔轮换，守 W_var 意象多样）；T2' 管**「演什么新事」**（际遇/处境/涌现，守 W_emerge 情节多样）。一个换舞台，一个换剧情。
- **不冲突机制**：(a) gentle-director 一字不改；(b) occupied(:318) 已基于 outline+伏笔判完，emerge 在 :410 后才算 → 不影响 T2 让位；(c) emerge 走 weave、sceneShift 走 scene/ambience → 不同 prompt 槽位；(d) var 权重 0.30→0.25 但绝对值不变。
- **协同**：S2 的 move（角色真去新 location）**同时喂两层**——给 gentle-director 新场景的物理依据，给 E1 新遭遇的 newcomer 来源。空间流动与情节涌现在 move 处天然耦合。

### 7.2 与已有进展账本 — **情节维涌现是其升级（非另起）**
进展账本（progression-ledger，已落地）现状 = 「奔 outline 里程碑 + 防拍子循环」，但**里程碑达成即锁高（progress 假高 9.2）**、**材料源是 137 条单模板**。本蓝图是它的**三处升级**：
1. **达标判定升级**（C1）：从「只认里程碑达成」→「里程碑达成 OR 处境语义真变」。处境长新即推进，不依赖剧本耗尽。
2. **材料源升级**（S1/S2/S3 + E1）：从「读单模板 ally summary」→「读带新颖闸的结构事实 + sim 源头产真变体」。
3. **度量接进化升级**（F1）：从「progress 测里程碑（prose 改不动）」→「+W_emerge 测事件层多样性（sim 改即反映）」。进化第一次能「看见并选择」会产涌现多样的基因。

**一句话**：进展账本是「情节维」的**度量回路**，T2' 把这条回路从「奔剧本终点的开环」升级为「跟随真实涌现的闭环」——检测停滞→sim 产多样→W_emerge 选基因→施压邀请→处境真挪移→刷新账本。**空间维（gentle-director）与情节维（T2'）在 move 处耦合，共同构成「世界本身在流动、故事在长新」的温情涌现底座。**

---

## 8. 实现成本与灰度
| 阶段 | 改动 | 文件数 | 行数 | 验证 |
|---|---|---|---|---|
| P1 | S1（ally 措辞库）| 1 (character-actor.ts) | ~12 | ally 种类 1→≥5 |
| P2 | E1-3 + F1-2 + C1-2 | 5 (gentle-emergence新/longrun/warm-fitness/progression-ledger) | ~120 | progress 解锁 + 单路不轰炸 + W_var≥9.4 |
| P3 | S2（move 可选）+ S3（命名多样）| 2 (character-actor.ts + pack/server) | ~25 | move 比 0→5-15% + social 上行 |

**总计 ~7 文件、~155 行**（含 1 新文件 app/gentle-emergence.ts）。**core 改动 2 处**（character-actor.ts S1/S2，确定性、爽文受益不破坏）、**pack 改动 1 处**（S3 命名，需先定位）。零新 LLM 调用增量（advanceStep 仍每 8 章那一次，prompt 不变）。可独立灰度回退。

---

## 关键文件路径（绝对）
- `/Users/chris0810/Documents/Codex/Novel System/app/gentle-emergence.ts`（**新建** E1）
- `/Users/chris0810/Documents/Codex/Novel System/app/longrun.ts`（:147 roster、:228/:359 差分、:410-414 emerge 注入）
- `/Users/chris0810/Documents/Codex/Novel System/app/warm-fitness.ts`（F1 新增 W_emerge、F2 progressMomentum、权重 var 0.30→0.25）
- `/Users/chris0810/Documents/Codex/Novel System/app/progression-ledger.ts`（:52 nextProgressTask 加 emerge 第5参、:68 advanceStep 加语义差分、新增 grams2 导出）
- `/Users/chris0810/Documents/Codex/Novel System/core/actors/character-actor.ts`（**:79 ally 措辞库化 S1**、**:126-141 move 可选 S2**）
- `/Users/chris0810/Documents/Codex/Novel System/packs/xianxia-bazi/index.ts`（:310-318 spawnName）+ 温情命名路径（**待 grep 定位** S3）
- `/Users/chris0810/Documents/Codex/Novel System/app/evolve.ts`（W_emerge 经 loadWarmFit 自动折进 GENTLE 基因适应度，无需改）
- 对照：`/Users/chris0810/Documents/Codex/Novel System/.novel-output/renjian-killed-20260606-180327/`（control: 380 章 / 545 单模板 / move 0 / social 振荡）
- 证据：`/Users/chris0810/Documents/Codex/Novel System/.novel-output/renjian/{world.db,warm-fitness.json,warm-fitness-history.json,outline-plan.json,progression-ledger.json,genome.json}`
