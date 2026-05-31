# Generative Agent Architectures (2023-2026): A Deep Dive for an Always-On Personal Novel Sim

**Retrieved:** 2026-05-09
**Scope:** Park 2023 lineage, multi-agent civilizations, memory architectures, reflection loops, multi-character POV management, open-source scaffolds, evaluation methodology, cost/latency, and a recommended scaffold for our case.

---

## 1. The Park 2023 Foundation (Smallville)

Park et al. published "Generative Agents: Interactive Simulacra of Human Behavior" at UIST '23 ([arXiv:2304.03442](https://arxiv.org/abs/2304.03442)). The architecture is now the canonical reference for any LLM-driven social simulation.

**Three core mechanisms:**

1. **Memory stream** — a chronologically ordered, append-only natural-language log of every observation, plan, and reflection. Retrieval scores each memory along three axes: **recency** (exponential decay), **importance** (LLM-rated 1-10 at write-time), and **relevance** (cosine similarity of embedding to the current cue). Top-k weighted-sum results enter the next prompt.
2. **Reflection** — when the running sum of importance scores crosses a threshold, the agent asks the LLM "what salient questions can I ask about my recent memories?", retrieves answers from the stream, and writes higher-level inferences back as new (high-importance) memories. Reflections form a tree with concrete observations as leaves.
3. **Planning** — hierarchical: rough day-plan in 5-15 broad strokes, then recursive decomposition into hourly and finer-grained actions. Plans get rewritten when reactions to observations interrupt them.

**Smallville scope:** 25 agents in a 2D PyGame town; the canonical evaluation was a Valentine's Day party that the agents organized over 2 simulated days. Ablations on the three components confirm each is necessary for believability; humans rated full-architecture interviews most plausible.

