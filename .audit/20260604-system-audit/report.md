# Novel System 全系统健康报告

> ⚠ **复核订正(见 critique.md)**: 本报告几处需修正——① **P1-1 eventBias「死接线」是误报**, 实为活线(在 packs/freeform/make-pack.ts:151 + xianxia-bazi:393 被消费, 控大事周期), 应删; ② **P0-1 真根因是引擎名池自身撞名**(组合生成器 surnames×givenNames 产出「萧曦」撞显式 spawnNames「萧斩」), **非 follow 专属、emergent 也不免疫**(arcsaga emergent live 一致性 4/10、4 矛盾); ③ **saga 已停跑**(只 mystory+arcsaga 在 live), "emergent 接近理想态"过度乐观; ④ P2-1/P1-5 的 live 数字(pendingImp 35-44 / force=11)为历史高水位、现已不成立(隐患真但非在发)。**真问题核定为 5 个**: P0-1 一致性漂离 / P0-2 跨世界 bestEngine 不进 global / P1-2 evCursor 冷读 / P1-3 global 无锁 / P1-4 defining 黑洞。无致命缺陷、无数据腐化。

> 日期 2026-06-04 ｜ 首席架构师综合审计（5 路子系统 + 3 路集成 + 首席复核实跑）
> 核对范围：core/（引擎/事件溯源/RNG/store）+ app/（longrun/evolve/sim-fitness/arc-select/drama/minds/canon/derive-canon/persona/constraints/server/world-gen）+ 三世界实跑产物（mystory 161 章·tick 648·7345 事件 ｜ arcsaga 8 章·tick 130·1425 事件 ｜ saga）+ global-evolution.json（4 niche）。
> 诚实区分【实锤验证】（查了 DB/JSON/进程/日志）与【读码推断】（只读代码逻辑）。首席已对最 load-bearing 的 6 处断言逐一复核。

## ① 总判定（一句话）

系统整体健康度：良好且真在跑——核心引擎、写作管线、连续心智、八字奇门、议事裁决、伏笔、跨世界 QD 引种全部【实锤在跑】且零事件腐化（7345/7345 事件无空洞无重复、账目三层闭合、deepseek 真在写非退 mock）；但有 2 个 P0 语义错配在 live 上已发作——(A) follow/strict 模式下「引擎程序化名册 vs 大纲专名」三方分裂，导致 mystory 一致性锁死 2/10；(B) 跨世界 QD 全局存档归格用「风格父本旧 engine」而非世界级 bestEngine，导致归错格+传错基因+世界内的 engine 解耦在跨世界层前功尽弃。两者都不致命（不崩、不腐化数据、最终一致），但都是「功能在跑却没按设计意图产出正确结果」——直接关系到用户「合理且正确运行」的核心问题。

## ② 逐子系统健康表

| 子系统 | 判定 | 一句话依据 |
|---|---|---|
| 核心引擎（事件溯源+tick步进+gate→commit→compose+单写者锁） | 健全·在跑 | 确定性实测成立（同seed重跑事件流逐字节相同）；live mystory 7345事件 last_seq==max_seq==count==distinct_id、seq连续零空洞、646checkpoint tick全distinct；gate→裁决→commit账目三层闭合（DecisionRequired203==AuthorRuled203，accept116==Promoted116==Advanced116，reject87==Archived87，pending=0）；单写者靠模式分区+longrun.lock双条件心跳（PID探活∧mtime<10min）+进程内_busy同步互斥，两step()写者永不指向同一world.db。 |
| 自进化QD（爬山+MAP-Elites+跨世界全局层） | 有bug | 闭环真闭合且真在变（gen5、archive6格、19score、bestEngine已记）、QD引种真生效（全局4格中3格来自被kill世界）；但P0：全局cells归格用风格父本旧engine而非bestEngine（live实锤：mystory bestEngine turnover=0.75应归低代谢，却被按高代谢×平沉积，且其真bestEngine在全局文件查无踪迹）；P1：eventBias是core端死接线（全局已空转进化到1.2/1.25，core从不读）。 |
| 写作管线（arc-select起笔+多层注入+守门弃章+跟纲三档） | 有bug | 预演化挑弧线起笔CLEAN（确定性、无双重快进，arcsaga tick125/8章in-medias-res实锤）、跟纲三档真分档生效、守门弃章数学正确（mock章~44字<<阈1200必拦）；但P0：follow/strict模式canonHard(引擎程序化名)vs canonInject(软层大纲名)vs outlineBeat(大纲专名)三方名册分裂→mystory一致性锁死2/10（6条矛盾全是正文写萧斩/林书同，硬事实只列萧曦/林舒雅）；emergent模式(saga)免疫。 |
| 模拟深度（连续心智+八字奇门prior+铁律规则层+导演dramaControl） | 健全·在跑（含2内部小瑕） | 符号心跳零LLM全员每tick、门控批量反思实锤省LLM（日志批量反思5人(1次LLM·缓存复用3人)）、mind-update46条全processed闭环打通；奇门真排盘真驱动裁决（reject43%+VengeanceResolved三态分布）；铁律提案→人工裁决→注入闭环真发生（gen3、history全approve）；导演与进化是基线×瞬态叠加无竞态。瑕疵：selectQueue force溢出K_MAX（里程碑角色被切）、队列尾部饥饿（pendingImp达35-44，THRESHOLD失区分度）——均不阻断、不影响LLM争用。 |
| 交互服务（待机→定义→起跑+议事弹窗/全自动裁决+全量透传+导出全本） | 健全·在跑（含1UX缺陷） | 两server实测在线（:8990 mystory/:8991 arcsaga，全/api可达）、定义→起跑端到端打通（槽位/大纲/服从度/预热）、议事双裁链幂等安全（消费侧pending.findIndex裁过即splice、二次no-op，实锤验证无害）、/api/snapshot全量透传是加法不破前端、导出txt/md正确（中文名filename*=UTF-8''正确）。缺陷：defining内存标志仅child.on(error)一条复位路径，spawn后子进程撞锁自爆不复位→待机页黑洞至6分钟客户端超时。 |

