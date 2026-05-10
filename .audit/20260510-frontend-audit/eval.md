# Eval — Holdout User Flows + Acceptance Tests

5 holdout flows. Each flow has: **steps**, **current pain**, **target behavior**, **measurable check**.

## H1 — "Refresh during compose, keep my place"
**Steps**: Open writing workspace, switch to historical line `L2`, fill lens form (8 fields), click 生成章节, wait. Mid-compose, refresh browser.
**Current**: workspace resets to default; selected line lost; form values lost.
**Target**: refresh lands on `/writing?line=L2&compose=pending`; lens form values persisted (localStorage); compose status restored from server.
**Check**: After refresh, all 8 form fields show pre-refresh values; URL contains `line=L2`; if compose finished mid-refresh, toast announces "章节已生成".

## H2 — "Background runtime — I notice it"
**Steps**: Start simulation auto-run targeting 10 stages. Switch to writing workspace. Wait until runtime completes.
**Current**: writing user has no signal; finds out by switching to runtime workspace.
**Target**: topbar shows pill `Background: 4/10 ticks`. Toast on completion: "Runtime 完成 · 10 stages · 点击查看". URL of writing workspace unchanged.
**Check**: Pill updates < 2 s after each tick; toast fires on completion; no extra polling load on idle.

## H3 — "Wrong world draft — undo it"
**Steps**: Edit world Markdown, accidentally apply with a typo. Realize immediately.
**Current**: no undo; must re-edit 2 KB Markdown by hand.
**Target**: "Revert to previous world" button enabled in world workspace toolbar. Click revert → confirm → session restored to pre-apply state.
**Check**: After revert, `session.world.markdown` matches pre-apply snapshot; simulation/writing context restored if it existed.

## H4 — "Find a memory entry without scrolling"
**Steps**: Open memory workspace with 200 facts, 80 expressions, 30 foreshadows. Find the fact mentioning "苏雪 + 龙脉".
**Current**: scroll through all 200 facts manually; no search.
**Target**: search box top of memory rail; type "龙脉" → list filters to 1–3 entries.
**Check**: Filter latency < 100 ms for 1000 entries (virtualized list).

## H5 — "Compose without reading docs (first-time user)"
**Steps**: Fresh session, Writing workspace open. User clicks 生成章节 with default values.
**Current**: works (defaults populated). But user doesn't know what 焦点角色 / fact-constraint / stage do.
**Target**: every form label has a `(?)` icon → 1-line tooltip on hover. Empty session has a "Try a 5-scene starter chapter" example link.
**Check**: 100% of jargon labels have tooltip; first-load shows starter CTA when `session.chapters.length === 0`.

---

## Acceptance: cross-cutting

- **Vitest**: existing 18 files green
- **TypeScript strict**: no new `any`
- **Bundle size**: + ≤ 200 KB gzipped after Tailwind+shadcn+TanStack Query+Router (Tailwind output is tree-shaken)
- **First Contentful Paint**: ≤ current + 100 ms (measure dev-mode in Chrome perf panel)
- **Workspace switch latency**: ≤ 200 ms perceived (router transition incl. data load skeleton)
- **No regression on the 8 strengths** (S1–S8 in baseline.md)

## Test data sources

- For H1/H2: real session in `.novel-system/runs/`
- For H3: snapshot from `corpus/`
- For H4: existing memory entries in `.novel-system/checkpoints/`
- For H5: fresh in-memory session

## Synthetic vs holdout note

H1–H5 are deliberately **flow-level holdouts**, not unit tests. They mirror real user friction observed in the audit. Synthetic LLM-judge evals would over-fit; these require human or scripted Playwright runs.
