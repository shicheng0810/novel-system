# World-Simulation Systems for Fiction Generation: A Research Survey

**Date**: 2026-05-09
**Author**: Claude Opus 4.7 deep-research agent
**Companion artifact**: `source_cards_world_simulation.json` (60 source cards)
**Purpose**: Ground architectural decisions for a Bazi/Qimen-conditioned fiction-generation simulator in the strongest world-simulation systems humanity has built.

---

## 0. Frame

The asks are unusual when collected: continuous-tick world state, dynamic (not pre-declared) character set centered on a protagonist, *Chinese metaphysical priors* (Bazi 八字 + Qimen Dunjia 奇门遁甲) as first-class probability shapers, branch-with-canon outputs, author-pause gates, multi-month runtime per world. No single existing system delivers all of this. But every requirement has at least one strong analog in the field. Below I survey twelve threads, then synthesize five steal-worthy patterns and three traps.

---

## 1. Dwarf Fortress: the gold standard of procedural history

Dwarf Fortress (Bay 12 Games, Tarn & Zach Adams, 2002–present) is the high-water mark for *agent-driven* procedural history. The architecture has three temporal layers stacked on a single substrate (`df-01`, `df-04`):

1. **World-gen**: continents, climate, civilisations, and history are simulated for ~125–1,050 years before the player arrives. Civilisations rise, gods are minted, books are written, artifacts forged, dwarves murdered.
2. **Legends mode**: a queryable index over the generated world. Every named figure, conflict, artifact, civ, dynasty, and book is browseable as natural-language causal sentences (`df-04`).
3. **Fortress / Adventurer mode**: the player perturbs that substrate and contributes new history, which Legends absorbs.

Two design choices matter for our project:

**Story-driven feature design.** Zach Adams ("Threetoe") writes short fantasy stories; he and Tarn analyse them to extract *simulation primitives* required to make them re-tellable in DF (`df-02`, `df-03`). Stories are not scripts; they are *test cases* for the simulator. The generator-then-extractor loop is exactly the right answer for our system: write the kind of fiction we want, then ensure the simulator can in principle have produced it.

**Mythology by spawning.** Adams' myth generator seeds a single entity (a god, a cosmic egg) and grows a mythology by random spawning + interaction; the result is a list of `(entity, interaction)` tuples that humans read as theogony (`df-06`). This is the right shape for our Bazi/Qimen layer: cosmological priors as *seed entities and interaction operators*, not as scripted decrees.

**Adams' philosophical anchor**: "We don't want another cheap fantasy universe — we want a cheap fantasy universe generator." (`df-05`). Every architectural compromise that turns the *generator* into the *universe* is a betrayal of this thesis.

**Limit:** DF's history is *thin* per-character (sentence-level). It does not produce novel-grade prose, only *legible facts about a dramatically interesting world*. Our system must add a separate render layer.

---

## 2. RimWorld: the storyteller as drama-manager

RimWorld (Ludeon Studios, Tynan Sylvester) places three named "AI Storytellers" — Cassandra Classic (rising-tension classic), Phoebe Chillax (long peace), Randy Random (chaos) — *between* the simulation and the player (`rim-01`, `rim-02`, `rim-03`). Each storyteller is a meta-agent that schedules events with knowledge of:

