# 全局传承层 → 跨世界 QD/niche 存档 · 完整升级蓝图

> 落点: `.audit/20260604-global-qd-evolution/synthesis.md`
> 状态: **代码事实层已核实, 但对抗式评审(见 critique.md)实测发现 3 处机制论证落空、需补 X1/X2/X4 才能施工**。T0(原子写)可即施工; T1 可施工但 legacy 格对解搁浅无益; T2/T3 须先补丁。所有行号/字段名/落盘事实已对当前 `app/evolve.ts`(299 行) + `.novel-output/` 真实数据逐字核对。
> 作者层: 首席架构师综合 4 路调研(QD-SOTA / 行为描述符 / 现码事实 / 迁移风险)。
> 一句话: 把 `global-evolution.json` 的 `genome`(单冠军) 升级为 `cells`(按全局行为利基分格、每格各留最优), 把 `promoteToGlobal` 的「全局夺冠才传」改成「per-niche 单调入库」, 把 `loadGenome` 的「取全局唯一冠军」改成「按目标 niche 取种」。这是 Multi-task MAP-Elites(Mouret & Maguire 2020, arXiv:2003.04407)Algorithm 1 的工程搬运。

---

## ① 问题陈述: 单冠军 wholesale 导致群像引擎搁浅传不出

### 1.1 现状机制(已核对 evolve.ts)

- **per-world 存档**(L33 `Cell`、L248 `key`): cell 按 `语气×节奏`(5×3=15 格)分桶, 每格留该格 fitness 最优的整份 `genome`(含 7 个 engine 旋钮)。这一层是健康的 MAP-Elites。
- **engine 旋钮在世界内已与风格格解耦**(L31/241/269): `bestEngine` 按 `simFit` 单点爬山, 跨 15 格共享一份, 存在 `ledger.bestEngine`, **不在 cell.genome、不在 global**。
- **全局传承层**(L80-105 `promoteToGlobal`、L99 选基因循环): 跨**所有世界所有 cell** 取 `fitness` 全局最大那一个 cell, **整份基因 wholesale 接管**(`bestGenome = {...cloneGenome(c.genome), generation:0}`), 落盘成 `global-evolution.json.genome`(单个 `Genome`)。**这是病根**: 全局层退回「单一标量适应度 + 单点最优」, 零行为多样性维度。

### 1.2 实例: arcsaga 群像引擎传不出去(实测数据)

被 kill 的 arcsaga 副本 `arcsaga-killed-20260604-181357/archive.json` 6 格, 全是一套**连贯的群像配方**:

| cell | fitness | conflictRate | turnoverRate | structureGrowth |
|---|---|---|---|---|
| 冷峻×急促 | 6.15 | 1.25 | **0.5** | 0.5 |
| 冷峻×均衡 | 6.06 | 1.0 | **0.5** | 0.75 |
| 悬疑×均衡 | 6.02 | 1.2 | **0.5** | 0.7 |
| 冷峻×绵长 | 6.14 | 1.0 | **0.5** | 0.5 |
| 悬疑×急促 | 6.03 | 1.25 | **0.5** | 0.5 |
| 悬疑×绵长 | 5.86 | 1.45 | **0.5** | 0.5 |

低 `turnoverRate=0.5`(人物长寿、群像不坍塌) + 适度 `structureGrowth=0.5-0.75`(派系分裂/新生) + 高 `conflictRate` —— 这正是 MEMORY 里「群像友好=高冲突+低代谢」的配方, 对群像类世界很对。

**但当前 `.novel-output/global-evolution.json` 的 `genome.engine` 是**:

```json
"engine": { "priorWeight":1, "scarcity":0, "conflictRate":1, "eventBias":1, "turnoverRate":1, "nicheWeight":0, "structureGrowth":0 }
```

**全默认**。`bestFitness:7.53`。即: 那套群像配方(simFit/混合 fitness 约 6.0-6.15)**在全局标量冠军赛里输给了某个 7.53 的文笔向冠军, 于是被 wholesale 丢弃**。全局冠军的 engine 恰好是全默认(单主角、高代谢、零结构生长)——下一个新世界(哪怕是群像类)继承到的起步引擎是**全默认**, 群像配方对它毫无传承。这就是「搁浅」: 群像引擎在 per-world 存档里被验证有效, 却因没夺整体适应度冠军, 永远沉不进全局、传不到下一个该用它的世界。

### 1.3 根因(QD 文献定性)

纯目标驱动搜索有**欺骗性(deception)/模式坍塌(mode collapse)**: 直奔单一全局最优 → 把暂时不是冠军、但通往更优解的「踏脚石(stepping stones)」清零(QDHF arXiv:2310.12103; Gravina "stepping stones"; Lehman & Stanley)。**「没夺冠就不传」= 主动制造模式坍塌**。arcsaga 的群像配方就是被当前全局层扔掉的踏脚石。修法 = 给全局存档加**低维行为描述符**, 让群像引擎占一个**结构上独立、文笔冠军永远覆盖不了的 cell**。

---

## ② 目标 QD 存档设计: 全局 niche 维度 + 廉价测量 + 分桶

### 2.0 设计约束(读码后修正调研的两处假设)

