import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { openDb } from "../src/data/db";
import { AiSettingsStore, maskApiKey } from "../src/services/ai-settings-store";

let tmpDirs: string[] = [];
afterEach(async () => {
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
  tmpDirs = [];
});

function harness() {
  const dir = mkdtempSync(join(tmpdir(), "v3-ai-settings-"));
  tmpDirs.push(dir);
  const db = openDb({ rootDir: dir });
  return { db, dir, store: new AiSettingsStore(db) };
}

describe("AiSettingsStore", () => {
  test("load() returns null when no row + no env var", () => {
    const { store, db } = harness();
    try {
      delete process.env.DEEPSEEK_API_KEY;
      expect(store.load()).toBeNull();
    } finally {
      db.close();
    }
  });

  test("save() persists and load() round-trips", () => {
    const { store, db } = harness();
    try {
      store.save({
        apiKey: "sk-xyz1234",
        baseUrl: "https://x",
        model: "deepseek-v4-test",
        thinkingMode: "enabled",
        reasoningEffort: "high",
        maxOutputTokens: 9000,
        embeddingApiKey: "emb-key",
        embeddingBaseUrl: "https://emb",
        embeddingModel: "text-embedding-3-small",
        embeddingDim: 1536,
      });
      const loaded = store.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.apiKey).toBe("sk-xyz1234");
      expect(loaded!.baseUrl).toBe("https://x");
      expect(loaded!.embeddingModel).toBe("text-embedding-3-small");
      expect(loaded!.embeddingDim).toBe(1536);
    } finally {
      db.close();
    }
  });

  test("save() merges with prior row instead of overwriting fields", () => {
    const { store, db } = harness();
    try {
      store.save({ apiKey: "sk-a", model: "m1" });
      store.save({ model: "m2" });
      const loaded = store.load();
      expect(loaded!.apiKey).toBe("sk-a"); // preserved
      expect(loaded!.model).toBe("m2"); // updated
    } finally {
      db.close();
    }
  });

  test("env var DEEPSEEK_API_KEY fills in when DB is empty", () => {
    const { store, db } = harness();
    try {
      process.env.DEEPSEEK_API_KEY = "sk-from-env";
      try {
        const loaded = store.load();
        expect(loaded).not.toBeNull();
        expect(loaded!.apiKey).toBe("sk-from-env");
      } finally {
        delete process.env.DEEPSEEK_API_KEY;
      }
    } finally {
      db.close();
    }
  });

  test("maskApiKey hides the secret", () => {
    expect(maskApiKey("")).toBe("");
    expect(maskApiKey("ab")).toBe("…");
    expect(maskApiKey("sk-abcdef1234")).toBe("…1234");
  });
});

describe("v3.0 → v3.1 migration ladder", () => {
  test("opens an existing v3.0 db and adds the embedding_* columns", () => {
    const dir = mkdtempSync(join(tmpdir(), "v3-migration-"));
    tmpDirs.push(dir);
    // First open creates a v3.1 schema; simulate a v3.0 db by writing the
    // old version to _meta and dropping the new columns via tracking absence.
    const dbFresh = openDb({ rootDir: dir });
    dbFresh.prepare("UPDATE _meta SET value = 'v3.0.0' WHERE key = 'schema_version'").run();
    // Drop the new columns we added in v3.1 to simulate an old DB. Easiest
    // way is to rebuild the table without them via a temp + rename.
    dbFresh.exec(`
      CREATE TABLE ai_settings_legacy (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_key TEXT, base_url TEXT, model TEXT, timeout_ms INTEGER,
        thinking_mode TEXT, reasoning_effort TEXT,
        context_window_tokens INTEGER, max_output_tokens INTEGER,
        updated_at INTEGER NOT NULL
      );
      DROP TABLE ai_settings;
      ALTER TABLE ai_settings_legacy RENAME TO ai_settings;
    `);
    dbFresh.close();

    const dbMigrated = openDb({ rootDir: dir });
    const cols = dbMigrated.prepare("PRAGMA table_info(ai_settings)").all() as Array<{
      name: string;
    }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain("embedding_api_key");
    expect(names).toContain("embedding_base_url");
    expect(names).toContain("embedding_model");
    expect(names).toContain("embedding_dim");
    const ver = dbMigrated.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get([]) as
      | { value: string }
      | undefined;
    expect(ver?.value).toBe("v3.1.0");
    dbMigrated.close();
  });
});
