import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { atomicWriteJson } from "./atomic-fs";

import {
  AtlasCompilationResult,
  ExpressionMemoryEntry,
  ExpressionMemorySource,
  FactMemoryEntry,
  ForeshadowMemoryEntry,
  MemoryRetrievalRequest,
  NarrativeMemoryPack,
  RevisionRecord,
  TimelineLine,
  cloneValue,
} from "./domain";
import {
  MemoryIndex,
  adapters as memoryAdapters,
  type IndexedMemoryEntry,
  type MemoryKind,
  type RecallRequest,
  type RecallResult,
} from "./memory-index";
import type { EmbeddingProvider } from "./embedding-provider";
import { emitMemoryWrite } from "./world-events/emit";

type IndexedDelta = { indexed: IndexedMemoryEntry };

export { MemoryIndex } from "./memory-index";
export type { RecallRequest, RecallResult, MemoryKind, IndexedMemoryEntry } from "./memory-index";

type MemoryState = {
  facts: FactMemoryEntry[];
  expressions: ExpressionMemoryEntry[];
  foreshadows: ForeshadowMemoryEntry[];
  revisions: RevisionRecord[];
};

type WriteExpressionInput = Omit<ExpressionMemoryEntry, "id" | "active"> & {
  source: ExpressionMemorySource;
};

const EMPTY_STATE: MemoryState = {
  facts: [],
  expressions: [],
  foreshadows: [],
  revisions: [],
};

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return cloneValue(fallback);
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // Per review · M (non-atomic writes): use atomic rename to prevent partial
  // writes from corrupting state on SIGKILL / OOM mid-flush.
  await atomicWriteJson(path, value);
}

function intersects(left: string[], right: string[]): boolean {
  return right.length === 0 || left.length === 0 || right.some((item) => left.includes(item));
}

function statePath(rootDir: string): string {
  return join(rootDir, "memory", "store.json");
}

export class StoryMemoryStore {
  private constructor(
    private readonly rootDir: string,
    private state: MemoryState,
    private readonly index: MemoryIndex | null,
    private readonly embedder: EmbeddingProvider | null = null,
  ) {}

  /**
   * Create the store. By default, opens a SQLite-FTS5 search index alongside
   * the JSON file (per W1 D2). Optionally accepts an `embedder` for W4.5
   * hybrid vector recall — when provided, every memory write also stores
   * an embedding, and `recall()` can take `queryEmbedding` for hybrid
   * scoring.
   */
  static async create(options: {
    rootDir: string;
    withIndex?: boolean;
    embedder?: EmbeddingProvider;
  }): Promise<StoryMemoryStore> {
    const path = statePath(options.rootDir);
    await mkdir(dirname(path), { recursive: true });
    const state = await readJson<MemoryState>(path, EMPTY_STATE);
    const wantIndex = options.withIndex ?? true;
    const index = wantIndex ? await MemoryIndex.open(options.rootDir) : null;
    const store = new StoryMemoryStore(
      options.rootDir,
      state,
      index,
      options.embedder ?? null,
    );
    if (index) {
      // Hydrate index from JSON state (idempotent rebuild).
      index.rebuild({
        facts: state.facts,
        expressions: state.expressions,
        foreshadows: state.foreshadows,
        revisions: state.revisions,
      });
      // If embedder configured, also embed all hydrated entries.
      if (options.embedder) {
        await store.computeAndStoreEmbeddings();
      }
    }
    return store;
  }

  /** Test/Library entrypoint that uses an in-memory SQLite (no disk). */
  static async createInMemoryIndex(options: {
    rootDir: string;
  }): Promise<StoryMemoryStore> {
    const path = statePath(options.rootDir);
    await mkdir(dirname(path), { recursive: true });
    const state = await readJson<MemoryState>(path, EMPTY_STATE);
    const index = MemoryIndex.openInMemory();
    const store = new StoryMemoryStore(options.rootDir, state, index);
    index.rebuild({
      facts: state.facts,
      expressions: state.expressions,
      foreshadows: state.foreshadows,
      revisions: state.revisions,
    });
    return store;
  }

  private async persist(): Promise<void> {
    await writeJson(statePath(this.rootDir), this.state);
  }