> ⚠ **修正 A(载重)**: 行为描述符调研声称维度 A/B/C 所需数据「已全部落盘于 `sim-fitness.json`, 无需新采集」——**部分不实**。逐字核对 `.novel-output/mystory/sim-fitness.json` 落盘顶层键仅: `sift{chains,quality,score,top,patterns,dangling}` / `tension{polarization,balance,directness,intensity,resolution,volatility,score}` / `novelty` / `total` / `vol` / `atCh`。`present`(在场人数)、`liveFactions`(活派系数)、`survivalRatio`、`sentLenMean` **在 `computeSimFitness` 里算了但没落盘**(只用于算分后丢弃)。因此维度 A(群像规模存活)**必须新增 2-3 个标量持久化**, 否则 promote 时拿不到。`sentLenMean` 例外: 它以 `slm` 落在 `evolution.json.scores[].slm`(已核对, 最近值 14.6/15.1/16.6), 维度 C 可直接取。`polarization`/`patterns`/`volatility` 在 `sim-fitness.json`, 维度 B 可直接取。

> ⚠ **修正 B**: 维度数务必克制。per-world 15 格在实测里常年填不满(mystory 仅 6 格, arcsaga 6 格)。全局跨少数活世界, **3 维 3×3×3=27 格已偏稀疏上限**, 严禁叠 conflict(5)成 75 格(E1)。MVP 先上 **2 维**(见下), 留 1 维做 T2 扩展位。

### 2.1 选定全局 niche 维度(MVP=2 维, 满载=3 维)

选维准则: **对 engine 旋钮敏感**(全局层要照亮的是引擎旋钮空间, 不是文笔措辞)+ **读者可感** + **廉价可测** + **正交**。砍掉 `tone`(它几乎只由文笔参数 + LLM 措辞决定, 对 engine 旋钮不敏感; 放进全局网格只会把群像引擎稀释成 5 个 tone 桶、每桶更易被冠军覆盖, 反而**加剧搁浅**; tone 留在 per-world 即可)。

#### 维度 A — 群像规模×存活(Ensemble Survival) 【最关键, 给群像引擎独立坐标】【MVP 必上】

- **读者可感**: 「孤胆主角文」vs「一大群人都活着、互相纠缠的群像文」。
- **廉价测量**(snapshot + events, 算法已在 `sim-fitness.ts` L130-133, 但需新持久化):
  - `present = |{c ∈ snapshot.characters : c.present}|`(L130 已在数)
  - `survivalRatio = present / count(CharacterEntered)`(L67 `entered` 已读; 实测 mystory present=10 / entered=39 = 0.26)
  - 合成 `ensembleScore = log1p(present) × survivalRatio`(规模大**且**留得住才高分; 惩罚「开局堆人后灭门」——这层惩罚天然抗 reward-hack)
- **分桶(3 档)**: `独狼`(present≤3 或 survivalRatio<0.25) / `小队`(中段) / `群像`(present≥7 **且** survivalRatio≥0.4)。阈值用各世界历史 34/67 分位自适应(复刻 L161 `rhythmBin` 分位法), 冷启动回退固定阈值。
- **为何抓得住群像配方**: 低 `turnoverRate`(L17 登场/陨落代谢↓)→ `CharacterFell` 少 → present 高、survivalRatio 高 → **必落 `群像` 桶**; `structureGrowth`(派系分裂/新生)→ 持续补人 → present 不衰减。**维度 A 就是这套旋钮的可观测投影**。

#### 维度 B — 戏剧结构形态(Dramatic Structure) 【区分涌现派系网 vs 孤立爽点】【MVP 必上, 数据全在盘】

- **读者可感**: 「一盘散沙的单点爆点」vs「势力间结成网、牵一发动全身的连锁」。
- **廉价测量**(**零新代码、零新持久化**, 全取 `sim-fitness.json` 现成字段):
  - `polarization`(敌对派系图密度, 落盘字段, mystory=0.103)
  - 连锁型模式占比 `chainTypeRatio = (巨变连锁+覆灭复兴+宿敌易主 类) / Σ sift.patterns`(`patterns` 已落盘, 如 `{复仇闭环:1,崛起陨落:1}`)
  - `structureScore = 0.5·polarization + 0.3·chainTypeRatio + 0.2·min(1, |patterns 型数|/5)`
- **分桶(3 档)**: `线性`(polarization 低、连锁少) / `多线`(中) / `网状涌现`(高 polarization + 高连锁)。
- **为何正交于 A**: A 问「有多少人活着」, B 问「他们之间结成什么形状」。可群像但线性(很多人各演各的), 也可独狼但网状(一人搅动多派系)——四象限都真实, 不冗余。`structureGrowth` 同时抬 A 和 B, 但**抬法不同**(A 看人数留存, B 看关系图拓扑), 非同一信号。

#### 维度 C — 节奏/烈度(Pace & Intensity) 【T2 扩展位, 承接已有 rhythm】

- **廉价测量**(零新持久化): `sentLenMean`(取 `evolution.json.scores[].slm`)+ `volatility`(`sim-fitness.json` 落盘)。`paceScore`: 句越短 + volatility 越高 → 越「快」。
- **分桶(3 档)**: `急促/均衡/绵长` —— **直接等同 per-world RHYTHMS**, 同名同阈值, 无缝对齐。
- **MVP 不上 C** 的理由: 先用 2 维(A×B=9 格)保证不稀疏, 验证群像引擎能传后, 再加 C 升 27 格(灰度第 4 步)。

### 2.2 为何 A×B 能把「文笔最优」与「群像引擎最优」分到不同 cell(解搁浅)

**机制级论证**(靠数据通路, 非直觉):

1. **两类配方的描述符向量本质不同**:
   - *文笔冠军*: 高 fitness 来自 LLM rubric(freshness/hook, fitnessOf L133 权重 0.62)。它 `turnoverRate≈1`(默认)、`structureGrowth≈0` → 人物高代谢、派系不生长 → present 低、连锁少 → **A=独狼/小队, B=线性**。典型坐标 `(独狼,线性)`。
   - *群像引擎*(arcsaga 实测): `turnoverRate=0.5` + `structureGrowth=0.5-0.75` + `conflictRate=1.25` → present 高、派系网密 → **A=群像, B=网状**。坐标 `(群像,网状)`。
