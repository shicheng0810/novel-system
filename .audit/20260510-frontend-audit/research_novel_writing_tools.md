# Critical Survey: Novel-Writing & Creative-Tool UX References

**Audit context.** Internal audit of a self-built "novel writing + world simulation" web app. Stack: React SPA, six workspaces (chapter generation, scene editing, branch/timeline simulation, world building, story memory, atlas/knowledge view) all rendered inside a single `App.tsx`, no router. Backend orchestrates DeepSeek + a metaphysics/divination module. This document is a critical, source-grounded survey of comparable products to ground our UX recommendations.

**Method.** Web research on May 9–10, 2026, covering (1) AI-native fiction tools, (2) traditional pro novel software, (3) adjacent knowledge-tools, (4) UX-pattern literature. Each finding maps to a numbered source card; the JSON file at `source_cards_novel_writing_tools.json` is the canonical bibliography. Inline citations like `[s12]` reference card IDs.

---

## 1. AI-Native Fiction Tools

### 1.1 Sudowrite

**Stack/positioning.** Web SaaS, closed-source. Targets fiction writers, especially novelists and indie genre authors. Subscription, $10–$59/mo, with a credit-based metering layer on top of the subscription [s14]. Story Bible was launched as the central context store; Canvas was added as a visual brainstorm/relationship surface; Write/Describe/Brainstorm are the three "core actions" [s1, s2].

**Key UX patterns.**
- **Story Bible as structured memory.** Story Bible holds genre, style, synopsis, characters, worldbuilding, outline as named fields, and the AI silently pulls them as context for every generation [s1, s2]. The "elevated story bible" framing positions it as more than free notes — it's a curated context that the model reads.
- **Three primary verbs (Write / Describe / Brainstorm).** The product is organized around a small number of well-named AI verbs surfaced at the cursor, rather than a chat sidebar [s2]. This is significant: it imposes a *grammar* on the AI rather than a generic prompt box.
- **Canvas.** Drag-and-drop card surface for character arcs and plot relationships, with AI-generated suggestions for plot twists and secrets [s2, s27]. Reviewer feedback says Canvas is "valuable for exploration" but can feel "disorganized" and confusing — users have publicly requested it become more of a true mind-map [s27].
- **Inline AI surfacing.** Generation actions are summoned at the selection point. Output appears as an expansion or replacement choice in an inline drawer/menu, not a side chat.

**What works.**
- Strong empty-state guidance via Story Bible's pre-named fields. Users get *what to fill in* rather than a blank notebook.
- Verb-based AI is more discoverable than prompt-engineering. New users don't need to know what to ask.
- Friction-free for shorter projects: most reviews note "smooth and fast" experience and good context retention over moderate-length text [s1].

**What users complain about.**
- **Credit anxiety dominates the criticism.** The system is "deliberately opaque", costs vary by output length and model selection, and heavy users report that editing 4 chapters / 7–18k words can burn 2M credits in hours [s14]. Multiple users on Sudowrite's own feedback board demand an unlimited-credit plan or roll-over [s14]. This is the most repeated complaint across Reddit/Trustpilot/feedback portal.
- **Trustpilot reports glitches:** "writing beats" feature failing while still consuming credits; support reportedly slow to respond [s5].
- **IP/T&C ambiguity** has soured a vocal subset of professional writers [s5].
- **Canvas feels under-baked.** "Sometimes confusing", "feels disorganized" [s27].

**What we should learn.**
- A *named* primary-action grammar (Write / Describe / Brainstorm) is more usable than a generic prompt textarea — adopt this for our chapter-generation workspace.
- Visible AI-cost telemetry is non-optional. If we surface DeepSeek costs, surface them *predictably*, not via "credits."
- Mind-map / canvas features that "feel disorganized" tend to be ones where users can't constrain layout — give branch/timeline a default canonical layout *and* manual override.

### 1.2 Novelcrafter

**Stack/positioning.** Web SaaS, BYOK (Bring Your Own Key) for OpenAI, Anthropic, OpenRouter, etc. Targets serious long-form fiction authors. Fixed monthly fee; AI cost is the user's own provider bill [s3, s28].

