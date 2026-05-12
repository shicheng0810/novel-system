// Daemon-control state. Status auto-updates via SSE runtime events; explicit
// fetch as fallback when SSE is idle.

import { create } from "zustand";

import { api } from "../lib/api";
import type { DaemonStatus } from "../types";

type DaemonState = {
  status: DaemonStatus | null;
  busy: boolean;
  refresh: () => Promise<void>;
  start: (req: { targetTicks: number; composeEvery?: number }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  step: () => Promise<void>;
  ingestRuntimeEvent: (event: { status: string; subject?: string; summary: string }) => void;
};

export const useDaemonStore = create<DaemonState>((set, get) => ({
  status: null,
  busy: false,

  async refresh() {
    set({ status: await api.daemonStatus() });
  },

  async start(req) {
    set({ busy: true });
    try {
      const status = await api.daemonStart({
        worldId: "default",
        threadId: "workbench",
        targetTicks: req.targetTicks,
        composeEvery: req.composeEvery,
      });
      set({ status });
    } finally {
      set({ busy: false });
    }
  },

  async pause() {
    set({ status: await api.daemonPause() });
  },

  async resume() {
    set({ status: await api.daemonResume() });
  },

  async step() {
    await api.daemonStep();
    await get().refresh();
  },

  ingestRuntimeEvent(_event) {
    // Lightweight: just trigger a refresh on every runtime event so the pill
    // stays accurate without polling.
    void get().refresh();
  },
}));
