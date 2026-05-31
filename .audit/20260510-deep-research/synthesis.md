# Synthesis · "世界推演类小说系统是否成熟？"

**Date**: 2026-05-10
**Sources**: 209 cards across 5 research threads (agent novel writing / world simulation / generative agents / bazi-qimen / Chinese AI novel ecosystem)
**Audience**: 你（项目作者）+ 未来的 Claude session

---

## TL;DR — 一句话回答

**作为产品/库 — 不成熟。作为零部件 — 全部 SOTA。你这个交集（常驻 agent + 八字奇门 first-class + 修仙长篇）2026 年是真空地带，且至少有一篇 2025 arXiv 的实证（BaZi-LLM benchmark, +30-60% 角色推理准确率）证明你押的方向是对的。**

---

## Field maturity, broken down

| 子领域 | 成熟度 | 你能直接用吗 |
|---|---|---|
| **多 agent 城镇模拟** (Park 2023, Project Sid 1000+ agents, AgentSociety 10k+) | 🟢 论文级 SOTA → 工业可用 | 是，开源 scaffold 现成 |
| **长上下文 LLM 写作** (Claude/Gemini/DeepSeek 1M+ 上下文) | 🟢 商用 | 是 |
| **AI 小说商用产品** (Sudowrite/Novelcrafter/番茄/作家助手) | 🟡 一键章节级别 | **否**，全是 on-demand，没有"持续运行" |
| **多 agent novel writing 学术** (Dramatron, RecurrentGPT, DOC, StoryBox AAAI 2026) | 🟢 论文 | 是 fork |
| **世界模拟器 for 小说** (区别于游戏) | 🔴 真空 | 没有现成的 |
| **八字奇门 in computational fiction** | 🔴 真空 | 没有 |
| **八字 as LLM prior** | 🟢 1 篇关键论文 (arxiv 2510.23337) | 有 benchmark 可学 |
| **修仙长篇 AI** | 🔴 中文圈是空白；蛙蛙写作 ~20 章就破 | 否 |

⚠ **关键发现**：上面 7 个子领域**单独**都有人做，但**全部交集**没人做过。这就是你的护城河。

---

## 决定性的引用（5 张卡 → 5 个判断）

### 1. **arxiv 2510.23337 ·《BaZi-Based Character Simulation Benchmark》**
- MirrorAI-Lab 2025-10
- 488 题人格基准，hybrid bazi-rule + LLM 击败 DeepSeek-v3 30.3 %、GPT-5-mini 62.6 %
- **Ablation**: 把生日打乱，准确率掉 20-45 %
- **判断**：**八字不是装饰，确实带信息**。这是你做这件事的科学背书。

### 2. **Park et al. 2023 · Generative Agents (Smallville)**
- 25 agents × 2 sim-day 是论文级 cap
- 2024 follow-up: 1000 personas via interview-grounded 86 % human test-retest
- 深度比数量重要
- **判断**：你的"主角接触图谱内的所有人"动态扩张是对的方向，但要 lazy-instantiate（接触多的角色全 cognition，远的角色压缩）

### 3. **Project Sid (Altera AI 2024-2025) · PIANO 架构**
- 1000+ Minecraft agents 涌现宗教/职业/宪法
- **判断**：scale 上限不是技术问题，是钱的问题（Haiku 4.5 + Batch API：100 角色 × 365 天 ≈ $130-365）

### 4. **Open-Theatre / Drama Llama · drama manager 模式**
- 在 agent 模拟之上盖一层"导演"
- 知道节奏、紧张度预算、何时暂停作者
- **判断**：你的 PersistentRuntimeDaemon 现在缺这个"导演"层。CanonGate 是雏形但还很弱。

### 5. **lingfengQAQ/webnovel-writer (GitHub)**
- Claude Code + 文件状态 + 三层 memory，**设计目标 200 万字**
- 是中文圈最接近"resident agent + 长篇"的开源实现
- **判断**：可以 fork 当 starter，再加你的八字奇门 + 修仙 verifier。

---

## 你的项目现在的真实位置

把你现有的 `src/` 代码与研究里发现的"理想架构"对照：

