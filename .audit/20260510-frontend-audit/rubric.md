# Rubric — Scoring Criteria for the Frontend

Score each dimension 1–5 (1 = broken, 3 = acceptable, 5 = best-in-class). Current = today; Target = 6-week realistic.

| # | Dimension | Rule of thumb | Sources | Current | Target |
|---|---|---|---|---|---|
| R1 | **Deep-linkability** | URL encodes workspace, selected line/stage/scene; refresh lands on same view | LogRocket "URL state", Alfy 2025 | 1 | 5 |
| R2 | **Visibility of system status** (NN/g #1) | Background work surfaces non-modally; polling is visible | NN/g 10 heuristics | 2 | 4 |
| R3 | **Undo & error recovery** (NN/g #5) | Destructive actions reversible OR diffed before commit | NN/g | 1 | 4 |
| R4 | **Recognition over recall** (NN/g #6) | Command palette + labelled actions + visible context | NN/g, Linear | 2 | 5 |
| R5 | **Aesthetic & minimalist** (NN/g #8) | First-screen ≤ 25 lines content for primary task | NN/g, iA Writer | 2 | 4 |
| R6 | **CJK typography** | line-height ≥ 1.7; ≤40 CJK chars/line; serif body / sans chrome split | Typotheque, Butterick, iA 100E2R | 2 | 5 |
| R7 | **Component health** | Largest screen file ≤ 400 lines; no >100-line useEffect | Khanna refactor heuristic, Bulletproof React | 1 | 4 |
| R8 | **State management hygiene** | Server state in cache lib; UI state in store; form state in form lib | TanStack Query docs, Zustand, react-hook-form | 1 | 4 |
| R9 | **Layout primitives** | Resizable panes; persisted layout; status bar | react-resizable-panels, VS Code, Cursor | 2 | 4 |
| R10 | **Empty states teach** | Each empty state shows "what to do next" with example | Plottr/World Anvil templates | 2 | 4 |
| R11 | **AI surface discipline** | Inline ghost-text + verb-named actions, not generic prompt boxes | Sudowrite Write/Describe, Linear AI | 3 | 5 |
| R12 | **Form ergonomics** | Inline validation, progress for long ops, no modal-in-place | react-hook-form, Sudowrite | 2 | 4 |
| R13 | **Same-data multi-projection** | World/Memory/Atlas reconciled into one entity graph view | Scrivener Binder/Corkboard/Outliner | 2 | 4 |
| R14 | **Notification system** | Toasts for background events; persistent until acknowledged for errors | Radix Toast / sonner | 1 | 4 |
| R15 | **Backend boundary** | API surface typed; not embedded in frontend Vite middleware in production | tRPC / Hono + zod | 2 | 4 |

## Unacceptable regressions

Any refactor must NOT break:
- Default-form-then-click chapter compose (S1)
- Adjacent critic-panel feedback during rewrite (S2)
- Workspace switching < 200 ms perceived latency (S4)
- Existing Vitest suite (18 files green)
- TypeScript strict
- Existing API contracts unless versioned

## Scoring procedure

For a candidate proposal:
1. Re-score current → projected on each R# row
2. Sum delta; weight R1, R2, R3, R7 ×2 (highest leverage per audit)
3. Reject any candidate with negative score on Unacceptable Regressions

## Holdout cases (deferred to eval.md)

Five user-flow tasks the new system must handle without regression. See eval.md.
