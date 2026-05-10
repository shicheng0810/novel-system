# Critical Survey: Modern React Architecture Patterns (2026)

**Audience:** Audit team for a React 18 + Vite SPA (~30K LOC, single-team, AI-heavy, possibly internal-only).
**Symptoms diagnosed:**
- Single 1659-line `App.tsx` with all 6 workspaces, 30+ `useState`, 27 async handlers
- 647-line global `styles.css` (no CSS modules / Tailwind)
- No router — workspaces switched by conditional rendering
- Manual `fetch` (no React Query / SWR / tRPC)
- Embedded Vite middleware backend (1654 lines) co-located with frontend
- TypeScript strict, Vitest tests

**Date retrieved:** 2026-05-09. **Source pool:** ~45 cited works, primarily 2024–2026.

---

## 1. Component Decomposition / Large-Component Refactor

### 1.1 The "God Component" diagnosis

A 1659-line `App.tsx` that orchestrates six workspaces, manages 30+ `useState` slots, and dispatches 27 async handlers is the textbook **God Component** anti-pattern: a single component that owns state, side effects, IO, and presentation across multiple unrelated domains. The Single Responsibility Principle (SRP) violation here is total — touching any handler risks breaking unrelated workspaces, and reasoning about the render tree is impossible without a debugger [DEV: Taming the God Component] [perssondennis: React anti-patterns].

Priya Khanna's framework-agnostic **Component Responsibility Score (CRS)** (DEV, 2026) gives a usable threshold:
- CRS < 50 = healthy.
- CRS 50–100 = monitor; pin down behavior with tests before adding features.
- CRS > 100 = **Refactor Alert**: stop adding features.

A 1659-line file with 6 workspaces, 30+ states, and 27 async handlers will score well above 100. Refactor is non-optional.

### 1.2 Kent C. Dodds: extraction patterns

Kent's canonical pieces — *Advanced React Component Patterns*, *React Hooks: Compound Components*, *Testing Implementation Details* — establish the modern decomposition vocabulary [kentcdodds.com]:
- **Compound components** — components that share implicit state through context (`<Tabs>/<Tabs.Tab>`). The ergonomic core of Radix, Headless UI, Reach UI, Ark UI.
- **Custom hooks as the new "container"** — instead of a dumb `<XContainer>` wrapping a `<XPresenter>`, extract logic into `useX()` and let the component consume it. The container/presentational *separation of concerns* survives, but the *implementation* is now hooks-based [Patterns.dev: Container/Presentational; mirrorcodex.com].
- **Headless components** — logic-only components/hooks (Radix UI, Ark UI) that you render into your own JSX. This pattern dominates 2026 design systems.

### 1.3 When to break a 1500-line file — heuristics

Synthesizing across sources (Alex Kondov, Robin Wieruch, Bulletproof React, CRS):
1. **Hard rule (Wieruch 2025, Kondov):** keep components under ~250 LOC; functions under ~50 LOC.
2. **Cohesion test:** if two `useState`s "always change together" they should be unified (often via `useReducer`); if two `useState`s never read each other, they belong in different components [react.dev: Choosing the State Structure; Frontend Masters: Redundant State Anti-Pattern].
3. **Workspace-per-file rule:** any independently-navigable section ("workspace", "tab", "drawer") deserves its own file + folder.
4. **Async handler ceiling:** more than ~5 async handlers in one component is a strong signal that data-fetching belongs in a query layer (TanStack Query) and side effects belong in dedicated hooks.
5. **Strangler-Fig migration** (Shopify Engineering, MaibornWolff, AWS Prescriptive Guidance): refactor incrementally — extract one workspace at a time behind a stable seam. Do NOT do a big-bang rewrite. Run old and new code side-by-side; redirect one workspace at a time.

### 1.4 Recommended path for the audited app
Apply Strangler-Fig: extract one workspace per PR into `src/features/<workspace>/`, keeping `App.tsx` as a thin shell that becomes a router config plus layout. Target post-refactor: `App.tsx` < 150 LOC; each workspace 150–400 LOC plus its own hooks/services.

