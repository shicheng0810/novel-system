# Novel System · v3

This directory hosts the v3 architecture rewrite. See the full plan in
`/root/.claude/plans/system-reminder-you-re-running-in-buzzing-kitten.md`.

## Layered structure (Layer 0 → Layer 6)

```
src/v3/
  domain/        # Layer 1 — pure types + domain logic, zero IO
  data/          # Layer 0 — single-SQLite schema + open/migrate
  services/      # Layer 2 — one resource each; depend only on domain + data
    llm/
    embedding/
  metaphysics/   # Layer 1.5 — bazi / qimen / bagua + frame + prior scorer
  engine/        # Layer 3 — single tick loop with composable phases
    phases/
      compose/   # 6 sub-phases: memory-read → blueprint → scene-cards → synthesize → review → inscribe
  director/      # decides what each tick does
  agents/        # per-character reflect / plan
  daemon/        # Layer 4 — single loop runner (replaces 3-layer daemon stack)
  verify/        # slop + xianxia checkers
  server/        # Layer 5 — HTTP actions + SSE event stream
```

## Phase status

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + clear broken exports | ✅ done |
| 1 | Data plane (SQLite schema) + Domain types | ✅ done |
| 2 | Services (event-bus, world-store, memory, atlas, llm, embedding) | ✅ done |
| 3 | Metaphysics-as-prior (real candidate scorer) | ✅ done |
| 4 | Tick engine + director + character agents + verifiers | ✅ done |
| 5 | Daemon + HTTP/SSE surface | ✅ done |
| 6 | Frontend rewrite (zustand + SSE + feature split) | ✅ done |
| 6.5 | Codex Rail tabs · Bottom Panel · 6-stage 灯轨 · `/` & ⌘K · ChapterView · WorldUploader · SettingsModal | ✅ done |
| 7 | Markdown parser · AI settings + chapters API · DeepSeek auto-wire · v3.1 schema · bug fixes · dead-code purge · docs | ✅ done |

## Hard invariants

1. Every commit: `npm run check` + `npm test` + `npm --prefix workbench run build` all clean.
2. WorldEvent is single source of truth — every world-state change goes through emit + reducer.
3. emit failures never propagate to business paths (try/catch + log).
4. `domain/*` only imports `domain/*` (architecture test enforces this in Phase 7).
5. Tick is atomic — checkpoint between phases; crash mid-tick = resume from last phase.
6. Daemon is singleton per process.
7. Frontend uses only zustand (no redux/jotai/recoil).
8. Prose canvas is never compressed by overlay UI.