2. **不同 cell ⇒ 不可互相覆盖**(MAP-Elites 核心契约, 对应 per-world L249-253): 入格只和**同 key 的精英**比 fitness。`(群像,网状)` 的精英只跟自己历史比, **文笔冠军 fitness=7.53 再高也进不了这个 cell、覆盖不了它**。搁浅消失——群像配方有了产权独立的栖位。
3. **修掉「单一全局 bestGenome」瓶颈**: 当前 L99 全局一个 `bestGenome`。新方案下 engine 基因随它落入的 (A,B) cell 一起存档 = 把「1 个全局最优引擎」扩成「9 个 niche 各自的最优引擎」。群像引擎作为 `(群像,网状)` 格主**永久在册**, 下个群像类新世界从这格取种起跑。
4. **抗 reward-hacking 已内建**: 维度 A 的 `survivalRatio` 惩罚「开局堆人后灭门」; 维度 B 的 `polarization` 只算**有在场成员的派系对**(sim-fitness L132-141, 空壳关系不撑分); `sim-fitness.ts` L227 `massacre` 折扣还在(volatility≥0.9 且 resolution<0.3 → ×0.75)。**群像格只能靠真·低代谢+真·活派系进入**, 描述符诚实。

---

## ③ global-evolution.json 新 schema(向后兼容旧单基因格式)

### 3.1 类型(改 evolve.ts L72 `GlobalEvo`)

```ts
// 新增: 全局 niche cell。复用 per-world Cell 的基因/适应度语义, 但 key 换成全局行为描述符。
export interface GlobalCell {
  key: string;            // "群像×网状"(MVP 2 维) / 满载 "群像×网状×均衡"
  ensembleBin: string;    // 独狼/小队/群像
  structureBin: string;   // 线性/多线/网状
  paceBin?: string;       // 急促/均衡/绵长(T2 才有)
  genome: Genome;         // 该 niche 全局最优整份基因(gen + 7 engine 旋钮)
  fitness: number;        // 该 niche 历史最优混合 fitness(与 per-world 同口径)
  ensembleScore: number;  // 维度 A 原始标量(供调试/重新分桶)
  structureScore: number; // 维度 B 原始标量
  from: string;           // 贡献该格的世界目录名(留痕、便于审计)
  at: string;             // 卷号 "v6"
}
export interface GlobalEvo {
  avoid: string[];                       // 不变(跨世界频次降序, ≤60)
  genome: Genome | null;                 // 【保留】= cells 里 fitness 最高那格的基因, 作向后兼容投影(派生视图)
  bestFitness: number;                   // 【保留】= 上面那格的 fitness(面板曲线含义不变)
  from: string[];                        // 不变(贡献 avoid 的世界名)
  cells?: Record<string, GlobalCell>;    // 【新增】事实源: key→全局 niche 精英。旧文件无此键, loadGlobal 兜底成 {}
}
```

**关键设计**: `genome`/`bestFitness` **不删**, 降级为「派生视图」(= `cells` 里 fitness 最高格的基因/分数)。`cells` 成为事实源。这样:
- server.ts L198 `/state` 透传前端的字段不破(B2/G2)。
- `loadGenome` L55、`loadLedger` L64 对 `loadGlobal(d).genome`/`.avoid` 的强依赖不破(G1)。
- 旧 reader 看到的还是熟悉的 `{avoid,genome,from,bestFitness}`; `cells` 对它是附加数据。

### 3.2 向后兼容(旧 `{avoid,genome,from,bestFitness}` 零迁移可读)

`loadGlobal`(L76)的 spread 兜底加一个 `cells:{}` 默认即可:

```ts
return existsSync(f)
  ? { avoid:[], genome:null, from:[], bestFitness:0, cells:{}, ...JSON.parse(readFileSync(f,"utf8")) }
  : { avoid:[], genome:null, from:[], bestFitness:0, cells:{} };
```

旧文件无 `cells` → spread 后得空字典。**首次 `promoteToGlobal` 落盘时**, 把旧单冠军 `genome`(bestFitness=7.53)合成为一个 `legacy` 1-niche cell 注入 `cells`(见 ④ 的 seed 逻辑), 旧字段继续写出。零停机数据迁移, 旧历史不丢。

---

## ④ promoteToGlobal 改写(per-niche 沉积 + 单调累积 + 防并发覆盖)

改 evolve.ts L80-105。三个不变量: **(C1) 每 niche 只增不减**、**(C2) 清世界不清空(以 prev.cells 为基底)**、**(C3) 原子写防半截读/并发互覆盖**。

### 4.1 新 promoteToGlobal(完整逻辑, 替换 L80-105)

