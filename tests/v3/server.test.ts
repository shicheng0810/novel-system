import { mkdtempSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createServer, type ServerHandle } from "../../src/v3/server";
import type { ParsedWorldDraft } from "../../src/v3/domain/world";

let tmpDirs: string[] = [];
let serverHandle: ServerHandle | null = null;
let httpServer: Server | null = null;
let baseUrl = "";

const draft: ParsedWorldDraft = {
  worldSpec: { genre: "修仙", timeScale: "阶段", cultivationSystem: "灵海", worldRules: [], factions: [], locations: [] },
  characters: [
    { id: "林焰", name: "林焰", baziRaw: "丙午,丙午,丁巳,丁未", faction: "青岳宗", role: "外门", traits: [], goal: "x", stance: "x", resource: "x" },
  ],
  relationships: [],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "成长", stageGoal: "近真传" },
  ],
  relationshipAnchors: [],
};

beforeEach(async () => {
  const dir = mkdtempSync(join(tmpdir(), "v3-server-"));
  tmpDirs.push(dir);
  serverHandle = createServer({ rootDir: dir });
  httpServer = createHttpServer((req, res) => {
    void serverHandle!.requestHandler(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
  await new Promise<void>((resolve) => httpServer!.listen(0, "127.0.0.1", resolve));
  const addr = httpServer!.address();
  if (typeof addr === "object" && addr) {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  httpServer = null;
  serverHandle?.close();
  serverHandle = null;
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true });
  tmpDirs = [];
});

describe("v3 server (HTTP actions)", () => {
  test("POST /api/world/apply-draft persists snapshot", async () => {
    const resp = await fetch(`${baseUrl}/api/world/apply-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: "w1", parsed: draft }),
    });
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as { worldId: string; snapshot: { characters: Record<string, unknown> } };
    expect(body.worldId).toBe("w1");
    expect(body.snapshot.characters["林焰"]).toBeTruthy();
  });

  test("GET /api/world/snapshot returns the latest snapshot", async () => {
    await fetch(`${baseUrl}/api/world/apply-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: "w1", parsed: draft }),
    });
    const resp = await fetch(`${baseUrl}/api/world/snapshot?worldId=w1`);
    const body = (await resp.json()) as { snapshot: { worldId: string } };
    expect(body.snapshot.worldId).toBe("w1");
  });

  test("POST /api/daemon/start runs a small loop", async () => {
    await fetch(`${baseUrl}/api/world/apply-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: "w1", parsed: draft }),
    });
    const startResp = await fetch(`${baseUrl}/api/daemon/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: "w1", threadId: "t1", targetTicks: 1, composeEvery: 99 }),
    });
    expect(startResp.status).toBe(200);
    // Wait for completion.
    await serverHandle!.deps.daemon.waitForIdle();
    const status = await (await fetch(`${baseUrl}/api/daemon/status`)).json();
    expect((status as { completed: boolean }).completed).toBe(true);
  });

  test("GET /api/events/query returns events from the bus", async () => {
    await fetch(`${baseUrl}/api/world/apply-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: "w1", parsed: draft }),
    });
    const events = (await (
      await fetch(`${baseUrl}/api/events/query?worldId=w1&limit=20`)
    ).json()) as Array<{ subsystem: string }>;
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.subsystem === "atlas")).toBe(true);
  });

  test("GET /api/events streams new events via SSE", async () => {
    const controller = new AbortController();
    const events: Array<{ subsystem: string; summary: string }> = [];

    const promise = (async () => {
      const resp = await fetch(`${baseUrl}/api/events?worldId=w1`, { signal: controller.signal });
      if (!resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (dataLine) {
            try {
              events.push(JSON.parse(dataLine.slice(6)));
            } catch {
              // ignore
            }
          }
          idx = buffer.indexOf("\n\n");
        }
      }
    })().catch(() => undefined);

    // Wait a tick for SSE to attach.
    await new Promise((r) => setTimeout(r, 50));
    // Trigger an apply-draft to fire atlas event.
    await fetch(`${baseUrl}/api/world/apply-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ worldId: "w1", parsed: draft }),
    });
    // Give SSE a moment to deliver.
    await new Promise((r) => setTimeout(r, 100));
    controller.abort();
    await promise;

    expect(events.some((e) => e.subsystem === "atlas")).toBe(true);
  });

  test("unknown route returns 404", async () => {
    const resp = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(resp.status).toBe(404);
  });
});
