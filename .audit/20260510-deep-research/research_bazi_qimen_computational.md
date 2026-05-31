# Bazi & Qimen Dunjia as Computational Priors for Narrative Simulation

> Deep research, 2026-05-09. Working hypothesis: 八字 (Bazi/Four Pillars) + 奇门遁甲 (Qimen Dunjia) can act as a culturally-grounded probabilistic prior over character disposition, branch outcomes, and event timing in a long-form narrative simulator. We are evaluating whether the math, the data, the literature, and the design space all support that hypothesis.

## 1. Executive framing

The question is not "is Chinese metaphysics scientifically true." Per Popperian demarcation, qi-class concepts are *non-falsifiable* (S28). The right question is whether bazi/qimen, treated as a fixed symbolic system with deterministic generation rules, can serve as a high-information prior for narrative branch scoring — analogous to how Cultist Simulator's seven Aspects (S18), CK3's three personality traits (S19), Caves of Qud's mutation pool (S20), Disco Elysium's 24 skills (S21), and Mythic GME's Action+Subject oracle (S23) all impose tractable symbolic structure on otherwise-unbounded narrative possibility.

The 2025 academic literature provides the first empirical answer: yes, but only when the math is deterministic and the LLM stays in the interpretation layer. The BaZi-LLM hybrid in arxiv 2510.23337 (S5) outperforms DeepSeek-v3 by **30.3%** and GPT-5-mini by **62.6%** on a 488-question persona-reasoning benchmark, and a shuffled-birthday ablation drops performance by **up to 45.7%** — confirming the bazi pillars are doing real work, not just adding flavor. MingLi-Bench (S7) reproduces this with a 160-question test set drawn from the 2022-2025 Global Fortune-Teller Competitions: a hybrid agent hits **50% trimmed-mean** vs **40% best-LLM baseline**, approaching the **53.5%** human top-20 average.

That's the empirical floor. The architectural ceiling is whatever we build on top.

## 2. Computational backends - what's actually available

### 2.1 The bazi/lunar-calendar foundation

Three layers matter, in increasing precision:

1. **Authoritative astronomical core**: `sxtwl_cpp` / `sxtwl-modern` (S2). C++ port of Shouxing astronomical calendar with verified data BC722-1960 against three independent historical reference works (Zhang Peiyu, Chen Yuan, Fang Shiming). Long-double precision; SWIG bindings to Python/Java/Lua. Use this as the **truth oracle** for testing other libraries.

2. **Application-layer lunar/bazi core**: `6tail/lunar-javascript` v1.7.4 + sister `lunar-python` (S1). MIT, ~hundreds of stars, used as backbone by qfdk/qimen, ziwei-doushu engines, MingLi-Bench (via iztro), and most of the Chinese open-source ecosystem. Exposes pillars, ten gods, five elements, nayin, shensha, conflict relationships, hourly bazi, taboo days, lunar mansions. *This is the realistic application backbone.*

3. **Higher-level wrappers**: `alvamind/bazi-calculator` (S3, TS), `cantian-ai/bazi-mcp` (S4, ISC, MCP server with `getBaziDetail`/`getSolarTimes`/`getChineseCalendar` exposed to LLM agents directly), `china-testing/bazi` (Python, ships marriage/feng-shui scoring on top). These trade transparency for ergonomics.

For Ziwei Doushu (紫微斗数) — a complementary system — `SylarLong/iztro` (S12) is the unambiguous winner: 3.7k stars, MIT, ~20KB, plugin system for school variants, used by MingLi-Bench. It's worth carrying as a parallel layer because ziwei provides 12-palace life-domain partitioning that bazi doesn't.

### 2.2 The qimen ecosystem

Qimen tooling is more fragmented. Four scope schools exist (S16): 年家, 月家, 日家, 时家 — modern practice converges on **时家奇门** (hour-level), which also maps best to in-story event timing. Within 时家, two methods: 拆补法 (Chai Bu) and 置闰法 (Zhi Run / 长期置闰).

The deeper schism is **转盘 (rotating-disk) vs 飞盘 (flying-palace)** (S15):

| Property | 转盘 | 飞盘 |
|---|---|---|
| Symbol movement | rotates as a block when placed at hour-stem | sequential yang-up/yin-down across 9 palaces |
| Spirits | 八神 | 九神 |
| Mode | 后天 (acquired) | 先天 (innate) |
| Practitioner-claimed accuracy | ~60% | ~80-90% |
| Open-source coverage | strong (qfdk, dxbuyi, oceanjustinlin) | weaker |

Three concrete options:

- **`qfdk/qimen`** (S9): MIT Node.js, 转盘, modular files (bamen.js, bashen.js, jiuxing.js, dipan.js), built on lunar-javascript. Closest to a drop-in.
- **`dxbuyi/qimen.skill`** (S10): MIT Claude Code skill, Python `qimen_paipan.py` produces both human grid and JSON between markers. Architecturally closest to what we want: deterministic Python + LLM interpretation. Authors flag ~1-day error margin near solar-term boundaries.
- **`oceanjustinlin/qimen`** (S11): MIT, Vue+Python, uses Gemini-Flash to *route* questions into 6 categories (财运/事业/感情/健康/交易/杂事) then Gemini-Pro for analysis. The routing pattern is exactly what we'd port to narrative branches.

Backup: `masterai-top` (S13, Java commercial) covers all systems but quality is unaudited. `anthonylee1994/qimen`, `ownthink/Qimen`, `Yvainovski/QiMenDunJia` (S29) are smaller hobby-grade implementations.

### 2.3 The hallucination-firewall architecture

Two repos directly demonstrate the architecture we should adopt:

- **`FANzR-arch/Numerologist_skills`** (S8): an explicit "stop the cyber-fortune-teller from hallucinating" framework. Three layers: deterministic Python compute -> rule-driven reference docs -> prompt engineering for inquiry order. Ships an actual `qimen_cli.py`.
- **`MirrorAI-Lab/BaZi-Persona`** (S6, the arxiv 2510.23337 companion repo): rule-based bazi mapper feeding DeepSeek-R1 + Doubao-1.5-Thinking. Celebrity-50 dataset (50 people, 488 QA, 5 life dimensions).

The principle from both: **the LLM never does the math.** Pillar generation, gan-zhi conflict, ten-god placement, qimen 起局 — all deterministic. The LLM only enters at the interpretation/narrative-prose layer.

This matches the Cantian AI commercial product's stance (S26): "general-purpose LLMs hallucinate against the deterministic, intricate rules of bazi; this isn't a flaw, it's a fundamental mismatch between probabilistic generation and rule precision."

## 3. School selection - 子平派 / 盲派 / 新派

The bazi field has three living schools (S14):

- **子平派** (Ziping, traditional). Foundation: 渊海子平, 三命通会. Method: Day Master (日主) relative to other heavenly stems, plus the **Ten Gods** (比肩 劫财 食神 伤官 偏财 正财 偏官/七杀 正官 偏印 正印) representing relational archetypes. **Most algorithmic, most documented, most recipe-able.** This is the right pick for narrative archetype mapping.
- **盲派** (Blind school). Image-driven, transmitted orally through blind practitioners; emphasizes 象 (symbolic images) and dynamic stem-branch combos for event prediction. *Less algorithmic; more interpretive.* Useful for adding flavor variation but not as the primary mapper.
- **新派** (New). Late 20th century. Reduces day-master strength to a numeric score for modernization. Easy to compute but flattens information.