```ts
import { renameSync } from "node:fs";  // 新增

// 全局 niche 分桶(廉价, 复用 sim-fitness/snapshot)。返回 null 表示数据不足、跳过该世界。
function globalNiche(D: string): { key:string; eb:string; sb:string; es:number; ss:number } | null {
  const sf = loadSimFitness(D); if (!sf) return null;
  // 维度 B(全在盘): polarization + 连锁型 patterns 占比
  const chainTypes = ["巨变连锁","覆灭复兴","宿敌易主","复仇闭环"]; // 连锁型(可按实际 pattern 名调)
  const pats = sf.sift.patterns ?? {};
  const totP = Object.values(pats).reduce((a,b)=>a+b,0) || 1;
  const chainRatio = chainTypes.reduce((a,t)=>a+(pats[t]??0),0) / totP;
  const ss = +(0.5*sf.tension.polarization + 0.3*chainRatio + 0.2*Math.min(1,Object.keys(pats).length/5)).toFixed(3);
  const sb = ss >= 0.45 ? "网状" : ss >= 0.2 ? "多线" : "线性";
  // 维度 A: 需要 present/survivalRatio —— 见 4.3 持久化方案; 读 sf.ensemble (新落盘字段)
  const present = sf.ensemble?.present ?? 0;
  const survival = sf.ensemble?.survivalRatio ?? 0;
  const es = +(Math.log1p(present) * survival).toFixed(3);
  const eb = (present >= 7 && survival >= 0.4) ? "群像" : (present <= 3 || survival < 0.25) ? "独狼" : "小队";
  return { key: `${eb}×${sb}`, eb, sb, es, ss };
}

export function promoteToGlobal(worldDir: string): void {
  const root = join(worldDir, "..");
  let dirs: string[];
  try { dirs = readdirSync(root, { withFileTypes:true }).filter(e=>e.isDirectory() && isLiveWorldDir(e.name)).map(e=>e.name); } catch { return; }
  const prev = loadGlobal(worldDir); // 单调基底: 既有 cells/avoid/genome 不被无数据世界清空
  const cells: Record<string, GlobalCell> = { ...(prev.cells ?? {}) }; // ★ C2: 以 prev.cells 为基底

  // ── 旧格式平滑升级: 若 prev 有单冠军 genome 但 cells 空, 先把它合成一个 legacy 格沉进去(只做一次) ──
  if (prev.genome && Object.keys(cells).length === 0) {
    cells["legacy×legacy"] = { key:"legacy×legacy", ensembleBin:"legacy", structureBin:"legacy",
      genome:{...cloneGenome(prev.genome), generation:0}, fitness: prev.bestFitness ?? 0,
      ensembleScore:0, structureScore:0, from:"(legacy)", at:"v0" };
  }

  const counts = new Map<string,number>(); const from: string[] = [];
  for (const p of prev.avoid) counts.set(p, 1);

  for (const d of dirs) {
    const D = join(root, d);
    // avoid 合并(原样保留)
    try {
      if (existsSync(join(D,"evolution.json"))) {
        const l = JSON.parse(readFileSync(join(D,"evolution.json"),"utf8")) as Ledger;
        if (Array.isArray(l.avoid) && l.avoid.length) { from.push(d); for (const a of l.avoid) counts.set(a.p,(counts.get(a.p)??0)+1); }
      }
    } catch {}
    // ── 全局 niche 沉积: 该世界 archive 最优格的基因 → 落入它的全局行为 niche ──
    try {
      if (existsSync(join(D,"archive.json"))) {
        const worldCells = (JSON.parse(readFileSync(join(D,"archive.json"),"utf8")).cells ?? []) as Cell[];
        if (worldCells.length) {
          const niche = globalNiche(D); // 该世界当前的行为利基坐标(整世界一坐标; 见 4.2 说明)
          if (niche) {
            // 取该世界 archive 里 fitness 最高的基因作为它对该 niche 的候选
            const champ = worldCells.reduce((a,c)=> (c.genome && c.fitness > a.fitness) ? c : a, worldCells[0]!);
            const ex = cells[niche.key];
            if (champ.genome && (!ex || champ.fitness > ex.fitness)) { // ★ C1: 逐 niche max, 只增不减
              cells[niche.key] = { key:niche.key, ensembleBin:niche.eb, structureBin:niche.sb,
                genome:{...cloneGenome(champ.genome), generation:0}, fitness:champ.fitness,
                ensembleScore:niche.es, structureScore:niche.ss, from:d, at:champ.at };
            }
          }
        }
      }
    } catch {}
  }

  const avoid = [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([p])=>p).slice(0,60);
  // 派生向后兼容字段: 全 cells 里 fitness 最高那格
  let bestGenome: Genome | null = prev.genome ? cloneGenome(prev.genome) : null;
  let bestFit = prev.bestFitness ?? -1;
  for (const c of Object.values(cells)) if (c.fitness > bestFit && c.genome) { bestFit = c.fitness; bestGenome = {...cloneGenome(c.genome), generation:0}; }

  // ── C3: 原子写(tmp + rename, 同目录 rename 原子), 消灭半截读窗口 + 并发互覆盖退化 ──
  try {
    const out = JSON.stringify({ avoid, genome:bestGenome, bestFitness:+bestFit.toFixed(2), from, cells }, null, 2);
    const tmp = GLOBAL_FILE(root) + ".tmp." + process.pid;
    writeFileSync(tmp, out, "utf8");
    renameSync(tmp, GLOBAL_FILE(root));
  } catch {}
}
```

### 4.2 设计说明(为何「整世界一个 niche 坐标」)

- **粒度选择**: 维度 A/B 的廉价测量(present/polarization/patterns)是**世界级快照**, 不是 per-cell 级。所以每个世界在某一时刻只产出**一个**全局 niche 坐标 `(eb,sb)`, 它对该 niche 的候选基因 = 该世界 archive 里 fitness 最高那格的基因。这与 Multi-task MAP-Elites 的「每 task 一个 elite」同构(task = 行为利基)。
- **为何不按 per-world cell 各算 niche**: per-world cell 是 `tone×rhythm` 风格格, 它们共享同一份 engine(world 级 bestEngine 解耦), 行为利基(present/派系网)是整世界属性、不随 tone 变。强行 per-cell 算会得到 15 个几乎相同的 (eb,sb), 无意义。
- **arcsaga 实例落点**: arcsaga 当前 live genome `turnoverRate=0.5/structureGrowth=0.7/conflictRate=1.25`, 跑起来 present 高(低代谢)、派系网密(structureGrowth)→ `globalNiche` 判它 `(群像,网状)`。它 archive 最优格(killed 副本里 6.15)的基因沉进 `cells["群像×网状"]`。**从此任何新的群像类世界都能从这格取到这套引擎旋钮**。

