# Frontend Review — Novel System `web/` rebuild
Date: 2026-05-10
Scope: `web/src/main.tsx`, `App.tsx`, `lib/*`, `components/AppShell|ActivityBar|CodexRail|CommandPalette|StatusBar|SettingsDialog|BottomPanel`, all 6 `workspaces/*/Route.tsx`, all 3 `workspaces/*/CodexPanel.tsx` (plus `simulation/Panel.tsx` because `BottomPanel`/`SimulationRoute` both render it).

XSS sweep: `grep -rn "dangerouslySetInnerHTML\|innerHTML"` in `web/src/` returns **zero hits**. All untrusted text (memory items, atlas file content, world draft, scene text) is rendered as React children → auto-escaped. No external links / `target="_blank"` in source. No `localhost`, `127.0.0.1`, or `http://` literals in source — all fetches are same-origin path-relative. No CSP regressions surfaced.

Findings below; ordered HIGH → LOW.

---

```
SEVERITY: HIGH
AppShell.tsx:48-72: Global keydown navigates on bare letter keys, captures non-input editable surfaces
WHY: The handler only blocks INPUT/TEXTAREA. Any focused button, contentEditable, or Radix/CMDK popover that consumes letter keys (e.g. typing into the cmdk filter when its `<Command.Input>` is in fact an INPUT — fine — but typing on a button with focus, or the document body) navigates the route. shift+w/alt+w also navigate because only meta/ctrl are filtered. Modal/palette open state is not consulted.
FIX: Skip when (a) `e.metaKey||e.ctrlKey||e.altKey||e.shiftKey`, (b) target.isContentEditable, (c) `useUIStore.getState().commandOpen` or any open Radix dialog (use `data-state="open"` query) — or just require a leader key (e.g. `g w`).
```

```
SEVERITY: HIGH
main.tsx:13-21 + App.tsx:11-25: No ErrorBoundary anywhere
WHY: A single throw inside any workspace render (e.g. an unexpected null in `session.data?.simulation?.lines.map`, a TanStack `throwOnError` future default, or a thrown ApiError that escapes `onError`) unmounts the entire `<RouterProvider>` and shows a blank screen. Sonner Toaster + ReactQueryDevtools also crash with it.
FIX: Wrap `<RouterProvider>` with a top-level `<ErrorBoundary>` (or per-route via `errorElement` on each route in `App.tsx`).
```

```
SEVERITY: HIGH
RuntimeRoute.tsx:27,38,44,50 (and SettingsDialog/WorldRoute/Writing): qc.invalidateQueries() with no key → refetch storms
WHY: Every mutation success calls `qc.invalidateQueries()` with no argument, which marks ALL queries stale. Combined with `refetchInterval` on `/api/session` (8s), `/api/runtime/status` (2.5s in RuntimeRoute, 4s in StatusBar — TWO copies of the same key polling concurrently), `/api/runs`, `/api/memory`, `/api/atlas/tree`, a single Pause click triggers a full cache refetch. Atlas tree alone can be large.
FIX: Replace bare `qc.invalidateQueries()` with `qc.invalidateQueries({ queryKey: ["runtime-status"] })` (and "session" where state actually depends on it). Also dedupe StatusBar+RuntimeRoute polling — share one poll cadence or move the visible interval to status bar only.
```

```
SEVERITY: HIGH
StatusBar.tsx:46,56 + RuntimeRoute.tsx:23: refetchIntervalInBackground:true keeps polling forever on hidden tabs
WHY: Both polls set `refetchIntervalInBackground: true`. `refetchOnWindowFocus` is off globally, so closing the tab is the only way to stop. With session at 8s and runtime at 4s, a multi-hour idle tab generates ~1.6k requests/hour even with the window minimized. RuntimeRoute also adds a 2.5s poll on a duplicate key when on /runtime — three concurrent timers tickle the same endpoint.
FIX: Drop `refetchIntervalInBackground` (default false), and unify the runtime status query so RuntimeRoute reuses the StatusBar query (one cadence, e.g. 4s on screen, paused on blur).
```

```
SEVERITY: HIGH
SettingsDialog.tsx:90-104: form.reset on every server `updatedAt` change blows away user input
WHY: The hydration effect depends on `settings.data?.settings?.updatedAt`. Because `["ai-settings"]` is invalidated by both `save` and `validate` mutations, a refetch lands while the user is still editing in the same dialog (e.g. they typed a new model name, hit "验证 key" first) and `form.reset(...)` clobbers their unsubmitted edits. The eslint-disable hides this.
FIX: Either gate hydration on a `hasHydratedRef` (mirror of WorldRoute pattern), or only reset when the dialog `open` transitions false→true.
```

