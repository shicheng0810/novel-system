# Frontend Deep UX Audit — Novel System Workbench

**Scope**: `/Users/chris0810/Documents/Codex/Novel System/workbench/src/`
**Date**: 2026-05-10
**Method**: line-level read of `App.tsx` (1659 lines), `styles.css` (647 lines), `contracts.ts`
**Agent**: Explore (read-only)

---

## 1. Information Architecture

### Topbar (App.tsx:1605–1620)
Five low-contrast metadata pills in a horizontal flex row: provider name, DeepSeek model status, active historical line ID, stage count, draft application status. "AI 设置" button right-edge. **Dense, jargon-heavy** — first-time users have no anchor for "活动历史线" or "草案已应用".

### Rail / Left Navigation (1623–1638)
Six workspace buttons in a fixed 112 px column. Label + small gray helper text (truncates on smaller displays). No icons, no color coding — only typography differentiation. Users cannot infer "Runtime" vs "Simulation" vs "World" purpose before clicking.

### Inspector / Right Panel (1653–1655, 1344–1452)
340 px context-sensitive sidebar. In writing: hardFacts + forbiddenMoves. In simulation: current line + AI reasoning + promotion history. In memory: raw JSON of selected entry. **The same panel toggles into "AI settings" form**, replacing context entirely — modal-in-place behavior.

### Data Duplication
- **Historical lines**: switcher in writing workspace (line 670) AND "跟拍" buttons in simulation (line 1018)
- **Stage list**: dropdown in writing (701) and full timeline in simulation (988–1030)
- **Branch evaluations**: latest branch in context-band (655) and detailed table in simulation (1008–1027)
- **AI settings**: locked state form (1563–1576) and inspector toggle (1454–1561)

### First Impression
Cold start: "正在载入作者 Studio…" centered text (no spinner, no progress). After load:
1. Topbar with confusing metadata
2. Six rail buttons (under-labeled)
3. Writing workspace by default, pre-populated with: context-band (3 cols), history line buttons, lens form (8 fields), chapter card with 3-col summary, scene strip, scene reader, rewrite panel + critic panel

**~80 lines of content on a 1280×720 screen, no onboarding, no tooltips.** The "生成章节" button is the only obvious affordance.

---

## 2. Form Ergonomics

### Lens Form — writing workspace (689–765)
- 8 fields, 2-col layout: focusCharacterIds, stageId, chapterGoal, sceneCount, targetMin/Max, factConstraint
- **Zero validation feedback** — empty allowed, no inline errors
- All fields have defaults; none marked required
- Disabled state only on "重新复核" (641)

### Rewrite / Finalization (824–850)
- 1 textarea + 3 buttons (assemble, rewrite scene, confirm final)
- Disabled when `!selectedScene` or `pendingAction !== null`
- No progress inside form; only outside-form status banner (1643)

### Stage Input — simulation (881–953)
- 4 main fields + collapsible "奇门覆写" with 4 nested fields + checkbox
- Hidden details default → average user won't discover them
- No help text on Qimen-pattern / locationFocus (esoteric domain terms)

### World Workspace (1147–1221)
- One large textarea (620 px min-height) for Markdown
- No syntax highlight, no line numbers, no autosave
- Buttons: Preview, Apply (destructive), Reset

### Memory & Atlas (1226–1342)
- Memory: 4-column list (facts/expressions/foreshadows/revisions) → JSON preview right
- Atlas: file tree → raw Markdown in `<pre>`
- No search, no filter, no pagination
- Raw JSON for non-technical users in memory view

---

## 3. Loading / Error States

- **Startup**: centered text only, no spinner (1578–1579)
- **Action-pending**: opacity-disabled buttons + status banner "处理中：{action}" (1643)
- **No skeleton screens**, everything grays out
- **Error banner**: red border at top of main-stage (1642). **Disappears off-screen if user is scrolled down in scene reader.**
- **Runtime polling** (295–306): every 1200 ms, only when `runtimeDaemon.active`. **Polling is invisible to users on writing workspace** — they discover finished stages by chance.

---

## 4. Visual Density & Typography

### Density
Writing workspace initial load on 1280×720 ≈ **60+ lines content without scroll**:
- Header + copy (~4)
- Action group (~1)
- Context-band 3 cols (~3)
- History line switcher (~3-5 wrapped)
- Lens form 8 fields, 2-col (~10)
- Chapter card 3-col summary (~4)
- Scene strip + scene reader (≥8)
- Rewrite + critic

### Typography (styles.css 268–476)
- h1: clamp(1.7rem, 3vw, 2.6rem)
- h2: 1.05 rem fixed
- labels: 0.92 rem
- small text: 0.85–0.9 rem
- line-height: 1.7 / 1.55 / 1.95 (mixed)

**Issues:**
- All h2 same size; hierarchy via color/weight only
- Eyebrow caps at 11 px (tiny)
- `<pre>` uses serif clashing with body serif

