# Candidates — Proposed Changes (with provenance)

Each candidate is **independent** (small) or **load-bearing** (gates others). Source IDs reference the three `source_cards_*.json` files in this folder.

## Tier 0 — load-bearing (do first)

### C0.1 — URL-routable workspace state ⭐ Single highest-leverage move
**Change**: Adopt React Router v7 (or TanStack Router). Encode workspace + selected line/stage/scene in the URL. Replace `useState("workspace")` with a loader-driven route param.

**Why**: F1 (refresh / share / browser-back loses context). NN/g visibility-of-state. Linear's IA depends on URL state.

**Sources**: `react-router-v7-data-mode`, `tanstack-router-typesafe`, `linear-ia-postmortem`, `logrocket-url-state-2025`, `alfy-url-state-2025`.

**Risk**: low — additive; old code paths unchanged until routes wired.

**Estimate**: 1–2 days for shell + writing+simulation routes. Other 4 workspaces folded incrementally.

---

### C0.2 — Workbench shell consolidation (6 → 1)
**Change**: One stable shell — Activity Bar (icons) left, content center, contextual right rail (Codex). Simulation collapses to a bottom panel; Runtime to a status-bar pill. World/Memory/Atlas merge into a Codex-style three-tab right rail (one entity graph, three projections — Scrivener Binder/Corkboard/Outliner pattern).

**Why**: F11 (data shown in 2+ places), and the IA research's #1 finding — the 6 workspaces are projections of one underlying graph.

**Sources**: `vscode-activity-bar`, `linear-multi-pane`, `scrivener-binder-corkboard-outliner`, `novelcrafter-codex`, `figma-three-pane`.

**Risk**: medium — touches every render path. Must be done **after C0.1** so layout state lives in URL/store, not buried in `useState`.

**Estimate**: 1 week if done as Strangler Fig (one workspace at a time).

---

## Tier 1 — pain killers (no blocker, high impact)

### C1.1 — Toast notification system
**Change**: Add Radix Toast or sonner. Background events (runtime polling, errors) emit toasts. Errors are persistent + dismissible.

**Why**: F2 + F3 (invisible polling, scroll-hidden errors).

**Sources**: `radix-toast`, `sonner-toast`, `nng-visibility-status`.

**Estimate**: 2 hours.

---

### C1.2 — Undo / diff for "Apply World"
**Change**: Before `handleApplyWorld`, snapshot session+world state to `previousWorld`. Add "Revert" button (disabled if no snapshot). Optional: show diff modal before applying.

**Why**: F4 (destructive-no-undo).

**Sources**: `nng-error-recovery`, `figma-undo`.

**Estimate**: 2 hours (snapshot only) or +2 hours for diff modal.

---

### C1.3 — Visible runtime status pill in topbar
**Change**: Show `Background: 3/10 ticks · running` as a clickable pill when `runtimeDaemon.active`. Click jumps to runtime route.

**Why**: F2.

**Sources**: `vscode-status-bar`, `linear-status-pill`.

**Estimate**: 1 hour.

---

### C1.4 — Replace world-draft `<textarea>` with CodeMirror Markdown
**Change**: Use `@uiw/react-codemirror` + `@codemirror/lang-markdown`. Preserve current value/onChange contract.

**Why**: F6 (no syntax highlight, no line numbers for 2 KB Markdown).

**Sources**: `codemirror-react`, `monaco-vs-codemirror-2025`.

**Estimate**: 2 hours.

---

### C1.5 — Inline help / tooltips for jargon
**Change**: Add Radix `Tooltip` next to labels for: `奇门覆写`, `factConstraint`, `qimenPattern`, `世界压强`, `推荐分叉`. 1-line plain-language explanation.

**Why**: F8 (domain jargon, no help). NN/g recognition-over-recall.

**Sources**: `radix-tooltip`, `nng-help-docs`.

**Estimate**: 2 hours.

---

### C1.6 — Pagination + search for memory & atlas lists
**Change**: Virtualized list (`@tanstack/react-virtual`) for memory entries / atlas files. Add input filter on memory.

**Why**: F7 (un-paginated long lists).

**Sources**: `tanstack-virtual`, `react-window`, `linear-list-perf`.

**Estimate**: 3 hours.

---

### C1.7 — Replace polling with SSE (or React Query polling)
**Change**: Move `runtimeDaemon` status to TanStack Query with automatic background refetch. Optionally upgrade backend to SSE so UI is push-driven.

**Why**: F15 (1200ms polling, battery/CPU). Also unlocks running indicator (C1.3).

**Sources**: `tanstack-query-realtime`, `sse-vs-websocket-2025`, `theo-browne-server-state`.