| 理想架构 (源) | 你现在有什么 | 差距 |
|---|---|---|
| **3 层时间栈** (Dwarf Fortress) world-gen → tick → render | engine.runStage 是 tick；render 隐含 | 没有显式 world-gen 阶段；缺 retroactive history |
| **drama manager** (RimWorld + Open-Theatre) | CanonGate 雏形（reject/archive/ask-author） | 没有"节奏曲线"知识；不会主动暂停说"该高潮了" |
| **memory stream + reflection + planning per agent** (Park) | StoryMemoryStore facts/expressions + 锚点 | 角色没有自己的 memory stream，全靠 lens 读 |
| **trait-stress as drama primitive** (CK3 + BW) | character anchors + 八字+奇门评分 | 没有"压迫角色违背本性 = 戏剧"的明确机制 |
| **symbolic prior shapes probability** (Mythic + BaZi-LLM) | metaphysics 模块已实现 | **唯一已在 SOTA 边沿的部分** ✓ |
| **explicit state DB + consistency gate** (SCORE) | ParsedWorldDraft + branch consistency | 没有可查询的 KG，全是结构化 JSON |
| **多层 memory** (Mem0 / A-Mem) | Memory store 是单层 | 没有 vector + graph 混合 |
| **grounded reflection** (CRITIC) | critique 阶段是 single-pass review | 不是基于工具/检索的 grounded |
| **dynamic character expansion** | 必须 markdown 预定义 | **完全空白** ❌ |
| **resident-agent UX** | 当前 frontend 偏"按钮即时" | 完全空白 ❌ |

**判断**：你的 `src/` 比你想的近——大概 **40 %** 的目标架构骨头已经在里面，主要是 metaphysics 和 canon-gate。**真正要补的不是引擎，而是上面那一层"导演"和"动态角色"，加上下面那一层"agent 自己的记忆"**。

---

## 推荐架构（v2 蓝图，每个组件都有源溯）

```
┌──────────────────────────────────────────────────────────────────┐
│  Director Layer · 编剧型导演 (Open-Theatre + RimWorld storyteller) │
│  · 知道当前节奏曲线                                                  │
│  · 决定下一阶段焦点 / 张力预算 / 何时高潮                            │
│  · CanonGate 升级：不只"过/不过"，而是"现在该有什么戏"               │
└──────────────────────────────────────────────────────────────────┘
                              ↑
                              │ tick events
                              │
┌──────────────────────────────────────────────────────────────────┐
│  World Simulator (你已有 70 %)                                    │
│  · WorldHistoryEngine                                            │
│  · 八字 + 奇门 = 概率塑形器 (BaZi-LLM, Mythic Fate Chart)         │
│  · Branch evaluation 三投影 (canon/surge/cautious/rupture)        │
│  · CharacterAnchor + RelationshipAnchor as 戏剧 primitive         │
│    (CK3 stress + Burning Wheel BITs)                             │
└──────────────────────────────────────────────────────────────────┘
                              ↑
                              │ contact-graph activation
                              │
┌──────────────────────────────────────────────────────────────────┐
│  Per-Character Agent Layer (Generative Agents · Park 2023)        │
│  · Memory stream (recency × importance × relevance)              │
│  · Reflection (CRITIC, NOT Reflexion — grounded only)            │
│  · Planning (hierarchical)                                        │
│  · Lazy instantiation:                                            │
│    - 主角及一度接触: full cognition                                │
│    - 二度接触: compressed bio + one-shot persona                  │
│    - 远人: 仅在 world-gen 中的"传记条目"                            │
│  · 动态生成: 主角接触新 NPC → LLM propose 八字 + 性格 + 关系       │
└──────────────────────────────────────────────────────────────────┘
                              ↑
                              │ memory writes / reads
                              │
┌──────────────────────────────────────────────────────────────────┐
│  Persistent State (Mem0 hybrid · vector + graph + KV)            │
│  · facts / expressions / foreshadows / revisions (你已有)          │
│  · 加: character-state graph, relationship graph                  │
│  · 加: KG 节点 + 边 (SCORE 模式) 替代纯 JSON                       │
│  · D1 / Postgres / SQLite — pick one                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                   ┌──────────────────────────┐
                   │  Writer Layer (你已有 6 段) │
                   │  blueprint → scene-expand  │
                   │  → synthesize → critic     │
                   │  → memory-write            │
                   │  · 加: anti-slop sanitizer │
                   │  · 加: 修仙体 verifier     │
                   │    (境界 / 五行 / 法宝)    │
                   └──────────────────────────┘
                              ↓
              Continuous chapter stream (作者审阅 → 接受 / 改 / 拒)
```

