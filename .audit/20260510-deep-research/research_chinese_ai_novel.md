# Chinese AI Novel-Writing Ecosystem (2024–2026)

**Scope:** Survey of what Chinese-language web-novel authors actually use in 2026 — platforms, standalone tools, OSS, community sentiment, and the specific gap for xianxia/cultivation longform with metaphysical (八字奇门) grounding.

**Audience:** Author working on a personalized AI co-writing system for cultivation fiction.

**Retrieved:** 2026-05-10. All claims source-cited in `source_cards_chinese_ai_novel.json` (≈30 cards).

---

## 1. Platform-Native Tooling — the dominant deployment surface

### 1.1 起点中文网 / 阅文集团 — `作家助手` + `阅文妙笔`

The dominant CN web-novel publisher (Yuewen Group, parent of Qidian, QQ Reading, Chuangshi) ships the most mature platform-native AI tooling:

- **阅文妙笔 (Miaobi)** — a domain-tuned LLM trained on 20+ years of Yuewen's web-novel corpus. Released July 2023 as the *first* CN web-novel-vertical model. Built into the **作家助手** (Author Assistant) desktop+mobile app.
- **DeepSeek-R1 integration** — Feb 2025, Yuewen layered an independently-deployed DeepSeek-R1 over Miaobi for 智能问答 / 灵感获取 / 描写润色.
- **Four flagship modules:** 世界观设定, 角色设定, 情景描写, 打斗描写. Per Yuewen, called 数十万次/周.
- **Distribution leverage:** 一键发布 to Qidian/QQReading/Chuangshi; offline drafting; cross-device sync.

Yuewen CEO 侯晓楠's stated framing: *"AIGC 不会取代作家，它是创作的金手指，而主角永远是作家"* — AI as 'golden finger' assistant, not generator. This is the official ceiling.

### 1.2 番茄小说 (Fanqie) — ByteDance's free-reader AI generator

Different posture. Built on ByteDance's **豆包 (Doubao)** model. Seven generation features: AI 扩写, AI 改写, 自定义描写, AI 续写, AI 起名, 卡文锦囊, AI 助手. The platform's emphasis is throughput, not craft.

**The 5,000-debuts-per-day phenomenon** (March 2025): Within weeks of DeepSeek's January 2025 release, daily debut titles on Fanqie went from ~400 → **5,606** (1302% YoY). Driven entirely by AI-generated low-quality submissions. Platform reaction April 2025: stricter 签约 review, blacklist for repeat low-quality submitters. Sept 2025: an "AI 使用" self-declaration checkbox per the Cyberspace Administration's 《人工智能生成合成内容标识办法》(effective 2025-09-01).

Fanqie also notoriously triggered the **2024 author backlash** by inserting an AI-training data clause into its standard 签约协议. Authors organized a public refusal campaign. This is the flashpoint event of the CN AI-novel debate.

### 1.3 七猫 (Qimao), 飞卢 (Feilu), 17K, 纵横

- **七猫** runs `AI 小助理` built on Baidu 文心一言 with 3 thin modules (码字灵感 / 故事设定 / 角色起名). General-LLM wrapper.
- **飞卢** is the speed-optimized "light novel" platform — daily 万更 minimum to chart. No proprietary AI tool surfaces, but authors use external tools heavily.
- **17K, 纵横** — neither has shipped distinguishable AI features publicly; both lean on author manual workflow.

### 1.4 晋江文学城 (Jinjiang) — the regulated outlier

First CN platform with a formal AI policy (Feb 18, 2025):
- **Allowed:** 文字型辅助 (proofreading) / 创意型辅助-要素 (inspiration shards) / 创意型辅助-粗纲 (rough outline only).
- **Forbidden:** beyond those — penalty escalates 锁章 → 黄牌一个月 → 永久禁榜.

