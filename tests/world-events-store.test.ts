import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  closeWorldEvents,
  makeEventId,
  queryWorldEvents,
  recordWorldEvent,
  setWorldEventsDbPath,
} from "../src/world-events/store";
import type { WorldEvent } from "../src/world-events/types";

const tempDirs: string[] = [];

function withTempStore(): string {
  const dir = mkdtempSync(join(tmpdir(), "world-events-test-"));
  tempDirs.push(dir);
  const path = join(dir, "events.sqlite");
  setWorldEventsDbPath(path);
  return path;
}

function baseEvent(overrides: Partial<WorldEvent>): WorldEvent {
  return {
    id: "compose:r1:memory-read:started",
    ts: Date.now(),
    subsystem: "compose",
    severity: "ambient",
    status: "started",
    verb: "取材",
    subject: "本章",
    summary: "stage start",
    ...overrides,
  };
}

beforeEach(() => {
  withTempStore();
});

afterEach(async () => {
  closeWorldEvents();
  setWorldEventsDbPath(null);
  await Promise.all(
    tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("world-events store", () => {
  test("rejects events missing required fields", () => {
    expect(() => {
      // @ts-expect-error intentional bad event
      recordWorldEvent({ ts: 1, subsystem: "compose" });
    }).not.toThrow(); // fire-and-forget: validation warns but does not throw

    // After failed write, nothing should be queryable.
    expect(queryWorldEvents()).toHaveLength(0);
  });

  test("inserts events and returns them in newest-first order", () => {
    const events: WorldEvent[] = [
      baseEvent({ id: "compose:r1:memory-read:succeeded", ts: 1000, status: "succeeded", severity: "notable" }),
      baseEvent({ id: "compose:r1:blueprint:succeeded", ts: 2000, status: "succeeded", phase: "blueprint", verb: "立骨", severity: "notable" }),
      baseEvent({ id: "compose:r1:scene-expand:succeeded", ts: 3000, status: "succeeded", phase: "scene-expand", verb: "铺场", severity: "notable" }),
    ];
    for (const event of events) recordWorldEvent(event);
    const rows = queryWorldEvents();
    expect(rows.map((r) => r.id)).toEqual([
      "compose:r1:scene-expand:succeeded",
      "compose:r1:blueprint:succeeded",
      "compose:r1:memory-read:succeeded",
    ]);
  });

  test("INSERT OR IGNORE makes recordWorldEvent idempotent on id", () => {
    const id = makeEventId({ subsystem: "compose", runId: "r1", phase: "memory-read", sourceRef: "started" });
    recordWorldEvent(baseEvent({ id, summary: "first" }));
    recordWorldEvent(baseEvent({ id, summary: "second-should-be-ignored" }));
    const rows = queryWorldEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summary).toBe("first");
  });

  test("filters by chapterId", () => {
    recordWorldEvent(baseEvent({ id: "a", chapterId: "c1", ts: 1 }));
    recordWorldEvent(baseEvent({ id: "b", chapterId: "c2", ts: 2 }));
    expect(queryWorldEvents({ chapterId: "c1" }).map((r) => r.id)).toEqual(["a"]);
    expect(queryWorldEvents({ chapterId: "c2" }).map((r) => r.id)).toEqual(["b"]);
  });

  test("filters by runId", () => {
    recordWorldEvent(baseEvent({ id: "a", runId: "r1", ts: 1 }));
    recordWorldEvent(baseEvent({ id: "b", runId: "r2", ts: 2 }));
    expect(queryWorldEvents({ runId: "r1" }).map((r) => r.id)).toEqual(["a"]);
  });

  test("filters by subsystem (CSV-style array)", () => {
    recordWorldEvent(baseEvent({ id: "a", subsystem: "compose", ts: 1 }));
    recordWorldEvent(baseEvent({ id: "b", subsystem: "canon", ts: 2, verb: "裁决" }));
    recordWorldEvent(baseEvent({ id: "c", subsystem: "memory", ts: 3, verb: "落册" }));
    const rows = queryWorldEvents({ subsystem: ["canon", "memory"] });
    expect(rows.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });

  test("filters by severity", () => {
    recordWorldEvent(baseEvent({ id: "a", severity: "ambient", ts: 1 }));
    recordWorldEvent(baseEvent({ id: "b", severity: "notable", ts: 2 }));
    recordWorldEvent(baseEvent({ id: "c", severity: "decision-required", ts: 3 }));
    const rows = queryWorldEvents({ severity: ["decision-required", "notable"] });
    expect(rows.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });

  test("filters by since timestamp", () => {
    recordWorldEvent(baseEvent({ id: "a", ts: 100 }));
    recordWorldEvent(baseEvent({ id: "b", ts: 200 }));
    recordWorldEvent(baseEvent({ id: "c", ts: 300 }));
    const rows = queryWorldEvents({ since: 200 });
    expect(rows.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });

  test("respects limit (default 50, clamped to 500)", () => {
    for (let i = 0; i < 60; i += 1) {
      recordWorldEvent(baseEvent({ id: `e${i}`, ts: 1000 + i }));
    }
    expect(queryWorldEvents().length).toBe(50);
    expect(queryWorldEvents({ limit: 10 }).length).toBe(10);
    expect(queryWorldEvents({ limit: 1000 }).length).toBe(60);
  });

  test("preserves refs as JSON roundtrip", () => {
    recordWorldEvent(
      baseEvent({
        id: "r",
        refs: { memoryIds: ["m1", "m2"], canon: { ok: true } },
      }),
    );
    const rows = queryWorldEvents();
    expect(rows[0]?.refs).toEqual({ memoryIds: ["m1", "m2"], canon: { ok: true } });
  });

  test("fire-and-forget: bad sqlite path does not throw", () => {
    closeWorldEvents();
    // /dev/null/foo is unreachable as a directory; init should fail silently
    setWorldEventsDbPath("/dev/null/foo/events.sqlite");
    expect(() =>
      recordWorldEvent(baseEvent({ id: "should-not-throw" })),
    ).not.toThrow();
    expect(queryWorldEvents()).toEqual([]);
  });
});