### 4.3 维度 A 的持久化(必做的新代码, 修正调研假设)

`present`/`survivalRatio` 现在不落盘。两条路, **选 P1**:

- **P1(推荐, 改 sim-fitness.ts)**: 在 `computeSimFitness`(L213)的返回里加一个 `ensemble` 字段, longrun 落盘 `sim-fitness.json` 时自然带上。改动极小:
  ```ts
  // SimFitness 接口加: ensemble: { present:number; entered:number; survivalRatio:number };
  // computeSimFitness 末尾(已有 present 在 factionTension 内, 提到外层算一次):
  const present = Object.values(snapshot.characters).filter(c=>c.present).length;
  const entered = payloadsOf(events,"CharacterEntered").length; // 或复用已读的 entered
  const ensemble = { present, entered, survivalRatio: entered ? +(present/entered).toFixed(3) : 0 };
  // return {..., ensemble};
  ```
  `globalNiche` 读 `sf.ensemble.present`。**新世界的旧 sim-fitness.json 无 ensemble** → `sf.ensemble?.present ?? 0` 兜底 → 该世界暂判 `独狼`, 下次 longrun 算 sim-fitness 即补齐, 自愈。
- **P2(不改 sim-fitness.ts, promote 时现读 snapshot)**: `promoteToGlobal` 里 `openDb(join(D,"world.db"))` 读 snapshot + events 现算。**不推荐**: promote 频繁(每 8 章/世界)、要开别世界的 db、跨写者读 wal 有一致性风险。P1 让数据随 sim-fitness 一起单写者落盘, 干净。

---

## ⑤ loadGlobal / loadGenome 新世界继承策略(推荐方案 + 理由)

### 5.1 loadGlobal(L75-78)

只加 `cells:{}` 兜底(见 3.2)。其余不变。

### 5.2 loadGenome 新世界起步(L53-59) —— 推荐 **D3'「按意图取 niche 种 + 全局 avoid 并集」**

调研给了 4 个选项, 评估:
- **D1(取全局最高 fitness cell)= 现状行为**: 安全可复现, 但**正是要逃离的模式坍塌源**——所有新世界从同一最强格起步, 全局趋同, 群像世界照样拿到文笔冠军的全默认 engine。**不达目的**。
- **D2(随机 niche)**: 多样性最大, 但冷启动从样本稀薄的弱 niche 起步、方差大、偶发劣化。**不做默认**。
- **D3(按 targetStyle 匹配最近 niche)**: 最优雅, 但 `loadGenome` 此刻拿不到 targetStyle(它是 evolve 过程里 `pickTarget` 才生成的, 冷启动 genome.json 还没有)。需外部传意图。

**推荐 D3'(D3 的可落地版)**: `loadGenome` 签名扩展一个可选 `intent?: { ensemble?:string; structure?:string }`, 由**新世界创建处**(longrun 起步、worlds 注册、冷启动 UX 的槽位填空)传入「这是个群像类世界」之类意图。逻辑:

```ts
export function loadGenome(d: string, intent?: { ensemble?:string; structure?:string }): Genome {
  try {
    if (!existsSync(G_FILE(d))) {
      const g = loadGlobal(d);
      const cells = g.cells ?? {};
      // 1) 有意图 → 取匹配/最近 niche 的 cell
      if (intent && Object.keys(cells).length) {
        const wantKey = `${intent.ensemble ?? ""}×${intent.structure ?? ""}`;
        const hit = cells[wantKey]
          ?? Object.values(cells).find(c => intent.ensemble && c.ensembleBin === intent.ensemble) // 同群像维优先
          ?? null;
        if (hit?.genome) return { gen:{...DEFAULT_GENOME.gen,...hit.genome.gen}, engine:{...DEFAULT_GENOME.engine,...hit.genome.engine}, generation:0 };
      }
      // 2) 无意图 → 退回全局最高 fitness 基因(= D1, 兼容现状, 即派生 genome 字段)
      return g.genome ? { gen:{...DEFAULT_GENOME.gen,...g.genome.gen}, engine:{...DEFAULT_GENOME.engine,...g.genome.engine}, generation:0 } : cloneGenome(DEFAULT_GENOME);
    }
    const p = JSON.parse(readFileSync(G_FILE(d),"utf8")) as Partial<Genome>;
    return { gen:{...DEFAULT_GENOME.gen,...(p.gen??{})}, engine:{...DEFAULT_GENOME.engine,...(p.engine??{})}, generation: typeof p.generation==="number"?p.generation:0 };
  } catch { return cloneGenome(DEFAULT_GENOME); }
}
```

**理由**:
1. **直接解搁浅**: 群像类新世界传 `intent={ensemble:"群像", structure:"网状"}` → 命中 `cells["群像×网状"]` → 起步引擎就是 arcsaga 沉淀的 `turnoverRate=0.5/structureGrowth=0.7` 群像配方, **而非全默认**。这正是「自动传到下一个群像类新世界」的实现。
2. **MVP 安全退化**: 不传 intent(现有所有调用)→ 走分支 2 = D1 现状行为, **零行为变更**。先上代码不改调用, 再逐步给创建处加 intent(灰度)。
3. **avoid 仍全局并集**(L64 `loadLedger` 不变): avoid 与 niche 无关, 本就该全局共享。