Jinjiang president 刘旭东 publicly: *"人类作者参与这种行为是饮鸩止渴 — 迟早平台会用自己训练的 AI 虚拟作者代替人类作者."* Jinjiang's audience (女频, literary-heavy) is hostile to AI prose; this is a hard moat.

---

## 2. Standalone CN AI Novel Tools — the commercial standalone tier

| Tool | Vendor | Position | Real strength | Documented weakness |
|---|---|---|---|---|
| **蛙蛙写作 (Wawa)** | 杭州引力智航 (parent 波形智能 acquired by OPPO) | Most-reviewed CN novel AI | "黄金三章" opening, +80% conflict-construction efficiency | **20章后战力崩坏 / 人设偏移** — long-form fails after ~20 ch |
| **笔灵AI (Biling)** | private | "六边形战士" web-novel tool | 'New work' container stores outline/chapters, AI 续写 recalls full settings — partial 失忆 cure | Generic prose; not metaphysics-aware |
| **星月写作 (Xingyue)** | private | Full-pipeline (灵感→大纲→正文→润色→发布) | Claims 92% character-consistency vs Wawa 65% / GPT-4 40%; 18 sub-genre templates incl. 玄幻/仙侠; auto-extracts 高频爆点 from Qidian/Fanqie/Feilu | Pattern-mining, not domain-modeling. 30 books on new-book charts (vendor claim). |
| **码哩写作 (Mali)** | private | Process-discipline ("无 AI 痕迹") | 故事设置→要素→大纲→章纲→正文 stepwise; continuation from any chapter | Less marketing; smaller community |

The pattern: **commercial CN tools converged on outline-store + chapter-store + RAG-recall + multi-step prompts**. None reaches into domain-modeled state machines (cultivation tier progression, character 命格 evolution, 八字 grounding).

---

## 3. General LLMs Used Directly by CN Authors

Authors mix-and-match (per knowledgable Zhihu surveys 2024-2026):

