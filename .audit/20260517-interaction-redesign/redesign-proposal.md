# Redesign Proposal · Novel System v3 Interaction Logic
*Generated 2026-05-17 · frontend-design skill · Pattern A 全力*

## 1. Concept Reframe

> 「案头 · 一炷香 · 三层皮」 — *A writer's desk, the burning incense, three layers of skin.*

The current UI treats Novel System like a SaaS dashboard: controls cluster around the periphery, every action is a button, every state is rendered. That fights the system's actual nature.

The actual nature is **a writer sitting at a desk while a world unfolds itself**. The daemon is *one stick of incense* — it burns at its own pace, marks time, smells of something. The author's attention is on the **manuscript that emerges**, not the engine that produces it. Controls exist but stay tucked into drawers. Most surfaces are *ambient* — they breathe, hum, pulse — and the author scans them peripherally.

The redesign re-stratifies the interface into **three skins**:

| Skin | Role | Interaction model | Components |
|------|------|---------------------|----------------|
| **皮一 · Surface** | Ambient witness — "the world is moving" | No input. Always visible. Breathing/pulsing. | LampTrack, **WayfinderLine** (new), **StatusPulse** (refactored StatusBar), heartbeat cinder |
| **皮二 · Mid** | Scannable observation — "this just happened" | Read-mostly. One-click expansions. | ChapterView, WorldEchoes, **CouncilCards** (refactored DecisionInbox), MemoryHits |
| **皮三 · Deep** | Summoned authority — "I command" | Modal / palette / collapsible drawer. | BottomPanel, CommandPalette, SettingsModal, SlashMenu |

Every redesign decision below traces back to which skin the interaction belongs in. If a thing is in the wrong skin, it gets re-skinned, not just re-styled.

---

## 2. The Five Major Moves

### Move 1 · 引路 (Way-finder) — A single line that always knows what's next

**Pain addressed**: #1 (WorldUploader has no next-step affordance), #2 (daemon-start path duplication, both forms hidden behind separate gestures), tangentially #3 (no signal when decision needs attention).

**Current**: Topbar has empty negative space between brand "Novel System · v3" and the ⌘K/⚙ buttons. The user is left to deduce what to do at each phase of the journey.

**Proposed**: Insert a single **way-finder line** between the brand and the buttons. It's a *whisper-imperative* — italic, low-weight, low-emphasis ink — that tells the author what their next breath should be:

| App state | Way-finder copy | Affordance |
|-----------|------------------|--------------|
| No world loaded | "落墨之前 · 先备世界" | (none — uploader visible below) |
| World loaded, daemon idle | "世界已成 · 落座等候推演" | (none — points to ▴ BottomPanel below) |
| Daemon active | "{stageLabel} · 第 {N}/{M} 推演" | Live updates from `lastStageLabel` |
| Decision pending | "★ 一桩待裁 · 移目右栏「议事」" | Click → setMode("now") |
| Daemon completed, recent chapter | "新章已落 · 《{chapterGoal}》" | Click → scroll to chapter |
| Long idle | "案头清静" | (none) |

**Visual spec**: Single line, `--ink-soft` color, italic, serif, 13px, max-width 480px, ellipsize. Subtle 240ms fade between state transitions. No icon. Clickable when affordance applies (cursor → pointer, underline on hover only).

**Why this matters**: collapses the "what now?" tax across the entire journey into a single, peripherally-readable surface. The author never has to look around for next steps. It exists in *皮一 (Surface)* — ambient, always visible, but never demanding.

**Implementation cost**: M (~80 lines: new WayfinderLine.tsx + ~30 lines CSS + wire into App.tsx topbar)

---

### Move 2 · 议事 (Council) — DecisionInbox becomes a ritual, not a list

**Pain addressed**: #3 (DecisionInbox is read-only, no resolve action).

**Current**: `decision-required` events stream into a passive list in CodexRail Now tab. User sees them, can't act. The audit notes: *"User sees item but can't act. Does clicking do anything? (No.)"*

**Proposed**: Each decision becomes a **CouncilCard** — not a list item, but a *召见* (summoning) artifact:

```
┌─────────────────────────────────────────┐
│  ⌜⌝                                     │
│    扶正                                  │  ← verb as calligraphy-weighted seal
│  ⌞⌟                                     │
│                                          │
│  韩渡按兵不动，等候时机                  │  ← summary in body serif
│                                          │
│  权重 0.61 · 命盘 土·金 持重守序        │  ← refs metadata (muted, monospace)
│  ────                                    │
│  [ 依准 ]    [ 另议 ]                   │  ← two ritual buttons
└─────────────────────────────────────────┘
```

