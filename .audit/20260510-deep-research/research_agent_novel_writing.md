# Critical Survey: AI-Driven, Multi-Step, Continuous, Agentic Novel Writing (2025-2026)

Compiled 2026-05-10. Audience: a single power-user author building a serious Chinese cultivation/xianxia novel with Bazi/Qimen as a first-class probabilistic prior. The companion file `source_cards_agent_novel_writing.json` contains 50 cards (S01-S50) referenced inline.

---

## 0. Executive framing

The dream architecture you described — an always-running creative agent that simulates a fictional world around the protagonist's contact graph, drafts chapters as canon stages settle, pauses for high-risk branches, and accepts author intervention via anchors / lens / branch promotion rather than typed prose — is not a single paper, a single product, or a single open-source repo as of May 2026. It is the *intersection* of five almost-mature subfields that are individually past the proof-of-concept stage but have not been combined into a productized whole.

Those five subfields, in rough order of maturity:

1. **Multi-agent narrative generation as a research program** (Re3 → DOC → RecurrentGPT → Agents' Room → StoryWriter → StoryBox). Past peer review, reproducible code in most cases. Maturity: high for English, medium for Chinese.
2. **Long-context LLM backbones**. Gemini 3.1 Ultra (2M tokens, April 2026) and Claude Sonnet 4.5 1M-beta. Maturity: high.
3. **Persistent multi-agent simulation** (Park's Generative Agents 2023 → Altera Project Sid 2024). Maturity: high for sandbox, medium for narration.
4. **Knowledge-graph / structured-canon backbones for fiction** (SCORE, Long Story Generation via KG and Literary Theory, Guiding Generative Storytelling with KGs). Maturity: medium, rapidly improving.
5. **Symbolic priors for character / persona** (BaZi-LLM benchmark + Bazi MCP server, 2025). Maturity: low but unusually well-aligned with your specific need.

The integration — *continuous*, *canon-grounded*, *theory-primed*, *non-prose author intervention*, *xianxia-aware* — is not yet productized. So the survey conclusion comes early: **the field is mature in pieces but not as a whole; for serious xianxia work in 2026 you should plan to assemble, not adopt.**

The remainder of this document explains why, with citations.

---

## 1. Multi-agent novel writing systems: academic + open source

### 1.1 The plan-draft-revise lineage (2020 → 2026)

The dominant academic lineage starts with **PlotMachines** (Rashkin et al, EMNLP 2020, S05), which proved that GPT-2/Grover-class models cannot produce coherent narrative from outline alone — explicit dynamic *plot-state tracking* is required. **Re3** (Yang et al, EMNLP 2022, S03) made this practical for ~2k-word stories with a four-phase loop: Plan → Draft → Rewrite → Edit, plus rerankers for coherence. **DOC** (Yang et al, ACL 2023, S02) refined this with a hierarchical *detailed outline* and a *detailed controller*, lifting plot coherence by 22.5%, outline relevance by 28.2%, and interestingness by 20.7% over Re3. **RecurrentGPT** (aiwaves-cn, 2023, S01) reframed the same loop as language-as-state: short-term memory (10-20 sentences in prompt) plus long-term memory (paragraph summaries on disk + semantic retrieval). **LongStory** (PAKDD 2024, S46) added a long/short-term context weight calibrator and structural-position discourse tokens, pushing coherent generation up to ~10k tokens.

By 2025 the field consolidated around explicit multi-agent specialization. **Agents' Room** (DeepMind, ICLR 2025, S10) split the workload into planning agents and section-specific writing agents (exposition / rising / climax / falling / resolution), producing stories ~2x longer than end-to-end baselines and preferred by expert readers. **StoryWriter** (CIKM 2025, S11) crystallized the now-standard three-agent pipeline — outline agent (event graph with character/event-event relations) → planning agent (chapter scheduling) → writing agent (dynamic history compression) — and released two SFT'd backbones (StoryWriterLLAMA, StoryWriterGLM) plus a 6,000-story 8k-word-avg dataset. **StoryBox** (AAAI 2026, S12) — the most relevant 2025-era paper for your project — combines a top-down storyteller agent with a *bottom-up multi-agent sandbox* (5-level World/Region/Zone/Area/Object hierarchy), generating coherent ~12k-word stories that beat all prior systems. StoryBox's hybrid bottom-up architecture is the closest published analogue to "always-running world sim that drafts chapters as canon stages settle."

In parallel, **Long Story Generation via Knowledge Graph and Literary Theory** (arXiv 2508.03137, S13) demonstrates that *structured priors plus KG* deliver measurable gains over outline-only methods, by introducing a *narratology-derived obstacle framework* into the planner. The same architectural slot trivially generalizes to Bazi/Qimen — that paper uses Western narratology as the prior; you would substitute Chinese metaphysical priors. The published precedent makes this swap defensible.

### 1.2 Foundational Dramatron and Storium

**Dramatron** (Mirowski et al, CHI 2023, S04) on Chinchilla 70B was the first credible long-form creative agent from a major lab: log line → title/characters → plot → location descriptions → dialogue. Industry-pro evaluation (15 writers): 84% useful, 77% true collaboration, 92% surprised. Dramatron's hierarchical prompt-chaining is canonical and still pedagogically the cleanest reference. **STORIUM** (Akoury et al, EMNLP 2020, S06) supplied the only public collaborative-storytelling dataset (6k stories, ~125M tokens with character goals/attributes), and a live evaluation platform where authors query and edit. STORIUM's machine-in-the-loop framing (humans edit, edit-distance is the metric) is closer to your "author intervenes via anchors" goal than turn-by-turn prompting.

### 1.3 Surveys and benchmarks

The 2025 landscape is mapped in **A Survey on LLMs for Story Generation** (Findings of EMNLP 2025, S49). It splits the field into two paradigms: (i) independent LLM generation and (ii) author-assistance / collaboration. The "always-running creative agent" sits *between* the two — an autonomously generating system that the author edits structurally — and the survey explicitly identifies this as under-explored. **Lost in Stories: Consistency Bugs in Long Story Generation by LLMs** (S17, 2026 ConStory-Bench) provides an empirical map of failure modes: errors are most common in factual and temporal dimensions, cluster around the *middle* of narratives, occur in high-entropy text, and co-occur. This means a canon-gate UX should over-weight middle-chapter review and high-entropy paragraphs.

### 1.4 Open-source pipelines (the working tools you can clone today)

- **AutoNovel** by Nous Research (S28). Modify-evaluate-keep/discard loop adapted from Karpathy's autoresearch. State.json explicitly tracks "propagation debts" between lore ↔ outline ↔ chapter; LLM Judge plus regex-based anti-slop checks; produced a real 79,456-word 19-chapter novel. English-centric. **The single most architecturally relevant project to study.**
- **AI_NovelGenerator** (YILING0013, S29). Chinese-first multi-chapter generator with first-class foreshadowing tracking (伏笔), character-arc state, semantic retrieval for long-range consistency, contradiction-detection proofreading. Configurable backend. **The best Chinese-aware open-source baseline.**
- **InkOS** (S30). Local web workbench, AI-detection, style analysis, human review gates. Aligned with the canon-gate UX pattern.
- **StoryWriter** (S11), **StoryBox** (S12), **LongStory** (S46), **Re3** (S03), **DOC** (S02) — academic codebases, reproducible.
- **Multi-Agent Based Character Simulation for Story Writing** (In2Writing 2025, S45) — a Director Agent + Character Agents responding chronologically along a scene outline. A useful drop-in for the scene-level orchestration layer.

---

## 2. Commercial AI novel-writing systems

The honest answer about commercial: **not one of them runs continuously.** All operate as on-demand, scene-or-chapter-at-a-time assistants.

- **Sudowrite Story Engine 3.0** (S21). Workflow: Braindump → Genre / Style / Characters → Outline → Beats → Draft. Each Beat ~200 words, Chapter Generator chains beats to 3,000-5,000+ word chapters. Per multiple 2025-2026 reviews, it is "fundamentally a scene-level tool you stitch together into a book... You are guiding the AI through each chapter." **Most mature commercial product, still not continuous.**
- **Novelcrafter** (S22). Codex (typed entries with aliases), Plan/Matrix views, Extract tool that turns chat outputs into Codex/scene entries. Drag-drop acts/chapters/scenes. Bring-your-own-LLM. **Best 'world-bible aware' product; entirely turn-by-turn.**
- **NovelAI** (S23). Llama 3 Erato 70B + Lorebook. Strongest unfiltered fiction option (relevant for cultivation novels with mature content). Free-form rather than structured.
- **Wavemaker** (S24). Free open-source PWA, snowflake-method, storyboard cards. Not AI-first but exemplary planning UX.
- **Squibler** (S26). 2025 added a Book Proposal phase. Fiction reviewers note it is repetitive vs Sudowrite.
- **Plot Bunni** (S25). Lightweight OSS, browser-based, not multi-agent.
- **SillyTavern** (S27). Roleplay frontend with character cards (.png+JSON) and Lorebook. Has Auto-Continue (empty user message forces continuation) but output is inherently dialog-flavored, not narrative prose.
- **PseudoWrite, Bramble, Wolverine** — none surfaced as serious peer-reviewed or large-installed-base products in 2026 search; treat as either niche / discontinued or rebranded to other names.
- **WriteWise (Himalaya), Yuewen / 起点 internal LLM, DeepSeek for 网文** (S40). Chinese-market reality: AI-drafted xianxia is already a commercial activity, with DeepSeek used to produce 10,000-character first drafts in roughly an hour for short-form 爽文. Authors use these for *fast first draft*, not autonomous drafting. 38.7% of Qidian's 2025 contracted works are fantasy/xianxia.

**Pattern across all commercial:** scene-or-chapter granularity, author-typed prompts, no autonomous loop, no continuous simulation, no first-class metaphysical prior. The closest to "continuous" is Story Engine, and even that is human-driven.

---

## 3. Autonomous and continuous creative agents

### 3.1 Sandbox simulation (mature)

**Generative Agents** (Park et al, UIST 2023, S08) is the seminal paper: 25 LLM agents in Smallville with three-part memory (raw observation stream + reflections + retrieval-by-relevance/recency/importance). One seed (Valentine's Day party) propagates through the social graph over two simulated days. The architecture (observation / planning / reflection) is canonical and the open-source `reverie` framework is a viable starting point. **Project Sid** (Altera, 2024, S09) scaled this dramatically: 10 to 1,000+ agents in Minecraft using **PIANO** (Parallel Information Aggregation via Neural Orchestration) — concurrent stateless modules (cognition, planning, motor, speech) sharing an Agent State, so slow planning doesn't block fast reaction. Emergent specialization, rule-making, religion, memes. $9M seed.

For your design — "simulates a fictional world around the protagonist's contact graph" — Project Sid demonstrates that 100s of persistent agents are practical. The PIANO concurrency pattern is directly applicable: your simulation thread (NPC actions, sect politics, calendar progression) can run independently of the slower drafting/canon-update thread.

### 3.2 Naive autonomous loops (cautionary)

**AutoGPT, BabyAGI, AgentGPT** (S33). The early-2023 wave. Honest 2025-2026 retrospective: recursive task loops "distract" on tangents (the classic shoelace anecdote), confused by their own loops, and produce incoherent novel-length output without strong canon. *The fact that an agent can loop does not make it autonomous.* This is the cautionary baseline for why a continuous creative agent without explicit canon and review gates produces drift.

### 3.3 Always-running creative-writing agents in the wild

The honest finding: there is no widely-adopted "publishes a chapter daily" project. **AutoNovel** (S28) is the single most credible autonomous novel pipeline, but it runs as a one-off long-running batch — generate-evaluate-revise until done — not a perpetual daemon. The xianxia-adjacent **AI Cultivation World Simulator** (S31) and **Cultivation World Simulator** on GitHub (S32) are the closest you'll find to a perpetually-running cultivation-world sim, but they are *games*, not novel-writing pipelines. **Replika and Character.AI** (S34) maintain persistent chat personas with two-layer memory (short-term context + RAG) and recently shipped Lorebook features (PSQ2 in April 2026), but they are conversational, not narrative.

### 3.4 Persona persistence

**PersonaGym** (Findings EMNLP 2025, S43) measures persona drift quantitatively. Even with explicit persona prompts, LLMs drift over multi-turn interactions. This is the empirical motivation for *anchored* personas — and naturally where Bazi-as-prior earns its keep, by giving each character a deterministic, time-evolving personality model rather than relying on free-form persona text alone.

---

## 4. Long-context coherent storytelling

### 4.1 Frontier context windows (2026)

**Gemini 3.1 Ultra** (April 2026, S35) ships a 2M-token context with claimed coherent recall through 1M. **Claude Sonnet 4.5** offers a 1M beta via the `context-1m-2025-08-07` header. This is enough to fit an entire novel plus extensive canon in a single prompt — but practical experience and BooookScore (S18) findings show that *raw long context is still inferior to structured retrieval* for novel-length consistency. You will use 1M-2M context as a working buffer, not as the canon itself.

### 4.2 Hierarchical summarization and memory

**BooookScore** (Chang et al, ICLR 2024, S18) is the rigorous comparison: hierarchical merging (combine chunk-summaries pairwise) gives coherent but detail-lossy summaries; incremental updating (running summary over chunks) preserves more detail; larger chunk sizes improve incremental updating. **NexusSum** (ACL 2025, S19) showed multi-agent hierarchical chunking with up to +30% BERTScore over prior SOTA — current best recipe for compressing a novel into agent-readable form.

### 4.3 Knowledge graphs vs vector RAG for fiction

The 2025 consensus is firmly that **graph-structured canon beats pure vector RAG** for long fiction. **SCORE** (S38) builds an incremental KG; **Guiding Generative Storytelling with Knowledge Graphs** (S39) shows editable KGs outperform vector RAG on continuity; **Long Story Generation via Knowledge Graph and Literary Theory** (S13) integrates KG with a literary-theory prior. For xianxia specifically — sect lineages, technique inheritance, Bazi compatibility, Qimen palace assignments — graph structure is *natural*. A vector RAG over chapters cannot answer "which sect-elder ranks higher than X by lineage depth." A KG can.

---

## 5. Author-in-the-loop UX patterns

### 5.1 Approval gates (practical pattern)

The "Building HITL Approval Gate" patterns (S41) and the LangGraph / CrewAI / HumanLayer ecosystems provide the working vocabulary: *predefined moments* where a human validates before continuing; *non-blocking parallel feedback* for cases where the human reviews asynchronously while the agent continues other work. UX guidance: "don't dump raw JSON, summarize." For an always-running creative agent, the canon-gate analogue is: surface a structured diff (what changed in the canon, which characters are affected, what high-risk branches the agent considered), not a wall of JSON.

### 5.2 Sketching as control, not typing

**TaleBrush** (CHI 2022, S07) is the clearest existing prior art for "author intervenes via lens, not by typing prose." Authors drag a curve representing protagonist fortune over time; the LLM generates story aligned with that curve. Iterative sketch-read-resketch loop. You are reaching for a richer version of this — anchors over canon, lens over current focus, branch promotion over generated alternatives — but TaleBrush proves the non-typed-control paradigm works.

### 5.3 Author psychology

**From Pen to Prompt** (CHI Creativity 2025, S42) interviewed 18 creative writers. They make deliberate decisions about *when* to engage AI based on craft values (authenticity, voice). Even power users reject "AI does it all." Your design — the author intervenes structurally, never by prose — respects this preference better than every commercial tool surveyed.

### 5.4 Slow-AI vs interactive-AI

There is no good 2025-2026 paper on "slow-AI vs interactive-AI tradeoffs" specifically, but the relevant design tension is clear from the literature. Generative Agents and Project Sid run *slow* (simulated-day cadence). RecurrentGPT and Sudowrite run *interactive* (per-paragraph or per-beat). The continuous creative agent must support both: a slow background simulation thread, plus interactive author-intervention moments. PIANO (S09) gives the architectural template — concurrent modules with different speeds sharing a state.

---

## 6. The critical question: adopt vs roll-your-own?

**Honest verdict: roll-your-own, with heavy reuse.** No existing system covers more than ~40% of what you described. Below are concrete adoption candidates, with pros and cons.

| System | Coverage of your spec | Pros | Cons |
|---|---|---|---|
| Sudowrite Story Engine 3.0 | ~25% | Best commercial Beat→Chapter pipeline; mature UX | Scene-level only; no continuous loop; no canon graph; weak Chinese; no Bazi |
| Novelcrafter (BYO-LLM) | ~30% | Codex world-bible is excellent; Matrix view; Extract tool | No autonomy; no simulation; author still types every prompt |
| NovelAI | ~15% | Unfiltered, anime-friendly | Weak structure; no simulation; chat-flavored |
| AutoNovel (Nous Research) | ~50% | Real autonomous pipeline; propagation-debt model; LLM Judge + anti-slop; reproducible | English-centric; one-shot batch not continuous; no Bazi; no contact-graph simulation |
| AI_NovelGenerator (YILING0013) | ~45% | Chinese-first; foreshadowing tracking; semantic retrieval; contradiction proofreading | Less polished; no agent simulation; no metaphysical prior |
| StoryWriter / StoryBox academic codebases | ~40% | SOTA architectures; reproducible; permissive licenses | Research code, not productized; no UX; no Bazi |
| Generative Agents (`reverie`) | ~35% | Persistent contact-graph simulation works; canonical memory architecture | A simulation, not a writer — needs a narrator overlay |
| AI Cultivation World Simulator + GitHub | ~35% | Cultivation-rule encoding (realms, techniques, lifespan); Chinese | A game, not a novel pipeline |
| Bazi MCP server + BaZi-LLM benchmark | ~15% (specific axis) | Production-ready chart computation; benchmark-validated symbolic+LLM hybrid | Persona axis only — does not write narrative |
| SillyTavern + custom auto-pilot | ~25% | Mature character cards + Lorebook; auto-continue exists | Roleplay, not narrative; output style mismatch for serious xianxia prose |

If forced to start from one base: **fork AutoNovel for the orchestration spine, port AI_NovelGenerator's Chinese-aware foreshadowing tracker and contradiction proofreader, layer Generative-Agents-style memory on the contact graph, plug in Bazi MCP as the deterministic side of the persona prior, and build the canon as a knowledge graph along SCORE / Long Story Generation via KG + Literary Theory lines.** That gets you to ~75% coverage. The remaining 25% — the lens / branch-promotion UX, the Qimen overlay, the always-running daemon discipline — is genuinely original work.

---

## 7. Honest gap analysis: what every surveyed system is missing for serious xianxia

A xianxia/cultivation reader would notice these deficiencies in *every* surveyed system within ~5 chapters:

1. **No genre-native pacing model.** Western three-act structure (PlotMachines, DOC, Agents' Room, Sudowrite Story Engine) does not match xianxia's "realm-stage breakthrough → bottleneck → tribulation → adventure" rhythm. Kevin Yang's structural-position discourse tokens (S46) generalize cleanly to a realm-stage embedding, but no system ships this.
2. **No first-class lineage / sect graph.** Vector RAG and even outline-based systems cannot reason about "is X senior to Y by inheritance depth" or "do these two sects have a generations-old grudge." The KG-backbone work (S38, S39, S13) supports this in principle; nobody has done it for xianxia specifically.
3. **No metaphysical prior.** Even the BaZi-LLM benchmark paper (S14) is the *only* published precedent for using Chinese metaphysics as a load-bearing model component, and it covers persona only — not Qimen calendar pulses, not 八字大运 timing for breakthroughs, not 奇门遁甲 directional auspice for travel arcs. The slot exists in the multi-agent architecture; nobody has filled it.
4. **No 伏笔 / Chekhov-gun inventory.** AI_NovelGenerator (S29) uniquely tracks foreshadowing, but most systems forget seeded items by mid-novel — exactly where consistency bugs cluster (S17). For xianxia, seeded *techniques*, *artifacts*, *bloodlines*, and *enemies* must be a typed Chekhov inventory with discharge-deadlines.
5. **No 爽点 / catharsis-curve tracker.** Chinese web fiction lives or dies by 爽点 frequency and intensity. No academic system models this; commercial systems leave it to the author. WebNovelBench (S16) is the only benchmark with explicit narrative-quality dimensions tuned to web novels.
6. **No continuous-running discipline.** Every system is either batch (AutoNovel) or interactive (Sudowrite); none manages the *daemon* problem — when to pause, when to defer to the author, how to surface what changed without overwhelming.
7. **No non-prose author intervention.** TaleBrush (S07) is the only HCI-published precedent. Every commercial product asks the author to type prompts.
8. **No xianxia-specific verifier.** Re3 / DOC rerankers and AutoNovel's LLM Judge optimize for general coherence. None checks "does this breakthrough match 八字流年", "is this technique consistent with the established 五行 element", "is this 法宝 within power-curve for the protagonist's stage."
9. **No author-graph mental model surface.** Generative Agents simulate a contact graph but don't expose it as the author's primary working object. Novelcrafter's Codex is text-typed, not graph-native.
10. **Weak Chinese-native creative LLM backbones.** Weaver (S20) is the most credible candidate; DeepSeek is widely used in 网文 practice (S40); but neither was tuned for cultivation-novel specifically. The best public Chinese-novel benchmark (WebNovelBench, S16) shows a real gap to human masterpieces.

---

## 8. Recommended architectural sketch for your project

Given the survey, the architecture that minimizes invention while maximizing reuse:

- **Backbone LLMs:** Claude Sonnet 4.5 (1M beta) or Gemini 3.1 Ultra (2M) for prose drafting and reflection; DeepSeek-V3 / Qwen-3 for cheap simulation steps; Weaver-Pro/Ultra (S20) as a backup Chinese-tuned writer.
- **Canon backbone:** Knowledge graph (SCORE-style incremental KG, S38) keyed by character / sect / location / artifact / technique / event. Narratology-and-Bazi prior layered as additional node types (Long Story Generation via KG + Literary Theory, S13).
- **Memory:** Generative-Agents three-stream memory (raw observation log + reflections + importance/recency/relevance retrieval, S08) per agent, with NexusSum-style hierarchical summarization (S19) for the canon-snapshot.
- **Simulation thread (slow):** PIANO-style concurrent modules (S09) for protagonist contact graph; one LLM call per sim-day per agent at most.
- **Drafting thread (slower):** AutoNovel-style modify-evaluate-keep loop (S28), but per-stage rather than full-novel, with propagation-debt tracking. StoryWriter's three-agent pattern (outline → planning → writing, S11) for the drafting decomposition.
- **Verifier:** AutoNovel's anti-slop regex + LLM Judge, plus a xianxia-specific verifier (realm-curve check, 五行 consistency check, 法宝 power-budget check, 八字 consistency for breakthroughs).
- **Bazi/Qimen prior:** Bazi MCP (S15) for deterministic chart calculation; BaZi-LLM-style symbolic-then-LLM reasoning (S14) for persona traits and timing.
- **Author intervention:** TaleBrush-style lens / sketch (S07); approval-gate non-blocking pattern (S41); diff-summary, never JSON dump.
- **Evaluation:** WebNovelBench (S16) for periodic absolute quality benchmarking; ConStory-Checker (S17) for consistency-bug regression.

Tracking the field: subscribe to **Awesome-Story-Generation** (S48) and the EMNLP / ICLR / AAAI fiction track for the next 12 months; Project Sid follow-up papers and StoryBox follow-up papers are the highest-signal sources.

---

## 9. Bottom line

*Is this field mature enough that a single author should adopt an existing system?* **No.** Every commercial product is structurally on-demand; every open-source autonomous pipeline is English-centric and one-shot; the closest research papers (StoryBox, Long Story Generation via KG + Literary Theory, BaZi-LLM benchmark) point clearly at the architecture you described but none assembles it. *Is rolling-your-own still required for serious xianxia/cultivation work?* **Yes — but with extensive reuse.** The pieces are mature enough that you should expect to integrate, not invent: AutoNovel's spine, AI_NovelGenerator's foreshadowing, Generative-Agents memory, an SCORE-style KG canon, Bazi MCP for the deterministic chart layer, and bespoke xianxia verifiers and lens UX on top. That gets to ~75% of the spec with prior art; the remaining 25% — daemon discipline, Qimen pulses, branch-promotion UX, sect-lineage reasoning — is the genuinely original contribution.

The opportunity window is open. Two of the most relevant papers (StoryBox, BaZi-LLM benchmark) appeared in late 2025; the next wave of integrators is just starting. Building this now lands ahead of the productized competition rather than behind it.