**Key UX patterns.**
- **Codex as context-at-a-glance.** Codex is a structured wiki-database (characters, places, lore, objects, factions, family links, evolving states). Unlike Sudowrite's Story Bible, the Codex actively *detects references in your text* and offers click-preview popovers [s3, s28]. When prompting, Novelcrafter auto-pulls referenced entries into the prompt context.
- **Three-panel + scene-card philosophy.** Manuscript on one side, Codex/scene-beats on the other. The "context-at-a-glance" goal — always know where you are and what lore is relevant — is the explicit design tenet [s3].
- **Scene cards with metadata** (POV, location, plotline, beat type), arrangeable in a Plan view and a Matrix view. 2025 changes added a "wide" mode to the Plan and a "slim" Codex style for users with hundreds of entries [s3, s4].

**What works.**
- Linkage automation (auto-detect Codex mentions in prose) drastically reduces context-setup overhead during drafting.
- Granular per-scene context selection: writers can toggle which Codex entries the model should "see" for each scene, addressing the very common AI complaint of "wrong character knowledge bleeding into scenes" [s28].
- BYOK gives experienced users full control of model selection and cost.

**What users complain about.**
- **Setup pain is the #1 complaint.** Reviews consistently call BYOK setup "developer work, not writer work" — non-technical authors must register at an LLM provider, generate keys, paste them into Novelcrafter, then pick a model [s4]. One reviewer abandoned the tool and went back to MS Word [s4].
- **Codex maintenance is "exhausting."** Users describe filling out the Codex with "fluff" and getting "terrible results", indicating the upfront curation cost feels misaligned with output quality [s4].
- **Outline-to-AI gap.** Several users report that detailed outlines/metadata they spent hours on don't actually flow into the model — the website's claims overshoot what the prompt-builder uses [s4].
- **Visual density.** Reviewers describe the UI as "a little dense, like there's just a bit too much going on visually" [s30].
- **Restricted prompt control.** Some power users want raw prompt access ("different scenes need different Codex info") and dislike the curated abstraction [s4].