### 5.3 loadArchive(L68) —— **MVP 不 seed, T3 再 seed**

调研建议「新世界 archive 用 global cells 的值数组 seed」。**MVP 暂不做**, 理由: 全局 cell 的 key 是 `ensemble×structure`, per-world archive 的 key 是 `tone×rhythm`, **key 空间不同**, 直接灌会污染 per-world 风格格。正确做法(T3)是只把全局 niche 的 **engine 旋钮**作为新世界 `bestEngine` 种子(engine 解耦于风格格, 可跨 key 空间传), 而非整 cell。MVP 用 5.2 的 `loadGenome` intent 取种已足够把群像 engine 传进新世界起步基因。

### 5.4 selectParent(L214) —— MVP 不改

5.2 已让新世界起步基因带上目标 niche 的 engine; per-world 内进化照常。跨世界基因迁移由 promote→loadGenome 闭环完成, 不必动 selectParent。(T3 可选: 30% 探索分支混入 `loadGlobal(dir).cells` 的随机 engine, 实现运行中跨世界注入。)

---

## ⑥ 迁移与兼容(在线 mystory/arcsaga 安全 + 旧格式平滑 + 重启时机)

### 6.1 现场实测(施工前提, 已核对 ps)

- **PID 79591 = mystory 写手**(今晨 5:45 起, 旧代码驻内存, NOVEL_EVOLVE=1)。
- **PID 93837 = arcsaga 写手**(今晚 6:14 起, 旧代码驻内存, NOVEL_EVOLVE=1)。
- 两者每 8 章(约 1-2 小时)各自异步 `promoteToGlobal` → **裸 `writeFileSync` 同一 `global-evolution.json`**(无 tmp+rename、无 flock、无 fsync)。这是**全系统唯一的多写者落盘点**(per-world 文件有 longrun.lock 单写者保护)。

### 6.2 风险与对策

| 风险 | 说明 | 对策 |
|---|---|---|
| **A1 旧写手回滚新字段**(最高危) | 旧代码 `JSON.stringify` 不含 `cells` 键; 若先改文件后改代码, 旧写手下次 promote 把 `cells` 抹掉 | **代码先于文件**, 且**全员重启**(6.3)。新代码首读旧文件自动合成 legacy cell, 无需手改文件。 |
| **A2 半截读窗口** | truncate 后 write 完成前被另一进程读到空/半截 JSON | **原子写 tmp+rename**(④ 4.1 已含)。`loadGlobal` try-catch 兜底, 即便命中也只是该刻退默认, 不 crash。 |
| **A3 last-writer-wins 退化** | 两世界同时 promote, 一方读到半截→解析失败→退 prev 默认→重算退化结果落盘, 单调性被击穿 | 原子写消灭半截; 且新 promote **以 prev.cells 为基底逐 niche max**, 即便交错, 后写者覆盖的也是**已含对方贡献的超集**, 单调不破。 |
| **C2 清世界丢 niche** | 某 niche 冠军来自已被 kill/改名世界(如 arcsaga-killed), `isLiveWorldDir` 不再扫到 | `cells={...prev.cells}` 基底留住它(命门, ④ 已实现)。这正是「把被 kill 世界的精英沉淀进全局」的收益。 |
| **B1/B2 旧格式读取** | 现文件无 cells; genome 不能删(server.ts:198 + loadGenome/loadLedger 依赖) | loadGlobal 兜底 cells:{}; promote 保留 genome/bestFitness 派生; 首次 promote 合成 legacy cell。 |
| **E1 维度稀疏** | 叠太多维→格空洞→单 niche 噪声 | MVP 严守 2 维(A×B=9 格), conflict 仅作元数据不进 key。 |

### 6.3 重启时机(关键)

旧写手不重启就一直跑旧 promote, 与新格式打架(A1)。流程:

1. 改完代码 → 验证编译(`tsc --noEmit`)。
2. **灰度边界**: 先只让 mystory 切换。迁移期临时让 arcsaga **停 promote**: 设其 `NOVEL_EVOLVE=0` 重启(或先 kill 不重启), 把并发写手降为 1, 消灭 A1/A3。
3. `pkill -9` mystory 写手 → 新代码重启(参照 MEMORY: SIGTERM 杀不净会赛跑串台, 用 `pkill -9`; 重启走单写者锁)。**现 global 文件不手动改**——新 `loadGlobal` 首读把旧 `{genome:7.53}` 合成 legacy cell, 第一次 promote 落盘即完成升级。零停机数据迁移。
4. mystory 跑过 2-3 个 evolve 周期(~16-24 章)确认: global 文件含 `cells` 多 niche、`bestFitness` 单调不降、面板正常、新世界冷启动 genome 合理。
5. 再把 arcsaga 放回 `NOVEL_EVOLVE=1` 用新代码重启。两写手都新代码 + 原子写 + prev.cells 基底, 并发交错只产生超集覆盖, 单调不破。

server(8990/8991)只读 `loadGlobal`, 可后重启或不重启(前端字段是加法、不破)。

---

## ⑦ 最小可行实现路径(分步、可灰度、每步改哪个函数)

> 总原则: **代码先双格式兼容 + 原子写 + 单调 merge, 再让文件升级; 全员重启; 新结构对旧写手只加不减**。每步独立可灰度、可回滚。

### T0 — 原子写(无条件先做, 不必等灰度) 【1 函数】
- 改 `promoteToGlobal` L104 落盘: `writeFileSync(tmp); renameSync(tmp, GLOBAL_FILE)`。
- 风险极低, 立即消灭 A2/A3 半截读。可单独部署、单独重启。

