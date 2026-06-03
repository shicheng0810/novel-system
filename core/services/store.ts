// core/services/store.ts — 所有持久化(events/world_state/runs/checkpoints/scheduler/input_queue)
// 全为细粒度语句; 单事务由 WorldActor 的 saveStep 用 transaction() 组合(单写者 + 同事务)。
import type { DB } from "./db";
import type { WorldEventRecord, DomainEvent } from "../domain/events";
import type { WorldSnapshot } from "../domain/world";

export function transaction<T>(db: DB, fn: () => T): T {
  return db.transaction(fn)();
}

// ── events(append-only, 幂等 by id) ──
export function appendEvent(db: DB, e: WorldEventRecord): void {
  db.prepare(
    `INSERT OR IGNORE INTO events
       (id, world_id, line_id, tick, kind, subsystem, severity, verb, subject, summary, payload_json, refs_json, ts)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    e.id, e.worldId, e.lineId ?? null, e.tick ?? null, e.kind, e.subsystem, e.severity,
    e.verb ?? null, e.subject ?? null, e.summary ?? null,
    JSON.stringify(e.payload), e.refs ? JSON.stringify(e.refs) : null, e.ts,
  );
}

export function maxSeq(db: DB, worldId: string): number {
  const row = db.prepare(`SELECT MAX(seq) AS m FROM events WHERE world_id = ?`).get(worldId) as { m: number | null } | undefined;
  return row?.m ?? 0;
}

function rowToEvent(r: Record<string, unknown>): WorldEventRecord {
  return {
    seq: r.seq as number,
    id: r.id as string,
    worldId: r.world_id as string,
    lineId: (r.line_id as string) ?? undefined,
    tick: (r.tick as number) ?? undefined,
    kind: r.kind as WorldEventRecord["kind"],
    subsystem: r.subsystem as string,
    severity: r.severity as WorldEventRecord["severity"],
    verb: (r.verb as string) ?? undefined,
    subject: (r.subject as string) ?? undefined,
    summary: (r.summary as string) ?? undefined,
    payload: JSON.parse(r.payload_json as string) as DomainEvent,
    refs: r.refs_json ? (JSON.parse(r.refs_json as string) as Record<string, unknown>) : undefined,
    ts: r.ts as number,
  };
}
export function readEvents(db: DB, worldId: string): WorldEventRecord[] {
  return (db.prepare(`SELECT * FROM events WHERE world_id = ? ORDER BY seq`).all(worldId) as Array<Record<string, unknown>>).map(rowToEvent);
}
// 增量读: 只取 seq>sinceSeq(替代"全量读再 filter", 治千章 O(N^2) 膨胀)
export function readEventsSince(db: DB, worldId: string, sinceSeq: number): WorldEventRecord[] {
  return (db.prepare(`SELECT * FROM events WHERE world_id = ? AND seq > ? ORDER BY seq`).all(worldId, sinceSeq) as Array<Record<string, unknown>>).map(rowToEvent);
}
// 近 limit 条事件(dramaControl/simFitness 只需近窗, 不必全量反序列化)
export function readRecentEvents(db: DB, worldId: string, limit: number): WorldEventRecord[] {
  return (db.prepare(`SELECT * FROM events WHERE world_id = ? ORDER BY seq DESC LIMIT ?`).all(worldId, limit) as Array<Record<string, unknown>>).reverse().map(rowToEvent);
}

// ── world_state(快照投影; last_seq = 已 fold 到的 seq) ──
export function loadSnapshot(db: DB, worldId: string): { snapshot: WorldSnapshot; lastSeq: number } | null {
  const row = db.prepare(`SELECT snapshot_json, last_seq FROM world_state WHERE world_id = ?`).get(worldId) as
    | { snapshot_json: string; last_seq: number }
    | undefined;
  if (!row) return null;
  return { snapshot: JSON.parse(row.snapshot_json) as WorldSnapshot, lastSeq: row.last_seq };
}

export function saveSnapshot(db: DB, worldId: string, snap: WorldSnapshot, lastSeq: number, ts: number): void {
  db.prepare(
    `INSERT INTO world_state (world_id, snapshot_json, last_seq, updated_at) VALUES (?,?,?,?)
     ON CONFLICT(world_id) DO UPDATE SET snapshot_json=excluded.snapshot_json, last_seq=excluded.last_seq, updated_at=excluded.updated_at`
  ).run(worldId, JSON.stringify(snap), lastSeq, ts);
}

// ── checkpoints(多 actor 状态 + generation) ──
export function writeCheckpoint(db: DB, worldId: string, tick: number, phase: string, gen: number, actorStates: unknown, ts: number): void {
  db.prepare(
    `INSERT INTO checkpoints (world_id, tick, phase, gen, actor_states_json, created_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(world_id, tick, phase) DO UPDATE SET gen=excluded.gen, actor_states_json=excluded.actor_states_json, created_at=excluded.created_at`
  ).run(worldId, tick, phase, gen, JSON.stringify(actorStates), ts);
}

export function loadLatestCheckpoint(db: DB, worldId: string): { tick: number; gen: number; actorStates: Record<string, unknown> } | null {
  const row = db.prepare(`SELECT tick, gen, actor_states_json FROM checkpoints WHERE world_id = ? ORDER BY tick DESC LIMIT 1`).get(worldId) as
    | { tick: number; gen: number; actor_states_json: string }
    | undefined;
  if (!row) return null;
  return { tick: row.tick, gen: row.gen, actorStates: JSON.parse(row.actor_states_json) as Record<string, unknown> };
}

// ── scheduler_state(gen 防并发双 step + 进度) ──
export interface SchedulerState {
  gen: number;
  nextTick: number;
  status: string;
}
export function getSchedulerState(db: DB, worldId: string): SchedulerState {
  const row = db.prepare(`SELECT gen, next_tick, status FROM scheduler_state WHERE world_id = ?`).get(worldId) as
    | { gen: number; next_tick: number; status: string }
    | undefined;
  return row ? { gen: row.gen, nextTick: row.next_tick, status: row.status } : { gen: 0, nextTick: 0, status: "idle" };
}
export function setSchedulerState(db: DB, worldId: string, s: SchedulerState, ts: number): void {
  db.prepare(
    `INSERT INTO scheduler_state (world_id, gen, next_tick, status, updated_at) VALUES (?,?,?,?,?)
     ON CONFLICT(world_id) DO UPDATE SET gen=excluded.gen, next_tick=excluded.next_tick, status=excluded.status, updated_at=excluded.updated_at`
  ).run(worldId, s.gen, s.nextTick, s.status, ts);
}

// ── runs ──
export function startRun(db: DB, id: string, worldId: string, tick: number, ts: number): void {
  db.prepare(`INSERT OR IGNORE INTO runs (id, world_id, tick, status, started_at) VALUES (?,?,?,?,?)`).run(id, worldId, tick, "running", ts);
}
export function finishRun(db: DB, id: string, status: string, ts: number, error?: string): void {
  db.prepare(`UPDATE runs SET status=?, ended_at=?, error=? WHERE id=?`).run(status, ts, error ?? null, id);
}

// ── input_queue(人/agent/作者裁决 同一种 input) ──
export interface QueuedInput {
  id: string;
  type: string;
  payload: Record<string, unknown>;
}
export function enqueueInput(db: DB, id: string, worldId: string, type: string, payload: unknown, ts: number): void {
  db.prepare(`INSERT OR IGNORE INTO input_queue (id, world_id, type, payload_json, status, created_at) VALUES (?,?,?,?,?,?)`).run(
    id, worldId, type, JSON.stringify(payload), "pending", ts
  );
}
export function drainPendingInputs(db: DB, worldId: string): QueuedInput[] {
  const rows = db.prepare(`SELECT id, type, payload_json FROM input_queue WHERE world_id=? AND status='pending' ORDER BY created_at`).all(worldId) as Array<{
    id: string;
    type: string;
    payload_json: string;
  }>;
  return rows.map((r) => ({ id: r.id, type: r.type, payload: JSON.parse(r.payload_json) as Record<string, unknown> }));
}
export function markInputProcessed(db: DB, id: string, ts: number): void {
  db.prepare(`UPDATE input_queue SET status='processed', processed_at=? WHERE id=?`).run(ts, id);
}

// 待处理输入计数(longrun 据此快速采纳作者裁决, 不必等下一章)
export function countPendingInputs(db: DB, worldId: string, type: string): number {
  return (db.prepare(`SELECT COUNT(*) n FROM input_queue WHERE world_id=? AND status='pending' AND type=?`).get(worldId, type) as { n: number }).n;
}

// ── chapters(compose 产物) ──
export interface ChapterRow {
  id: string;
  worldId: string;
  lineId?: string;
  goal: string;
  text: string;
  status: string;
  sceneIds?: string[];
  createdAt: number;
}
export function saveChapter(db: DB, c: ChapterRow): void {
  db.prepare(
    `INSERT OR REPLACE INTO chapters (id, world_id, line_id, goal, text, status, scene_ids_json, refs_json, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(c.id, c.worldId, c.lineId ?? null, c.goal, c.text, c.status, JSON.stringify(c.sceneIds ?? []), null, c.createdAt);
}
export function readChapters(db: DB, worldId: string): Array<{ id: string; goal: string; text: string; status: string }> {
  const rows = db.prepare(`SELECT id, goal, text, status FROM chapters WHERE world_id=? ORDER BY created_at`).all(worldId) as Array<{
    id: string;
    goal: string;
    text: string;
    status: string;
  }>;
  return rows;
}
// 近 limit 章(含正文; canon/evolve 只需近窗, 不必全量读千章正文进内存)
export function readRecentChapters(db: DB, worldId: string, limit: number, prefix = "saga-ch-"): Array<{ id: string; goal: string; text: string; status: string }> {
  return (db.prepare(`SELECT id, goal, text, status FROM chapters WHERE world_id=? AND id LIKE ? ORDER BY created_at DESC LIMIT ?`).all(worldId, prefix + "%", limit) as Array<{ id: string; goal: string; text: string; status: string }>).reverse();
}
// 轻量: 只列标题(供网页章节目录, 千章不卡)
export function listChapters(db: DB, worldId: string): Array<{ id: string; goal: string }> {
  return db.prepare(`SELECT id, goal FROM chapters WHERE world_id=? ORDER BY created_at`).all(worldId) as Array<{ id: string; goal: string }>;
}
export function getChapter(db: DB, worldId: string, id: string): { goal: string; text: string } | null {
  const r = db.prepare(`SELECT goal, text FROM chapters WHERE world_id=? AND id=?`).get(worldId, id) as { goal: string; text: string } | undefined;
  return r ?? null;
}
// 近期"实际发生的事"(从 events 的 StageCommitted payload 取 summary), 给 compose 当素材
export function readRecentStageSummaries(db: DB, worldId: string, limit: number): string[] {
  const rows = db.prepare(`SELECT payload_json FROM events WHERE world_id=? AND kind='StageCommitted' ORDER BY seq DESC LIMIT ?`).all(worldId, limit) as Array<{
    payload_json: string;
  }>;
  return rows
    .map((r) => {
      try {
        const p = JSON.parse(r.payload_json) as { summary?: string };
        return typeof p.summary === "string" ? p.summary : "";
      } catch {
        return "";
      }
    })
    .filter((s) => s.length > 0)
    .reverse();
}

// 近期角色心象(从 events 的 MemoryRecorded payload 取 body), 给 compose 当素材
export function readRecentReflections(db: DB, worldId: string, limit: number): string[] {
  const rows = db.prepare(`SELECT payload_json FROM events WHERE world_id=? AND kind='MemoryRecorded' ORDER BY seq DESC LIMIT ?`).all(worldId, limit) as Array<{
    payload_json: string;
  }>;
  return rows
    .map((r) => {
      try {
        const p = JSON.parse(r.payload_json) as { body?: string };
        return typeof p.body === "string" ? p.body : "";
      } catch {
        return "";
      }
    })
    .filter((s) => s.length > 0)
    .reverse();
}

// 显著情景记忆(importance≥阈, 含角色), 供叙事召回作前情回响(认知②)
export function readSalientMemories(db: DB, worldId: string, minImp: number, limit: number): Array<{ characterId: string; body: string }> {
  const rows = db.prepare(`SELECT payload_json FROM events WHERE world_id=? AND kind='MemoryRecorded' ORDER BY seq DESC LIMIT 300`).all(worldId) as Array<{ payload_json: string }>;
  const out: Array<{ characterId: string; body: string }> = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(r.payload_json) as { characterId?: string; body?: string; importance?: number };
      if ((p.importance ?? 0) >= minImp && typeof p.body === "string" && p.body && typeof p.characterId === "string") {
        out.push({ characterId: p.characterId, body: p.body });
        if (out.length >= limit) break;
      }
    } catch {
      /* skip 损坏行 */
    }
  }
  return out;
}
