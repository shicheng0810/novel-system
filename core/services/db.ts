// core/services/db.ts — 打开单文件 world.db 并应用 schema(M0 默认 :memory:)
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export type DB = Database.Database;

export function openDb(path = ":memory:"): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
  return db;
}
