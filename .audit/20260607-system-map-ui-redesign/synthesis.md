# Novel System —— 全系统运行+配合逻辑 + UI/token 重设计

综合 5 路调研 + 直接复核源码(`app/`+`core/`+`packs/` 真管线, 非凭背景)。所有 file:line 已对真文件校验, live `world.db` 实测佐证。

> 校准说明(纠两处背景误解):
> 1. **live 世界跑的是 `app/`+`core/`+`packs/`**, 数据全在各世界目录 `world.db` 的 `events`/`snapshots` 表。`src/` 树(memory-service/embedding)**不在 live 管线**(`tsconfig.json` include 只含 `src/**`+`workbench/**`)。`memory_entries`/`embedding` 表由 schema 建出但 live 从不写 —— **embedding 在 live 世界是死表**。这直接决定"心声 load-bearing 判定"(见二.②): 记忆召回走 `events` 表词法 `readSalientMemories`, 不走 embedding。
> 2. live 实测(本次复核): `renjian/world.db` 有 `AgentThought:118 / MemoryRecorded:197 / StageCommitted:118`, 对 8 章 ≈ 每章 3 个 tick(`step ×3`), 与下方主链一致。`saga/world.db` 7 章对 24 个 AgentThought(=3:1)再次印证。

---

# 一、全系统运行与配合逻辑(全景)

## ① 一章生成主链步骤图(`app/longrun.ts`,含每步 file:line + LLM 调用点)

写者进程 = `main()`(longrun.ts:220)。`while(n<TARGET)`(:277)每迭代一次 = 出一章。**两路 LLM**铁律: `sim = new MockLLM()`(longrun.ts:49, 零成本确定性, 喂 world-actor 推演) vs `llm = makeLLM()`(真 DeepSeek, 写正文/反思/进化, llm-factory.ts:60 → `FallbackLLM(DeepSeek, Mock)`)。

```
[启动一次性 L62-116]
  单写者锁(PID+心跳mtime, pkill -9 防串台) / loadGenome / buildGuidance / loadDrama
  loadMinds / loadConstraints / loadCanon / loadGD(GENTLE) / loadPL(GENTLE) / openDb(world.db)
  sim = new MockLLM()  ← L49   llm = makeLLM()(DeepSeek) ← L44 区域

[预演化 WARMUP  L244-271]（仅 n===0 && WARMUP>0, 创世首章前）
  scout = openDb(":memory:") 同 worldId/seed → 跑 WARMUP tick(step(sdb,…,sim) autoCompose=false)
  pickArcStart(arc-select.ts, 零LLM) 读 scout 全史 → 挑最有戏弧线 → arcHint + 起笔 tick T
  真世界 guardedStep() 快进到 T(同seed确定性复现) → 首章 in-medias-res

[setInterval 15s  L274-276] 有 author-verdict 待裁 → guardedStep 即时落定(不等本章写完)

[每章循环 while n<TARGET  L277]
 ① L278-283  暂停闸: 存在 paused 文件 → 原地等3s不推进
 ② L284-286  n++ ; heartbeat()刷锁 ; vol=卷号
 ③ 群像稳态补血: 每5章在场<16则 enqueue spawn-character(跌破10批量补)
 ④【drama控制器+T2温情导演】L302-338 (EVOLVE, withLock 与 step 互斥)
     L307 ★交汇A dramaControl(近300事件, simFitness, evoGenome.engine, drama, GENTLE) → 算雪崩密度 → 写 props.tuning(纯符号, drama.ts 零LLM)
     L312-315 注入已准入 simRules 到活世界
     L318-333 ★交汇B GENTLE: gentleDirect(近4章正文)→2-gram名词指纹测坍塌→派 sceneShift(forCh=n+1, 纯符号)
     L334 saveSnapshot(tuning/sceneShift 同事务一次落盘)
 ⑤【sim步进 ×3】L339  for t<3: guardedStep() → step(db,worldId,PACK,sim)  ← 世界推演3 tick(详见二.①world-actor; ★交汇C reflect 用 MockLLM 零token)
 ⑥【议事·奇门定夺】L341-357 ★交汇D 扫 pendingDecisions: age≥GRACE_TICKS(默认0全自动/manualverdict则~9)→据 valence 符号 enqueue author-verdict(吉平accept/凶<-0.2 reject)→guardedStep 落定
 ⑦ L359-370 loadSnapshot ; GENTLE 消费 sceneShift(forCh===n 守门)覆盖 scene/ambience/sceneAvoid/gdDomain ; roster(在场+亲疏+innerDrive) ; canonHard=deriveCanon硬事实(境界/派系/生死/恩怨)
 ⑧【拼 crisis】L372-390  crisisBase + 奇门plateLabel + 派系格局 + 近时变故(陨落/吞并/复仇/复兴, ★交汇E 增量读 readEventsSince(evCursor)) + 导演hint
 ⑨ L391-392 LLM 配置指纹变 → 热切换 provider(makeLLM), 无需重启
 ⑩【拼前情记忆】L394-400  readSalientMemories(≥0.6)在场回响 + personaBlock(每角色 persona digest, 含 props.mind) + recallShared(宿缘同框旧账) → bibleEcho
 ⑪【伏笔账】L402-427  到期回收 weave / 每6章埋设(开放<3, ★LLM构思hook L412) ; GENTLE 空窗: nextProgressTask 补温润推进任务(含 gentleEmergence 涌现际遇, L425)
 ⑫ L428-429 loadConstraints(拾已批准铁律) →【writeChapter】(详见一.④, 多次★LLM)
 ⑬ L431-434 守门: 正文<MINLEN*0.4(1200字)→疑DeepSeek抽风占位→弃章 n-- 退避30s重试(不落盘/不污染进化)
 ⑭ L435-436 落盘: ch-NNNN.md + store.saveChapter(world.db)
 ⑮【落盘后才提交叙述耦合副作用】L444-450(守门弃章则一概不发生):
     L445 evCursor 推进 ; FactionDissolved→排期8章后复兴 ; 伏笔 paid/plant 落盘 ; GENTLE 拍子签名入进展账本(防循环, 滚动近12)
 ⑯【M3批量反思】L452-475 (EVOLVE): accrueImportance(零LLM门控)→selectQueue(破阈+force)→M4情境指纹缓存过滤→★batchReflect(1次LLM更新≤8人, minds.ts:91)→enqueue mind-update(下个step写 props.mind)
 ⑰ L477 appendEvent ChapterInscribed(subsystem=compose, severity=notable)→SSE点亮"成文"灯
 ⑱【每8章里程碑】L482-552:
     ★canonStep(LLM一致性校验+设定档, L485) + 伏笔回收率
     GENTLE ★advanceStep(LLM判处境/里程碑, L499)
     ★rollSummary(LLM压缩bible≤200字, GENTLE剔静物词, L506)
     computeSimFitness/computeWarmFit(零LLM存盘, L513-519) → ★evolveOnce(LLM爬山进化基因, L522)→evoGenome下一卷生效 + promoteToGlobal
     每16章 ★evolveSimRules(LLM提议新世界机制, 三闸准入)
     每24章 停滞 ★proposeConstraintMutation(LLM提铁律变异→人类裁决)
 ⑲ L553 console.log 第n章完成
```