**Surfaced limits (per the paper and follow-ups):**
- **Memory retrieval failures** — the most common error class; agents forget relevant facts because importance/relevance scoring is fragile.
- **Hallucinated embellishment** — agents invent details that compound over time, especially when memories are sparse.
- **Tone bleed** — agents inherit the LLM's overly formal register.
- **Importance scoring breaks outside everyday domains** — works for "agent went to bakery"; struggles for zombie apocalypse, fantasy, or any setting where 2023 LLM priors mis-rank salience ([Vaccine Hesitancy study](https://arxiv.org/html/2503.09639v2) confirms this).
- **Hard cap on prompt budget** — too many memories overflow the window even with retrieval.
- **No published agent count above ~25 with full coherence over more than a day or two.** Cost was significant in early 2023.

**Open code:** [joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents). Apache 2.0. Python + PyGame + GPT-3.5/4. Many unofficial replications exist.

**Park's own follow-up — [Generative Agent Simulations of 1,000 People](https://arxiv.org/abs/2411.10109) (2024)** pivots: instead of *more* agents in *one* town, build *one* agent per real human, grounded in a 2-hour interview transcript. Result: agents replicate held-out General Social Survey items at 86% of participants' two-week test-retest reliability (vs. 74% for demographic-only baselines). The implication for novelistic worlds: **persona depth beats persona count.** A character grounded in a rich interview-style "self-report doc" becomes much more stable over hundreds of stages than one specified by a few traits.

---

## 2. Voyager — Procedural Memory as Code

[Voyager (Wang et al., NVIDIA/Caltech 2023)](https://arxiv.org/abs/2305.16291) targets a different axis: lifelong skill acquisition. Three components:

1. **Auto-curriculum** — GPT-4 generates increasingly hard goals ("now mine diamonds"). Maximizes exploration breadth.
2. **Skill library** — every successful behavior is saved as an executable JavaScript function, indexed by description embedding. Reusable, compositional, interpretable.
3. **Iterative prompting with self-verification** — environment errors and execution feedback are looped back; agent edits the code until it passes self-checks.

Voyager beats prior SOTA by 3.3x unique items, 15.3x faster tech-tree completion, with no fine-tuning. **Lesson for our system:** treat *character skills* as code, not bullet-list traits. A character's "swordsmanship" or "ledger-keeping" is a callable function (or structured prompt template) the world dispatches to. Procedural memory is the under-appreciated third leg of the memory tripod ([survey: Memory in the Age of AI Agents, 2025](https://arxiv.org/abs/2512.13564)).

---

## 3. Project Sid — Civilization Scale (PIANO)

[Project Sid (Altera AI, 2024)](https://arxiv.org/abs/2411.00114) demonstrates 50-1000+ agents living for extended runs in Minecraft. It departs from Park's serial pipeline with the **PIANO** (Parallel Information Aggregation via Neural Orchestration) architecture.

**PIANO's idea:** ~10 cognitive modules run in parallel — speak, action, planning, social-awareness, action-awareness, goal-generation, memory, etc. — with a central decision module aggregating their outputs into one coherent action stream per tick. This avoids the latency bottleneck of Park's strictly sequential observation-reflection-planning loop and lets fast modules (reactive speech) run independently of slow ones (deliberative planning).

**Emergent behaviors at 500-agent scale (per [MIT Tech Review reporting](https://www.technologyreview.com/2024/11/27/1107377/a-minecraft-town-of-ai-characters-made-friends-invented-jobs-and-spread-religion/)):** specialization (merchants, miners, priests), constitution drafting and amendment in shared Google Docs, religion (Pastafarianism) spreading via bribery, cultural-meme transmission ("pranking" or "eco-issues" propagating across populations).

**Caveat:** Sid runs in Minecraft, not in narrative space. Their world has cheap, deterministic ground-truth (block states); ours has expensive narrative ground-truth (the author's intent). PIANO's parallelism is still applicable, but the modules need different evaluators.

**Companion paper at scale:** [AgentSociety (Tsinghua FIB, 2025)](https://arxiv.org/abs/2502.08691) sustains >10,000 agents on cluster hardware via an MQTT message bus. Open-source on [GitHub](https://github.com/tsinghua-fib-lab/AgentSociety). The engineering takeaway for us: **distribute simulation via a message bus, not a tight Python loop.** Each character can be its own subscriber.

---

## 4. Memory Architectures for the Long Run

Park's memory stream works for 25 agents and 2 days. For "ticks forever," it's not enough. The 2024-2026 literature converges on a layered approach:

- **MemGPT (Berkeley, 2023, [arXiv:2310.08560](https://arxiv.org/abs/2310.08560))** — OS-style virtual memory: main context (RAM), recall storage (paged in on demand), archival storage (cold). Tools let the agent self-page memories.
- **A-Mem (NeurIPS 2025, [arXiv:2502.12110](https://arxiv.org/abs/2502.12110))** — Zettelkasten-inspired notes. Each memory note has structured attributes (keywords, tags, contextual descriptions) and auto-links to semantically similar notes, forming an evolving knowledge graph. Outperforms vector-only baselines on 6 foundation models.
- **Mem0 (2025, [arXiv:2504.19413](https://arxiv.org/abs/2504.19413))** — production memory layer: hybrid vector + graph + key-value. +26% LLM-as-judge over OpenAI memory, -91% p95 latency, -90% token cost. Graph variant adds 2pp accuracy at +1.15s p95. [Open-source](https://github.com/mem0ai/mem0). Embedded graph backend (Kuzu) means no separate DB server.

**Memory-type taxonomy that crystallized in 2025** (survey: [Memory in the Age of AI Agents](https://arxiv.org/abs/2512.13564)):

| Type | Stores | Our characters need |
|---|---|---|
| **Episodic** | Concrete events with timestamps | Character's day-to-day journal |
| **Semantic** | De-contextualized facts | World lore, names, relationships |
| **Procedural** | Reusable skills/scripts | Character's behavior patterns, habits |

**Mapping to our system:** episodic = `journal/<character>/<date>.md` (Park's memory stream), semantic = bazi/persona doc + relationship graph (A-Mem-style notes), procedural = behavioral function library (Voyager-style).

---

## 5. Reflection / Planning Loops

The reflection family: ReAct → Reflexion → Self-Refine → Tree-of-Thoughts → CRITIC. [LangChain's taxonomy](https://blog.langchain.com/reflection-agents/) sorts them by external-feedback dependency:

- **ReAct** — interleaved thought/action/observation. Backbone for almost every agent today.
- **Reflexion ([arXiv:2303.11366](https://arxiv.org/abs/2303.11366))** — Actor + Evaluator + Self-Reflection. Verbal RL signals stored as text. Limitation: same LLM is both actor and judge → conflict of interest. Multi-Agent Reflexion (2025) addresses this with diverse critic personas.
- **Self-Refine** — generator + critic on the same draft, iterate. Cheap, plug-and-play, but produces marginal gains without grounding.
- **Tree-of-Thought** — branching exploration with explicit evaluation. High cost; great for math/planning, overkill for narrative ticks.
- **CRITIC** — critique grounded in tool calls (search, code execution). Most reliable for production.

**When reflection helps vs. hurts:** [Self-Reflection in LLM Agents (2024, arXiv:2405.06682)](https://arxiv.org/abs/2405.06682) shows reflection raises *first-answer correctness* but barely improves post-hoc self-correction *unless grounded in external feedback.* Ungrounded reflection degenerates into "overthinking" — long sequences that don't converge. **Practical rule: every reflection must be anchored to an external delta** — a memory diff, a world-state change, an author override. Don't let characters loop on pure self-rumination.

**Cognitive degradation in long-running agents** ([QSAF, 2024](https://arxiv.org/pdf/2507.15330)): empirically 28% of ReAct paths show "latent plan decay" — silent goal abandonment from context drift, planner recursion, or memory starvation. **A watchdog process is non-optional** for indefinite runs.

**Prompt pattern for "agent wakes up, reads journal, plans day"** (Park-derived, current-best-practice):
```
SYSTEM: <character persona doc, condensed>
WORLD: <date, weather, calendar, recent reflections>
JOURNAL: <retrieve last N entries by recency*importance*relevance>
RELATIONSHIPS: <graph subset for today's expected contacts>
TASK: 1) summarize yesterday in 3 bullets,
      2) state today's one-line goal,
      3) plan day in 5 broad strokes,
      4) flag any open promises/threads from journal.
```

---

## 6. Multi-Character POV Management

**Architectural choice — one LLM call per character vs. shared context with persona switch:**

| Pattern | Token cost (100 chars × daily tick) | Coherence | Drift risk |
|---|---|---|---|
| One call per character (isolated context) | 100 × ~3k tok = ~300k input/tick | High per-character | Cross-character world drift |
| Shared context, persona-switch via system prompt | 1 × ~30k tok with all personas | Lower per-character (token competition) | Lower world drift |
| Hybrid: shared world context + per-character private memory | 100 × ~5k tok = ~500k/tick | High both | Lowest |

The hybrid wins for our case. [NovelAI V4/4.5 multi-char workflow (2026)](https://aiinsightsnews.net/novelai-assign-multiple-characters/) confirms: trait isolation per character via separate conditioning streams "prevents token competition" — i.e., dilution of attention across personas when crammed into one prompt.

**Practical bound for a single-author personal sim:** with Haiku 4.5 at $1/$5 per MTok and the hybrid pattern, **~50-150 active characters at one daily tick** is feasible on a hobbyist budget (see §10). Push beyond and either reduce tick frequency, batch via Anthropic's 50% Batch API discount, or activate only characters in the protagonist's contact graph that day (the "director" pattern in our project brief).

**[Constella (2024, arXiv:2507.05820)](https://arxiv.org/html/2507.05820v1)** is the closest published academic system: multi-agent for storywriters, parallel character development. Validates the "one persona = one agent instance" pattern for narrative work specifically.

---

## 7. Open-Source Scaffolds

| Scaffold | License | Stack | Best for |
|---|---|---|---|
| [a16z-infra/ai-town](https://github.com/a16z-infra/ai-town) | MIT | TypeScript + Convex | Closest to our use case; matches our codebase. Has tick loop, transactions, embedding-based memory recall, character JSON. |
| [joonspk-research/generative_agents](https://github.com/joonspk-research/generative_agents) | Apache 2.0 | Python + PyGame | Reference for prompts, retrieval scoring, reflection trees. |
| [tsinghua-fib-lab/AgentSociety](https://github.com/tsinghua-fib-lab/AgentSociety) | Apache 2.0 | Python, MQTT | Distributed engine for >10k agents; overkill but instructive. |
| [altera-al/project-sid](https://github.com/altera-al/project-sid) | report+partial code | Python | PIANO modules reference. |
| [agiresearch/A-mem](https://github.com/agiresearch/a-mem) | Apache | Python | Drop-in agentic memory with Zettelkasten linking. |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | Apache | Python + Kuzu/Neo4j | Production-grade hybrid memory layer. |
| [SillyTavern](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) lorebooks | AGPL | TypeScript | Pattern: keyword-triggered world-info injection. |
| [OpenAI Swarm / Agents SDK](https://github.com/openai/swarm) | MIT | Python | Lightweight handoff primitive; stateless, useful for transient sub-agents. |
| [LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence) | MIT | Python/TS | Best-in-class orchestration with `PostgresSaver` checkpointing for "tick forever" durability. |
| [CrewAI](https://github.com/crewAIInc/crewAI) | MIT | Python | Role-team metaphor; fastest to ship for "writers' room" agent crews. |
| [AutoGen](https://github.com/microsoft/autogen) | MIT | Python | Conversational orchestration; good for free-form character-to-character dialogue. |
| [MetaGPT](https://github.com/geekan/MetaGPT) | MIT | Python | SDLC-specific; not relevant. |
| [Thytu/Agentarium](https://github.com/Thytu/Agentarium) | MIT | Python | Lighter alternative to AgentSociety. |

---

## 8. Evaluation Methodology for "Did the World Stay Coherent?"

Three layers of evaluation in the literature:

1. **Micro behavior fidelity (Park 2023):** human raters compare interview transcripts of full vs. ablated agents on identical prompts. Costly; doesn't scale.
2. **Macro pattern reproduction (AgentSociety 2025):** sociological measures (opinion-distribution shifts, network topology metrics, interaction-frequency power-laws) compared against historical or experimental data. Domain-specific.
3. **Validation surveys ([Springer 2025](https://link.springer.com/article/10.1007/s10462-025-11412-6)):** the field's central conclusion is that **validation, not capability, is the bottleneck.** Recommends triangulation of micro + macro + author-judgment, with explicit failure-mode catalogs.

**Practical drift-detection signals** (from [QSAF](https://arxiv.org/pdf/2507.15330) and operational LLM observability literature):

- Embedding distance of plan-text week-over-week (sudden divergence = drift).
- Importance-score distribution shift (memory-stream becomes top-heavy or bottom-heavy).
- Goal-stability hash (planner output should reference a small set of recurring goal phrases; entropy explosion = goal abandonment).
- Cross-character contradiction count (relationship graph asserts "A loves B" but A's recent memories say otherwise).
- Author-as-judge protocol: every N ticks, the human author skims the journals and tags coherence (-1 / 0 / +1). Use as ground truth for training the watchdog.

---

## 9. Practical Cost / Latency Analysis

**Park 2023 (GPT-4 era, retail prices ~$30/MTok input, $60/MTok output):** the public summaries don't disclose total cost, but anecdotally Smallville (25 agents × 2 sim-days) cost in the high hundreds to low thousands of US dollars per run.

**2026 unit economics (per [Intuition Labs pricing 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025), [pricing 2026](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)):**
- Claude Haiku 4.5: $1.00 / $5.00 per MTok
- GPT-4.1 mini: $0.40 / $1.60 per MTok
- DeepSeek v3 (open-weight, self-host) effectively ~$0.10-0.30 per MTok blended
- Anthropic and OpenAI both offer 50% Batch API discount

**Back-of-envelope for our case:** suppose 100 active characters × 1 tick/sim-day, hybrid prompt averaging 5k input tok + 1k output tok per character per tick:
- Per-tick cost on Haiku 4.5: 100 × (5k × $1 + 1k × $5) / 1M = **~$1/tick**
- Per-tick cost on GPT-4.1 mini: 100 × (5k × $0.40 + 1k × $1.60) / 1M = **~$0.36/tick**
- With Batch API: halve those.

**A 365-tick (one sim-year) run:** **~$130-365 on cheap-tier models; ~$65-185 with batch.** That's the same total cost as a single GPT-4 reflection burst in 2023. **The cost barrier has fundamentally collapsed.** A single author can run a year-long sim for under $400, or a 10-year sim for under $4000. Multi-month always-on runs are in hobbyist budget.

**Latency:** Mem0 graph variant adds ~1.15s p95. With 100 characters per tick the linear cost dominates — at ~2s LLM call median, a tick takes ~3-4 minutes serially or ~10-30s with concurrency. A daily tick is trivially feasible; an hourly tick requires concurrency engineering but is still well within reach.

---

## 10. Critical Question: Is "Always-On Personal Novel Sim" Feasible in 2026?

**Short answer: yes, with constraints — and the constraints are about novelty/coherence engineering, not raw capability or cost.**

What 2026 SOTA realistically supports:

| Dimension | Park 2023 | 2026 SOTA (replicable today) |
|---|---|---|
| Coherent agent count | ~25 | 100-500 with PIANO+Mem0; 1000+ at cluster scale |
| Sim-day horizon at coherence | ~2 | weeks-to-months with checkpointed memory + watchdog |
| Cost per sim-day, 100 agents | ~$X (high) | $0.30-$1 cheap-tier, $0.15-$0.50 batched |
| Memory backbone | append-only stream | hybrid vector+graph+kv (Mem0/A-Mem) |
| Open scaffolds | 1 (genagents) | 10+ production-grade |
| Persistence | none built-in | LangGraph PostgresSaver, Convex, MQTT engines |

**What is still hard (paper-level / not solved):**
- **Long-horizon coherence beyond ~3-6 sim-months** without manual author intervention. Cognitive drift is empirically real (28% latent plan decay in ReAct paths).
- **Bazi-driven dispositions** — no public research grounds character behavior in Chinese metaphysical priors. We must build this layer ourselves; no scaffold provides it.
- **Director-as-protagonist's-contact-graph** — the "activate only characters relevant to today's POV" pattern is a sensible cost optimization but not a published architecture. Closest precedent: the importance scoring from Park, plus relationship-graph queries as in Mem0's graph variant.
- **Author-in-the-loop quality control at scale** — automated coherence detectors are immature; human review remains the bottleneck.
- **Catastrophic narrative collisions** — when two character timelines drift into mutually inconsistent states, no scaffold auto-detects this. We need our own consistency oracle.

**Verdict:** **Our system is engineering-feasible in 2026. It is not a paper-level proposition.** The technical primitives all exist as open-source: AI Town for the simulation engine, Mem0 or A-Mem for memory, LangGraph for orchestration, Haiku/mini-tier LLMs for cost control. The remaining work is integration, the bazi-disposition layer, the director/contact-graph activation policy, the watchdog, and — most importantly — coherence evaluation for our specific genre conventions.

What we **shouldn't** expect: hands-off "set it and forget it" months-long runs producing publishable text. Expect to spot-check journals weekly, course-correct via author overrides, and treat the sim as a richer collaborator rather than a self-driving novelist.

---

## Recommended Scaffold (Concrete Library Choices)

For our "world simulation that ticks forever, characters with memories/plans/reflections, bazi-driven dispositions, director as contact graph" use case:

**Backbone (what we should build on):**
- **Simulation engine + tick loop:** [a16z-infra/ai-town](https://github.com/a16z-infra/ai-town) (TypeScript + Convex) as the foundation. Matches our existing TS codebase, has scheduled jobs, transactions, character JSON, and a working agent loop. Fork rather than greenfield.
- **Orchestration durability:** [LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence) with `PostgresSaver` for any agent flow that must survive restarts. If we stay all-TS, use Convex's native persistence + cron jobs and adopt LangGraph patterns conceptually rather than the lib itself.
- **Memory layer:** [Mem0](https://github.com/mem0ai/mem0) hybrid vector+graph (Kuzu embedded backend, no separate DB server). Use **vector for episodic** (per-character journals), **graph for semantic** (relationships, lore), **key-value for procedural** (behavior functions). If Mem0 is too Python-heavy for our TS stack, mirror its interface with a thin TS wrapper around a vector DB (e.g., Convex's vector index) plus Kuzu via WASM, or graduate to the Python service over HTTP.
- **Per-character agent loop:** Park 2023's recency/importance/relevance retrieval + reflection-tree, but with two upgrades: A-Mem-style notes (auto-linked) instead of pure stream, and Voyager-style procedural-skill library for character habits/rituals.

**Cognition pattern:**
- **Per character per tick:** ReAct loop with **CRITIC**-style grounding (every reflection must reference a memory delta or world-state change — no free rumination). Avoid Reflexion's same-actor-judges-itself pitfall; if we add a critic, make it a separate "narrator" persona.
- **Director (protagonist contact graph):** Park-style importance scoring drives an activation policy — only characters whose graph distance from POV ≤ 2 and whose calendar intersects today are run for the daily tick. Off-graph characters get a coarse weekly tick.
- **Cross-agent coherence:** PIANO-inspired parallel modules (speak/plan/social-aware) for characters that interact tightly each tick; serial Park-style for everyone else.

**LLM tier:**
- **Default:** Claude Haiku 4.5 ($1/$5 per MTok) for per-character ticks. Batch API (50% off) for non-real-time runs.
- **Heavy reasoning:** Claude Sonnet/Opus or GPT-4.1 only for end-of-week reflection consolidation, narrative-collision resolution, and author-facing summaries. Tag these as "deliberate" calls in our tracing.
- **Embeddings:** any cheap embedding model (Voyage AI, OpenAI text-embedding-3-small, or local mxbai-embed-large à la AI Town's default).

**Evaluation + drift watchdog:**
- **Per-tick assertions:** import [QSAF](https://arxiv.org/pdf/2507.15330)-inspired drift signals. Track plan-embedding distance week-over-week, goal-phrase entropy, cross-character contradictions in relationship graph.
- **Author-judge protocol:** every 7 ticks, surface 3 character journals to the author for -1/0/+1 coherence tags. Use these labels to calibrate the watchdog.
- **Hard stop conditions:** when contradictions exceed N or goal-entropy spikes, pause the sim and surface a "narrative collision" report.

**Stack we explicitly should NOT pick up:**
- **MetaGPT** — SDLC-specific, irrelevant.
- **OpenAI Swarm alone** — stateless; unsuited for "tick forever."
- **AgentSociety** — overkill for personal-scale; cluster-oriented.
- **Reflexion as our reflection engine** — single-actor-judge problem; use CRITIC patterns instead.

**Bazi disposition layer (we build this ourselves):**
- Encoded as a JSON structured field on each character ("bazi_pillars": {year, month, day, hour}, derived "five_elements_balance", "ten_gods", "luck_pillar_now").
- Surfaced into prompts as a soft-style biasing block: temperament priors, decision-tendency phrases, period-of-life modifiers. Treat as procedural memory (prompt templates), not as a deterministic action selector.
- **Open question:** how much should bazi influence override learned character behavior? Recommend: bazi sets *style and tendency*, never overrides explicit author canon. Consult Park 2024 1000-people pattern — a deep persona doc is the spine; bazi is a layer on top.

---

**Bottom line:** the 2026 toolchain is mature enough to build this. Start by forking AI Town, swap in Mem0 for memory, layer the bazi/director/persona-doc primitives ourselves, and budget under $400/sim-year on Haiku-tier models. The remaining engineering risk lies in coherence evaluation and the bazi layer — both are unique to our project and not buyable off the shelf.
