# Agent Writing Principles Seed v0

This is the first synthesis layer after corpus confirmation. It is not a claim
that all books have already been fully read. It is a seed specification for how
the novel agent should learn from the available bilingual corpus and writing
theory texts.

## Direction Judgment

This project is a custom agent system, not a normal writing prompt library.

The reason is simple: long novels require persistent state, delayed payoff,
world evolution, relationship pressure, memory, critique, revision, and
background simulation. A trigger-only assistant can draft scenes, but it cannot
reliably maintain a living novel across hundreds of chapters unless it has
explicit runtime components.

The core shape should remain:

- `WorldDaemon`: long-running inference over world state, factions,
  relationships, latent conflicts, unresolved debts, prophecies, and slow
  consequences
- `SimulationRun`: controlled branch exploration before accepting a plot move
- `CanonGate`: hard and soft validation before new text becomes canon
- `Memory`: compact, attributable craft knowledge and story facts
- `ReadingArtifacts`: distilled lessons from the corpus, not raw imitation

## What The English Corpus Should Teach

The English and translated classics are strongest for extracting:

- Desire-driven plot: a protagonist's want must create external pressure and
  internal contradiction.
- Moral pressure: the most memorable plot turns force a character to reveal
  values under cost.
- Viewpoint discipline: narration must control what the reader knows, suspects,
  misunderstands, or anticipates.
- Suspense and delay: the reader keeps going because a promise is active and
  its answer is costly.
- Symbolic recurrence: objects, places, names, weather, illness, letters,
  documents, dreams, and repeated phrases become memory anchors.
- Character transformation: change needs pressure history, not sudden authorial
  decision.
- Social constraint: marriage, money, inheritance, law, reputation, class,
  crime, faith, and public shame are plot engines, not background decoration.

Agent behavior derived from this:

- Every chapter should have a live dramatic question.
- Every scene should change knowledge, power, relationship, risk, or desire.
- Every major payoff should be traceable to earlier promises.
- Every character turn should have a visible trigger and an invisible pressure
  history.

## What The Chinese Corpus Should Teach

The Chinese classical seed is especially important because it preserves the
original flavor of the system: fate logic, relationship causality, symbolic
orders, clan pressure, ritual order, and world-scale consequence.

The agent should extract:

- Relationship-first causality: kinship, sworn bonds, marriage, patronage,
  faction, debt, face, resentment, and obligation drive events.
- World order as pressure: court, bureaucracy, lineage, sect, household,
  cosmic office, and divine mandate can all become active plot machinery.
- Fate as narrative grammar: omen, dream, prophecy, name, season, direction,
  timing, and repeated image should create expectation and dread.
- Slow consequence: a small insult, hidden debt, broken ritual, or concealed
  truth may return tens of chapters later as a structural event.
- Ensemble design: characters are not isolated arcs; they form a pressure net.
- Ritual and taboo: what cannot be said or crossed is often more important than
  what a character openly wants.

Agent behavior derived from this:

- Track relationship debt as a first-class state object.
- Track face, oath, taboo, mandate, and reputation separately from emotion.
- Let the world continue moving even when the current chapter focuses elsewhere.
- Treat prophecy and omen as promise objects that must later transform,
  mislead, invert, or pay off.

## How To Preserve The Original Symbolic Systems

Systems such as 奇門遁甲, 先天八卦, 後天八卦, 五行, 天干地支, and 八字 should not be
used as claims of real-world prediction. In this project they are valuable as
structured narrative inference grammars.

Operational use:

- 八卦: encode situation archetypes, transition states, oppositions, and hidden
  movement.
- 五行: encode support, restraint, exhaustion, transformation, and imbalance
  among characters, factions, resources, and emotions.
- 天干地支: encode timing cycles, recurrence, seasonality, and delayed return.
- 八字/十神: encode role pressure, family/social position, desire conflicts,
  resource flows, authority, rivalry, expression, and constraint.
- 奇門遁甲: encode event timing, directional pressure, hidden gates, strategic
  choice, apparent opportunity, and concealed risk.

In agent terms, these systems become symbolic state vectors used by
`WorldDaemon` and `SimulationRun`. They should help the system ask better story
questions:

- Which pressure is growing unseen?
- Which relationship is mutually generating or mutually restraining another?
- Which path looks auspicious but carries hidden cost?
- Which delayed consequence is now due?
- Which character's fate pattern is being repeated, inverted, or broken?

## What The Craft Texts Should Teach

The downloaded public-domain theory and craft texts should become explicit
writing rules:

- Aristotle/Poetics: plot is an organized whole; reversal and recognition matter
  because they reorganize meaning.
- Horace: unity, proportion, decorum, and genre expectation matter.
- Longinus: emotional elevation requires force, image, scale, and intensity, not
  ornament alone.
- Henry James: point of view and consciousness shape the novel's reality.
- Edith Wharton: architecture, proportion, scene placement, and social world are
  craft decisions.
- Stevenson and Twain: movement, vividness, oral force, humor, and adventure
  rhythm can carry reader attention.
- Strunk: prose should remain clear enough that structure and feeling are not
  buried.

Agent behavior derived from this:

- Prefer causal architecture over event accumulation.
- Prefer scene pressure over exposition.
- Prefer specific sensory and social signals over abstract emotion labels.
- Prefer clear prose unless opacity is deliberately serving viewpoint or mood.

## First Implementation Implication

The agent should not simply ask a model to "write the next chapter." The runtime
should do this:

1. Load canon, unresolved promises, current world pressures, and relationship
   debts.
2. Ask `WorldDaemon` what has changed offscreen.
3. Run several `SimulationRun` branches.
4. Score branches using reader pull, causality, character pressure, symbolic
   fit, and future payoff potential.
5. Draft the strongest branch.
6. Run `CanonGate`.
7. Store new facts, debts, promises, omens, and emotional consequences.

This is why the system should be designed as a custom long-running agent.

