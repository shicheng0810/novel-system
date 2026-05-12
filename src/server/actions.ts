// Layer 5 · HTTP action handlers. Each is a thin wrapper.
// All handlers accept JSON input and return JSON output; throwing falls
// through to the router as a 500.

import type { IncomingMessage } from "node:http";

import type { Daemon, DaemonStartRequest, DaemonStatus } from "../daemon/daemon";
import type { AtlasService } from "../services/atlas-service";
import type { EventBus } from "../services/event-bus";
import type { MemoryService } from "../services/memory-service";
import type { WorldStore } from "../services/world-store";
import type { AiSettings, AiSettingsStore } from "../services/ai-settings-store";
import { maskApiKey } from "../services/ai-settings-store";
import type { ParsedWorldDraft, StageDirective } from "../domain/world";
import { parseWorldMarkdown } from "../domain/parse-world";
import type { EventFilter, EventSeverity, EventSubsystem } from "../domain/events";
import type { ChapterDraft, NarrativeLens, RecallRequest } from "../domain/narrative";
import type { LLMProvider } from "../services/llm/types";
import type { Db } from "../data/db";
import { runTick } from "../engine/tick";
import type { AgentRegistry } from "../agents/registry";

export type ServerDeps = {
  db: Db;
  bus: EventBus;
  worldStore: WorldStore;
  memory: MemoryService;
  atlas: AtlasService;
  llm: LLMProvider;
  daemon: Daemon;
  registry: AgentRegistry;
  aiSettings: AiSettingsStore;
  /** Called when /api/settings/ai mutates settings. Rebuilds LLM + embedder. */
  rebuildAi(next: AiSettings | null): void;
};

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) return {} as T;
  return JSON.parse(body) as T;
}

// =============================================================================
// Action handlers
// =============================================================================

export function applyWorldDraft(deps: ServerDeps): (req: IncomingMessage) => Promise<unknown> {
  return async (req) => {
    const body = await readJson<{
      worldId: string;
      parsed?: ParsedWorldDraft;
      markdown?: string;
    }>(req);
    const parsed = body.parsed ?? (body.markdown ? parseWorldMarkdown(body.markdown) : null);
    if (!parsed) {
      throw new Error("apply-draft requires `parsed` or `markdown` in the request body");
    }
    const snapshot = deps.worldStore.applyDraft(body.worldId, parsed);
    deps.atlas.compile({
      worldId: body.worldId,
      lineId: "canon",
      parsed,
      snapshot,
    });
    return { worldId: body.worldId, snapshot, parsed };
  };
}

export function worldSnapshot(deps: ServerDeps): (req: IncomingMessage, url: URL) => Promise<unknown> {
  return async (_req, url) => {
    const worldId = url.searchParams.get("worldId") ?? "default";
    const loaded = deps.worldStore.load(worldId);
    if (!loaded) return { worldId, snapshot: null };
    return { worldId, snapshot: loaded.snapshot, parsed: loaded.parsed };
  };
}

export function daemonStart(deps: ServerDeps): (req: IncomingMessage) => Promise<DaemonStatus> {
  return async (req) => {
    const body = await readJson<DaemonStartRequest>(req);
    return deps.daemon.start(body);
  };
}

export function daemonPause(deps: ServerDeps): () => DaemonStatus {
  return () => deps.daemon.pause();
}

export function daemonResume(deps: ServerDeps): () => DaemonStatus {
  return () => deps.daemon.resume();
}

export function daemonStatus(deps: ServerDeps): () => DaemonStatus {
  return () => deps.daemon.getStatus();
}

export function daemonStep(deps: ServerDeps): (req: IncomingMessage) => Promise<unknown> {
  return async (req) => {
    const body = await readJson<{ directive?: StageDirective; lens?: NarrativeLens }>(req);
    return deps.daemon.step(body.directive, body.lens);
  };
}

export function compose(deps: ServerDeps): (req: IncomingMessage) => Promise<unknown> {
  return async (req) => {
    const body = await readJson<{
      worldId: string;
      threadId?: string;
      lens: NarrativeLens;
      directive?: StageDirective;
    }>(req);
    const loaded = deps.worldStore.load(body.worldId);
    if (!loaded) return { error: "world has not been applied" };

    const directive: StageDirective = body.directive ?? {
      stageLabel: "作者触发章节",
      focusCharacterIds: body.lens.focusCharacterIds,
    };
    return runTick(
      {
        db: deps.db,
        bus: deps.bus,
        worldStore: deps.worldStore,
        memory: deps.memory,
        atlas: deps.atlas,
        registry: deps.registry,
        llm: deps.llm,
      },
      {
        worldId: body.worldId,
        threadId: body.threadId ?? "compose",
        tickIndex: deps.daemon.getStatus().completedTicks,
        directive,
        compose: true,
        lens: body.lens,
      },
    );
  };
}

export function recallMemory(deps: ServerDeps): (req: IncomingMessage) => Promise<unknown> {
  return async (req) => {
    const body = await readJson<RecallRequest>(req);
    return deps.memory.recallHybrid(body);
  };
}

export function atlasTree(deps: ServerDeps): (req: IncomingMessage, url: URL) => Promise<unknown> {
  return async (_req, url) => {
    const worldId = url.searchParams.get("worldId") ?? "default";
    const lineId = url.searchParams.get("lineId") ?? "canon";
    return { tree: deps.atlas.tree(worldId, lineId) };
  };
}

