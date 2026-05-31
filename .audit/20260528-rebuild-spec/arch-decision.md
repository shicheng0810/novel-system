# 架构选型决策 · Phase 2

**生成** 2026-05-29 · 输入:3 个并行架构候选 agent(全部实读 v3 源码)
**候选全文** 在 agent 日志:A=事件溯源 `a08ce40b...` · B=actor 运行时 `aae3d1e2...`(自标"C",按内容是 B)· C=v3 演进 `aa98de0c...`

---

## ⚖️ 最终选定(2026-05-29 用户决策):**B · Actor / 监督运行时**
用户 override 了"推荐 C"的建议,选 **B(涌现优先)**。理由:把长期愿景(涌现式常驻世界、未来千角色 scale)置于"到第一部速度"之上 —— B 最忠实于核心命题"世界一直跑、章节是副产品"。
- **接受的权衡**:前期 actor 骨架更重、全局 canon 一致性靠单写者纪律守、到第一部更慢、"compose 是 phase vs 异步 operation"需明确裁定。
- **B 仍达成"完整一部"成功标准**:其里程碑 M2 出章、M4 出完整一部 arc。
- **嫁接进 B 的安全网(取自 A/C)**:① [C] 静态守卫测试(engine/domain 禁 `bazi/境界` 字面量,机器强制 §2.7);② [C/B] v3 的 `metaphysics/{bazi,qimen,bagua,prior}` 纯函数零改迁进 pack;③ [A] 每个状态变化 = 同事务一条事件(B 已是单写者同事务,强化之);④ `PriorFrame` opaque 命名去耦(B 可批判点 C)。
- 详细施工见 `arch-B-build-plan.md`。下方评分/速写保留作历史记录。

---

## 候选速写

### A · 事件溯源 / CQRS 纯粹派
WorldEvent 日志是**字面唯一真相**;所有状态(snapshot/角色/canon/章节/director)= 从日志 fold 出的只读投影。tick = command → emit events → projector fold;写读分离(CQRS)。
- **强**:支柱 #1/#4 推到极致;作者裁决/记忆一致性成为"架构上不可能出错的类别"而非要修的 bug;时间旅行/重放免费;新投影零成本(加 KG/换 anti-slop 包 = 重 fold)。
- **弱**:投影脚手架重;事件 schema 演进需 upcaster;**到第一章最慢**(最多 plumbing)。

### B · Actor / 监督运行时(ai-town 系)
每角色 = 被监督 actor(perceive→reflect→plan→act);World/Director/Metaphysics = supervisor;scheduler 把 tick 驱动成单线程消息轮次(抄 ai-town step/input-queue/generation 号)。作者裁决 = 一条 input;compose = 异步 startOperation(不阻塞)。
- **强**:**最贴合核心命题**(世界一直跑/角色是 Park agent);直接对齐 ai-town(Q7);lazy-instantiate 原生;Director-as-supervisor 注入 beat 走同一 gate;未来 scale→PIANO。
- **弱**:全局 canon 一致性靠纪律非结构保证;"compose 是 phase vs 异步 operation"与 §2.2 字面有张力;多 actor checkpoint 是旧 bug 的类别;前期 actor 骨架重。

### C · 分层流水线 / v3 演进
保留 v3 的 7 层 + 确定性单 tick + 24 个绿测试;外科手术修四个洞(裁决断链/checkpoint/记忆并发/canon→KG)+ 加 trait-violation 张力 + director beats + 把"引擎↔包分离"做成 domain 层 `WorldPack` 抽象(编译期注入)。
- **强**:**最低风险、最快到完整一部**;三大抽象已落地;耦合面实测**仅 ~4 行 + 3 个类型字段**(浅,可静态测试守住);复用 v3 大量纯函数 + 测试当回归网。
- **弱**:继承 v3 概念天花板(候选生成弱:两 agent→2 candidate、branches 取 top 不抽样 → 涌现空间窄);拆 pack 拆不净则继承 genre 天花板。

---

## 评分(按用户优先级加权)
权重:**最快到完整一部 ×3**、**风险/可行性 ×3**、满足 7 支柱 ×2、修头号 REDO ×2、引擎↔包分离 ×2、可演进/涌现 ×1

| 维度(权重) | A 事件溯源 | B Actor | C v3 演进 |
|---|---|---|---|
| 最快到完整一部 (×3) | 2 | 2.5 | **5** |
| 风险/可行性 (×3) | 2.5 | 2.5 | **4.5** |
| 满足 7 支柱 (×2) | **5** | 4 | 4 |
| 修头号 REDO (×2) | **5** | 4.5 | 4 |
| 引擎↔包分离 (×2) | 4.5 | 4.5 | 4 |
| 可演进/涌现 (×1) | 4 | **5** | 3 |
| **加权总分** | 36.5 | 37 | **45.5** |

C 在两个高权重项(速度/风险)上压倒性领先;A/B 在完整性/涌现(低权重)领先。

---

## 决策:**C 为骨架 + 嫁接 A/B 精华**(待用户确认)

**理由**:用户近期成功标准 = 写完整一部小说 + 系统先好用 → 速度与风险是高权重项,C 决定性胜出;且 v3 三大抽象已被研究背书、已落地、有绿测试。C 的唯一硬伤(涌现天花板)用 A/B 精华 + 一条机制升级补:

**嫁接清单**:
1. **[B] compose = 异步 startOperation**(不在 tick 主路径同步跑)→ 最干净地修"UI 卡死"(优于 C 原案的 inline compose)。
2. **[B] 单写者纪律**:所有 world-table 写只经一个 writer + emit 与 commit 同事务 → 整类消除半提交/并发腐败(比 C 原案"加 mutex"更彻底)。
3. **[A/B] 作者裁决做成 first-class command/input + 事件**(`BranchPromoted`),而非仅 `resume(choice)` → "作者点了有用"成为结构属性、且可重放。
4. **[C 自带杀招] 静态守卫测试**:`architecture.test.ts` 扩一条 —— engine/domain/agents/daemon 禁止出现 `qimen/bazi/cultivation/境界` 字面量 → 机器强制 §2.7 拆干净,直接灭掉 C 的最大风险。
5. **[机制升级] branches 改 weighted-sample + trait-violation 驱动候选多样化** → 针对性抬高 C 的涌现天花板(C 相对 A/B 唯一结构性短板的补丁)。

**关键**:C 的 `WorldPack` + WorldEvent-唯一真相 + 单 tick 抽象,与"日后迁移到 actor/事件溯源"**不冲突** —— 若涌现深度日后成为瓶颈,可在引擎内部增量重构而不推翻 spec。**C 是低风险起点,不是死路。**

---

## 战略风险(需用户知情)
C **不会**给出 B(actor/ai-town)那种自发涌现的复杂社会动力学。若长期愿景是"千角色涌现文明产出小说",B 是更好地基,但到第一部小说更慢、风险更高。鉴于你明确"先好用 + 写完整一部",C 是对的,且不 foreclose 日后转 B。

---

## Phase 3 入口(架构选定后)
按 C+嫁接落成施工 plan(分模块 + Runbook footer),里程碑依赖序:
**M0** 拆 pack(+静态守卫测试,24 测试保持绿)→ **M1** 裁决闭环 → **M2** 记忆并发+checkpoint → **M3** canon→KG → **M4** 前端路由化 → **M5** trait/beats/进阶机 → **M6** 跑完整一部(头号验收)→ **M7** 非修仙包冒烟(验证分离)。
走 `/ecc:long-task` ingest + 验证循环(hermes 修好后可远程执行)。
