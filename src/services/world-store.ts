// Layer 2 · WorldStore.
// Owns world_state (latest snapshot per worldId) + world_history (committed
// stages, ordered by stage_number).
//
// snapshot_json is the materialized view; reducers in domain/world.ts (added
// in Phase 4 alongside the engine) project events onto it.

import type { Db } from "../data/db";
import type {
  ParsedWorldDraft,
  Stage,
  WorldSnapshot,
} from "../domain/world";
import { cloneSnapshot, emptySnapshot } from "../domain/world";

type WorldStateRow = {
  world_id: string;
  parsed_json: string;
  snapshot_json: string;
  last_event_id: string | null;
  updated_at: number;
};

type StageRow = {
  stage_id: string;
  world_id: string;
  line_id: string;
  stage_number: number;
  stage_label: string;
  ts: number;
  events_json: string;
  snapshot_json: string;
};

export class WorldStore {
  private readonly upsertState: ReturnType<Db["prepare"]>;
  private readonly selectState: ReturnType<Db["prepare"]>;
  private readonly insertStage: ReturnType<Db["prepare"]>;
  private readonly listStages: ReturnType<Db["prepare"]>;
  private readonly selectStage: ReturnType<Db["prepare"]>;

  constructor(private readonly db: Db) {
    this.upsertState = db.prepare(
      `INSERT INTO world_state(world_id, parsed_json, snapshot_json, last_event_id, updated_at)
       VALUES (@worldId, @parsed, @snapshot, @lastEvent, @updatedAt)
       ON CONFLICT(world_id) DO UPDATE SET
         parsed_json   = excluded.parsed_json,
         snapshot_json = excluded.snapshot_json,
         last_event_id = excluded.last_event_id,
         updated_at    = excluded.updated_at`,
    );
    this.selectState = db.prepare<[string], WorldStateRow>("SELECT * FROM world_state WHERE world_id = ?");
    this.insertStage = db.prepare(
      `INSERT INTO world_history(stage_id, world_id, line_id, stage_number, stage_label, ts, events_json, snapshot_json)
       VALUES (@stageId, @worldId, @lineId, @stageNumber, @stageLabel, @ts, @events, @snapshot)`,
    );
    this.listStages = db.prepare(
      "SELECT * FROM world_history WHERE world_id = ? AND line_id = ? ORDER BY stage_number ASC",
    );
    this.selectStage = db.prepare(
      "SELECT * FROM world_history WHERE stage_id = ?",
    );
  }

  /**
   * Apply a parsed world draft. Resets snapshot to a fresh empty state seeded
   * with characters/relationships from the draft.
   */
  applyDraft(worldId: string, parsed: ParsedWorldDraft): WorldSnapshot {
    const snapshot = seedSnapshot(worldId, parsed);
    this.upsertState.run({
      worldId,
      parsed: JSON.stringify(parsed),
      snapshot: JSON.stringify(snapshot),
      lastEvent: null,
      updatedAt: Date.now(),
    });
    return snapshot;
  }

  /**
   * Load latest state for a world. Returns null if no state has been applied.
   */
  load(worldId: string): { parsed: ParsedWorldDraft; snapshot: WorldSnapshot } | null {
    const row = this.selectState.get([worldId]) as WorldStateRow | undefined;
    if (!row) return null;
    return {
      parsed: JSON.parse(row.parsed_json) as ParsedWorldDraft,
      snapshot: JSON.parse(row.snapshot_json) as WorldSnapshot,
    };
  }

  /**
   * Save a new snapshot for a world. Bumps updated_at and stores the
   * watermark event id (used by the reducer to detect skipped events).
   */
  save(worldId: string, snapshot: WorldSnapshot, lastEventId?: string): void {
    const existing = this.selectState.get([worldId]) as WorldStateRow | undefined;
    if (!existing) {
      throw new Error(`world_state has no row for worldId=${worldId}; call applyDraft first`);
    }
    this.upsertState.run({
      worldId,
      parsed: existing.parsed_json,
      snapshot: JSON.stringify(snapshot),
      lastEvent: lastEventId ?? existing.last_event_id ?? null,
      updatedAt: Date.now(),
    });
  }

  /**
   * Append a committed stage to world_history. Stage IDs are unique.
   */
  appendStage(stage: Stage): void {
    this.insertStage.run({
      stageId: stage.stageId,
      worldId: stage.worldId,
      lineId: stage.lineId,
      stageNumber: stage.stageNumber,
      stageLabel: stage.stageLabel,
      ts: stage.ts,
      events: JSON.stringify(stage.events),
      snapshot: JSON.stringify(stage.snapshot),
    });
  }

  loadHistory(worldId: string, lineId = "canon"): Stage[] {
    const rows = this.listStages.all([worldId, lineId]) as StageRow[];
    return rows.map(rowToStage);
  }

  loadStage(stageId: string): Stage | null {
    const row = this.selectStage.get([stageId]) as StageRow | undefined;
    return row ? rowToStage(row) : null;
  }
}

function rowToStage(row: StageRow): Stage {
  return {
    stageId: row.stage_id,
    worldId: row.world_id,
    lineId: row.line_id,
    stageNumber: row.stage_number,
    stageLabel: row.stage_label,
    ts: row.ts,
    events: JSON.parse(row.events_json),
    snapshot: JSON.parse(row.snapshot_json),
  };
}

/**
 * Build the initial WorldSnapshot from a parsed draft. Each character starts
 * with progress=0, pressure=0, alive=true. Relationships use trust=50/host=50
 * unless the status string keys a known profile.
 */
function seedSnapshot(worldId: string, parsed: ParsedWorldDraft): WorldSnapshot {
  const snapshot = emptySnapshot(worldId);
  for (const character of parsed.characters) {
    snapshot.characters[character.id] = {
      name: character.name,
      faction: character.faction,
      role: character.role,
      traits: [...character.traits],
      goal: character.goal,
      stance: character.stance,
      resource: character.resource,
      progress: 0,
      pressure: 0,
      lastAction: "idle",
      alive: true,
      notes: [],
    };
  }
  for (const relationship of parsed.relationships) {
    const profile = statusProfile(relationship.status);
    snapshot.relationships[relationship.id] = {
      key: relationship.id,
      left: relationship.left,
      right: relationship.right,
      status: relationship.status,
      trust: profile.trust,
      hostility: profile.hostility,
      notes: [relationship.history, relationship.tension].filter(Boolean),
    };
  }
  return cloneSnapshot(snapshot);
}

function statusProfile(status: string): { trust: number; hostility: number } {
  if (status.includes("盟友") || status.includes("结盟")) return { trust: 78, hostility: 20 };
  if (status.includes("公开冲突") || status.includes("仇")) return { trust: 10, hostility: 92 };
  if (status.includes("戒备") || status.includes("紧绷")) return { trust: 24, hostility: 68 };
  return { trust: 50, hostility: 50 };
}