export function atlasFile(deps: ServerDeps): (req: IncomingMessage, url: URL) => Promise<unknown> {
  return async (_req, url) => {
    const worldId = url.searchParams.get("worldId") ?? "default";
    const lineId = url.searchParams.get("lineId") ?? "canon";
    const path = url.searchParams.get("path") ?? "";
    return deps.atlas.read(worldId, lineId, path);
  };
}

export function chaptersList(deps: ServerDeps): (req: IncomingMessage, url: URL) => Promise<unknown> {
  return async (_req, url) => {
    const worldId = url.searchParams.get("worldId") ?? undefined;
    const lineId = url.searchParams.get("lineId") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 200);
    const where: string[] = [];
    const params: Record<string, unknown> = { limit };
    if (worldId) {
      where.push("world_id = @worldId");
      params.worldId = worldId;
    }
    if (lineId) {
      where.push("line_id = @lineId");
      params.lineId = lineId;
    }
    const sql = `SELECT chapter_id, world_id, line_id, stage_id, status,
                        lens_json, draft_text, created_at, updated_at
                 FROM chapters
                 ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
                 ORDER BY updated_at DESC LIMIT @limit`;
    const rows = deps.db.prepare(sql).all(params) as Array<{
      chapter_id: string;
      world_id: string;
      line_id: string;
      stage_id: string | null;
      status: string;
      lens_json: string;
      draft_text: string | null;
      created_at: number;
      updated_at: number;
    }>;
    return rows.map((row) => ({
      chapterId: row.chapter_id,
      worldId: row.world_id,
      lineId: row.line_id,
      stageId: row.stage_id ?? undefined,
      status: row.status,
      lens: JSON.parse(row.lens_json),
      preview: row.draft_text ? row.draft_text.slice(0, 280) : "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  };
}

export function chaptersGet(deps: ServerDeps): (req: IncomingMessage, url: URL) => Promise<unknown> {
  return async (_req, url) => {
    const chapterId = url.searchParams.get("chapterId");
    if (!chapterId) throw new Error("chapterId is required");
    const row = deps.db
      .prepare("SELECT * FROM chapters WHERE chapter_id = ?")
      .get([chapterId]) as
      | {
          chapter_id: string;
          world_id: string;
          line_id: string;
          stage_id: string | null;
          status: string;
          lens_json: string;
          scenes_json: string | null;
          draft_text: string | null;
          review_json: string | null;
          created_at: number;
          updated_at: number;
        }
      | undefined;
    if (!row) return null;
    const chapter: Partial<ChapterDraft> = {
      chapterId: row.chapter_id,
      worldId: row.world_id,
      lineId: row.line_id,
      stageId: row.stage_id ?? undefined,
      status: row.status as ChapterDraft["status"],
      lens: JSON.parse(row.lens_json),
      scenes: row.scenes_json ? JSON.parse(row.scenes_json) : [],
      text: row.draft_text ?? "",
      review: row.review_json ? JSON.parse(row.review_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    return chapter;
  };
}

export function settingsAiGet(deps: ServerDeps): () => unknown {
  return () => {
    const settings = deps.aiSettings.load();
    if (!settings) {
      return { configured: false };
    }
    // Return everything except the raw apiKey; expose masked apiKey + a flag.
    return {
      configured: Boolean(settings.apiKey),
      apiKeyMask: maskApiKey(settings.apiKey),
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      thinkingMode: settings.thinkingMode,
      reasoningEffort: settings.reasoningEffort,
      contextWindowTokens: settings.contextWindowTokens,
      maxOutputTokens: settings.maxOutputTokens,
      embeddingApiKeyMask: maskApiKey(settings.embeddingApiKey),
      embeddingBaseUrl: settings.embeddingBaseUrl,
      embeddingModel: settings.embeddingModel,
      embeddingDim: settings.embeddingDim,
    };
  };
}

export function settingsAiSave(deps: ServerDeps): (req: IncomingMessage) => Promise<unknown> {
  return async (req) => {
    const body = await readJson<Partial<AiSettings>>(req);
    const saved = deps.aiSettings.save(body);
    deps.rebuildAi(saved);
    return {
      configured: Boolean(saved.apiKey),
      apiKeyMask: maskApiKey(saved.apiKey),
      baseUrl: saved.baseUrl,
      model: saved.model,
      thinkingMode: saved.thinkingMode,
      reasoningEffort: saved.reasoningEffort,
      maxOutputTokens: saved.maxOutputTokens,
      embeddingApiKeyMask: maskApiKey(saved.embeddingApiKey),
      embeddingBaseUrl: saved.embeddingBaseUrl,
      embeddingModel: saved.embeddingModel,
      embeddingDim: saved.embeddingDim,
    };
  };
}

export function eventsQuery(deps: ServerDeps): (req: IncomingMessage, url: URL) => Promise<unknown> {
  return async (_req, url) => {
    const filter: EventFilter = {
      worldId: url.searchParams.get("worldId") ?? undefined,
      runId: url.searchParams.get("runId") ?? undefined,
      chapterId: url.searchParams.get("chapterId") ?? undefined,
      subsystem: url.searchParams.getAll("subsystem").length
        ? (url.searchParams.getAll("subsystem") as EventSubsystem[])
        : undefined,
      severity: url.searchParams.getAll("severity").length
        ? (url.searchParams.getAll("severity") as EventSeverity[])
        : undefined,
      since: url.searchParams.get("since") ? Number(url.searchParams.get("since")) : undefined,
      until: url.searchParams.get("until") ? Number(url.searchParams.get("until")) : undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    };
    return deps.bus.query(filter);
  };
}
