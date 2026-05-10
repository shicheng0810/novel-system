# DS4-Inspired Novel Runtime Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first ds4-inspired runtime foundation for the novel system: canonical context packs, disk context cache, narrative session sync, serial runtime worker, and per-run runtime trace artifacts.

**Architecture:** Keep the implementation narrow and deterministic. The new runtime layer wraps the existing `WorldDaemon`, `SimulationRunStore`, and DeepSeek profile without changing CanonGate scoring or model prompts in this phase.

**Tech Stack:** TypeScript, Node `crypto`, Node `fs/promises`, Vitest, existing `WorldDaemon`, `SimulationRunStore`, and runtime type modules.

---

## Git Note

The repository has been reinitialized and currently has no baseline commit; `git status --short` shows the whole project as untracked. Implementation workers should run the verification commands in each task. Do not create partial commits until the project owner creates or approves an initial baseline commit.

## File Structure

- Create `src/context-pack.ts`: stable serialization, hash helpers, context block types, context pack builder, token estimate helper.
- Create `src/context-cache.ts`: disk-backed context pack snapshot store with longest-prefix lookup and hit-count updates.
- Create `src/narrative-session.ts`: mutable narrative session timeline with `sync()`, `snapshot()`, and `reset()`.
- Create `src/runtime-trace.ts`: small JSONL trace collector and artifact writer for runtime events.
- Create `src/runtime-worker.ts`: serial async queue that owns runtime mutation order.
- Create `src/novel-runtime-kernel.ts`: public kernel wrapper around `WorldDaemon`, context pack/session/cache, worker, and trace.
- Modify `src/index.ts`: export the new runtime modules.
- Test `tests/context-pack.test.ts`: stable hashing and pack construction.
- Test `tests/context-cache.test.ts`: snapshot persistence and prefix reuse.
- Test `tests/narrative-session.test.ts`: session sync modes.
- Test `tests/runtime-worker.test.ts`: serial execution and error recovery.
- Test `tests/novel-runtime-kernel.test.ts`: end-to-end tick writes runtime artifacts.

## Task 1: ContextPack Canonicalization

**Files:**
- Create: `src/context-pack.ts`
- Create: `tests/context-pack.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/context-pack.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { buildContextPack, hashStableValue, stableSerialize } from "../src/context-pack";

describe("ContextPack", () => {
  test("serializes object keys in stable order", () => {
    const left = stableSerialize({ b: 2, a: { d: 4, c: 3 } });
    const right = stableSerialize({ a: { c: 3, d: 4 }, b: 2 });

    expect(left).toBe(right);
    expect(hashStableValue({ b: 2, a: 1 })).toBe(hashStableValue({ a: 1, b: 2 }));
  });

  test("preserves array order in hashes", () => {
    expect(hashStableValue(["canon", "memory"])).not.toBe(hashStableValue(["memory", "canon"]));
  });

  test("builds a deterministic context pack from story inputs", () => {
    const input = {
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
      canon: { stageIds: ["stage-1"], summary: "林焰入外门。" },
      memory: { facts: ["林焰不能提前死亡"] },
      modelProfile: { model: "deepseek-v4-pro", contextWindowTokens: 1000000, reasoningEffort: "max" },
    };

    const first = buildContextPack(input);
    const second = buildContextPack({
      modelProfile: input.modelProfile,
      memory: input.memory,
      canon: input.canon,
      directive: input.directive,
      lineId: input.lineId,
      worldId: input.worldId,
    });

    expect(first.packId).toBe(second.packId);
    expect(first.blocks.map((block) => block.kind)).toEqual(["directive", "canon", "memory", "model-profile"]);
    expect(first.tokenEstimate).toBeGreaterThan(0);
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/context-pack.test.ts`

Expected: FAIL with an import error for `../src/context-pack`.

- [x] **Step 3: Add the context pack implementation**

Create `src/context-pack.ts`:

```ts
import { createHash } from "node:crypto";

import type { StageDirective } from "./domain";

export type ContextBlockKind =
  | "directive"
  | "canon"
  | "atlas"
  | "memory"
  | "metaphysics"
  | "reading"
  | "run-history"
  | "model-profile";

export type ContextBlock = {
  blockId: string;
  kind: ContextBlockKind;
  label: string;
  content: unknown;
  hash: string;
  tokenEstimate: number;
};

export type ContextPackInput = {
  worldId: string;
  lineId: string;
  directive: StageDirective;
  canon?: unknown;
  atlas?: unknown;
  memory?: unknown;
  metaphysics?: unknown;
  reading?: unknown;
  runHistory?: unknown;
  modelProfile?: unknown;
};

export type ContextPack = {
  packId: string;
  worldId: string;
  lineId: string;
  blockHashes: string[];
  tokenEstimate: number;
  blocks: ContextBlock[];
};

type BlockSource = {
  kind: ContextBlockKind;
  label: string;
  content: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) return "\"__undefined__\"";
  if (typeof value === "number" && !Number.isFinite(value)) return JSON.stringify(String(value));
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export function hashStableValue(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function estimateContextTokens(value: unknown): number {
  const chars = stableSerialize(value).length;
  return Math.max(1, Math.ceil(chars / 4));
}

function blockIdFor(kind: ContextBlockKind, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/giu, "-")
    .replace(/^-|-$/g, "");
  return `${kind}:${slug || "block"}`;
}

function contextBlock(source: BlockSource): ContextBlock {
  const blockId = blockIdFor(source.kind, source.label);
  const hash = hashStableValue({ blockId, kind: source.kind, label: source.label, content: source.content });
  return {
    blockId,
    kind: source.kind,
    label: source.label,
    content: source.content,
    hash,
    tokenEstimate: estimateContextTokens(source.content),
  };
}

function pushIfPresent(sources: BlockSource[], kind: ContextBlockKind, label: string, content: unknown): void {
  if (content === undefined) return;
  if (isPlainRecord(content) && Object.keys(content).length === 0) return;
  if (Array.isArray(content) && content.length === 0) return;
  sources.push({ kind, label, content });
}

export function buildContextPack(input: ContextPackInput): ContextPack {
  const sources: BlockSource[] = [];
  pushIfPresent(sources, "directive", "current directive", input.directive);
  pushIfPresent(sources, "canon", "canon head", input.canon);
  pushIfPresent(sources, "atlas", "atlas slice", input.atlas);
  pushIfPresent(sources, "memory", "memory slice", input.memory);
  pushIfPresent(sources, "metaphysics", "metaphysics frame", input.metaphysics);
  pushIfPresent(sources, "reading", "reading artifacts", input.reading);
  pushIfPresent(sources, "run-history", "recent runs", input.runHistory);
  pushIfPresent(sources, "model-profile", "model profile", input.modelProfile);

  const blocks = sources.map(contextBlock);
  const blockHashes = blocks.map((block) => block.hash);
  const packId = hashStableValue({
    worldId: input.worldId,
    lineId: input.lineId,
    blocks: blocks.map((block) => ({ blockId: block.blockId, hash: block.hash })),
  });

  return {
    packId,
    worldId: input.worldId,
    lineId: input.lineId,
    blockHashes,
    tokenEstimate: blocks.reduce((sum, block) => sum + block.tokenEstimate, 0),
    blocks,
  };
}
```

- [x] **Step 4: Verify the focused test passes**

Run: `npm test -- tests/context-pack.test.ts`

Expected: PASS.

## Task 2: Disk ContextCache