- **Wealth/storyteller pacing curves** (gear up → spike → recover loops),
- **Recent player suffering** (some recovery is mandatory),
- **Story momentum** (Cassandra escalates; Randy doesn't care).

The storyteller is the answer to RimWorld vs DF. DF's emergence is bottom-up and produces *stories in retrospect*; RimWorld's storyteller produces *stories in prospect* by knowing, at every tick, what kind of pressure to apply. Sylvester's framing in his book *Designing Games* (and in the *Game Developer* analysis `rim-03`) is that emergent narrative + curated pacing + author-aware drama-manager > pure emergence for legibility.

**Application**: our "consistency-gate scoring" should be read as a *RimWorld-style storyteller layer over a DF-style world*. The Bazi/Qimen layer is the storyteller's ruleset. The author-decision-needed pause is the storyteller saying *"the pacing curve is reaching a fork; I cannot pick which arc you want."*

---

## 3. Crusader Kings 3: trait-density as narrative engine

Paradox's CK3 is the closest commercial system to ours in *character-centric* simulation (`ck3-01`, `ck3-02`, `ck3-03`, `ck3-04`). The shape is:

- **Trait taxonomy** (~hundreds): congenital, education, lifestyle, virtues, sins, lifestyle perks. Three congenital ladders (Attractiveness/Intelligence/Strength) inherit with leveling chains (parent + parent same trait → 50% chance of leveled offspring).
- **Stress / mental-break system** (`ck3-02`, `ck3-04`): stress accumulates whenever a character is forced to act *against* their traits. At thresholds, mental-break events fire — a wrathful character at L1 yells at a vassal; at L3 they murder their heir.
- **Coping mechanism traits** become *long-term* psychological scars layered on top.
- **Trait-driven event triggers**: hundreds of small events check (trait, stress, relationship, dynasty position) and inject narratively-shaped vignettes.

Two patterns translate directly:

**Trait-stress as drama primitive.** "Forcing a character to act against nature" is the right *single* primitive for emergent drama. It accounts for 80% of why CK3 feels novelistic. We should map Bazi day-master tendencies and Ten Gods relations to trait analogues, then maintain a stress accumulator that fires events when prior-violation crosses a threshold.

**Combinatorial richness over hand-authoring.** CK3 has *many* traits and *small* event templates; the combinatorial product is what novelists call "voice." (`ck3-03`)

---

## 4. Caves of Qud: post-hoc motivation inference and the layered-history pipeline

Freehold Games (Brian Bucklew, Jason Grinblat) built a science-fantasy roguelike whose history-generator is the closest *academically-published* analog to what we want (`qud-01`, `qud-02`, `qud-03`).

The Sultan history pipeline:

1. **Generate five "Sultan" rulers** randomly with personality dimensions.
2. **Run their lives forward** as sequences of *random actions* (a Sultan takes the throne, marries a vizier, exiles a poet).
3. **Run "sifting patterns" over the action sequences** to *infer plausible motivations after the fact* — a state machine + replacement grammar.
4. **Emit lore-fragments**: parchments hidden in dungeons, sometimes *contradictory* between sources (because in-world historians would disagree).

Grinblat's FDG'17 paper (`qud-01`) frames this as "subverting historical cause and effect": instead of *first* deciding why a Sultan acted and *then* generating the action, generate the action stream first and reverse-engineer motivation. This is a near-perfect match for LLM-era fiction generation — let the simulator emit *what happened*, then have an LLM *interpret* what each character thought it meant. The interpretation layer is naturally per-POV, which dovetails with our branch-alternatives requirement.

The layered procedural pipeline (world → history → civs → artifacts → dungeons → fragments, each constraining the next; `qud-03`) is the right macro-shape for building the substrate the protagonist explores.

---

## 5. Generative Agents (Park et al. 2023) and its descendants

Park et al.'s "Generative Agents: Interactive Simulacra of Human Behavior" (UIST'23, `ga-01`, `ga-02`) is the canonical LLM-agent reference. 25 agents in a Sims-like Smallville with:

- **Memory stream**: every observation, conversation, plan, reflection is appended as a timestamped record.
- **Retrieval**: relevance × recency × importance scores select context for the next decision.
- **Reflection**: periodic agent-introspection generates higher-level abstractions ("I am a romantic", "Klaus is busy with his dissertation"). Reflections become first-class memory entries.
- **Planning**: daily plans decomposed into hourly → 5-minute granularity, revised under interruption.

The ablation table is load-bearing for us: removing memory, reflection, *or* planning each materially degrades believability. All three are needed. The open-source repo (`ga-03`) is a direct reference implementation we can fork.

**Scaling beyond 25**: Park's dissertation simulates 1,000 US-adult agents (`ga-04`) and documents fidelity-vs-cost failure modes. Project Sid (Altera, `sid-01`, `sid-02`) puts up to 1,000 LLM agents in Minecraft with the **PIANO** architecture (Parallel Information Aggregation via Neural Orchestration). Findings: agents specialise into roles, follow taxes, amend constitutions, spread Pastafarianism. Limit: weak spatial reasoning, weak innate drives.

**Key implication for us**: protagonist's "contact set" is dynamic (could be 5 to 500 NPCs over months of runtime). The right pattern is *lazy instantiation* — full PIANO/GA-style cognition only for active contacts; lower-fidelity historical record for everyone else. This matches Caves of Qud's "Sultans get full bio, peasants get a name" stratification.

