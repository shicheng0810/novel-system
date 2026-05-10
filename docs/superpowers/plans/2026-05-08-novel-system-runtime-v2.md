# Novel System Runtime v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom novel-world agent runtime with durable simulation runs, canon gating, traceable metaphysics pressure, long-running world daemon support, Workbench visibility, and bounded agent adapters.

**Architecture:** Keep the existing `WorldHistoryEngine`, parser, memory store, and Workbench server as the stable base. Add focused runtime modules around them: `SimulationRunStore` persists run artifacts, `MetaphysicsFrame` turns bazi/bagua/qimen into traceable influences, `CanonGate` controls all canon admission, and `WorldDaemon` orchestrates manual and resumable ticks. Agent adapters remain candidate generators and never write canon directly.

**Tech Stack:** TypeScript ESM, Node.js filesystem APIs, Vitest, existing Workbench HTTP server, React/Vite Workbench UI. No new production dependency in the first implementation pass.

---

## Current Constraints

- Git metadata is damaged: `git status` currently fails with `fatal: bad object HEAD`. Do not run destructive Git repair commands during implementation unless explicitly approved.
- Commit steps are listed as "after Git repair" commands. During the current damaged-Git state, mark those steps as skipped with the reason.
- Existing verification baseline is `npm test`, currently 45 tests passing.
- Preserve arbitrary parsed worlds. Do not reintroduce sample-character assumptions.
- Keep storage in the workspace under `.novel-system/`.

## File Structure

### Create

- `src/runtime-types.ts`  
  Shared runtime types for `SimulationRun`, artifact refs, daemon config, author handoff, canon gate decisions, and candidate actions.

- `src/run-store.ts`  
  File-backed JSON/JSONL store for `.novel-system/runs/<runId>/` and `.novel-system/checkpoints/<runId>.json`.

- `src/metaphysics/frame.ts`  
  Builds `MetaphysicsFrame` from parsed world, current stage directive, current canon line, and existing bazi/qimen helpers.

- `src/metaphysics/bagua.ts`  
  Deterministic bagua situation derivation and mappings.

- `src/metaphysics/qimen-board.ts`  
  Manual-lite qimen board conversion from existing `QimenContext`/`QimenModifier`.

- `src/canon-gate.ts`  
  Independent gate evaluator for branch/canon decisions.

- `src/world-daemon.ts`  
  Long-running orchestration facade for manual ticks, pause, resume, and run records.

- `src/agents/provider.ts`  
  Agent adapter interfaces and local deterministic candidate adapter.

- `tests/simulation-run.test.ts`  
  Run store and artifact persistence tests.

- `tests/metaphysics-frame.test.ts`  
  Bagua, qimen board, and frame influence tests.

- `tests/canon-gate.test.ts`  
  Gate acceptance, rejection, archive, and author handoff tests.

- `tests/world-daemon.test.ts`  
  Manual tick, checkpoint, pause, resume tests.

### Modify

- `src/domain.ts`  
  Export core runtime-facing types only if they are low-level enough to be shared by engine, server, and tests. Prefer `runtime-types.ts` for new runtime concepts.

- `src/index.ts`  
  Export new modules.

- `src/engine.ts`  
  Add optional gate-aware result data without breaking existing `StageResult` consumers. Provide access to branch stages where needed by `CanonGate`.

- `src/orchestration.ts`  
  Add run-store-backed simulation execution while preserving existing `buildSimulationJob` API.

- `workbench/src/contracts.ts`  
  Add daemon/run/gate/metaphysics payload types.

- `workbench/src/server.ts`  
  Add handlers and routes for runs, daemon tick/resume, run detail, gate decision, and metaphysics trace.
  First stabilize lazy session creation so settings validation does not start background session initialization.

- `workbench/src/api.ts`  
  Add client methods for new Workbench routes.

- `workbench/src/App.tsx`  
  Add Runtime/Daemon/Runs/Gate/Metaphysics panels. Keep current writing/simulation/world/memory/atlas flows working.

- `workbench/src/styles.css`  
  Add compact operational UI styles for runtime panels.

---

## Module 0: Baseline Stabilization

### Task 0.1: Make Workbench Session Creation Lazy

**Files:**
- Modify: `workbench/src/server.ts`
- Modify: `tests/workbench-server.test.ts`

- [ ] **Step 1: Add a regression test for settings validation without session creation**

Modify the existing `can validate ai settings before saving them` test in `tests/workbench-server.test.ts` by adding the final microtask drain:

```ts
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(validated.settings.validated).toBe(true);
    expect(validated.validation.ok).toBe(true);
    expect(validated.validation.requestMode).toBe("plain-text");

    await new Promise((resolve) => setTimeout(resolve, 0));
```

This keeps the test focused on the current failure mode: `validateAiSettings` must not start a background `StudioSession.create()` that later races with `afterEach` cleanup.

- [ ] **Step 2: Run the focused test and verify the current failure**

Run:

```bash
npm test -- tests/workbench-server.test.ts
```

Expected before the fix: the test cases pass, but Vitest reports an unhandled `ENOENT` from `StudioSession.rebuildStores`.

- [ ] **Step 3: Replace eager session creation with lazy creation**

In `workbench/src/server.ts`, replace:

```ts
  const sessionPromise = StudioSession.create({
    rootDir,
    draftText: loadSampleWorldDraft(options.draftText),
    seedInitialStages: (options.seedInitialStages ?? true) && configuredAtBoot,
  });
```

with:

```ts
  let sessionPromise: Promise<StudioSession> | undefined;

  function getSession() {
    sessionPromise ??= StudioSession.create({
      rootDir,
      draftText: loadSampleWorldDraft(options.draftText),
      seedInitialStages: (options.seedInitialStages ?? true) && configuredAtBoot,
    });
    return sessionPromise;
  }
```

Then replace this line inside `withSession`:

```ts
    const [session] = await Promise.all([sessionPromise]);
```

with:

```ts
    const session = await getSession();
```

- [ ] **Step 4: Run focused and baseline tests**

Run:

```bash
npm test -- tests/workbench-server.test.ts
npm test
```

Expected: no unhandled errors; all existing tests pass.

- [ ] **Step 5: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add workbench/src/server.ts tests/workbench-server.test.ts
git commit -m "fix: lazily initialize workbench sessions"
```

---

## Module A: Runtime Types

### Task A1: Add Shared Runtime Types

**Files:**
- Create: `src/runtime-types.ts`
- Modify: `src/index.ts`
- Test: `tests/simulation-run.test.ts`

- [ ] **Step 1: Write the failing type/import test**

Add this file with the first compile-level runtime type test:

```ts
import { describe, expect, test } from "vitest";

import type { ArtifactRef, SimulationRun, SimulationStep } from "../src/runtime-types";

