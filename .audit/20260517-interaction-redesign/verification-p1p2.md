# Verification · 20260517 Interaction Redesign — P1 + P2 Batch

Date: 2026-05-18
Branch: main (uncommitted, builds on P0)
Vite dev server: PID 52385 throughout; HMR confirmed for all edits.
Plan file: `~/.claude/plans/redesign-long-task-plan-mode-plan-resilient-whistle.md` (approved)

## Items Shipped (11 / 11 from plan)

| Item | Files | Status |
|---|---|---|
| P1-A · CommandPalette `[捷径]` tag | `CommandPalette.tsx`, `styles.css` | ✓ |
| P1-B · BottomPanel preset chips row | `BottomPanel.tsx`, `styles.css` | ✓ |
| P1-C · MemoryTab debounce + autoFocus + count + paginate | `CodexRail.tsx`, `styles.css` | ✓ |
| P1-D · AtlasTab nested tree + folder collapse + breadcrumb + persist | `CodexRail.tsx`, `useUIStore.ts`, `styles.css` | ✓ |
| P1-E · ChapterView scroll position restore | `ChapterView.tsx`, `useUIStore.ts` | ✓ |
| P1-F · SlashMenu placeholder copy | `WritingCanvas.tsx` | ✓ |
| P2-A · ChapterView error recovery + 重试 | `ChapterView.tsx`, `styles.css` | ✓ (bundled with P1-E) |
| P2-B · WorldEchoes gated auto-scroll + 新回响 pill | `WorldEchoes.tsx`, `styles.css` | ✓ |
| P2-C · CodexRail loading skeletons | `CodexRail.tsx`, `styles.css` | ✓ (AtlasSkeleton + MemorySkeleton) |
| P2-D · CommandPalette no-match shake | `CommandPalette.tsx`, `styles.css` | ✓ |
| P2-E · SSE 重连 button | `StatusBar.tsx`, `styles.css` | ✓ |

## Files Touched (this batch)

| File | LOC delta |
|---|---|
| `workbench/src/stores/useUIStore.ts` | +18 (new state + 3 actions) |
| `workbench/src/features/writing-canvas/WritingCanvas.tsx` | 1 line replace (placeholder) |
| `workbench/src/features/command-palette/CommandPalette.tsx` | +25 (tag field, shake nonce) |
| `workbench/src/features/bottom-panel/BottomPanel.tsx` | +30 (preset chips row) |
| `workbench/src/features/codex-rail/CodexRail.tsx` | +180 (MemoryTab rewrite, AtlasTab rewrite, two skeleton components) |
| `workbench/src/features/chapter-view/ChapterView.tsx` | +50 (scroll restore + error/retry) |
| `workbench/src/features/world-echoes/WorldEchoes.tsx` | full rewrite, +35 (gated auto-scroll + pill) |
| `workbench/src/features/status-bar/StatusBar.tsx` | +20 (reconnect button + error branch) |
| `workbench/src/styles.css` | +245 (one redesign-20260518 section appended) |

**Net new ~600 LOC across 9 files.** Slightly over the ~490 plan estimate due to the bonus MemorySkeleton component + the race-guard plumbing being more boilerplate than scoped.

## Tests Run

| Check | Command | Result |
|---|---|---|
| Workbench typecheck | `cd workbench && npx tsc --noEmit` | ✓ clean (no output) |
| Root typecheck | `npx tsc --noEmit` | ✓ clean |
| Vitest full suite | `npm test` | ✓ **123 / 123 tests passed** in 24 files (958ms) |
| Vite HMR | running dev server (PID 52385) | ✓ all edits hot-reloaded; no restart needed |
| Playwright walkthrough | navigate + interaction sequence | ✓ no console errors (1 pre-existing favicon 404) |

## Mid-Implementation Bug Found & Fixed

**Bug**: Initial AtlasTab P1-D shipped checking `node.kind === "folder"`, but the backend (`/api/atlas/tree`) returns `kind: "directory"`. Side-effect: clicking a folder was being routed to `setAtlasSelected()` instead of `toggleAtlasExpanded()` — folder rows became "selected" with active styling, the empty body fetched returned nothing, and the tree never expanded.

**Detection**: First Playwright screenshot of the Atlas tab showed only flat root folders with no ▸ disclosure arrows, and clicking "characters" set it as "active" (ember background) with a breadcrumb appearing — but no children expanded.

**Diagnosis**: `curl /api/atlas/tree` returned `{path: "characters", kind: "directory"}`. The Explore-agent audit notes had been imprecise ("folder" vs "directory"). Plan's hazards list flagged this category of risk (loose API typing) but didn't catch this specific mismatch.

**Fix**: `CodexRail.tsx:isFolder` now accepts either `"directory"` or `"folder"`. Also fixed the children-sort comparator. Class name normalized to `codex-atlas__node--folder` regardless of which kind value the backend sends. Single re-test confirmed working expansion.

## Visual Verification (7 screenshots)

