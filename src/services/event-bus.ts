// Layer 2 · EventBus.
// SQLite-backed append + query, with an in-process pub/sub for low-latency
// SSE forwarding. Append failures NEVER throw — they log and return.

import { EventEmitter } from "node:events";

import type { Db } from "../data/db";
import type {
  EventFilter,
  EventStatus,
  WorldEvent,
} from "../domain/events";

const APPEND_SQL = `
  INSERT INTO events (
    id, ts, world_id, run_id, chapter_id, scene_id,
    subsystem, severity, status, phase, verb, subject, summary, refs_json, expires_at
  ) VALUES (
    @id, @ts, @worldId, @runId, @chapterId, @sceneId,
    @subsystem, @severity, @status, @phase, @verb, @subject, @summary, @refs, @expiresAt
  )
  ON CONFLICT(id) DO UPDATE SET
    status     = excluded.status,
    summary    = excluded.summary,
    refs_json  = excluded.refs_json,
    ts         = excluded.ts
`;

type EventRow = {
  id: string;
  ts: number;
  world_id: string | null;
  run_id: string | null;
  chapter_id: string | null;
  scene_id: string | null;
  subsystem: string;
  severity: string;
  status: string;
  phase: string | null;
  verb: string;
  subject: string;
  summary: string;
  refs_json: string | null;
  expires_at: number | null;
};

function toRow(event: WorldEvent): {
  id: string;
  ts: number;
  worldId: string | null;
  runId: string | null;
  chapterId: string | null;
  sceneId: string | null;
  subsystem: string;
  severity: string;
  status: string;
  phase: string | null;
  verb: string;
  subject: string;
  summary: string;
  refs: string | null;
  expiresAt: number | null;
} {
  return {
    id: event.id,
    ts: event.ts,
    worldId: event.worldId ?? null,
    runId: event.runId ?? null,
    chapterId: event.chapterId ?? null,
    sceneId: event.sceneId ?? null,
    subsystem: event.subsystem,
    severity: event.severity,
    status: event.status,
    phase: event.phase ?? null,
    verb: event.verb,
    subject: event.subject,
    summary: event.summary,
    refs: event.refs ? JSON.stringify(event.refs) : null,
    expiresAt: event.expiresAt ?? null,
  };
}

function fromRow(row: EventRow): WorldEvent {
  return {
    id: row.id,
    ts: row.ts,
    worldId: row.world_id ?? undefined,
    runId: row.run_id ?? undefined,
    chapterId: row.chapter_id ?? undefined,
    sceneId: row.scene_id ?? undefined,
    subsystem: row.subsystem as WorldEvent["subsystem"],
    severity: row.severity as WorldEvent["severity"],
    status: row.status as EventStatus,
    phase: row.phase ?? undefined,
    verb: row.verb,
    subject: row.subject,
    summary: row.summary,
    refs: row.refs_json ? (JSON.parse(row.refs_json) as Record<string, unknown>) : undefined,
    expiresAt: row.expires_at ?? undefined,
  };
}

export type EventListener = (event: WorldEvent) => void;
export type Unsubscribe = () => void;

export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly insert: ReturnType<Db["prepare"]>;

  constructor(private readonly db: Db) {
    this.emitter.setMaxListeners(0);
    this.insert = this.db.prepare(APPEND_SQL);
  }

  /**
   * Append an event. Failures are caught + logged. Subscribers are
   * notified after a successful append.
   */
  append(event: WorldEvent): void {
    try {
      this.insert.run(toRow(event));
      this.emitter.emit("event", event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        "[event-bus] append failed:",
        event.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Convenience: validate required fields and append.
   * Returns false if the event was malformed (without throwing).
   */
  emit(event: WorldEvent): boolean {
    if (!event.id || !event.subsystem || !event.severity || !event.status || !event.verb) {
      // eslint-disable-next-line no-console
      console.warn("[event-bus] rejected malformed event:", event);
      return false;
    }
    this.append(event);
    return true;
  }

  query(filter: EventFilter = {}): WorldEvent[] {
    const where: string[] = [];
    const params: Record<string, unknown> = {};
    if (filter.worldId) {
      where.push("world_id = @worldId");
      params.worldId = filter.worldId;
    }
    if (filter.runId) {
      where.push("run_id = @runId");
      params.runId = filter.runId;
    }
    if (filter.chapterId) {
      where.push("chapter_id = @chapterId");
      params.chapterId = filter.chapterId;
    }
    if (filter.subsystem?.length) {
      where.push(
        `subsystem IN (${filter.subsystem.map((_, i) => `@sub${i}`).join(", ")})`,
      );
      filter.subsystem.forEach((value, i) => {
        params[`sub${i}`] = value;
      });
    }
    if (filter.severity?.length) {
      where.push(
        `severity IN (${filter.severity.map((_, i) => `@sev${i}`).join(", ")})`,
      );
      filter.severity.forEach((value, i) => {
        params[`sev${i}`] = value;
      });
    }
    if (filter.since !== undefined) {
      where.push("ts >= @since");
      params.since = filter.since;
    }
    if (filter.until !== undefined) {
      where.push("ts <= @until");
      params.until = filter.until;
    }

    const limit = Math.min(filter.limit ?? 200, 2000);
    const sql = `SELECT * FROM events ${
      where.length ? `WHERE ${where.join(" AND ")}` : ""
    } ORDER BY ts DESC, id DESC LIMIT ${limit}`;

    const rows = this.db.prepare(sql).all(params) as EventRow[];
    return rows.map(fromRow);
  }

  subscribe(listener: EventListener): Unsubscribe {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  close(): void {
    this.emitter.removeAllListeners();
  }
}

// =============================================================================
// Convenience event factories — keep shape consistent across emitters.
// =============================================================================
export type EmitInput = Omit<WorldEvent, "ts"> & { ts?: number };

export function nowEvent(input: EmitInput): WorldEvent {
  return { ts: Date.now(), ...input } as WorldEvent;
}
