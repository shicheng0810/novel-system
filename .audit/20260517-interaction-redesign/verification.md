# Verification · 20260517 Interaction Redesign — P0 Implementation

Date: 2026-05-17
Branch: main (uncommitted)
Vite dev server: PID watched at port 5173 throughout; HMR confirmed for all edits.

## Files Changed

### New files
- `workbench/src/features/wayfinder/WayfinderLine.tsx` — 引路 ambient guide (~78 lines)

### Modified files
- `workbench/src/App.tsx` — import + render `<WayfinderLine />` between brand and topbar actions (lines 15, 75)
- `workbench/src/stores/useUIStore.ts` — added `statusBarExpanded`, `focusIds`, `decisionResolutions` state + 4 actions (~30 LOC added)
- `workbench/src/stores/useEventStore.ts` — added `dismissDecision(id)` action with backend-TODO comment (~6 LOC added)
- `workbench/src/features/bottom-panel/BottomPanel.tsx` — focusIds sourced from useUIStore (no longer local state); added collapsed-bar `bottom-panel__focus-preview` chip when focusIds non-empty and panel closed (~20 LOC delta)
- `workbench/src/features/status-bar/StatusBar.tsx` — full rewrite: cinder pulse, click-to-expand 听筒 panel showing last 3 non-ambient events, native `title` tooltip on heartbeat + pill, no truncation in expanded view (~95 lines, +60 net)
- `workbench/src/features/settings/SettingsModal.tsx` — added `validate()` function with 6 checks (apiKey min length, baseUrl protocol, embedding equivalents, positive integers); short-circuits before API call on failure (~30 LOC added)
- `workbench/src/features/decision-inbox/DecisionInbox.tsx` — full rewrite as CouncilCard: 召见-style cards with calligraphy `⌜⌝⌞⌟` corner seal frame, verb, summary, refs metadata, hairline divider, 依准/另议 ritual buttons (~70 lines, +49 net)
- `workbench/src/styles.css` — appended ~290 lines under `Redesign · 20260517 interaction redesign` section header. Sections: Wayfinder, StatusPulse + 听筒, CouncilCard, bottom-panel__focus-preview, responsive collapse rule

**Total**: 1 new file + 8 modified files. Net ~470 LOC added across TSX + CSS, with ~30 LOC of legacy DecisionInbox/StatusBar replaced.

## Tests Run

| Check | Command | Result |
|---|---|---|
| Workbench typecheck | `cd workbench && npx tsc --noEmit` | ✓ clean (no output) |
| Root typecheck | `npx tsc --noEmit` from root | ✓ clean (no output) |
| Vitest full suite | `npm test` from root | ✓ **123/123 tests passed** across 24 test files (1.46s) |
| Vite HMR | running dev server (PID 52385) | ✓ all edits hot-reloaded without restart |
| Playwright smoke | navigate + interaction sequence | ✓ no console errors except pre-existing favicon 404 |

## Visual Verification (4 screenshots)

| File | Verified behavior |
|---|---|
| `redesign-01-wayfinder.png` | Topbar shows italic 浅墨 "世界已成 · 落座等候推演" between brand and ⌘K. Cinder dot visible on StatusBar. Layout unchanged. |
| `redesign-02-statusbar-expanded.png` | StatusBar expanded into 听筒 panel: italic "听筒 · 最近三声" title, dashed divider, "暂无非旁声事件" empty hint, "点此收起 ▾" close affordance, daemon pill preserved on right |
| `redesign-03-settings-validation.png` | Modal: Base URL set to "not-a-valid-url" → 保存 click → red ember footer message "Base URL 需以 http:// 或 https:// 开头" without modal submission |
| `redesign-04-focus-preview.png` | After selecting 林焰 + 苏雪 in BottomPanel and collapsing: bar shows "焦点 林焰·苏雪" in bronze italic between decisions count and chevron |

## CouncilCard — not visually demoed

The rewrite ships fully implemented (tsc-clean), but visual demonstration with a populated decision requires either:
- a CanonGate violation in daemon execution (random, depends on world anchors)
- backend stubbing — out of scope for this session
- mock event injection — brittle without DevTools exposure