---

## 2. State Management for Complex SPAs (2025–2026)

### 2.1 The 2026 expert consensus

Across PkgPulse, Syncfusion, Better Stack, Refine, Robin Wieruch, Mark Erikson, and Theo Browne the 2026 picture is unusually consistent:
- **Zustand is the pragmatic default** — ~1.2KB, ~20M weekly downloads, "becoming the de facto standard" [Wieruch 2025]. Robin reports he hasn't used Redux in his recent freelance work, defaulting to Zustand. Theo Browne uses Zustand to centralize game/UI logic in his own projects [grokipedia.com]. Mark Erikson himself, the Redux maintainer, "can't make himself say 'you should use Redux'" — Redux is for *enforced patterns + time-travel debugging in large teams* [Erikson, Async/TechConnection 2024].
- **Redux Toolkit** = correct call only when team size + middleware ecosystem (sagas, time-travel, devtools) are critical [redux-toolkit.js.org].
- **Jotai** = best when state is *atomic and derived-heavy* — granular re-renders matter (think CAD, music apps, nested editors) [jotai.org/comparison].
- **React Context** = simple cross-cutting prop-drilling avoidance, *not* a state-manager.
- **Signals** are coming (preact-signals, the upcoming React proposal) but not consensus yet [PkgPulse 2026].

### 2.2 Why "useState everywhere" doesn't scale (concrete failure modes)
From LogRocket, Persson Dennis, Frontend Masters, react.dev:
1. **Redundant/derived state** — storing computed values as state means every contributor must remember to keep them in sync; the inevitable bug is forgetting to update the derived slot. Solution: derive in render or `useMemo`.
2. **Prop drilling collapse** — by the 4th-level component, prop signatures become unreadable; lift to context or store.
3. **Re-render storm** — every `setState` in a parent re-renders all descendants by default. With 30 useStates, the whole tree thrashes on any change.
4. **Stale closure bugs** — async handlers capture state by closure; running multiple handlers in a 27-handler component leads to "why is this stale?" bugs.
5. **No undo / no debugging history** — flat `useState` provides no redo, no time-travel, no devtools narrative; this matters for AI-heavy apps where users want to compare model outputs across runs.

### 2.3 Server state — TanStack Query vs SWR
**TanStack Query is the professional standard** for *server state* in 2026 [DEV: Why Senior Devs Choose TanStack; Wisp; weblogtrips]. Benefits over `useEffect`:
- Built-in caching (default 5 min stale time), automatic refetch on focus/reconnect, request deduplication, optimistic updates with rollback, mutation rollback, devtools.
- Eliminates ~50% of `useState/useEffect` data-fetching boilerplate.
- Race conditions, network waterfalls, and stale closure bugs go away.

**TanStack Query (~16.2KB) vs SWR (~5.3KB)**: SWR is lighter and Vercel-friendly but lacks the rich mutation system + devtools. For an AI app where you want **optimistic mutation rollback** (model run failures, edit conflicts), TanStack Query is the safer choice [Markaicode; Refine 2025; Digital Thrive].

### 2.4 Form state — react-hook-form is the 2026 default

**Formik is in maintenance mode** — no recent commits or releases [Refine; LogRocket; Joyfill]. **react-hook-form + Zod** is the new industry standard [annauniversityplus 2026]:
- Uncontrolled / ref-based — re-renders only on submit/validate by default.
- 9KB gzipped, zero deps; Formik is ~13KB with deps and re-renders on every keystroke.
- Integrates natively with Zod, Yup, Valibot.

For an AI-heavy app whose forms include long prompts and complex parameter sets, the re-render savings alone justify migration.

---

## 3. Routing for SPAs

### 3.1 React Router v7 vs TanStack Router vs Wouter

