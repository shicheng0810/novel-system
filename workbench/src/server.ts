// Phase 0 stub. The 1936-line legacy server lives in workbench/src/_legacy-server.ts
// and depends on modules that were never committed (GraphRuntimeDaemon / Director /
// AgentRegistry / HttpAgentLLMProvider / buildLLMAgentFns / SimulationRunStore /
// StoryMemoryStore / NovelRuntimeKernel / WorldDaemon / AtlasCompiler / etc.).
//
// The new HTTP/SSE surface lands in Phase 5 at src/v3/server/*.
// Until then this stub:
//   - keeps `createWorkbenchApiMiddleware` exported (vite.config.ts wires it in)
//   - proxies the only currently-functional route, /api/world-events, to the
//     existing handler so tests/world-events-route.test.ts keeps passing
//   - returns 501 Not Implemented for every other /api/* endpoint
//
// See /root/.claude/plans/system-reminder-you-re-running-in-buzzing-kitten.md.

import type { IncomingMessage, ServerResponse } from "node:http";

import { handleWorldEventsRequest } from "../../src/world-events/route";

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export type WorkbenchMiddlewareOptions = {
  rootDir?: string;
};

export function createWorkbenchApiMiddleware(_options: WorkbenchMiddlewareOptions = {}) {
  return async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const url = request.url ?? "";
    if (!url.startsWith("/api/")) {
      next();
      return;
    }

    const parsedUrl = new URL(url, "http://localhost");

    if (request.method === "GET" && parsedUrl.pathname === "/api/world-events") {
      sendJson(response, 200, handleWorldEventsRequest(parsedUrl.searchParams));
      return;
    }

    sendJson(response, 501, {
      error: "Not implemented in v3 Phase 0",
      pathname: parsedUrl.pathname,
      hint: "The HTTP/SSE surface is being rewritten — see /root/.claude/plans/system-reminder-you-re-running-in-buzzing-kitten.md (Phase 5).",
    });
  };
}