**Files:**
- Create: `src/context-cache.ts`
- Create: `tests/context-cache.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/context-cache.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ContextCache } from "../src/context-cache";
import { buildContextPack } from "../src/context-pack";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function pack(label: string, extra: string[] = []) {
  return buildContextPack({
    worldId: "world-a",
    lineId: "canon",
    directive: { stageLabel: label, focusCharacterIds: ["林焰"] },
    canon: { stageIds: ["stage-1", ...extra] },
  });
}

describe("ContextCache", () => {
  test("persists and loads a snapshot", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "context-cache-"));
    tempDirs.push(rootDir);
    const cache = new ContextCache({ rootDir });
    const contextPack = pack("外门试炼");

    await cache.writeSnapshot(contextPack, "cold");
    const loaded = await cache.loadSnapshot(contextPack.packId);

    expect(loaded?.pack.packId).toBe(contextPack.packId);
    expect(loaded?.reason).toBe("cold");
    expect(loaded?.hits).toBe(0);
  });

  test("finds the longest reusable prefix snapshot", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "context-cache-"));
    tempDirs.push(rootDir);
    const cache = new ContextCache({ rootDir });
    const shortPack = pack("外门试炼");
    const longPack = buildContextPack({
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
      canon: { stageIds: ["stage-1"] },
      memory: { facts: ["林焰不能提前死亡"] },
    });

    await cache.writeSnapshot(shortPack, "cold");
    await cache.writeSnapshot(longPack, "continued");
    const match = await cache.findReusablePrefix([...longPack.blockHashes, "future-block"]);

    expect(match?.packId).toBe(longPack.packId);
    expect(match?.matchedBlockCount).toBe(longPack.blockHashes.length);
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/context-cache.test.ts`

Expected: FAIL with an import error for `../src/context-cache`.

- [x] **Step 3: Add the context cache implementation**

Create `src/context-cache.ts`:

```ts
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ContextPack } from "./context-pack";

export type ContextCacheReason = "cold" | "continued" | "evict" | "shutdown" | "canon-gate" | "author-handoff";

export type ContextCacheSnapshot = {
  packId: string;
  blockHashes: string[];
  tokenEstimate: number;
  reason: ContextCacheReason;
  hits: number;
  createdAt: string;
  lastUsedAt: string;
  blockLabels: string[];
  pack: ContextPack;
};

export type ContextCachePrefixMatch = ContextCacheSnapshot & {
  matchedBlockCount: number;
};

export class ContextCache {
  constructor(private readonly input: { rootDir: string }) {}

  get cacheRoot(): string {
    return join(this.input.rootDir, "context-cache");
  }

  async writeSnapshot(pack: ContextPack, reason: ContextCacheReason): Promise<ContextCacheSnapshot> {
    await mkdir(this.cacheRoot, { recursive: true });
    const now = new Date().toISOString();
    const existing = await this.loadSnapshot(pack.packId);
    const snapshot: ContextCacheSnapshot = {
      packId: pack.packId,
      blockHashes: pack.blockHashes,
      tokenEstimate: pack.tokenEstimate,
      reason,
      hits: existing?.hits ?? 0,
      createdAt: existing?.createdAt ?? now,
      lastUsedAt: existing?.lastUsedAt ?? now,
      blockLabels: pack.blocks.map((block) => block.label),
      pack,
    };
    await writeFile(this.snapshotPath(pack.packId), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return snapshot;
  }

  async loadSnapshot(packId: string): Promise<ContextCacheSnapshot | undefined> {
    try {
      return JSON.parse(await readFile(this.snapshotPath(packId), "utf8")) as ContextCacheSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async findReusablePrefix(blockHashes: string[]): Promise<ContextCachePrefixMatch | undefined> {
    await mkdir(this.cacheRoot, { recursive: true });
    const snapshots = await this.listSnapshots();
    const matches = snapshots
      .map((snapshot) => ({ snapshot, matchedBlockCount: commonPrefixLength(snapshot.blockHashes, blockHashes) }))
      .filter((entry) => entry.matchedBlockCount === entry.snapshot.blockHashes.length && entry.matchedBlockCount > 0)
      .sort((left, right) => right.matchedBlockCount - left.matchedBlockCount);
    const best = matches[0];
    if (!best) return undefined;
    const hit = await this.recordHit(best.snapshot.packId);
    return { ...(hit ?? best.snapshot), matchedBlockCount: best.matchedBlockCount };
  }

  async listSnapshots(): Promise<ContextCacheSnapshot[]> {
    await mkdir(this.cacheRoot, { recursive: true });
    const entries = await readdir(this.cacheRoot, { withFileTypes: true });
    const snapshots = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => readFile(join(this.cacheRoot, entry.name), "utf8").then((raw) => JSON.parse(raw) as ContextCacheSnapshot)),
    );
    return snapshots;
  }

  async recordHit(packId: string): Promise<ContextCacheSnapshot | undefined> {
    const snapshot = await this.loadSnapshot(packId);
    if (!snapshot) return undefined;
    const updated: ContextCacheSnapshot = {
      ...snapshot,
      hits: snapshot.hits + 1,
      lastUsedAt: new Date().toISOString(),
    };
    await writeFile(this.snapshotPath(packId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
  }

  private snapshotPath(packId: string): string {
    if (!/^[a-f0-9]{64}$/i.test(packId)) {
      throw new Error(`Invalid context pack id: ${packId}`);
    }
    return join(this.cacheRoot, `${packId}.json`);
  }
}

export function commonPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}
```