**Voyager** (Wang et al, NVIDIA/Caltech/Stanford, `voy-01`) adds a third pillar: a **skill library** of *executable code* the agent has discovered/written. For us: a library of *narrative moves* (e.g., `confess_secret(x, listener)`, `betray_for_money(x, recipient)`) that the simulator can compose, much like Versu's social practices.

---

## 6. Versu, Façade, and the academic interactive-drama lineage

The 2003-2014 academic line is canonical and most overlooked by modern LLM-engineers.

**Façade** (Mateas & Stern, 2005, `facade-01`, `facade-02`) is the founding work on **drama managers**: an explicit AI layer that selects from a library of *story beats* (each with preconditions, joint-dialog behaviors, effects on dramatic tension). Beat selection is governed by a *tension curve* — exactly what we mean by a "consistency gate." Façade was authored in ABL (A Behavior Language), a reactive-planning DSL.

**Versu** (Evans & Short, 2014, `versu-01`, `versu-02`) is the most relevant academic precedent for *protagonist-centered relationship simulation*. Designed by Richard Evans (Sims 3, Black & White) and Emily Short (Galatea, *Counterfeit Monkey*), Versu's social agents act on **social practices** (party-throwing, courtship, dueling) — generative norm sets. Players form unscripted bonds because the social model itself generates relationship trajectories the author never wrote. Short's blog post crystallizes the design ethos: "because the social model is generative, you can have a romance the author never wrote."

For our system, Versu's social practices = our **storylet library**. Drama Llama (`drama-llama-01`) and Open-Theatre (`open-theatre-01`) extend storylets with LLM-fired natural-language triggers — meaning we don't have to write a DSL, we can author triggers in prose.

---

## 7. Inkle: tweening, herstory, and the narrative DSL

Inkle Studios (Jon Ingold, Joseph Humfrey, Cambridge UK) makes Heaven's Vault, 80 Days, Pendragon (the 2024 Inkle game), Sorcery!, and the **ink** scripting language (`ink-01`, `ink-02`).

**Ink** is the field's de-facto narrative DSL: knot-stitch-divert, variable state, external function calls, gather points. It compiles to a JSON intermediate other engines can consume.

**Heaven's Vault** (`ink-02`) implemented "narrative tweening" — between authored *keyframes*, ink mixes lines from a topic library to fill the gap. The story is recomputed every visit to a location based on what's true now.

**Inkle's Pendragon** (2024) reads like a deliberate rebuke of Versu: rather than free social simulation, it is a tightly authored campaign on top of an ink-driven event scheduler. Its lesson is that *both* axes — authored skeleton and emergent flesh — are needed, and the ratio matters.