- **DeepSeek-R1** — workhorse for 大纲 / 设定 / 逻辑检查 / 矛盾检测. Explicit author rule: *"不要用它来生成正文，它的梗都太老土了"* — bad for prose, dated tropes.
- **文心一言 (Wenxin)** — best classical-Chinese punctuation (100% in tests); strong on Chinese cultural references; #1 中文理解 in some evals.
- **通义千问 (Qwen)** — strong general but weaker on classical CN.
- **智谱 GLM-4 / GLM-4.5** — leading on long-text creative composition (智谱清言 ranked #1 in some long-text benchmarks).
- **Kimi (Moonshot)** — 'long-context killer'; can ingest entire outline + drafted chapters; popular for full-book context loads.
- **Claude (via API or Claude Code)** — preferred for emotional/psychological writing; '细腻情感刻画'.
- **腾讯元宝** — reportedly stable on 玄幻/仙侠.
- **豆包** — Fanqie's default; commodity quality.

The Huxiu/Tencent News Nov 2025 piece on **Claude Code for novel-writing** is the empirical centerpiece: a sub-agent dispatch system + 3-layer memory (short=current chapter / mid=auto-summary / long=outline+character+foreshadowing) successfully placed and recovered foreshadowing across **7 chapters / 21,000 字**, in ≈20 minutes. This is the strongest documented evidence of a workable long-form pipeline.

---

## 4. Open-Source CN Novel Generation — what actually exists on GitHub

| Repo | Architecture | Long-form claim | Notes |
|---|---|---|---|
| `BlinkDL/AI-Writer` | RWKV pretrained, GPT-2-class | Single-pass | Historical baseline; pre-LLM era |
| `YILING0013/AI_NovelGenerator` | Sequential pipeline + vector RAG + state tracking + foreshadowing mgmt | Multi-chapter | Most-starred; author admits low maintenance |
| `RhythmicWave/NovelForge` | Electron+FastAPI; **card-based + JSON-Schema validated** generation; optional Neo4j knowledge graph | "百万字" target | Best schema-driven design; AGPLv3+commercial |
| `lingfengQAQ/webnovel-writer` | **Built on Claude Code**; 3-layer Story System (`.story-system/` + runtime contracts + `.webnovel/` projections); MASTER_SETTING.json + index.db + summaries/ + memory_scratchpad.json + RAG-rerank; **37 genre templates** | **"200 万字 量级 连载"** | Closest architectural match to our planned approach |
| `cjyyx/AI_Gen_Novel` | Multi-agent (planning/transformation/review per RecurrentGPT); memory compression | Acknowledges current LLM insufficient for long form | Honest about limits |
| `xindoo/ai-novel-lab` | Layered macro+micro consistency; **AGENTS.md as 'AI constitution'**; multi-pass revision | **428,000+ 字 / 100 chapters delivered** (urban fantasy) | Empirical proof an OSS pipeline can ship a real long novel |
| `MaoXiaoYuZ/Long-Novel-GPT` | Parallel-thread chapter generation | Unlimited chapters | Throughput-focused |
| `ExplosiveCoderflome/AI-Novel-Writing-Assistant` | Agent + worldview + 写法引擎 + RAG + 整本生产 | Idea→full novel | Most architecturally ambitious |
| `leenbj/novel-creator-skill` | "Smart-State" file-level long-term memory | **百万字级** | Files-as-state pattern |
| `hestudy/snowflake-fiction` | Snowflake-method workflow tree | 短篇 1-3万 / 长篇 10-50万 / 巨著 100万+ | Outline discipline, no prose engine |
| `sfxyn/agent` | LLM-driven agent | 一键 10w字+ | Marketing-claim quality |
| `wfcz10086/AI-automatically-generates-novels` | Prompt-pack based | "Studio batch generation" | Volume-oriented (Fanqie-style) |
| `Deng-m1/MaliangAINovalWriter` | Editor + multi-LLM (OpenAI/Gemini/Anthropic) | Authoring platform | Tooling, not domain |

The GitHub layer mostly matches **prompt-engineering + state-as-files + vector RAG**. Three projects (`webnovel-writer`, `xindoo/ai-novel-lab`, `leenbj/novel-creator-skill`) demonstrate that long-form (100k+ to 1M 字) is achievable on Claude Code-class tooling with disciplined state management. **None encode CN metaphysics (八字 / 奇门 / 五行) as deterministic logic.**

---

## 5. The WebNovelBench academic anchor

**WebNovelBench** (arXiv 2505.14818, Lin et al. 2025) is the only rigorous CN web-novel benchmark we have:
- Dataset: 4,000+ Chinese web novels.
- Task: synopsis → story generation.
- Evaluation: LLM-as-Judge across **8 narrative dimensions** (rhetorical technique, sensory description richness, character balance, …) → PCA → percentile vs human-authored.
- Findings: clearly differentiates *human masters / popular web novels / LLM-generated*. 24 SOTA LLMs ranked.

This is the eval methodology to adopt for our own system's regression suite.

---

## 6. Author Community Sentiment (Zhihu / Douban / Tieba)

Recurring complaints from real CN authors:

1. **同质化 (homogenization)** — *"算法像病毒一样自我复制，套话基因传遍文本世界"*. AI outputs converge to recognizable templates.
2. **预制菜感 (predigested-meal feel)** — *"像预制菜，毫无人味儿"*. 62% of new web-novel openings reduce to 退婚/重生/系统 三板斧.
3. **情感细节缺失** — moving prose comes from life observation; AI lacks 灵魂 / 创意 / 情感内核.
4. **失忆 (memory loss)** — example cited: *"第三章主角持赤焰剑，第五章莫名变成寒霜刃"*. 角色名/地名 frequent typos.
5. **战力崩坏** — power scaling violations in long-form (Wawa-cited 20-ch failure).
6. **Editor heuristics for AI detection (per ifanr/Tencent News 2025-03):**
   - 词藻华丽 (excessive adornment)
   - 过渡生硬 (brittle transitions)
   - 人称混乱 (POV slips)
   - 剧情无主线 (no through-line)
   - DeepSeek-R1 specific: 比喻+数字堆砌, 不必要的意象, 莫名其妙的描写.
7. **签约率** — Per training-camp-skeptical surveys, only ~10% of AI-assisted submissions reach 签约.

The negative ground truth is dense and consistent. **AI is broadly used; most output is not competitive with serious human writers.**

---

## 7. Xianxia / Cultivation-Specific Failure Modes

The cultivation genre has structural demands that LLMs handle poorly:

### 7.1 境界 (cultivation tier) consistency
- *"凡人 9-tier"*: 炼气-筑基-结丹-元婴-化神-炼虚-合体-大乘-渡劫. Each tier must bind to capability + social position + 心魔.
- AI fails: tier inflation, power creep, inconsistent within-tier capability. This is exactly the failure Wawa documents at 20 chapters.

### 7.2 角色命格 / 设定 retention
- 命格 (fate-mark) systems are state machines: birth-time / 八字 / 命宫 / 性格映射. LLMs produce plausible names but no real internal logic.
- Cross-100-chapter character growth requires explicit state tracking. RAG retrieves prose; it does not enforce consistency rules.

### 7.3 玄学 / 八字 / 奇门 / 风水
- TMT Post documents: DeepSeek used as *"算命大师"* — readers find that **inputting different birth-data produces nearly identical outputs**. LLM 算命 is statistical mimicry; **there is no real metaphysical engine behind any current AI tool.**
- 八字奇门 is deterministic logic over 天干地支 / 五行 / 八卦 — *encodable as rules*, not just text patterns. Every existing CN AI novel tool ignores this.

### 7.4 文风 (literary register)
- 金庸 / 古龙 / 还珠楼主 are *traceable styles* (corpus-modelable).
- Modern 网文体 is the dominant LLM-trained style.
- 现代体 is general LLM default.
- Aesthetic concern: LLM 中文写作 通病 — overuse of "犹如" / "仿佛" / 俗滥四字成语 (cliché 4-char idioms) / 比喻+意象堆砌. These are now editor-detection signatures.

---

## 8. Workflow Patterns CN Authors Use in 2026

The de-facto loop:

```
人工 大纲 → AI 设定/灵感扩展 → AI 章纲 → 人工 + AI 写正文 → 人工 润色去AI痕迹 → 发布
```

Cadence reality:
- **起点签约 baseline:** ≥4,000 字/天 全勤.
- **Pro web-novelist average:** 6,000 字/天 (4-6 hours).
- **Competitive 飞卢/番茄:** 万更 (10,000 字/day) to chart.
- **AI-only studios:** chasing 万字-per-hour throughput.

Where AI fits well today (per author consensus): outline expansion, scene description, fight choreography, settings consistency check, name generation, foreshadowing tracking.

Where AI fits poorly: emotional scenes, character interiority, 文风一致性, plot main-thread maintenance over 100k+ 字.

---

## 9. Critical Question: Is there a 2026 CN system that handles 100k+字 修仙 longform?

10-system verdict:

| System | Verdict |
|---|---|
| **作家助手 + 阅文妙笔 (Yuewen)** | Best platform-native. Module-level help (description/setting). NOT a longform consistency system. |
| **蛙蛙写作 (Wawa)** | Toy-to-serious crossover. Documented 20-chapter ceiling. |
| **星月写作 (Xingyue)** | Most ambitious commercial pipeline. Pattern-mining, not domain-modeling. Marketing-heavy claims. |
| **笔灵 (Biling)** | Solid web-novel assistant; partial 失忆 cure via outline storage. Not metaphysics-aware. |
| **码哩 (Mali)** | Process-disciplined; better than average. Same domain blindness. |
| **DeepSeek standalone** | Best free outline/setting/logic engine. Author rule: do not use for prose. |
| **Kimi long-context** | Workable for 'load whole book and ask'. No state machine. |
| **Claude Code (sub-agent + file state)** | **Best demonstrated longform pipeline.** Authors document successful 7-chapter / 21k 字 foreshadowing. Empirical only. |
| **OSS `webnovel-writer` (Claude Code based)** | Closest published architecture for 200万字 target. No metaphysics layer. |
| **OSS `xindoo/ai-novel-lab`** | Empirical proof: 428k字 / 100 chapters shipped via AGENTS.md + multi-pass revision. Genre was urban-fantasy. |

**Bottom line: in 2026, no CN system covers** *(metaphysical 八字奇门 internal kernel) × (resident agent over 100k+ 字) × (xianxia/cultivation tier-consistent prose)*. The intersection is empty.

---

## 10. Cultural / Aesthetic Concerns for our Project

- **Avoid LLM 中文 通病:** banned-token list for "犹如/仿佛/" overuse; cliché 四字成语 detector; 比喻密度 cap.
- **Style anchoring:** style-mode toggle (金庸 / 古龙 / 还珠楼主 / 网文体 / 现代体). Few-shot from author-controlled corpora.
- **Editor heuristics integration:** before-publish lint pass for the 5 editor red flags (词藻/过渡/人称/主线/AI signature).

Authors who are strong on 八字奇门 in modern xianxia: 流浪的蛤蟆 (《天鹏纵横》, 《仙葫》), 烽火戏诸侯 (《雪中悍刀行》 — 阵法/相术-savvy though not strictly 八字奇门). Reference styles for our system to internalize.

---

## 11. The Honest Gap

**Our project intent:** 八字奇门 内核 + 常驻 agent + 修仙长篇.

**Coverage check across CN ecosystem 2026:**
- 八字奇门 deterministic kernel: **0 systems**.
- Resident agent with file-state long memory: ~3 OSS systems (`webnovel-writer`, `novel-creator-skill`, `xindoo/ai-novel-lab` AGENTS.md).
- 修仙 长篇 100k+ 字: empirically demonstrated by `xindoo/ai-novel-lab` (urban-fantasy genre though), workflow-validated by Claude Code longform reports.

**Conclusion: the intersection — metaphysics-grounded resident-agent xianxia longform — is a genuine void in the CN ecosystem.**

---

## 12. Closing Recommendations

**Closest existing system to our use case:** `lingfengQAQ/webnovel-writer` (GitHub) — built on Claude Code, 3-layer Story System, file-state memory, 37 genre templates, 200万字 design target. But: no metaphysical kernel, no 八字 logic, generic prose engine.

**Biggest unmet need:** a deterministic **CN metaphysical state engine** (八字 / 奇门 / 五行 / 境界) that grounds long-form xianxia generation in *non-statistical* truth. Every existing tool fakes the metaphysics or skips it.

**Recommendation: BUILD on FORK.**
- **Fork** `lingfengQAQ/webnovel-writer` (or rebuild the same Claude-Code-on-files architecture cleanly) for the agent loop, sub-agent dispatch, and 3-layer memory pattern.
- **Build** the metaphysical kernel (八字 birth-data → 命格 / 五行 affinity / 奇门 query / 境界 progression rules) as a deterministic state-machine module the agent can call as a tool.
- **Build** the xianxia consistency layer (境界 advancement validator, 心魔 progression tracker, 法宝/功法 registry).
- **Build** the AI-style sanitizer (banned-token + density + editor-heuristic lint).
- **Reuse** WebNovelBench-style 8-dimension LLM-as-Judge as the regression eval.

Do not 'join' (the closest CN commercial tools all have orthogonal goals: throughput, generic prose, or platform lock-in). Do not 'build from scratch' (the file-state + agent-loop + RAG layer is already a solved problem in OSS).

The defensible product is the **metaphysics kernel + xianxia state-machine** — that is the 2026 white space.

---

*Word count ≈ 2,050. Sources: 30 cards in `source_cards_chinese_ai_novel.json`.*
