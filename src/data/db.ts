import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const SCHEMA_VERSION = "v3.1.0";
const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "schema.sql");

export type Db = Database.Database;

export type OpenDbOptions = {
  rootDir: string;
  filename?: string;
  readonly?: boolean;
};

export function openDb(options: OpenDbOptions): Db {
  const dir = options.rootDir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, options.filename ?? "world.db");
  const db = new Database(path, { readonly: options.readonly ?? false });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  if (!options.readonly) migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  const stored = db
    .prepare<[], { value: string }>("SELECT value FROM _meta WHERE key = 'schema_version'")
    .get();
  if (!stored) {
    db.prepare("INSERT INTO _meta(key, value) VALUES (?, ?)")
      .run("schema_version", SCHEMA_VERSION);
    return;
  }
  if (stored.value === SCHEMA_VERSION) return;

  // ladder: v3.0.0 → v3.1.0 adds embedding_* columns to ai_settings.
  if (stored.value === "v3.0.0") {
    addColumnIfMissing(db, "ai_settings", "embedding_api_key", "TEXT");
    addColumnIfMissing(db, "ai_settings", "embedding_base_url", "TEXT");
    addColumnIfMissing(db, "ai_settings", "embedding_model", "TEXT");
    addColumnIfMissing(db, "ai_settings", "embedding_dim", "INTEGER");
    db.prepare("UPDATE _meta SET value = ? WHERE key = 'schema_version'").run(SCHEMA_VERSION);
    return;
  }

  throw new Error(
    `world.db schema version mismatch: stored=${stored.value} expected=${SCHEMA_VERSION}. ` +
      `No migration ladder from ${stored.value}; manual migration required.`,
  );
}

function addColumnIfMissing(db: Db, table: string, column: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

export function schemaVersion(): string {
  return SCHEMA_VERSION;
}