**Estimate**: 3 hours (TanStack Query only) or +1 day for SSE.

---

## Tier 2 — architectural cleanup (do under Strangler Fig)

### C2.1 — Feature-folder split of App.tsx
**Change**: Move each workspace's render + handlers into `src/features/<workspace>/`. App.tsx becomes shell + router outlet (~100 lines target).

**Why**: F (1659-line god component).

**Sources**: `bulletproof-react`, `feature-folders-2026`, `khanna-refactor-heuristic`.

**Estimate**: 1–2 weeks; one feature per PR.

---

### C2.2 — Adopt Zustand for cross-workspace UI state
**Change**: Selected line, panel layout, command-palette open — all in a Zustand store. Server state (session, runs, memory) stays in TanStack Query.

**Why**: 30+ useState in App.tsx; prop drilling.

**Sources**: `zustand-vs-redux-2026`, `wieruch-state-2026`, `mark-erikson-server-vs-ui`.

**Estimate**: 2–3 days alongside C2.1.

---

### C2.3 — react-hook-form + zod for lens/stage forms
**Change**: Convert lens form (8 fields) and stage form (4+) to react-hook-form with zod schemas. Inline validation with friendly messages.

**Why**: F9 (no validation, silent CSV parsing).

**Sources**: `react-hook-form-zod`, `kent-c-dodds-form-libs`, `formik-rhf-perf-2025`.

**Estimate**: 1–2 days.

---

### C2.4 — Tailwind + shadcn/ui incremental adoption
**Change**: Install Tailwind with prefix `nv-` and preflight off (avoid breaking existing CSS). New components use Tailwind + shadcn/ui (Radix-based, copy-not-deps). Migrate styles.css component-by-component.

**Why**: 647-line global CSS, no design system. PkgPulse 2026: Tailwind dominant; runtime CSS-in-JS dead.

**Sources**: `pkgpulse-styling-2026`, `shadcn-ui`, `tailwind-prefix-strategy`, `radix-primitives`.

**Risk**: medium — requires CSS audit; mitigated by prefix + opt-in.

**Estimate**: 3–4 days for design tokens + first component set; rest amortized.

---

### C2.5 — Extract backend to Hono on a separate port
**Change**: Move `server.ts` route handlers to a Hono app on `:8989`. Vite proxies `/api/*`. Same TypeScript interfaces; no contract change.

**Why**: 1654-line custom middleware in frontend project. Production-readiness.

**Sources**: `hono-bench-2026`, `pkgpulse-hono-2026`, `vite-proxy-pattern`.

**Risk**: low if contract preserved; defer until web shell is stable.

**Estimate**: 2–3 days.

---

## Tier 3 — UX polish (after Tier 1 lands)

### C3.1 — Command palette (⌘K)
**Change**: `cmdk` package. Actions: Go to scene, Go to character, Run simulation, Compose chapter, Switch line, Toggle inspector. Keyboard-first.

**Why**: NN/g recognition; modern table-stakes for creative SaaS.

**Sources**: `cmdk-paco`, `linear-cmdk`, `raycast-pattern`, `nng-recognition`.

**Estimate**: 1–2 days.

---

### C3.2 — CJK-correct prose typography
**Change**: Body line-height 1.7; max-width ~40 CJK chars; serif for prose, sans for chrome; fallback to Source Han Serif / Noto Serif CJK SC.

**Why**: F13. Bagua/八卦 framing implies serious Chinese audience.

**Sources**: `typotheque-cjk`, `butterick-typography`, `ia-100e2r`, `azloc-cjk-fonts`, `source-han-serif`.

**Estimate**: 1 day.

---

### C3.3 — Empty states that teach
**Change**: For each workspace, replace "no data" with example template + "Try this" CTA.

**Why**: F (no onboarding). Plottr/World Anvil pattern.

**Sources**: `plottr-templates`, `worldanvil-templates`, `nng-empty-states`.

**Estimate**: 1 day.

---

### C3.4 — Distraction-free / focus mode for the writing canvas
**Change**: `f` shortcut hides rail + inspector + topbar; clean reading column.

**Why**: iA Writer / Ulysses focus mode is a category default.

**Sources**: `ia-writer-focus`, `ulysses-typewriter`, `bear-focus`.

**Estimate**: 4 hours.

---

## Out-of-scope (intentionally deferred)

- Mobile/tablet support — single user, desktop-first; skip until C0–C2 land
- i18n (English UI) — single Chinese user
- Auth / multi-user — not requested
- Cloud sync — not requested
- Migrating to Next.js / Remix — Patterns.dev 2026 explicitly endorses Vite for this profile
- Replacing DeepSeek / metaphysics module — out of scope