**What we should learn.**
- **Auto-detection of entity mentions** (we'd call them "story memory" or "atlas" entities) inside the manuscript editor is a high-leverage feature. Building this on top of our existing world/atlas data is a strong win.
- **First-run setup must be invisible or skippable.** If our app ever asks the user for an API key on first open, we lose people. Provide a default "quick-try" path before the BYOK path.
- **Show the user exactly what context the AI received.** Novelcrafter's per-scene context picker is good; even better is a "context inspector" panel that shows the assembled prompt.
- **Watch visual density.** A "Plan view" with too many labels per card will feel cluttered — give density a knob.

### 1.3 NovelAI

**Stack/positioning.** Web SaaS, paid tiers $10/$15/$25/mo. Targets fanfiction, anime/JRPG-flavored fiction, and freeform interactive storytelling. Notable for *transparency* of the model's working memory [s7, s24].

**Key UX patterns.**
- **Lorebook as keyword-triggered memory.** Unlike Sudowrite's always-on Story Bible or Novelcrafter's manual-link Codex, NovelAI's lorebook entries are inserted into context only when their trigger keyword appears in recent text. This is a hybrid of "always on" and "manual select" [s6, s24].
- **Visible context window.** The user can see exactly what the AI "remembers" — the recent text window, currently active lorebook entries, author's note, and memory injections [s24]. This is the strongest *AI transparency* pattern in the survey.
- **Generation controls exposed.** Temperature, repetition penalty, model parameters are visible to the user, not buried in admin [s7].
- **Branching mode for interactive fiction.** A choose-your-own-adventure variant supports branching narratives with multiple paths [s24].

**What works.**
- The **memory transparency** is the standout virtue — power users report it's the only AI fiction tool where they actually understand why the model "forgot" something.
- Granular generation knobs let writers shape voice/style without learning prompt engineering.
- Branching mode is a fully realized feature, not a prototype — multi-path narratives are first-class.

**What users complain about.**
- **Context limit is the #1 complaint** — even Opus-tier 8,192 tokens means about 6–7k words visible, ~2–3 chapters; the rest is invisible unless captured in lorebook [s7].
- **Sudden "character amnesia"** — there is no warning when the context window rolls over, which causes mid-story breakdowns [s7].
- **Manual lorebook correction is constant.** "Manually correcting the narrative flow every few responses" is a common refrain [s7].
- The community is heavily skewed to anime/genre fanfiction, which alienates literary writers.

**What we should learn.**
- **Show the user what the AI saw.** Even a small "context stats" pill (token usage, entries injected, last N words) would put us ahead of every closed-source competitor.
- **Warn before context rollover.** A toast or status pill: "the AI no longer sees scene 1; consider summarizing into Story Memory."
- **Branching/timeline as a first-class mode** — not a preview — is the right ambition for our branch workspace.

### 1.4 ShortlyAI / Jasper

ShortlyAI was acquired by Jasper, and most of its long-form generation was folded into Jasper's "Boss Mode" [s15]. ShortlyAI itself still operates as a standalone with grandfathered subscribers but is in maintenance mode. The lesson here is small: a minimalist single-textarea AI writer (Shortly) lost out commercially to a feature-broad marketing-content tool (Jasper) but is still cited as the cleanest AI writing UI [s15]. Jasper itself is criticized on Trustpilot/G2 for billing practices: continued billing after cancellation, and the inability to use already-paid days after a pause [s15]. This is a *trust* lesson, not a UX lesson, but pricing UX is part of the audit.

### 1.5 Plot Bunni

Open-source, browser-based, IndexedDB-local, BYOK to OpenRouter/LMStudio/Koboldcpp [s16]. Two relevant takeaways: (a) local-first storage is a feature users specifically value ("no accounts needed, work stays private"), and (b) being open-source is itself a UX claim — "you can audit what context we send the AI" is a trust feature.

### 1.6 NovelPad (often grouped with the AI-native tier even though it's lighter on AI)

**Pattern.** Cloud-based, browser SPA, cleaner-than-Scrivener UI [s23]. Notable details: chapters contain scene cards, drag-and-drop reorder with auto-renumber; scene editor pops up inline (half or full screen) so the writer keeps the outline visible; ProWritingAid is embedded for grammar; autosaves every minute; collaboration with editor is realtime [s23].

**Lesson.** "Open scene from card → editor pops up over outline" is a strong middle ground between the binder/editor split (Scrivener) and pure full-screen drafting (Ulysses).

---

## 2. Traditional Pro Novel Software

### 2.1 Scrivener (Literature & Latte)

The reference architecture for novel software: **three-pane = Binder (left) + Editor (center) + Inspector (right)**, with two further organizational projections — Corkboard and Outliner — sitting on top of the same underlying tree [s8, s9].

**Key UX patterns.**
- **Structural pluralism.** The Binder, Corkboard, and Outliner are *three views of the same data*. Reorder in any view, and the change replicates everywhere [s8]. This is the canonical lesson of Scrivener: don't model the artifacts twice.
- **Inspector for metadata.** The Inspector panel holds synopsis, keywords, document notes, references, snapshots — anything that *is about* a document but isn't the prose. The synopsis displayed on a corkboard card is literally the same synopsis edited in the Inspector [s8].
- **Snapshots = manual versioning.** Writers can take named snapshots of any document, view diffs, roll back. (We should examine Scrivener as the gold standard for "draft vs saved" semantics.)

**What users complain about.**
- "Steep learning curve, like a 747 cockpit"; "feels like a patchwork of basic functionality with miscellaneous add-ons"; "no consistent UI between components" [s29].
- **Compile** (export) is the most-hated feature: "bizarre configurations and maddening interface design" [s29].
- Most negative reviews trace to overwhelm rather than functional defect [s29].

**What we should learn.**
- The **same-data, multiple-views** pattern is the gold-standard IA. Our chapter, scene, world-fact, and timeline data should each be addressable from at least two perspectives (e.g., scene from a chapter view and from a timeline view).
- **Inspector must hold metadata, not duplicate prose.** When we reach for a side panel, we should put *facts about* the current item there, not editable copies of it.
- The complaints validate that *visual consistency across panels* is a make-or-break — our 6 workspaces in one App.tsx will inherit Scrivener's anti-pattern unless we enforce a shared shell.

### 2.2 Ulysses

Mac/iOS-only, subscription, distraction-free Markdown library. The whole proposition is "no toolbars, no rulers, no distractions" plus library + filter system + iCloud sync [s10].

**What works.** Typewriter mode, dark mode, full-screen mode are first-class — switching modes is a primary verb, not a hidden preference [s10]. Filters create live folders that auto-update from tag/keyword queries — this is the precursor pattern to many later tools' "smart views."

**What users complain about.** Apple-only; subscription is "expensive over time" (~$150 in 3 years vs Scrivener's one-time $60) [s10]; almost zero document formatting capability — users export to a separate tool to format; learning curve for filters/library is steeper than the marketing implies [s10].

**Lesson.** A *focus mode* must be a first-class verb (one click), not buried in settings. Filters/saved-views over a flat document list is a strong scalable IA.

### 2.3 Plottr

Timeline-centric, $15/mo or $199 lifetime, dedicated outliner with drag-and-drop card timelines and 30+ story-structure templates (Hero's Journey, Three-Act, Save the Cat) [s11].

**What works.** Templates as scaffolding — plottr makes the empty state non-empty by default, which addresses the cold-start problem. Tag-based character organization with photos is highly cited as helpful [s11].

**What users complain about.**
- **No writing surface** — Plottr is plan-only, you must export to Word/Scrivener to write. Writers complain about dual-tool overhead [s11].
- **Performance degrades** past a certain card count; users have to "reduce text in the cards" to keep the timeline responsive [s11].
- **Limited export** options for plot-line images/PDFs are repeatedly requested [s11].

**Lesson.** A timeline / branch view that doesn't *also* let you jump-to-edit-the-scene is half a tool. Our branch workspace should support inline scene editing or a fast jump-to-editor.

### 2.4 NovelPad, Dabble, Campfire, Aeon Timeline, World Anvil (compressed)

- **NovelPad** [s23]: cleanest middle-tier writer; chapters→scene cards; ProWritingAid embedded; autosave to cloud every 60s; realtime editor collab.
- **Dabble** [s25]: Plot Grid (columns = plot lines, rows = scenes/chapters, cells = plot-point cards) is widely cited as the cleanest visual plot tracker for cross-cutting subplots. Reviewers note dropdown menu UX could be simplified [s25].
- **Campfire** [s26]: 17 *modules* (Characters, Maps, Magic, Religions, Languages, …) sold/subscribed individually. Strength: pay only for the modules you need. Weakness: discoverability — "what is each module for" is a constant question on their forums [s26].
- **Aeon Timeline** [s26]: timeline + spreadsheet + mindmap + narrative view (drag timeline events into a non-linear scene sequence). The "narrative view" — non-chronological scene ordering layered on chronological timeline — is the killer feature for branching/parallel-storyline writers.
- **World Anvil** [s31]: wiki-based, template-driven articles with embedded prompts. Strength: prompts inside templates ("describe the climate," "describe daily life") force-fill the empty state. Weakness: overwhelming nav and steep learning curve, hundreds of optional modules [s31].
- **Worldwand** [s32]: explicitly markets a "three-panel workspace" — browse on one side, edit center, inspect (or chat with AI) on the other. Confirms the three-pane pattern is the *default* expected layout for premium writer/GM tools.

---

## 3. Adjacent Knowledge-Hybrid Tools

### 3.1 Obsidian

Local-first markdown vault with bidirectional links, graph view, daily notes, properties (frontmatter) [s12].

**What writers actually do with Obsidian.** The community guides for fiction writers in Obsidian make a recurring point: "Obsidian out of the box is not a writing tool; it's a note-taking engine with no opinion about how you should use it" [s12]. New users link aggressively because the graph view "looks impressive with lots of connections," but **meaningful links should connect entities that have narrative relationships** — otherwise the graph becomes noise [s12].

**Lessons for our atlas/knowledge view.**
- Graph views generate a *huge* "is this useful?" debate. The graph is best as a discovery surface for clusters, not for navigation. Users who try to navigate via graph give up.
- Properties (typed metadata on each note) is what actually pays the dividend — the graph + a property like `type: character` is what enables useful filtered graph views.
- A graph with **no opinion about what is connectable** becomes overwhelming — give the user a curated default (e.g., character-to-scene, scene-to-location, fact-to-source) before opening the freeform graph.

### 3.2 Notion

Database/page hybrid, block-based, infinite nesting [s13, s17].

**What works.** Pages-inside-databases-inside-pages give writers maximum flexibility to model their world.

**What users complain about (loudly).**
- "Overwhelming" is the most-cited word [s13].
- The flexibility itself is the problem: "Notion's power is its weakness — flexibility means you must decide everything, which means decision fatigue" [s13].
- **Performance degrades after 5,000 records**: load times from instant to 3–5 seconds; large embeds/pages are slow [s17].
- **Information architecture must reflect cognitive patterns, not data normalization.** Users build for an imagined future workflow rather than current behavior, and the IA gets brittle [s17].
- **"Add a single block" UX** brings up a long scroll of options (text, media, database…), confusing for new users [s13].

**Lesson.** Infinite generality is a UX cost. Our app already has 6 fixed workspaces — that's a strength, not a weakness. We should *not* try to make every workspace recursively contain every other workspace.

### 3.3 Roam Research / Logseq

Outliner-paradigm (every block is addressable), bidirectional links, daily-notes-as-spine [s18].

**What works for writers.** Block references make it trivial to quote a worldbuilding fact in a scene without copying it — a real "single source of truth" pattern.

**What users complain about.**
- Roam is $15/mo for what Logseq does free [s18]; mobile is web-wrapper, slow [s18].
- Logseq has a *steep* outliner learning curve — many users never reach proficiency [s18]. Performance issues past ~thousands of pages [s18].

**Lesson.** Bidirectional linking between story memory entries and scene prose is the right model — but the outliner-everywhere paradigm is overkill. Use links sparingly and explicitly.

---

## 4. UX Pattern Literature

### 4.1 AI-surfacing patterns

The current consensus across UX-pattern literature [s19, s20, s33]:
- **Inline ghost text** for short, trivial completions (autocomplete a sentence, suggest the next phrase).
- **Side panel** for longer collaborative tasks (chat, plan, brainstorm). Persistent panel that "sees" current screen and offers short actions ("Build this report," "Explain this chart," "Draft an email").
- **Inline action menu** at the cursor/selection for verbs that operate on a span: shorten, expand, rephrase, summarize, translate.
- **Modal** is the worst pattern — interrupts flow.

**For our app.** Chapter/scene generation should default to either inline ghost text (small spans) or an inline span action (paragraph rewrite). A persistent side panel is appropriate for the world-building/memory chat. Modals should be reserved for truly destructive confirmations.

### 4.2 Regenerate / retry / branch

[s35] The best AI text editors implement *branching regenerate*: each retry is a separate version, and the user can cycle back. ChatGPT's left/right arrow on regenerated answers is the canonical pattern. The worst implementation is *overwrite-only* — the previous output is lost, and users feel they're gambling on each retry.

**For our branch/timeline workspace.** This UX *aligns with what we already do conceptually* — branches in a story tree are exactly "regenerate as separate versions." Lean in: every regeneration becomes a branch, and the user navigates them like Git refs.

### 4.3 Autosave + draft vs saved

[s36] The agreed standard: status is shown as either "Saving…" (with spinner) or "Saved" + relative timestamp ("Saved just now," "Saved 1 min ago"). For long-form content where users edit for an hour at a stretch, an explicit "Draft saved 1 min ago" pill builds confidence. *Do not* remove the "Save" button entirely — users panic without one, even if it's a no-op [s36].

### 4.4 Empty states

[s21] Empty states are an onboarding *opportunity*, not a chore. Best practice is "two parts instruction, one part delight": (a) tell the user what action will fill this space, (b) optionally pre-load sample content. Plottr/World Anvil's template prompts are the gold standard [s11, s31].

### 4.5 IA & navigation

[s22] React SPAs that don't use URLs as state effectively destroy the back button and break sharing/deep-linking. The widespread industry advice is: every primary view should be URL-routable with state preserved in URL params, with a router that handles tab switching (React Router nested layouts is the canonical pattern). State per tab should persist when switching away — Spotify's mobile app is the cited reference for "shared component, route per tab" [s22].

### 4.6 Three-pane layouts

[s34] The three-pane pattern (browse | edit | inspect) is so dominant in editor IDEs and writer tools that *any deviation needs a strong justification*. Firefox DevTools, VSCode, Scrivener, Worldwand, and Novelcrafter all use it. The pattern works because it preserves three persistent contexts: where you are, what you're working on, and what's true about it.

---

## 5. Cross-Cutting Pitfalls (What Users Hate)

A summary table of the most-cited gripes across reviews:

| Pitfall | Tools where it appears | Severity |
|---|---|---|
| Credit/cost anxiety, opaque pricing | Sudowrite [s14] | Very high |
| BYOK setup is "developer work" | Novelcrafter [s4] | Very high |
| Sudden context-window rollover with no warning | NovelAI [s7] | Very high |
| Steep learning curve, "747 cockpit" | Scrivener [s29], Notion [s13], Logseq [s18], World Anvil [s31] | High |
| Visual density / overwhelming UI | Novelcrafter [s30], Notion [s13] | High |
| Performance degrades past N items | Plottr [s11], Notion [s17], Logseq [s18] | High |
| No writing surface inside planning tool | Plottr [s11] | High |
| Empty states with no scaffolding | Obsidian [s12] | Medium-high |
| Compile/export is its own torture | Scrivener [s29] | Medium |
| Mobile experience neglected | NovelAI [s24], Roam [s18] | Medium |

---

## 6. Synthesis: 5 IA Principles for Our App

1. **Same-data, multiple-projections (the Scrivener lesson).** Chapters, scenes, characters, world facts, and timeline events should each be a *single source of truth* presented through different projections (binder list, corkboard cards, timeline lanes, atlas graph). Editing in one projection updates all. This is non-negotiable.

2. **Three-pane shell with workspace-specific center pane.** Browse (left) | work (center) | inspect (right). The browse and inspect panes are *shared* across the 6 workspaces; only the center pane changes between chapter/scene/branch/world/memory/atlas. This solves Scrivener's "patchwork" complaint at the architectural level.

3. **URL-routable state on every primary view.** Each workspace is a route; the active scene/chapter is a URL parameter. Back button works. Deep links shareable. This *also* unlocks the "I broke something — go back" recovery loop that long-form writers rely on.

4. **Show the AI's working memory.** A small persistent "context inspector" pill (token usage, currently injected memory entries, last N words seen) puts us ahead of every closed-source competitor. NovelAI is the only competitor that does this and they're loved for it.

5. **Verbs over prompts.** A small set of named, well-shaped AI verbs (Generate scene, Continue, Rewrite for tone, Summarize into memory, Suggest branch, Cross-check fact) is more learnable than a chat textarea. This is Sudowrite's primary advantage and we should adopt the structure.

## 7. Synthesis: 5 Anti-Patterns to Avoid

1. **Don't ask for an API key on first run.** Novelcrafter loses people here [s4]. Provide a default "quick try" path with a sample world, and let BYOK be opt-in for power users.

2. **Don't bury "I'm planning vs drafting vs editing" mode in a settings menu.** Make mode a first-class verb (think Ulysses' typewriter/dark/focus modes [s10] or Claude Code's plan/normal modes). A clearly-labeled mode pill at the top of the editor is enough.

3. **Don't use modals for AI output.** Inline action menu or side panel only. Modals interrupt creative flow — every UX-pattern article in our survey is unanimous on this [s19, s20, s33].

4. **Don't make regenerate destructive.** Each retry = a branch the user can cycle back to. Overwrite-only retry is universally hated [s35]. Our branch/timeline workspace should be the canonical home for retries.

5. **Don't let the empty state be empty.** Every workspace's first-open should have either (a) a one-line prompt with a sample-data button, or (b) a sample world pre-seeded that the user can wipe with one click. Plottr and World Anvil are the gold standard here [s11, s31]. Silent empty grids are the #1 abandonment point cited across reviews [s21].

---

## 8. App-Specific Recommendations (Bridging Survey to Audit)

Direct mapping from findings to our 6 workspaces:

- **Chapter generation.** Adopt verb-based AI (Generate / Continue / Rewrite) at the cursor; show context inspector pill; make every regeneration a branch (not an overwrite). [Refs: s2 Sudowrite, s24 NovelAI, s35 regenerate pattern]
- **Scene editing.** Three-pane shell: scene list (left) | rich-text editor (center) | scene Inspector (right) with synopsis, POV, location, linked Codex entries. Auto-detect mentions of world entities. [Refs: s3 Novelcrafter, s8 Scrivener]
- **Branch/timeline simulation.** Timeline lanes with drag-and-drop scene cards (Plottr-style); "narrative view" projection (Aeon Timeline-style) showing non-chronological reading order; every AI regeneration creates a visible branch on the tree. [Refs: s11 Plottr, s26 Aeon, s35 regenerate]
- **World building.** Template-driven articles with embedded prompts ("describe the climate," "describe the economy," "describe the magic"), à la World Anvil, plus auto-detected references from prose. Avoid the "infinite database" Notion trap. [Refs: s28, s31, s17]
- **Story memory.** Hybrid Lorebook+Codex: keyword-triggered auto-injection (NovelAI pattern) plus per-scene manual context selection (Novelcrafter pattern). Surface the "what the AI sees" inspector. [Refs: s6, s28, s24]
- **Atlas / knowledge view.** Default to a *typed* graph filtered to narrative relationships (character↔scene, fact↔source, scene↔location), not Obsidian's freeform graph. Provide saved views, not just a god-graph. [Ref: s12]

Across all six: the App.tsx monolith *must* be split into a router-driven shell. Every workspace becomes a route; tabs preserve state; the back button works. This is the single most impactful change.

---

## Appendix: Word count

This document is approximately 3,100 words. Source cards are in `source_cards_novel_writing_tools.json`.
