# 保留 / 废弃 / 重做 主清单 · Novel System 清白重写

**生成** 2026-05-28 · Phase 1 综合
**输入** 4 份并行 digest + 本地 SOTA 增量扫描
**引用标记** `(DR)`=deep-research digest · `(RV)`=上次 rebuild review digest · `(UX)`=难用根因 digest · `(AR)`=架构方向 digest · `(SOTA)`=2026-05 web 增量
**定位** 这是清白重写的"backward-looking 决策日志"——什么沿用、什么避开、什么换方式做。forward-looking 的新规格见同目录 `spec-v0.md`。

---

## 修订 (2026-05-29 用户决策)
- **genre 不绑定修仙**：修仙+八字 = 旗舰内容包；引擎与内容包分离，不硬编码修仙/八字。§3 的"境界状态机"泛化为"进阶/力量体系状态机"（修仙包配置为境界）。新增设计支柱见 `spec-v0.md` §2.7。
- **合规暂缓**：个人自用、海外平台、系统好用后再加 → 下方 §2.1 的"🔴 合规红线"**当前不是硬约束**；anti-slop 保留但理由改为"质量"（非合规）。近期成功 = 能写完整一部小说。

## 0. 一句话结论
旧系统的**研究认知、架构三大抽象、各模块 paradigm 全部值得保留**;真正"难用"的是**实现层的静默腐败 bug + 前端架构债 + compose 默认配置 + 作者交互模型**。所以清白重写 = **保留命题与抽象、重做实现与交互、避开一串已知地雷**,而不是从零重新认知。

---

## 1. 保留 KEEP — 必须约束重写的认知与抽象

### 1.1 命题 / 研究层 (DR, SOTA)
- **护城河成立**:常驻 agent 世界模拟 + 八字奇门 first-class + 修仙长篇,这个交集 2026 年仍是真空(SOTA 确认:InkOS/StoryBox/StoryWriter/AgentSociety 2 都只覆盖其中一片)。
- **八字-as-prior 有实证、且无新竞品**:2510.23337 仍是唯一关键论文,shuffled-birthday ablation 掉 45.7%、championship 60%、MingLi-Bench 逼近人类 53.5%。`(DR)(SOTA)`
- **"符号先验 + LLM > 纯 LLM" 是跨领域规律**,不只八字:PANGeA(Big Five)、Tarot、narrative theory 都是同一 architectural slot → 八字 first-class 有方法学正当性。`(DR)`
- **符号化叙事规划不可删**:ASP 实证(2506.10161)证明纯 LLM 在"有意图角色 + 戏剧冲突 + 长程规划"上系统性失败 → Director/符号层是硬需求。`(DR)`
- **成本经济性已 OK**:batch Haiku $0.50/$2.50,价格两年降 ~10x;先 10–15 角色 × 1 个月做底。`(DR)`

### 1.2 架构层三大抽象 (AR) —— v3 已落地、被 30 个对标系统验证
- **WorldEvent = 唯一真相**(append-only 事件日志,severity=ambient/notable/decision-required,幂等 by id)。分散感的根因就是"每个子系统各写各的容器";统一事件层是解药。
- **单 tick 循环,compose 是 phase 不是独立 pipeline**(frame→agents→branches→gate→commit→maybe compose)。直接兑现"章节是模拟副产品"愿景。
- **Metaphysics-as-prior**:`scoreCandidate(candidate, frame) → 0..1 权重 + 可解释 breakdown + contributingInfluences[]`。八字(character)/奇门(location)/八卦(branch)真正投射进打分,既是命题又满足"让作者看见为什么这个分支胜出"。**这个接口形状要冻结保留。**
- 配套保留:单 SQLite(备份=cp 文件)、严重度三层(防通知疲劳)、事件幂等 key、失败隔离 + tick 原子性、后端 emit / 前端 derive。

