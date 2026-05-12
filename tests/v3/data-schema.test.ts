import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { migrate, openDb, schemaVersion } from "../../src/v3/data/db";

let tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tmpDirs = [];
});

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "v3-data-schema-"));
  tmpDirs.push(dir);
  return dir;
}

describe("v3 data schema", () => {
  test("openDb creates world.db and applies schema", () => {
    const dir = freshDir();
    const db = openDb({ rootDir: dir });
    try {
      const stored = db
        .prepare<[], { value: string }>("SELECT value FROM _meta WHERE key = 'schema_version'")
        .get();
      expect(stored?.value).toBe(schemaVersion());
    } finally {
      db.close();
    }
  });

  test("all expected tables exist after migrate", () => {
    const dir = freshDir();
    const db = openDb({ rootDir: dir });
    try {
      const tables = db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type IN ('table','virtual') ORDER BY name",
        )
        .all()
        .map((row) => row.name);
      const expected = [
        "_meta",
        "ai_settings",
        "atlas_nodes",
        "chapters",
        "checkpoints",
        "events",
        "memory_entries",
        "memory_fts",
        "metaphysics_frames",
        "runs",
        "world_history",
        "world_state",
      ];
      for (const name of expected) {
        expect(tables, `expected table ${name}`).toContain(name);
      }
    } finally {
      db.close();
    }
  });

  test("event indexes exist", () => {
    const dir = freshDir();
    const db = openDb({ rootDir: dir });
    try {
      const indexes = db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'events'",
        )
        .all()
        .map((row) => row.name);
      for (const name of [
        "idx_events_ts",
        "idx_events_run",
        "idx_events_chapter",
        "idx_events_subsystem",
        "idx_events_severity",
        "idx_events_world",
      ]) {
        expect(indexes).toContain(name);
      }
    } finally {
      db.close();
    }
  });

  test("memory FTS triggers wire up insert/delete", () => {
    const dir = freshDir();
    const db = openDb({ rootDir: dir });
    try {
      db.prepare(
        `INSERT INTO memory_entries(entry_id, world_id, line_id, kind, importance, recency_ts, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run("e1", "w1", "canon", "fact", 1, 1000, '{"body":"林焰拿到真传名额"}', 1000);

      // trigram tokenizer needs ≥3-char queries; shorter queries get LIKE fallback in memory-service.
      const hits = db
        .prepare<{ q: string }, { entry_id: string }>(
          "SELECT entry_id FROM memory_fts WHERE memory_fts MATCH :q",
        )
        .all({ q: "林焰拿" });
      expect(hits.map((h) => h.entry_id)).toContain("e1");

      db.prepare("DELETE FROM memory_entries WHERE entry_id = ?").run("e1");
      const after = db
        .prepare<{ q: string }, { entry_id: string }>(
          "SELECT entry_id FROM memory_fts WHERE memory_fts MATCH :q",
        )
        .all({ q: "林焰拿" });
      expect(after).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("migrate is idempotent on a populated db", () => {
    const dir = freshDir();
    const db = openDb({ rootDir: dir });
    try {
      expect(() => migrate(db)).not.toThrow();
    } finally {
      db.close();
    }
  });
});