- [x] **Step 4: Verify the focused test passes**

Run: `npm test -- tests/context-cache.test.ts`

Expected: PASS.

## Task 3: NarrativeSession Sync

**Files:**
- Create: `src/narrative-session.ts`
- Create: `tests/narrative-session.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/narrative-session.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { buildContextPack } from "../src/context-pack";
import { NarrativeSession } from "../src/narrative-session";

function contextPack(stageLabel: string, memoryFacts: string[] = []) {
  return buildContextPack({
    worldId: "world-a",
    lineId: "canon",
    directive: { stageLabel, focusCharacterIds: ["林焰"] },
    canon: { stageIds: ["stage-1"] },
    memory: memoryFacts.length ? { facts: memoryFacts } : undefined,
  });
}

describe("NarrativeSession", () => {
  test("reports replace, reuse, and extend sync modes", () => {
    const session = new NarrativeSession();
    const first = contextPack("外门试炼");
    const extended = contextPack("外门试炼", ["林焰不能提前死亡"]);

    expect(session.sync(first).mode).toBe("replace");
    expect(session.sync(first).mode).toBe("reuse");
    const extendedResult = session.sync(extended);

    expect(extendedResult.mode).toBe("extend");
    expect(extendedResult.commonBlockCount).toBe(first.blockHashes.length);
    expect(session.snapshot().packId).toBe(extended.packId);
  });

  test("replaces when the directive block changes", () => {
    const session = new NarrativeSession();
    session.sync(contextPack("外门试炼"));

    const result = session.sync(contextPack("内门试炼"));

    expect(result.mode).toBe("replace");
    expect(result.commonBlockCount).toBe(0);
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/narrative-session.test.ts`

Expected: FAIL with an import error for `../src/narrative-session`.

- [x] **Step 3: Add the session implementation**

Create `src/narrative-session.ts`:

