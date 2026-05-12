import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const SCHEMA_VERSION = "v3.0.0";
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
  } else if (stored.value !== SCHEMA_VERSION) {
    // Phase 0: no migration ladder yet. New version on a populated DB is an error.
    throw new Error(
      `world.db schema version mismatch: stored=${stored.value} expected=${SCHEMA_VERSION}. ` +
        `Manual migration required (no v3 ladder yet).`,
    );
  }
}

export function schemaVersion(): string {
  return SCHEMA_VERSION;
}
