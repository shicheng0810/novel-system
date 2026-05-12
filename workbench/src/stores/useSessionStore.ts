// Session-level state: worldId, lineId, parsed/snapshot last seen, draft text.

import { create } from "zustand";

import { api } from "../lib/api";
import type { WorldSnapshot, ParsedWorldDraft } from "../types";

type SessionState = {
  worldId: string;
  lineId: string;
  threadId: string;
  parsed: ParsedWorldDraft | null;
  snapshot: WorldSnapshot | null;
  draftText: string;
  setDraftText: (text: string) => void;
  refresh: () => Promise<void>;
  applyDraft: (parsed: ParsedWorldDraft) => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  worldId: "default",
  lineId: "canon",
  threadId: "workbench",
  parsed: null,
  snapshot: null,
  draftText: "",

  setDraftText(text) {
    set({ draftText: text });
  },

  async refresh() {
    const resp = await api.worldSnapshot(get().worldId);
    set({ snapshot: resp.snapshot, parsed: (resp.parsed as ParsedWorldDraft | null) ?? null });
  },

  async applyDraft(parsed) {
    const resp = await api.applyWorldDraft({ worldId: get().worldId, parsed });
    set({ parsed, snapshot: resp.snapshot });
  },
}));