Empty state ("没有待裁决项") confirmed in `redesign-01-wayfinder.png` (CodexRail Now tab).

When a decision-required event arrives via SSE, useEventStore.ingest() prepends it to `decisions` (existing logic, untouched), CouncilCard renders with seal/summary/refs/two buttons. 依准/另议 each calls `recordDecisionResolution(id, "uphold"|"return")` to useUIStore plus `dismissDecision(id)` to remove from useEventStore.decisions optimistically. `console.info("[decision] uphold|return", ...)` markers emit for backend-wiring observation.

Backend TODO: `/api/decisions/{id}/resolve` — when implemented, `dismissDecision()` should `await api.resolveDecision(id)` and only update state on 2xx; current stub is in-memory only.

## Strengths Preserved (cross-check against audit §5)

| # | Strength | Preserved? | Evidence |
|---|---|---|---|
| 1 | Zustand selector precision | ✓ | new selectors all single-field; e.g., WayfinderLine subscribes only to snapshot/status/decisions/latestInscribe |
| 2 | SSE real-time updates | ✓ | not touched; lampi + wayfinder + statusbar all consume the same store |
| 3 | Modal overlay pattern | ✓ | SettingsModal `onMouseDown` overlay-close preserved |
| 4 | Chapter list auto-refresh on inscribe | ✓ | ChapterView unchanged |
| 5 | Daemon status lifecycle clarity | ✓ | pill text unchanged in BottomPanel + StatusBar |
| 6 | Form reset on modal open | ✓ | SettingsModal `useEffect([open])` reset preserved |
| 7 | Caret-positioned SlashMenu | ✓ | SlashMenu untouched |
| 8 | WorldEchoes severity badges | ✓ | WorldEchoes untouched |
| 9 | TickLog timestamp format | ✓ | BottomPanel.tsx tick-log rendering unchanged |
| 10 | Global keybindings centralized | ✓ | App.tsx ⌘K + ⌘\\ untouched (Wayfinder added below brand, doesn't intercept keys) |

## Out-of-scope (deferred to P1/P2)

Per proposal §5 Implementation Roadmap. Not implemented this session:
- P1-A CommandPalette `[捷径]` tag
- P1-B BottomPanel preset chips row
- P1-C MemoryTab autoFocus + debounce + paginate
- P1-D AtlasTab folder collapse + breadcrumb
- P1-E Chapter scroll position restore
- P1-F SlashMenu placeholder copy fix
- P2-A Chapter error recovery
- P2-B WorldEchoes auto-scroll
- P2-C CodexRail tab loading skeletons
- P2-D CommandPalette no-match shake
- P2-E SSE reconnect button

## Rollback Path

If any P0 change misbehaves in production:

```bash
# Selective revert (uncommitted changes):
cd "/Users/chris0810/Documents/Codex/Novel System/workbench"
git checkout src/App.tsx
git checkout src/stores/useUIStore.ts
git checkout src/stores/useEventStore.ts
git checkout src/features/bottom-panel/BottomPanel.tsx
git checkout src/features/status-bar/StatusBar.tsx
git checkout src/features/settings/SettingsModal.tsx
git checkout src/features/decision-inbox/DecisionInbox.tsx
git checkout src/styles.css
rm -rf src/features/wayfinder/
```

All changes are uncommitted as of this verification doc — git is clean baseline.

## Completion Gate

Per `/ecc:long-task` completion criteria:
- [x] runbook exists at top of redesign-proposal.md (Concept Reframe + 5 Moves + Matrix + IA + Roadmap)
- [x] latest checkpoint = this verification doc
- [x] success condition: artifacts produced + P0 implemented + tsc/vitest pass + visual screenshots
- [x] verification commands recorded (tsc, npm test, playwright snapshots)
- [x] artifacts present:
  - `current-state.md` (498 lines — audit, P1 phase output)
  - `redesign-proposal.md` (~330 lines — P2 phase output)
  - `verification.md` (this file — P4 phase output)
  - 4 PNG screenshots
- [x] no repeated failures or unresolved blockers
- [x] no production write-back (frontend dev server only; uncommitted)

**Status**: P0 complete. Ready for user review.