说明：任务描述里 /state 路由 + cells 透传在本仓库不存在（交互层审计实测 /state 返回404，全仓cells只命中evolve.ts的MAP-Elites格子，与快照/前端无关）。实际暴露的是/api/snapshot，它确是全量加法透传、不破前端——结论等价，但接口名与任务描述不符，记录在此防误导。

## ③ 协作逻辑判定（端到端数据流+新功能交互+契约哑数据）

端到端数据流：主干顺，时序基本正确。一tick/一章全链路 step()推演→写events→gate评估→author裁决→commit落定→writeChapter成章→落盘→(每卷)evolveOnce→promoteToGlobal入全局QD 的关键时序全部正确（逐一实锤/读码确认）：
- canonHard从快照派生在3×step之后（读到本章已提交的世界状态）✓
- 伏笔回收标记、evCursor推进、minds反思、compose点灯全延后到落盘成功之后，守门弃章则一概不发生（干净重试，无重复计数）✓
- saveSimFitness先于evolveOnce（sim折进fitness0.28权重+更新bestEngine）✓
- canonStep先于evolveOnce（一致性折进consFit）✓
- dramaControl写tuning先于本章step（据此演化），且包在withLock内 ✓

新功能交互：5对里4对安全、1对有冲突。
| 交互对 | 判定 | 根据 |
|---|---|---|
| warmup播种基因+QD intent取种 | 安全（正交） | warmup零写genome（arc-select对genome/tuning零引用）；intent在line74设基因、warmup在line219设起笔tick，维度正交不可能互覆盖。 |
| 铁律conBlock+跟纲beat+lore召回+canon硬事实同注一章 | 有冲突 | 容量不挤爆（拆两段prompt管理长度），但follow/strict下canonHard/canonInject/outlineBeat三方名册分裂——live mystory已锁死2/10；conBlock+lore不引新矛盾但叠加约束放大问题。 |
| 全自动裁决vs铁律人类策展 | 安全（物理隔离） | applyConstraintVerdict全仓只被server.ts:212(人工网页)调用、无任何自动路径；autoverdict开关只管普通议事GRACE，不读constraints。铁律必须人在闸门=设计红线，live印证(mystory开autoverdict但3条铁律全人工approve)。 |
| 批量反思LLMvs章节写作LLM | 安全（串行无争用） | 同一单线程async循环串行await、共享单llm实例、物理无并发；反思有≥3章门控+指纹缓存、占比<15%，绝不爆429。 |
| 进化evoGenome.engine vs导演dramaControl每章覆写tuning | 安全（基线×瞬态叠加） | drama{...base}透传进化7键、只相对缩放4键，priorWeight/scarcity/nicheWeight不碰；evolve不写props.tuning、无写竞态；张力回临界drama自动退出（live：streaks=0、tuning==genome.engine逐键相等）。 |

