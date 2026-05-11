import { queryWorldEvents } from "./store";
import type {
  WorldEvent,
  WorldEventFilter,
  WorldEventSeverity,
  WorldEventSubsystem,
} from "./types";

/**
 * Translate URL search params into a WorldEventFilter. Centralized here so
 * server route + tests share the same parsing.
 */
export function parseWorldEventsQuery(
  params: URLSearchParams,
): WorldEventFilter {
  const filter: WorldEventFilter = {};
  const chapterId = params.get("chapterId");
  if (chapterId) filter.chapterId = chapterId;
  const runId = params.get("runId");
  if (runId) filter.runId = runId;
  const subsystem = params.get("subsystem");
  if (subsystem) {
    filter.subsystem = subsystem.split(",") as WorldEventSubsystem[];
  }
  const severity = params.get("severity");
  if (severity) {
    filter.severity = severity.split(",") as WorldEventSeverity[];
  }
  const since = params.get("since");
  if (since && Number.isFinite(Number(since))) {
    filter.since = Number(since);
  }
  const limit = params.get("limit");
  if (limit && Number.isFinite(Number(limit))) {
    filter.limit = Number(limit);
  }
  return filter;
}

export type WorldEventsRouteResponse = { events: WorldEvent[] };

export function handleWorldEventsRequest(
  params: URLSearchParams,
): WorldEventsRouteResponse {
  return { events: queryWorldEvents(parseWorldEventsQuery(params)) };
}