| File | Verified behavior |
|---|---|
| `p1-01-command-palette-tag.png` | Palette opens; bronze `[捷径]` tag rendered next to "加载示例世界", "启动 daemon · 5 步…", "启动 daemon · 1 步…", "暂停 daemon". Non-shortcut commands (打开 AI 设置, 切到记忆/图谱) carry no tag. |
| `p1-02-bottom-panel-presets.png` | BottomPanel expanded; new row above input row shows `快启:` label + 3 chips: "5 步 · 每 3 出章", "1 步 · 不出章", "10 步 · 长跑". Bronze hover styling preserved. |
| `p1-03-memory-debounce.png` | Memory tab: input shows "林焰", no 搜索 button visible, "命中 20 条" count rendered. Each hit shows bronze-bordered `EXPRESSION` kind seal + "总分 0.69". |
| `p1-04-atlas-tree-collapsed.png` | Atlas tab: 4 root folders with bronze `▸` disclosure arrows: anchors / characters / relationships / world. |
| `p1-04-atlas-tree-expanded.png` | After clicking "characters": `▾ characters` with indented children `林焰.md / 苏雪.md / 韩渡.md`. After clicking 林焰.md: breadcrumb `characters › 林焰.md` + file body rendered. |
| `p1-04b-atlas-after-click.png` | Documents the bug state before the kind-mismatch fix (folder being treated as file) — kept as evidence trail. |
| `p2-04-palette-shake.png` | Palette with "xyz无匹配" query → Enter → empty state "没有匹配命令" rendered in ember red; shake animation runs on key remount. |

## Not Visually Demoed (verified by code review + tsc)

- **P1-E ChapterView scroll restore** — requires multiple chapters and scroll interaction; manual smoke confirmed via Playwright but not screenshotted.
- **P2-A ChapterView 重试 button** — only renders on `api.chaptersGet` rejection; requires fault injection to demonstrate. Code path is straightforward (try/catch on the promise + retryNonce dependency).
- **P2-B WorldEchoes 新回响 pill** — only renders when scrollTop > 20 AND a new echo arrives. Daemon is idle (3/3 done); no live echoes streaming. Code path verified.
- **P2-C MemorySkeleton** — visible during the ~300ms debounce window between keystroke and result; too brief to reliably screenshot.
- **P2-E SSE 重连 button** — only renders when `sseState === "error"`. SSE is healthy throughout the session. Code path verified.

## Strengths Preserved

All 10 strengths from `current-state.md` §5 remain intact:
- Zustand selector precision: every new component uses single-field selectors (e.g., `useEventStore((s) => s.connect)`)
- SSE real-time updates: untouched
- Modal overlay pattern: untouched
- Chapter list auto-refresh on inscribe: untouched (refresh callback unchanged)
- Daemon status lifecycle: untouched
- Form reset on modal open: untouched
- Caret-positioned SlashMenu: untouched
- WorldEchoes severity badges: preserved across rewrite
- TickLog timestamp format: untouched
- Global keybindings: untouched

## Out of Scope (per plan)

Not implemented this batch — these are explicit roadmap-deferred:
- Backend `/api/decisions/{id}/resolve` endpoint (CouncilCard still stub from P0)
- Localization / a11y / mobile / perf optimization (all per plan §Out of Scope)

## Rollback Path

All changes uncommitted as of this verification doc. P0 + P1 + P2 are all in the working tree. Selective revert by file:

```bash
cd "/Users/chris0810/Documents/Codex/Novel System/workbench"
git checkout src/features/codex-rail/CodexRail.tsx
git checkout src/features/command-palette/CommandPalette.tsx
git checkout src/features/bottom-panel/BottomPanel.tsx
git checkout src/features/chapter-view/ChapterView.tsx
git checkout src/features/writing-canvas/WritingCanvas.tsx
git checkout src/features/world-echoes/WorldEchoes.tsx
git checkout src/features/status-bar/StatusBar.tsx
git checkout src/stores/useUIStore.ts
git checkout src/styles.css
# P0 changes (DecisionInbox rewrite, WayfinderLine new file, etc.) remain — they
# pre-date this batch and are tracked in the prior verification.md.
```

## Completion Gate

- [x] Plan file exists + approved (`redesign-long-task-plan-mode-plan-resilient-whistle.md`)
- [x] All 11 plan items shipped (1 mid-flight bug fix recorded)
- [x] `tsc --noEmit` clean (both projects)
- [x] `npm test` 123 / 123 passing
- [x] Playwright visual verification for 4 of 5 demoable items
- [x] No production write-back (uncommitted, dev server only)
- [x] Rollback path documented
- [x] Audit-dir artifacts complete:
  - `current-state.md`
  - `redesign-proposal.md`
  - `verification.md` (P0 phase)
  - `verification-p1p2.md` (this file)
  - 4 P0 screenshots + 7 P1/P2 screenshots = 11 PNGs total

**Status**: P1 + P2 complete. The 10 critical + 5 minor pain points from the original audit are all addressed in either P0 or P1/P2. Ready for user review and (when approved) git commit.
