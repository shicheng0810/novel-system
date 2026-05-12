// Layer 5 · SSE stream.
// GET /api/events?subsystem=...&severity=...&runId=...&worldId=...
// Pushes WorldEvents as they arrive, filtered by query params.

import type { IncomingMessage, ServerResponse } from "node:http";

import type {
  EventSeverity,
  EventSubsystem,
  WorldEvent,
} from "../domain/events";
import type { EventBus } from "../services/event-bus";

const HEARTBEAT_MS = 15_000;

type SseFilter = {
  worldId?: string;
  runId?: string;
  chapterId?: string;
  subsystem?: EventSubsystem[];
  severity?: EventSeverity[];
  since?: number;
};

function parseFilter(url: URL): SseFilter {
  return {
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
  };
}

function matchesFilter(event: WorldEvent, filter: SseFilter): boolean {
  if (filter.worldId && event.worldId !== filter.worldId) return false;
  if (filter.runId && event.runId !== filter.runId) return false;
  if (filter.chapterId && event.chapterId !== filter.chapterId) return false;
  if (filter.subsystem && !filter.subsystem.includes(event.subsystem)) return false;
  if (filter.severity && !filter.severity.includes(event.severity)) return false;
  return true;
}

export function handleSse(
  bus: EventBus,
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): void {
  const filter = parseFilter(url);

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write(": v3 sse connected\n\n");

  // Backfill: replay events newer than `since`, capped at 200.
  if (filter.since) {
    const recent = bus.query({ ...filter, since: filter.since, limit: 200 }).reverse();
    for (const event of recent) {
      writeSseEvent(res, event);
    }
  }

  const unsubscribe = bus.subscribe((event) => {
    if (matchesFilter(event, filter)) {
      writeSseEvent(res, event);
    }
  });

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    if (!res.writableEnded) res.end();
  });
}

function writeSseEvent(res: ServerResponse, event: WorldEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.subsystem}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
