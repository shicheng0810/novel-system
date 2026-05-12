// Layer 5 · HTTP action handlers. Each is a thin wrapper.
// All handlers accept JSON input and return JSON output; throwing falls
// through to the router as a 500.

import type { IncomingMessage } from "node:http";

import type { Daemon, DaemonStartRequest, DaemonStatus } from "../daemon/daemon";
import type { AtlasService } from "../services/atlas-service";
import type { EventBus } from "../services/event-bus";
import type { MemoryService } from "../services/memory-service";
import type { WorldStore } from "../services/world-store";
import type { ParsedWorldDraft, StageDirective } from "../domain/world";
import type { EventFilter, EventSeverity, EventSubsystem } from "../domain/events";
import type { NarrativeLens, RecallRequest } from "../domain/narrative";
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
    const body = await readJson<{ worldId: string; parsed: ParsedWorldDraft }>(req);
    const snapshot = deps.worldStore.applyDraft(body.worldId, body.parsed);
    deps.atlas.compile({
      worldId: body.worldId,
      lineId: "canon",
      parsed: body.parsed,
      snapshot,
    });
    return { worldId: body.worldId, snapshot };
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