| Router | Bundle (gzip) | Type-safety | Dev tools | Sweet spot |
|---|---|---|---|---|
| **React Router v7** | ~17KB | Good in framework mode; weaker in pure SPA mode | Good (devtools, in framework mode) | Battle-tested, Remix-derived; default for most teams |
| **TanStack Router** | Heavier than RR but not large | **100% type-safe** end-to-end; URL→state→data→UI | Best-in-class — full route tree, search params, loader state | Type-strict teams, complex search params, loader-based UIs |
| **Wouter** | **~1.3KB** | Minimal; relies on hooks | None | Tiny apps, demos, performance-first internal tools |

Sources: [TanStack Router docs/comparison; Better Stack; pkgpulse; Medium ekino; LogRocket; Habile Labs; molefrog/wouter on GitHub].

### 3.2 Why URL-routable workspaces matter

[Kirill Rakhman: Respecting Browser Navigation; Stanford CS142 SPA notes; bennadel.com; codemag]
- **Deep linking** — share a URL to a specific workspace state.
- **Refresh persistence** — users don't lose context on F5.
- **Browser back/forward** — restores expected mental model.
- **Bookmarks** — users can save workspace+filter combinations.
- **Telemetry & error reports** — "what URL was the user on" becomes meaningful.
- **AI-app-specific** — users want to bookmark "Run X with prompt template Y", which is impossible with conditional rendering.

URL state is the *cheapest, most durable* form of state. As a heuristic from Robin Wieruch: URL state, server cache (TanStack Query), and (for SSR) Server Components together remove most of the need for client state.

### 3.3 Should we migrate to Next.js or Remix?