### T1 — 双格式兼容读 + 维度 B(零新持久化)先跑通 【3 函数】
- `GlobalEvo` 接口(L72)加 `cells?` + `GlobalCell` 类型。
- `loadGlobal`(L76)兜底 `cells:{}`。
- `promoteToGlobal`(L80): 以 `prev.cells` 为基底; 加 `globalNiche`(此刻**仅维度 B**, 维度 A 暂全判 `小队`); 合成 legacy cell; 逐 niche max; 保留派生 genome/bestFitness。
- **此步即可灰度部署 + 全员重启**(6.3): 旧文件自动升级成含 legacy + 按 B 维分的 cells。`loadGenome` 暂不改(走 D1 派生 genome, 零行为变更)。验证 `cells` 出现且单调。

### T2 — 补维度 A 持久化 + 升 2 维 (A×B) 【2 函数】
- 改 `sim-fitness.ts`: `SimFitness` 加 `ensemble{present,entered,survivalRatio}`; `computeSimFitness` 末尾算并返回(④ 4.3 P1)。
- `globalNiche` 读 `sf.ensemble` 算维度 A、出 `eb`。key 变 `ensemble×structure`。
- 重启写手。验证 arcsaga 落进 `cells["群像×网状"]`、mystory 落进对应格、两者**不互相覆盖**。

### T3 — loadGenome 按 niche 取种(打通传承闭环) 【1 函数 + 调用处】
- `loadGenome`(L53)加可选 `intent` 参数 + niche 取种分支(⑤ 5.2)。不传 intent = D1 现状。
- 给新世界创建处(longrun 起步 / worlds 注册 / 冷启动 UX 槽位)传 `intent`。**这步才真正让群像引擎自动传到下一个群像类新世界**。
- 灰度: 先不传 intent(无变更), 再逐个创建点加。

### T4 — (可选)升 3 维 + 加锁加固 【按需】
- 维度 C(pace, 取 slm+volatility)进 key, 升 27 格。**仅在 9 格普遍填满后**。
- 可选 `global-evolution.lock`(O_EXCL + mtime 心跳, 复用 longrun.lock 模式)把跨世界 promote 串行化, 根治 C3 残余。MVP 用原子写+prev 基底已足够, 延后。

---

## ⑧ 验证法(如何证明 arcsaga 群像引擎能自动传到下一个群像类新世界)

### 8.1 单元级(不动在跑世界, 离线跑)

构造一个 fixture 目录树, 直接调函数:
1. 造两个世界目录: `wA`(放 arcsaga-killed 的群像 archive.json: turnoverRate=0.5/structureGrowth=0.7, + 一个 sim-fitness.json 含 `ensemble{present:9,entered:18,survivalRatio:0.5}` + polarization 高)、`wB`(放文笔向 archive: turnoverRate=1/structureGrowth=0, sim-fitness present 低 polarization 低)。
2. 调 `promoteToGlobal(wA)`。**断言**: `cells["群像×网状"].genome.engine.turnoverRate === 0.5` 且 `cells` 里另有一个 `(独狼,线性)` 格存 wB 的基因, **两格并存、互不覆盖**。即便 wB 的 fitness 更高, 也进不了群像格。
3. 造新世界 `wC`(无 genome.json), 调 `loadGenome(wC, {ensemble:"群像", structure:"网状"})`。**断言**: 返回的 `engine.turnoverRate === 0.5`、`structureGrowth === 0.7`(= arcsaga 群像配方, **而非全默认**)。
4. 对照: `loadGenome(wC)`(无 intent)返回全局最高 fitness 格基因(= 现状 D1)。证明 MVP 安全退化。

### 8.2 单调性回归

1. promote 一次得 `cells` 含群像格(fitness=6.15)。
2. 把 wA 改名加 `-killed-`(模拟被 kill, `isLiveWorldDir` 不再扫到)。
3. 再 promote。**断言**: `cells["群像×网状"]` 仍在、fitness 仍 6.15(prev.cells 基底留住已 kill 世界的精英)。这证明 C2。
4. 跑一个只有空 archive 世界在场的 promote。**断言**: `cells` 不被清空、`bestFitness` 不降。

### 8.3 并发回归

1. 并行起 2 个进程同时 `promoteToGlobal`(不同世界), 各跑 50 次。
2. **断言**: `global-evolution.json` 全程可 `JSON.parse`(原子写无半截)、末态 `cells` 是两进程贡献的并集、每 niche fitness = 历史 max(无退化覆盖)。

### 8.4 在线端到端(灰度收尾后)

1. 确认线上 `cells` 已含 `群像×网状`(来自 arcsaga)。
2. 用 worlds 注册新建一个群像类世界 `wEnsemble`, 创建时传 `intent={ensemble:"群像",structure:"网状"}`。
3. **断言**: `wEnsemble/genome.json` 起步 `engine.turnoverRate≈0.5/structureGrowth≈0.7`(从全局 niche 取种, **非全默认**)。
4. 跑若干章, 观察其 sim-fitness 的 `ensemble.present` 是否较「全默认起步」的对照世界更高、`polarization` 更高 → 证明群像引擎确实让新世界一开局就站在群像配方肩上, **传承生效**。

### 8.5 成功判据(一句话)

> arcsaga 的 `(turnoverRate=0.5, structureGrowth=0.7)` 群像引擎, 在它**没夺得全局 fitness 冠军**(7.53 文笔冠军在位)的情况下, 仍以 `cells["群像×网状"]` 格主身份**永久在册**, 并能被下一个标注「群像类」的新世界**自动取作起步引擎**——这就是搁浅被解除、传承成功的可验证证据。

---

## 附: 关键文件与改动点速查