```
SEVERITY: HIGH
WritingRoute.tsx:120-134: hydration effect depends on only 2 of N lens fields → silent drift; also can overwrite live edits
WHY: The dep array is `[selectedStageId, lens?.chapterGoal]` — if the server lens updates `sceneCount`, `factConstraint`, `targetLength`, or `focusCharacterIds` while chapterGoal is unchanged, the local form silently keeps old values. Conversely, if the user is mid-edit and a `qc.invalidateQueries()` returns a fresh session whose `chapterGoal` differs, the effect calls `form.setValue` and overwrites the half-typed input. Comment "shallow trigger" acknowledges this is a hack.
FIX: Hydrate once on mount (`useRef` guard like WorldRoute) or move to a controlled flow that diffs server vs. dirty fields and only patches non-dirty ones (`form.formState.dirtyFields`).
```

```
SEVERITY: HIGH
WorldRoute.tsx:34-61: undo path bypasses the mutation hook + qc.invalidateQueries() with no key
WHY: The toast `action.onClick` calls `api.post("/api/world/apply", ...)` directly outside any `useMutation`. There is no mutex with a concurrent `apply.mutate()` (user re-clicks 应用), so two parallel POSTs race and the server's last-write-wins. Also `qc.invalidateQueries()` (no key) on success refetches everything (atlas tree included), per finding #3. Lastly `previousDraftRef.current` is set inside the mutationFn at request time but cleared nowhere — second apply uses the value from the first apply, not the actually-applied draft.
FIX: Define a separate `undo = useMutation(...)` so concurrency uses TanStack's mutex; scope `invalidateQueries` to `["session"]` + `["memory"]` + `["atlas-tree"]`; capture `previousDraftRef` from `onSuccess` (the just-applied text) rather than from `mutationFn`.
```

```
SEVERITY: MEDIUM
ActivityBar.tsx:21-33: <button> nested inside <a> (NavLink) is invalid HTML and breaks tab focus
WHY: `NavLink` renders an `<a>`, then `className="contents"` makes the anchor invisible to layout but a `<button>` is still its child. HTML5 disallows interactive content inside `<a>`. In practice browsers handle it, but Tab focuses the anchor (no visible focus ring on `contents`), Enter activates the anchor, Space activates the button — split keyboard semantics. Screen-reader announcement is duplicated ("link, button").
FIX: Drop the inner `<button>` and put `aria-label` + `data-active`/`activity-btn` styles directly on `NavLink`, OR use NavLink with `asChild`-style render only and remove the `<button>`.
```

```
SEVERITY: MEDIUM
CommandPalette.tsx:20-27: window-level Escape listener double-fires with cmdk's internal Escape
WHY: cmdk's `<Command>` already handles Escape to close. Adding a window keydown that also calls `setOpen(false)` means two state writes per Escape, and if the user has refocused outside the palette while it is still mounted, Escape on the body still closes it (potentially desired, but unintended side-effect). Also the backdrop's `onClick={() => setOpen(false)}` does not restore focus to the previously focused element (no `useRef<HTMLElement>(document.activeElement)` save/restore).
FIX: Drop the manual Escape effect (let cmdk handle it). Save `document.activeElement` on open, refocus it on close.
```

```
SEVERITY: MEDIUM
WritingRoute.tsx:169-175: `scenes` dependency identity changes every render → effect runs every render
WHY: `scenes = draft?.sceneDrafts ?? []` produces a fresh array reference each render. The `useEffect` at 173 lists `[scenes, selectedSceneId, setSelectedSceneId]` — Array identity inequality means the effect runs every render. Today it's idempotent (only sets state when `selectedSceneId` is falsy), but in StrictMode dev it sets state on each pass and (more importantly) is a foot-gun for any future "always sync first scene" addition.
FIX: Depend on `scenes[0]?.sceneId` (a primitive) instead of the array. Same for `selectedScene` `useMemo`.
```

```
SEVERITY: MEDIUM
SettingsDialog.tsx:117-128 + 106-115: save and validate share the same invalidation key with no mutationKey/serial
WHY: User clicks 保存 then 验证 quickly. Both POSTs run in parallel; both onSuccess fire `invalidateQueries(["ai-settings"])` and the resulting refetch can race the save's onSuccess. UI may briefly show "已验证" against the old `apiKeyMasked`, then flip. There is no `mutationKey` to serialize.
FIX: Give both mutations the same `mutationKey: ["ai-settings"]` and pass `scope: { id: "ai-settings" }` (TanStack v5) so they queue rather than parallelize, OR explicitly disable buttons while either mutation is pending.
```