### 一.① world-actor 一次 `step` 内部相位(sim 推演, ⑤调用 ×3; world-actor.ts:173, 585行)
`step(db,worldId,pack,sim)` 单事务单写者。注意 **longrun 传的是 MockLLM**:
1. **L185-188 planDirector** — focus 轮转, **每 tick 恰 1 角色**登场(director round-robin)。→ 每章 step×3 = 3 次 reflect。
2. **L196-249 drainInputs** — 处理 author-verdict(accept→改正史+ProgressionAdvanced/登顶 CharacterTranscended 退场)、spawn-character(CharacterEntered)、mind-update(写 `props.mind` L243)。延后到 saveStep 同事务标 processed(防半提交)。
3. **L252-253 buildFrame** — pack 八字/奇门确定性 prior(FrameDerived)。
4. **L257-264 agents** — focus 角色 `reflectAndPlan`(character-actor.ts:30, **MockLLM**)产 5~6 候选 + `AgentThought` + `MemoryRecorded(reflection, importance 0.3)`。
5. **L266-301 打分→argmax** — pack.scoreCandidate 用 frame 打分; `props.tuning` 旋钮 priorWeight/scarcity/conflictRate/turnoverRate/nicheWeight/structureGrowth/moveBias 调整; `CandidatesScored`。
6. **L303-321 gate** — 突破尝试(act/engage 且 canAdvance)→ DecisionRequired 入 pendingDecisions, 本 tick 落安全 observe 替代; `GateEvaluated`。
7. **L323-340 commit** — applyDeltas + `StageCommitted(summary)` + `MemoryRecorded(deed/episode, importance 0.4/0.6)`。
8. **L345-381 经济/符号心跳(M1, 零LLM)** — scarcity 零和资源; **全员每 tick 更新 drives/innerDrive + 非焦点 narrativeStress EMA**。
9. **L383-499 系统级剧情事件** — pack.nextStoryEvent / simRuleStoryEvent; 派系战争/吞并(FactionDissolved)/复仇了断(VengeanceResolved)/凶事折损(CharacterFell+立复仇者)。
10. **L501-527 结构生长** — structureGrowth>0 派系分裂(FactionSplit)。
11. **L529-543 director/compose** — `DirectorPlanned`; compose 仅当 `autoCompose!==false`(longrun 关掉, **不走** world-actor 内置 composeChapter)。
12. **L548-582 saveStep 单事务** — appendEvent + saveSnapshot + writeCheckpoint + setSchedulerState + markInputProcessed(原子, 无半提交)。

事件全落 `world.db` events 表, 强类型字段 `kind/subsystem/severity/verb/subject/summary/payload_json`(store.ts:15-19)。