| 文件 | 改动点 |
|---|---|
| `app/evolve.ts` | L72 `GlobalEvo` 加 `cells?` + 新 `GlobalCell` 类型; L75-78 `loadGlobal` 兜底 `cells:{}`; **L80-105 `promoteToGlobal` 重写**(per-niche max + prev.cells 基底 + 原子写 + legacy 合成 + `globalNiche` 函数); L53-59 `loadGenome` 加 `intent` 取种分支; L104 落盘改 tmp+rename。`loadArchive`(L68)/`selectParent`(L214)MVP 不改。 |
| `app/sim-fitness.ts` | T2: `SimFitness` 接口加 `ensemble{present,entered,survivalRatio}`; `computeSimFitness`(L213)末尾算并返回(维度 A 持久化, P1)。 |
| `app/longrun.ts` | T3: 新世界创建处给 `loadGenome` 传 `intent`(L69-70 起步加载); 重启走单写者锁 + `pkill -9`。调用点 L430(`evolveOnce`→内部 promote)不变。 |
| `app/server.ts` | L198 `/state` 透传 `loadGlobal` —— 新增 `cells` 是加法, 前端可选渲染, 不破现有曲线。 |
| `.novel-output/global-evolution.json` | 现 `{avoid,genome(全默认 engine),from,bestFitness:7.53}` → 首次新 promote 自动升级为含 `cells` 的超集。无需手改。 |
| `.novel-output/arcsaga-killed-20260604-181357/archive.json` | 群像配方实例数据源(turnoverRate=0.5/structureGrowth=0.5-0.75/conflictRate=1.0-1.45), 验证 §8 的 fixture 蓝本。 |

**核心 diff 语义**: `globalBest`(单值, L99) → `cells[niche]`(per-niche max); promoteToGlobal 的「全局夺冠才传」(L99 `c.fitness > bestFit`) → 「per-niche 单调入库」(`champ.fitness > cells[key].fitness`); loadGenome 的「取全局唯一冠军」(L55) → 「按 intent 取目标 niche 种, 无 intent 退 D1」。

---

## ⑨ 实施记录(2026-06-04 已落地 · 全量施工含修复)

**关键决定: niche 用「引擎策略 genotype」而非蓝图的「表型行为描述符」。** 评审(critique.md)实测铁证: 表型描述符 A 维(present/survivalRatio)**未落盘**(X1)、B 维(structureScore)在 6 个真实世界上**塌成两桶、`线性` 先验空、且与 structureGrowth 旋钮无因果**(X2)。故弃用脆弱表型, 改按定义「群像 vs 文笔」分野的两个引擎旋钮 `turnoverRate × structureGrowth` 直接分桶(已在基因里、零新持久化、保证不同策略不同格)。这一刀同时解掉 X1+X2, 且不必改 sim-fitness.ts。`engineNiche(g)`: turnover≤0.75→低代谢 否则高代谢; structureGrowth≥0.35→生长 否则平。

**实际改动(app/evolve.ts)**:
- `GlobalCell` 类型 + `GlobalEvo.cells?` (事实源); `genome`/`bestFitness` 保留为派生视图(向后兼容 server.ts:198/loadGenome/loadLedger 不破)。
- `loadGlobal` 兜底 `cells:{}` (旧文件零迁移可读)。
- `engineNiche` / `depositWorldArchive`(逐 niche max, C1) / `depositGenome`(旧单冠军归格) / `writeGlobal`(X3 末读合并 + 派生兼容 + X0 原子写 tmp+rename) 四个新 helper。
- `promoteToGlobal` 重写: prev.cells 为基底(C2 单调)、avoid 合并不变、各 live 世界 archive 归格。
- `bootstrapGlobalCells`(导出): 一次性扫**所有**目录(含 -killed)引种, 把被 kill 世界精英补进全局。**这是 X1 的解**——不等 live 世界跑出来。
- `loadGenome(d, intent?)`: 有 intent 取目标 niche 种、无 intent 退现状(D1, 安全退化)。

**X4 数据链(app/longrun.ts:69)**: 读 `NOVEL_WORLD_INTENT` env(别名「群像/爽文」→低代谢×生长, 或直接「低代谢×生长」)→ 传 loadGenome。已有本地 genome 的世界不受影响。

**验证**(全绿): tsc 干净 · 153 测试通过 · 离线 fixture 实证「文笔冠军7.53 顶不掉群像格6.15 + intent 取到 turnover0.5 群像引擎 + 无 intent 退化文笔冠军 + kill 后群像格单调留存」。

**灰度上线**(在线 mystory+arcsaga): 杀 4 写手 PID(精确, 不碰 server)+ 删 longrun.lock → bootstrap 引种(得 **4 niche**: 高代谢×平 7.75←saga-killed / **低代谢×生长 6.15←arcsaga-killed=群像引擎** / 高代谢×生长 7.53←qunxiang-killed / 低代谢×平 6.99←saga-pre-fixes)→ 新码重启两写手(prev.cells 基底保住 4 格)。global 派生 bestFitness 7.53→7.75(扫全归档发现更优, 单调升)。

**成果**: arcsaga 群像引擎(turnover0.5)在没夺全局 fitness 冠军(7.75 文笔在位)下, 以 `cells["低代谢×生长"]` 格主**永久在册**, 下个标 `NOVEL_WORLD_INTENT=群像` 的新世界自动取它作起步引擎——搁浅解除、跨世界传承闭环打通。**与蓝图差异**: 未上表型 A/B 维与 sim-fitness 持久化(评审证其脆弱), 用 genotype niching 替代; loadArchive seed(5.3)/selectParent(5.4)仍 MVP 不改。T4(3 维细化 / O_EXCL 锁)按需后续。