---

## 推荐技术栈（每项都有 source 卡）

| 层 | 技术 | 来源 |
|---|---|---|
| **Backbone** | TypeScript + Node + Vite (你现状) | — |
| **Persistent state** | SQLite (本地) → 后续 D1/Postgres | Mem0 best practice |
| **Agent memory** | **Mem0** (`mem0ai/mem0`)，hybrid vector+graph+KV | Mem0 production · +26% acc · -90% token |
| **Agent runtime** | LangGraph PostgresSaver tick durability | LangGraph 2026 patterns |
| **Bazi 排盘** | `lunar-javascript` (6tail, MIT) — 子平派 + 真太阳时 + 23:00 cutoff | de-facto Chinese 排盘 |
| **Qimen 排盘** | thin layer over `lunar-javascript`, 借鉴 `qfdk/qimen` (转盘法 拆补法) | 时家奇门 转盘 |
| **Bazi/Qimen MCP** | 仿 `cantian-ai/bazi-mcp` 的接口形态 | LLM-only-interpret，不算 |
| **Director / drama mgr** | 仿 Open-Theatre Director-GlobalActor-Actor | drama-llama-2024, open-theatre-2024 |
| **Reflection** | **CRITIC** (grounded), 别用 Reflexion | QSAF 28% latent-plan-decay 实证 |
| **Tick driver** | Claude Haiku 4.5 + Batch API (省钱) | $0.50/$2.50 batch · 100 角色 365 天 ≈ $65-185 |
| **Week consolidation** | Claude Sonnet 4.6 / Opus | 高质量 reflection / 章节 review |
| **Eval** | Fork `MingLi-Bench` + WebNovelBench (8-dim, arXiv 2505.14818) | 人格 + 文学双轨 |
| **Anti-slop** | AutoNovel 的 LLM Judge + sanitizer | English; port to Chinese |
| **Frontend** | 保留刚搭的 web/ (React Router + Tailwind + shadcn) | — |
| **Continuous runner** | Hermes VPS 跑 daemon (你已有 VPS) | 本地开发 + VPS 24/7 跑 ticks |

---

## 是 fork 还是从头？回答：**fork + bespoke layer**

### 不是从头：
- `lunar-javascript` 排盘不要自己写（错一个时柱整个系统就废）
- `Mem0` 不要自己写 memory（vector + graph 混合调通要 6 个月）
- Generative Agents memory stream 不要重写（Park 已经把所有坑踩过）
- LangGraph tick durability 不要重写

### 是从头：
- **Director layer**（场景特化：修仙长篇节奏曲线，没有现成）
- **Bazi/Qimen → narrative-weight 映射表**（学术上有 BaZi-LLM benchmark 但 mapping 是开放的）
- **修仙体 verifier**（境界跳级、五行、法宝功率预算 — 没有现成）
- **Anti-slop 中文 sanitizer**（"犹如"/"仿佛"/堆砌四字 — 中文特有）
- **作者交互：lens / 锚点 / 扶正 UX**（你这种"作者做宪法不写文本"的协作模式没人做过）

---

## 路径建议（4 周到第一个 vertical 版）

### Week 1 — 基础设施
- [ ] 锁定 bazi/qimen backend：装 `lunar-javascript`，把现有 `src/metaphysics/` 替换成它的 wrapper（避免边界 bug）
- [ ] 装 Mem0 + SQLite，把 `StoryMemoryStore` 重新映射到 Mem0 的 hybrid 索引
- [ ] 把 `PersistentRuntimeDaemon` 包到 LangGraph，tick durability + checkpoint resume

### Week 2 — Director + 动态角色
- [ ] 加 Director layer：节奏曲线 (开端/上升/高潮/下降/结尾) + 张力预算 + 焦点选择策略
- [ ] 实现"主角接触新人 → LLM propose 八字 + 性格" 的动态扩张（lazy instantiation）
- [ ] CanonGate 升级：不只 reject/archive，要会说"该上升了 / 该爆发了"

### Week 3 — Per-character agent
- [ ] Park-style memory stream per active character
- [ ] CRITIC-style grounded reflection (只对当前 stage 已发生事件做反思，不臆测)
- [ ] hierarchical planning: 角色 stage 目标 → 当 tick 行动

