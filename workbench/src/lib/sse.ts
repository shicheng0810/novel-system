// Minimal SSE client. Native EventSource doesn't support query-array params
// in a stable way (depends on browser); we URLSearchParams-encode our filter
// and feed it to EventSource.

import type { WorldEvent } from "../types";

export type SseFilter = {
  worldId?: string;
  runId?: string;
  chapterId?: string;
  subsystem?: string[];
  severity?: string[];
  since?: number;
};

export type SseSubscription = {
  close(): void;
  readonly state: "open" | "closing" | "closed";
};

export type SseOptions = {
  filter?: SseFilter;
  onEvent: (event: WorldEvent) => void;
  onOpen?: () => void;
  onError?: (err: Event) => void;
  baseUrl?: string;
};

function buildUrl(baseUrl: string, filter: SseFilter | undefined): string {
  const url = new URL(`${baseUrl}/api/events`, window.location.origin);
  if (filter) {
    if (filter.worldId) url.searchParams.set("worldId", filter.worldId);
    if (filter.runId) url.searchParams.set("runId", filter.runId);
    if (filter.chapterId) url.searchParams.set("chapterId", filter.chapterId);
    if (filter.since !== undefined) url.searchParams.set("since", String(filter.since));
    for (const s of filter.subsystem ?? []) url.searchParams.append("subsystem", s);
    for (const s of filter.severity ?? []) url.searchParams.append("severity", s);
  }
  return url.toString();
}

export function connectEventStream(options: SseOptions): SseSubscription {
  const baseUrl = options.baseUrl ?? "";
  const url = buildUrl(baseUrl, options.filter);
  const source = new EventSource(url);
  let state: SseSubscription["state"] = "open";

  source.onopen = () => options.onOpen?.();
  source.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data) as WorldEvent;
      options.onEvent(data);
    } catch {
      // ignore malformed payloads (heartbeat lines don't fire onmessage)
    }
  };
  source.onerror = (err) => options.onError?.(err);
  // Forward any named events (event: <subsystem>) the server emits.
  for (const subsystem of [
    "runtime", "frame", "agents", "branches", "gate", "commit",
    "compose", "memory", "atlas", "promotion", "pause", "qimen",
  ]) {
    source.addEventListener(subsystem, (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data) as WorldEvent;
        options.onEvent(data);
      } catch {
        /* noop */
      }
    });
  }

  return {
    get state() {
      return state;
    },
    close() {
      state = "closing";
      source.close();
      state = "closed";
    },
  };
}
