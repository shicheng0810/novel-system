// Holds the last N=500 events streamed via SSE, bucketed by subsystem.
// Components subscribe via selectors; only re-render when their slice changes.

import { create } from "zustand";

import type { WorldEvent } from "../types";
import { connectEventStream, type SseSubscription } from "../lib/sse";

const MAX_EVENTS = 500;

type EventState = {
  events: WorldEvent[];
  bySubsystem: Record<string, WorldEvent[]>;
  decisions: WorldEvent[];
  latestPulse?: WorldEvent;
  sseState: "idle" | "connecting" | "open" | "error";
  ingest: (event: WorldEvent) => void;
  bulkReplace: (events: WorldEvent[]) => void;
  connect: (options?: { worldId?: string }) => void;
  disconnect: () => void;
  // Frontend-only optimistic dismiss of a decision.
  // TODO: backend endpoint /api/decisions/{id}/resolve — when wired,
  // this should POST then remove on 2xx. Until then, local-only.
  dismissDecision: (id: string) => void;
};

let subscription: SseSubscription | null = null;

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  bySubsystem: {},
  decisions: [],
  latestPulse: undefined,
  sseState: "idle",

  ingest(event) {
    set((state) => {
      const merged = state.events.find((e) => e.id === event.id)
        ? state.events.map((e) => (e.id === event.id ? event : e))
        : [event, ...state.events].slice(0, MAX_EVENTS);
      const bySubsystem = { ...state.bySubsystem };
      const bucket = (bySubsystem[event.subsystem] ?? []).filter((e) => e.id !== event.id);
      bySubsystem[event.subsystem] = [event, ...bucket].slice(0, 50);
      const decisions =
        event.severity === "decision-required"
          ? [event, ...state.decisions.filter((e) => e.id !== event.id)].slice(0, 20)
          : state.decisions.filter((e) => e.id !== event.id || event.status === "succeeded" ? e.id !== event.id : true);
      const isPulse = event.severity !== "ambient" || event.subsystem === "runtime" || event.subsystem === "compose";
      const latestPulse = isPulse && (!state.latestPulse || event.ts >= state.latestPulse.ts) ? event : state.latestPulse;
      return { events: merged, bySubsystem, decisions, latestPulse };
    });
  },

  bulkReplace(events) {
    set(() => {
      const bySubsystem: Record<string, WorldEvent[]> = {};
      for (const event of events.slice(0, MAX_EVENTS)) {
        (bySubsystem[event.subsystem] ??= []).push(event);
      }
      const decisions = events.filter((e) => e.severity === "decision-required").slice(0, 20);
      const latestPulse = events.find((e) => e.severity !== "ambient" || e.subsystem === "runtime");
      return { events: events.slice(0, MAX_EVENTS), bySubsystem, decisions, latestPulse };
    });
  },

  connect(options) {
    if (subscription) subscription.close();
    set({ sseState: "connecting" });
    subscription = connectEventStream({
      filter: options?.worldId ? { worldId: options.worldId } : undefined,
      onOpen: () => set({ sseState: "open" }),
      onEvent: (event) => get().ingest(event),
      onError: () => set({ sseState: "error" }),
    });
  },

  disconnect() {
    subscription?.close();
    subscription = null;
    set({ sseState: "idle" });
  },

  dismissDecision(id) {
    // TODO: when /api/decisions/{id}/resolve exists, POST first.
    set((state) => ({ decisions: state.decisions.filter((e) => e.id !== id) }));
  },
}));