```ts
import type { ContextPack } from "./context-pack";
import { commonPrefixLength } from "./context-cache";

export type NarrativeSessionSyncMode = "reuse" | "extend" | "replace";

export type NarrativeSessionSyncResult = {
  mode: NarrativeSessionSyncMode;
  packId: string;
  commonBlockCount: number;
  previousPackId?: string;
  revision: number;
};

export type NarrativeSessionSnapshot = {
  packId?: string;
  blockHashes: string[];
  tokenEstimate: number;
  revision: number;
  lastSync?: NarrativeSessionSyncResult;
};

export class NarrativeSession {
  private current?: ContextPack;
  private revisionValue = 0;
  private lastSyncResult?: NarrativeSessionSyncResult;

  sync(pack: ContextPack): NarrativeSessionSyncResult {
    const previous = this.current;
    const commonBlockCount = previous ? commonPrefixLength(previous.blockHashes, pack.blockHashes) : 0;
    const mode = this.syncMode(previous, pack, commonBlockCount);
    if (mode !== "reuse") {
      this.current = pack;
      this.revisionValue += 1;
    }
    this.lastSyncResult = {
      mode,
      packId: pack.packId,
      previousPackId: previous?.packId,
      commonBlockCount,
      revision: this.revisionValue,
    };
    return this.lastSyncResult;
  }

  snapshot(): NarrativeSessionSnapshot {
    return {
      packId: this.current?.packId,
      blockHashes: this.current?.blockHashes ?? [],
      tokenEstimate: this.current?.tokenEstimate ?? 0,
      revision: this.revisionValue,
      lastSync: this.lastSyncResult,
    };
  }

  reset(): void {
    this.current = undefined;
    this.lastSyncResult = undefined;
    this.revisionValue += 1;
  }

  private syncMode(previous: ContextPack | undefined, next: ContextPack, commonBlockCount: number): NarrativeSessionSyncMode {
    if (!previous) return "replace";
    if (previous.packId === next.packId) return "reuse";
    if (commonBlockCount === previous.blockHashes.length && next.blockHashes.length >= previous.blockHashes.length) return "extend";
    return "replace";
  }
}
```

- [x] **Step 4: Verify the focused test passes**

Run: `npm test -- tests/narrative-session.test.ts`

Expected: PASS.

## Task 4: RuntimeTrace Artifact Writer

**Files:**
- Create: `src/runtime-trace.ts`
- Create: `tests/runtime-trace.test.ts`
- Test: `tests/novel-runtime-kernel.test.ts` in Task 6

- [x] **Step 1: Write the failing RuntimeTrace test**

Create `tests/runtime-trace.test.ts` to verify event collection, JSONL output, and `runtime.trace` artifact persistence through `SimulationRunStore`.

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/runtime-trace.test.ts`

Expected: FAIL with an import error for `../src/runtime-trace`.

- [x] **Step 3: Add the trace implementation**

Create `src/runtime-trace.ts`:

```ts
import type { ArtifactRef, SimulationRun } from "./runtime-types";
import type { SimulationRunStore } from "./run-store";

export type RuntimeTraceEvent = {
  at: string;
  type:
    | "context-pack"
    | "cache-hit"
    | "cache-miss"
    | "session-sync"
    | "world-tick"
    | "world-resume"
    | "canon-gate"
    | "error";
  message: string;
  data?: unknown;
};

export class RuntimeTrace {
  private readonly events: RuntimeTraceEvent[] = [];

  event(type: RuntimeTraceEvent["type"], message: string, data?: unknown): RuntimeTraceEvent {
    const traceEvent: RuntimeTraceEvent = {
      at: new Date().toISOString(),
      type,
      message,
      data,
    };
    this.events.push(traceEvent);
    return traceEvent;
  }

