import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../../src/v3/data/db";
import { EventBus } from "../../src/v3/services/event-bus";
import { MemoryService } from "../../src/v3/services/memory-service";
import { MockEmbeddingProvider } from "../../src/v3/services/embedding/mock";

let tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function fresh(withEmbedder = false) {
  const dir = mkdtempSync(join(tmpdir(), "v3-memory-"));
  tmpDirs.push(dir);
  const db = openDb({ rootDir: dir });
  const bus = new EventBus(db);
  const embedder = withEmbedder ? new MockEmbeddingProvider({ dim: 32 }) : null;
  const service = new MemoryService(db, bus, embedder);
  return { dir, db, bus, service };
}

describe("MemoryService", () => {
  test("write persists fact + emits memory event", async () => {
    const { db, bus, service } = fresh();
    try {
      await service.write({
        worldId: "w1",
        lineId: "canon",
        entry: {
          kind: "fact",
          id: "f1",
          body: "林焰在外门试炼第一次出手",
          characterIds: ["林焰"],
          importance: 7,
          source: { kind: "stage", refId: "stage-1" },
        },
      });
      const events = bus.query({ worldId: "w1" });
      expect(events).toHaveLength(1);
      expect(events[0].subsystem).toBe("memory");
      const list = service.list({ worldId: "w1", lineId: "canon" });
      expect(list).toHaveLength(1);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("recall finds entry by 3-char trigram query", async () => {
    const { db, bus, service } = fresh();
    try {
      await service.write({
        worldId: "w1",
        lineId: "canon",
        entry: {
          kind: "fact",
          id: "f1",
          body: "林焰拿到真传名额",
          characterIds: ["林焰"],
          importance: 8,
          source: { kind: "stage", refId: "stage-1" },
        },
      });
      const hits = service.recall({ worldId: "w1", lineId: "canon", query: "真传名" });
      expect(hits).toHaveLength(1);
      expect(hits[0].scores.total).toBeGreaterThan(0);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("recall falls back to LIKE for short CJK queries (e.g. 苏雪)", async () => {
    const { db, bus, service } = fresh();
    try {
      await service.write({
        worldId: "w1",
        lineId: "canon",
        entry: {
          kind: "fact",
          id: "f1",
          body: "苏雪封锁丹谷",
          characterIds: ["苏雪"],
          importance: 6,
          source: { kind: "stage", refId: "stage-1" },
        },
      });
      const hits = service.recall({ worldId: "w1", lineId: "canon", query: "苏雪" });
      expect(hits).toHaveLength(1);
      expect(hits[0].scores.keyword).toBeCloseTo(0.6, 1);
    } finally {
      bus.close();
      db.close();
    }
  });

  test("filter by character IDs narrows results", async () => {
    const { db, bus, service } = fresh();
    try {
      await service.write({
        worldId: "w1", lineId: "canon",
        entry: { kind: "fact", id: "f1", body: "封锁丹谷", characterIds: ["苏雪"], importance: 6, source: { kind: "stage", refId: "s1" } },
      });
      await service.write({
        worldId: "w1", lineId: "canon",
        entry: { kind: "fact", id: "f2", body: "封锁外门", characterIds: ["林焰"], importance: 6, source: { kind: "stage", refId: "s2" } },
      });
      const hits = service.recall({ worldId: "w1", lineId: "canon", query: "封锁", characterIds: ["林焰"] });
      expect(hits).toHaveLength(1);
      expect(hits[0].entry.id).toBe("f2");
    } finally {
      bus.close();
      db.close();
    }
  });

  test("recallHybrid blends in semantic similarity when embedder is configured", async () => {
    const { db, bus, service } = fresh(/* withEmbedder */ true);
    try {
      await service.write({
        worldId: "w1", lineId: "canon",
        entry: { kind: "fact", id: "f1", body: "林焰拿到真传名额", characterIds: ["林焰"], importance: 7, source: { kind: "stage", refId: "s1" } },
      });
      await service.write({
        worldId: "w1", lineId: "canon",
        entry: { kind: "fact", id: "f2", body: "苏雪修补丹谷阵法", characterIds: ["苏雪"], importance: 7, source: { kind: "stage", refId: "s2" } },
      });
      const hits = await service.recallHybrid({ worldId: "w1", lineId: "canon", query: "真传名额" });
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].entry.id).toBe("f1");
      expect(hits[0].scores.semantic).toBeDefined();
    } finally {
      bus.close();
      db.close();
    }
  });
});
