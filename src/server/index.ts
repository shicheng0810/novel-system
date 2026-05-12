// Layer 5 · server factory.
// createServer(rootDir) wires DB → services → daemon and returns a
// middleware-compatible request handler.

import type { IncomingMessage, ServerResponse } from "node:http";

import { openDb } from "../data/db";
import { AgentRegistry } from "../agents/registry";
import { Daemon } from "../daemon/daemon";
import { AtlasService } from "../services/atlas-service";
import { EventBus } from "../services/event-bus";
import { MemoryService } from "../services/memory-service";
import { WorldStore } from "../services/world-store";
import { MockLLMProvider } from "../services/llm/mock";
import type { LLMProvider } from "../services/llm/types";

import {
  applyWorldDraft,
  atlasFile,
  atlasTree,
  compose,
  daemonPause,
  daemonResume,
  daemonStart,
  daemonStatus,
  daemonStep,
  eventsQuery,
  recallMemory,
  worldSnapshot,
  type ServerDeps,
} from "./actions";
import { handleSse } from "./sse";

export type CreateServerOptions = {
  rootDir: string;
  llm?: LLMProvider;
};

export type ServerHandle = {
  deps: ServerDeps;
  requestHandler: (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
  close(): void;
};

export function createServer(options: CreateServerOptions): ServerHandle {
  const db = openDb({ rootDir: options.rootDir });
  const bus = new EventBus(db);
  const worldStore = new WorldStore(db);
  const memory = new MemoryService(db, bus);
  const atlas = new AtlasService(db, bus);
  const llm: LLMProvider = options.llm ?? new MockLLMProvider();
  const emptyParsed = {
    worldSpec: { genre: "", timeScale: "", cultivationSystem: "", worldRules: [], factions: [], locations: [] },
    characters: [],
    relationships: [],
    characterAnchors: [],
    relationshipAnchors: [],
  };
  // Registry's parsed callback uses the daemon's current worldId to find the
  // right draft. Until a daemon.start() runs, fall back to whatever world
  // has been applied most recently (looked up via a scan).
  const daemonRef = { current: undefined as Daemon | undefined };
  const registry = new AgentRegistry({
    parsed: () => {
      const worldId = daemonRef.current?.getStatus().worldId ?? latestWorldId(db);
      if (!worldId) return emptyParsed;
      return worldStore.load(worldId)?.parsed ?? emptyParsed;
    },
  });
  const daemon = new Daemon({ db, bus, worldStore, memory, atlas, registry, llm });
  daemonRef.current = daemon;
  const deps: ServerDeps = { db, bus, worldStore, memory, atlas, llm, daemon, registry };

  const routes: Array<{
    method: string;
    path: string | RegExp;
    handler: (req: IncomingMessage, url: URL) => Promise<unknown>;
  }> = [
    { method: "POST", path: "/api/world/apply-draft", handler: applyWorldDraft(deps) },
    { method: "GET", path: "/api/world/snapshot", handler: worldSnapshot(deps) },
    { method: "POST", path: "/api/daemon/start", handler: daemonStart(deps) },
    { method: "POST", path: "/api/daemon/pause", handler: async () => daemonPause(deps)() },
    { method: "POST", path: "/api/daemon/resume", handler: async () => daemonResume(deps)() },
    { method: "GET", path: "/api/daemon/status", handler: async () => daemonStatus(deps)() },
    { method: "POST", path: "/api/daemon/step", handler: daemonStep(deps) },
    { method: "POST", path: "/api/compose", handler: compose(deps) },
    { method: "POST", path: "/api/memory/recall", handler: recallMemory(deps) },
    { method: "GET", path: "/api/atlas/tree", handler: atlasTree(deps) },
    { method: "GET", path: "/api/atlas/file", handler: atlasFile(deps) },
    { method: "GET", path: "/api/events/query", handler: eventsQuery(deps) },
  ];

  async function requestHandler(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return next();

    if (req.method === "GET" && url.pathname === "/api/events") {
      handleSse(bus, req, res, url);
      return;
    }

    const match = routes.find((r) => r.method === req.method && r.path === url.pathname);
    if (!match) {
      res.statusCode = 404;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "no such endpoint", pathname: url.pathname }));
      return;
    }

    try {
      const body = await match.handler(req, url);
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          pathname: url.pathname,
        }),
      );
    }
  }

  function close(): void {
    bus.close();
    db.close();
  }

  return { deps, requestHandler, close };
}

function latestWorldId(db: ReturnType<typeof openDb>): string | undefined {
  const row = db
    .prepare("SELECT world_id FROM world_state ORDER BY updated_at DESC LIMIT 1")
    .get() as { world_id: string } | undefined;
  return row?.world_id;
}
