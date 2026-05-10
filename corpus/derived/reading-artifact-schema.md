# Long-Form Novel Reading Artifact Schema

Version: 0.1

Purpose: convert full books and craft texts into compact, reusable knowledge for
the custom novel agent. The goal is not generic book summary. The goal is to
extract operating principles that improve long-form storytelling, world
simulation, character continuity, and reader retention.

## Artifact Identity

Every reading artifact should include:

- `artifact_id`: stable slug, usually matching the manifest slug
- `source_title`
- `author`
- `language`
- `source_path`
- `source_type`: `fiction`, `craft`, `theory`, `mythic`, `historical`, or
  `hybrid`
- `analysis_depth`: `first_pass`, `deep_pass`, or `canonized`
- `legal_status`: source provenance and whether the full text is locally usable

## Fiction Extraction Fields

For novels, extract these layers.

### 1. Narrative Engine

- Core dramatic question
- Primary desire line
- Primary fear or wound line
- Main opposition system
- Promise made to the reader in the opening
- Final payoff or reversal
- What keeps the reader moving after each major section

### 2. World Logic

- Social order: family, class, office, sect, empire, town, profession, or market
- Power rules: who can act, punish, reward, hide, judge, or distort truth
- Resource rules: money, land, reputation, magic, knowledge, office, weapons
- Fate rules: omen, prophecy, karma, coincidence, divine order, hereditary debt
- Taboo rules: what cannot be said, crossed, known, married, bought, or forgiven
- Consequence rules: how small causes become irreversible later events

### 3. Character System

- Character function: protagonist, antagonist, rival, mirror, tempter, witness,
  fool, threshold guardian, patron, betrayer, judge
- Visible want
- Hidden want
- Self-deception
- Social mask
- Relationship leverage
- Breaking point
- Irreversible choice
- Transformation, corruption, revelation, or tragic fixation

### 4. Relationship Net

- Relationship type: kinship, romance, rivalry, debt, oath, patronage, duty,
  resentment, secret, mentorship, faction, ritual bond
- Power direction
- Emotional charge
- Information asymmetry
- Past debt
- Current conflict
- Future pressure
- Canon-sensitive facts that must not drift

### 5. Scene Mechanics

For representative scenes, extract:

- Scene promise
- Entry pressure
- Conflict vector
- New information
- Reversal or complication
- Cost paid
- Exit hook
- Which later payoff this scene prepares

### 6. Reader Retention Devices

- Mystery held back
- Suspense clock
- Dramatic irony
- Emotional contradiction
- Moral ambiguity
- Social humiliation or status threat
- Delayed recognition
- Prophecy or omen
- Betrayal setup
- Cliffhanger or soft hook

### 7. Style And Voice

- Point of view
- Narrative distance
- Sentence rhythm
- Dialogue density
- Description strategy
- Humor or irony strategy
- Symbolic image clusters
- Register shifts
- What should be imitated
- What should only be studied, not copied

## Craft/Theory Extraction Fields

For writing books and theory texts, extract:

- Core thesis
- Actionable rules
- Failure modes
- Diagnostic questions
- Revision heuristics
- Scene-level advice
- Structure-level advice
- Character-level advice
- Style-level advice
- Where the advice conflicts with other schools
- How the rule should be adapted for serialized or long-running fiction

## Agent Consumption Layers

### WorldDaemon

Consumes world logic, relationship nets, power rules, taboo rules, and consequence
rules. It should use them to keep the fictional world alive between explicit
writing requests, especially for slow social, political, emotional, and fate-like
changes.

### SimulationRun

Consumes narrative engines, scene mechanics, and reader-retention devices. It
should run branch tests such as:

- What happens if the protagonist avoids the obvious conflict?
- What hidden cost accumulates if a relationship truth is delayed?
- Which branch creates the strongest promise/payoff chain?
- Which branch breaks the world rules or character continuity?

### CanonGate

Consumes canon-sensitive facts, relationship leverage, source-derived failure
modes, and style constraints. It should reject or flag:

- Events with no causal preparation
- Relationship changes with no pressure history
- Sudden power shifts with no world-rule explanation
- Payoffs without promises
- Promises that disappear
- Character choices that contradict established wound, desire, or fear
- Tone drift that damages the intended genre contract

### Memory

Stores distilled principles and examples, not raw copyrighted passages. Each
memory item should be short, attributable to an artifact, and transformable into
agent behavior.

## DeepSeek 1M Usage Pattern

When a 1M-context model is available, use it for whole-book or large-section
passes, but still require structured outputs. Large context should be used to
preserve cross-chapter causality, not to produce longer summaries.

Recommended pass order:

1. `map`: table of chapters/sections, major events, promises, and payoffs
2. `trace`: follow desire, fear, relationships, and world pressure across the
   whole book
3. `extract`: produce reusable craft rules and anti-rules
4. `stress`: convert extracted rules into CanonGate checks and SimulationRun
   scenarios
5. `distill`: store compact memories and design constraints

## Quality Bar

A valid reading artifact must answer:

1. What engine makes this book continue?
2. What would break the book if removed?
3. What can the agent reuse without copying prose?
4. What should the agent avoid because it is era-bound, genre-bound, or
   ethically obsolete?
5. Which checks should be added to prevent weak long-form writing?