契约哑数据/死接线：
- eventBias=跨evolve↔drama↔core的死接线（P1）：上游drama.ts:46写进tuning、evolve.ts clamp+mutate+写genome/archive/cells+reflection建议，但core/world-actor.ts:267-273的tuning读取块从不读eventBias（首席实锤：grep -rn eventBias core/ 零命中）。进化在这一维空转，reflection还在教LLM拨这个断头旋钮。
- 跨世界QD engine归格错配=跨evolve内部↔promoteToGlobal的契约不符（P0）：evolveOnce内engine解耦正确（mutate基底取ledger.bestEngine.engine），但depositWorldArchive（evolve.ts:104-107）取archive冠军cell的champ.genome，而cell存的是cloneGenome(cur)（写那卷的风格父本整体genome，其.engine是冻结的风格engine、不是bestEngine）→送进全局cells的是风格engine。世界内辛苦解耦的bestEngine从不进全局cells，跨世界层前功尽弃。
- 其余上游产出下游真在用、无哑数据：arc-select↔sim-fitness共用siftStories（同函数同形状真消费）✓；derive-canon↔canonStep派生硬事实喂校验✓；引擎genre中立只tnum读6number(除eventBias)✓；mind-update/spawn/author-verdict同input通道单事务drain✓。

## ④ live实跑核对结论

核对方式：直接查在跑世界的真实SQLite+JSON+日志+进程/锁，不看设计看现实。

实锤【在跑/生效】的功能（无一代码在但没生效）：
| 功能 | 判定 | 实锤证据 |
|---|---|---|
| 核心引擎事件溯源 | 实锤在跑 | mystory last_seq==max_seq==count==distinct_id==7345，648tick零空洞零重复零半提交；CharacterEntered44==spawn-character44（生死账平）。 |
| gate→裁决→commit | 实锤在跑 | GateEvaluated ask-author203/pass446；DecisionRequired203==AuthorRuled203；accept116==BranchPromoted116==ProgressionAdvanced116；reject87==BranchArchived87；input_queue author-verdict203全processed。 |
| 自进化闭环 | 实锤在跑且在变 | evolution.json 19score/gen5/bestEngine{sim6.63}；archive6格点亮；闭环非常数（fitness5.93→7.27→6.59…）。 |
| 跨世界QD引种 | 实锤生效 | global-evolution.json mtime19:03(刚写)、4niche、bestFitness7.75；3格来自被kill世界（saga-killed/arcsaga-killed/qunxiang-killed）→局部最优搁浅靠引种传得出真兑现；promote后其余3格未被抹（per-niche单调基底成立）。 |
| 连续心智 | 实锤在跑 | minds.json lastFp9角色指纹+pendingImp+lastReflectCh161；日志批量反思5人(1次LLM·缓存复用3人)（M3批量+M4缓存省LLM兑现）；mind-update46全processed（写回闭环）。 |
| 八字/奇门prior | 实锤在跑 | 254事件含奇门盘；hint带阳遁9局值符天冲伤门(凶)；auto-verdict reject43%由奇门valence驱动；VengeanceResolved三态分布（雪恨/受挫/释怀）。 |
| 铁律规则层 | 实锤在跑 | constraints.json gen3、history3条全approve、active[0]经3次rewrite累积演化（atVol2/4/6）。 |
| 伏笔setup→payoff | 实锤在跑 | foreshadows.json22条全paid；日志双向埋伏笔(第171章回收)/回收伏笔。 |
| deepseek真写 | 实锤在跑 | config=deepseek-v4-pro+真key；正文mystory ch161=5682字、arcsaga ch8=18750字真实叙事（mock只会吐~44字hash碎片）；fallback:mock只是provider声明串非活动路径。 |
| arc-select起笔 | 实锤生效 | arcsaga tick125/仅8章（≈101tick来自快进）、ch1 in-medias-res开篇。 |
| 守门/重试堆积 | 实锤无异常 | 两longrun日志零error/弃章；input_queue三类全processed零pending。 |