Decision factors for an internal-only, single-team, AI-heavy SPA [Patterns.dev: React Stack 2026; remix.run; nucamp; pkgpulse]:
- **Next.js** wins on RSC, server-side data fetching, deployment ergonomics — but adds substantial complexity (App Router mental model, Vercel preferences, server actions). Overkill for "single team, possibly never deployed publicly."
- **Remix / React Router v7 framework mode** fits internal apps better; smaller bundles (~30% smaller than Next), thinner abstraction.
- **Vite + library SPA** (the audited app's current shape) — the explicit recommendation in Patterns.dev's *React Stack 2026*: "For smaller, internal, or highly custom SPAs, use Vite + libraries instead of frameworks."

**Recommendation:** stay on Vite + React. Add **TanStack Router** (for type-safe loaders + search params, which suits AI workflows where every parameter matters) or **React Router v7 in SPA mode** if you want a wider ecosystem.

---

## 4. Styling at Scale

### 4.1 The 2026 consensus

[PkgPulse: State of CSS-in-JS 2026; Solid-Web; Frontend Hero; Syncfusion]:
- **Runtime CSS-in-JS is over.** Styled-components is in maintenance mode. Emotion's own maintainer has pivoted away from runtime CSS-in-JS. RSC incompatibility was the death blow.
- **Tailwind dominates new projects** (~12M weekly downloads, +100% over 3 years). Default in shadcn/ui and most AI code generators. ~10–30KB total CSS regardless of project size.
- **CSS Modules** — quietly winning for component-level styles where Tailwind utility soup would be unreadable.
- **vanilla-extract / Panda CSS / StyleX** — zero-runtime, type-safe; chosen by large design systems with multi-theme requirements.
- **Many mature codebases mix:** Tailwind for layout/spacing, CSS Modules for complex components, CSS custom properties for theming.

### 4.2 Component libraries for a creative-tool theme

[makersden; pkgpulse; designrevision; uideck; boundev]:
- **shadcn/ui** is the 2026 default for new React apps. **Not a npm package** — a CLI scaffolds Radix-based, Tailwind-styled components into *your* repo. You own the source. Perfect for a creative tool because you can fork/restyle freely without forking a library. It now supports both Radix and Base UI primitives.
- **Radix UI** — unstyled primitives. Best when you want full design control and accessibility for free.
- **Mantine** — 120+ components, built-in hooks (`useForm`, `useNotifications`, `useFocusTrap`); CSS Modules-based in latest releases (no runtime overhead). Strong for productivity tools/dashboards.
- **Chakra UI** — fast prototyping, accessibility-first; runtime CSS-in-JS (Emotion) — losing momentum.
- **Ant Design** — enterprise/admin UIs, heavy footprint, *not* a great match for a creative tool aesthetic.

**For a creative-tool theme:** shadcn/ui + Radix + Tailwind + custom design tokens via CSS variables is the path of least friction. Mantine is the runner-up if you want batteries-included.

### 4.3 Migrating from a 647-line global stylesheet — incremental wins

[tailwindgenai; johnzanussi; st6.io; medium kevin; designrevision]:
- **Disable Tailwind's preflight** initially (`corePlugins: { preflight: false }`) — keeps the existing global stylesheet's resets working.
- **Add a Tailwind prefix** (`prefix: 'tw-'`) to avoid class collisions during the cutover.
- **File-by-file migration.** Pick one component, replace its scoped global CSS with Tailwind classes, verify pixel-perfect, commit, repeat.
- **Migrate from largest breakpoint down** — desktop layout first, then add `sm:`, `md:` modifiers.
- **Final pass:** re-enable preflight, drop the prefix, delete the orphan global CSS rules.

A 647-line stylesheet typically maps to ~15–25 components. Allow 1–2 weeks of part-time work for the migration if done strangler-fig style.

---

## 5. Multi-Pane / IDE-Like UIs in React

### 5.1 The library landscape

[mathuo/dockview; bvaughn/react-resizable-panels; dockview.dev; mulberryhousesoftware: allotment]:

| Library | Bundle | Capabilities | Used by |
|---|---|---|---|
| **bvaughn/react-resizable-panels** | small | Horizontal/vertical resizable groups, **built-in `autoSaveId` localStorage persistence**, conditional panels with separate persisted layouts | shadcn/ui's Resizable component, many indie tools |
| **Allotment** | medium | Inspired by VS Code's split pane | Smaller tools |
| **Dockview** | larger (zero-dep) | Full IDE: tabs, groups, grids, splitviews, drag-drop, **floating panels, popout windows**; React/Vue/Angular/vanilla; portions inspired by VS Code source | IDE-like apps |
| **react-dock** | small | Dock/float/tab panels | Custom dashboards |

### 5.2 How real apps do it

- **VS Code** — splitview/gridview at the core (Dockview is partly derived from this code).
- **Linear** — three-pane (sidebar / list / detail), simple resizable panels backed by localStorage.
- **Notion / Obsidian / Cursor** — variations on three-pane with sliding-pane modes; Cursor specifically uses separate panes for editor and preview while Obsidian's "Live Preview" merges them [makeuseof; medium @takahashinaoki521].
- **Common pattern:** sidebar (collapsible) → list/explorer (resizable) → main/detail (resizable) → optional inspector (collapsible). State persistence via `autoSaveId` or custom storage hook.

### 5.3 Recommendation

For an audit subject already using global CSS and conditional rendering, the lowest-friction upgrade is **react-resizable-panels** (it's what shadcn/ui uses). Use `autoSaveId="workspace-layout"` for free localStorage persistence. Reach for **Dockview** only if you genuinely need tabs + drag-drop + floating windows (i.e., you're building an IDE, not a 3-pane app). Keep layout state in localStorage; never put it in a server-fetched store.

---

## 6. Code Organization

### 6.1 Feature-folder vs layer-folder

[bulletproof-react/docs; Robin Wieruch: Folder Structure; Profy.dev: Screaming Architecture; Sergio Azocar; thetshaped.dev]:

**Layer-folder** (current state of the audited app):
```
src/
  components/   <-- ~50+ files, becomes a junk drawer at ~15-20
  hooks/
  utils/
  api/
```
Breaks down once "components" exceeds ~15–20 because nothing tells you which feature a component belongs to. Cross-feature changes become archaeological.

**Feature-folder** (the consensus 2026 default):
```
src/
  features/
    workspaceA/
      components/
      hooks/
      api/
      types.ts
      index.ts        <-- public API surface
    workspaceB/
      ...
  shared/             <-- only truly cross-cutting code
  app/                <-- routes, providers, layout shell
```

Bulletproof React's specific rules (alan2207):
1. **Most code lives in `features/`.**
2. **No cross-feature imports** — features compose at the app level.
3. **Each feature has a public `index.ts`** — outsiders consume that, not internals.
4. **Avoid barrel files in features** — they break Vite tree-shaking.
5. **Use absolute imports** (`@/features/x`) — refactor-friendly.

### 6.2 Screaming Architecture

[Sergio Azocar; Mykhailo Hrynkevych on Medium; Albert Barsegyan, *Best React.js Architecture for 2026*]:
> "Your project structure should *scream* what the app does, not what it's built with."

For the audited 6-workspace AI app, that means top-level folders should be the workspace names — `prompts/`, `runs/`, `evals/`, etc. — not `components/`, `hooks/`, `utils/`. New contributors should see the file tree and immediately understand the product.

### 6.3 Where to put types/hooks/services in a 30K-LOC codebase

- **Feature-local first** (colocate). Move to `shared/` only when ≥2 features import it.
- **Types** — colocate with the code they describe. Cross-feature types in `shared/types/`.
- **Hooks** — feature-specific in `features/<x>/hooks/`; reusable in `shared/hooks/`.
- **Services / API clients** — Bulletproof React allows a top-level `api/` folder when many features share endpoints, *or* feature-local when bounded. For a 30K-LOC codebase it's usually cleaner to keep API calls per feature and only the HTTP transport layer (interceptors, auth) shared.

---

## 7. Embedded Dev Backend (Vite middleware) — Smell?

### 7.1 What you have

A 1654-line backend running as Vite middleware (`configureServer` hook) in the same Vite project. This works in development because Vite's `configureServer` runs middleware before Vite's internal handlers [vite.dev: Backend Integration; vite.dev: SSR; xjamundx on DEV].

### 7.2 When Vite middleware breaks down

[github discussion #6562; dev.to/codeparrot; rocambille.github.io]:
- **No production story.** Vite's dev server is not a production server. You will need to extract the backend before production deploy anyway.
- **HMR coupling.** Backend errors crash the Vite dev server; restart loses HMR state.
- **No process isolation.** Backend code runs in the Vite process's event loop; long-running tasks (model calls) block HMR.
- **Type sharing without RPC.** You miss out on tRPC's end-to-end types.
- **Testing pain.** Vitest fixtures awkwardly straddle the middleware boundary.
- **Scaling horizontally is impossible.** No separate process = no horizontal scaling, no independent restart, no sidecar containers.

### 7.3 The four extraction options

1. **Vite + custom plugin (status quo)** — fast iteration, no extra port; *unsuitable for production*. Works for prototyping only.
2. **Hono on a separate port** — 14KB, web-standards-API, runs on Node/Bun/Deno/Workers, modern, fast cold start, stable [pkgpulse: Express vs Hono 2026]. **Pragmatic default for new JS APIs in 2026.**
3. **tRPC** (with any host: Hono, Express, Next.js Route Handlers) — end-to-end type-safe RPC. Best when frontend and backend are in the same monorepo and one team owns both. tRPC v11 (mid-2025) supports React Server Components and server actions natively. Tradeoff: tightly couples FE/BE — harder to add a second client (mobile, CLI) later.
4. **Next.js Route Handlers** — only if you migrate to Next.js. For a Vite SPA, this means a framework rewrite.

### 7.4 Recommendation for the audited app

Migrate the 1654-line backend to **Hono on a separate port** (3001 or similar) with Vite proxying `/api/*` to it via `server.proxy`. This:
- Decouples HMR from backend crashes.
- Lets you deploy the backend as its own container when needed.
- Lets you add tRPC on top of Hono later for typed RPC.
- Keeps the dev experience identical (Vite proxy is invisible to the SPA).

Hono is also runtime-agnostic (Bun, Deno, Workers), so you preserve future deployment flexibility.

---

## 8. Testability

### 8.1 React Testing Library best practices

Kent Dodds' canonical testing principles [kentcdodds.com: Testing Implementation Details; Introducing react-testing-library; Testing React Apps]:
> "The more your tests resemble the way your software is used, the more confidence they can give you."
- **Don't test implementation details** — internal `useState` shape, ref values, `openIndex` private state. Tests on implementation details break on refactor *and* fail to break on regressions.
- **Query the way users do** — `getByRole`, `getByLabelText`, `getByText`. Avoid `getByTestId` except as last resort.
- **userEvent over fireEvent** — userEvent simulates real interaction sequences (focus, hover, key sequences).

### 8.2 Component testing for hook-heavy components

[testing-library/react-hooks-testing-library; Toptal; UXPin; Webbylab]:
- **Don't test single-use custom hooks in isolation.** Test the component that uses the hook.
- **Use `renderHook` only for reusable hooks** — those that ship as a utility.
- **Wrap context-consuming hooks** with the `wrapper` option for `renderHook`.
- **Mock the network at the boundary** (MSW), not inside individual hooks.

### 8.3 Vitest `expect.poll` for async UIs

[vitest.dev/api/expect; main.vitest.dev/guide/learn/async; medium @reph05]:
- `expect.poll(callback).toBeTruthy()` retries the assertion until it passes or the timeout expires. Useful for streaming AI outputs, optimistic UI rollbacks, debounced filters.
- **Vitest 3+: must be awaited** — forgetting `await` triggers a warning and fails the test.
- **Limitations:** snapshot matchers, `.resolves`/`.rejects`, `toThrow` are not supported with `expect.poll`.
- For async DOM presence, prefer `await expect.element(page.getByText(...)).toBeInTheDocument()` (browser mode) which renders better diagnostics than poll.

### 8.4 Recommendation for the audited app

Pair RTL with MSW for network mocks; use `expect.poll` for streaming AI responses; abandon any tests that grep internal state via `wrapper.state()` or refs — they're fragile and won't survive the strangler-fig refactor.

---

## 9. Decision Matrix for *This* App

Constraints recap: single-team, ~30K LOC, AI-heavy, possibly never deployed publicly, React 18 + Vite, TS strict, Vitest, no current router, embedded backend.

| Concern | Recommendation | Confidence | Why this fits *us* |
|---|---|---|---|
| Component decomposition | Strangler-fig: feature-folder per workspace; `App.tsx` → router shell only | **High** | Bounded blast radius; PR-by-PR migration; tests can be added alongside. |
| Client state | **Zustand** for cross-cutting UI state; `useReducer` for local complex state | **High** | 1.2KB; Robin/Theo consensus; handles AI session state cleanly. |
| Server state | **TanStack Query** for all backend calls + AI runs (with optimistic mutations) | **High** | Removes ~50% of useEffect boilerplate; mutation rollback critical for AI |
| Form state | **react-hook-form + Zod** | **High** | Formik unmaintained; perf gains matter for prompt-heavy forms |
| Routing | **TanStack Router** if type-safe search params matter; otherwise **React Router v7 SPA mode** | Medium | TanStack wins for AI param-heavy URLs; RR7 wins on ecosystem familiarity |
| Framework migration | **Stay on Vite + libraries** | **High** | Single-team internal app — Next/Remix overkill |
| Styling | **Tailwind + shadcn/ui** with strangler-fig over the 647-line CSS file | **High** | 2026 default; shadcn fits a creative tool because you own the source |
| Multi-pane layout | **react-resizable-panels** with `autoSaveId` | **High** | Used by shadcn; localStorage built in |
| Folder structure | **Feature-folder + screaming architecture**; bulletproof-react conventions | **High** | Best fit for 6-workspace product |
| Embedded backend | **Extract to Hono on port 3001**; Vite proxies `/api/*` | **High** | Runtime-agnostic, modern, decoupled HMR; tRPC layered on top later if desired |
| Tests | **RTL + MSW + Vitest `expect.poll`** for streaming AI; drop implementation-detail assertions | **High** | Survives refactor; mirrors user paths |

### 9.1 Sequencing (suggested 4-phase plan)

**Phase 0 — preparation (1 sprint).** Add TanStack Query, Zustand, react-router-v7 (or TanStack Router); freeze the 647-line CSS as `legacy.css`; install Tailwind with `prefix:'tw-'` and `preflight:false`.

**Phase 1 — extraction (2–4 sprints).** Strangler-fig one workspace per PR into `src/features/<x>/`. Wrap each in a route. Migrate its global CSS rules into Tailwind utilities or a CSS Module. Replace its `useEffect`-fetches with TanStack Query.

**Phase 2 — backend split (1 sprint).** Extract Vite middleware into a Hono server on port 3001. Configure Vite proxy. Consider tRPC v11 layered on Hono if the team is comfortable.

**Phase 3 — polish (1 sprint).** Drop the Tailwind prefix and re-enable preflight; delete orphan rules from `legacy.css`; add `react-resizable-panels` for the IDE-like layout; add layout persistence; clean up the test suite.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Strangler-fig stalls; old + new code coexist forever | Set explicit "freeze" date for old paths; track migration % in CI |
| Tailwind class soup in JSX | Adopt `cn` utility + `clsx` + extract repeated patterns into shadcn-style components; use `@apply` sparingly |
| TanStack Query cache key drift between modules | Centralize keys in `features/<x>/queries.ts`; treat keys as a contract |
| Zustand store becomes the new God object | Split into per-feature slices; never a single mega-store |
| Hono extraction breaks dev parity | Add a `dev` script that starts both processes; ensure `.env` parity |
| Test suite grows brittle during migration | Convert implementation-detail tests to user-flow tests *before* the strangler move; aim for `data-testid` only as last resort |

---

## 11. Source Cards (machine-readable list at end of file; full JSON in companion file)

Sources are inlined throughout. The full machine-readable list lives in `source_cards_react_architecture.json` (45 cards). High-impact citations summarized:
- Kent C. Dodds, *Testing Implementation Details* — testing canon.
- Robin Wieruch, *React Libraries for 2025* — Zustand-default consensus.
- Mark Erikson, *Why You Should Use Redux in 2024* — when (not) to pick Redux.
- Patterns.dev *React Stack 2026* — Vite + libraries for internal SPAs.
- Bulletproof React (alan2207) — feature-folder canon.
- PkgPulse, *State of CSS-in-JS 2026* — runtime CSS-in-JS dead.
- TanStack Router docs / comparison — type-safe routing.
- bvaughn/react-resizable-panels README — `autoSaveId` persistence.
- Vite docs (Backend Integration, SSR) — middleware tradeoffs.
- DEV / Priya Khanna — Component Responsibility Score.
- Shopify Engineering, MaibornWolff, AWS Prescriptive Guidance — Strangler Fig.

---

## 12. Executive Recommendation (for the report consumer)

The audited app exhibits four classic 2024-era smells: (1) a God component, (2) `useState` overuse, (3) zero-router conditional rendering, (4) global stylesheet. These are *not* lethal but they compound; every new feature gets harder. The 2026 consensus stack — Vite + TanStack Query + Zustand + React Router (or TanStack) + Tailwind + shadcn/ui + react-hook-form + react-resizable-panels — is *exactly* the modernization target, and it can be reached with a 4-phase strangler-fig migration that preserves working software at every step. Extract the embedded Vite-middleware backend to Hono on a separate port early to decouple HMR pain from backend pain. Choose feature-folder + screaming architecture from day one of the migration. Don't migrate to Next.js / Remix unless an external-deployment story emerges; the internal-tool-on-Vite path is well-trodden in 2026.