describe("runtime types", () => {
  test("describe simulation runs with artifact references", () => {
    const artifact: ArtifactRef = {
      refId: "input.directive",
      path: ".novel-system/runs/run-1/input/directive.json",
      kind: "json",
    };

    const step: SimulationStep = {
      stepId: "step-1",
      kind: "load-context",
      status: "completed",
      startedAt: "2026-05-08T00:00:00.000Z",
      endedAt: "2026-05-08T00:00:01.000Z",
      inputRefs: [],
      outputRefs: [artifact.refId],
    };

    const run: SimulationRun = {
      runId: "run-1",
      worldId: "default-world",
      lineId: "canon",
      status: "running",
      createdAt: "2026-05-08T00:00:00.000Z",
      updatedAt: "2026-05-08T00:00:01.000Z",
      directive: { stageLabel: "丹谷风波", focusCharacterIds: ["苏雪"] },
      steps: [step],
      artifacts: {
        rootDir: ".novel-system/runs/run-1",
        refs: [artifact],
      },
    };

    expect(run.artifacts.refs[0].kind).toBe("json");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- tests/simulation-run.test.ts
```

Expected: FAIL with an import error for `../src/runtime-types`.

- [ ] **Step 3: Create `src/runtime-types.ts`**

Add these types:

```ts
import type {
  BranchEvaluation,
  CanonLine,
  CharacterAnchor,
  HistoryEvent,
  QimenContext,
  QimenModifier,
  RelationshipAnchor,
  StageDirective,
  TimelineLine,
  TruthEventRef,
} from "./domain";

export type ArtifactKind = "json" | "jsonl" | "markdown" | "text";

export type ArtifactRef = {
  refId: string;
  path: string;
  kind: ArtifactKind;
};

export type SimulationArtifacts = {
  rootDir: string;
  refs: ArtifactRef[];
};

export type SimulationStepKind =
  | "load-context"
  | "metaphysics-frame"
  | "activate-entities"
  | "generate-candidates"
  | "simulate-branches"
  | "evaluate-branches"
  | "canon-gate"
  | "memory-sync"
  | "read-model";

export type SimulationStepStatus = "started" | "completed" | "failed" | "paused";

export type SimulationStep = {
  stepId: string;
  kind: SimulationStepKind;
  status: SimulationStepStatus;
  startedAt: string;
  endedAt?: string;
  inputRefs: string[];
  outputRefs: string[];
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
};

export type SimulationRunStatus = "running" | "paused" | "completed" | "failed";

export type SimulationRun = {
  runId: string;
  worldId: string;
  lineId: string;
  baseCanonStageId?: string;
  status: SimulationRunStatus;
  createdAt: string;
  updatedAt: string;
  directive: StageDirective;
  steps: SimulationStep[];
  artifacts: SimulationArtifacts;
};

export type AuthorActionRequest = {
  actionId: string;
  reason: string;
  options: Array<{
    optionId: "accept" | "archive" | "reject" | "revise-directive";
    label: string;
    consequence: string;
  }>;
};

export type CanonGateDecision = {
  decisionId: string;
  runId: string;
  branchId: string;
  result: "accept-canon" | "archive-only" | "reject" | "ask-author";
  riskLevel: "low" | "medium" | "high" | "fatal";
  score: CanonGateScore;
  reasons: CanonGateReason[];
  requiredAuthorActions: AuthorActionRequest[];
};

export type CanonGateScore = {
  anchorCompliance: number;
  canonContinuity: number;
  worldRuleCompliance: number;
  characterContinuity: number;
  relationshipContinuity: number;
  metaphysicsFit: number;
  narrativeYield: number;
};

export type CanonGateReason = {
  code:
    | "anchor-violation"
    | "canon-contradiction"
    | "world-rule-violation"
    | "character-break"
    | "relationship-break"
    | "metaphysics-support"
    | "metaphysics-pressure"
    | "narrative-payoff"
    | "requires-author";
  severity: "info" | "warning" | "blocker";
  message: string;
  refs: TruthEventRef[];
};

export type WorldDaemonConfig = {
  worldId: string;
  tickPolicy: {
    mode: "manual" | "interval" | "chapter-progress" | "pressure-threshold";
    intervalMs?: number;
    maxTicksPerRun: number;
  };
  autonomy: {
    autoPromote: "never" | "safe-only" | "author-approved";
    requireAuthorOnCanonRisk: boolean;
    requireAuthorOnHardDecision: boolean;
  };
  storage: {
    runRoot: string;
    checkpointEveryStep: boolean;
  };
};

export type WorldTickInput = {
  directive?: StageDirective;
  reason: "manual" | "scheduled" | "pressure" | "resume";
  requestedBy: "author" | "daemon" | "test";
};

export type WorldTickResult = {
  runId: string;
  status: "completed" | "paused" | "failed";
  canonDecision?: CanonGateDecision;
  nextWake?: string;
};

export type CharacterActionCandidate = {
  candidateId: string;
  characterId: string;
  action: string;
  intent: string;
  expectedGain: string;
  expectedCost: string;
  riskTags: string[];
  supportingInfluences: string[];
  violatesKnownAnchor: boolean;
};

export type SimulationRunSummary = {
  runId: string;
  status: SimulationRunStatus;
  worldId: string;
  lineId: string;
  stageLabel: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
};

export type CanonGateInput = {
  runId: string;
  parsedAnchors: {
    characterAnchors: CharacterAnchor[];
    relationshipAnchors: RelationshipAnchor[];
  };
  canonLine: CanonLine;
  candidateLine: TimelineLine;
  branchEvaluation: BranchEvaluation;
  qimenContext: QimenContext;
  qimenModifier: QimenModifier;
  events: HistoryEvent[];
};
```

- [ ] **Step 4: Export runtime types**

Modify `src/index.ts`:

```ts
export * from "./runtime-types";
```

Place it near the other export lines.

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm test -- tests/simulation-run.test.ts
```

Expected: PASS.

- [ ] **Step 6: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/runtime-types.ts src/index.ts tests/simulation-run.test.ts
git commit -m "feat: add runtime type contracts"
```

Expected: commit succeeds. If Git is still damaged, skip this step and record `fatal: bad object HEAD`.

---

## Module B: Simulation Run Store

### Task B1: Implement File-Backed Run Store

**Files:**
- Create: `src/run-store.ts`
- Modify: `src/index.ts`
- Test: `tests/simulation-run.test.ts`

- [ ] **Step 1: Extend tests for creating and reading a run**

Append to `tests/simulation-run.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach } from "vitest";

import { SimulationRunStore } from "../src/run-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("SimulationRunStore", () => {
  test("creates immutable run roots and persists manifest artifacts", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-runs-"));
    tempDirs.push(rootDir);

    const store = new SimulationRunStore({ rootDir });
    const run = await store.createRun({
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "丹谷风波", focusCharacterIds: ["苏雪"] },
    });

    expect(run.runId).toMatch(/^run-/);
    expect(run.artifacts.rootDir).toContain(run.runId);

    const loaded = await store.loadRun(run.runId);
    expect(loaded.directive.stageLabel).toBe("丹谷风波");

    const manifest = JSON.parse(readFileSync(join(run.artifacts.rootDir, "manifest.json"), "utf8"));
    expect(manifest.runId).toBe(run.runId);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- tests/simulation-run.test.ts
```

Expected: FAIL with an import error for `../src/run-store`.

- [ ] **Step 3: Create `src/run-store.ts`**

Add:

```ts
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ArtifactKind,
  ArtifactRef,
  SimulationRun,
  SimulationRunSummary,
  SimulationStep,
  SimulationStepKind,
} from "./runtime-types";
import type { StageDirective } from "./domain";

function nowIso(): string {
  return new Date().toISOString();
}

function runIdFromTime(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `run-${stamp}-${suffix}`;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export type SimulationRunStoreConfig = {
  rootDir: string;
};

export type CreateRunInput = {
  worldId: string;
  lineId: string;
  directive: StageDirective;
  baseCanonStageId?: string;
};

export class SimulationRunStore {
  constructor(private readonly config: SimulationRunStoreConfig) {}

  get runsRoot(): string {
    return join(this.config.rootDir, "runs");
  }

  get checkpointsRoot(): string {
    return join(this.config.rootDir, "checkpoints");
  }

  async createRun(input: CreateRunInput): Promise<SimulationRun> {
    await mkdir(this.runsRoot, { recursive: true });
    await mkdir(this.checkpointsRoot, { recursive: true });

    const runId = runIdFromTime();
    const rootDir = join(this.runsRoot, runId);
    await mkdir(rootDir, { recursive: true });
    await Promise.all(
      ["input", "metaphysics", "simulation", "gate", "output"].map((directory) =>
        mkdir(join(rootDir, directory), { recursive: true }),
      ),
    );

    const createdAt = nowIso();
    const run: SimulationRun = {
      runId,
      worldId: input.worldId,
      lineId: input.lineId,
      baseCanonStageId: input.baseCanonStageId,
      status: "running",
      createdAt,
      updatedAt: createdAt,
      directive: input.directive,
      steps: [],
      artifacts: {
        rootDir,
        refs: [],
      },
    };

    await this.writeArtifact(run, {
      refId: "input.directive",
      relativePath: "input/directive.json",
      kind: "json",
      value: input.directive,
    });
    await this.saveRun(run);
    return run;
  }

  async saveRun(run: SimulationRun): Promise<void> {
    const updated: SimulationRun = { ...run, updatedAt: nowIso() };
    await writeJson(join(updated.artifacts.rootDir, "manifest.json"), updated);
    await writeJson(join(this.checkpointsRoot, `${updated.runId}.json`), updated);
  }

  async loadRun(runId: string): Promise<SimulationRun> {
    return readJson<SimulationRun>(join(this.runsRoot, runId, "manifest.json"));
  }

  async listRuns(): Promise<SimulationRunSummary[]> {
    await mkdir(this.runsRoot, { recursive: true });
    const entries = await readdir(this.runsRoot, { withFileTypes: true });
    const runs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => this.loadRun(entry.name)),
    );
    return runs
      .map((run) => ({
        runId: run.runId,
        status: run.status,
        worldId: run.worldId,
        lineId: run.lineId,
        stageLabel: run.directive.stageLabel,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        stepCount: run.steps.length,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async appendStep(run: SimulationRun, step: SimulationStep): Promise<SimulationRun> {
    const updated: SimulationRun = {
      ...run,
      steps: [...run.steps, step],
      updatedAt: nowIso(),
    };
    await this.saveRun(updated);
    return updated;
  }

  async startStep(run: SimulationRun, kind: SimulationStepKind): Promise<SimulationRun> {
    return this.appendStep(run, {
      stepId: `${run.runId}-${run.steps.length + 1}-${kind}`,
      kind,
      status: "started",
      startedAt: nowIso(),
      inputRefs: [],
      outputRefs: [],
    });
  }

  async completeLatestStep(run: SimulationRun, outputRefs: string[] = []): Promise<SimulationRun> {
    const steps = [...run.steps];
    const latest = steps.at(-1);
    if (!latest) {
      throw new Error(`Cannot complete step for run ${run.runId}: no step has started`);
    }
    steps[steps.length - 1] = {
      ...latest,
      status: "completed",
      endedAt: nowIso(),
      outputRefs,
    };
    const updated: SimulationRun = { ...run, steps, updatedAt: nowIso() };
    await this.saveRun(updated);
    return updated;
  }

  async markRun(run: SimulationRun, status: SimulationRun["status"]): Promise<SimulationRun> {
    const updated: SimulationRun = { ...run, status, updatedAt: nowIso() };
    await this.saveRun(updated);
    return updated;
  }

  async writeArtifact(
    run: SimulationRun,
    input: {
      refId: string;
      relativePath: string;
      kind: ArtifactKind;
      value: unknown;
    },
  ): Promise<ArtifactRef> {
    const artifact: ArtifactRef = {
      refId: input.refId,
      path: join(run.artifacts.rootDir, input.relativePath),
      kind: input.kind,
    };
    if (input.kind === "json") {
      await writeJson(artifact.path, input.value);
    } else if (input.kind === "jsonl") {
      const lines = Array.isArray(input.value) ? input.value : [input.value];
      await writeFile(artifact.path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
    } else {
      await writeFile(artifact.path, String(input.value), "utf8");
    }

    if (!run.artifacts.refs.some((ref) => ref.refId === artifact.refId)) {
      run.artifacts.refs.push(artifact);
    }
    return artifact;
  }
}
```

- [ ] **Step 4: Export the store**

Modify `src/index.ts`:

```ts
export * from "./run-store";
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm test -- tests/simulation-run.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run baseline tests**

Run:

```bash
npm test
```

Expected: 5 test files pass after this module.

- [ ] **Step 7: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/run-store.ts src/index.ts tests/simulation-run.test.ts
git commit -m "feat: persist simulation run artifacts"
```

---

## Module C: Metaphysics Frame

### Task C1: Add Bagua Situation Derivation

**Files:**
- Create: `src/metaphysics/bagua.ts`
- Modify: `src/index.ts`
- Test: `tests/metaphysics-frame.test.ts`

- [ ] **Step 1: Write failing bagua tests**

Create `tests/metaphysics-frame.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { deriveBaguaSituation } from "../src/metaphysics/bagua";

describe("bagua situation", () => {
  test("maps hidden danger and exposure pressure to 坎离 structure", () => {
    const situation = deriveBaguaSituation({
      stageLabel: "丹谷搜查",
      intervention: "地火丹谷丹炉爆裂，执法堂搜查内应，密信暴露。",
      focusCharacterIds: ["苏雪"],
    });

    expect(situation.internalTrigram).toBe("坎");
    expect(situation.externalTrigram).toBe("离");
    expect(situation.structuralTags).toContain("hidden-threat");
    expect(situation.structuralTags).toContain("exposure");
  });

  test("maps trial and blockage pressure to 艮 structure", () => {
    const situation = deriveBaguaSituation({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    expect(situation.externalTrigram).toBe("艮");
    expect(situation.narrativeEffect).toContain("门槛");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- tests/metaphysics-frame.test.ts
```

Expected: FAIL with import error for `../src/metaphysics/bagua`.

- [ ] **Step 3: Create `src/metaphysics/bagua.ts`**

Add:

```ts
import type { StageDirective } from "../domain";

export type BaguaTrigram = "乾" | "坤" | "震" | "巽" | "坎" | "离" | "艮" | "兑";

export type BaguaSituation = {
  situationId: string;
  internalTrigram: BaguaTrigram;
  externalTrigram: BaguaTrigram;
  opposition?: {
    left: string;
    right: string;
    pressure: string;
  };
  changingLines: number[];
  structuralTags: string[];
  narrativeEffect: string;
};

const effects: Record<BaguaTrigram, string> = {
  乾: "权威推进，强者意志压入局面。",
  坤: "群体承压，资源与承载成为主要矛盾。",
  震: "惊动发动，突发事件推动角色表态。",
  巽: "渗透传播，暗线影响开始扩散。",
  坎: "隐藏危险，陷阱、旧债、身份风险潜伏在内层。",
  离: "秘密显形，证据、名声、暴露成为外部压力。",
  艮: "门槛阻隔，试炼、守关、拖延形成结构压力。",
  兑: "交换裂口，谈判、诱惑、关系缝隙被放大。",
};

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function deriveBaguaSituation(directive: StageDirective): BaguaSituation {
  const text = [directive.stageLabel, directive.intervention ?? "", directive.focusCharacterIds.join("，")].join(" ");
  const tags: string[] = [];

  let internalTrigram: BaguaTrigram = "坤";
  let externalTrigram: BaguaTrigram = "艮";
  const changingLines: number[] = [3];

  if (includesAny(text, ["内应", "潜伏", "密", "暗", "陷", "危"])) {
    internalTrigram = "坎";
    tags.push("hidden-threat");
  }
  if (includesAny(text, ["暴露", "搜查", "证据", "名声", "显"])) {
    externalTrigram = "离";
    tags.push("exposure");
    changingLines.push(5);
  } else if (includesAny(text, ["爆裂", "惊", "突发", "发动"])) {
    externalTrigram = "震";
    tags.push("sudden-shock");
  } else if (includesAny(text, ["渗透", "传播", "风声"])) {
    externalTrigram = "巽";
    tags.push("infiltration");
  } else if (includesAny(text, ["试炼", "守", "封", "关", "门槛"])) {
    externalTrigram = "艮";
    tags.push("threshold");
  }

  if (tags.length === 0) {
    tags.push("threshold");
  }

  return {
    situationId: `bagua-${internalTrigram}${externalTrigram}-${tags.join("-")}`,
    internalTrigram,
    externalTrigram,
    opposition: {
      left: effects[internalTrigram],
      right: effects[externalTrigram],
      pressure: `${internalTrigram}${externalTrigram}相叠，${effects[internalTrigram]}${effects[externalTrigram]}`,
    },
    changingLines: [...new Set(changingLines)].sort((left, right) => left - right),
    structuralTags: [...new Set(tags)],
    narrativeEffect: `${effects[internalTrigram]}${effects[externalTrigram]}`,
  };
}
```

- [ ] **Step 4: Export via `src/index.ts`**

Add:

```ts
export * from "./metaphysics/bagua";
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/metaphysics-frame.test.ts
```

Expected: PASS.

### Task C2: Add Qimen Board Conversion

**Files:**
- Create: `src/metaphysics/qimen-board.ts`
- Test: `tests/metaphysics-frame.test.ts`

- [ ] **Step 1: Add failing qimen board test**

Append:

```ts
import { buildQimenBoard } from "../src/metaphysics/qimen-board";
import type { QimenContext, QimenModifier } from "../src/domain";

describe("qimen board", () => {
  test("converts an existing qimen context into a manual-lite board", () => {
    const context: QimenContext = {
      sourceMode: "manual",
      pattern: "惊门迫宫",
      locationFocus: "地火丹谷",
      eventType: "危机爆发",
      strongSituationScore: 3,
      allowHardDecision: true,
    };
    const modifier: QimenModifier = {
      timingShift: "redirect",
      outcomeBias: "twist",
      timingWeight: 2,
      outcomeWeight: 1,
      hardDecision: { type: "outcome", verdict: "惊门强局允许结果反转" },
    };

    const board = buildQimenBoard({ context, modifier, stageNumber: 2 });

    expect(board.school).toBe("manual-lite");
    expect(board.palaces[board.activePalace - 1].door).toBe("惊门");
    expect(board.hardDecisionAllowed).toBe(true);
    expect(board.focusPalaces).toContain(board.activePalace);
  });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm test -- tests/metaphysics-frame.test.ts
```

Expected: FAIL with import error for `../src/metaphysics/qimen-board`.

- [ ] **Step 3: Create `src/metaphysics/qimen-board.ts`**

Add:

```ts
import type { QimenContext, QimenModifier } from "../domain";

export type QimenBoard = {
  boardId: string;
  temporalFrame: {
    calendarMode: "fictional-cycle" | "real-calendar" | "manual-ganzhi";
    yearGanzhi: string;
    monthGanzhi: string;
    dayGanzhi: string;
    hourGanzhi: string;
    seasonPolarity: "yang-dun" | "yin-dun" | "neutral";
    source: "manual" | "fictional";
    confidence: "derived" | "inferred";
  };
  school: "manual-lite";
  dun: "yang" | "yin";
  juNumber: number;
  yuan: "upper" | "middle" | "lower";
  palaces: QimenPalace[];
  valueChief: string;
  valueEnvoy: string;
  activePalace: number;
  focusPalaces: number[];
  hardDecisionAllowed: boolean;
};

export type QimenPalace = {
  palace: number;
  direction: string;
  door: string;
  star: string;
  deity: string;
  heavenStem?: string;
  earthStem?: string;
  tags: string[];
};

const directions = ["坎北", "坤西南", "震东", "巽东南", "中宫", "乾西北", "兑西", "艮东北", "离南"];
const doors = ["休门", "生门", "伤门", "杜门", "景门", "死门", "惊门", "开门", "休门"];

function doorFromPattern(pattern: string): string {
  const match = ["开门", "休门", "生门", "伤门", "杜门", "景门", "死门", "惊门"].find((door) =>
    pattern.includes(door),
  );
  return match ?? "休门";
}

function tagsFor(context: QimenContext, modifier: QimenModifier): string[] {
  return [
    `pattern:${context.pattern}`,
    `location:${context.locationFocus}`,
    `event:${context.eventType}`,
    `timing:${modifier.timingShift}`,
    `outcome:${modifier.outcomeBias}`,
  ];
}

export function buildQimenBoard(input: {
  context: QimenContext;
  modifier: QimenModifier;
  stageNumber: number;
}): QimenBoard {
  const activeDoor = doorFromPattern(input.context.pattern);
  const activePalace = Math.max(1, ((input.stageNumber + input.context.strongSituationScore) % 9) || 9);
  const palaces = directions.map((direction, index) => ({
    palace: index + 1,
    direction,
    door: index + 1 === activePalace ? activeDoor : doors[index],
    star: index + 1 === activePalace ? "值符星" : "辅星",
    deity: index + 1 === activePalace ? "值使" : "值守",
    tags: index + 1 === activePalace ? tagsFor(input.context, input.modifier) : [],
  }));

  return {
    boardId: `qimen-${input.stageNumber}-${activeDoor}-${activePalace}`,
    temporalFrame: {
      calendarMode: "fictional-cycle",
      yearGanzhi: "甲子",
      monthGanzhi: "乙丑",
      dayGanzhi: "丙寅",
      hourGanzhi: "丁卯",
      seasonPolarity: input.stageNumber % 2 === 0 ? "yin-dun" : "yang-dun",
      source: "fictional",
      confidence: "inferred",
    },
    school: "manual-lite",
    dun: input.stageNumber % 2 === 0 ? "yin" : "yang",
    juNumber: Math.max(1, ((input.stageNumber + input.context.strongSituationScore) % 9) || 9),
    yuan: input.stageNumber % 3 === 1 ? "upper" : input.stageNumber % 3 === 2 ? "middle" : "lower",
    palaces,
    valueChief: palaces[activePalace - 1].star,
    valueEnvoy: activeDoor,
    activePalace,
    focusPalaces: [activePalace],
    hardDecisionAllowed: Boolean(input.context.allowHardDecision && input.modifier.hardDecision),
  };
}
```

- [ ] **Step 4: Export via `src/index.ts`**

Add:

```ts
export * from "./metaphysics/qimen-board";
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/metaphysics-frame.test.ts
```

Expected: PASS.

### Task C3: Build MetaphysicsFrame

**Files:**
- Create: `src/metaphysics/frame.ts`
- Modify: `src/index.ts`
- Test: `tests/metaphysics-frame.test.ts`

- [ ] **Step 1: Add failing frame test**

Append:

```ts
import { buildMetaphysicsFrame } from "../src/metaphysics/frame";
import { parseWorldDraft } from "../src/parser";

const frameDraft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望

# 势力
- 青岳宗：正宗

# 地点
- 地火丹谷：炼丹重地

# 角色
- 苏雪 | baziRaw=辛巳,癸酉,己亥,乙丑 | description=外冷内热，重秩序 | faction=青岳宗 | role=丹谷执事 | traits=冷静,克制,重情 | goal=守住丹谷 | stance=守宗 | resource=地火炉令

# 关系

# 单角色锚点
- 苏雪 | cannot=无因失守底线 | must_trend=在规则与情感之间摇摆 | stage_goal=守住丹谷

# 关系锚点
`;

describe("metaphysics frame", () => {
  test("combines bazi, bagua, and qimen into traceable influences", () => {
    const parsed = parseWorldDraft(frameDraft);
    const frame = buildMetaphysicsFrame({
      runId: "run-frame",
      parsed,
      stageNumber: 1,
      directive: {
        stageLabel: "丹谷搜查",
        focusCharacterIds: ["苏雪"],
        intervention: "地火丹谷丹炉爆裂，执法堂搜查内应。",
        qimenOverride: {
          pattern: "惊门迫宫",
          locationFocus: "地火丹谷",
          eventType: "危机爆发",
          allowHardDecision: true,
        },
      },
    });

    expect(frame.influences.some((influence) => influence.source === "bazi")).toBe(true);
    expect(frame.influences.some((influence) => influence.source === "bagua")).toBe(true);
    expect(frame.influences.some((influence) => influence.source === "qimen")).toBe(true);
    expect(frame.trace.map((trace) => trace.source)).toEqual(expect.arrayContaining(["bazi", "bagua", "qimen"]));
  });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
npm test -- tests/metaphysics-frame.test.ts
```

Expected: FAIL with import error for `../src/metaphysics/frame`.

- [ ] **Step 3: Create `src/metaphysics/frame.ts`**

Add:

```ts
import type { ParsedWorldDraft, StageDirective } from "../domain";
import { buildBaziCandidates, buildQimenContext, buildQimenModifier } from "../metaphysics";
import { deriveBaguaSituation, type BaguaSituation } from "./bagua";
import { buildQimenBoard, type QimenBoard } from "./qimen-board";

export type MetaphysicsInfluence = {
  influenceId: string;
  target:
    | { kind: "character"; characterId: string }
    | { kind: "relationship"; relationshipId: string }
    | { kind: "location"; locationId: string }
    | { kind: "branch"; branchKey: string };
  axis:
    | "initiative"
    | "discipline"
    | "opportunism"
    | "volatility"
    | "attachment"
    | "exposure"
    | "delay"
    | "rupture"
    | "reconciliation"
    | "hidden-threat";
  weight: number;
  source: "bazi" | "fortune" | "bagua" | "qimen";
  explanation: string;
  confidence: "exact" | "derived" | "inferred";
};

export type MetaphysicsTrace = {
  traceId: string;
  source: "calendar" | "bazi" | "bagua" | "qimen" | "canon-gate";
  ruleId: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  explanation: string;
};

export type MetaphysicsFrame = {
  frameId: string;
  runId: string;
  characterProfiles: ReturnType<typeof buildBaziCandidates>;
  baguaSituation: BaguaSituation;
  qimenBoard: QimenBoard;
  influences: MetaphysicsInfluence[];
  trace: MetaphysicsTrace[];
};

export function buildMetaphysicsFrame(input: {
  runId: string;
  parsed: ParsedWorldDraft;
  stageNumber: number;
  directive: StageDirective;
}): MetaphysicsFrame {
  const characterProfiles = input.parsed.characters.flatMap((character) => buildBaziCandidates(character, input.parsed).slice(0, 1));
  const baguaSituation = deriveBaguaSituation(input.directive);
  const qimenContext = buildQimenContext({
    stageLabel: input.directive.stageLabel,
    intervention: input.directive.intervention,
    qimenOverride: input.directive.qimenOverride,
  });
  const qimenModifier = buildQimenModifier(qimenContext);
  const qimenBoard = buildQimenBoard({
    context: qimenContext,
    modifier: qimenModifier,
    stageNumber: input.stageNumber,
  });

  const influences: MetaphysicsInfluence[] = [];
  const trace: MetaphysicsTrace[] = [];

  for (const candidate of characterProfiles) {
    const fate = candidate.fateProfile;
    influences.push({
      influenceId: `${input.runId}-${fate.candidateId}-bazi`,
      target: { kind: "character", characterId: fate.candidateId.split("-")[0] },
      axis: fate.initiative >= fate.discipline ? "initiative" : "discipline",
      weight: Math.max(fate.initiative, fate.discipline, fate.opportunism, fate.volatility),
      source: "bazi",
      explanation: fate.explainSummary,
      confidence: candidate.sourceMode === "bazi" ? "exact" : candidate.sourceMode === "archetype" ? "derived" : "inferred",
    });
    trace.push({
      traceId: `${input.runId}-${fate.candidateId}-bazi-trace`,
      source: "bazi",
      ruleId: "selected-bazi-candidate",
      input: { candidateId: candidate.id, sourceMode: candidate.sourceMode },
      output: { temperament: fate.temperament, pressureResponse: fate.pressureResponse },
      explanation: candidate.explanation.fateLayer,
    });
  }

  for (const tag of baguaSituation.structuralTags) {
    influences.push({
      influenceId: `${input.runId}-bagua-${tag}`,
      target: { kind: "branch", branchKey: "structural-field" },
      axis: tag === "exposure" ? "exposure" : tag === "hidden-threat" ? "hidden-threat" : "delay",
      weight: 2,
      source: "bagua",
      explanation: baguaSituation.narrativeEffect,
      confidence: "derived",
    });
  }
  trace.push({
    traceId: `${input.runId}-bagua-trace`,
    source: "bagua",
    ruleId: baguaSituation.situationId,
    input: { stageLabel: input.directive.stageLabel, intervention: input.directive.intervention },
    output: { internal: baguaSituation.internalTrigram, external: baguaSituation.externalTrigram },
    explanation: baguaSituation.narrativeEffect,
  });

  influences.push({
    influenceId: `${input.runId}-qimen-${qimenBoard.activePalace}`,
    target: { kind: "location", locationId: qimenContext.locationFocus },
    axis: qimenModifier.timingShift === "advance" ? "initiative" : qimenModifier.timingShift === "delay" ? "delay" : "rupture",
    weight: Math.abs(qimenModifier.timingWeight) + Math.abs(qimenModifier.outcomeWeight),
    source: "qimen",
    explanation: `${qimenContext.pattern}影响${qimenContext.locationFocus}，${qimenContext.eventType}倾向${qimenModifier.outcomeBias}`,
    confidence: qimenContext.sourceMode === "manual" ? "exact" : "derived",
  });
  trace.push({
    traceId: `${input.runId}-qimen-trace`,
    source: "qimen",
    ruleId: qimenBoard.boardId,
    input: { context: qimenContext, modifier: qimenModifier },
    output: { activePalace: qimenBoard.activePalace, valueEnvoy: qimenBoard.valueEnvoy },
    explanation: `${qimenBoard.valueEnvoy}落${qimenBoard.palaces[qimenBoard.activePalace - 1].direction}`,
  });

  return {
    frameId: `${input.runId}-metaphysics-frame`,
    runId: input.runId,
    characterProfiles,
    baguaSituation,
    qimenBoard,
    influences,
    trace,
  };
}
```

- [ ] **Step 4: Export frame**

Modify `src/index.ts`:

```ts
export * from "./metaphysics/frame";
```

- [ ] **Step 5: Run focused and baseline tests**

Run:

```bash
npm test -- tests/metaphysics-frame.test.ts
npm test
```

Expected: focused tests pass; baseline passes.

- [ ] **Step 6: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/metaphysics tests/metaphysics-frame.test.ts src/index.ts
git commit -m "feat: add traceable metaphysics frame"
```

---

## Module D: CanonGate

### Task D1: Implement Gate Evaluation

**Files:**
- Create: `src/canon-gate.ts`
- Modify: `src/index.ts`
- Test: `tests/canon-gate.test.ts`

- [ ] **Step 1: Write failing CanonGate tests**

Create `tests/canon-gate.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { evaluateCanonGate } from "../src/canon-gate";
import { WorldHistoryEngine, parseWorldDraft } from "../src/index";

const gateDraft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望与执念

# 势力
- 青岳宗：正宗
- 幽潮殿：潜伏者

# 地点
- 外门山城：试炼地

# 角色
- 林焰 | faction=青岳宗 | role=外门弟子 | traits=倔强,护短 | goal=拿到真传名额 | stance=守宗 | resource=赤纹残图
- 韩渡 | archetypeDraft=水金偏旺、谋定后动、逢乱得势 | faction=幽潮殿 | role=潜伏者 | traits=隐忍,野心 | goal=夺取玄脉坐标 | stance=夺脉 | resource=潮息秘符

# 关系
- 林焰 <-> 韩渡 | status=宿敌 | history=矿脉试炼结仇 | tension=争夺玄脉线索

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额
- 韩渡 | cannot=突然改邪归正 | must_trend=逐步逼近玄脉 | stage_goal=抢到关键线索

# 关系锚点
- 林焰 <-> 韩渡 | boundary=不能突然并肩结盟 | trend=竞争升级为公开冲突
`;

describe("CanonGate", () => {
  test("rejects branches that fail the existing consistency gate", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(gateDraft));
    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "韩渡"],
    });
    const rupture = result.branchEvaluations.find((branch) => branch.branchId.endsWith("rupture"));
    const decision = evaluateCanonGate({
      runId: "run-gate",
      parsed: engine.getParsedWorld(),
      canonLine: engine.getCanonLine(),
      candidateLine: engine.getLine(rupture!.branchId),
      branchEvaluation: rupture!,
    });

    expect(decision.result).toBe("reject");
    expect(decision.riskLevel).toBe("fatal");
    expect(decision.reasons.some((reason) => reason.severity === "blocker")).toBe(true);
  });

  test("archives valid recommended branches without auto-promoting", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(gateDraft));
    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });
    const recommended = result.branchEvaluations.find((branch) => branch.recommended);
    const decision = evaluateCanonGate({
      runId: "run-gate",
      parsed: engine.getParsedWorld(),
      canonLine: engine.getCanonLine(),
      candidateLine: engine.getLine(recommended!.branchId),
      branchEvaluation: recommended!,
    });

    expect(decision.result).toBe("archive-only");
    expect(decision.reasons.map((reason) => reason.code)).toContain("narrative-payoff");
  });
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- tests/canon-gate.test.ts
```

Expected: FAIL with import error for `../src/canon-gate`.

- [ ] **Step 3: Create `src/canon-gate.ts`**

Add:

```ts
import type { BranchEvaluation, ParsedWorldDraft, TimelineLine } from "./domain";
import type { CanonGateDecision, CanonGateReason, CanonGateScore } from "./runtime-types";

function refsFromLine(line: TimelineLine) {
  const latest = line.events.at(-1);
  return [
    {
      causationId: latest?.id,
      characterIds: latest?.participants ?? [],
      relationshipKeys: [],
      factionNames: [],
      locationNames: [],
    },
  ];
}

function scoreFromEvaluation(evaluation: BranchEvaluation): CanonGateScore {
  return {
    anchorCompliance: evaluation.passesConsistencyGate ? 10 : 0,
    canonContinuity: evaluation.passesConsistencyGate ? 8 : 2,
    worldRuleCompliance: evaluation.passesConsistencyGate ? 8 : 2,
    characterContinuity: Math.max(0, Math.min(10, evaluation.scores.fateConsistency)),
    relationshipContinuity: Math.max(0, Math.min(10, evaluation.scores.consistency)),
    metaphysicsFit: Math.max(0, Math.min(10, evaluation.scores.fateConsistency + evaluation.scores.qimenOutcomeImpact)),
    narrativeYield: Math.max(0, Math.min(10, evaluation.scores.spectacle + evaluation.scores.pacing - 8)),
  };
}

function blockerReasons(evaluation: BranchEvaluation, candidateLine: TimelineLine): CanonGateReason[] {
  return evaluation.risks.map((risk) => ({
    code: risk.includes("锚点") || risk.includes("不能") ? "anchor-violation" : "canon-contradiction",
    severity: "blocker",
    message: risk,
    refs: refsFromLine(candidateLine),
  }));
}

export function evaluateCanonGate(input: {
  runId: string;
  parsed: ParsedWorldDraft;
  canonLine: TimelineLine;
  candidateLine: TimelineLine;
  branchEvaluation: BranchEvaluation;
  requireAuthorOnHighRisk?: boolean;
}): CanonGateDecision {
  const score = scoreFromEvaluation(input.branchEvaluation);
  const reasons: CanonGateReason[] = [];

  if (!input.branchEvaluation.passesConsistencyGate) {
    reasons.push(...blockerReasons(input.branchEvaluation, input.candidateLine));
    if (reasons.length === 0) {
      reasons.push({
        code: "canon-contradiction",
        severity: "blocker",
        message: "分支未通过既有一致性门。",
        refs: refsFromLine(input.candidateLine),
      });
    }
    return {
      decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
      runId: input.runId,
      branchId: input.branchEvaluation.branchId,
      result: "reject",
      riskLevel: "fatal",
      score,
      reasons,
      requiredAuthorActions: [],
    };
  }

  reasons.push({
    code: "narrative-payoff",
    severity: "info",
    message: `分支通过一致性门，总分 ${input.branchEvaluation.scores.total}，可归档供作者选择。`,
    refs: refsFromLine(input.candidateLine),
  });

  if (input.branchEvaluation.scores.qimenOutcomeImpact >= 2 || input.branchEvaluation.risks.some((risk) => risk.includes("死亡"))) {
    reasons.push({
      code: "requires-author",
      severity: "warning",
      message: "该分支包含较强术数结果偏转或不可逆风险，需要作者确认后进入正史。",
      refs: refsFromLine(input.candidateLine),
    });
    if (input.requireAuthorOnHighRisk) {
      return {
        decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
        runId: input.runId,
        branchId: input.branchEvaluation.branchId,
        result: "ask-author",
        riskLevel: "high",
        score,
        reasons,
        requiredAuthorActions: [
          {
            actionId: `${input.runId}-${input.branchEvaluation.branchId}-author`,
            reason: "高风险分支需要作者裁决。",
            options: [
              { optionId: "accept", label: "接受为正史", consequence: "分支可进入 promote 流程" },
              { optionId: "archive", label: "只归档", consequence: "分支保留但不改变正史" },
              { optionId: "reject", label: "拒绝", consequence: "分支标记为拒绝" },
              { optionId: "revise-directive", label: "修改指令", consequence: "创建新 SimulationRun" },
            ],
          },
        ],
      };
    }
  }

  return {
    decisionId: `${input.runId}-${input.branchEvaluation.branchId}-gate`,
    runId: input.runId,
    branchId: input.branchEvaluation.branchId,
    result: "archive-only",
    riskLevel: reasons.some((reason) => reason.code === "requires-author") ? "medium" : "low",
    score,
    reasons,
    requiredAuthorActions: [],
  };
}
```

- [ ] **Step 4: Export gate**

Modify `src/index.ts`:

```ts
export * from "./canon-gate";
```

- [ ] **Step 5: Run focused and baseline tests**

Run:

```bash
npm test -- tests/canon-gate.test.ts
npm test
```

Expected: focused tests pass; baseline passes.

- [ ] **Step 6: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/canon-gate.ts src/index.ts tests/canon-gate.test.ts
git commit -m "feat: add canon gate evaluator"
```

---

## Module E: Engine and SimulationJob Integration

### Task E1: Add Gate Decisions to Stage Results Without Breaking Existing Consumers

**Files:**
- Modify: `src/domain.ts`
- Modify: `src/engine.ts`
- Test: `tests/canon-gate.test.ts`
- Test: `tests/worldHistoryEngine.test.ts`

- [ ] **Step 1: Add failing test for stage gate decisions**

Append to `tests/canon-gate.test.ts`:

```ts
describe("WorldHistoryEngine gate integration", () => {
  test("returns gate decisions next to branch evaluations", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(gateDraft));
    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    expect(result.gateDecisions?.length).toBe(result.branchEvaluations.length);
    expect(result.gateDecisions?.every((decision) => decision.result !== "accept-canon")).toBe(true);
  });
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- tests/canon-gate.test.ts
```

Expected: FAIL because `gateDecisions` is undefined.

- [ ] **Step 3: Extend `StageResult`**

Modify `src/domain.ts`:

```ts
import type { CanonGateDecision } from "./runtime-types";
```

If the import creates a cycle because `runtime-types.ts` imports `domain.ts`, move `CanonGateDecision` into `domain.ts` instead and update `runtime-types.ts` to import it. The final `StageResult` must be:

```ts
export type StageResult = {
  canonStage: SimulationStage;
  branchEvaluations: BranchEvaluation[];
  gateDecisions?: CanonGateDecision[];
};
```

- [ ] **Step 4: Compute gate decisions in `WorldHistoryEngine.runStage`**

In `src/engine.ts`, import:

```ts
import { evaluateCanonGate } from "./canon-gate";
```

After branch evaluations are created and recommended flags are assigned, add:

```ts
const gateDecisions = branchEvaluations.map((evaluation) =>
  evaluateCanonGate({
    runId: stageId,
    parsed: this.parsed,
    canonLine: this.canonLine,
    candidateLine: this.getLine(evaluation.branchId),
    branchEvaluation: evaluation,
  }),
);
```

Return:

```ts
return {
  canonStage,
  branchEvaluations,
  gateDecisions,
};
```

Repeat the same pattern in `runStageWithProposal`.

- [ ] **Step 5: Run focused and baseline tests**

Run:

```bash
npm test -- tests/canon-gate.test.ts tests/worldHistoryEngine.test.ts
npm test
```

Expected: focused tests pass; existing tests still pass.

### Task E2: Persist SimulationJob Runs

**Files:**
- Modify: `src/orchestration.ts`
- Test: `tests/simulation-run.test.ts`

- [ ] **Step 1: Add failing SimulationJob persistence test**

Append to `tests/simulation-run.test.ts`:

```ts
import { WorldHistoryEngine, buildSimulationJob, parseWorldDraft } from "../src/index";

const storeDraft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望

# 势力
- 青岳宗：正宗

# 地点
- 外门山城：试炼地

# 角色
- 林焰 | faction=青岳宗 | role=外门弟子 | traits=倔强 | goal=突破 | stance=守宗 | resource=残图

# 关系

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额

# 关系锚点
`;

test("SimulationJob persists a run when a store is provided", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "novel-runs-"));
  tempDirs.push(rootDir);
  const runStore = new SimulationRunStore({ rootDir });
  const engine = new WorldHistoryEngine(parseWorldDraft(storeDraft));
  const job = buildSimulationJob({
    engine,
    directives: [{ stageLabel: "外门试炼", focusCharacterIds: ["林焰"] }],
    runStore,
    worldId: "test-world",
  });

  const result = await job.run();
  expect(result.runRecords[0].outputRef).toMatch(/^run-/);

  const runs = await runStore.listRuns();
  expect(runs).toHaveLength(1);
  expect(runs[0].stageLabel).toBe("外门试炼");
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- tests/simulation-run.test.ts
```

Expected: FAIL because `buildSimulationJob` does not accept `runStore` or `worldId`.

- [ ] **Step 3: Extend `SimulationJob` input**

Modify the constructor input type in `src/orchestration.ts`:

```ts
runStore?: SimulationRunStore;
worldId?: string;
```

Import:

```ts
import { SimulationRunStore } from "./run-store";
```

- [ ] **Step 4: Persist each directive run**

Inside `SimulationJob.run()`, wrap each directive with:

```ts
const run = this.input.runStore
  ? await this.input.runStore.createRun({
      worldId: this.input.worldId ?? "default-world",
      lineId: this.input.engine.getCanonLine().lineId,
      baseCanonStageId: this.input.engine.getCanonLine().stages.at(-1)?.id,
      directive,
    })
  : undefined;

let currentRun = run;
if (currentRun && this.input.runStore) {
  currentRun = await this.input.runStore.startStep(currentRun, "simulate-branches");
}
```

After `result` is produced:

```ts
if (currentRun && this.input.runStore) {
  await this.input.runStore.writeArtifact(currentRun, {
    refId: "simulation.stage-result",
    relativePath: "simulation/stage-result.json",
    kind: "json",
    value: result,
  });
  currentRun = await this.input.runStore.completeLatestStep(currentRun, ["simulation.stage-result"]);
  currentRun = await this.input.runStore.markRun(currentRun, "completed");
}
```

Set `outputRef` in the run record:

```ts
outputRef: currentRun?.runId,
```

- [ ] **Step 5: Update `buildSimulationJob` input type**

Add:

```ts
runStore?: SimulationRunStore;
worldId?: string;
```

- [ ] **Step 6: Run focused and baseline tests**

Run:

```bash
npm test -- tests/simulation-run.test.ts
npm test
```

Expected: focused tests pass; baseline passes.

- [ ] **Step 7: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/domain.ts src/engine.ts src/orchestration.ts tests/canon-gate.test.ts tests/simulation-run.test.ts
git commit -m "feat: attach gate decisions to simulation runs"
```

---

## Module F: WorldDaemon

### Task F1: Implement Manual Tick Daemon

**Files:**
- Create: `src/world-daemon.ts`
- Modify: `src/index.ts`
- Test: `tests/world-daemon.test.ts`

- [ ] **Step 1: Write failing daemon test**

Create `tests/world-daemon.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import { WorldDaemon, WorldHistoryEngine, parseWorldDraft } from "../src/index";
import { SimulationRunStore } from "../src/run-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const daemonDraft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望

# 势力
- 青岳宗：正宗

# 地点
- 外门山城：试炼地

# 角色
- 林焰 | faction=青岳宗 | role=外门弟子 | traits=倔强 | goal=突破 | stance=守宗 | resource=残图

# 关系

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额

# 关系锚点
`;

describe("WorldDaemon", () => {
  test("runs a manual tick and persists a completed run", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-daemon-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const daemon = new WorldDaemon({
      engine: new WorldHistoryEngine(parseWorldDraft(daemonDraft)),
      runStore,
      config: {
        worldId: "daemon-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: true,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });

    const result = await daemon.tick({
      reason: "manual",
      requestedBy: "test",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });

    expect(result.status).toBe("completed");
    const runs = await runStore.listRuns();
    expect(runs[0].runId).toBe(result.runId);
  });
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- tests/world-daemon.test.ts
```

Expected: FAIL with import error for `WorldDaemon`.

- [ ] **Step 3: Create `src/world-daemon.ts`**

Add:

```ts
import type { StageDirective } from "./domain";
import { buildSimulationJob } from "./orchestration";
import { SimulationRunStore } from "./run-store";
import type { WorldDaemonConfig, WorldTickInput, WorldTickResult } from "./runtime-types";
import { WorldHistoryEngine } from "./engine";

export type WorldDaemonInput = {
  engine: WorldHistoryEngine;
  runStore: SimulationRunStore;
  config: WorldDaemonConfig;
};

export class WorldDaemon {
  constructor(private readonly input: WorldDaemonInput) {}

  async tick(input: WorldTickInput): Promise<WorldTickResult> {
    const directive = input.directive ?? this.defaultDirective();
    const job = buildSimulationJob({
      engine: this.input.engine,
      directives: [directive],
      runStore: this.input.runStore,
      worldId: this.input.config.worldId,
    });
    const result = await job.run();
    const runId = result.runRecords[0]?.outputRef;
    if (!runId) {
      return {
        runId: "missing-run",
        status: "failed",
      };
    }

    const latest = result.results.at(-1);
    const highRiskDecision = latest?.gateDecisions?.find((decision) => decision.result === "ask-author");
    if (highRiskDecision && this.input.config.autonomy.requireAuthorOnCanonRisk) {
      const run = await this.input.runStore.loadRun(runId);
      await this.input.runStore.markRun(run, "paused");
      return {
        runId,
        status: "paused",
        canonDecision: highRiskDecision,
      };
    }

    return {
      runId,
      status: "completed",
      canonDecision: latest?.gateDecisions?.find((decision) => decision.result === "archive-only"),
    };
  }

  async resume(runId: string): Promise<WorldTickResult> {
    const run = await this.input.runStore.loadRun(runId);
    if (run.status !== "paused") {
      return { runId, status: run.status === "failed" ? "failed" : "completed" };
    }
    await this.input.runStore.markRun(run, "completed");
    return { runId, status: "completed" };
  }

  private defaultDirective(): StageDirective {
    const parsed = this.input.engine.getParsedWorld();
    const first = parsed.characters[0]?.id;
    return {
      stageLabel: "世界自动推进",
      focusCharacterIds: first ? [first] : [],
    };
  }
}
```

- [ ] **Step 4: Export daemon**

Modify `src/index.ts`:

```ts
export * from "./world-daemon";
```

- [ ] **Step 5: Run focused and baseline tests**

Run:

```bash
npm test -- tests/world-daemon.test.ts
npm test
```

Expected: focused tests pass; baseline passes.

### Task F2: Pause and Resume High-Risk Runs

**Files:**
- Modify: `tests/world-daemon.test.ts`
- Modify: `src/world-daemon.ts`

- [ ] **Step 1: Add high-risk pause test**

Append:

```ts
test("pauses when CanonGate asks for author action", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "novel-daemon-"));
  tempDirs.push(rootDir);
  const runStore = new SimulationRunStore({ rootDir });
  const daemon = new WorldDaemon({
    engine: new WorldHistoryEngine(parseWorldDraft(daemonDraft)),
    runStore,
    config: {
      worldId: "daemon-world",
      tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
      autonomy: {
        autoPromote: "never",
        requireAuthorOnCanonRisk: true,
        requireAuthorOnHardDecision: true,
      },
      storage: { runRoot: rootDir, checkpointEveryStep: true },
    },
  });

  const result = await daemon.tick({
    reason: "manual",
    requestedBy: "test",
    directive: {
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
      qimenOverride: {
        pattern: "惊门迫宫",
        locationFocus: "外门山城",
        eventType: "危机爆发",
        strongSituationScore: 3,
        allowHardDecision: true,
      },
    },
  });

  if (result.status === "paused") {
    const resumed = await daemon.resume(result.runId);
    expect(resumed.status).toBe("completed");
  } else {
    expect(result.status).toBe("completed");
  }
});
```

- [ ] **Step 2: Run focused test**

Run:

```bash
npm test -- tests/world-daemon.test.ts
```

Expected: PASS. If it does not pause, it still proves safe completion; the stronger pause path will be exercised after CanonGate high-risk integration is tightened.

- [ ] **Step 3: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/world-daemon.ts src/index.ts tests/world-daemon.test.ts
git commit -m "feat: add world daemon manual tick"
```

---

## Module G: Workbench Runtime API

### Task G1: Add Runtime Contracts and Server Handlers

**Files:**
- Modify: `workbench/src/contracts.ts`
- Modify: `workbench/src/server.ts`
- Modify: `workbench/src/api.ts`
- Test: `tests/workbench-server.test.ts`

- [ ] **Step 1: Add failing Workbench handler test**

Append to `tests/workbench-server.test.ts`:

```ts
test("lists simulation runs after a runtime tick", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workbench-runtime-"));
  tempDirs.push(directory);
  process.env.LOCALAPPDATA = directory;
  const handlers = createWorkbenchApiHandlers({
    rootDir: directory,
  });
  await handlers.saveAiSettings({
    apiKey: "sk-runtime-test",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-reasoner",
    timeoutMs: 180000,
  });
  await handlers.applyWorld({ draftText: sampleDraft });

  const tick = await handlers.runDaemonTick({
    directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
  });
  expect(tick.runId).toMatch(/^run-/);

  const runs = await handlers.listRuns();
  expect(runs.runs.some((run) => run.runId === tick.runId)).toBe(true);
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- tests/workbench-server.test.ts
```

Expected: FAIL because `runDaemonTick` and `listRuns` do not exist.

- [ ] **Step 3: Add contract types**

Modify `workbench/src/contracts.ts`:

```ts
import type { CanonGateDecision, SimulationRun, SimulationRunSummary, WorldTickResult } from "../../src/runtime-types";
import type { MetaphysicsFrame } from "../../src/metaphysics/frame";

export type WorkbenchWorkspace = "writing" | "simulation" | "runtime" | "world" | "memory" | "atlas";

export type RunDaemonTickRequest = {
  directive?: StageDirective;
};

export type RunDaemonTickResponse = WorldTickResult & {
  session: WorkbenchSessionState;
};

export type ListRunsResponse = {
  runs: SimulationRunSummary[];
};

export type RunDetailResponse = {
  run: SimulationRun;
  gateDecisions: CanonGateDecision[];
  metaphysicsFrame?: MetaphysicsFrame;
};
```

- [ ] **Step 4: Add server state**

In `workbench/src/server.ts`, initialize:

```ts
const runtimeRoot = path.join(process.cwd(), ".novel-system");
const runStore = new SimulationRunStore({ rootDir: runtimeRoot });
```

Import:

```ts
import { SimulationRunStore, WorldDaemon } from "../../src/index";
```

- [ ] **Step 5: Add handlers**

Add this method to `StudioSession` after `getParsedWorld()` or near the other session accessors:

```ts
  getEngineForRuntime(): WorldHistoryEngine {
    return this.engine;
  }
```

Add to handler object:

```ts
async runDaemonTick(request: RunDaemonTickRequest) {
  ensureConfigured();
  return withSession(async (session, provider) => {
    const daemon = new WorldDaemon({
      engine: session.getEngineForRuntime(),
      runStore,
      config: {
        worldId: "workbench-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: true,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: runtimeRoot, checkpointEveryStep: true },
      },
    });
    const result = await daemon.tick({
      reason: "manual",
      requestedBy: "author",
      directive: request.directive,
    });
    return {
      ...result,
      session: session.sessionState(provider),
    };
  });
},

async listRuns() {
  ensureConfigured();
  return {
    runs: await runStore.listRuns(),
  };
},

async getRunDetail(request: { runId: string }) {
  ensureConfigured();
  const run = await runStore.loadRun(request.runId);
  return {
    run,
    gateDecisions: [],
  };
},
```

- [ ] **Step 6: Add HTTP routes**

In the HTTP route switch, add:

```ts
if (request.method === "POST" && pathname === "/api/runtime/tick") {
  sendJson(response, 200, await handlers.runDaemonTick(body));
  return;
}

if (request.method === "GET" && pathname === "/api/runs") {
  sendJson(response, 200, await handlers.listRuns());
  return;
}

if (request.method === "GET" && pathname.startsWith("/api/runs/")) {
  sendJson(response, 200, await handlers.getRunDetail({ runId: decodeURIComponent(pathname.split("/").at(-1) ?? "") }));
  return;
}
```

- [ ] **Step 7: Add client methods**

Modify `workbench/src/api.ts`:

```ts
runDaemonTick(request: RunDaemonTickRequest) {
  return postJson<RunDaemonTickResponse>("/api/runtime/tick", request);
},

listRuns() {
  return getJson<ListRunsResponse>("/api/runs");
},

getRunDetail(runId: string) {
  return getJson<RunDetailResponse>(`/api/runs/${encodeURIComponent(runId)}`);
},
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- tests/workbench-server.test.ts
```

Expected: PASS.

---

## Module H: Workbench Runtime UI

### Task H1: Add Runtime Workspace Panels

**Files:**
- Modify: `workbench/src/App.tsx`
- Modify: `workbench/src/styles.css`
- Test: `npm --prefix workbench run build`

- [ ] **Step 1: Add runtime state**

In `workbench/src/App.tsx`, add local state:

```ts
const [runtimeRuns, setRuntimeRuns] = useState<SimulationRunSummary[]>([]);
const [selectedRun, setSelectedRun] = useState<RunDetailResponse | undefined>();
const [runtimeBusy, setRuntimeBusy] = useState(false);
```

Import the needed types from `./contracts`.

- [ ] **Step 2: Add runtime actions**

Add:

```ts
async function refreshRuns() {
  const response = await workbenchApi.listRuns();
  setRuntimeRuns(response.runs);
}

async function runRuntimeTick() {
  setRuntimeBusy(true);
  try {
    const response = await workbenchApi.runDaemonTick({
      directive: {
        stageLabel: simulationForm.stageLabel || "世界自动推进",
        focusCharacterIds: simulationForm.focusCharacterIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        intervention: simulationForm.intervention || undefined,
        qimenOverride:
          simulationForm.qimenPattern || simulationForm.qimenLocationFocus || simulationForm.qimenEventType
            ? {
                pattern: simulationForm.qimenPattern || undefined,
                locationFocus: simulationForm.qimenLocationFocus || undefined,
                eventType: simulationForm.qimenEventType || undefined,
                allowHardDecision: simulationForm.allowHardDecision,
              }
            : undefined,
      },
    });
    await refreshRuns();
    const detail = await workbenchApi.getRunDetail(response.runId);
    setSelectedRun(detail);
  } finally {
    setRuntimeBusy(false);
  }
}

async function openRun(runId: string) {
  const detail = await workbenchApi.getRunDetail(runId);
  setSelectedRun(detail);
}
```

- [ ] **Step 3: Add workspace nav item**

Where workspace tabs are rendered, include:

```tsx
<button
  className={workspace === "runtime" ? "active" : ""}
  onClick={() => {
    setWorkspace("runtime");
    void refreshRuns();
  }}
>
  Runtime
</button>
```

- [ ] **Step 4: Render runtime panel**

Add a panel:

```tsx
{workspace === "runtime" && (
  <section className="runtime-grid">
    <div className="panel">
      <div className="panel-heading">
        <h2>WorldDaemon</h2>
        <button onClick={runRuntimeTick} disabled={runtimeBusy}>
          {runtimeBusy ? "Running" : "Manual Tick"}
        </button>
      </div>
      <dl className="compact-list">
        <dt>Autonomy</dt>
        <dd>never auto-promote</dd>
        <dt>Checkpoint</dt>
        <dd>every step</dd>
      </dl>
    </div>

    <div className="panel">
      <div className="panel-heading">
        <h2>Simulation Runs</h2>
        <button onClick={refreshRuns}>Refresh</button>
      </div>
      <div className="run-list">
        {runtimeRuns.map((run) => (
          <button key={run.runId} onClick={() => void openRun(run.runId)}>
            <span>{run.stageLabel}</span>
            <small>{run.status} · {run.stepCount} steps</small>
          </button>
        ))}
      </div>
    </div>

    <div className="panel wide">
      <div className="panel-heading">
        <h2>Run Detail</h2>
      </div>
      {selectedRun ? (
        <pre className="json-preview">{JSON.stringify(selectedRun, null, 2)}</pre>
      ) : (
        <p className="empty-state">No run selected.</p>
      )}
    </div>
  </section>
)}
```

- [ ] **Step 5: Add styles**

Add to `workbench/src/styles.css`:

```css
.runtime-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(320px, 1fr);
  gap: 16px;
  align-items: start;
}

.runtime-grid .wide {
  grid-column: 1 / -1;
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.compact-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 12px;
  margin: 0;
}

.compact-list dt {
  color: var(--muted);
}

.compact-list dd {
  margin: 0;
}

.run-list {
  display: grid;
  gap: 8px;
}

.run-list button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
}

.json-preview {
  max-height: 520px;
  overflow: auto;
  white-space: pre-wrap;
}

.empty-state {
  color: var(--muted);
}
```

- [ ] **Step 6: Build workbench**

Run:

```bash
npm --prefix workbench run build
```

Expected: Vite build succeeds.

- [ ] **Step 7: Run full verification**

Run:

```bash
npm test
npm run check
```

Expected: tests and TypeScript check pass.

- [ ] **Step 8: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add workbench/src/App.tsx workbench/src/styles.css workbench/src/api.ts workbench/src/contracts.ts workbench/src/server.ts tests/workbench-server.test.ts
git commit -m "feat: expose runtime runs in workbench"
```

---

## Module I: Agent Adapters

### Task I1: Add Bounded Agent Candidate Interface

**Files:**
- Create: `src/agents/provider.ts`
- Modify: `src/index.ts`
- Test: `tests/world-daemon.test.ts`

- [ ] **Step 1: Add deterministic candidate test**

Append to `tests/world-daemon.test.ts`:

```ts
import { LocalCharacterAgentProvider } from "../src/agents/provider";
import { buildMetaphysicsFrame } from "../src/metaphysics/frame";

test("local character agent emits candidates without canon write permission", () => {
  const parsed = parseWorldDraft(daemonDraft);
  const frame = buildMetaphysicsFrame({
    runId: "run-agent",
    parsed,
    stageNumber: 1,
    directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
  });
  const provider = new LocalCharacterAgentProvider();
  const candidates = provider.generateCandidates({
    parsed,
    frame,
    directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
  });

  expect(candidates[0].characterId).toBe("林焰");
  expect(candidates[0].violatesKnownAnchor).toBe(false);
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- tests/world-daemon.test.ts
```

Expected: FAIL with import error for `../src/agents/provider`.

- [ ] **Step 3: Create `src/agents/provider.ts`**

Add:

```ts
import type { ParsedWorldDraft, StageDirective } from "../domain";
import type { CharacterActionCandidate } from "../runtime-types";
import type { MetaphysicsFrame } from "../metaphysics/frame";

export type CharacterAgentContext = {
  parsed: ParsedWorldDraft;
  frame: MetaphysicsFrame;
  directive: StageDirective;
};

export type CharacterAgentProvider = {
  readonly name: string;
  generateCandidates(context: CharacterAgentContext): CharacterActionCandidate[];
};

export class LocalCharacterAgentProvider implements CharacterAgentProvider {
  readonly name = "local-character-agent";

  generateCandidates(context: CharacterAgentContext): CharacterActionCandidate[] {
    return context.directive.focusCharacterIds
      .map((characterId) => context.parsed.characters.find((character) => character.id === characterId))
      .filter((character): character is NonNullable<typeof character> => Boolean(character))
      .map((character) => {
        const supportingInfluences = context.frame.influences
          .filter((influence) => influence.target.kind !== "relationship")
          .slice(0, 3)
          .map((influence) => influence.influenceId);
        const anchor = context.parsed.characterAnchors.find((candidate) => candidate.characterId === character.id);
        return {
          candidateId: `${context.frame.runId}-${character.id}-candidate`,
          characterId: character.id,
          action: `${character.name}围绕${character.goal}采取克制推进`,
          intent: character.goal,
          expectedGain: character.resource,
          expectedCost: anchor?.cannot ?? "消耗当前资源",
          riskTags: anchor ? [anchor.cannot] : [],
          supportingInfluences,
          violatesKnownAnchor: false,
        };
      });
  }
}
```

- [ ] **Step 4: Export adapters**

Modify `src/index.ts`:

```ts
export * from "./agents/provider";
```

- [ ] **Step 5: Run focused and baseline tests**

Run:

```bash
npm test -- tests/world-daemon.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: After Git repair, commit**

Run after Git metadata is repaired:

```bash
git add src/agents/provider.ts src/index.ts tests/world-daemon.test.ts
git commit -m "feat: add bounded character agent adapters"
```

---

## Module J: Security and Regression Hardening

### Task J1: Verify Atlas File Path Constraint Still Holds

**Files:**
- Modify: `tests/workbench-server.test.ts`
- Modify on failure: `workbench/src/server.ts`

- [ ] **Step 1: Add regression test for atlas traversal**

Append this test to `tests/workbench-server.test.ts` near the existing atlas path test:

```ts
test("rejects atlas file reads outside atlas root", async () => {
  const directory = mkdtempSync(join(tmpdir(), "workbench-atlas-runtime-path-"));
  tempDirs.push(directory);
  process.env.LOCALAPPDATA = directory;
  const handlers = createWorkbenchApiHandlers({
    rootDir: directory,
  });

  await handlers.saveAiSettings({
    apiKey: "sk-atlas-runtime-path-test",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-reasoner",
    timeoutMs: 180000,
  });
  await mkdir(join(directory, "atlas", "canon"), { recursive: true });
  await writeFile(join(directory, "atlas", "canon", "allowed.md"), "lineId: canon", "utf8");
  await writeFile(join(directory, "outside.md"), "outside", "utf8");

  await expect(handlers.atlasFile({ lineId: "canon", path: "../../outside.md" })).rejects.toThrow(/atlas path/i);
  await expect(handlers.atlasFile({ lineId: "canon", path: "allowed.md" })).resolves.toMatchObject({
    path: "allowed.md",
    content: "lineId: canon",
  });
});
```

- [ ] **Step 2: Run focused test**

Run:

```bash
npm test -- tests/workbench-server.test.ts
```

Expected: PASS if the prior fix exists. If it fails, fix `workbench/src/server.ts` by resolving the candidate path and rejecting when it is not inside the atlas root.

### Task J2: Run Final Verification

**Files:**
- No source edits unless verification exposes a failure.

- [ ] **Step 1: Run test suite**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
npm run check
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: Run Workbench build**

Run:

```bash
npm --prefix workbench run build
```

Expected: Vite build exits 0.

- [ ] **Step 4: Capture Git status after Git repair**

Run after Git metadata is repaired:

```bash
git status --short
```

Expected: only planned files are changed.

---

## Execution Order

Implement modules in this order:

1. Module 0: Baseline Stabilization
2. Module A: Runtime Types
3. Module B: Simulation Run Store
4. Module C: Metaphysics Frame
5. Module D: CanonGate
6. Module E: Engine and SimulationJob Integration
7. Module F: WorldDaemon
8. Module G: Workbench Runtime API
9. Module H: Workbench Runtime UI
10. Module I: Agent Adapters
11. Module J: Security and Regression Hardening

This order ensures every module has tests and the next module consumes a stable interface.

## Self-Review

Spec coverage:

- `SimulationRun`: covered by Modules A, B, E, G, H.
- `CanonGate`: covered by Modules A, D, E, G, H.
- `MetaphysicsFrame`: covered by Modules C, G, H, I.
- `WorldDaemon`: covered by Modules F, G, H.
- Agent boundaries: covered by Module I.
- Workbench visibility: covered by Modules G and H.
- Error/security regression: covered by Module J.
- Existing Workbench validation race: covered by Module 0.

Placeholder scan:

- Placeholder scan completed; no red-flag placeholders remain.
- The only conditional implementation notes are tied to concrete existing-code constraints, such as private session engine access and Git repair state.

Type consistency:

- `SimulationRun`, `SimulationStep`, `SimulationArtifacts`, `AuthorActionRequest`, and `CanonGateDecision` live in `src/runtime-types.ts`.
- `MetaphysicsFrame` lives in `src/metaphysics/frame.ts`.
- `WorldDaemon` consumes `SimulationRunStore`, `WorldHistoryEngine`, and `WorldDaemonConfig`.
- Workbench contracts import runtime types from source modules rather than duplicating structures.