代码在但【此刻未生效/查无据】的：
- eventBias旋钮：代码完整（clamp/mutate/写盘/reflection），但core从不读→live全局已空转到1.2/1.25，对世界步进零作用。【实锤：core零引用+全局文件已演化该值】
- priorWeight强度缩放：两世界genome.priorWeight==1→world-actor.ts:277 pw===1短路→此刻调强度卖点无额外缩放体现（但奇门/八字influence已烘进基础权重、始终生效，254盘面+43%reject即证）。非bug，是旋钮当前停在中性。【实锤：genome值=1】
- drama hot（present≤5）收敛分支：longrun每5章补在场到16→present≤5几乎不可达→hotStreak长期为0（两世界=0）。近乎死码（非bug，阈值设计与roster维稳策略冲突）。【实锤：drama.json hotStreak=0】
- bestEngine在全局层：mystory bestEngine（turnover0.75/sim6.63）在global-evolution.json查无踪迹——全局4格engine全是风格快照值，无一来自任何世界bestEngine。【实锤：逐格dump确认+mystory ledger dump对比】

live与子系统审计的交叉印证（首席复核纠偏）：
- core-engine称evCursor时机正确治O(N²)——单进程内成立，但漏了跨重启evCursor=0冷读（dataflow审计新增P0，首席复核证实longrun.ts:213 let evCursor=0不持久化+line322 readEventsSince(db,worldId,evCursor)）。
- 写作管线称mystory follow/strict——首席实锤确认：outline-plan.json存在、obedience=strict、23beats，canon一致性=2/10、6矛盾。P0名册分裂坐实在live。

## ⑤ 问题清单（按严重度）

阻塞级（功能在跑但产出语义错误，直接违正确运行）：

P0-1｜follow/strict模式名册三方分裂→一致性永久锁死2/10
- 文件:行：app/canon.ts（软层抽大纲名）+app/derive-canon.ts（硬层抽引擎程序化名）+app/outline-plan.ts→app/longrun.ts:161（strict注入大纲专名）+根因packs/freeform/make-pack.ts:120-126（补血用surnames×givenNames模板名）。
- 触发：follow/strict模式+引擎turnover让大纲主角退场（mystory c1-c4全present=false/t7）+补血用模板名（雷兴旺/顾书同/萧曦…，大纲配角老陈/阿福/叶寒全没进spawnNames）+strict outlineBeat持续灌大纲专名（萧斩/林书同/小泥巴）。三套名册同时注入。
- 影响：【实锤】mystory/canon.json lastConsistency=2/10、6条矛盾全是正文写萧斩但硬事实只列萧曦、在引擎与软设定档均不存在。一致性分喂进化consFit→长期拉低适应度。emergent(saga)免疫（单一名册）。
- 建议：二选一——(a)follow建世界时把大纲全部具名角色(含配角)灌入cfg.protagonists+spawnNames+reviverNames，并对大纲主角设turnoverRate→0/不可退场，令引擎名册=大纲名册；(b)给outline-plan做专名→当前在场角色映射层（beatForChapter输出前把大纲名替换为最近似在场角色名）。唯一真相=引擎快照snap.characters，任何注入与正文都须用快照在场名。

P0-2｜跨世界QD全局存档归格用风格父本旧engine而非bestEngine→归错格+传错基因+解耦被废
- 文件:行：app/evolve.ts:104-107（depositWorldArchive取champ.genome）+:306-307（cell存cloneGenome(cur)=风格父本整体genome）vs:324（mutate正确用ledger.bestEngine.engine）。
- 触发：每个n%8章evolveOnce→promoteToGlobal→depositWorldArchive，把archive fitness最高cell的champ.genome.engine（=那卷冻结的风格engine）按engineNiche归全局格。
- 影响：【实锤】mystory archive冠军engine turnover=1→归高代谢×平；但其真bestEngine turnover=0.75(sim6.63)本该归低代谢——全局低代谢×平那格(turnover0.75)却from=saga-pre-fixes非mystory，mystory真bestEngine在全局文件查无踪迹。后果三连：①全局niche标签与真实策略语义反指；②未来intent=低代谢取种拿不到mystory低代谢配方；③世界内bestEngine解耦在跨世界层前功尽弃。
- 建议：depositWorldArchive/depositGenome沉积前把champ.genome.engine替换为该世界loadLedger(d).bestEngine?.engine（回退champ.engine），再engineNiche归格——gen(文笔)取风格冠军、engine取世界级模拟最优，与evolveOnce L324解耦语义对齐。改后须bootstrapGlobalCells重跑一次纠正现有4格错engine。

应修级（在跑但有缺陷/空转/UX黑洞）：

P1-1｜eventBias是core端死接线（进化空转一维+误导reflection）
- 文件:行：core/runtime/world-actor.ts:267-273（tuning读取块缺eventBias）vs app/drama.ts:46+app/evolve.ts:258（clamp）/:247（mutate）/:321（reflection建议升eventBias）。
- 触发：每轮进化都在eventBias维度mutate+写盘。影响：【实锤】全局已空转进化到1.2/1.25，对世界步进零作用；reflection教LLM拨断头旋钮。
- 建议：二选一——core在大事触发处（world-actor.ts:384 pack.nextStoryEvent附近）真正tnum(tune,eventBias,1)调触发概率使其闭合；或从EngineGenes/mutate/niche/reflection删该维度停止空转。

