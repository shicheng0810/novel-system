# Baseline — Current Behavior & Failure Modes

## Stack snapshot (observed)

| Layer | Choice | Note |
|---|---|---|
| Frontend | React 18 + Vite 5.4.10 | SPA, no SSR, no router |
| State | useState (30+ slots in App.tsx) | No Redux/Zustand/Context/Query lib |
| Styling | Single 647-line global CSS | No modules / Tailwind / preprocessor |
| Routing | None — `workspace` state + conditional render | URL has no state |
| Server state | Manual fetch + `syncSession()` | No SWR/React Query |
| Forms | Uncontrolled-ish + ad-hoc state | No react-hook-form / zod |
| Backend | Custom Vite middleware in same workspace | 1654 lines, ~40 manual route branches |
| Tests | Vitest, 18 files | No coverage report visible |
| TypeScript | Strict | OK |

## Largest source files

| File | Lines | Concern |
|---|---|---|
| `src/deepseek.ts` | 2290 | Provider integration; tolerable as a single module |
| `workbench/src/App.tsx` | 1659 | **God component**, 30+ useState, 27 async handlers, 6 inline workspace renderers |
| `workbench/src/server.ts` | 1654 | Backend in frontend workspace |
| `src/engine.ts` | 1132 | Domain core |
| `src/narrative.ts` | 762 | OK |
| `src/domain.ts` | 739 | Type-only file is fine |

## What the user actually sees

Single-page cream/serif "writing studio" with **6 tab-like workspaces** (Writing, Simulation, Runtime, World, Memory, Atlas). No URL change between them. No icons in the rail — only Chinese labels + sub-text. Inspector panel doubles as AI-settings drawer. ~60 lines of content visible above the fold on first load. No onboarding, no tooltips, no command palette, no toast notifications.

## Concrete failure modes (observed)

| ID | Description | Where |
|---|---|---|
| F1 | Refresh / share-link / browser-back loses workspace + context | App.tsx:168 (workspace useState only) |
| F2 | Background runtime poll invisible to writing-workspace user | App.tsx:295–306 |
| F3 | Errors disappear off-screen if user scrolled | App.tsx:1642 banner placement |
| F4 | Apply World draft is destructive with no undo | App.tsx:593–604 |
| F5 | Memory view shows raw JSON to non-technical users | App.tsx:1431 |
| F6 | World draft editor is plain `<textarea>` for Markdown | App.tsx:1147–1221 |
| F7 | Long lists (memory entries, atlas files, stages) un-paginated | App.tsx:1226–1342, 988–1030 |
| F8 | Domain jargon (奇门覆写, factConstraint, qimenPattern) lacks help | App.tsx:881–953 |
| F9 | Form fields lack inline validation (focusCharacterIds CSV silent) | App.tsx:689–765 |
| F10 | Chapter-compose flow has 4 sequential steps with no progress UI | App.tsx:625–856 |
| F11 | Same data shown in 2+ places (lines, stages, branches, AI settings) | App.tsx:670/1018, 701/988, 655/1008, 1454/1563 |
| F12 | No mobile/tablet breakpoints; single 1380px breakpoint | styles.css:639–647 |
| F13 | No CJK-tuned typography (line-height, char-per-line, font split) | styles.css full |
| F14 | No command palette (⌘K) | absent |
| F15 | Polling-based runtime status (1200 ms) instead of subscription | App.tsx:299–304 |

## What works (don't regress)

| ID | Strength | Where |
|---|---|---|
| S1 | Sensible form defaults — first-click usable | App.tsx:178–186 |
| S2 | Adjacent feedback — critic panel next to rewrite controls | App.tsx:842–850 |
| S3 | Persistent context-band shows current state | App.tsx:647–662 |
| S4 | Fast workspace switching (no confirm modal) | App.tsx:1623–1650 |
| S5 | Sensible domain terminology in Chinese labels | App.tsx:690–765 |
| S6 | Disabled-state prevents impossible actions | App.tsx:641 |
| S7 | Test discipline — 18 vitest files | tests/ |
| S8 | TypeScript strict with explicit contracts | contracts.ts (236 lines) |

## Out-of-scope for this audit

- `src/deepseek.ts` (provider) — separate concern, only touch if frontend refactor changes API surface
- `src/metaphysics/` — domain logic, not UX
- Backend orchestration semantics inside `server.ts` — only the boundary (HTTP shape, contracts) is in scope

## Verification check

`baseline.md` is correct iff: (a) every line cited above resolves to the named file at the named line; (b) every "failure mode" can be reproduced with one user click; (c) every "strength" survives a refactor without regression.
