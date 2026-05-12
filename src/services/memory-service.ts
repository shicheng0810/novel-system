// Layer 2 · MemoryService.
// Hybrid recall: FTS5 (trigram) + LIKE fallback for short CJK queries +
// optional cosine semantic similarity over stored embeddings.
//
// Every write emits a `memory` WorldEvent.

import type { Db } from "../data/db";
import type { EventBus } from "./event-bus";
import { makeEventId } from "../domain/events";
import type { EmbeddingProvider } from "./embedding/types";
import type {
  ExpressionEntry,
  FactEntry,
  ForeshadowEntry,
  MemoryEntry,
  MemoryKind,
  RecallHit,
  RecallRequest,
  RevisionEntry,
} from "../domain/narrative";

type EntryRow = {
  entry_id: string;
  world_id: string;
  line_id: string;
  kind: string;
  character_ids: string | null;
  importance: number;
  recency_ts: number;
  active: number;
  payload_json: string;
  embedding: Buffer | null;
  created_at: number;
};

export type WriteMemoryInput = {
  worldId: string;
  lineId: string;
  entry: MemoryEntry;
  importance?: number;
  characterIds?: string[];
};

export class MemoryService {
  private readonly insertEntry: ReturnType<Db["prepare"]>;
  private readonly selectEntry: ReturnType<Db["prepare"]>;
  private readonly listByLine: ReturnType<Db["prepare"]>;
  private readonly listByKind: ReturnType<Db["prepare"]>;
  private readonly ftsMatch: ReturnType<Db["prepare"]>;
  private readonly likeMatch: ReturnType<Db["prepare"]>;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private embedder: EmbeddingProvider | null = null,
  ) {
    this.insertEntry = db.prepare(
      `INSERT INTO memory_entries(
         entry_id, world_id, line_id, kind, character_ids, importance, recency_ts,
         active, payload_json, embedding, created_at
       ) VALUES (
         @entryId, @worldId, @lineId, @kind, @characterIds, @importance, @recencyTs,
         @active, @payload, @embedding, @createdAt
       )
       ON CONFLICT(entry_id) DO UPDATE SET
         payload_json = excluded.payload_json,
         importance   = excluded.importance,
         recency_ts   = excluded.recency_ts,
         character_ids = excluded.character_ids,
         active       = excluded.active,
         embedding    = excluded.embedding`,
    );
    this.selectEntry = db.prepare("SELECT * FROM memory_entries WHERE entry_id = ?");
    this.listByLine = db.prepare(
      "SELECT * FROM memory_entries WHERE world_id = ? AND line_id = ? AND active = 1 ORDER BY recency_ts DESC LIMIT ?",
    );
    this.listByKind = db.prepare(
      "SELECT * FROM memory_entries WHERE world_id = ? AND line_id = ? AND kind = ? AND active = 1 ORDER BY recency_ts DESC LIMIT ?",
    );
    this.ftsMatch = db.prepare(
      "SELECT entry_id FROM memory_fts WHERE memory_fts MATCH ? LIMIT 200",
    );
    this.likeMatch = db.prepare(
      "SELECT entry_id FROM memory_entries WHERE world_id = ? AND line_id = ? AND active = 1 AND payload_json LIKE ? LIMIT 200",
    );
  }

  /**
   * Swap the embedding provider at runtime (e.g. when /api/settings/ai
   * updates the embedding api-key). Pass null to revert to keyword-only.
   */
  setEmbedder(embedder: EmbeddingProvider | null): void {
    this.embedder = embedder;
  }

  async write(input: WriteMemoryInput): Promise<MemoryEntry> {
    const characterIds = input.characterIds ?? extractCharacterIds(input.entry);
    const importance = input.importance ?? deriveImportance(input.entry);
    const text = entryBody(input.entry);
    const embedding = this.embedder ? await this.embedder.embed(text) : null;

    this.insertEntry.run({
      entryId: input.entry.id,
      worldId: input.worldId,
      lineId: input.lineId,
      kind: input.entry.kind,
      characterIds: characterIds.length ? JSON.stringify(characterIds) : null,
      importance,
      recencyTs: Date.now(),
      active: input.entry.kind === "foreshadow" ? Number((input.entry as ForeshadowEntry).active) : 1,
      payload: JSON.stringify(input.entry),
      embedding: embedding ? Buffer.from(embedding.buffer) : null,
      createdAt: Date.now(),
    });

    this.bus.emit({
      id: makeEventId({
        subsystem: "memory",
        sourceRef: input.entry.id,
      }),
      ts: Date.now(),
      worldId: input.worldId,
      subsystem: "memory",
      severity: "ambient",
      status: "succeeded",
      verb: "落册",
      subject: input.entry.kind,
      summary: `记忆 ${input.entry.kind} 入库：${text.slice(0, 40)}`,
      refs: { entryId: input.entry.id, characterIds },
    });

    return input.entry;
  }

  /**
   * Pure keyword recall: FTS5 trigram for ≥3-char queries, LIKE for shorter.
   * Returned hits are scored by keyword + recency + importance.
   */
  recall(request: RecallRequest): RecallHit[] {
    const query = request.query.trim();
    const limit = Math.min(request.limit ?? 10, 100);
    const idScores = new Map<string, number>();

    if (query.length >= 3) {
      try {
        const rows = this.ftsMatch.all([query]) as Array<{ entry_id: string }>;
        for (const row of rows) idScores.set(row.entry_id, 1);
      } catch (err) {
        // FTS may reject special chars; fall through to LIKE.
        // eslint-disable-next-line no-console
        console.warn("[memory] FTS query failed:", err instanceof Error ? err.message : err);
      }
    }

    if (idScores.size < limit && query.length > 0) {
      const likeRows = this.likeMatch.all([
        request.worldId,
        request.lineId,
        `%${query}%`,
      ]) as Array<{ entry_id: string }>;
      for (const row of likeRows) {
        if (!idScores.has(row.entry_id)) idScores.set(row.entry_id, 0.6);
      }
    }

    const hits: RecallHit[] = [];
    for (const [id, keywordScore] of idScores) {
      const row = this.selectEntry.get([id]) as EntryRow | undefined;
      if (!row) continue;
      if (row.world_id !== request.worldId || row.line_id !== request.lineId) continue;
      if (request.kinds?.length && !request.kinds.includes(row.kind as MemoryKind)) continue;
      if (request.characterIds?.length) {
        const ids = row.character_ids ? (JSON.parse(row.character_ids) as string[]) : [];
        const overlap = ids.some((id) => request.characterIds!.includes(id));
        if (!overlap) continue;
      }
      const recency = recencyScore(row.recency_ts);
      const importance = row.importance / 10;
      const total = keywordScore * 0.55 + recency * 0.25 + importance * 0.2;
      hits.push({
        entry: JSON.parse(row.payload_json) as MemoryEntry,
        scores: { keyword: keywordScore, recency, importance, total },
      });
    }

    return hits.sort((a, b) => b.scores.total - a.scores.total).slice(0, limit);
  }

  /**
   * Hybrid recall = recall() + cosine(embedding) blend if embedder is available.
   */
  async recallHybrid(request: RecallRequest): Promise<RecallHit[]> {
    const keywordHits = this.recall({ ...request, limit: Math.min((request.limit ?? 10) * 4, 80) });
    if (!this.embedder || !request.query.trim()) {
      return keywordHits.slice(0, request.limit ?? 10);
    }

    const queryVec = await this.embedder.embed(request.query);
    const augmented: RecallHit[] = [];
    for (const hit of keywordHits) {
      const row = this.selectEntry.get([hit.entry.id]) as EntryRow | undefined;
      if (!row || !row.embedding) {
        augmented.push(hit);
        continue;
      }
      const stored = bufferToFloat32(row.embedding);
      const semantic = cosine(queryVec, stored);
      const total = hit.scores.total * 0.7 + semantic * 0.3;
      augmented.push({
        entry: hit.entry,
        scores: { ...hit.scores, semantic, total },
      });
    }
    return augmented
      .sort((a, b) => b.scores.total - a.scores.total)
      .slice(0, request.limit ?? 10);
  }

  list(input: {
    worldId: string;
    lineId: string;
    kind?: MemoryKind;
    limit?: number;
  }): MemoryEntry[] {
    const limit = Math.min(input.limit ?? 50, 500);
    const rows = input.kind
      ? (this.listByKind.all([input.worldId, input.lineId, input.kind, limit]) as EntryRow[])
      : (this.listByLine.all([input.worldId, input.lineId, limit]) as EntryRow[]);
    return rows.map((row) => JSON.parse(row.payload_json) as MemoryEntry);
  }
}

function entryBody(entry: MemoryEntry): string {
  switch (entry.kind) {
    case "fact":
    case "expression":
    case "foreshadow":
    case "revision":
      return entry.body;
  }
}

function extractCharacterIds(entry: MemoryEntry): string[] {
  if (entry.kind === "fact" || entry.kind === "expression" || entry.kind === "foreshadow") {
    return [...(entry.characterIds ?? [])];
  }
  return [];
}

function deriveImportance(entry: MemoryEntry): number {
  if (entry.kind === "fact") return Math.min(10, Math.max(1, (entry as FactEntry).importance));
  if (entry.kind === "foreshadow") return 6;
  if (entry.kind === "revision") return 5;
  return Math.max(1, Math.min(10, (entry as ExpressionEntry).body.length / 50));
}

function recencyScore(ts: number): number {
  const ageMs = Date.now() - ts;
  if (ageMs <= 0) return 1;
  const days = ageMs / 86400000;
  return Math.max(0, 1 - days / 30); // 30 day half-life-ish
}

function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function bufferToFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

// Re-export for convenience.
export type { ExpressionEntry, FactEntry, ForeshadowEntry, MemoryEntry, RevisionEntry };