**Two actions**:
- **依准** (uphold) — daemon proceeds as proposed. Card fades out, marked resolved.
- **另议** (return for re-proposal) — daemon must propose alternative. Card fades to a pending state.

**Backend status**: Currently no `/api/decisions/resolve` endpoint exists. Implementation will be **frontend-only stub** that:
1. Optimistically removes the card from `useEventStore.decisions`
2. Records the resolution intent in `useUIStore.decisionResolutions` (in-memory, ephemeral)
3. Emits a console marker for backend wiring later
4. Includes a clear `// TODO: backend endpoint /api/decisions/{id}/resolve` comment

This makes the *interaction model* concrete without blocking on backend. When backend lands, swap the stub for a real API call — one-line change.

**Visual spec**: Card has `--paper-strong` background, 1px `--line` border, generous 18px padding, 12px radius. Verb is 0.92rem serif italic with subtle calligraphic weight (the seal frame uses `⌜⌝⌞⌟` Unicode brackets — see the calligraphy seal style). Refs are 11px monospace `--ink-soft`. Buttons are ghost-style with ember hover.

**Why this matters**: this is the *single moment* that distinguishes Novel System from a generic LLM writing tool. The world model has paused to ask the author for judgment. That moment deserves ritual, not a checkbox.

**Implementation cost**: M (~70 lines TSX rewrite + ~80 lines CSS + 10 lines store)

---

### Move 3 · 暗格 (Hidden drawer) — Consolidate daemon controls, persist intent

**Pain addressed**: #2 (daemon-start path duplication), #10 (focusIds lost on panel close).

**Current**: BottomPanel form *and* CommandPalette both offer daemon-start. They diverge in default params (palette is preset, form is custom). User doesn't know which to use. Worse, BottomPanel's `focusIds` is local state — close panel, lose selection.

**Proposed**:
1. **BottomPanel is the primary surface for daemon control** — full form, focus toggles, presets-as-chips
2. **CommandPalette daemon-start commands tagged `[捷径]`** with a small hint "下方控制台亦可启动"
3. **focusIds persisted to `useUIStore`** — survives panel close/re-open and tab switches
4. Optional: BottomPanel collapsed bar shows a tiny inline "焦点：A·B" preview when user has selected characters

