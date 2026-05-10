# Persistent Runtime Daemon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make backend world simulation able to continue across multiple stages without repeated browser clicks, while preserving CanonGate pauses and run artifact persistence.

**Architecture:** Add a `PersistentRuntimeDaemon` service around `NovelRuntimeKernel.tick()`. Wire it into Workbench as backend runtime start/pause/resume/status endpoints, and change `runAuto` so one request can advance the requested number of stages. Keep all mutation serialized by the existing runtime worker/kernel path.

**Tech Stack:** TypeScript, Vitest, Node HTTP server handlers, existing `NovelRuntimeKernel`, `WorldDaemon`, `SimulationRunStore`, Vite Workbench API.

---

## File Structure

- Create `src/persistent-runtime-daemon.ts`: backend daemon loop, progress snapshot, start/pause/resume/status/waitForIdle.
- Modify `src/runtime-types.ts`: runtime daemon snapshot and start request types.
- Modify `src/index.ts`: export the new daemon module.
- Modify `workbench/src/contracts.ts`: expose runtime daemon request/response types to UI/API.
- Modify `workbench/src/api.ts`: add runtime start, pause, resume, status calls.
- Modify `workbench/src/server.ts`: keep one daemon per handler instance and route new runtime endpoints.
- Modify `workbench/src/App.tsx`: add controls/status for backend runtime and update misleading continuous-run text.
- Test `tests/persistent-runtime-daemon.test.ts`: backend daemon loop and pause behavior.
- Test `tests/workbench-server.test.ts`: `runAuto` multiple-stage behavior and runtime endpoints.

## Task 1: Backend Runtime Daemon Loop

**Files:**
- Create: `src/persistent-runtime-daemon.ts`
- Modify: `src/runtime-types.ts`
- Modify: `src/index.ts`
- Test: `tests/persistent-runtime-daemon.test.ts`

- [ ] **Step 1: Write failing test for multi-tick backend loop**

Create `tests/persistent-runtime-daemon.test.ts` with a test that constructs `PersistentRuntimeDaemon` around `NovelRuntimeKernel`, starts it for `targetTicks: 3`, awaits `waitForIdle()`, and expects `completedTicks === 3`, `runIds.length === 3`, and the engine canon line to contain 3 stages.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/persistent-runtime-daemon.test.ts -t "continues through multiple ticks"`

Expected: FAIL because `PersistentRuntimeDaemon` is not exported.

- [ ] **Step 3: Implement runtime types and daemon**

Add `RuntimeDaemonSnapshot` and `RuntimeDaemonStartRequest` in `src/runtime-types.ts`. Implement `PersistentRuntimeDaemon` with `start`, `pause`, `resume`, `status`, and `waitForIdle`. The loop should call `kernel.tick()` until target ticks are reached or paused.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/persistent-runtime-daemon.test.ts -t "continues through multiple ticks"`

Expected: PASS.

## Task 2: CanonGate Pause And Manual Resume

**Files:**
- Modify: `tests/persistent-runtime-daemon.test.ts`
- Modify: `src/persistent-runtime-daemon.ts`

- [ ] **Step 1: Write failing pause test**

Add a test that starts the daemon with a high-risk qimen override and `requireAuthorOnCanonRisk: true`; expect `paused === true`, `completedTicks === 0`, `pauseReason` includes `CanonGate`, and at least one run id was recorded.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/persistent-runtime-daemon.test.ts -t "pauses when CanonGate"`

Expected: FAIL until pause reason/status are implemented correctly.

- [ ] **Step 3: Implement pause semantics**

When `kernel.tick()` returns `status: "paused"`, mark daemon inactive and paused, keep the run id, and do not increment completed ticks.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/persistent-runtime-daemon.test.ts`

Expected: all daemon tests PASS.

## Task 3: Workbench runAuto Runs Requested Count

**Files:**
- Modify: `workbench/src/server.ts`
- Modify: `tests/workbench-server.test.ts`

- [ ] **Step 1: Replace old runAuto test expectation**

Change the test currently named `run-auto advances one ai-driven stage per call and stops for review between stages` so one call with `targetStageCount: 2` expects two provider calls, two stages, `active === false`, and `completedStages === 2`.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/workbench-server.test.ts -t "run-auto advances requested stages"`

Expected: FAIL because current implementation advances one stage.

- [ ] **Step 3: Implement loop in `StudioSession.runAuto`**

Loop from current progress to `targetStageCount`, call `runStageWithProvider()` each iteration, suffix stage labels with `·N`, stop early if any gate decision is `ask-author`, and return progress.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/workbench-server.test.ts -t "run-auto advances requested stages"`

Expected: PASS.

## Task 4: Runtime Endpoints

**Files:**
- Modify: `workbench/src/contracts.ts`
- Modify: `workbench/src/api.ts`
- Modify: `workbench/src/server.ts`
- Test: `tests/workbench-server.test.ts`

- [ ] **Step 1: Write failing endpoint test**

Add a test that calls `handlers.startRuntime({ targetTicks: 2, directive })`, awaits `handlers.runtimeStatus()`, and expects the returned snapshot/session to show two canon stages.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/workbench-server.test.ts -t "runtime daemon endpoints"`

Expected: FAIL because handlers do not expose runtime daemon methods.

- [ ] **Step 3: Implement handlers and HTTP routes**

Create a daemon per `createWorkbenchApiHandlers()` instance. Add `startRuntime`, `pauseRuntime`, `resumeRuntime`, and `runtimeStatus` handlers. Add routes `/api/runtime/start`, `/api/runtime/pause`, `/api/runtime/resume`, and `/api/runtime/status`.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- tests/workbench-server.test.ts -t "runtime daemon endpoints"`

Expected: PASS.

## Task 5: Workbench Controls

**Files:**
- Modify: `workbench/src/App.tsx`
- Modify: `workbench/src/styles.css`
- Modify: `workbench/src/contracts.ts`
- Modify: `workbench/src/api.ts`

- [ ] **Step 1: Add UI state and API calls**

Add runtime status state, call `/api/runtime/status` on load and after runtime actions, and add buttons for start, pause, and resume.

- [ ] **Step 2: Update copy**

Replace text claiming "自动推进一次只跑一个阶段" with backend-runtime wording that shows active, paused, completed, and failed states.

- [ ] **Step 3: Build check**

Run: `npm run workbench:build`

Expected: PASS.

## Task 6: Full Verification

**Files:**
- No production files unless a verification failure reveals a bug.

- [ ] **Step 1: Typecheck**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 2: Unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Workbench build**

Run: `npm run workbench:build`

Expected: PASS.
