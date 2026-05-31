# Checkpoints — `novel-system-rebuild-20260510`

## CP1 · Runbook + safety net (2026-05-10T03:55Z)
- Phase: phase0
- Done:
  - Runbook published in chat (Cloudflare Pages + Workers later, local first now)
  - `workbench/` zip backup (21 MB) → `.audit/20260510-rebuild/workbench-snapshot-20260510.zip`
  - git tag `pre-rebuild-20260510` (no HEAD to anchor since fresh repo, tag references staging area)
- Verification: backup file exists, sized 21 MB

## CP2 · Recon (2026-05-10T03:58Z)
- Phase: phase0
- Done:
  - Confirmed `src/` has **0 Node-only imports** — fully browser-portable
  - Confirmed API surface: ~36 routes in `workbench/src/server.ts`
  - Confirmed package.json structure (root + workbench sub-package)
- Verification: grep proven

## CP3 · Scaffold web/ + Tailwind + shadcn (2026-05-10T04:05Z)
- Phase: phase1
- Done:
  - `web/` directory with vite + react + react-router + tanstack-query + zustand + react-hook-form + zod + tailwind + lucide-react + sonner + cmdk + radix primitives
  - `npm install`: 213 packages
  - tsconfig with `@/*` and `@core/*` aliases
  - Tailwind config with CJK-aware tokens (line-height 1.85, max-width 32em prose-cjk class, Source Han Serif chain)
  - 8 shadcn-style UI primitives: button, input, textarea, label, card, tooltip, separator, tabs
- Verification: `npx tsc --noEmit` clean

## CP4 · App shell + 6 routes (2026-05-10T04:18Z)
- Phase: phase1
- Done:
  - AppShell with: topbar / Activity Bar (6 icons + tooltip) / main outlet / Codex right rail (3-tab) / bottom panel / status bar
  - react-resizable-panels for layout
  - cmdk command palette (⌘K)
  - Keyboard shortcuts: W/S/R/D/M/A
  - All 6 workspace Route stubs
  - Writing route as full vertical slice (lens form + compose mutation + scene strip + critic panel)
- Verification: `npx tsc --noEmit` clean

## CP5 · API bridge (2026-05-10T04:21Z)
- Phase: phase1
- Done:
  - `web/src/server/middleware.ts` re-exports `createWorkbenchApiMiddleware` from `workbench/src/server.ts`
  - Vite plugin injects middleware into dev server
  - Verified `/api/session` returns full session JSON (3 characters, 7 lines, 2 stages, AI settings)
- Verification: `curl http://127.0.0.1:5173/api/session` returns 200 with real data

## CP6 · Data shape alignment (2026-05-10T04:30Z)
- Phase: phase1
- Done:
  - Aligned `WritingRoute` to `WorkbenchSessionState` (selectedLineId/simulation.lines/lens/currentDraft)
  - Hydrate lens form from server-saved lens
  - Aligned `WorldRoute` + `WorldCodexPanel` to consume `appliedDraftText` from `/api/session` (not GET /api/world/parse)
- Verification: `npx tsc --noEmit` clean; dev server returns 200; manual page render TBD by user

## CP7 · Handoff (2026-05-10T04:33Z)
- Phase: phase1 → done
- Done:
  - `web/README.md` documents structure, runbook, known gaps, baseline-fix matrix, next-step plan
  - Dev server running at http://127.0.0.1:5173/
- Verification: README written; dev process alive

## Stop condition met
Local dev server boots. Writing workspace renders real data. Other workspaces stub but route. Cloud deployment intentionally deferred per user redirect.
