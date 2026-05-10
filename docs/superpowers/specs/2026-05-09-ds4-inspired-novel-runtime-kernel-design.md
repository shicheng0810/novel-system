# DS4-Inspired Novel Runtime Kernel Design

## Goal

Turn the current DeepSeek V4 model profile work into a real long-novel runtime kernel. The goal is not to copy ds4's C/Metal inference engine. The goal is to borrow its runtime shape: narrow public API, one mutable session timeline, stable context synchronization, disk-backed reusable checkpoints, one worker that owns mutation, and diagnostics that explain cache and generation decisions.

This is the missing layer between:

```text
DeepSeek V4 Pro 1M capability
```

and:

```text
WorldDaemon + SimulationRun + CanonGate + MetaphysicsFrame
```

## Source Findings From ds4

The ds4 repository is useful because it makes local long-context agent sessions practical through a complete engine/server loop rather than a generic framework.

- The README states that ds4 is intentionally narrow: one DeepSeek V4 Flash path with model loading, prompt rendering, KV state, and API glue in one coherent release path.
- `AGENT.md` makes correctness and a narrow public API explicit: CLI/server code must not depend on tensor internals, and long sessions should use live KV reuse plus disk checkpoints.
- `ds4.h` exposes `ds4_engine` and `ds4_session`; callers provide full token prefixes and let `ds4_session_sync()` reuse, extend, or rebuild graph state.
- `ds4_server.c` routes requests through one worker that owns the mutable session and cache state.
- ds4's disk KV cache stores stable prefixes by hash of exact token IDs, records save reasons, verifies loaded prefixes, and keeps rendered text only for observability.
- ds4 canonicalizes tool-call checkpoints so future stateless client requests hit cache even when formatting differs.
- ds4 tests include long-context regressions, official API vectors, tool-call quality tests, parser/rendering/cache tests, and streaming boundary tests.

References:

- https://github.com/antirez/ds4
- https://github.com/antirez/ds4/blob/main/README.md
- https://github.com/antirez/ds4/blob/main/AGENT.md
- https://github.com/antirez/ds4/blob/main/ds4.h
- https://github.com/antirez/ds4/blob/main/ds4_server.c
- https://github.com/antirez/ds4/blob/main/tests/test-vectors/README.md

## Design Thesis

The novel system should be a custom agent runtime, but the runtime center is not "many agents chatting." The center is one authoritative story timeline that can be synced, checkpointed, inspected, paused, and resumed.

The ds4 analogy maps like this:

| ds4 | Novel System |
| --- | --- |
| `ds4_engine` | DeepSeek provider plus deterministic world engine |
| `ds4_session` | `NarrativeSession` |
| rendered token prefix | canonical `ContextPack` |
| disk KV cache | disk `ContextCache` |
| one Metal worker | `NovelRuntimeWorker` |
| tool-call canonicalization | canonical `NovelAction` / `CanonPatch` / `MemoryWrite` |
| trace cache diagnostics | runtime trace artifacts |
| official logprob vectors | golden writing/canon/metaphysics evals |

## Non-Goals

- Do not implement a local C inference engine.
- Do not add an OpenAI-compatible or Anthropic-compatible server in this phase.
- Do not let role agents write canon directly.
- Do not make DeepSeek 1M context a default excuse to send unstructured everything.
- Do not move metaphysics into decorative prompt text. It remains a traceable pressure model.

## Core Components

### NovelRuntimeKernel

`NovelRuntimeKernel` is the public runtime entrypoint. It wraps `WorldDaemon`, `NarrativeSession`, `ContextCache`, and `NovelRuntimeWorker` behind a small API:

```ts
type NovelRuntimeKernel = {
  tick(input: WorldTickInput): Promise<WorldTickResult>;
  resume(runId: string): Promise<WorldTickResult>;
  inspectSession(): NarrativeSessionSnapshot;
};
```

The workbench and CLI should call this API instead of directly coordinating session/cache/daemon state.

### ContextPack

`ContextPack` is the canonical long-context bundle. It is not a prompt string. It is structured data with stable hashes:

```text
world identity
line identity
directive
canon head
atlas slice refs
memory slice refs
reading artifact refs
metaphysics frame refs
recent run refs
DeepSeek model profile
```

Every block gets a stable hash from sorted JSON serialization. Arrays preserve order; object keys are sorted; volatile timestamps are excluded from the hash. The pack hash is computed from block ids and block hashes.

This is the novel-system equivalent of ds4 hashing exact token IDs instead of raw text.

### NarrativeSession

`NarrativeSession` owns the current context timeline:

- current `ContextPack`
- current block hash sequence
- last sync result
- current cache snapshot id
- session revision number

`sync(pack)` compares the incoming block hashes with the current session and returns:

```ts
type NarrativeSessionSyncResult =
  | { mode: "reuse"; commonBlockCount: number; packId: string }
  | { mode: "extend"; commonBlockCount: number; packId: string }
  | { mode: "replace"; commonBlockCount: number; packId: string };
```

This makes context reuse explicit before any DeepSeek prompt assembly.

