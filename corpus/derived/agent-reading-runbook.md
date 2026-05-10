# Agent Reading Runbook

Version: 0.1

This runbook defines the first practical pipeline after confirming the bilingual
corpus exists.

## Stage 0: Integrity

Inputs:

- `corpus/manifests/gutenberg-fiction-100.tsv`
- `corpus/manifests/gutenberg-chinese-fiction-seed.tsv`
- `corpus/manifests/writing-craft-100.tsv`

Checks:

- Raw file exists for every `downloaded` entry.
- File is non-empty.
- Checksum is recorded.
- Language and provenance are recorded.

Outputs:

- `*.sha256` files under `corpus/manifests/`
- Corpus balance report

## Stage 1: Reading Queue

Build three queues:

- `fiction_en`: 100 English or translated classics
- `fiction_zh`: 15 Chinese classics
- `craft_public_domain`: 10 public-domain craft/theory texts

Modern craft books stay in a `needs_legal_copy` queue until legal files are
supplied.

## Stage 2: First-Pass Artifact

For each book, produce one `first_pass` artifact using
`corpus/derived/reading-artifact-schema.md`.

Minimum acceptable output:

- Narrative engine
- World logic
- Character system
- Relationship net
- Scene mechanics from representative scenes
- Reader retention devices
- Agent rules
- CanonGate checks

## Stage 3: Cross-Book Comparison

Compare books by pattern family:

- Quest and pilgrimage
- Family/clan decline
- Court, empire, and office politics
- Romance, marriage, and social contract
- Revenge, crime, guilt, and punishment
- Adventure and survival
- Bildungsroman and transformation
- Gothic, uncanny, prophecy, and fate
- Satire and social diagnosis
- Serialized suspense and delayed payoff

For the Chinese corpus, add these families:

- Fate, omen, and cosmic order
- Kinship, house, lineage, and inheritance
- Ritual, taboo, and social face
- Officialdom, bureaucracy, and hidden power
- Jianghu/chivalric obligation
- Mythic bureaucracy and divine mandate

## Stage 4: Agent Distillation

Convert cross-book patterns into system components.

### WorldDaemon Inputs

- Slow pressure rules
- Faction and relationship drift rules
- Reputation and debt propagation
- Hidden event queues
- Omen and fate signal handling
- Social consequence timing

### SimulationRun Inputs

- Branch templates
- Reversal templates
- Promise/payoff maps
- Escalation ladders
- Scene stress tests
- Character choice tests

### CanonGate Inputs

- Continuity constraints
- Relationship transition checks
- World-rule checks
- Genre contract checks
- Style and tone drift checks
- Payoff legitimacy checks

## Stage 5: Feedback Into Writing

When the novel agent writes or revises a chapter:

1. Retrieve relevant world, relationship, and craft memories.
2. Ask WorldDaemon for current latent pressures.
3. Generate candidate scene branches with SimulationRun.
4. Score branches for causality, reader pull, character pressure, and future
   payoff.
5. Draft with the selected branch.
6. Run CanonGate before accepting the draft.
7. Write new facts, debts, promises, and unresolved hooks back into memory.

## Non-Goals

- Do not store large copyrighted excerpts in memory.
- Do not imitate a living author's prose voice.
- Do not reduce classics to generic moral summaries.
- Do not let a 1M-context call replace structured extraction.