Recommendation: **子平派 as primary**, with **盲派 image-codes** layered on as event-flavor modifiers. **新派 numeric strength** is a useful internal scalar (we don't need to expose it).

For qimen: standardize on **时家奇门 转盘法** to align with the open-source ecosystem (S9, S10). 飞盘 is more accurate per practitioner consensus (S15) but the open-source coverage is thinner; we can add it as an optional precision mode later. School discipline is non-negotiable: **picking one school and sticking with it is more important than picking the "best" school**, because mixing schools breaks reproducibility and breaks the user's mental model.

## 4. Procedural-mysticism design references

Five external systems define the design space:

1. **Cultist Simulator** (S18). The fixed Aspect cycle — Lantern -> Forge -> Edge -> Winter -> Heart -> Grail -> Moth — gives the entire game a metaphysical compass. 7-aspect closed system, every card carries weighted aspect values, rituals collapse aspect mixtures into events. **Closest-in-spirit precedent for bazi-as-prior.** Validates that opacity is a feature, not a bug.

2. **Crusader Kings 3** (S19). 3 personality traits per character + stress accumulation when actions contradict traits + 4-tier mental break + coping-mechanism trait acquisition. Direct map: Day Master + 用神/忌神 = the equivalent prior; "narrative dissonance" accumulates and forces a beat when crossed.

3. **Caves of Qud** (S20). 70+ mutations as character-level priors; world seeded with 5 generated Sultans whose biographies propagate as in-world artifacts. Maps to: bazi seeds the protagonist; 大运 cycles propagate through the timeline as named "ages" in chapter framing.

4. **Disco Elysium** (S21). 24 personified skills as inner voices; thoughts internalize over time and rewire dialogue. Upper bound for bazi-driven inner narrative: each ten-god could literally talk.

5. **Mythic GME / Ironsworn** (S23). Action+Subject and Action+Theme oracles. Direct prototype for `(用神, 临门) -> branch-prompt-fragment` mappings.

Academic precedent: Sullivan's tarot-based narrative generation (S22, FDG 2018) is the methodological grandparent of all of this. PANGeA (S30) generalizes the symbolic-prior + LLM pattern with the Big Five — bazi is the same pattern with a culturally richer, temporally-indexed prior.

## 5. Chinese fiction tooling - the gap

The Chinese web-novel tooling market (S24) — 玄派, 墨星写作, 笔灵, 星月写作 — has saturated **name/realm/technique/item/plot generators** (200+ on 笔灵 alone), but **none ship a bazi/qimen/命格 module**. 番茄作家助手, 起点, 飞卢 author tools focus on operational features (multi-device sync, AI error-correction, scheduled posting) — no metaphysical-consistency layer. Top cultivation novels (凡人修仙传 etc., S25) are praised for "logical self-consistency" but enforce it via author discipline, not algorithmic 命格. **There is a clear product gap.**

## 6. Honesty surface

Three calibration constraints we must respect:

- **Non-falsifiable status acknowledged** (S28). The system will be marketed/described as a *narrative consistency tool*, not divination service. UI must say so.
- **School choice declared** (S14, S16). The user sees: "Bazi: 子平派. Qimen: 时家奇门 转盘法." These are not user-tunable in v1 to preserve internal coherence.
- **Time-system controversies surfaced** (S27). Default to 真太阳时 + 子时-23:00-day-change (mainstream); expose 平太阳时 and 早晚子时 toggle as advanced options. Don't silently pick.

## 7. Architecture for Novel System v2

```
+---------------------------+
| Author/Editor UI          |
|  ('why this branch?'      |
|   reveals symbolic trace) |
+-------------+-------------+
              |
+-------------v-------------+
|  Narrative Branch Scorer  |
|  weight = f(bazi prior,   |
|   qimen局, 大运, 流年,    |
|   story context)          |
+-------------+-------------+
              |
   +----------+----------+
   |                     |
+--v----------+   +------v---------+
| LLM         |   | Symbolic Core  |
| (interp.    |   | (deterministic)|
|  only)      |   |                |
+-------------+   +------+---------+
                         |
        +----------------+----------------+
        |                |                |
   +----v-----+   +------v-----+   +------v------+
   | bazi     |   | qimen      |   | ziwei (opt) |
   | engine   |   | engine     |   | engine      |
   |          |   |            |   |             |
   | lunar-   |   | qfdk/qimen |   | iztro       |
   | js +     |   | (转盘)     |   |             |
   | sxtwl    |   | + custom   |   |             |
   | (truth   |   | rules      |   |             |
   |  oracle) |   |            |   |             |
   +----------+   +------------+   +-------------+
```

Recommended technology stack for bazi/qimen integration in Novel System v2:

- **Bazi engine**: `lunar-javascript` (Node) or `lunar-python` (Python). Validate against `sxtwl_cpp` golden tests for any time pre-1900 or post-2100. School: 子平派. Time defaults: 真太阳时, 子时-23:00 cutoff. Expose 早晚子时 toggle.
- **Qimen engine**: thin custom layer over `lunar-javascript`'s gan-zhi primitives, modeled on `qfdk/qimen`'s file split (bamen / bashen / jiuxing / dipan / sanyi / liuyi). School: 时家奇门 转盘法 拆补法. Output: nine-palace JSON between markers (the dxbuyi/qimen.skill convention).
- **Ziwei (optional, parallel)**: `iztro` for 12-palace life-domain partitioning if/when we add a second symbolic axis.
- **MCP/agent surface**: model the API on `cantian-ai/bazi-mcp` (`getBaziDetail`, `getSolarTimes`, `getChineseCalendar`) plus a `getQimenChart(time, school)` and a `getNarrativeWeights(charId, eventType, time)` that combines them into branch-scoring vectors.
- **Symbolic-to-narrative mapping table**: hand-curated, versioned, *open* — every (Ten God, ShenSha, 八门, 九星, 八神) entry has an event-archetype distribution. Author can override per work.
- **Hallucination firewall**: LLM never computes pillars, never inverts symbols. All math in the deterministic core. LLM operates only on resolved symbol bundles. (Pattern from S8, S10.)
- **Evaluation harness**: clone `MingLi-Bench` (S7); add custom narrative-consistency evals using our authored mapping table as ground truth.
- **Honesty disclosure**: every chart view shows school + time-system + version of mapping table, with a one-line "narrative consistency tool, not divination" note.
- **License posture**: targeted MIT/ISC dependencies (lunar-javascript MIT, iztro MIT, qfdk/qimen MIT, bazi-mcp ISC). All clean for commercial use.

## Recommended technology stack for bazi/qimen integration in Novel System v2
