# Corpus Balance Report

Date: 2026-05-08

This report records what is actually available locally for the long-form novel
agent research pass. It separates full-text material from book lists that still
need legal source files.

## Confirmed Local Full Texts

| Corpus | Local path | Count | Status |
| --- | --- | ---: | --- |
| English and translated classic fiction | `corpus/raw/gutenberg/` | 100 | Full text downloaded |
| Chinese classic fiction seed | `corpus/raw/gutenberg-zh/` | 15 | Full text downloaded |
| Public-domain writing craft and narrative theory | `corpus/raw/writing-craft/` | 10 | Full text downloaded |

The bilingual fiction corpus is therefore present and usable for the next
analysis step.

## Registered But Not Fully Available

| Corpus | Local path | Count | Status |
| --- | --- | ---: | --- |
| Writing craft target list | `corpus/manifests/writing-craft-100.tsv` | 100 | 10 downloaded, 90 need legal copies |

The remaining modern craft books are intentionally not downloaded from
unauthorized sources. If legal files are supplied later, they should be placed
under a separate local source directory and added to a manifest with provenance.

## Chinese Seed Scope

The Chinese seed is not 100 books yet. It is a concentrated canonical starter set
anchored by major long-form narrative traditions:

- Four great classical novels: `紅樓夢`, `三國志演義`, `水滸傳`, `西遊記`
- Mythic and cosmological narrative: `封神演義`, `鏡花緣`
- Social satire and officialdom: `儒林外史`, `老殘遊記`, `老殘遊記續集`
- Martial, chivalric, romance, and late-imperial urban fiction:
  `兒女英雄傳`, `海上花列傳`, `補紅樓夢`, `風流悟`
- Short classical narrative seeds: `枕中記`, `遊仙窟`

This is enough to start bilingual comparative extraction, especially for the
system's original strengths around fate logic, relationship nets, world order,
symbolic inference, and slow-burn causal consequences.

## Practical Readiness

The next stage can proceed now with these guarantees:

1. There is a stable 100-book English fiction base for macro-plot, scene craft,
   viewpoint, pacing, suspense, and character transformation patterns.
2. There is a Chinese classical base for clan systems, destiny structures,
   political worlds, karma-like consequence chains, prophecy, ritual order, and
   dense relationship causality.
3. There is a small but usable public-domain writing theory base for explicit
   craft vocabulary.
4. There is a larger 100-book writing craft target list ready for expansion once
   legal copies are available.

## Next Gate

The immediate next gate is not "summarize books." The useful next gate is to
turn each source into a structured reading artifact that can be consumed by:

- `WorldDaemon`: long-running world-state inference and pressure simulation
- `SimulationRun`: reproducible narrative stress tests and branch exploration
- `CanonGate`: continuity, causality, tone, promise/payoff, and canon checks
- `Memory`: reusable craft principles, motifs, counterexamples, and scene moves