**Visual spec**: Add a "preset row" in SimControls above the input row, with chips:
```
快启:  [5 步 · 每 3 出章]  [1 步 · 不出章]  [10 步 · 长跑]
```
Click chip → fills form (doesn't auto-submit, lets user verify before ▶ 启动).

CommandPalette items get a `palette-row__tag` element rendered as `[捷径]` in `--bronze` color, small caps letter-spacing.

**Why this matters**: removes the "two paths to the same place" friction. The palette becomes *power-user shortcut*, the form remains *primary control*. focusIds persistence is a small but high-impact fix — selecting focus characters should feel like a settled decision, not a scratchpad.

**Implementation cost**: S+M
- focusIds persist: S (~15 lines)
- Preset chips: S (~25 lines)
- Palette `[捷径]` tag: S (~10 lines)
- Total: M

---

### Move 4 · 静观 (Listening Post) — StatusBar as contemplative scope

**Pain addressed**: #8 (heartbeat truncated at 32 chars, no expand). Implicit: making the "system is alive" signal visible without being intrusive.

**Current**: StatusBar's left side shows latest event verb + summary truncated at 32 chars. No tooltip, no click. Right side shows runtime pill (no click). The bar is dead.

**Proposed**: StatusBar becomes the **scope** through which the author peripherally listens to the system:
1. **Heartbeat text** gets `title={fullSummary}` attribute (native tooltip — zero CSS cost)
2. **Click-to-expand** behavior: clicking the heartbeat area expands the bar into a 3-line "听筒" panel showing the last 3 non-ambient events with timestamps, verbs, full summaries. Click again to collapse.
3. **Cinder dot** (already designed for lamp whisper) lives here too — a 4px ember dot that pulses on heartbeat-change, anchored just left of the heartbeat text
4. **Runtime pill** stays passive but gains a tooltip showing `runIds.length` + `lastRunId`

**Visual spec**: When collapsed (default), bar is 32px tall, single line. When expanded, bar grows to 96px with three event rows, each `12px serif italic` + monospace timestamp. Smooth height transition 280ms ease.

**Why this matters**: the system *is* always pulsing with information (SSE 10+ events/tick). The current bar wastes this. The new bar lets the author choose how much to listen — peripheral by default, deep on demand.

**Implementation cost**: M (~50 lines TSX + ~40 lines CSS)

---

### Move 5 · 巡礼 (Pilgrimage) — Memory & Atlas as exploration

**Pain addressed**: #7 (MemoryTab UX awkward), #9 (AtlasTab no folder collapse).

**Current**: Memory tab requires explicit Enter to search; no auto-focus; flat 20-result limit; no pagination. Atlas tab shows a flat list of all files; folders aren't toggleable.

**Proposed**:
1. **MemoryTab**:
   - `autoFocus` on tab switch (useEffect when activeTab === "memory")
   - 300ms debounce live-search (replace explicit button)
   - Result count badge: "命中 12 条"
   - "更多" button appends next 20 results (limit doubles per click, capped at 100)
   - Each result shows entry kind as a small seal (similar to CouncilCard verb seal)
2. **AtlasTab**:
   - Folder nodes become disclosure toggles (▸ collapsed / ▾ expanded)
   - Persist expanded state to `useUIStore.atlasExpanded: Set<string>`
   - Selected file shows breadcrumb at top: `characters > 林焰.md`

**Visual spec**:
- Memory result: `13px serif` body, `11px monospace` muted score, kind-seal at left with `--bronze` border-radius:2px badge
- Atlas folder: 14px serif with disclosure arrow at left, gentle indent (12px per depth)
- Expanded folder shows children inset; collapsed shows only folder name

**Why this matters**: these are exploration tabs, not data interfaces. Memory should feel like *flipping through your own notes*; Atlas should feel like *walking through your study*. The current implementations feel like REST clients.

**Implementation cost**: M (~60 lines per tab + CSS)

---

## 3. The Ten Pain Points × Solutions Matrix

| # | Pain | Solution location | Priority |
|---|------|-------------------|----------|
| 1 | WorldUploader no affordance after success | Move 1 (Wayfinder absorbs it) + auto-hide form on `parsed != null` | **P0** |
| 2 | Two daemon-start paths | Move 3 (BottomPanel primary + palette `[捷径]` tag) | P1 |
| 3 | DecisionInbox no resolve | Move 2 (CouncilCard with 依准/另议) | **P0** |
| 4 | SlashMenu "/" trigger hidden | Micro-fix: change WritingCanvas placeholder to "行首输入 / 唤起菜单" | P1 |
| 5 | Chapter scroll position lost | Micro-fix: useRef + scrollTop snapshot map by chapterId | P1 |
| 6 | SettingsModal no validation feedback | Micro-fix: client-side validate apiKey + baseUrl before submit | **P0** |
| 7 | MemoryTab awkward query UX | Move 5 (autoFocus + debounce + paginate + count) | P1 |
| 8 | Heartbeat 32-char truncation | Move 4 (StatusBar tooltip + click-expand) | **P0** |
| 9 | AtlasTab no folder collapse | Move 5 (disclosure toggles + persist expanded set) | P1 |
| 10 | focusIds lost on panel close | Move 3 (persist to useUIStore) | **P0** |
| 11 (minor) | No error recovery for failed chapters | Micro-fix in ChapterView: try/catch + retry button | P2 |
| 12 (minor) | WorldEchoes no auto-scroll | Micro-fix: scrollIntoView ref on new event | P2 |
| 13 (minor) | No loading state between Codex tabs | Micro-fix: skeleton placeholder | P2 |
| 14 (minor) | CommandPalette no-match silent on Enter | Micro-fix: shake animation or beep | P2 |
| 15 (minor) | SSE error no reconnect prompt | Micro-fix: error toast + reconnect button | P2 |

---

## 4. Information Architecture Sketch

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Novel System · v3       ※ 世界已成 · 落座等候推演 ※        ⌘K     ⚙        │ ← 皮一 · Wayfinder
├──────────────────────────────────────────────────┬─────────────────────────┤
│                                                    │  Now · 世界 · 记忆 · 图谱│
│  prose canvas        stage #37  [已成章节][续段稿]│                          │
│                                                    │  ⌜⌝                     │
│    ●breathe ─ ─ ─ ◯─◯─◯─◯─◯                       │    议事                  │
│    取材┄ 立骨┄ ★铺场 成文 自审 入史                │  ⌞⌟                     │
│    ⤷ 铺场中 · 生成 3 个场景卡                      │                          │
│                                                    │  ┌─────────────────┐    │ ← CouncilCard
│  ─────                                             │  │  扶正           │    │
│                                                    │  │  韩渡按兵不动…  │    │
│  《推进核心冲突》                                  │  │  权重 0.61      │    │
│  焦点: 林焰、苏雪 · inscribed                      │  │  [依准] [另议]  │    │
│                                                    │  └─────────────────┘    │
│  雪是寅时开始落的。…                               │                          │
│                                                    │  回响 (echoes)          │
│  外门山城的石板路被覆了薄薄一层白…                 │  ★ 落定 · 第 65 阶段   │
│                                                    │  ! 扶正 · default…     │
│                                                    │                          │
├──────────────────────────────────────────────────┴─────────────────────────┤
│ ✓ 推演 · 5/5  · ★ 0 决策                                                ▴   │ ← 皮三 · BottomPanel bar
├────────────────────────────────────────────────────────────────────────────┤
│ ●cinder  落定 · 第 65 阶段 入史 · 记忆 +3 · 复用记忆 0           ✓ 5/5    │ ← 皮一 · StatusPulse (clickable for 听筒)
└────────────────────────────────────────────────────────────────────────────┘

Expanded StatusPulse (听筒 mode) — click to expand:
┌────────────────────────────────────────────────────────────────────────────┐
│ ●cinder   ╔═════════════════════════════════════════════════════╗           │
│           ║ 09:23:01  落定   第 65 阶段入史 · 记忆 +3 · 复用 0  ║   ✓ 5/5  │
│           ║ 09:22:54  扶正   default-workbench-2-苏雪-cautious  ║           │
│           ║ 09:22:48  裁决   promote (risk=none, 0 锚点违规)    ║           │
│           ╚═════════════════════════════════════════════════════╝           │
└────────────────────────────────────────────────────────────────────────────┘

CouncilCard close-up — calligraphy seal frame:
   ⌜⌝
     扶正                    ← verb at calligraphic weight
   ⌞⌟
   韩渡按兵不动，等候时机    ← summary in body serif
   ────────                   ← hairline divider
   权重 0.61 · 命盘 土·金     ← refs (muted monospace)
   持重守序
   ────
   [ 依准 ]    [ 另议 ]       ← ritual buttons
```

---

## 5. Implementation Roadmap

### P0 — This Session (the must-haves)
| # | Move | Files | LOC | Cost |
|---|------|-------|-----|------|
| P0-A | Wayfinder line | new `WayfinderLine.tsx`, `App.tsx`, `styles.css` | ~110 | M |
| P0-B | focusIds persist + auto-hide WorldUploader on parsed | `useUIStore.ts`, `BottomPanel.tsx`, `WorldUploader.tsx`, `App.tsx` | ~40 | S |
| P0-C | StatusBar tooltip + click-expand 听筒 | `StatusBar.tsx`, `styles.css` | ~90 | M |
| P0-D | SettingsModal client-side validation | `SettingsModal.tsx` | ~30 | S |
| P0-E | CouncilCard (DecisionInbox 依准/另议 stub) | `DecisionInbox.tsx`, `useEventStore.ts`, `styles.css` | ~150 | M |

**Total P0**: ~420 LOC across 8 files.

### P1 — Next Session
| # | Item | LOC |
|---|------|-----|
| P1-A | CommandPalette `[捷径]` tag + WorldUploader auto-collapse | ~25 |
| P1-B | BottomPanel preset chips row | ~40 |
| P1-C | MemoryTab autoFocus + debounce + paginate | ~70 |
| P1-D | AtlasTab folder collapse + breadcrumb | ~80 |
| P1-E | Chapter scroll position restore | ~30 |
| P1-F | SlashMenu placeholder copy fix | ~5 |

**Total P1**: ~250 LOC.

### P2 — Polish
| # | Item | LOC |
|---|------|-----|
| P2-A | Chapter error recovery + retry | ~30 |
| P2-B | WorldEchoes auto-scroll | ~15 |
| P2-C | CodexRail tab loading skeletons | ~50 |
| P2-D | CommandPalette no-match shake | ~20 |
| P2-E | SSE reconnect button | ~25 |

**Total P2**: ~140 LOC.

---

## 6. Aesthetic Anchors

All implementations adhere to:
- **Color**: `--paper / --paper-strong / --surface / --surface-alt / --ink / --ink-soft / --line / --line-strong / --ember / --ember-soft / --bronze / --mint` (no new variables introduced)
- **Type**: Palatino Linotype / Book Antiqua / Noto Serif SC throughout; never Inter/Roboto/system-ui
- **Motion**: 240–480ms ease for state transitions; breathing animations 1.8–2.4s for ambient signals; no spring/bounce
- **Negative space**: generous; default to fewer surfaces with more breathing room over more surfaces with packed content
- **Iconography**: avoid Unicode-emoji aesthetics (●◯▢▶⌘); use them only when meaning is structural (status pill states are exempt)
- **No new dependencies**: zero new npm packages introduced

The lamp-track (six-stage-progress) added in the prior session establishes the breathing-incense motion language. All new ambient signals (cinder, wayfinder fade, council seal frame) inherit from that language — same timing curves, same color stages.

---

*End of proposal. Implementation begins in Part B.*
