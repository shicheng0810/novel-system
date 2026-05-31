# Novel System 清白重写 · Spec v0.1 (产品决策已拍板)

**生成** 2026-05-28 · **修订** 2026-05-29(用户拍板 7 决策 + 2 处修订)· 配套分析见 `keep-kill-redo.md`
**状态** 产品决策已锁(§6)。进 Phase 2 架构设计。

---

## 1. 核心命题(锁定)
一个**常驻的、genre-可插拔的中文小说世界模拟器**:世界一直在跑,角色是 Park 式生成式 agent,**可插拔的"符号先验系统"**(八字/奇门是第一个 prior pack)投射进每个 tick 的分支打分,**章节是世界模拟的副产品**(不是 on-demand 续写)。作者是"立宪者 + 裁决者",不是逐句写手。

> **🔧 修订(2026-05-29):引擎不绑定修仙。** 修仙世界 + 八字奇门 = **旗舰内容包(flagship pack)**,不是唯一硬绑定形态。引擎(世界模拟 + agents + prior 打分 + 导演 + 章节流水线)与内容包(genre 设定 / 先验系统 / 进阶体系 / 词库)**分离**。MVP 先用修仙包跑通,但引擎层不得硬编码修仙/八字。
> 护城河:旗舰包(常驻 agent + 八字 first-class + 修仙长篇)2026 仍是真空、八字-prior 无新竞品;引擎可换包是额外可演进性红利。

## 2. 设计支柱(从 KEEP 提炼,任何架构方案不得违背)
1. **WorldEvent = 唯一真相**:凡作者可感知的状态变化必 emit 一条事件(emit 覆盖率=验收项);severity 三层决定是否打断;前端从单 SSE 流派生所有视图。
2. **单 tick 循环**:frame→agents→branches→gate→commit→maybe(compose);compose 是 phase 不是独立 pipeline。
3. **Metaphysics-as-prior**:`scoreCandidate(candidate, frame) → 0..1 + 可解释 breakdown`;排盘 deterministic(LLM 不算数),LLM 只解释。
4. **数据完整性优先**:单 SQLite 真相源;所有持久化原子写;索引可重建且最终一致;并发写有 mutex/队列。
5. **作者裁决闭环**:decision-required 事件 → 作者 accept/reject/revise → 真正 promote/archive 分支(旧系统这条断了,头号 REDO)。
6. **不难用**:URL 可恢复上下文、长流程进度可见、破坏性操作可撤销、领域黑话有人话、compose 不阻塞 UI。
7. **🔧 引擎 ↔ 内容包分离(新增,2026-05-29)**:persistent world-sim + agents + prior-scoring 接口 + drama-manager + chapter-pipeline = **genre-agnostic 引擎**;修仙世界设定 / 八字奇门 prior / 境界进阶 / 修仙词库 = **可替换 content pack**。架构层不得把修仙/八字硬编码进引擎;prior 系统、进阶体系、anti-slop 词库都走 pack 接口。

## 3. 硬约束(research / 性能 / 数据,违反即失败)
- **anti power-creep**:显式**进阶/力量体系状态机**(修仙包配置为"境界"),防"~20 章战力崩坏/人设偏移"。
- **grounding**:reflection/低语/canon 解释只能陈述已存在 structured state + 带 refs,**不得生成新 canon**;无 grounding 自评禁用。
- **不裸长跑**:daemon 必须有 plan-decay/漂移 watchdog + 定期 author-pause + 明确 stop condition(28% plan-decay 警告)。
- **检索**:CJK 按 code-point 设计;长篇连续性用图结构(KG),不靠纯长上下文/纯 vector。
- **性能**:compose 默认 thinkingMode=disabled + 流式 + critique 异步;单章主路径目标 < ~60s 出首字,UI 永不阻塞。
- **成本**:batch Haiku $0.50/$2.50 做底,MVP 10–15 角色 × 1 个月预算可控。
- **质量(原合规条降级而来)**:anti-slop 默认开,但理由是**质量**(去 AI-tell:辞藻华丽/硬转场/POV 不稳/比喻+数字堆砌),不是合规。