For our system: ink (or an LLM-friendly equivalent like Drama Llama's NL triggers) is the right *intermediate representation* between the simulator's events and the rendered prose. We should not generate prose directly from the simulator; we should generate ink-shaped events and a render pipeline interprets them.

---

## 8. Mythic GME, Ironsworn, and the oracle-table tradition

Solo-RPG oracle systems are the *closest analog to our metaphysics layer*.

**Mythic GME** (Tana Pigeon, Word Mill Games, `mythic-01`, `mythic-02`): the **Fate Chart** is a 13-row × 13-col matrix mapping *(action rank, difficulty)* to a *yes/no/exceptional* outcome. A **Chaos Factor** (per-scene 1-9 dial) shifts probabilities — high chaos means more random events fire. **47 Meaning Tables** in the 2nd edition supply narrative-detail words ("action: oppose", "subject: news"). Mythic players play *solo* with this chart as their entire GM.

**Ironsworn** (Shawn Tomkin, `ironsworn-01`): leaner. *Ask the Oracle* with a likely/unlikely table; *open-ended inspiration tables* for places, names, themes. Truths are established by *interpreting* oracle answers as facts.

**Tarot** (Sullivan FDG'18 `tarot-01`, Manning chapter `tarot-02`): tarot as a "compressed dictionary of human archetypes" — drawn cards become a probabilistic prior for narrative shape. Sullivan's system templates movie-synopses from card spreads.

**Critical insight for us:** Bazi and Qimen are *exactly* the same kind of artifact — symbolic-prior systems with rich combinatorial structure. The difference is that Bazi/Qimen are *deeper* (eight characters + Ten Gods + Flowing Years) and *temporally indexed* (the chart for a given moment differs predictably from the chart 2 hours later, supporting a moving-prior model). Our Bazi/Qimen layer should be designed exactly like Mythic's Fate Chart: a probability-shape lookup table plus a chaos-factor knob, but with deterministic time-based evolution.

---

## 9. Pendragon (TTRPG) and Burning Wheel: the generational/belief skeleton

**Pendragon** (Greg Stafford, Chaosium, `pendragon-01`, `pendragon-02`) is the only major RPG built around *generational succession over an 82-year campaign*. Mechanics:

- **One year per ~2-3 sessions**.
- **Winter Phase** between adventures: characters age, marry, raise heirs, manage estates, gain or lose Glory.
- **Heirs inherit** when characters die; players continue as great-grandchildren.
- **The Great Pendragon Campaign** (432pp) is a year-by-year skeleton 485-end-of-Arthur with PC actions improvised over the historical scaffolding.

This is the shape of "months of runtime per world": most ticks are non-dramatic state evolution; dramatic events are *seasonal*, not per-tick. We should explicitly model a Winter Phase analog.

**Burning Wheel** (Luke Crane, `bw-01`) gives the most surgical character primitive: **BITs** = Beliefs (strategic goal), Instincts (automatic behaviors), Traits (identity descriptors). The GM is *obligated* to test Beliefs, and the **Artha** reward system pays players when they engage their BITs. For us: every character has a Belief vector, and the simulator is *obligated* to test it within N ticks. This is also a beautiful coupling for Bazi: the ten Gods relations naturally map to belief-statements about the day master ("I am proven by output", "I am consumed by wealth").

---

## 10. Generative-agent frameworks, multi-agent infra

For implementation, several open-source frameworks are worth surveying:

- **AGENTS** (Zhou et al, `agents-01`): planning, memory, tool use, multi-agent comm, fine-grained symbolic control. Modular and research-friendly.
- **AutoGen** (Microsoft, `autogen-01`): conversational multi-agent, async/event-driven in v0.4. Now in maintenance mode in favor of MS Agent Framework.
- **MetaAgents** (`metaagents-01`): persona-role alignment, but degrades with participant count due to misalignment/dishonesty — a cautionary note.
- **Project Sid PIANO** (`sid-01`, `sid-02`): proven at 1,000 agents.
- **Smallville** (`ga-03`): canonical reference implementation.

The right choice for us is probably *AGENTS or PIANO as the agent substrate*, with our own drama-manager + Bazi/Qimen layer above.

---

## 11. Story-coherence research and consistency gates

The 2024-2026 LLM story-gen literature gives us a measurement vocabulary:

- **SCORE** (`score-01`): hybrid dynamic-state-tracking + summarisation + TF-IDF + semantic retrieval. **+23.6% coherence (NCI-2.0), 89.7% emotional consistency (EASM), -41.8% hallucinations** vs baseline GPT. These are the right baselines for our consistency gate.
- **ConStory-Bench** (`constory-01`): 5 error categories, 19 subtypes — quantifies consistency degradation as length scales. Direct eval target.
- **Narrative planning paper** (`narrplan-01`): LLMs fail at long-horizon narrative without explicit goal/state. Plot-skeleton + tick + render outperforms free generation.
- **SNAP** (`snap-01`): "Cells" with explicit plans (spatiotemporal setting + character action + plot dev) prevent drift. Direct match for our "canon stage" chunking.
- **Open-Theatre Director-GlobalActor-Actor** (`open-theatre-01`): nearly identical to the architecture we should adopt.
- **Drama Llama** (`drama-llama-01`): NL-fired storylets above LLM agents — eliminates the ABL/ink authoring barrier.
- **what-if** (`whatif-01`): zero-shot meta-prompting for branch generation — direct method for our branch-alternatives requirement.
- **Patchview** (`patchview-01`): "dust" (atomic facts) + "magnets" (organising concepts) — UI pattern for the author-decision interface.
- **2025 EMNLP survey** (`llmsurvey-01`): confirms long-form fiction is "still an open frontier" — answers Q11.

---

## 12. Bazi/Qimen as computational priors

**Bazi (八字, Four Pillars of Destiny):** deterministic algorithm. Birth datetime + true-solar-time correction + lunar-solar conversion → eight characters (Heavenly Stems + Earthly Branches × Year/Month/Day/Hour). On top of that: Five Elements balance, Ten Gods relations to Day Master, Symbolic Stars (Shen Sha), Great Life Cycles (Da Yun, decade-level shifts), Flowing Years/Months/Days. Reference implementation: `bazi-04` (cantian-ai/bazi-mcp) handles DST and true-solar-time correction. (`bazi-01`, `bazi-04`)

**Qimen Dunjia (奇门遁甲):** a 9-palace chart with 9 stars / 8 gates / 8 gods / 10 stems mapping per 2-hour interval. Originally a military/statecraft system; modern usage is for timing and direction selection. Multiple deterministic calculator implementations exist (Joey Yap, Master Sean Chan, QiAdvisor, Chinese Metasoft). (`qimen-01`, `qimen-02`)

**The crucial finding:** the **BaZi-LLM** paper (Zheng et al, arxiv 2510.23337, `bazi-02`) is **definitive evidence that BaZi-as-prior actually improves character simulation** in LLM:

- First QA dataset for BaZi persona reasoning across wealth, health, kinship, career, relationships.
- BaZi-LLM achieves **30.3-62.6% accuracy improvement** over DeepSeek-v3 / GPT-5-mini.
- Critically: **wrong BaZi → 20-45% accuracy drop**, proving the symbolic prior is load-bearing not decorative.

Companion: **BaziQA-Benchmark** (`bazi-03`) for symbolic+temporal reasoning eval. Plus `bazi-mcp` (`bazi-04`) as a deterministic calculator we can adopt directly.

For Qimen we have algorithmic specs and tools but no academic LLM-integration paper yet — **green field** with strong precedent (BaZi paper) showing the integration pattern works.

---

## 13. Critical question (Q11): is fiction-gen + sim still green field?

**Yes**, with three caveats.

**Yes**, because:
- The 2025 EMNLP survey (`llmsurvey-01`) explicitly identifies long-form fiction-via-simulation as an open problem.
- All commercial systems (`novelai-01`, `char-ai-01`, Sudowrite) use *worldbuilding databases* (Lorebook, Story Bible) but not *ticking simulation*. They retrieve, they don't simulate.
- Hobbyist pipelines (Book-Agent `bookagent-01`) attempt some state tracking but lack a true world-tick.
- No published system unifies (1) continuous tick, (2) dynamic dramatis personae, (3) cosmological symbolic priors, (4) author-pause loop.

**Caveats**:
- Drama Llama (`drama-llama-01`), Open-Theatre (`open-theatre-01`), SNAP (`snap-01`) cover (1) and (4) for *short* form (interactive drama).
- Project Sid (`sid-01`) covers (1) at scale but not (4) and not (3).
- The BaZi-LLM paper (`bazi-02`) is the first to demonstrate (3) for *static* character simulation, not yet for *world-tick*.

The architectural assembly is novel; each component is mature. Our project sits at the intersection.

---

## 14. Synthesis

### 5 architectural patterns to steal

1. **Three-layer temporal stack (DF)** — World-gen pre-history → continuous-tick simulation → on-demand legends/render. Don't conflate them. (`df-01`, `df-04`, `df-05`)

2. **Drama-manager above agent simulation (RimWorld + Façade + Open-Theatre)** — A meta-agent with knowledge of pacing curves selects *which* events fire, applies a tension budget, and is the gate that pauses on author-decision-needed. Open-Theatre's Director-GlobalActor-Actor decomposition is the cleanest blueprint. (`rim-01`, `facade-02`, `open-theatre-01`)

3. **Memory-stream + reflection + planning per active agent (Park et al.)** — Don't shortcut. The ablation shows all three are load-bearing for believability. Lazy-instantiate full cognition only for the protagonist's active contact set; downgrade to compressed bios for the rest (Caves of Qud's stratification). (`ga-01`, `ga-02`, `qud-02`)

4. **Trait-stress as drama primitive (CK3 + Burning Wheel BITs)** — "Forcing a character to act against nature" + "the GM is *obligated* to test Beliefs within N ticks" together produce 80% of novelistic emergent drama. Bazi day-master + Ten Gods relations should be mapped onto this primitive. (`ck3-02`, `bw-01`)

5. **Symbolic prior as tension/probability shaper (Mythic Fate Chart + BaZi-LLM)** — Bazi/Qimen play the role of the Fate Chart: not deterministic outcome, but probability shaping. The BaZi-LLM paper proves this measurably improves persona reasoning (30-60% accuracy gain when Bazi is correct, 20-45% drop when wrong). Wire it as a prior over event-firing and outcome resolution, not as a decree. (`mythic-01`, `bazi-02`)

### 3 anti-patterns to avoid

1. **Pure bottom-up emergence with no drama manager (DF without RimWorld's storyteller)** — DF is legible only because its players are mining for stories. Without a drama-manager curating which simulation events surface as narrative beats, output is *systematically dramatic but narratively shapeless*. The 2003-2014 academic interactive-drama line (`facade-02`, `versu-01`) and the 2025 LLM literature (`narrplan-01`, `snap-01`) all converge on: *plot skeleton + tick + render* outperforms free emergence.

2. **Generating prose directly from simulator state** — Inkle's tweening (`ink-02`) and Caves of Qud's post-hoc motivation inference (`qud-01`) both teach the same lesson: simulator emits *what happened* (events), interpreter (LLM, per-POV) emits *what it meant*. Conflating the two is the source of "stories that are technically consistent but feel like changelogs."

3. **Long-context-only / no explicit state / no consistency gate** — Character.AI's PipSqueak 2 lorebook rollout (`char-ai-01`), the SCORE paper (+23.6% coherence with explicit state, `score-01`), the ConStory-Bench results (`constory-01`), Pratilipi's engineering blog (`pratilipi-01`), and the Pendragon TTRPG's Winter-Phase pattern (`pendragon-01`) all converge: *long-form generation is a systems-engineering problem, not a prompting problem*. Stories are stateful systems with constraints, contracts, and memory; "just give it more context window" is the wrong abstraction. We must build an explicit world-state DB, an explicit consistency-gate scoring layer (SCORE-style: state tracking + summarisation + hybrid retrieval), and an explicit chunked render boundary (SNAP "Cells" / our "canon stages").

---

## Executive Summary (≤300 words)

The architectural ask — continuous-tick world simulator, dynamic protagonist-centered character set, Bazi/Qimen as first-class probabilistic priors, canon stages with branch alternatives, author-pause gates, multi-month runtime — is novel as a *unified* system, but every component has strong precedent. Dwarf Fortress (`df-01`) and Caves of Qud (`qud-01`) provide the procedural-history substrate and the post-hoc motivation-inference pattern. RimWorld's storyteller (`rim-01`) and Façade's drama manager (`facade-02`) provide the meta-narrative layer that gates pacing and pauses for author input. Open-Theatre's Director-GlobalActor-Actor (`open-theatre-01`) and Drama Llama's NL-triggered storylets (`drama-llama-01`) are the cleanest LLM-era blueprints. Park et al.'s generative agents (`ga-01`) and Project Sid's PIANO at 1,000 agents (`sid-01`) prove the agent-cognition substrate scales. Crusader Kings 3's stress-as-trait-violation (`ck3-02`) and Burning Wheel's BITs (`bw-01`) supply the dramatic primitive. Mythic GME's Fate Chart (`mythic-01`) is the analog template for a symbolic prior layer; the BaZi-LLM paper (`bazi-02`, arxiv 2510.23337) is the *definitive* recent evidence that BaZi-as-prior measurably improves character reasoning (+30-60% accuracy when correct, -20-45% when incorrect — proving the prior is load-bearing, not decorative). Pendragon's 82-year Winter Phase campaign (`pendragon-01`) is the right model for non-dramatic state evolution between dramatic seasons. The 2025 EMNLP survey (`llmsurvey-01`) confirms long-form fiction-via-simulation remains a green field. Our project's contribution is the *assembly* — three-layer temporal stack, drama-manager-on-agents, trait-stress primitive, Bazi/Qimen as probability shaper, with explicit consistency gating per SCORE/SNAP. The traps are pure emergence without a storyteller, generating prose directly from sim state, and treating long-form as a prompting problem rather than a systems problem.
