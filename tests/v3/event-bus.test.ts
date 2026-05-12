import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../../src/v3/data/db";
import { EventBus } from "../../src/v3/services/event-bus";
import { makeEventId } from "../../src/v3/domain/events";
import type { WorldEvent } from "../../src/v3/domain/events";

let tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function freshBus() {
  const dir = mkdtempSync(join(tmpdir(), "v3-event-bus-"));
  tmpDirs.push(dir);
  const db = openDb({ rootDir: dir });
  return { dir, db, bus: new EventBus(db) };
}

function buildEvent(over: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id: makeEventId({ subsystem: "compose", runId: "r1", phase: "synthesize", sourceRef: "1" }),
    ts: 1000,
    worldId: "w1",
    runId: "r1",
    subsystem: "compose",
    severity: "ambient",
    status: "succeeded",
    phase: "synthesize",
    verb: "成文",
    subject: "本章",
    summary: "成文阶段完成",
    refs: { sceneId: "scene-1" },
    ...over,
  };
}

describe("EventBus", () => {
  test("append + query round trip", () => {
    const { db, bus } = freshBus();
    try {
      bus.append(buildEvent());
      const rows = bus.query({ runId: "r1" });
      expect(rows).toHaveLength(1);
      expect(rows[0].refs).toEqual({ sceneId: "scene-1" });
    } finally {
      bus.close();
      db.close();
    }
  });

  test("append is idempotent (same id upserts, no duplicates)", () => {
    const { db, bus } = freshBus();
    try {
      bus.append(buildEvent({ summary: "first" }));
      bus.append(buildEvent({ summary: "second" }));
      const rows = bus.query({ runId: "r1" });
      expect(rows).toHaveLength(1);
      expect(rows[0].summary).toBe("second");
    } finally {
      bus.close();
      db.close();
    }
  });

  test("subscribe receives events in order; unsubscribe stops them", () => {
    const { db, bus } = freshBus();
    try {
      const seen: string[] = [];
      const unsub = bus.subscribe((event) => seen.push(event.id));
      bus.append(buildEvent({ id: "a" }));
      bus.append(buildEvent({ id: "b" }));
      unsub();
      bus.append(buildEvent({ id: "c" }));
      expect(seen).toEqual(["a", "b"]);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("emit() rejects malformed events without throwing", () => {
    const { db, bus } = freshBus();
    try {
      const ok = bus.emit({
        id: "",
        ts: 0,
        subsystem: "compose",
        severity: "ambient",
        status: "succeeded",
        verb: "",
        subject: "",
        summary: "",
      });
      expect(ok).toBe(false);
      expect(bus.query()).toHaveLength(0);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("query filters by subsystem + severity + since", () => {
    const { db, bus } = freshBus();
    try {
      bus.append(buildEvent({ id: "a", ts: 1000, subsystem: "memory", severity: "notable" }));
      bus.append(buildEvent({ id: "b", ts: 2000, subsystem: "compose", severity: "ambient" }));
      bus.append(buildEvent({ id: "c", ts: 3000, subsystem: "compose", severity: "decision-required" }));
      expect(bus.query({ subsystem: ["compose"] })).toHaveLength(2);
      expect(bus.query({ severity: ["decision-required"] })).toHaveLength(1);
      expect(bus.query({ since: 2500 })).toHaveLength(1);
    } finally {
      bus.close();
      db.close();
    }
  });
});