P1-2｜evCursor跨重启冷读→首章把全史兴亡当近时变故
- 文件:行：app/longrun.ts:213（let evCursor=0不持久化）+:322（readEventsSince(db,worldId,evCursor)）。
- 触发：进程重启（mystory已多次重启，mystory-killed-*存在）→n从listChapters恢复（可161）但evCursor从0冷启→首章读回全部7345事件、filter出全程数十桩兴亡塞进crisis近时变故。
- 影响：重启后第一章prompt把几百章前旧大事当近时灌LLM，叙事上下文污染一章（不重复计伏笔/反思，那些走force/指纹/pending去重）。
- 建议：evCursor初值resume安全——重启时设maxSeq(db,worldId)（已落盘章节对应事件视为已叙述），或持久化进世界目录小文件。

P1-3｜global-evolution.json无跨世界锁→残留最长一进化周期的晋升回滚一拍
- 文件:行：app/evolve.ts:117-123（writeGlobal仅rename+末读合并）+app/longrun.ts:49（longrun.lock锁世界目录、不覆盖共享上级.novel-output/的全局文件）。
- 触发：MEMORY载4世界并发，两世界longrun在各自n%8章对同一全局文件无互斥；A在loadGlobal后、renameSync前B完成整个rename→A覆盖B、B本轮新晋升格丢失。
- 影响：最终一致（下个任一世界n%8靠prev.cells基底合回），非数据腐化，是晋升延迟/偶发回滚一拍（最长8章）。原子写有（tmp带PID不互撞）、跨世界互斥无。这是全系统唯一仍缺互斥的多写者点（所有世界内旁路写已被withLock+单事务覆盖）。
- 建议：.novel-output/根加跨世界global.lock（与世界级longrun.lock分离）包住writeGlobal的load-merge-rename；或接受最终一致并在MEMORY显式记此契约。

P1-4｜定义世界defining标志仅一条复位路径→spawn后撞锁自爆=6分钟待机页黑洞
- 文件:行：app/server.ts:240/260（defining=true+仅child.on(error)复位）vs app/longrun.ts:57（撞单写者锁process.exit(0)）。
- 触发：spawn成功（error不触发）但longrun启动后自爆（撞锁/配置异常/tsx编译错）→defining永停true，前端持续世界生成中至6分钟客户端超时（html:400）。
- 影响：撞锁是毫秒级失败，6分钟黑洞是过长UX。server对spawn后子进程死活无感知。
- 建议：/api/standby在defining=true时顺带探longrun.lock存活+章节数，死锁即提前复位。

P1-5｜selectQueue force-set溢出K_MAX→里程碑角色被静默丢
- 文件:行：app/minds.ts:78（[...forced,...overThresh].slice(0,K_MAX)）。
- 触发：force角色数>K_MAX(8)。【实锤】arcsaga force=11>8，3个force角色（含主角c1=6.4）被切。
- 影响：里程碑大事必反思承诺在该章对溢出者破。不崩，但反思覆盖不全。
- 建议：force超K_MAX时按pendingImp在force内部取top-K，溢出者置carry标志顺延下轮，不静默丢。