### 一.④ `writeChapter` 内部(longrun.ts:176-218, 本章核心 LLM 消耗)
1. **L181 列节拍**: 1次LLM(temperature 0.9), GENTLE 温润 beatSpec(场景流连/留余味) / 爽文因果相承。
2. **L189 起标题**: 1次LLM(temperature 1.0)。
3. **L198 loreBlock**: recallLore 关键词召回(零LLM)。
4. **L201-216 分段续写**: `SECTIONS`(默认4)段, **每段1次LLM**(采样参数来自 `evoGenome.gen` 进化基因 L206); 每段守门<120字退避重试(≤4)。注入 PENMANSHIP/canonHard/loreBlock/canonInject/conBlock/evoGuidance。
→ **每章 ≈ 6-7 次 DeepSeek, ~15-18k token, 分段(#4)占 ~85%。**

---

## ② 五大子系统:各做什么 + 如何配合(数据流图)

### 各子系统职责一句话
| 子系统 | 关键文件 | 做什么 | 是否花 DeepSeek token |
|---|---|---|---|
| **①模拟** | core/runtime/world-actor.ts, core/actors/character-actor.ts | MockLLM 符号推演世界: 候选→八字prior打分→argmax→gate→commit→符号心跳→story事件→结构生长。产 events + 快照 props(drives/bond/faction/mind/stress) | **零**(sim=MockLLM) |
| **②进化** | evolve.ts, sim-fitness.ts, warm-fitness.ts | 每8章读 fitness 爬山改 `evoGenome`(gen采样参数 + engine 8旋钮); MAP-Elites 15格存档防坍塌; QD niche 跨世界传承(global-evolution.json) | 进化点 LLM, 摊薄小 |
| **③裁决/规则** | longrun.ts:341-357, constraints.ts | 议事自动裁决(据 valence 符号, 默认全自动); 铁律提案(改规则=改概念空间)永远等人点 | 铁律提案 LLM(≤1/24章) |
| **④温情** | gentle-director.ts, gentle-emergence.ts, progression-ledger.ts, drama.ts(gentle分支) | 全 GENTLE-gated 纯符号: 场景轮换(sceneShift)防场景坍塌 + 涌现际遇摄入 + 进展账本防叙事循环 + drama冷不加注 | **零**(纯符号) |
| **⑤心智/记忆** | minds.ts, persona.ts, store.readSalientMemories | M3 批量反思(1次LLM≤8人, 门控+缓存省94%)→props.mind; M2 persona digest(零LLM)注入前情; 记忆=events行词法召回(**无embedding**) | M3 batchReflect LLM(~1/3章) |

### 数据流图(谁写 props.tuning / 谁读 events / 谁喂 evolveOnce / 谁影响下章 prompt)
```
              ┌──────────────────── app/longrun.ts 主写者循环(每章 n++) ────────────────────┐
[③drama+②QD] dramaControl(近300事件, evoGenome.engine) ──写──► props.tuning   ★A longrun.ts:307-309
[④gentle]    gentleDirect(近4章正文) ──写──► props.sceneShift(forCh=n+1)        ★B longrun.ts:318-333
                              │ store.saveSnapshot(同事务落盘)
                              ▼
[①模拟] for t<3: guardedStep() ─► world-actor.step(…, sim=MockLLM)            longrun.ts:339
            读 props.tuning(:267-274)→八字prior打分(:277)→argmax(:295)
            reflectAndPlan(MockLLM) 产候选+reflection  ★C 零token             character-actor.ts:30
            gate→pendingDecisions │ commit→StageCommitted │ 符号心跳drives
            story事件→CharacterFell/FactionDissolved/ProgressionAdvanced/VengeanceResolved
            saveStep单事务: events表 + snapshot + scheduler                    world-actor.ts:548-582
                              │
[③议事] age≥GRACE → author-verdict入队 → guardedStep                          ★D longrun.ts:341-357
                              │
   newEvs = readEventsSince(db, evCursor)  ◄── events表(增量读)                ★E 事件总线 longrun.ts:378
        ├─[⑤心智] accrueImportance(newEvs)→selectQueue→batchReflect(1次LLM≤8人)→enqueue mind-update→下step写 props.mind  longrun.ts:452-475 / world-actor.ts:243
        ├─[④涌现] gentleEmergence(newEvs)→renderEmergence→weave              longrun.ts:425
        ├─[④推进] nextProgressTask(pledger)→weave空窗兜底                      longrun.ts:420-426
        ├─[⑤persona] personaBlock(snapshot, canon) 含 props.mind → bibleEcho  longrun.ts:398
        └─[⑤记忆] readSalientMemories(≥0.6, 在场)→回响 (0.3反思被阈值过滤掉)   longrun.ts:395
                              ▼
   拼 prompt(roster+crisis+bibleEcho+persona+weave+canonHard+conBlock+evoGuidance+ambience)
   writeChapter() ─► llm.complete(DeepSeek) 多段成章 ≥3000字  ★F 真token大头   longrun.ts:176-218
        采样参数 = evoGenome.gen(②进化基因控制)                               longrun.ts:206
                              ▼ 落盘 ch-NNNN.md + saveChapter + appendEvent(ChapterInscribed)
   每8章:─┬[②进化] computeSimFitness/computeWarmFit→存盘→evolveOnce(LLM critique+变异)→evoGenome(下卷)+promoteToGlobal  ★G longrun.ts:513-522
          ├[④推进] advanceStep(LLM判里程碑)→progression-ledger.json
          └ canonStep(LLM一致性) + rollSummary(LLM压缩bible)

  ════════ 读侧(独立进程 server.ts, 共享同一 world.db, NOVEL_VIEW=saga 只读) ════════
  broadcastNew(events表轮询1.5s)──SSE──►前端  ★H server.ts:54-61, 76-77
  /api/snapshot /api/minds(describeMind符号零LLM) /api/decisions /api/evolution …
  /api/mind? /api/dialogue?(★按需DeepSeek, 见二)
```

**精确回答**:
- **谁写 props.tuning**: 仅 `drama.ts dramaControl`(longrun.ts:309, 每章, base=evoGenome.engine 由②进化提供)。world-actor 只**读** tuning(:267-274)。
- **谁读 events**: ①longrun 主循环 `readEventsSince`(★E, 喂⑤④); ②`server.broadcastNew`(★H, 喂网页); ③warm/sim-fitness(`readRecentEvents`)。
- **谁喂 evolveOnce**: `computeSimFitness/computeWarmFit` 先存盘(L513-519), `evolveOnce` 读它折进 fitness。
- **谁影响下章 prompt**: `evoGenome.gen`(采样) + `evoGuidance`(避雷/发扬) + `props.mind`(经 persona) + `sceneShift` + `weave`(伏笔/涌现/推进) + `canonHard` + `conBlock`(铁律) —— 全在 writeChapter 拼接。

---

## ③ 关键 env 旗标组合表

| env | 取值 | 作用 | file:line |
|---|---|---|---|
| `NOVEL_STYLE` | `温润`=GENTLE / 空=爽文 | **总开关**: 温润切节拍/场景轮换/进展账本/温情fitness/drama冷不加注; 爽文全零变更 | longrun.ts:43 |
| `NOVEL_EVOLVE` | 默认开 | 开 drama控制器 + M3反思 + 每8章 evolveOnce/canonStep | longrun.ts:80 区域 |
| `NOVEL_WARMUP` | tick数(0=快起笔, UI默认100) | 预演化静默演化N tick + 挑弧线 in-medias-res 起笔 | longrun.ts:38, 244-271 |
| `NOVEL_WORLD_INTENT` | 群像/… | loadGenome 按 intent 取目标 niche 种(群像取群像引擎非文笔冠军) | longrun.ts:82-86 |
| `NOVEL_BIBLE` | premise文本 | 注入世界设定 | longrun.ts:229 |
| `NOVEL_SAGA_DIR` | 目录名 | 世界数据目录(world.db/chapters/各json) | longrun.ts:51 |
| `NOVEL_TARGET/MINLEN/SECTIONS` | 数字(1000/3000/4) | 目标章数/最短字数(守门=*0.4)/每章分段 | longrun.ts:35-37 |
| `NOVEL_WORLD_CONFIG` | cfg路径 | freeform pack 用的世界配置 | server spawn |
| `NOVEL_VIEW` | `saga`=只读观察器 / 空=自带demo | server.ts 只读 world.db + SSE(不自己跑世界) | server.ts:27 |
| `NOVEL_STANDBY` | `1`=待机落地页 | 不跑默认世界, 等网页"定义你的世界" | server.ts:26 |
| `PORT` | 端口 | 每世界独立(见 MEMORY 4世界端口表) | server.ts:24 |

> server.ts **不读 `NOVEL_STYLE`** —— 故 `/api/mind?`/`/api/dialogue?` 在温情/爽文两模式都白烧 token(见二)。

**典型组合**: 新世界 = `NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=… NOVEL_SAGA_DIR=<name> NOVEL_TARGET=1000 NOVEL_SECTIONS=4 NOVEL_WARMUP=<0|100> NOVEL_STYLE=<温润|空>`(server.ts:285 spawn 写者) + 观察器继承 + `NOVEL_VIEW=saga PORT=<port>`(server.ts:354)。

---

# 二、移除角色心声/对话(省 token, 诉求③)

## ① LLM 生成点清单 + token 估算

| 点 | 位置 | LLM? | 触发 | token 成本 |
|---|---|---|---|---|
| **A. 角色 reflection(候选"心声")** | character-actor.ts:30 `reflectAndPlan` | **MockLLM** | 每焦点角色/tick(live: AgentThought ~3/章) | **0**(sim=MockLLM) |
| **B. M3 batchReflect(props.mind)** | minds.ts:91 (longrun.ts:464) | **DeepSeek** | ~1/3章(门控+M4缓存省94%) | ~0.8k/触发, 摊薄 ~0.3k/章 |
| **U1. `/api/mind?` 悬停心声** | server.ts:153-168 | **DeepSeek** temp1.3 | 鼠标悬停角色, **每9s重发**(index.html:319 `setInterval 9000`) | **无界**: 一次悬停=每9s一发, 无上限 |
| **U2. `/api/dialogue?` 偷听对话** | server.ts:169-189 | **DeepSeek** temp1.3 | 点两角色, **每13s续涌**(index.html:331 `setInterval 13000`) | **无界**: 不关对话框=每13s一发 |

**每 tick**: 仅 A(MockLLM, 零)。**每章**: B 约 1/3 次 DeepSeek(~0.3k 摊薄)。**每世界(网页侧)**: U1+U2 是**按用户交互时长的无界开销** —— 一个用户盯地图悬停 5 分钟 ≈ 33 次 `/api/mind`(每次独立 prompt, temp1.3), 点开对话框看 5 分钟 ≈ 23 次 `/api/dialogue`。**这是诉求③的真靶心, 与正文写作完全正交**。

## ② load-bearing 判定(纯UI装饰 vs 喂正文/记忆/进化)

| 项 | 输出去向 | 是否喂正文/记忆/进化 | 判定 |
|---|---|---|---|
| **U1 `/api/mind?`** | 仅 `json(res, {voice})`→前端 tooltip(server.ts:165) | **否**: 不写库/不入记忆/不进 prompt | **纯UI装饰 → 可裸删** |
| **U2 `/api/dialogue?`** | 仅 `json(res, {text})`→前端对话框(server.ts:186) | **否**: 同上 | **纯UI装饰 → 可裸删** |
| **A reflection** | 存 `MemoryRecorded importance 0.3`(world-actor.ts:263) | **近乎 dead**: 召回用 `readSalientMemories(≥0.6)`(store.ts:221, longrun.ts:395)→ **0.3 被阈值过滤**, 从不进正文; 仅经 candidate.summary→StageCommitted.summary 间接留痕 | **非花钱项**(MockLLM); **不必动** |
| **B props.mind** | `personaDigest`(persona.ts)→`personaBlock`→`bibleEcho`**注入正文 prompt**(longrun.ts:398) | **是**: "角色带恩怨出场"来源 | **load-bearing → 不能裸删** |
| **`/api/minds`** | 读 props.mind 缓存, 经 `describeMind` **纯符号渲染**(packs/xianxia-bazi/index.ts:161-174, **零新LLM**)→前端悬停主文/ambientThought | 只读, 零LLM | **保留无妨** |

> 关键: `describeMind` 已复核为纯字符串插值(读 natal/goal/loc/stress/avenge 字段, 零 LLM)。前端悬停 tooltip 的**主体文字**来自 `MINDS[id]`(=`/api/minds`=describeMind), U1 只是额外往 tooltip 里塞一行 LLM"心声"(`#voiceline`)。删 U1 后悬停仍有完整符号化"所思", 不空。

## ③ 分级移除方案

### A 级 — 能裸删(给省token量 + 开关设计)
**删 2 处 LLM 端点 + 前端调用**, 零副作用:

**后端 server.ts**:
- 删 `/api/mind?` 整块(server.ts:153-168)
- 删 `/api/dialogue?` 整块(server.ts:169-189)

**前端 app/web/index.html**:
- 删 `fetchVoice`(:329)、`dlgTurn`(:330)、`eavesdrop`(:331)、`closeDlg`(:332)
- 删悬停 voice 计时器: pointermove 里 `_voiceDelay/_voiceTimer setInterval 9000`(:319 那段)→ 改为只设 `MINDS[id]` 文字、删 `<div id="voiceline">`
- 删 pointerleave/pointercancel 里 `clearInterval(_voiceTimer);clearTimeout(_voiceDelay)`(:321,:325)
- 删 click 偷听逻辑(:327 整段 `_selA`/`eavesdrop`)→ 点击角色不再触发对话框
- 删 `#dlgbox` DOM(:185)、`#voiceline`/`#dlgbox` 样式(:103,:115-119)、状态变量 `_selA/_dlgTimer/_dlgKey/_dlgAcc/_voiceTimer/_voiceDelay`(:328)
- 引导文案 TOUR ③(:371)"鼠标悬在角色上看心声、点两人偷听对话"→ 改"鼠标悬在角色上看他此刻所思"(去"偷听对话")

**开关设计(推荐做成可回退, 而非硬删)**:
- 后端: 端点开头加 `if (process.env["NOVEL_LIVE_VOICE"] !== "1") return json(res, { disabled: true });` —— 默认关(省token), 想回 demo 体验设 `NOVEL_LIVE_VOICE=1`。
- 前端: 顶部 `const LIVE_VOICE = false;`(或读 `/api/standby` 加个字段), `fetchVoice/eavesdrop` 首行 `if(!LIVE_VOICE)return;`。这样 DOM 不动、行为关闭, 改动最小、最易回退。
- **省 token 量**: 移除后**网页侧 DeepSeek 调用归零**(U1+U2 无界开销→0)。与每章正文写作(一.④, 必需)零重叠。

### B 级 — 必须留或符号化替代
- **B props.mind(M3)**: 保留。它喂正文, 删了角色就不"带心事/恩怨"出场。若要再省: M3 已是门控+M4缓存(~1/3章), 余量不大; 真要极限省可调高 `accrueImportance` 阈值或拉长批次间隔(改 minds.ts selectQueue 阈值), 但**不建议**(伤"全员连续心智"质感, 见 MEMORY novel-continuous-minds)。
- **A reflection(MockLLM)**: 保留。零成本; 是 candidate/StageCommitted summary 的语言素材。真想去可把 character-actor.ts:30 的 reflection 换成符号串模板, 但收益=0 token、风险=候选措辞变干, **不动**。
- **`/api/minds`+describeMind**: 保留。零 LLM, 是删 U1 后悬停 tooltip 的唯一文字来源, 删了 UI 会空。

## ④ 风险

| 风险 | 评估 |
|---|---|
| 删 U1/U2 影响**正文质量**? | **无**。U1/U2 输出从不进 prompt/库/进化, 纯 tooltip/对话框装饰。正文走 writeChapter(独立链路)。 |
| 影响**记忆召回**? | **无**。召回走 events 表 `readSalientMemories(≥0.6)`, U1/U2 不写任何表。 |
| 影响**进化**? | **无**。evolveOnce 读 fitness(events+chapters), 与 U1/U2 无关。 |
| 影响**用户体验**? | 轻微: 失去"实时悬停心声/偷听对话"的 demo 惊艳感。**缓解**: 悬停仍有 describeMind 符号"所思"; 且**新增的世界解说区(三)用零LLM补足"世界在动"的实时感**, 净体验不降反升(省钱 + 不再是零散 LLM 即兴而是连贯世事解说)。 |
| 温情/爽文兼容? | server.ts 不读 GENTLE, U1/U2 对两模式一致白烧; **移除对两者一致生效**, 无分支风险。 |

---

# 三、世界变化实时文字说明区(诉求②)

> **基础设施已存在, 仅需增强**。SSE 链路完整, 事件已是零LLM符号文案, 前端已渲染进 `#echoes`。缺口 = `#echoes` 是事件**碎片流**(`t12 道争·苏雪`), 非"每次世界改变一句完整中文解说"。

## ① 数据源(events delta)
唯一源 = `world.db` events 表增量。读侧 `broadcastNew()`(server.ts:54-61)每 1500ms 轮询 `store.readEvents` 取 `seq > lastSeqBroadcast` 的新行, 已含强类型字段 `{tick, subsystem, severity, verb, summary, kind}`(server.ts:58)。**全部零 LLM**(world-actor 写事件时由 pack.eventVocab 符号文案 + `evSubject` 强类型字段填充)。已有 `evSubject`(world-actor.ts:128-154)对每类事件产"谁·做了什么"短语。

## ② 每类事件中文文案模板表(零 LLM, 整句)
复用 `gentle-emergence.ts` 的 renderEmergence 风格(温润成句, 已是成熟范式)。后端按 `kind`+payload 填模板(severity 决定要不要进解说区):

| event kind | severity | 解说区中文模板(填 payload 字段) | 备注 |
|---|---|---|---|
| `ChapterInscribed` | notable | 「**第{n}章《{goal}》落成。**」 | 章成里程碑 |
| `StoryEventTriggered` | notable+ | 「**世道生变——{name}。**」/ 带 crisis 则「**{name}, {crisis}。**」 | 世界大事 |
| `CharacterFell` | notable | 「**{name}陨落于{cause}。**」 | 折损 |
| `FactionDissolved` | notable | 「**{faction}一脉为{into}所并, 自此烟消。**」 | 吞并 |
| `FactionSplit` | notable | 「**{leader}自{faction}裂土自立, 另开「{into}」。**」 | 分裂 |
| `VengeanceResolved` | notable | 「**{characterId}为{avenged}了断恩怨——{outcome}。**」 | 复仇 |
| `CharacterTranscended` | notable | 「**{name}登顶{toTier}, 功成身退。**」 | 飞升退场 |
| `ProgressionAdvanced` | normal/notable | 「**{name}破境, {fromTier}→{toTier}。**」 | 进阶 |
| `CharacterEntered` | normal | 「**{name}（{faction}）入场。**」 | 新人 |
| `DecisionRequired` | decision-required | 「**一桩待裁:{summary}（移目右栏议事）。**」 | 接议事 |
| `AuthorRuled` | normal | 「**{decisionId} 已裁:{verdict}。**」 | 裁决落定 |
| `StageCommitted` | normal | (默认**不进**解说区, 太碎; 仅当 summary 含"与…道争/结盟"时择要成句) | 防刷屏 |

> 模板实现: 在 server.ts 新增 `function narrate(e): string | null`(仿 evSubject 的 switch), 只为上表 kind 返整句、其余返 null(不进解说区)。**零 LLM, 纯读 payload + 模板字符串**。

## ③ 更新机制(SSE 增量, 不轮询正文)
复用现有 SSE。两条路二选一(推荐 A, 改动最小):

- **A(推荐)**: 扩 `broadcastNew()` payload, 多带一个 `narration` 字段 = `narrate(e)`:
  ```
  const line = `data: ${JSON.stringify({ tick, subsystem, severity, verb, summary, kind, narration: narrate(e) })}\n\n`;
  ```
  前端在现有 `es.onmessage`(index.html:266)里: 若 `e.narration` 非空 → prepend 进**新容器** `#worldlog`(而非 `#echoes`)。**同一 SSE 流, 不新增连接/轮询**。
- **B(可选, 合并成"本刻一句")**: 后端每 N tick 把窗口内 notable 事件合并 `「本刻:A 与 B 反目; C 派覆灭。」`——仍纯模板拼接(用 `；` join), **不调 LLM**(违约束, 不推荐)。

## ④ UI 形态
右栏现有 `#echoes`(index.html:87 `<h3>回响</h3>`)是开发者向碎片流, 保留。**新增独立容器** `#worldlog`(`<h3>世 事 流 转</h3>`), 放在 `#echoes` 上方或 `#worldstate` 下方:
- 只显 `narration` 非空的整句(即 severity≥normal 且属上表 kind)。
- 每句一行, severity 配色(notable=金/decision-required=朱/normal=墨灰, 复用现有 `.evt.notable/.evt.dr` 类)。
- 保留近 ~30 条(`while(childElementCount>30) lastChild.remove()`)。
- 顶栏 `#worldstate`(:75)已有"⚡crisis + 派系 + 第n章"摘要带; `#worldlog` 是其**时间线展开版**, 互补。

落地点(新增/改):
- 后端: server.ts:54-61 扩 payload(加 `narration: narrate(e)`) + 新增 `narrate()`(~30 行 switch, 紧邻可仿 world-actor.ts:128 的 evSubject)。
- 前端: index.html DOM 加 `<h3>世事流转</h3><div id="worldlog"></div>`(:87 区域); `es.onmessage`(:266-278)加 `if(e.narration){…prepend #worldlog…}`(~5 行)。

## ⑤ 成本
**零 LLM**(全读 events payload + 模板字符串, 复用既有 SSE 轮询)。无新 DB 查询(同一 `readEvents` 结果)。前端只多一个 DOM 容器 + 几行渲染。

## ⑥ 与 gentle-emergence 的关系
- **gentle-emergence**(gentle-emergence.ts) = **写者侧**, 把结构事件渲染温润一句**注入正文 prompt**(影响小说内容, 仅 GENTLE)。
- **世界解说区** = **读者侧**, 把结构事件渲染中文一句**显示给用户看**(不碰小说, 两模式都要)。
- 二者**共用同一批 events + 同一种"零LLM符号成句"思路**, 但去向不同(一个进 LLM prompt、一个进网页 DOM), 互不耦合。`narrate()` 可直接借鉴 renderEmergence 的措辞模板。**爽文世界**: gentle-emergence 不跑(GENTLE-gated), 但世界解说区**照常跑**(它读所有 kind 含 CharacterFell/FactionSplit 等戏剧事件, 爽文世界正好有料)。

---

# 四、落地计划(主 Claude 可直接据此实施)

## 推荐顺序: **并行**(两块零耦合, 都只动 server.ts + index.html)
诉求③(省token移除)与诉求②(加解说区)互不依赖, 可一次 PR 同时做。若分批, 先③(立省钱)再②。

### 阶段 1 — 移除 LLM 心声/对话(诉求③, 省 token)
| 步 | 改哪 file | 具体 |
|---|---|---|
| 1.1 | app/server.ts | 删/门控 `/api/mind?`(:153-168) + `/api/dialogue?`(:169-189)。推荐门控: 端点首行 `if(process.env["NOVEL_LIVE_VOICE"]!=="1")return json(res,{disabled:true});` |
| 1.2 | app/web/index.html | 前端加 `const LIVE_VOICE=false;`; `fetchVoice`(:329)/`eavesdrop`(:331)/`dlgTurn`(:330) 首行 `if(!LIVE_VOICE)return;`; pointermove voice 计时器(:319)包 `if(LIVE_VOICE){…}`; click 偷听(:327)包 `if(LIVE_VOICE){…}` |
| 1.3 | app/web/index.html | TOUR ③ 文案(:371)去"偷听对话", 留"悬停看所思" |

**验证**: 起一个观察器(`NOVEL_VIEW=saga PORT=89xx`), 悬停角色 / 点两角色 → 确认**无 `/api/mind?`/`/api/dialogue?` 网络请求**(浏览器 Network 面板); 悬停仍显 describeMind"所思"; 服务端日志无对应 DeepSeek 调用。grep 确认无残留引用。

### 阶段 2 — 世界变化实时解说区(诉求②, 零LLM)
| 步 | 改哪 file | 具体 |
|---|---|---|
| 2.1 | app/server.ts | 新增 `function narrate(e: {kind; verb; summary; …}): string\|null`(仿 evSubject switch, 见三.②表), 仅上表 kind 返整句 |
| 2.2 | app/server.ts | `broadcastNew()`(:58)payload 加 `narration: narrate(e)` |
| 2.3 | app/web/index.html | DOM 加 `<h3>世 事 流 转</h3><div id="worldlog"></div>`(:87 `#echoes` 上方) |
| 2.4 | app/web/index.html | `es.onmessage`(:266-278)末加: `if(e.narration){const d=document.createElement("div");d.className="evt"+(e.severity==="notable"?" notable":e.severity==="decision-required"?" dr":"");d.textContent=e.narration;$("worldlog").prepend(d);while($("worldlog").childElementCount>30)$("worldlog").lastChild.remove();}` |

**验证**: 观察器跑一活世界(或回放已有 saga/renjian 的 world.db), 确认 `#worldlog` 出现整句解说(章成/破境/派系兴亡/议事), severity 配色正确, 不刷 StageCommitted 碎片; Network 无新增 LLM 请求。

## 风险与验证法(汇总)
- **零正文/记忆/进化风险**(已二.④论证: U1/U2/解说区都不写库不进 prompt)。
- **回退**: 阶段1 用 env/常量门控(非硬删)→ 设 `NOVEL_LIVE_VOICE=1` + `LIVE_VOICE=true` 即复原 demo。
- **无 schema/事件协议改动** → 不破坏写者; 不需改 world-actor/longrun。
- **冒烟**: 改完只需重启**观察器进程**(server.ts), `npx tsx app/server.ts` 起一个 `NOVEL_VIEW=saga` 实例对现有 world.db 验证。

## 温情/爽文兼容
- 阶段1: server.ts 不读 GENTLE, 移除对两模式**一致生效**, 无分支。
- 阶段2: `narrate()` 覆盖**全部** kind(含爽文专属戏剧事件 CharacterFell/FactionSplit/VengeanceResolved + 温情常见 CharacterEntered/ProgressionAdvanced)。爽文世界料更足、温情世界偏温和事件, **同一份模板两模式都成立**, 无需 GENTLE 分支。

## 是否需重启世界
- **不需重启写者(longrun)**: 全部改动在 server.ts(读侧)+ index.html(前端)。写者进程不变、world.db schema 不变、事件协议不变。
- **只需重启观察器(server.ts)** 让新代码生效; 浏览器刷新加载新 index.html。**现有世界数据/章节/进化全部保留**, 无损切换。

## 主 Claude 可直接实施清单(最小集)
1. server.ts: `/api/mind?`(153-168) + `/api/dialogue?`(169-189) 各加首行 env 门控(默认关)。
2. server.ts: 新增 `narrate(e)`(三.②表) + `broadcastNew()`(58)payload 加 `narration`。
3. index.html: 加 `const LIVE_VOICE=false`; `fetchVoice/eavesdrop/dlgTurn`(329-331)首行 `if(!LIVE_VOICE)return`; voice 计时器(319)与 click 偷听(327)包 `if(LIVE_VOICE)`。
4. index.html: 加 `#worldlog` 容器(87) + `es.onmessage`(266)渲染 `e.narration`。
5. index.html: TOUR ③(371)去"偷听对话"。
6. 重启观察器 server.ts + 刷新浏览器验证(无 `/api/mind`/`/api/dialogue` 请求 + `#worldlog` 出整句)。

---

## 关键 file:line 索引
- 主循环: longrun.ts:220(main) :277(每章while) :339(sim步进×3) :378(readEventsSince事件总线) :429(writeChapter) :452-475(M3反思) :482-552(每8章进化)
- writeChapter: longrun.ts:181(节拍LLM) :189(标题LLM) :201-216(分段LLM×4, :206采样=evoGenome.gen)
- world-actor: core/runtime/world-actor.ts:173(step) :257-264(agents reflect MockLLM) :323-340(commit) :243(写props.mind) :128-154(evSubject符号文案) :548-582(saveStep单事务)
- 角色候选: core/actors/character-actor.ts:30(reflectAndPlan MockLLM)
- 心智: app/minds.ts:81/91(batchReflect真LLM) :35(accrueImportance) :70(selectQueue) :16(situationFp缓存)
- persona注入正文: app/persona.ts(personaBlock) ← longrun.ts:398
- 记忆召回阈值: store.ts:221(readSalientMemories minImp) ← longrun.ts:395(0.6 过滤掉0.3反思)
- describeMind零LLM: packs/xianxia-bazi/index.ts:161-174 ← app/pack-select.ts:18
- LLM装配: app/llm-factory.ts:60(makeLLM FallbackLLM) ; sim=MockLLM longrun.ts:49
- 温情涌现(写者侧, 解说区可借鉴模板): app/gentle-emergence.ts:11(gentleEmergence) :52(renderEmergence)
- 温情场景轮换: app/gentle-director.ts(gentleDirect) ← longrun.ts:318-333
- 进化: app/evolve.ts(evolveOnce/loadGenome/promoteToGlobal) ; sim-fitness.ts / warm-fitness.ts ← longrun.ts:513-522
- **诉求②基础设施**: app/server.ts:54-61(broadcastNew SSE) :118-124(/api/events) ; 前端 app/web/index.html:265-278(es.onmessage渲染) :87(#echoes) ; 事件字段 core/services/store.ts:15-19/37-39
- **诉求③靶心(LLM心声/对话)**: app/server.ts:153-168(/api/mind?) :169-189(/api/dialogue?) ; 前端 app/web/index.html:319(9s重发) :327-331(13s对话/eavesdrop/dlgTurn) :329(fetchVoice) ; describeMind保留来源 :307,:309(MINDS/refreshMinds)
- env旗标: NOVEL_STYLE longrun.ts:43 ; NOVEL_EVOLVE :80 ; NOVEL_WARMUP :38 ; NOVEL_VIEW server.ts:27 ; NOVEL_STANDBY server.ts:26