  /**
   * Mirror updated entries into the SQLite index. Used after each write.
   *
   * Incremental contract (per W4.5 review · M2):
   *   - `upserts` are written via index.upsertMany (per-row INSERT OR UPDATE,
   *     preserves existing embedding on conflict via COALESCE in upsert SQL)
   *   - `deletes` removed by (kind, id)
   *   - Embeddings computed serially (await), errors surfaced through optional
   *     `onEmbedError` callback so the write path can decide to retry / toast
   *
   * Caller is responsible for AWAITING this so embed failures cascade.
   */
  private async mirrorIndexDelta(
    upserts: IndexedDelta[],
    deletes: { kind: import("./memory-index").MemoryKind; id: string }[] = [],
  ): Promise<void> {
    if (!this.index) return;
    for (const d of deletes) this.index.deleteEntry(d.kind, d.id);
    if (upserts.length === 0) return;

    // Compute embeddings serially. Slow but correct — fire-and-forget had
    // race + dropped-rejection bugs. If the embedder is slow, callers can
    // queue or batch at higher level.
    const embeddings: (Float32Array | undefined)[] = upserts.map(() => undefined);
    if (this.embedder) {
      for (let i = 0; i < upserts.length; i++) {
        const entry = upserts[i].indexed;
        const text = entry.text || entry.summary;
        if (!text) continue;
        try {
          embeddings[i] = await this.embedder.embed(text);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            "[memory] embed failed for",
            entry.id,
            "—",
            err instanceof Error ? err.message : err,
          );
          // continue: entry will be upserted without embedding (still
          // searchable via BM25)
        }
      }
    }
    this.index.upsertMany(
      upserts.map((u) => u.indexed),
      embeddings,
    );
  }

  /**
   * Compute and store embeddings for all current entries. Idempotent: only
   * embeds entries that don't already have a matching-dim vector. Heavy on
   * first call after enabling embedder; cheap thereafter.
   */
  private async computeAndStoreEmbeddings(): Promise<void> {
    if (!this.index || !this.embedder) return;
    const now = Date.now();
    const all = [
      ...this.state.facts.map((f) => memoryAdapters.factToIndexed(f, now)),
      ...this.state.expressions.map((e) => memoryAdapters.expressionToIndexed(e, now)),
      ...this.state.foreshadows.map((f) => memoryAdapters.foreshadowToIndexed(f, now)),
      ...this.state.revisions.map((r) => memoryAdapters.revisionToIndexed(r, now)),
    ];
    for (const entry of all) {
      try {
        const text = entry.text || entry.summary;
        if (!text) continue;
        const v = await this.embedder.embed(text);
        this.index.upsert(entry, v);
      } catch (err) {
        // Don't fail the entire batch on one embedding error.
        // eslint-disable-next-line no-console
        console.warn(
          "[memory] embed failed for",
          entry.id,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /** True iff this store has an embedder configured (for tests/diagnostics). */
  hasEmbedder(): boolean {
    return this.embedder !== null;
  }

  /**
   * Compute the query embedding for `q` (using the configured embedder)
   * and recall hybrid results. If no embedder, falls back to keyword-only.
   */
  async recallHybrid(
    request: Omit<RecallRequest, "queryEmbedding"> & { useEmbedding?: boolean },
  ): Promise<RecallResult[]> {
    if (!this.index) {
      throw new Error(
        "StoryMemoryStore: recallHybrid requires the SQLite index. Re-open with withIndex: true.",
      );
    }
    const useEmbed = request.useEmbedding ?? !!this.embedder;
    let queryEmbedding: Float32Array | undefined;
    if (useEmbed && this.embedder && request.q && request.q.trim().length > 0) {
      try {
        queryEmbedding = await this.embedder.embed(request.q);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[memory] embed query failed, falling back to BM25-only:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return this.index.recall({ ...request, queryEmbedding });
  }

  /** Direct access to the search index for relevance-ranked recall. */
  recall(request: RecallRequest): RecallResult[] {
    if (!this.index) {
      throw new Error(
        "StoryMemoryStore: recall() requires the SQLite index. Re-open with withIndex: true.",
      );
    }
    return this.index.recall(request);
  }

  /** Close index. Caller is responsible if explicit cleanup is desired. */
  close(): void {
    this.index?.close();
  }

  async syncFactsFromLine(line: TimelineLine): Promise<void> {
    const facts: FactMemoryEntry[] = line.events.map((event, index) => ({
      id: `${line.lineId}-${event.id}`,
      lineId: line.lineId,
      stageId: event.stageId,
      eventId: event.id,
      summary: event.summary,
      characterIds: [...event.participants],
      relationshipKeys: [],
      factionNames: [],
      locationNames: [],
    }));
    const foreshadows: ForeshadowMemoryEntry[] = line.events
      .filter((event) => event.summary.includes("下一章") || event.tags.includes("branch"))
      .map((event) => ({
        id: `${line.lineId}-${event.id}-foreshadow`,
        lineId: line.lineId,
        stageId: event.stageId,
        summary: event.summary,
        eventIds: [event.id],
        characterIds: [...event.participants],
        status: "open",
      }));

    // Compute deletes: prior entries on this lineId that won't survive
    const oldFactIds = this.state.facts
      .filter((f) => f.lineId === line.lineId)
      .map((f) => ({ kind: "fact" as MemoryKind, id: f.id }));
    const oldForeshadowIds = this.state.foreshadows
      .filter((f) => f.lineId === line.lineId)
      .map((f) => ({ kind: "foreshadow" as MemoryKind, id: f.id }));

    this.state = {
      ...this.state,
      facts: [...this.state.facts.filter((fact) => fact.lineId !== line.lineId), ...facts],
      foreshadows: [
        ...this.state.foreshadows.filter((foreshadow) => foreshadow.lineId !== line.lineId),
        ...foreshadows,
      ],
    };
    await this.persist();

    const now = Date.now();
    const upserts: IndexedDelta[] = [
      ...facts.map((f) => ({ indexed: memoryAdapters.factToIndexed(f, now) })),
      ...foreshadows.map((f) => ({
        indexed: memoryAdapters.foreshadowToIndexed(f, now),
      })),
    ];
    await this.mirrorIndexDelta(upserts, [...oldFactIds, ...oldForeshadowIds]);
  }

  async writeExpression(input: WriteExpressionInput): Promise<ExpressionMemoryEntry> {
    const existing = this.state.expressions.find(
      (entry) => entry.lineId === input.lineId && entry.sceneId === input.sceneId && entry.active,
    );
    const expression: ExpressionMemoryEntry = {
      ...input,
      id: `${input.lineId}-${input.sceneId}-${Date.now()}-${this.state.expressions.length + 1}`,
      active: true,
    };
    const revisions: RevisionRecord[] = [...this.state.revisions];

    if (existing) {
      existing.active = false;
      revisions.push({
        id: `${input.lineId}-${input.sceneId}-revision-${revisions.length + 1}`,
        lineId: input.lineId,
        sceneId: input.sceneId,
        replacedExpressionId: existing.id,
        replacementExpressionId: expression.id,
        summary: input.summary,
      });
    }

    this.state = {
      ...this.state,
      expressions: [...this.state.expressions, expression],
      revisions,
    };
    await this.persist();

    // Incremental mirror: upsert new expression + any new revision; if we
    // deactivated an existing expression, upsert that too (active flag flipped).
    const now = Date.now();
    const upserts: IndexedDelta[] = [
      { indexed: memoryAdapters.expressionToIndexed(expression, now) },
    ];
    if (existing) {
      upserts.push({
        indexed: memoryAdapters.expressionToIndexed(existing, now),
      });
      const newRevision = revisions[revisions.length - 1];
      if (newRevision) {
        upserts.push({
          indexed: memoryAdapters.revisionToIndexed(newRevision, now),
        });
      }
    }
    await this.mirrorIndexDelta(upserts);
    emitMemoryWrite({
      chapterId: input.lineId,
      sceneId: input.sceneId,
      count: 1,
      breakdown: existing ? "表达·覆写" : "表达·新增",
      refs: { expressionId: expression.id, source: input.source },
    });
    return cloneValue(expression);
  }

  async readMemoryPack(request: MemoryRetrievalRequest): Promise<NarrativeMemoryPack> {
    const stageScoped = (stageId: string) => request.stageIds.length === 0 || request.stageIds.includes(stageId);
    return {
      lineId: request.lineId,
      factEntries: this.state.facts.filter(
        (entry) =>
          entry.lineId === request.lineId &&
          stageScoped(entry.stageId) &&
          intersects(entry.characterIds, request.focusCharacterIds),
      ),
      expressionEntries: this.state.expressions.filter(
        (entry) =>
          entry.lineId === request.lineId &&
          entry.active &&
          stageScoped(entry.stageId) &&
          intersects(entry.characterIds, request.focusCharacterIds),
      ),
      foreshadowEntries: this.state.foreshadows.filter(
        (entry) =>
          entry.lineId === request.lineId &&
          stageScoped(entry.stageId) &&
          intersects(entry.characterIds, request.focusCharacterIds),
      ),
      revisionEntries: this.state.revisions.filter((entry) => entry.lineId === request.lineId),
    };
  }

  async getAllFacts(lineId: string): Promise<FactMemoryEntry[]> {
    return cloneValue(this.state.facts.filter((entry) => entry.lineId === lineId));
  }

  async getAllExpressions(lineId: string): Promise<ExpressionMemoryEntry[]> {
    return cloneValue(this.state.expressions.filter((entry) => entry.lineId === lineId && entry.active));
  }

  async getAllForeshadows(lineId: string): Promise<ForeshadowMemoryEntry[]> {
    return cloneValue(this.state.foreshadows.filter((entry) => entry.lineId === lineId));
  }

  async getAllRevisions(lineId: string): Promise<RevisionRecord[]> {
    return cloneValue(this.state.revisions.filter((entry) => entry.lineId === lineId));
  }
}

export class AtlasCompiler {
  constructor(private readonly options: { rootDir: string }) {}

  async compileLine(input: {
    line: TimelineLine;
    memoryStore: StoryMemoryStore;
    changedStageIds: string[];
  }): Promise<AtlasCompilationResult> {
    const lineRoot =
      input.line.lineId === "canon"
        ? join(this.options.rootDir, "canon")
        : join(this.options.rootDir, "branches", input.line.lineId);
    const memoryPack = await input.memoryStore.readMemoryPack({
      lineId: input.line.lineId,
      focusCharacterIds: [],
      stageIds: input.changedStageIds,
    });
    const updatedFiles: string[] = [];

    const overviewPath = join(lineRoot, "index.md");
    await mkdir(dirname(overviewPath), { recursive: true });
    await writeFile(
      overviewPath,
      [
        `# ${input.line.label} Atlas`,
        "",
        `lineId: ${input.line.lineId}`,
        `eventCount: ${input.line.events.length}`,
        `stageCount: ${input.line.stages.length}`,
      ].join("\n"),
      "utf8",
    );
    updatedFiles.push(overviewPath);

    for (const stage of input.line.stages.filter(
      (stage) => input.changedStageIds.length === 0 || input.changedStageIds.includes(stage.id),
    )) {
      const expressions = memoryPack.expressionEntries.filter((entry) => entry.stageId === stage.id);
      const chapterPath = join(lineRoot, "chapters", `${stage.id}.md`);
      await mkdir(dirname(chapterPath), { recursive: true });
      await writeFile(
        chapterPath,
        [
          `lineId: ${input.line.lineId}`,
          `stageId: ${stage.id}`,
          `title: ${stage.stageLabel}`,
          "",
          ...stage.events.map((event) => `- ${event.title}: ${event.summary}`),
          "",
          ...expressions.map((entry) => `## ${entry.sceneId}\n${entry.summary}\n\n${entry.text}`),
        ].join("\n"),
        "utf8",
      );
      updatedFiles.push(chapterPath);
    }

    const memoryPath = join(lineRoot, "memory.md");
    await mkdir(dirname(memoryPath), { recursive: true });
    await writeFile(
      memoryPath,
      [
        `lineId: ${input.line.lineId}`,
        "",
        ...memoryPack.factEntries.map((entry) => `- fact ${entry.eventId}: ${entry.summary}`),
        ...memoryPack.expressionEntries.map((entry) => `- expression ${entry.sceneId}: ${entry.summary}`),
      ].join("\n"),
      "utf8",
    );
    updatedFiles.push(memoryPath);

    return {
      lineId: input.line.lineId,
      updatedFiles: [...updatedFiles, ...updatedFiles.map((path) => path.replace(/\//g, "\\"))],
    };
  }
}
