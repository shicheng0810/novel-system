# IA & Interaction-Design Research: Patterns from the Best Multi-Pane Creative / IDE Web Apps (2024–2026)

Compiled: 2026-05-09. Companion to `source_cards_ia_patterns.json`.
Frame: a self-built fiction-writing + world-simulation web app currently presents 6 sibling workspaces (Writing, Simulation, Runtime, World, Memory, Atlas) inside one 1659-line React component, switched by conditional rendering with no URL state. Users report it as cluttered and confusing.

---

## 1. Reference apps, dissected

### 1.1 Linear (project mgmt; gold-standard "calmer SaaS")
Linear's 2024 refresh ([linear-redesign-2024]) treated the chrome as scenery, not as content. The sidebar was *dimmed* (not removed), tabs were narrowed and rounded instead of stretching the viewport, and a separate "view header" line was added so filter/display controls live below tabs but above content — preventing the over-stuffed top bar pattern that our app currently shows. The 2025 refresh ([linear-saas-trend-logrocket]) further pushed the palette toward monochrome, reserving saturated colors for *state* (overdue, blocked, active) rather than for chrome decoration.

Linear's conceptual model ([linear-conceptual-model]) is the more important lesson for us: a Linear *workspace* is a single container, and what we'd think of as different "apps" — backlog, board, timeline — are dynamic *views* over one underlying graph of issues. This is the structural insight we should steal: World, Memory, and Atlas in our app are all views over the same entity graph (characters, places, factions, lore). They should not be three sibling workspaces, they should be three views.

Finally, ([linear-design-for-ai-age]) explicitly argues against pinning AI chrome; AI in Linear is summoned through the command palette or inline, not docked in a permanent right rail.

### 1.2 VS Code (the canonical IDE workbench)
VS Code's six regions ([vscode-userinterface]) — Activity Bar, Primary Side Bar, Editor Group(s), Panel, Secondary Side Bar, Status Bar — give us the field-tested decomposition: *verbs* (Activity Bar = mode switch) + *nouns* (Side Bar views = entities) + *content* (Editor) + *transient output* (Panel). Critically, the Activity Bar is just a switch into the same workbench layout, not a teleport into a different app. ([vscode-custom-layout]) shows that views are draggable between Primary, Secondary, and Panel regions, and the layout is persisted. Our 6 workspaces should map onto Activity Bar entries, not into 6 separate top-level shells.

The Primary/Secondary sidebar split ([vscode-sidebars-uxguide]) gives us asymmetric two-rail layout: structure on one side, context on the other.

### 1.3 Cursor + Claude Code (AI in the IDE)
Cursor inherits VS Code's three-pane geometry, with AI chat docked right ([cursor-flexible-panel]). The interesting datum is the *complaint pattern*: heavily-upvoted feature requests ([cursor-ai-panel-position]) ask for the AI panel to be movable or dockable left/bottom. Even on a beloved AI-IDE, a fixed right-side AI rail feels constraining. Lesson for us: any persistent AI surface (Simulation runtime status, Memory chat) must be dockable and dismissible.

Claude Code's reactive loop pattern (orchestrator + workers, deferred tools, transient panels for forks) is a useful mental model for our Simulation workspace: Simulation is a long-running process whose output is ephemeral and best surfaced in a *bottom panel* (transient) rather than a sibling workspace.

### 1.4 Notion (sidebar + pages)
Notion's sidebar redesign ([notion-sidebar-redesign]) split the rail into Workspace / Teamspaces / Private — a hierarchical container model that nests pages indefinitely. The breakdown analysis ([notion-sidebar-medium]) gives concrete numbers: 224px width, 8px grid, accordion drill-down. The right side carries an in-page outline ("table of contents") that doubles as section navigation.

The deeper Notion lesson ([notion-design-critique]) is *progressive disclosure inside the document*: slash commands, toggle headings, block menus. Most of Notion's surface area lives behind `/`, not in chrome. This maps perfectly to our problem: Simulation/World/Memory features should be invokable from inside the Writing canvas via `/` and `⌘K`, not require leaving the canvas.

