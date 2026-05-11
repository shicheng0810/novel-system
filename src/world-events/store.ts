import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

import type {
  WorldEvent,
  WorldEventFilter,
  WorldEventSeverity,
  WorldEventStatus,
  WorldEventSubsystem,
} from "./types";

export type {
  WorldEvent,
  WorldEventFilter,
  WorldEventSeverity,
  WorldEventStatus,
  WorldEventSubsystem,
} from "./types";

const DEFAULT_DB_PATH = ".novel-system/world-events.sqlite";

type StoreHandle = {
  db: Database.Database;
  insert: Database.Statement;
};

let cachedPath: string = DEFAULT_DB_PATH;
let cachedHandle: StoreHandle | null = null;
let initFailed = false;

const SUBSYSTEMS: WorldEventSubsystem[] = [
  "runtime",
  "compose",
  "memory",
  "atlas",
  "canon",
  "character-agent",
  "qimen",
  "promotion",
  "pause",
];

const SEVERITIES: WorldEventSeverity[] = [
  "ambient",
  "notable",
  "decision-required",
];

const STATUSES: WorldEventStatus[] = [
  "started",
  "progress",
  "succeeded",
  "failed",
  "blocked",
];

/**
 * Test/CLI hook: override the on-disk location and force re-initialization
 * on next call. Pass null to reset back to the default path.
 */
export function setWorldEventsDbPath(path: string | null): void {
  closeWorldEvents();
  cachedPath = path ?? DEFAULT_DB_PATH;
  initFailed = false;
}