  toJSONL(): string {
    return `${this.events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  }

  snapshot(): RuntimeTraceEvent[] {
    return [...this.events];
  }

  async writeArtifacts(runStore: SimulationRunStore, run: SimulationRun): Promise<ArtifactRef[]> {
    const traceRef = await runStore.writeArtifact(run, {
      refId: "runtime.trace",
      relativePath: "runtime/trace.jsonl",
      kind: "jsonl",
      value: this.events,
    });
    await runStore.saveRun(run);
    return [traceRef];
  }
}
```

- [x] **Step 4: Run the type checker**

Run: `npm run check`

Expected: PASS after Tasks 1-3 are implemented. If this task is run before those tasks, TypeScript will fail on missing imports from earlier planned files.

## Task 5: Serial NovelRuntimeWorker

**Files:**
- Create: `src/runtime-worker.ts`
- Create: `tests/runtime-worker.test.ts`

- [x] **Step 1: Write the failing tests**

Create `tests/runtime-worker.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { NovelRuntimeWorker } from "../src/runtime-worker";

describe("NovelRuntimeWorker", () => {
  test("runs jobs serially in enqueue order", async () => {
    const worker = new NovelRuntimeWorker();
    const events: string[] = [];

    const first = worker.enqueue("first", async () => {
      events.push("first-start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("first-end");
      return "one";
    });
    const second = worker.enqueue("second", async () => {
      events.push("second-start");
      events.push("second-end");
      return "two";
    });

    await expect(first).resolves.toBe("one");
    await expect(second).resolves.toBe("two");
    expect(events).toEqual(["first-start", "first-end", "second-start", "second-end"]);
    expect(worker.snapshot().completedJobs).toBe(2);
  });

  test("continues after a failed job", async () => {
    const worker = new NovelRuntimeWorker();

    const failed = worker.enqueue("failed", async () => {
      throw new Error("planned failure");
    });
    const next = worker.enqueue("next", async () => "ok");

    await expect(failed).rejects.toThrow("planned failure");
    await expect(next).resolves.toBe("ok");
    expect(worker.snapshot().failedJobs).toBe(1);
    expect(worker.snapshot().completedJobs).toBe(1);
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/runtime-worker.test.ts`

Expected: FAIL with an import error for `../src/runtime-worker`.

- [x] **Step 3: Add the worker implementation**

Create `src/runtime-worker.ts`:

```ts
export type RuntimeJobSnapshot = {
  queuedJobs: number;
  activeJob?: string;
  completedJobs: number;
  failedJobs: number;
};

export class NovelRuntimeWorker {
  private tail: Promise<void> = Promise.resolve();
  private queuedJobs = 0;
  private activeJob?: string;
  private completedJobs = 0;
  private failedJobs = 0;

  enqueue<T>(label: string, task: () => Promise<T>): Promise<T> {
    this.queuedJobs += 1;
    const run = this.tail.then(async () => {
      this.queuedJobs -= 1;
      this.activeJob = label;
      try {
        const result = await task();
        this.completedJobs += 1;
        return result;
      } catch (error) {
        this.failedJobs += 1;
        throw error;
      } finally {
        this.activeJob = undefined;
      }
    });
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  snapshot(): RuntimeJobSnapshot {
    return {
      queuedJobs: this.queuedJobs,
      activeJob: this.activeJob,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
    };
  }
}
```

- [x] **Step 4: Verify the focused test passes**

Run: `npm test -- tests/runtime-worker.test.ts`

Expected: PASS.

## Task 6: NovelRuntimeKernel Wrapper

**Files:**
- Create: `src/novel-runtime-kernel.ts`
- Create: `tests/novel-runtime-kernel.test.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Write the failing end-to-end test**

Create `tests/novel-runtime-kernel.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { NovelRuntimeKernel, SimulationRunStore, WorldHistoryEngine, parseWorldDraft } from "../src/index";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const draft = `
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

describe("NovelRuntimeKernel", () => {
  test("runs a tick through the runtime session and writes trace artifacts", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-runtime-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const kernel = new NovelRuntimeKernel({
      engine: new WorldHistoryEngine(parseWorldDraft(draft)),
      runStore,
      config: {
        worldId: "runtime-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: false,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });

    const result = await kernel.tick({
      reason: "manual",
      requestedBy: "test",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });

    expect(result.status).toBe("completed");
    expect(kernel.inspectSession().packId).toBeDefined();
    const run = await runStore.loadRun(result.runId);
    const traceRef = run.artifacts.refs.find((ref) => ref.refId === "runtime.trace");
    const syncRef = run.artifacts.refs.find((ref) => ref.refId === "runtime.context-sync");
    expect(traceRef).toBeDefined();
    expect(syncRef).toBeDefined();
    const trace = await readFile(traceRef!.path, "utf8");
    expect(trace).toContain("session-sync");
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/novel-runtime-kernel.test.ts`

Expected: FAIL with an export or import error for `NovelRuntimeKernel`.

- [x] **Step 3: Add the kernel implementation**

Create `src/novel-runtime-kernel.ts`:

```ts
import { DEFAULT_DEEPSEEK_PROFILE } from "./deepseek-profile";
import type { StageDirective } from "./domain";
import { WorldHistoryEngine } from "./engine";
import { SimulationRunStore } from "./run-store";
import type { WorldDaemonConfig, WorldTickInput, WorldTickResult } from "./runtime-types";
import { WorldDaemon } from "./world-daemon";
import { ContextCache } from "./context-cache";
import { buildContextPack, type ContextPack } from "./context-pack";
import { NarrativeSession, type NarrativeSessionSnapshot } from "./narrative-session";
import { RuntimeTrace } from "./runtime-trace";
import { NovelRuntimeWorker } from "./runtime-worker";

export type NovelRuntimeKernelInput = {
  engine: WorldHistoryEngine;
  runStore: SimulationRunStore;
  config: WorldDaemonConfig;
  session?: NarrativeSession;
  cache?: ContextCache;
  worker?: NovelRuntimeWorker;
};

export class NovelRuntimeKernel {
  private readonly daemon: WorldDaemon;
  private readonly session: NarrativeSession;
  private readonly cache: ContextCache;
  private readonly worker: NovelRuntimeWorker;

  constructor(private readonly input: NovelRuntimeKernelInput) {
    this.daemon = new WorldDaemon({
      engine: input.engine,
      runStore: input.runStore,
      config: input.config,
    });
    this.session = input.session ?? new NarrativeSession();
    this.cache = input.cache ?? new ContextCache({ rootDir: input.config.storage.runRoot });
    this.worker = input.worker ?? new NovelRuntimeWorker();
  }

  tick(input: WorldTickInput): Promise<WorldTickResult> {
    return this.worker.enqueue("world-tick", async () => {
      const trace = new RuntimeTrace();
      const pack = this.buildPack(input.directive ?? this.defaultDirective());
      trace.event("context-pack", `built context pack ${pack.packId}`, {
        packId: pack.packId,
        blockHashes: pack.blockHashes,
        tokenEstimate: pack.tokenEstimate,
      });

      const cacheMatch = await this.cache.findReusablePrefix(pack.blockHashes);
      if (cacheMatch) {
        trace.event("cache-hit", `reused ${cacheMatch.matchedBlockCount} context blocks`, {
          packId: cacheMatch.packId,
          matchedBlockCount: cacheMatch.matchedBlockCount,
        });
      } else {
        trace.event("cache-miss", "no reusable context prefix");
      }

      const sync = this.session.sync(pack);
      trace.event("session-sync", `session ${sync.mode}`, sync);
      await this.cache.writeSnapshot(pack, sync.mode === "reuse" ? "continued" : "cold");

      const result = await this.daemon.tick(input);
      trace.event("world-tick", `world tick ${result.status}`, result);
      if (result.canonDecision) {
        trace.event("canon-gate", `CanonGate ${result.canonDecision.result}`, result.canonDecision);
      }
      await this.attachRuntimeArtifacts(result.runId, pack, sync, trace);
      return result;
    });
  }

  resume(runId: string): Promise<WorldTickResult> {
    return this.worker.enqueue("world-resume", async () => {
      return this.daemon.resume(runId);
    });
  }

  inspectSession(): NarrativeSessionSnapshot {
    return this.session.snapshot();
  }

  private buildPack(directive: StageDirective): ContextPack {
    const parsed = this.input.engine.getParsedWorld();
    const canonLine = this.input.engine.getCanonLine();
    const latestStage = canonLine.stages.at(-1);
    return buildContextPack({
      worldId: this.input.config.worldId,
      lineId: canonLine.lineId,
      directive,
      canon: {
        lineId: canonLine.lineId,
        stageIds: canonLine.stages.map((stage) => stage.id),
        latestStage: latestStage
          ? {
              stageId: latestStage.id,
              stageLabel: latestStage.stageLabel,
              eventTitles: latestStage.events.map((event) => event.title),
            }
          : undefined,
      },
      memory: {
        characterAnchors: parsed.characterAnchors,
        relationshipAnchors: parsed.relationshipAnchors,
      },
      metaphysics: latestStage
        ? {
            qimenContext: latestStage.qimenContext,
            qimenModifier: latestStage.qimenModifier,
            explanation: latestStage.metaphysicsExplanation,
          }
        : directive.qimenOverride
          ? { qimenOverride: directive.qimenOverride }
          : undefined,
      modelProfile: DEFAULT_DEEPSEEK_PROFILE,
    });
  }

  private async attachRuntimeArtifacts(
    runId: string,
    pack: ContextPack,
    sync: ReturnType<NarrativeSession["sync"]>,
    trace: RuntimeTrace,
  ): Promise<void> {
    const run = await this.input.runStore.loadRun(runId);
    await this.input.runStore.writeArtifact(run, {
      refId: "runtime.context-sync",
      relativePath: "runtime/context-sync.json",
      kind: "json",
      value: {
        packId: pack.packId,
        blockHashes: pack.blockHashes,
        tokenEstimate: pack.tokenEstimate,
        sync,
      },
    });
    await trace.writeArtifacts(this.input.runStore, run);
  }

  private defaultDirective(): StageDirective {
    const first = this.input.engine.getParsedWorld().characters[0]?.id;
    return {
      stageLabel: "世界自动推进",
      focusCharacterIds: first ? [first] : [],
    };
  }
}
```

- [x] **Step 4: Export the runtime modules**

Add these exports to `src/index.ts` near the existing runtime exports:

```ts
export * from "./context-pack";
export * from "./context-cache";
export * from "./narrative-session";
export * from "./runtime-trace";
export * from "./runtime-worker";
export * from "./novel-runtime-kernel";
```

- [x] **Step 5: Verify the focused test passes**

Run: `npm test -- tests/novel-runtime-kernel.test.ts`

Expected: PASS.

## Task 7: Full Verification

**Files:**
- Modify only files from Tasks 1-6 if verification reveals a concrete failure.

- [x] **Step 1: Run all focused runtime tests**

Run:

```sh
npm test -- tests/context-pack.test.ts tests/context-cache.test.ts tests/narrative-session.test.ts tests/runtime-trace.test.ts tests/runtime-worker.test.ts tests/novel-runtime-kernel.test.ts
```

Expected: all focused runtime tests PASS.

- [x] **Step 2: Run the TypeScript checker**

Run: `npm run check`

Expected: PASS.

- [x] **Step 3: Run the full test suite**

Run: `npm test`

Expected: all existing and new tests PASS.

- [x] **Step 4: Inspect changed files**

Run: `git status --short src tests docs/superpowers`

Expected: the new runtime files, tests, and documentation files are listed. Existing unrelated untracked project files may still appear because the repository has no baseline commit.

## Self-Review

- Spec coverage: this plan implements the Phase 1 scope from the ds4-inspired runtime spec: `ContextPack`, `NarrativeSession`, `ContextCache`, `RuntimeTrace`, `NovelRuntimeWorker`, `NovelRuntimeKernel`, exports, and deterministic tests.
- Out-of-scope coverage: this plan does not change DeepSeek prompts, Workbench UI, CanonGate scoring, or introduce an OpenAI/Anthropic-compatible server, matching the spec's Phase 1 boundary.
- Placeholder scan: no planned step relies on undefined file names or unspecified behavior.
- Type consistency: `ContextPack`, `ContextCache`, `NarrativeSession`, `RuntimeTrace`, `NovelRuntimeWorker`, and `NovelRuntimeKernel` names are consistent across files and tests.