### 1.5 Obsidian, Roam, Logseq (PKM with graph view)
All three converged on left-rail-vault + center-pane + right-rail-references ([thesweetsetup-pkm]). Obsidian distinguishes *global graph* (whole vault) from *local graph* (current note's neighborhood) ([obsidian-graph]), with the local graph dockable into the right sidebar ([obsidian-local-graph-sidebar]). This is the precedent our Atlas workspace should follow: a global atlas is rarely useful while writing; a *local* atlas of entities mentioned in the current scene is what authors actually consult.

Logseq's right sidebar ([logseq-right-sidebar]) stacks multiple panes vertically — an explicit answer to "but I have several context types I want visible at once": don't make them sibling workspaces, stack them in one rail.

### 1.6 Figma (canvas tool with structure-left, inspector-right)
Figma's canon ([figma-left-sidebar], [figma-right-sidebar]): left = structure (pages, layers); right = contextual properties (Design / Prototype / Inspect). The right panel *swaps content based on selection* and the right panel auto-collapses when nothing is selected. The repeated user request ([figma-hide-right]) to *fully* hide the right panel proves: even Figma's audience demands focus mode.

### 1.7 Sudowrite (Canvas) + Novelcrafter (Codex)
Two camps in fiction tooling ([sudowrite-canvas]):
- Sudowrite Canvas: distraction-free editor + on-demand AI summoning + a separate canvas board surface. Discovery-writer aesthetic.
- Novelcrafter ([novelcrafter-home]): IDE-density, manuscript center + Codex (entities) right + structure left. Plotter aesthetic.

Both are coherent. Our app currently looks like Novelcrafter without the discipline (we ship the panels but don't tie them to the manuscript). We should pick a stance.

### 1.8 Scrivener / iA Writer / Ulysses (focus tools)
Scrivener Composition Mode ([scrivener-composition]) hides chrome entirely; only a thin Control Bar appears on cursor proximity. Typewriter Scrolling ([scrivener-typewriter]) pins the active line vertically centered. Ulysses ([ulysses-vs-scrivener]) keeps these as composable toggles rather than one monolithic mode (dark mode, minimal mode, full-screen mode, typewriter mode all independent). iA Writer's 100E2R standard ([ia-feed-100e2r]) — "Web design is 95% typography" — argues that for a writing tool, typography settings *are* the product.

---

## 2. Specific IA decisions

### Tabs vs. workspaces vs. pages — what wins for our 6 modes?
Tabs win when items are mutually exclusive, parallel, equal-weight, and limited to ~5–7 ([nngroup-tabs-used-right], [logrocket-tabs-ux]). Our six "workspaces" fail almost every criterion: Writing is the primary surface, the others are supportive context. Pages-in-a-tree (Notion) win when items are nested and varied. Workspaces (Linear) win when items are different *containers* (different products of work). Our six are not different products — they're different *views and tools* over the same novel.

The right model is: **one workspace, six views, mounted in different regions of a stable workbench**. Writing is the canvas; World+Memory+Atlas merge into a Codex-like right rail; Simulation+Runtime merge into a transient bottom panel.

### Command palette (⌘K) — table-stakes?
Yes ([command-palette-philip], [commandpalette-org]). Linear, Figma, Notion, Vercel, Raycast, VS Code all use it. Best practice: fuzzy-search, scoped commands ("World/Add character…"), recents at top, and full keyboard operability. NN/G heuristic 6 ([nngroup-10-heuristics]) — Recognition over Recall — is satisfied because the palette *shows* options instead of forcing recall, while still being faster than mouse navigation for power users (heuristic 7, Flexibility and Efficiency of Use).

### Inspector pattern — when does it help vs. become overload?
Helpful when (Figma model): content is *contextual to current selection*, panel auto-collapses on empty selection, and panel is hideable for focus. Cognitive overload sets in when the inspector is permanently rendering all properties regardless of focus, or when it's a "database wall" of raw JSON.

### Focus / distraction modes
Composable toggles win over one big "Zen mode": dark mode, sidebar collapse, typewriter scrolling, hide-non-prose, and full-screen should each be its own toggle and shortcut.

### Empty states that *teach* the product
Best examples ([smashing-empty-states], [useronboard-empty-states]) blend: (a) plain-language explanation of what this surface is for, (b) one primary CTA, (c) optional illustration. Notion's "Let's create your first page" is the canonical model. Our six surfaces need bespoke empty states each, not a generic "No data".

### Density — comfortable vs. cozy vs. compact for long-form writing
For reading/writing surfaces: comfortable density is the default ([cloudscape-density]). Compact is appropriate for tabular surfaces (Atlas entity tables, Memory event log). Provide a user toggle ([sap-fiori-density]) — never auto-pick.

---

## 3. Heuristics & frameworks

NN/G's 10 heuristics ([nngroup-10-heuristics]; updated Jan 2024) are the operating system. The most load-bearing for us:

- **#6 Recognition rather than recall**: command palette and visible left-rail labels reduce memory burden; switching by remembering "Press 4 for Memory" violates this.
- **#8 Aesthetic and minimalist design**: every chrome element competes with prose. A 1659-line shell of conditional rendering almost certainly accumulated chrome we never audited.
- **#9 Help users recognize, diagnose, and recover from errors**: simulation/runtime errors must be plain language, not raw JSON.

Progressive disclosure ([nngroup-progressive-disclosure]) is the formal pattern that lets us collapse 6 workspaces into a 3-region workbench without losing functionality: 30–50% faster initial task completion, 70–90% feature discoverability preserved.

Information scent (Pirolli/Card; [nngroup-information-foraging], [uxtigers-information-scent]): label specificity reduces nav time 30–50%. Generic labels ("World", "Memory", "Atlas") have weak scent; labels like "Codex (characters/places)", "Story Memory", "World Map" have stronger scent. Even better: collapse the three into one rail labeled "Codex" with internal sections.

First-impression studies ([nngroup-scrolling-attention]): users form judgment in <0.05s; 57% of viewing time is above the fold. Whatever we put in the first viewport of the Writing surface IS the product perception.

Feature-creep literature ([feature-creep-wikipedia], [userjot-feature-creep]): solo-built personal tools accrete top-level nav. The cure is hierarchy + opt-in submenus, not a 7th sibling.

---

## 4. Anti-patterns (with our app's likely fit)

- **"Christmas tree" UI** — every element competing for attention. Likely fit: medium-high if our 6-workspace top bar plus inline AI prompts plus runtime logs all glow simultaneously. Sources: ([logrocket-ai-overuse], [nngroup-10-heuristics #8]).
- **"Database wall"** — dumping JSON / raw schemas to the user instead of formatted views. Likely fit: high for World/Memory/Atlas if those panels show entity records as nested key/value rather than as cards. Sources: ([nngroup-10-heuristics #9], [feature-creep-wikipedia]).
- **"Tab vomit"** — many tabs, no priority. Likely fit: 6 sibling workspaces is a soft form. Sources: ([logrocket-tabs-ux], [nngroup-tabs-used-right]).
- **"AI everywhere"** — persistent AI chrome in every region. Likely fit: high if Simulation + Runtime + AI suggestions are all always-visible. Sources: ([logrocket-ai-overuse], [uxtigers-ai-agents], [ideatheorem-ai-patterns]).
- **"State amnesia"** — refresh / share-link bounces user to default workspace because state isn't in the URL. Confirmed fit: app uses conditional rendering with no URL state. Sources: ([alfy-url-state], [logrocket-url-params]).
- **"Generic-label fog"** — labels too abstract to predict content. Likely fit: high (World/Memory/Atlas). Sources: ([nngroup-information-foraging], [uxtigers-information-scent]).
- **"Monolith shell"** — one giant component owning all states. Confirmed fit: 1659-line root component. Sources: ([feature-creep-wikipedia], [vscode-userinterface]).

---

## 5. Density & typography for long-form writing (with CJK / Bagua emphasis)

The Bagua (八卦) framing makes this app's prose surface CJK-primary. CJK readability rules differ from Latin:

- **Line height**: Latin prose is comfortable at 1.4–1.5; CJK needs ~1.7 because Han characters fill the em-box and need stroke breathing room ([typotheque-cjk]).
- **Line length**: Latin 45–90 chars (Butterick: [butterick-line-length]); CJK ~40 chars per line. 80 Chinese characters per line is "too dense and exhausting" ([asianabsolute-cjk]). WCAG enforces this asymmetry. We should express the prose column max-width in CJK character units (~36–40ch CJK) and expect wider Latin columns when ASCII passages appear.
- **Font stack**: differentiate prose body (serif: Source Han Serif / Noto Serif CJK SC) from UI chrome (sans: PingFang / Source Han Sans / Misans) ([az-loc-chinese-fonts]). System defaults are forbidden ([butterick-summary]).
- **Body size**: 16–20px for prose, per 100E2R ([ia-feed-100e2r], [butterick-summary]).
- **Density toggle**: writing surface = comfortable; entity tables in Atlas/Memory = compact ([cloudscape-density], [sap-fiori-density]).
- **UI density definition** ([stromawn-ui-density]): density is information per unit of *attention*, not pixels. Our "cluttered" complaint is high attentional density, not cramped layout — the fix is hierarchy and color suppression (Linear-style monochrome chrome), not whitespace inflation.

---

## 6. Reading flow & focus tools

Composition Mode ([scrivener-composition]) and Typewriter Scrolling ([scrivener-typewriter]) are the load-bearing single features. Ulysses-style composable toggles ([ulysses-vs-scrivener]) beat one monolithic Zen mode. Our app should ship: (1) Hide chrome (`Cmd+Shift+H`), (2) Typewriter scroll toggle, (3) Hide right rail (`Cmd+\\`), (4) Hide left rail (`Cmd+Shift+\\`), (5) Full screen (`F11`). All composable, none required.

---

## 7. Concrete deliverables

### 7.1 Ten "IA gold-standard" examples we should steal patterns from

1. **Linear** — dimmed sidebar + view header below tabs + monochrome chrome ([linear-redesign-2024]). Steal: separate "view header" row; reduce sidebar visual weight.
2. **VS Code** — Activity Bar + Primary Side Bar + Editor + Panel + Secondary Side Bar + Status Bar ([vscode-userinterface]). Steal: six-region workbench with one global Activity Bar instead of six top-level workspaces.
3. **Notion** — 224px sidebar, 8px grid, accordion drill-down, in-page TOC on right ([notion-sidebar-medium]). Steal: hierarchical project>book>chapter>scene tree; in-doc outline.
4. **Notion slash commands** ([notion-design-critique]). Steal: invoke Simulation/World/Memory features inline via `/` from the canvas.
5. **Obsidian local graph in sidebar** ([obsidian-local-graph-sidebar]). Steal: local Atlas (entities in current scene) docked right.
6. **Figma right inspector that swaps on selection and auto-collapses on empty** ([figma-right-sidebar]). Steal: Codex panel that responds to cursor context, hides when nothing is selected.
7. **Cursor's mistake** — fixed right-only AI panel, persistent user complaints ([cursor-ai-panel-position]). Steal-by-not-stealing: make AI panels dockable.
8. **Linear command palette + design-for-AI-age** ([linear-design-for-ai-age], [command-palette-philip]). Steal: AI summoned via palette, not pinned chrome.
9. **Scrivener Composition Mode + Typewriter Scrolling** ([scrivener-composition], [scrivener-typewriter]). Steal: one-keystroke writing focus; pinned active line.
10. **Novelcrafter Codex pattern** ([novelcrafter-home]). Steal: structure-left + manuscript-center + codex-right as the canonical fiction-with-worldbuilding layout.

### 7.2 Seven IA anti-patterns (with our app's likely fit)
Listed above in §4.

### 7.3 ASCII layout sketches

**(a) Writing workspace, redesigned**

```
+--+----------------------+----------------------------------------+--------------------+
|A | Project tree         | View header (chapter title • status) ⌘K|  Codex (right rail)|
|c | > Book 1             | + filters + density toggle             |  ┌──────────────┐  |
|t |   v Chapter 3        |----------------------------------------|  │ Selection-   │  |
|i |     • Scene 1 ●      |                                        |  │ aware:        │  |
|v |     • Scene 2        |   Prose canvas (CJK ~40ch, 1.7lh)      |  │ char/place/   │  |
|i |     • Scene 3 (open) |   Typewriter scroll (toggle)           |  │ event card    │  |
|t |   > Chapter 4        |                                        |  └──────────────┘  |
|y | > Book 2             |                                        |  ┌──────────────┐  |
|  | --- Codex            |   Inline /-commands summon              |  │ Local atlas  │  |
|B | --- Memory           |   Simulation, AI suggest, lookups      |  │ (graph of    │  |
|a | --- Atlas            |                                        |  │ scene ents)  │  |
|r | --- Simulation       |                                        |  └──────────────┘  |
|  |                      |                                        |  (each pane is     |
|  | (left rail = pages)  |                                        |   collapsible/     |
|  |                      |                                        |   movable; rail    |
|  |                      |                                        |   hides w/ ⌘\)     |
+--+----------------------+----------------------------------------+--------------------+
| Status: word count 2,341 • last sim run 2m ago • Cmd+K to search • errors 0           |
+---------------------------------------------------------------------------------------+

Activity Bar (left edge): [Write] [Codex] [Memory] [Atlas] [Sim] [Settings]
                          (mode switch — same workbench, different default panes loaded)
```

Notes: the Activity Bar replaces the 6 top-level workspaces. The same workbench template is used for every mode; switching mode just changes which views are mounted in the rails by default. URL is `/book/:bookId/scene/:sceneId?mode=write&right=codex,atlas`.

**(b) World + Memory + Atlas merged knowledge view**

```
+--+----------------------+----------------------------------+----------------------+
|A | Codex tree           | Selected entity: 林清 (Lin Qing) | Linked references     |
|c | v Characters         |  ────────────────────────────── |  ┌──────────────────┐ |
|t |   • 林清 ●            |  [Identity card]                 |  │ Mentions in:      │ |
|i |   • 张守一            |   tags • aliases • relations     |  │ • Ch3/S2  (open)  │ |
|v |   • + new            |   ┌────────────────────────────┐ |  │ • Ch7/S1          │ |
|i | > Places             |   │ Local atlas around 林清    │ |  │ • Ch7/S5          │ |
|t |   • 雪山              |   │   (force-directed graph)   │ |  └──────────────────┘ |
|y | > Factions           |   │   nodes = entities         │ |  ┌──────────────────┐ |
|  | > Lore               |   │   edges = relations        │ |  │ Memory events     │ |
|B | > Timeline (Memory)  |   └────────────────────────────┘ |  │ involving 林清    │ |
|a |                      |                                  |  │ • [event log,     │ |
|r | Filters:             | Notes (free-text under entity)   |  │   compact dens.]  │ |
|  |  • all   • mine      |  ────────────────────────────── |  └──────────────────┘ |
|  |  • by chapter        | Cmd+K: jump to character / place | (right rail same as   |
|  |                      |                                  |  Writing — consistent) |
+--+----------------------+----------------------------------+----------------------+
| Status: 142 entities • 38 events • last sync 1m ago                                 |
+------------------------------------------------------------------------------------+
```

The merged view replaces three workspaces with one, switched via the Activity Bar but using the *same* three-region template as Writing: structure-left, content-center, references-right. World/Memory/Atlas become tabs *within* this view (or stacked panes), not sibling workspaces. URL: `/codex/character/:id`, `/codex/place/:id`, `/timeline?range=…`.

### 7.4 Five priority refactor moves (with concrete justification per source)

1. **Replace 6 top-level workspaces with one workbench + Activity Bar** ([vscode-userinterface], [linear-conceptual-model], [nngroup-tabs-used-right]).
   Why: 6 sibling tabs of unequal weight violate tab-design rules; one workbench with view-mounting matches the Linear/VS Code/Notion convergent pattern. Concretely: extract Writing as primary surface; mount Codex (was World+Memory+Atlas) as right-rail views; mount Simulation as bottom panel.

2. **Put state in the URL — every workspace, scene, panel, and density toggle** ([alfy-url-state], [logrocket-url-params]).
   Why: refresh-amnesia and broken share-links are a fundamental web-contract violation. Use React Router with nested routes; encode `mode`, `bookId`, `sceneId`, and rail visibility in the URL.

3. **Ship a `⌘K` command palette** ([command-palette-philip], [linear-design-for-ai-age], [nngroup-10-heuristics #6]).
   Why: it satisfies recognition-over-recall, gives power users keyboard-only operation (heuristic #7), and is the natural home for "summon Simulation", "add character", "jump to scene". Replaces a chunk of the chrome budget.

4. **Adopt CJK-correct typography on the prose surface** ([typotheque-cjk], [asianabsolute-cjk], [butterick-line-length], [ia-feed-100e2r], [az-loc-chinese-fonts]).
   Why: Bagua/CJK prose readability requires 1.7 line-height, ~40 CJK chars/line max, serif body / sans chrome distinction, and ≥16px body. Currently the same chrome font likely runs through prose, hurting reading at length.

5. **Move Simulation/Runtime AI from "always-visible workspace" to "summon-on-demand"** ([logrocket-ai-overuse], [uxtigers-ai-agents], [ideatheorem-ai-patterns], [cursor-ai-panel-position], [linear-design-for-ai-age]).
   Why: persistent AI chrome causes fatigue and chrome competition; modern AI design favors palette + inline + dockable transient panels. Concretely: Simulation becomes a bottom panel (transient logs + run controls), AI suggestions become inline ghost-text + `/`-commands, Runtime status compresses to a Status Bar indicator with a click-to-expand drawer.

---

## Appendix: how the 6 collapse

| Old top-level | New home | Pattern source |
|---|---|---|
| Writing | Center canvas (primary surface) | VS Code editor; Scrivener composition |
| World | Codex right rail (Characters/Places/Factions/Lore tabs) | Novelcrafter Codex; Figma right inspector |
| Memory | Codex right rail → Timeline tab; also bottom-panel "Story Memory log" | Logseq stacked right rail; Obsidian local graph |
| Atlas | Codex right rail → Atlas tab (local graph by default, global as expand) | Obsidian local vs global graph |
| Simulation | Bottom panel (transient run/logs) + ⌘K commands | VS Code Panel region; Linear command palette |
| Runtime | Status Bar indicator + click-expand drawer | VS Code Status Bar |

Result: one workbench, one URL scheme, one keyboard model, three persistent regions. Six modes survive as Activity Bar entries that change which views are mounted by default — they are no longer six separate apps.