### Color (styles.css 1–25)
Paper/cream palette + ember/bronze/mint accents.
- Ink on paper: ~16:1 (excellent)
- Ember on paper: ~8:1 (good)
- **No high-contrast mode**, can feel muddy on glare/cheap monitors

### Responsive
- Single breakpoint @ 1380 px → inspector hides, rail collapses to 96 px
- **No mobile/tablet breakpoints**
- No horizontal-scroll guards on long titles

---

## 5. Interaction Patterns

### Multi-step flows (>3 sequential)
1. **Compose chapter**: lens form → 生成章节 → wait → review → 重新复核 → 生成完整章节 → 确认终稿 — 4 sequential ops, no back/undo
2. **Switch line**: discoverable in 2 places (writing + simulation), entire session refreshes
3. **Promote branch**: simulate → find row → 扶正 → confirm. Unclear if previous canon archived
4. **World draft apply**: edit → preview → apply (destructive, clears writing+simulation context, no undo)

### Horizontal-scroll risk
- Branch table 4 cols (998–1027) on <1000 px
- Long chapter titles overflow without `word-break`

### State loss on tab switch
- Memory/Atlas re-fetch each switch (287–293), `selectedMemory` not persisted
- Simulation auto-run state frozen on screen, doesn't pause/resume

---

## 6. Workspace-Level Findings

### Writing (625–856) — most-used, least hostile
**Cluttered:**
- 3 places for narrative content (scene strip, scene reader, full chapter reader) — unclear hierarchy
- Critic panel un-truncated — 10 issues push fold down
- "焦点角色" expects CSV but label doesn't say so
- Mixed terminology: "5 beat" vs "N 场景"

**Works:**
- Sensible defaults (focusCharacterIds=["苏雪"], 5 scenes, 2800–3300 words)
- Scene reader min-height = no jarring layout
- Critic panel adjacent to rewrite controls
- Disabled-state prevention

### Simulation (857–1034) — powerful but expert-only
- Branch scores numeric (e.g., 8.3) with no legend — is 8.3 good?
- "推荐分叉" badge unexplained
- Qimen details collapsed by default — average user won't find
- Long timelines unbounded; no pagination

### Memory & Atlas (1226–1342) — feels unfinished
- Raw JSON preview (not formatted for non-tech)
- No search/filter
- File tree mixes `<span>` (dirs) and `<button>` (files) without clear visual distinction
- Scroll-within-scroll on large files (520 px max-height)

---

## 7. Three Worst UX Moments

### #1 — Apply World Draft is destructively silent (handleApplyWorld, 593)
Confirm modal warns "应用后会重建当前会话，并清空现有推演与写作上下文". **No undo. No "restore previous". No diff preview.** One typo = re-edit entire 2000-char Markdown. `draftApplied` (204) is informational only.

### #2 — Background runtime invisible to non-runtime users (295–306)
Polls `/runtimeStatus` every 1200 ms when active. Writing-workspace user has no way to know background simulation is running. Finished stages appear without notification — surprise UX.

### #3 — Errors hide due to scroll (1642 banner placement)
Error banner at top of main-stage. Status banner ("处理中") next to it. **If user scrolled down in scene reader, error appears off-screen.** Status clears, error fires silently — user thinks action succeeded → retries, accumulating failed API calls.

---

## 8. Five Things That Work Well

1. **Workspace switching is fast** — single click rail, no confirm modal (1623–1650)
2. **Form defaults eliminate cold-start friction** — click 生成章节 immediately (178–186)
3. **Field labels use familiar literary terminology** in Chinese (690–765)
4. **Context-band gives persistent orientation** — current stage / fork / pressure (647–662)
5. **Critic panel adjacent to rewrite controls** — see-fix in same card (842–850)

---

## 9. One-Day Punch List (impact-ordered)

1. Toast notifications for background events (runtime polling, errors) — fixes #2 and #3 — 2 h
2. Split chapter compose into discrete steps with progress (1/3 → 2/3 → 3/3) — 3 h
3. Undo/revert for "Apply World Draft" — fixes #1 — 2 h
4. Paginate / virtualize long lists (memory, atlas, stages) + add memory search — 3 h
5. Inline help/tooltips for jargon (奇门覆写, factConstraint, qimenPattern) — 2 h
6. Replace world-draft `<textarea>` with Monaco/CodeMirror Markdown — 2 h
7. Visible runtime indicator in topbar ("Background: 3/10 ticks") — 1 h

---

## 10. Verdict

The app is **a domain-specific IDE for a small expert audience, not a general-purpose creative tool**. It's not "unusable" but has sharp edges and low discoverability. Best aspects: fast navigation, sensible defaults, adjacent feedback, clear context-band. Worst: invisible polling, destructive-no-undo, scroll-hidden errors, raw-JSON memory views, form-heavy interfaces with no inline validation.

A designer can unblock most pain in <1 day with feedback systems (toasts, progress, undo) **without rearchitecting the layout** — though the architecture audit (separate document) shows the layout itself should change for long-term maintainability.