小瑕级（不影响正确性，体验/可解释性/口径）：
- P2-1｜队列尾部饥饿+pendingImp无界累积（app/minds.ts+longrun.ts:383-399）：drain≈2.67角色/章、roster13-15，非选中者pendingImp只增不减。【实锤】mystory pendingImp达35-44（THRESHOLD2.5的14-17倍），5个高分角色长期排不进队、其mind长期不更新。建议：选中后对未选者衰减(*=0.9)或设上限，让THRESHOLD恢复区分度。
- P2-2｜守门弃章令drama.coldStreak/hotStreak二次累加+世界多漂~3tick（未标注）（app/longrun.ts:274-289）：弃章重试同一n时dramaControl再跑一遍、streak二次持久化、世界再3×step。低频弃章影响小，但弃章不推进世界口径不准；且门前埋伏笔日志在弃章时仍误打印。建议：streak持久化+3×step移到守门之后或弃章分支回滚增量。
- P2-3｜engineNiche仅4格→引擎多样性降维坍缩（app/evolve.ts:92-96）：只turnoverRate×structureGrowth二值化，conflictRate/scarcity/nicheWeight/eventBias多样性被抹平、异质策略并格互相单调淘汰→QD在引擎维度近似单点爬山。非bug（设计声明零新持久化按定义分野），但与局部最优传不出目标有张力。建议：若要真QD扩到≥3轴，否则文档标注4格粗投影、仅区分群像/文笔。
- P2-4｜普通议事auto-verdict平局默认accept（app/longrun.ts:304）：(valence??0)<-0.2?reject:accept，奇门平(valence=0)→accept。无人值守世界power progression偏快（mystory accept116 vs reject87）。建议：把平独立成defer/再议而非默认放行。
- P2-5｜drama hot（present≤5）近乎死码（app/drama.ts:37）：roster维稳每5章补到16，present≤5不可达，hotStreak长期0。建议：阈值相对ROSTER_TARGET设（如≤FLOOR）。
- P2-6｜scout与真世界共用sim单例（app/longrun.ts:40）：当前MockLLM无状态无害；换有状态provider则scout跑WARMUP污染真世界RNG复现。建议：契约固化scout必须独立db+与真世界同seed/worldId、勿共享有状态provider。
- P2-7｜worldId硬编码saga（app/longrun.ts:96）：与输出目录名无关，live事件id全saga-tN、world_id列恒saga。单库单世界安全，但多世界塞一库会立刻撞id。脆弱，建议改用目录名派生。
- P2-8｜events唯一真相可fold重建是名义非实现（core/data/schema.sql+world-actor.ts:2-3注释vs core无fold函数）：实际snapshot-as-truth+事件审计日志，复现靠同seed重跑step。若world_state丢失，当前无法从events重建状态——真实弹性缺口（不影响正常运行）。建议：补fold/replay或改注释口径。
- P2-9｜数据/接口名错位：worlds-registry.json端口（qunxiang写8990撞主server）与create逻辑（9000+reg.length）不自洽；arcsaga世界config落在mystory.json（目录名≠config名）→导出标题降级为目录名；任务描述的/state+cells在仓库不存在（实为/api/snapshot）。建议：清理注册表、修目录名/config名对齐。

## ⑥ 结论：系统是否如用户所愿合理且正确运行，还差什么

大部分合理且正确，且是真在跑的真系统——但有2处在跑却不正确的语义错配需修才能称完全正确。

已达成（实锤）：所有核心功能的运行逻辑自洽且真在运行——引擎确定性成立、事件零腐化、gate→裁决→commit账目三层闭合、单写者铁律不破；自进化闭环真在变、跨世界QD引种真把被kill世界的配方传了出来；连续心智真在符号心跳+批量反思+写回闭环；八字奇门真驱动裁决与事件；铁律真经人工策展演化；伏笔真setup→payoff；deepseek真在写。相互配合的逻辑也基本顺：端到端时序正确（派生在step后、副作用在落盘后、sim/canon先于evolve、drama先于step且withLock）、5对新功能交互4对正交/隔离/串行无打架、契约绝大多数上游产出下游真消费无哑数据。

还差（两处功能在跑但产出不对，均live实锤发作）：
1. P0-1名册分裂——follow/strict模式下引擎程序化名册、软层大纲名、大纲专名三方打架，让mystory一致性锁死2/10。这是配合逻辑打架的唯一真冲突：引擎turnover+模板补血+strict灌专名三者把正文拽向一套引擎里不存在的名册。修法明确（引擎名册=大纲名册，或专名→在场角色映射层）。
2. P0-2跨世界engine归错格——世界内辛苦解耦的bestEngine在跨世界全局层被风格父本engine顶替，导致归错格+传错基因。这是契约不符的最实锤一例：世界内对、跨世界废。修法明确（沉积前engine换bestEngine+bootstrap重跑）。

外加3个应修（eventBias死接线空转一维、evCursor跨重启冷读污染首章、defining黑洞6分钟）与若干小瑕（队列饥饿、全局锁残窗最终一致、4格降维、平局默认accept等），均不阻断运行、不腐化数据。

一句话：系统合理、且绝大部分正确运行（核心引擎与多数协作是健全的真系统、live全项在跑无腐化）；要达到完全正确还差修两个P0语义错配（follow模式名册统一+跨世界engine用bestEngine）——它们是功能在跑但没按设计意图产出正确结果的精确缺口，不是功能没跑。emergent模式(saga)当前已接近合理且正确的理想态。
