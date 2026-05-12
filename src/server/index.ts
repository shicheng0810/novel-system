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
import { AiSettingsStore, type AiSettings } from "../services/ai-settings-store";
import { MockLLMProvider } from "../services/llm/mock";
import { DeepSeekProvider } from "../services/llm/deepseek";
import { HttpEmbeddingProvider } from "../services/embedding/http";
import type { EmbeddingProvider } from "../services/embedding/types";
import type { LLMProvider } from "../services/llm/types";

import {
  applyWorldDraft,
  atlasFile,
  atlasTree,
  chaptersGet,
  chaptersList,
  compose,
  daemonPause,
  daemonResume,
  daemonStart,
  daemonStatus,
  daemonStep,
  eventsQuery,
  recallMemory,
  settingsAiGet,
  settingsAiSave,
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
  const aiSettings = new AiSettingsStore(db);
  const initial = aiSettings.load();
  const memory = new MemoryService(db, bus, embedderFromSettings(initial));
  const atlas = new AtlasService(db, bus);

  // The active LLM provider is rebuildable when /api/settings/ai is saved.
  // We thread it through the deps via a mutable wrapper so registry/daemon
  // always see the latest provider without reconstructing them.
  const llmRef: { current: LLMProvider } = {
    current: options.llm ?? buildLlm(initial),
  };

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
  // Engine reads deps.llm by reference; rebinding deps.llm after a settings
  // save propagates to the next tick.
  const deps: ServerDeps = {
    db, bus, worldStore, memory, atlas, registry, aiSettings,
    get llm() { return llmRef.current; },
    set llm(v: LLMProvider) { llmRef.current = v; },
    daemon: undefined as unknown as Daemon, // set below
    rebuildAi(next: AiSettings | null) {
      llmRef.current = options.llm ?? buildLlm(next);
      memory.setEmbedder(embedderFromSettings(next));
    },
  };
  const daemon = new Daemon({ db, bus, worldStore, memory, atlas, registry, llm: llmRef.current });
  deps.daemon = daemon;
  daemonRef.current = daemon;

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
    { method: "GET", path: "/api/chapters/list", handler: chaptersList(deps) },
    { method: "GET", path: "/api/chapters/get", handler: chaptersGet(deps) },
    { method: "GET", path: "/api/events/query", handler: eventsQuery(deps) },
    { method: "GET", path: "/api/settings/ai", handler: async () => settingsAiGet(deps)() },
    { method: "POST", path: "/api/settings/ai", handler: settingsAiSave(deps) },
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

function buildLlm(settings: AiSettings | null): LLMProvider {
  if (!settings || !settings.apiKey) return new MockLLMProvider();
  return new DeepSeekProvider({
    profile: {
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      thinkingMode: settings.thinkingMode,
      reasoningEffort: settings.reasoningEffort,
      contextWindowTokens: settings.contextWindowTokens,
      maxOutputTokens: settings.maxOutputTokens,
    },
  });
}

function embedderFromSettings(settings: AiSettings | null): EmbeddingProvider | null {
  if (!settings?.embeddingApiKey || !settings.embeddingBaseUrl || !settings.embeddingModel) {
    return null;
  }
  return new HttpEmbeddingProvider({
    apiKey: settings.embeddingApiKey,
    baseUrl: settings.embeddingBaseUrl,
    model: settings.embeddingModel,
    dim: settings.embeddingDim,
  });
}