## 4. 近期成功标准 + 非目标
- **🎯 近期成功 = 能写出完整的一部小说**(至少一部、首尾完整、连贯不崩)。系统先好用,约束后加。
- **🔧 合规暂缓(2026-05-29)**:用户仅个人自用、不在国内平台发表(海外 only、系统好用后再加约束)→ 晋江 3 级 / 国家标识办法**当前不是硬约束**;provenance/AI 标识做成**可选、留接口**,后期开。
- **非目标(防 scope creep)**:MVP 用修仙包先跑通一部完整小说,**引擎不硬绑修仙**但也不追"同时支持多 genre 成熟内容包"(先一个包跑通);不做多人协作平台;不做面向读者的互动阅读器(先服务作者);MVP 不追 1000 角色 scale(先深度后规模,lazy-instantiate);不 fork MiroFish;不过度脚本化。

## 5. 验收项("不再难用 + 能写完一部"的可观测合同)
> 完整 30+ 条见 `keep-kill-redo.md` / UX digest。核心必过:
- [ ] **能产出一部首尾完整、连贯的小说**(近期头号验收)。
- [ ] 刷新/后退/分享链接后落在同一视图,不丢上下文(F1)。
- [ ] daemon 运行时,写作区能从常驻 UI 看到"第 N/M 推演"进度,无需切区(F2)。
- [ ] decision-required 渲染为可操作 CouncilCard;[依准]/[另议] 立即生效且**真正影响正史**(P3 + §2.5)。
- [ ] "应用世界草案"可撤销(快照 + Revert 或提交前 diff)(F4);错误持久 toast 不静默消失(F3)。
- [ ] SettingsModal 提交前客户端校验;长列表虚拟化/分页 + 实时搜索;领域黑话有 tooltip(P6/F7/F8)。
- [ ] 单章 compose 不阻塞 UI、有分步进度、可重试(F10/性能)。
- [ ] **换一个(非修仙)内容包能起一个最小世界**(验证引擎/包分离,§2.7)——MVP 可只做冒烟级。
- [ ] 护栏不回归:一键生成章节、邻接 critic、Vitest 全绿、TS strict、API 契约不破。

## 6. 产品决策(已拍板 2026-05-29:按推荐 + 2 修订)
| # | 决策 | 拍板 |
|---|---|---|
| Q1 | daemon vs on-demand | ✅ **daemon 自走 + 强制导演层 + 漂移 watchdog** |
| Q2 | drama 涌现 vs 导演 | ✅ **导演 curated 为主**(RimWorld>DF),底层涌现为料 |
| Q3 | 奇门 转盘 vs 飞盘 | ✅ **时家·转盘·拆补法**(生态全;精度做成可换) |
| Q4 | 进阶状态机 | ✅ **泛化为"进阶/力量体系状态机"**,修仙包配置为境界(4–5 tier + 心魔/瓶颈) |
| Q5 | 合规 | ✅ **暂缓**(个人自用/海外;系统好用后加;anti-slop 保留=质量理由) |
| Q6 | 角色技能库(procedural memory) | ✅ **MVP 先不做,留接口** |
| Q7 | fork 边界 | ✅ tick 参照 **ai-town**、drama 参照 **Open-Theatre/Dramaturge**、其余 bespoke |
| 修订① | genre 绑定 | ✅ **引擎不绑修仙、genre 可插拔**(§1 + 支柱 §2.7) |
| 修订② | 成功标准 | ✅ **近期 = 写完整一部小说;约束后加** |

## 7. SOTA 增量结论(2026-05)
核心赌注未动摇:无人做出该交集,八字-prior 无新竞品/未证伪。新增可借鉴:Plug-and-Play Dramaturge / IBSEN / HoLLMwood(drama 实现)、AgentSociety 2(常驻 agent 平台)、InkOS(自主写小说竞品,study 其"30 章失忆"解法)。详见 `keep-kill-redo.md` §4。

## 8. 下一步(Phase 2,进行中)
派 3 个架构候选(事件溯源/CQRS · actor 运行时(ai-town 系) · v3 分层演进)→ 对照 §2 支柱 + §3 约束 + §5 验收项 + §2.7 引擎/包分离 + "最快到完整一部小说"打分 → 选型 → 落成带 Runbook 的施工 plan → Phase 3 `/ecc:long-task` + 验证循环。