### Week 4 — Continuous runner + UI
- [ ] Hermes VPS 跑 daemon，每天定时 N 个 ticks
- [ ] Frontend 改成 "feed" 风格：作者打开看到 agent 这一天产出了什么 + 待审章节 + 待决策的 ask-author
- [ ] anti-slop sanitizer + 修仙体 verifier 接入 critique 阶段

---

## 关于 MiroFish (github.com/666ghj/MiroFish)

用户 2026-05-10 提到这个项目。事实核查后：

**真相**：59.8k 星、AGPL-3.0、Flask + Vue + Python，**真核心是 OASIS（CAMEL-AI 的多 agent 社交模拟框架）的包装层**。MiroFish 自己写的部分是：种子文本 → 实体图 (`graph_builder.py`/`ontology_generator.py`) + persona 自动生成 (`oasis_profile_generator.py`, 50KB) + simulation runner 包装 (`simulation_runner.py`, 69KB) + report agent (`report_agent.py`, 99KB) + Zep Cloud memory 接入。主战场是**金融预测 / 舆情 / 政策推演**，红楼梦续写是 demo 不是产品方向。

**结论**：不 fork（栈不匹配 + AGPL + OASIS 内核为社交媒体涌现型而非长篇小说节奏 + 单文件 99KB 反模式 + 60k 星是商业资源不必然反映代码质量）。

**偷 3 件事**：
1. `ontology_generator.py` 的"文本→实体+关系"思路 — 用作"主角接触新人 → 自动 propose 角色 slot"的 reference implementation
2. GraphRAG-as-canon-state 验证了 SCORE 模式（但你不必上 GraphRAG，LangGraph state 或 NetworkX 够用）
3. `oasis_profile_generator.py` 的 prompt 结构 — 用作"propose 八字 + 性格" 的 prompt 模板

**对 synthesis 主结论的影响**：MiroFish 反而**强化**了"你的交集是空白"的判断 — 一个 60k 星的 prediction-engine 项目都不做 fiction-as-first-class，确认了 fiction-with-metaphysics-as-prior 在 2026 年仍是真空。

## 关于"是不是干脆 fork lingfengQAQ/webnovel-writer"

我倾向 **不 fork**，原因：
1. 你已经有 70 % 的引擎（src/）写得不算糟，扔了可惜
2. 它没有八字奇门，加层很快不如自己做
3. 它是 Claude Code on files 模式，状态在文件系统；你已经走 TS engine + frontend 路径，迁移成本反而高

但 **它的几个具体设计可以偷**：
- 三层 memory 的命名 / 分割
- 200 万字工程化纪律（编辑器红线 / 章节配额 / 异常熔断）
- AGENTS.md 风格的"agent 操作手册"

参见 `research_chinese_ai_novel.md` 的 `lingfengqaq-webnovel-writer-2024` 卡。

---

## 风险 / 诚实标记

1. **八字非可证伪** — 它作为"narrative consistency tool"是有效的，作为"divination service"不是。UI 必须明确这一点。
2. **奇门多派分歧** — 锁定 时家奇门 转盘法 拆补法，写在 README，避免折中。
3. **agent town 在 ~3-6 sim-month 后会漂移** — 必须定期 author-pause-and-correct，不能完全 hands-off。QSAF 的 28 % latent-plan-decay 是硬限制。
4. **修仙长篇 AI 的体感问题** — DeepSeek 等 LLM 在中文修仙体上有"套话疲劳"。AutoNovel 的 anti-slop 是英文的，中文版要自己训。
5. **成本不是无限** — 即使 Haiku 4.5，连续跑 100 角色 / 一年 ≈ $130-365。先从 10-15 角色 / 一个月开始。

---

## 文件清单（这次 deep research 落盘）

```
.audit/20260510-deep-research/
├── research_agent_novel_writing.md          (3,609 字 + 50 sources)
├── research_world_simulation.md             (3,533 字 + 61 sources)
├── research_generative_agents.md            (3,229 字 + 37 sources)
├── research_bazi_qimen_computational.md     (2,000 字 + 30 sources)
├── research_chinese_ai_novel.md             (2,344 字 + 31 sources)
├── source_cards_*.json × 5                  (209 cards total, merged)
├── source_cards.json                        (合并后总目录)
└── synthesis.md                             (this file)
```

总研究字数 ≈ 14,700。Source cards 209 张，超过系统级变更 100+ 阈值。