### ContextCache

`ContextCache` persists reusable `ContextPack` snapshots under the configured runtime root:

```text
context-cache/
  <packId>.json
  index.json
```

Each snapshot stores:

- pack id
- block hashes
- token estimate
- save reason: `cold`, `continued`, `evict`, `shutdown`, `canon-gate`, `author-handoff`
- hit count
- created/last-used timestamps
- human-readable block labels
- the canonical pack

The cache directory is disposable. Loading must verify that the stored block hashes are a prefix of the incoming pack before reuse. The rendered prompt text, when added in a future phase, is an observability field and not a cache key.

### NovelRuntimeWorker

`NovelRuntimeWorker` serializes mutation. The UI may request several actions, but only the worker mutates:

- `NarrativeSession`
- `ContextCache`
- `WorldDaemon`
- `SimulationRun`
- runtime trace artifacts

This follows ds4's server shape: client threads can parse requests, but one worker owns the live session.

### RuntimeTrace

Every kernel tick writes trace artifacts into the run directory:

```text
runs/<runId>/runtime/context-sync.json
runs/<runId>/runtime/trace.jsonl
```

The trace records:

- context pack id and block hashes
- session sync mode
- cache hit/miss and reason
- DeepSeek workload and model profile
- CanonGate result
- whether author handoff paused the run

This is the basis for debugging "why did the agent forget this fact" and "why did this branch pass the gate."

### NovelAction Protocol

Phase 1 defines the boundary but does not need a full action DSL. The direction is:

```text
LLM text/tool output
  -> structured NovelAction
  -> deterministic validation
  -> CanonGate
  -> canon/memory/read-model write
```

The first concrete action kinds should be `canon.patch`, `memory.write`, `branch.propose`, `author.ask`, and `metaphysics.explain`. They are intentionally held out of Phase 1 implementation so the runtime foundation stays small and testable.

## Data Flow

Manual tick:

```text
Workbench / CLI
  -> NovelRuntimeKernel.tick()
  -> NovelRuntimeWorker.enqueue()
  -> build ContextPack
  -> ContextCache.findReusablePrefix()
  -> NarrativeSession.sync()
  -> WorldDaemon.tick()
  -> SimulationRun artifacts
  -> RuntimeTrace artifacts
  -> WorldTickResult
```

Resume:

```text
Workbench / CLI
  -> NovelRuntimeKernel.resume(runId)
  -> NovelRuntimeWorker.enqueue()
  -> WorldDaemon.resume(runId)
  -> trace resume result
```

## DeepSeek V4 Pro Utilization

DeepSeek V4 Pro 1M and max effort should be used through workload policy, not raw enthusiasm:

- `simulation`: max effort, large output, full canon/context pack.
- `structured`: max effort when generating durable plans, branches, or review.
- `prose`: large output but prompt should include only the relevant pack.
- `validation`: short output and small max tokens.

The runtime must know the pack size before request assembly. If the pack grows beyond the configured context budget, the packer must drop low-priority reading artifacts before dropping canon, memory, or author anchors.

## Metaphysics Preservation

The runtime must preserve the original system's strongest idea: 奇门遁甲、先天八卦、八字 are not flavor text. They are structured narrative pressure.

The context pack treats metaphysics as first-class blocks:

- `temporal-frame`
- `bazi-profiles`
- `bagua-situation`
- `qimen-board`
- `metaphysics-frame`

CanonGate can accept, archive, reject, or ask author, but it must be able to cite which metaphysics block supported or pressured a branch.

## Security And Correctness

- Cache keys use canonical structured hashes, not raw text.
- Cache loads verify block-hash prefix compatibility before reuse.
- Runtime worker serializes canon-affecting mutation.
- Runtime artifacts must never use request-supplied path segments without validation.
- Trace files can include prompt-relevant content, so they are local development artifacts, not public export artifacts.
- High-risk CanonGate decisions still pause when author approval is required.

## Testing Strategy

Phase 1 tests are deterministic TypeScript tests:

- Context pack hashes are stable under object key reordering.
- Context pack hashes change when ordered arrays change.
- NarrativeSession reports `reuse`, `extend`, and `replace` correctly.
- ContextCache finds the longest reusable prefix and rejects non-prefix snapshots.
- NovelRuntimeWorker executes queued jobs serially.
- NovelRuntimeKernel writes context sync and trace artifacts into a run.

Future evals should mirror ds4's confidence style:

- golden long-context canon retention prompts
- golden CanonGate branch decisions
- golden metaphysics trace expectations
- golden tool/action schema outputs
- DeepSeek V4 Pro reading-artifact extraction checks

## Phase 1 Scope

Phase 1 builds the runtime foundation only:

- `ContextPack`
- `NarrativeSession`
- `ContextCache`
- `RuntimeTrace`
- `NovelRuntimeWorker`
- `NovelRuntimeKernel`
- exports and deterministic tests

It does not change the DeepSeek provider, prompt templates, workbench UI, or CanonGate scoring. Those are later modules built on this runtime foundation.
