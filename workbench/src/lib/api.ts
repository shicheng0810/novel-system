// HTTP client for the v3 server. Endpoint paths and bodies match
// src/server/actions.ts. No polling — push updates come over SSE.

import type { DaemonStatus, WorldEvent, WorldSnapshot } from "../types";

const BASE = "";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, init);
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`${resp.status} ${path}: ${body.slice(0, 200)}`);
  }
  return (await resp.json()) as T;
}

export const api = {
  applyWorldDraft(input: { worldId: string; parsed: unknown }): Promise<{ snapshot: WorldSnapshot }> {
    return json("/api/world/apply-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
  worldSnapshot(worldId: string): Promise<{ snapshot: WorldSnapshot | null; parsed?: unknown }> {
    return json(`/api/world/snapshot?worldId=${encodeURIComponent(worldId)}`);
  },
  daemonStart(req: { worldId: string; threadId: string; targetTicks: number; composeEvery?: number; composeLens?: unknown }): Promise<DaemonStatus> {
    return json("/api/daemon/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
  },
  daemonPause(): Promise<DaemonStatus> {
    return json("/api/daemon/pause", { method: "POST" });
  },
  daemonResume(): Promise<DaemonStatus> {
    return json("/api/daemon/resume", { method: "POST" });
  },
  daemonStatus(): Promise<DaemonStatus> {
    return json("/api/daemon/status");
  },
  daemonStep(body: { directive?: unknown; lens?: unknown } = {}): Promise<unknown> {
    return json("/api/daemon/step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  compose(body: { worldId: string; lens: unknown }): Promise<unknown> {
    return json("/api/compose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  recallMemory(body: { worldId: string; lineId: string; query: string; limit?: number }): Promise<unknown> {
    return json("/api/memory/recall", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  atlasTree(worldId: string, lineId = "canon"): Promise<{ tree: Array<{ path: string; kind: string }> }> {
    return json(`/api/atlas/tree?worldId=${encodeURIComponent(worldId)}&lineId=${encodeURIComponent(lineId)}`);
  },
  atlasFile(worldId: string, lineId: string, path: string): Promise<{ path: string; body: string } | null> {
    return json(
      `/api/atlas/file?worldId=${encodeURIComponent(worldId)}&lineId=${encodeURIComponent(lineId)}&path=${encodeURIComponent(path)}`,
    );
  },
  eventsQuery(filter: { worldId?: string; subsystem?: string[]; severity?: string[]; limit?: number; since?: number }): Promise<WorldEvent[]> {
    const url = new URL("/api/events/query", "http://x");
    if (filter.worldId) url.searchParams.set("worldId", filter.worldId);
    if (filter.since !== undefined) url.searchParams.set("since", String(filter.since));
    if (filter.limit !== undefined) url.searchParams.set("limit", String(filter.limit));
    for (const s of filter.subsystem ?? []) url.searchParams.append("subsystem", s);
    for (const s of filter.severity ?? []) url.searchParams.append("severity", s);
    return json(url.pathname + url.search);
  },
};