### 1.3 代码 paradigm 层 (RV) —— review 默认接受、e2e 证明可跑
> 注意:这些是 paradigm 值得沿用,**不等于旧实现值得沿用**(实现见 §2/§3)。
- LangGraph + checkpoint 做常驻 daemon(框架对,问题在"哪些状态没进 graph state")
- FTS5 contentless + 触发器镜像 + CJK 预分词(中文检索方向对)
- Park 记忆流(memoryStream+reflect+plan)+ AgentRegistry **懒实例化**(深度>数量,符合 DR 的 lazy-instantiate)
- Director 五阶段三幕 + tension EMA + focus rotation
- canon-gate 作为"分支能否入正史"的独立闸门(概念对,实现全断,见 §3)
- 前端零 `dangerouslySetInnerHTML`、全走 React 自动转义(XSS 纪律必须沿用)
- 混合记忆三信号排序(BM25 × recency × importance)、JSON 真相源 + SQLite 可重建索引、每文件诚实标注"这是启发式/LLM 替代版"

### 1.4 UX / 前端 paradigm (UX)
- Zustand 多 store + 精确单字段 selector;SSE 实时流(**不要倒退回轮询**)
- 三层皮 redesign 的五招已 ship P0–P2、123/123 测试绿:**WayfinderLine(引路)/ CouncilCard(议事仪式)/ StatusPulse(静观听筒)/ 暗格(daemon 控制收纳)/ 巡礼(Memory/Atlas 探索)** —— 这套交互模型保留
- LampTrack 呼吸-香动效语言、设计 token、衬线正文族、合理表单默认值

---

## 2. 废弃 KILL — 要主动避开的反模式 / 地雷

### 2.1 研究明确警告的 (DR) —— 设计原则级
- **不要 ungrounded reflection**:Reflexion 同模型既当 actor 又当 judge;reflection 必须挂外部 memory/world-state delta,否则退化成 overthinking。
- **不要裸递归任务循环**(AutoGPT/BabyAGI 式):会分心、不连贯。常驻 daemon 必须有强 canon/state + 审阅门,不能是裸 loop。
- **不要纯 turn-passing / 角色 agent 轮流写一段拼起来**(CollabStory 证实 crowd-of-authors 退化)。
- **不要用长上下文替代结构化检索、不要纯 vector RAG**:长篇连续性 Graph-RAG > vector;血脉/宗门/境界是图结构。
- **不要 hands-off 长跑**:28% plan-decay(QSAF),必须内建漂移监控 watchdog + 定期 author-pause。**validation 才是瓶颈,不是 capability。**
- **不要让 LLM 算八字数学**:DeepSeek 等换生日输出几乎一样=统计模仿。必须 deterministic 排盘 + LLM 只解释。
- **🔴 不要踩中文平台合规红线(spec 必须单列一节)**:晋江 2025 只允许 3 级辅助(校对/灵感/粗纲),越界=锁章/禁榜;国家《AI 生成合成内容标识办法》2025-09-01 生效,必须标注 + 自声明;编辑识别 AI 的 signature=辞藻华丽/硬转场/POV 不稳/主线漂移/比喻+数字堆砌。→ **KILL:无 anti-slop、无 provenance、定位"全自动出版"的形态。**
- **不要重蹈"~20 章战力崩坏/人设偏移"**(蛙蛙写作的天花板):不显式建模境界状态机 + 人设锚就会撞同一堵墙。

### 2.2 旧实现的静默腐败 bug (RV) —— 重写时"绝不重新长出来"
- 记忆层:`mirrorIndex` fire-and-forget 不 await 吞 rejection;每次写 `DELETE FROM memory_entries` 全量 rebuild(每章付一次 embedding 钱 + O(N²));三处 JSON 裸 `writeFile` 非原子。→ 这三连是"静默索引腐败"主风险。
- 归属:`summary.includes(characterName)` 中文子串假阳("李"吸收"李雪")。
- 注入:记忆 id 原样进 CRITIC prompt + 记忆文本未转义直插、section header 用裸 `## 任务` → 用户给角色起名即可劫持 prompt。
- 安全:apiKey 明文 0o644 落盘;HTTP 无 body size 上限(DoS);顶层 catch 把绝对路径/用户名原样回客户端;`baseUrl` 外连无 host allow-list(SSRF);wire 层零运行时校验(原型污染/NaN)。
- 前端系统性病:裸 `qc.invalidateQueries()`(无 key)→ refetch storm;`refetchIntervalInBackground:true` 永不停轮询;表单 hydration effect 每次 server 变更 `form.reset` 盖用户输入;全局 keydown 裸字母键导航误触;**全站无 ErrorBoundary**(任一 render 抛错=白屏)。
- LLM 解析:`parseJSONLoose` 只抓第一个 fence + brace-slice 无平衡扫描;非 OK 一律 throw 无 429/退避;9 分钟卡死不可 cancel(无 AbortSignal)。
- 正则:`/[一-鿿]{1,6}般/` 误杀"一般/百般";`那么.*那么` ReDoS;per-call 动态正则每章 260 次编译。