```
SEVERITY: MEDIUM
SettingsDialog.tsx:201-205: API-key required-error suppressed when `current?.configured` — but server may still reject empty key
WHY: When already configured, the validation error for `apiKey: z.string().min(1)` is hidden in the UI ("留空保留已存的"), but zod still treats empty as invalid → `form.handleSubmit` blocks `save.mutate(v)` from even running. So submitting with a configured masked key does nothing visibly. Either the schema is wrong (should be `optional()` when configured) or the UX hint lies.
FIX: Make `apiKey` `z.string().optional()` and on submit pre-process: drop the key from payload when blank; keep client-side error display logic for the "fresh setup" case.
```

```
SEVERITY: MEDIUM
StatusBar.tsx:60-64: defensive cast `(runtime.data as any)` masks a real type-shape ambiguity
WHY: The component admits the endpoint sometimes wraps `{runtime: ...}`, sometimes is flat — meaning the server contract is undefined. Behaviour silently changes if the server is inconsistent; e.g. `daemon?.active === true` may evaluate against the wrapper object, not the inner state, leaving `runtimeActive=false` when a run is actually active. A type-safe guard or a server contract narrowing is missing.
FIX: Pin server response shape (one form), then drop the `as any`. If the server can return either, use a Zod parser at the client edge to normalize.
```

```
SEVERITY: LOW
WorldRoute.tsx:23-31 + 38-58: Textarea grows unbounded; large pastes block main thread
WHY: A `<Textarea>` with `style={{ minHeight: '60vh' }}` and no `maxLength` accepts megabyte pastes. Each keystroke re-renders the entire route (no memoization, controlled state), and `apply` ships the whole blob to the server. No debounce, no virtualization. With CodexRail showing `text.slice(0, 600)` on the same `["session"]` query, every paste triggers the WorldCodexPanel re-render too.
FIX: Add `maxLength` (e.g. 200_000) and consider switching to an uncontrolled `defaultValue` + `useRef` until the planned Monaco/CodeMirror upgrade lands.
```

```
SEVERITY: LOW
MemoryRoute.tsx:48-83 + CodexPanel.tsx:24-26: lists capped at 200 / 8 — no virtualization, but mitigated
WHY: `MemorySection` slices to first 200 with a count footer; CodexPanel slices to 8. For now this is fine, but if memory grows past 10k items the filter useMemo iterates all items per keystroke. No debounce on the filter input.
FIX: Add a 150ms debounce to filter, virtualize with @tanstack/react-virtual when item count exceeds ~500.
```

```
SEVERITY: LOW
WritingRoute.tsx:325-329: scene text split on `\n+` with `key={i}` index keys
WHY: Index keys are okay here because paragraph order is stable per scene. However, `selectedScene` switching between scenes can keep stale React fiber state (e.g. selection within a `<p>`) — minor visual flash. Not a correctness bug.
FIX: (Optional) `key={`${selectedScene.sceneId}-${i}`}` to force unmount on scene change.
```

```
SEVERITY: LOW
api-client.ts:14-40: no AbortController, no timeout, no auth header
WHY: `fetch` has no abort wiring; a hung request stays open forever (no client-side timeout). TanStack Query won't abort the underlying fetch on `cancelQueries`. For an LLM-backed compose endpoint that already has a 600_000ms server timeout, a stuck network can leave the UI spinning indefinitely.
FIX: Accept `signal?: AbortSignal` from caller, attach to fetch options, and let TanStack pass `queryFn({ signal })` through.
```

---

## Confidence summary
**Confidence: HIGH** for all findings flagged HIGH — they are pattern-level (XSS sweep clean; missing ErrorBoundary; bare `invalidateQueries()`; `refetchIntervalInBackground:true`; effect-overwrites-form pattern). I read every requested file fully (incl. `simulation/Panel.tsx` because `BottomPanel`/`SimulationRoute` render it).
**Confidence: MEDIUM** for the "double polling" and "validate vs save race" — depends on observed user behavior; reproducible by clicking buttons quickly.
**No XSS or data-exfil paths surfaced.** All untrusted server text reaches the DOM via React children only; no `dangerouslySetInnerHTML`, no untrusted href/src construction, no `target="_blank"`.
**Total findings:** 17 (7 HIGH, 6 MEDIUM, 4 LOW).