function ensureHandle(): StoreHandle | null {
  if (cachedHandle) return cachedHandle;
  if (initFailed) return null;
  try {
    const dir = dirname(cachedPath);
    if (dir && dir !== "." && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const db = new Database(cachedPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS world_events (
        id TEXT PRIMARY KEY,
        ts INTEGER NOT NULL,
        chapterId TEXT,
        runId TEXT,
        sceneId TEXT,
        subsystem TEXT NOT NULL,
        severity TEXT NOT NULL,
        phase TEXT,
        verb TEXT NOT NULL,
        subject TEXT NOT NULL,
        summary TEXT NOT NULL,
        refs TEXT,
        status TEXT NOT NULL,
        expiresAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_world_events_chapter_ts
        ON world_events(chapterId, ts);
      CREATE INDEX IF NOT EXISTS idx_world_events_run_ts
        ON world_events(runId, ts);
      CREATE INDEX IF NOT EXISTS idx_world_events_severity_ts
        ON world_events(severity, ts);
      CREATE INDEX IF NOT EXISTS idx_world_events_subsystem_ts
        ON world_events(subsystem, ts);
    `);
    const insert = db.prepare(`
      INSERT OR IGNORE INTO world_events (
        id, ts, chapterId, runId, sceneId, subsystem, severity, phase,
        verb, subject, summary, refs, status, expiresAt
      ) VALUES (
        @id, @ts, @chapterId, @runId, @sceneId, @subsystem, @severity, @phase,
        @verb, @subject, @summary, @refs, @status, @expiresAt
      )
    `);
    cachedHandle = { db, insert };
    return cachedHandle;
  } catch (err) {
    initFailed = true;
    console.warn(
      `[world-events] init failed at ${cachedPath}: ${(err as Error).message}`,
    );
    return null;
  }
}

function isValidSubsystem(value: string): value is WorldEventSubsystem {
  return (SUBSYSTEMS as readonly string[]).includes(value);
}

function isValidSeverity(value: string): value is WorldEventSeverity {
  return (SEVERITIES as readonly string[]).includes(value);
}

function isValidStatus(value: string): value is WorldEventStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function validateEvent(event: WorldEvent): void {
  if (!event.id) throw new Error("WorldEvent.id is required");
  if (typeof event.ts !== "number" || !Number.isFinite(event.ts)) {
    throw new Error("WorldEvent.ts must be a finite number");
  }
  if (!isValidSubsystem(event.subsystem)) {
    throw new Error(`WorldEvent.subsystem invalid: ${event.subsystem}`);
  }
  if (!isValidSeverity(event.severity)) {
    throw new Error(`WorldEvent.severity invalid: ${event.severity}`);
  }
  if (!isValidStatus(event.status)) {
    throw new Error(`WorldEvent.status invalid: ${event.status}`);
  }
  if (!event.verb) throw new Error("WorldEvent.verb is required");
  if (!event.subject) throw new Error("WorldEvent.subject is required");
  if (typeof event.summary !== "string") {
    throw new Error("WorldEvent.summary must be a string");
  }
}

/**
 * Fire-and-forget emitter. Failures are logged once via console.warn and
 * never propagated. Callers should NOT await this even though it is sync —
 * treat it as best-effort telemetry.
 */
export function recordWorldEvent(event: WorldEvent): void {
  try {
    validateEvent(event);
    const handle = ensureHandle();
    if (!handle) return;
    handle.insert.run({
      id: event.id,
      ts: event.ts,
      chapterId: event.chapterId ?? null,
      runId: event.runId ?? null,
      sceneId: event.sceneId ?? null,
      subsystem: event.subsystem,
      severity: event.severity,
      phase: event.phase ?? null,
      verb: event.verb,
      subject: event.subject,
      summary: event.summary,
      refs: event.refs ? JSON.stringify(event.refs) : null,
      status: event.status,
      expiresAt: event.expiresAt ?? null,
    });
  } catch (err) {
    console.warn(`[world-events] emit failed: ${(err as Error).message}`);
  }
}

type Row = {
  id: string;
  ts: number;
  chapterId: string | null;
  runId: string | null;
  sceneId: string | null;
  subsystem: string;
  severity: string;
  phase: string | null;
  verb: string;
  subject: string;
  summary: string;
  refs: string | null;
  status: string;
  expiresAt: number | null;
};

function rowToEvent(row: Row): WorldEvent {
  let refs: Record<string, unknown> | undefined;
  if (row.refs) {
    try {
      refs = JSON.parse(row.refs);
    } catch {
      refs = undefined;
    }
  }
  const event: WorldEvent = {
    id: row.id,
    ts: row.ts,
    subsystem: row.subsystem as WorldEventSubsystem,
    severity: row.severity as WorldEventSeverity,
    status: row.status as WorldEventStatus,
    verb: row.verb,
    subject: row.subject,
    summary: row.summary,
  };
  if (row.chapterId !== null) event.chapterId = row.chapterId;
  if (row.runId !== null) event.runId = row.runId;
  if (row.sceneId !== null) event.sceneId = row.sceneId;
  if (row.phase !== null) event.phase = row.phase;
  if (refs) event.refs = refs;
  if (row.expiresAt !== null) event.expiresAt = row.expiresAt;
  return event;
}

export function queryWorldEvents(filter: WorldEventFilter = {}): WorldEvent[] {
  const handle = ensureHandle();
  if (!handle) return [];
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filter.chapterId !== undefined) {
    where.push("chapterId = @chapterId");
    params.chapterId = filter.chapterId;
  }
  if (filter.runId !== undefined) {
    where.push("runId = @runId");
    params.runId = filter.runId;
  }
  if (filter.subsystem && filter.subsystem.length > 0) {
    const placeholders = filter.subsystem
      .map((_, idx) => `@subsystem_${idx}`)
      .join(", ");
    where.push(`subsystem IN (${placeholders})`);
    filter.subsystem.forEach((value, idx) => {
      params[`subsystem_${idx}`] = value;
    });
  }
  if (filter.severity && filter.severity.length > 0) {
    const placeholders = filter.severity
      .map((_, idx) => `@severity_${idx}`)
      .join(", ");
    where.push(`severity IN (${placeholders})`);
    filter.severity.forEach((value, idx) => {
      params[`severity_${idx}`] = value;
    });
  }
  if (filter.since !== undefined) {
    where.push("ts >= @since");
    params.since = filter.since;
  }
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 500));
  const sql = `
    SELECT * FROM world_events
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ts DESC
    LIMIT ${limit}
  `;
  try {
    const rows = handle.db.prepare(sql).all(params) as Row[];
    return rows.map(rowToEvent);
  } catch (err) {
    console.warn(`[world-events] query failed: ${(err as Error).message}`);
    return [];
  }
}

export function closeWorldEvents(): void {
  if (cachedHandle) {
    try {
      cachedHandle.db.close();
    } catch {
      // best-effort
    }
    cachedHandle = null;
  }
  initFailed = false;
}

export function makeEventId(parts: {
  subsystem: string;
  runId?: string;
  phase?: string;
  sourceRef?: string;
  ts?: number;
}): string {
  const subsystem = parts.subsystem;
  const runId = parts.runId ?? "_";
  const phase = parts.phase ?? "_";
  const sourceRef = parts.sourceRef ?? String(parts.ts ?? Date.now());
  return `${subsystem}:${runId}:${phase}:${sourceRef}`;
}