### 2.3 旧前端架构债 (UX) —— "难用"的架构层根因
- `App.tsx` 1659 行 god component(30+ useState、27 handler、6 内联工作区);`server.ts` 1654 行塞进前端 Vite middleware。
- **无路由** → 刷新/分享/后退丢工作区与上下文(F1,最高杠杆单点)。
- **6 个工作区重复呈现同一实体图**(历史线/阶段/分叉/AI 设置各 ≥2 处)(F11)。
- 破坏性"应用世界草案"无撤销/无 diff(F4);记忆视图直接甩原始 JSON(F5);裸 textarea 编 Markdown(F6);长列表无虚拟化/搜索(F7);领域黑话无 tooltip(F8)。
- **compose 默认配置导致主观卡死**:thinkingMode=enabled 让 synthesize 走 thinking(每章多 60–90s)+ `stream:false`(模型 5s 出字 UI 等整段)+ 长度修复循环 3 次 + 严格串行 + 10min/次 timeout。

---

## 3. 重做 REDO — 换方式重建(给方向)

### 3.1 最大架构缺口:作者裁决契约(RV,最高优先级)
旧 canon-gate → 标 paused,但**没有任何机制真正 accept/reject/promote 分支**;`world-daemon.resume()` 只把 paused 翻成 completed,死亡风险路径因 `risks.length===0` gating 不可达 → **作者输入对正史零影响,致命提案被静默拒绝**。
→ 重做:resume() 接受作者 choice(accept/archive/reject/revise);accept 调 `engine.promoteBranch()`;daemon 加 acceptBranch/rejectBranch RPC;risks 不过滤透传给 gate 区分"硬阻断"vs"问作者"。**这是"难用"在引擎层的对应物——作者点了没用。**

### 3.2 状态持久化与 checkpoint 边界 (RV, AR)
- graph daemon:director 的 tensionEMA/phase/focusHistory + agent 记忆**没进 SqliteSaver** → 进程被杀后用空状态导演。重做:纳入 graph annotation root 经 reducer 更新,或 resume 时从 canon 历史 hydrate。
- 记忆并发(整层重做):per-store mutex/写队列 + delta upsert(稳定 `(kind,id)` 键)+ embedding 进背景 worker(幂等 upsert、绝不 rebuild)+ tmp→fsync→rename 原子写。review 说一次性修掉 ~80% 数据完整性面。
- engine:promoteBranch 时重新 bootstrap 缺失 CharacterState + `pruneBranches()` 驱逐不可达分支(防 1000-tick ~3000 次深克隆)。

### 3.3 canon / 检索 / 上下文 (DR)
- canon:纯 JSON → 显式 KG(LangGraph state 或 NetworkX 起步,**不必上 GraphRAG**)。SCORE 实证 +23.6% 连贯/-41.8% 幻觉。
- 检索:CJK 从第一天按 code-point 设计(`for...of`,覆盖 Ext A-G + 标点/假名),别再踩 unicode61 不分中文的坑。
- 上下文:全 stage 塞入 → cell/storylet **关键词触发限域注入**(SNAP + Lorebook),只注需要的 lore。

### 3.4 章节 pipeline + anti-slop (DR)
- 保留 6 段,blueprint 升级为**可控两阶段大纲**(DOC +22.5% 连贯)+ **伏笔 first-class 实体**(AI_NovelGenerator)。
- anti-slop:英文 → **中文专属 sanitizer**(去"犹如/仿佛/四字堆砌/比喻+数字堆砌")+ 双轨 eval(**WebNovelBench 4000 中文网文 + MingLi 人格**);一致性检查优先中段/高熵区(ConStory-Bench)。

### 3.5 排盘后端 (DR)
- 自写 → deterministic 库 + **FANzR 三层**(Python 确定性计算 / 规则约束 / prompt 工程,"别让 LLM 算数")。
- 显式锁派别:八字=**子平派**、奇门=**时家·转盘·拆补法**(开源生态 qfdk/dxbuyi 对齐;转盘自承 ~60% 精度,生态优先);真太阳时/晚子时做成显式配置旋钮。
- 用 **sxtwl**(校准 BC722-1960)当 oracle 验 lunar-javascript 边界。

