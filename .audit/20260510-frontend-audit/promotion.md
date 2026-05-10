# Promotion — Recommended Patch Path + Rollback

## Sequence (6-week realistic roadmap)

### Week 1 — Pain killers (no architectural change)
Ship as one PR per item, behind the existing app shell:

1. **C1.1 Toast system** (Radix Toast or sonner) — fixes F2/F3
2. **C1.2 Undo for Apply World** — snapshot + Revert button — fixes F4
3. **C1.3 Runtime status pill** — fixes F2
4. **C1.5 Tooltip for jargon** — fixes F8
5. **C1.4 CodeMirror world editor** — fixes F6

**Outcome**: app feels less hostile. No router migration yet. Reversible: each PR can be reverted independently.

**Check**: H2, H3 holdouts pass. Vitest green. No regression on S1–S8.

---

### Week 2 — Foundation (load-bearing)
1. **C0.1 React Router v7** — wire `/writing/:line?`, `/simulation/:stage?`, `/runtime`, `/world`, `/memory/:entry?`, `/atlas/:path?` (one-shot route table; lazy load)
2. Move workspace state out of `useState("workspace")` into route param
3. **C2.2 Zustand** for cross-workspace UI state (panel layout, selected entry, command palette open)
4. **C1.7 TanStack Query** for server state (replace `syncSession` cascade)

**Outcome**: H1 holdout passes (refresh keeps place). Foundation for incremental refactor.

**Check**: H1 passes. Workspace switch latency unchanged.

---

### Week 3 — UX polish on the new shell
1. **C3.1 cmdk** command palette
2. **C3.2 CJK typography pass**
3. **C3.3 Empty states with examples**
4. **C1.6 Virtualized + searchable memory/atlas**

**Outcome**: H4, H5 holdouts pass. App reads as a "modern creative tool".

---

### Week 4 — Workspace consolidation (Strangler Fig)
1. **C0.2 shell**: Activity Bar + main + right Codex rail + bottom panel + status bar
2. Migrate Writing first (highest-traffic), put World/Memory/Atlas as Codex tabs in right rail
3. Simulation → bottom panel; Runtime → status-bar pill
4. **C2.1 feature folders**: extract `src/features/writing/` first, then per workspace

**Outcome**: 6 workspaces collapsed to 1 shell + Codex projections.

---

### Weeks 5–6 — Architectural cleanup
1. **C2.3 react-hook-form + zod** for forms
2. **C2.4 Tailwind + shadcn/ui** with prefix `nv-`, preflight off; migrate component-by-component
3. **C2.5 Hono backend** on `:8989`, Vite proxy
4. Final pass: drop legacy CSS variables that no Tailwind component uses; ship.

---

## Rollback path

| Item | Rollback |
|---|---|
| C1.* (Tier 1) | `git revert <PR>` per item |
| C0.1 router | Keep `useState` shadow path for 1 week, feature-flag with `USE_ROUTER=false` |
| C0.2 shell | Strangler Fig — old workspace render functions remain reachable via `/legacy/<workspace>` for 1 week |
| C2.4 Tailwind | Prefix `nv-` ensures classes don't collide; `git revert` removes Tailwind safely |
| C2.5 Hono | Vite proxy is one config flag; flip back to embedded middleware in 1 line |

## Memory promotion note

After completion, write to local `~/.claude/projects/-Users-chris0810-Documents-Claude/memory/`:
- `novel_system_frontend_state.md` (project) — current shell version, router, state libs, design tokens
- `novel_system_audit_outcomes.md` (project) — link to this audit dir + what shipped vs deferred

Do NOT promote to Hermes memory — this is a personal project, not VPS-relevant. Per `MEMORY_PROMOTION_POLICY.md`: project-local audit ≠ system-level reusable knowledge.

## Approval gates

| Gate | What it gates |
|---|---|
| Gate 0 (now) | This audit is sandbox. No code changed yet. |
| Gate 1 | User approves Tier 1 (Week 1) — pain-killers only |
| Gate 2 | User approves Tier 2 (Week 2) after seeing Week 1 results |
| Gate 3 | Architectural cleanup only after Tiers 0–1 land and tests stay green |

## Stop conditions

- If a holdout flow regresses, revert the offending PR before proceeding to next tier
- If Vitest suite breaks twice for the same root cause, stop and diagnose
- If the user pivots scope (e.g., "drop simulation workspace"), update baseline.md before continuing

## Decision the user must make to start

> "Approve Week 1 (Tier 1 pain-killers)? Y/N. If Y, I propose to do C1.1 + C1.3 + C1.5 in one PR (lowest risk, biggest perceived improvement)."
