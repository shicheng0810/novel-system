# Persistent Runtime Daemon Design

## Goal

Split the novel system's long-running world simulation from the trigger-style Workbench UI. The backend must be able to keep advancing the world without repeated browser clicks, while the frontend acts as a control console for start, pause, resume, status, gate approval, and inspection.

## Problem

The current Workbench flow is request/response:

- `runStage` runs one simulation stage.
- `runAuto` runs one stage and stores an `active` flag so the author can click again.
- `/api/runtime/tick` constructs a fresh `WorldDaemon` with `maxTicksPerRun: 1`.

That means no part of the system actually runs continuously. Existing tests even lock in the one-stage-per-click behavior.

## Design

Add a persistent backend runtime service, `PersistentRuntimeDaemon`, that owns a loop around `NovelRuntimeKernel.tick()`.

The daemon has a narrow API:

```ts
start(input): RuntimeDaemonSnapshot
pause(): RuntimeDaemonSnapshot
resume(): RuntimeDaemonSnapshot
status(): RuntimeDaemonSnapshot
waitForIdle(): Promise<RuntimeDaemonSnapshot>
```

The loop runs on the backend. It advances one stage at a time through the existing `NovelRuntimeKernel`, which already serializes mutation through `NovelRuntimeWorker` and writes run artifacts. The daemon records progress after each tick and stops when:

- target ticks are reached,
- the author pauses it,
- `CanonGate` returns `ask-author`,
- a tick fails.

## Workbench Integration

Workbench keeps the current manual `runStage` path. Continuous runtime gets separate commands:

- `/api/runtime/start`
- `/api/runtime/pause`
- `/api/runtime/resume`
- `/api/runtime/status`

The existing `/api/runtime/tick` remains as a manual single tick for diagnostics. `runAuto` should be changed from "click to continue" to one backend command that can advance multiple stages in one request, but the true long-running mode belongs to the runtime daemon endpoints.

## State Model

The runtime snapshot is returned with session state:

```ts
{
  active: boolean;
  paused: boolean;
  failed: boolean;
  completed: boolean;
  completedTicks: number;
  targetTicks: number;
  runIds: string[];
  lastRunId?: string;
  lastStageLabel?: string;
  pauseReason?: string;
  error?: string;
}
```

The daemon is memory-resident for this phase, but every tick still writes durable run artifacts through `SimulationRunStore`. A later phase can reconstruct daemon status from `runs/` and checkpoints after process restart.

## Safety

The daemon never auto-promotes branches. It advances canon through the existing stage simulation path and pauses on high-risk CanonGate decisions. The frontend cannot make the runtime continue past an author gate unless a later explicit approval endpoint is added.

The daemon has a target tick count and optional delay. There is no unbounded infinite loop in this phase.

## Testing

Add tests before implementation:

- `PersistentRuntimeDaemon` continues through multiple ticks without another frontend/API call.
- It pauses when `CanonGate` asks for author action.
- It can resume after an author pause.
- Workbench `runAuto` advances all requested stages in one call.
- Runtime endpoints expose start/status/pause/resume snapshots.

## Follow-Up

After the backend runtime is reliable, implement the writing-side upgrade:

- 3000-character chapter defaults,
- lens-aware Critic length checks,
- scene draft generation followed by full chapter assembly,
- DeepSeek chapter assembler prompt and repair loop.