### 3.6 前端整体 (UX) —— 依赖顺序:路由必须先于 shell 合并
- god component → feature-folder(已部分做,直接采用);**React Router v7 + URL 编码工作区/line/stage/scene**(修 F1,头号架构项,redesign 漏列);6 工作区 → 1 shell + Codex 三投影(Strangler Fig);Zustand(UI 态)+ TanStack Query(server 态);react-hook-form + zod;CodeMirror Markdown;Tailwind(前缀 `nv-`)+ shadcn 渐进;后端 Hono 独立 `:8989` + Vite proxy;Radix/sonner toast。

### 3.7 compose 性能默认 (UX)
thinkingMode 默认 **disabled**(立刻 3–5×)+ stream:true(主观减半)+ targetLength 放宽 [2500,3500] 或降到 1 次修复 + critique 移出 compose 主路径做异步复核 + timeoutMs 降到 180000、重试 1 次。

### 3.8 要新增的机制(研究指出、旧系统没有)(DR)
- **trait-violation 原语 = 戏剧的可计算引擎**:CK3 stress(逆本性累积压力→4 级→强制 break)+ Burning Wheel BITs。映射:八字日主 + 用神/忌神 = trait,逆盘行动累积"叙事失谐"→阈值强制爆点。**这是 Director 张力预算的具体配方,不是空白。**
- **Director beats 实现**:Façade story-atom(precondition/behavior/tension-effect)+ Drama Llama **NL-storylet**(作者用自然语言定义触发,不写 DSL,契合"作者做宪法")+ RimWorld 三 storyteller 人格旋钮。
- **retroactive history**(Qud Sultan biography):事后推断动机、"历史是被复述扭曲的" → 修仙伏笔→因果的正确心智模型 + 多 POV canon。
- **procedural memory / skill-library**(Voyager):剑法/炼丹/记账作为可复用 callable(开放问题:ROI 待评,见 spec)。
- **境界状态机**:4–5 tier、绑世界观+成长线+心魔,显式建模防战力崩坏(LLM 结构性缺的领域知识)。
- **神煞/八门 → narrative-weight 映射表**:用 Cantian 神煞 KG / Qimen 八门现成词表起草(桃花→romance、羊刃/劫煞→冲突)。

---

## 4. fork / 参照候选(逐组件定,SOTA 更新)
- **tick 引擎**:参照 `a16z-infra/ai-town`(TS+Convex、内置 scheduled-job tick + 持久模拟引擎)的 ARCHITECTURE,而非纯自写。`(DR)`
- **drama manager**:Open-Theatre(2509.16713)+ 新的 Plug-and-Play Dramaturge(2510.05188)/ IBSEN(Director Agent)/ HoLLMwood(Writer-Editor)做实现参照。`(SOTA)`
- **章节生成**:StoryWriter(event-graph 大纲)/ StoryBox(5 层 top-down + bottom-up)可复现借鉴。`(DR)(SOTA)`
- **竞品研究对象**:InkOS(10-agent 自主写小说,持久状态)——study 它怎么解决"30 章失忆",但它无世界/无八字。`(SOTA)`
- **编排**:LangGraph(graph state + Postgres checkpoint)是 2026 横评赢家,生产用 PostgresSaver。`(DR)`
- **orchestration 资源**:VoltAgent/awesome-ai-agent-papers(2026 agent 论文 memory/eval/workflow 合集)。`(SOTA)`

---

## 5. 留给用户拍板的产品决策(详见 spec-v0 §待定)
1. daemon 自走 vs on-demand(研究偏 daemon + 必须加导演层)
2. drama:DF 式纯涌现 vs RimWorld 式导演 curated(蓝图偏后者)
3. 奇门:转盘生态对齐(~60%)vs 飞盘精度(~85% 无库)
4. 境界状态机的形态
5. 合规定位落在晋江几级辅助 + provenance 怎么内建
6. 角色 procedural-memory(技能库)做不做、到什么粒度
7. fork 边界:哪些组件 fork(ai-town/StoryWriter/Open-Theatre)、哪些 bespoke
